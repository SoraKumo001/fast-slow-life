import {
  HUNT_MAX_TURNS,
  DEFAULT_GATHER_RESPAWN_HOURS,
  EDUCATION_EXP_BONUS,
  MONSTER_PROGRESS_AGI_FACTOR,
  GATHER_PROGRESS_BASE,
  MONSTER_PROGRESS_LEVEL_DIVISOR,
  MONSTER_PROGRESS_BASE,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { Villager, DungeonArea, DungeonMonster } from "../types/game";
import type { RunStats } from "../types/game";
import { isMagicJob } from "../utils/villagerHelpers";
import {
  executePlayerAttack,
  executeEnemyAttack,
  useBattlePotion,
  getFoodBuffBonus,
  applySalaryDebuff,
} from "./combatEngine";
import { LogPayload } from "./gameLoopTypes";
import { tryLevelUp } from "./levelUpHelper";
import { processItemAcquisition } from "./poolPurchase";

/**
 * 村人が討伐対象とするモンスターを選択する。
 * 手動ターゲット > 自動選択（ドロップ需要 + 戦闘有利度 + 他村人との競合回避）。
 * v.autoTargetName を副作用で更新する。
 */
function selectHuntTarget(
  v: Villager,
  i: number,
  area: DungeonArea,
  nextVillagers: Villager[],
  nextInventory: Record<string, number>,
  targetAmounts: Record<string, number>,
): { enemy: DungeonMonster | null; enemyIdx: number } {
  const progress = area.explorationProgress;

  // 手動ターゲットが有効ならそれを優先
  const targetedMonsterIdx = area.monsters.findIndex((m) => m.id === v.targetMonsterId);
  const targetedMonster = targetedMonsterIdx !== -1 ? area.monsters[targetedMonsterIdx] : null;
  if (
    targetedMonster &&
    !targetedMonster.isBoss &&
    progress >= (targetedMonster.unlockedAtProgress || 0) &&
    !(targetedMonster.respawnTimeLeft && targetedMonster.respawnTimeLeft > 0)
  ) {
    v.autoTargetName = null;
    return { enemy: { ...targetedMonster }, enemyIdx: targetedMonsterIdx };
  }

  // 現在の自動選択標的がまだ有効なら継続（進行度をリセットしないため）
  if (v.autoTargetName) {
    const currentIdx = area.monsters.findIndex(
      (m) =>
        m.name === v.autoTargetName &&
        !m.isBoss &&
        progress >= (m.unlockedAtProgress || 0) &&
        !(m.respawnTimeLeft && m.respawnTimeLeft > 0),
    );
    if (currentIdx !== -1) {
      return { enemy: { ...area.monsters[currentIdx] }, enemyIdx: currentIdx };
    }
  }

  // 自動選択: 通常モンスターから最適な標的を選ぶ
  const availableMonsters = area.monsters.filter(
    (m) =>
      !m.isBoss &&
      progress >= (m.unlockedAtProgress || 0) &&
      !(m.respawnTimeLeft && m.respawnTimeLeft > 0),
  );

  if (availableMonsters.length === 0) {
    v.autoTargetName = null;
    return { enemy: null, enemyIdx: -1 };
  }

  let selectedMonster = availableMonsters[0];
  let bestTargetRatio = Infinity;
  const isMagicUser = isMagicJob(v.currentJob);

  for (const monster of availableMonsters) {
    // 職業（物理/魔法）と敵の防御・攻撃に基づく有利度計算
    const enemyDefense = isMagicUser
      ? monster.mdef + monster.int * 0.5
      : monster.def + monster.vit * 0.5;
    const combatDifficulty = enemyDefense + monster.atk;
    const advantageMultiplier = Math.max(0.5, Math.min(1.5, combatDifficulty / 30));

    let monsterRatio = 1.0;
    const neededDropRatios = monster.drops
      .map((drop) => {
        const target = targetAmounts[drop.itemId] || 0;
        if (target <= 0) return null;
        return (nextInventory[drop.itemId] || 0) / target;
      })
      .filter((ratio): ratio is number => ratio !== null && ratio < 1);

    if (neededDropRatios.length > 0) {
      monsterRatio = Math.min(...neededDropRatios);
    } else {
      monsterRatio = 1.5;
    }

    monsterRatio *= advantageMultiplier;

    // 他村人と標的が重複する場合はペナルティ
    // B5 修正: traveling_to の村人も「同じ敵に向かっている」として検出する。
    // 旧実装では status === "active" のみを見ており、移動中の村人による
    // 競合を見落とし、誤って2人が同じ敵に到達する可能性があった。
    // gatherLogic.ts:106-110 と同じ条件に揃える。
    const isTargetedByOthers = nextVillagers.some((otherV, idx) => {
      if (idx === i) return false;
      if (
        (otherV.status !== "active" && otherV.status !== "traveling_to") ||
        otherV.destinationAreaId !== v.destinationAreaId
      )
        return false;
      const otherTarget = otherV.targetMonsterId || otherV.autoTargetName;
      return otherTarget === monster.id || otherTarget === monster.name;
    });
    if (isTargetedByOthers) {
      monsterRatio += 10.0;
    }

    if (monsterRatio < bestTargetRatio) {
      bestTargetRatio = monsterRatio;
      selectedMonster = monster;
    }
  }

  const enemyIdx = area.monsters.findIndex((m) => m.id === selectedMonster.id);
  v.autoTargetName = selectedMonster.name;
  return { enemy: { ...selectedMonster }, enemyIdx };
}

/**
 * 自動パーティー戦闘を処理する。
 * 同一 autoTargetName を持つ 1〜3 人のハンターが協力して 1 体のモンスターと戦う。
 * - 1 体の敵に対して全生存メンバーが AGI 順に攻撃
 * - 敵は最低 HP の生存メンバーを標的にする
 * - 各メンバーの HP は個別管理（死亡しても他の生存者がいれば継続）
 * - 戦利品・経験値は各生存メンバーが個別に取得
 */
export function processPartyHunt(
  party: Villager[],
  area: DungeonArea,
  inventory: Record<string, number>,
  _targetAmounts: Record<string, number>,
  efficiency: number,
  soulUpgrades: Record<string, number>,
  gold: number,
  _isSalaryUnpaid: boolean = false,
  stats?: RunStats,
): {
  logs: LogPayload[];
  areaUpdated: boolean;
  gold: number;
  inventory: Record<string, number>;
} {
  const logs: LogPayload[] = [];
  let currentGold = gold;
  let nextInventory = inventory;

  if (party.length === 0)
    return {
      logs,
      areaUpdated: false,
      gold: currentGold,
      inventory: nextInventory,
    };

  const leader = party[0];

  // パーティのターゲットを決定（リーダーの autoTargetName を使用）
  const enemyIdx = area.monsters.findIndex(
    (m) =>
      m.name === leader.autoTargetName &&
      !m.isBoss &&
      area.explorationProgress >= (m.unlockedAtProgress || 0) &&
      !(m.respawnTimeLeft && m.respawnTimeLeft > 0),
  );
  if (enemyIdx === -1) {
    // 有効なターゲットなし → 待機
    return {
      logs,
      areaUpdated: false,
      gold: currentGold,
      inventory: nextInventory,
    };
  }

  const monsterState = { ...area.monsters[enemyIdx] };
  const enemy = monsterState;

  // パーティ全体の平均 AGI で進行速度を計算
  const avgAgi =
    party.reduce((sum, v) => {
      const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
      return sum + applySalaryDebuff(v.agi + buffAgi, v.gold < 0);
    }, 0) / party.length;

  const progressSpeed = Math.max(
    5.0,
    (avgAgi * MONSTER_PROGRESS_AGI_FACTOR + GATHER_PROGRESS_BASE) /
      (enemy.level * MONSTER_PROGRESS_LEVEL_DIVISOR + MONSTER_PROGRESS_BASE),
  );
  monsterState.currentProgress = Math.min(
    100,
    (monsterState.currentProgress || 0) + progressSpeed * efficiency,
  );
  area.monsters[enemyIdx] = monsterState;

  if (monsterState.currentProgress < 100) {
    // まだ遭遇していない
    return {
      logs,
      areaUpdated: true,
      gold: currentGold,
      inventory: nextInventory,
    };
  }

  // ════════════════════════════════════════════
  //  戦闘開始
  // ════════════════════════════════════════════
  const partyName = party.map((v) => v.name).join("・");
  logs.push({
    message: `パーティ (${partyName}) が ${enemy.name} (Lv.${enemy.level}) と遭遇し、戦闘を開始！`,
    type: "combat",
  });

  let enemyHp = enemy.hp;
  let battleWon = false;
  let draw = false;

  for (let turn = 1; turn <= HUNT_MAX_TURNS; turn++) {
    // 生存メンバーを取得
    const survivors = party.filter((v) => v.currentHp > 0);
    if (survivors.length === 0) break; // 全滅

    // ── ① ポーション使用 ──
    for (const member of party) {
      if (member.currentHp <= 0) continue;
      const potionResult = useBattlePotion(member, member.gold < 0);
      if (potionResult.used) {
        member.potionCount = potionResult.updated.potionCount;
        member.currentHp = potionResult.updated.currentHp;
        if (stats) stats.totalPotionHealing += potionResult.healed;
        logs.push({
          message: `[Turn ${turn}] ${member.name} は戦闘中に${ITEMS[member.potionItemId || "potion"]?.name || "回復薬"}を使用し、HPを ${potionResult.healed} 回復した。 (残り ${member.potionCount} 個)`,
          type: "combat",
        });
      }
    }

    // ── ② 僧侶ヒール（生存者のみ） ──
    for (const member of party) {
      if (member.currentHp <= 0 || member.currentJob !== "僧侶") continue;
      const buffInt = getFoodBuffBonus(member.activeFoodBuffId || null, "int");
      const effectiveInt = applySalaryDebuff(member.int + buffInt, member.gold < 0);
      const buffMaxHp = getFoodBuffBonus(member.activeFoodBuffId || null, "maxHp");
      const effectiveMaxHp = applySalaryDebuff(member.maxHp + buffMaxHp, member.gold < 0);
      if (member.currentHp <= effectiveMaxHp * 0.5) {
        const healAmount = Math.max(10, Math.floor(effectiveInt * 1.5 + 10));
        const actualHeal = Math.min(effectiveMaxHp - member.currentHp, healAmount);
        member.currentHp += actualHeal;
        logs.push({
          message: `[Turn ${turn}] 僧侶 ${member.name} はヒールを唱え、自身のHPを ${actualHeal} 回復した。`,
          type: "combat",
        });
      }
    }

    // ── ③ 全生存メンバーの攻撃（AGI 降順） ──
    const sortedAttackers = [...party].filter((v) => v.currentHp > 0).sort((a, b) => b.agi - a.agi);

    for (const member of sortedAttackers) {
      const isMagicUser = isMagicJob(member.currentJob);
      const playerAttackResult = executePlayerAttack({
        attacker: member,
        defender: enemy,
        efficiency,
        isMagicUser,
        isSalaryUnpaid: member.gold < 0,
        stats,
        logPrefix: `[Turn ${turn}] `,
        attackerName: member.name,
        defenderName: ` ${enemy.name} `,
      });

      logs.push(playerAttackResult.log);
      if (playerAttackResult.hit) {
        enemyHp -= playerAttackResult.damage;
      }

      if (enemyHp <= 0) {
        battleWon = true;
        break;
      }
    }

    if (battleWon) break;

    // ── ④ 敵の攻撃（最低 HP の生存メンバーへ） ──
    const target = [...party]
      .filter((v) => v.currentHp > 0)
      .sort((a, b) => a.currentHp - b.currentHp)[0];

    if (target) {
      const enemyAttackResult = executeEnemyAttack({
        attacker: enemy,
        defender: target,
        isSalaryUnpaid: target.gold < 0,
        stats,
        logPrefix: `[Turn ${turn}] `,
        attackerName: ` ${enemy.name} `,
        defenderName: target.name,
        attackLabel: "反撃",
      });

      logs.push(enemyAttackResult.log);
      if (enemyAttackResult.hit) {
        target.currentHp = Math.max(0, target.currentHp - enemyAttackResult.damage);
      }
    }

    // 生存者を再確認してから次のターンへ
    const aliveAfterAttack = party.filter((v) => v.currentHp > 0);
    if (aliveAfterAttack.length === 0) break;
  }

  // ════════════════════════════════════════════
  //  戦闘結果処理
  // ════════════════════════════════════════════
  const survivors = party.filter((v) => v.currentHp > 0);

  if (battleWon) {
    if (stats) stats.totalMonstersDefeated += 1;
    const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;

    logs.push({
      message: `パーティ (${partyName}) は ${enemy.name} に勝利！`,
      type: "combat",
    });

    // 各生存メンバーが個別に経験値・ドロップを取得
    for (const member of survivors) {
      const expGained = Math.floor(enemy.expReward * eduBonus);
      member.exp += expGained;
      logs.push({
        message: `${member.name} は ${enemy.name} から経験値 ${expGained} を獲得。`,
        type: "combat",
      });

      const { leveled, updated: leveledV } = tryLevelUp(member);
      if (leveled) {
        member.level = leveledV.level;
        member.exp = leveledV.exp;
        member.str = leveledV.str;
        member.int = leveledV.int;
        member.dex = leveledV.dex;
        member.agi = leveledV.agi;
        member.vit = leveledV.vit;
        member.maxHp = leveledV.maxHp;
        member.maxStamina = leveledV.maxStamina;
        member.currentHp = leveledV.currentHp;
        logs.push({
          message: `${member.name} が レベル ${member.level} に上がりました！`,
          type: "info",
        });
      }

      // ドロップ判定（猟師ボーナスは各メンバー個別）
      // B13: 意図的なパーティボーナス設計。
      // 生存者ごとに個別判定することで、パーティ人数 N × ドロップ種類 M の分だけ
      // ドロップ抽選が走る（最大 N*M 個のドロップ入手の可能性）。
      // これによりパーティを組むことへの報酬が増える設計になっている。
      enemy.drops.forEach((drop) => {
        const hunterBonus = member.currentJob === "猟師" ? 1.5 : 1.0;
        if (Math.random() < drop.chance * hunterBonus) {
          const acqRes = processItemAcquisition(member, drop.itemId, 1, currentGold, nextInventory);
          currentGold = acqRes.playerGold;
          nextInventory = { ...acqRes.inventory };
          logs.push(...acqRes.logs);
        }
      });
    }

    // 敵のリスポーン設定
    monsterState.respawnTimeLeft = monsterState.respawnTimeTotal || DEFAULT_GATHER_RESPAWN_HOURS;
    monsterState.currentProgress = 0;
    area.monsters[enemyIdx] = monsterState;
  } else if (survivors.length === 0) {
    // 全滅
    logs.push({
      message: `パーティ (${partyName}) は全員戦闘不能になりました。村への帰還を開始します。`,
      type: "warning",
    });
  } else {
    // 引き分け（制限ターン以内に倒せず、全滅もしていない）
    draw = true;
    logs.push({
      message: `パーティ (${partyName}) は ${HUNT_MAX_TURNS}ターン以内に ${enemy.name} を倒しきれず、引き分け（一時撤退）となりました。`,
      type: "combat",
    });
    monsterState.currentProgress = 0;
    area.monsters[enemyIdx] = monsterState;
  }

  // 死亡メンバーを帰還状態にし、生存者は autoTargetName 維持
  for (const member of party) {
    if (member.currentHp <= 0) {
      // 死亡 = 帰還
      member.status = "traveling_back" as Villager["status"];
      member.travelTimeLeft = area.distance;
      member.order = "rest" as Villager["order"];
      member.autoTargetName = null;
    } else if (battleWon || draw) {
      // 勝利 or 引き分け: 生存者は autoTargetName を維持（次ターンも継続）
      // 何もしない（autoTargetName はそのまま）
    }
    // 全滅時は呼び出し元で処理
  }

  return {
    logs,
    areaUpdated: true,
    gold: currentGold,
    inventory: nextInventory,
  };
}

export function processVillagerHunt(
  v: Villager,
  i: number,
  area: DungeonArea,
  nextVillagers: Villager[],
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  efficiency: number,
  soulUpgrades: Record<string, number>,
  gold: number,
  _isSalaryUnpaid: boolean = false,
  stats?: RunStats,
): {
  logs: LogPayload[];
  areaUpdated: boolean;
  gold: number;
  inventory: Record<string, number>;
} {
  const logs: LogPayload[] = [];
  let currentGold = gold;
  let nextInventory = inventory;

  const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
  const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
  const buffMaxHp = getFoodBuffBonus(v.activeFoodBuffId || null, "maxHp");

  const effectiveAgi = applySalaryDebuff(v.agi + buffAgi, v.gold < 0);
  const effectiveInt = applySalaryDebuff(v.int + buffInt, v.gold < 0);
  const effectiveMaxHp = applySalaryDebuff(v.maxHp + buffMaxHp, v.gold < 0);

  const { enemy, enemyIdx } = selectHuntTarget(
    v,
    i,
    area,
    nextVillagers,
    nextInventory,
    targetAmounts,
  );

  if (enemy && enemyIdx !== -1) {
    const monsterState = { ...area.monsters[enemyIdx] };
    const progressSpeed = Math.max(
      5.0,
      (effectiveAgi * MONSTER_PROGRESS_AGI_FACTOR + GATHER_PROGRESS_BASE) /
        (enemy.level * MONSTER_PROGRESS_LEVEL_DIVISOR + MONSTER_PROGRESS_BASE),
    );
    monsterState.currentProgress = Math.min(
      100,
      (monsterState.currentProgress || 0) + progressSpeed * efficiency,
    );
    area.monsters[enemyIdx] = monsterState;

    if (monsterState.currentProgress >= 100) {
      logs.push({
        message: `${v.name} が ${enemy.name} (Lv.${enemy.level}) と遭遇し、戦闘を開始！`,
        type: "combat",
      });

      let enemyHp = enemy.hp;
      let battleWon = false;
      let villagerDefeated = false;

      const isMagicUser = isMagicJob(v.currentJob);

      for (let turn = 1; turn <= HUNT_MAX_TURNS; turn++) {
        const potionResult = useBattlePotion(v, v.gold < 0);

        if (potionResult.used) {
          v.potionCount = potionResult.updated.potionCount;
          v.currentHp = potionResult.updated.currentHp;
          const pId = v.potionItemId || "potion";
          if (stats) stats.totalPotionHealing += potionResult.healed;
          // 探索時のポーション使用は村人本人が持つポーションなので、購入処理は発生しない
          logs.push({
            message: `[Turn ${turn}] ${v.name} は戦闘中に${ITEMS[pId]?.name || "回復薬"}を使用し、HPを ${potionResult.healed} 回復した。 (残り ${v.potionCount} 個)`,
            type: "combat",
          });
        }

        let isHealed = false;
        if (v.currentJob === "僧侶" && v.currentHp <= effectiveMaxHp * 0.5) {
          const healAmount = Math.max(10, Math.floor(effectiveInt * 1.5 + 10));
          const actualHeal = Math.min(effectiveMaxHp - v.currentHp, healAmount);
          v.currentHp += actualHeal;
          logs.push({
            message: `[Turn ${turn}] 僧侶 ${v.name} はヒールを唱え、自身のHPを ${actualHeal} 回復した。`,
            type: "combat",
          });
          isHealed = true;
        }

        if (!isHealed) {
          const playerAttackResult = executePlayerAttack({
            attacker: v,
            defender: enemy,
            efficiency,
            isMagicUser,
            isSalaryUnpaid: v.gold < 0,
            stats,
            logPrefix: `[Turn ${turn}] `,
            attackerName: v.name,
            defenderName: ` ${enemy.name} `,
          });

          logs.push(playerAttackResult.log);
          if (playerAttackResult.hit) {
            enemyHp -= playerAttackResult.damage;
          }

          if (enemyHp <= 0) {
            battleWon = true;
            break;
          }
        }

        const enemyAttackResult = executeEnemyAttack({
          attacker: enemy,
          defender: v,
          isSalaryUnpaid: v.gold < 0,
          stats,
          logPrefix: `[Turn ${turn}] `,
          attackerName: ` ${enemy.name} `,
          defenderName: v.name,
          attackLabel: "反撃",
        });

        logs.push(enemyAttackResult.log);
        if (enemyAttackResult.hit) {
          v.currentHp = Math.max(0, v.currentHp - enemyAttackResult.damage);
        }

        if (v.currentHp <= 0) {
          villagerDefeated = true;
          break;
        }
      }

      if (battleWon) {
        if (stats) stats.totalMonstersDefeated += 1;
        const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
        const expGained = Math.floor(enemy.expReward * eduBonus);
        v.exp += expGained;

        logs.push({
          message: `${v.name} は ${enemy.name} に勝利！ 経験値 ${expGained} を獲得。`,
          type: "combat",
        });

        const { leveled, updated: leveledV } = tryLevelUp(v);
        if (leveled) {
          v.level = leveledV.level;
          v.exp = leveledV.exp;
          v.str = leveledV.str;
          v.int = leveledV.int;
          v.dex = leveledV.dex;
          v.agi = leveledV.agi;
          v.vit = leveledV.vit;
          v.maxHp = leveledV.maxHp;
          v.maxStamina = leveledV.maxStamina;
          v.currentHp = leveledV.currentHp;
          logs.push({
            message: `${v.name} が レベル ${v.level} に上がりました！`,
            type: "info",
          });
        }

        enemy.drops.forEach((drop) => {
          const hunterBonus = v.currentJob === "猟師" ? 1.5 : 1.0;
          if (Math.random() < drop.chance * hunterBonus) {
            const acqRes = processItemAcquisition(v, drop.itemId, 1, currentGold, nextInventory);
            currentGold = acqRes.playerGold;
            nextInventory = { ...acqRes.inventory };
            logs.push(...acqRes.logs);
          }
        });

        monsterState.respawnTimeLeft =
          monsterState.respawnTimeTotal || DEFAULT_GATHER_RESPAWN_HOURS;
        monsterState.currentProgress = 0;
        area.monsters[enemyIdx] = monsterState;
      } else if (villagerDefeated) {
        logs.push({
          message: `${v.name} が戦闘不能になりました。村への帰還を開始します（残り時間: ${area.distance}h）。`,
          type: "warning",
        });
      } else {
        logs.push({
          message: `${HUNT_MAX_TURNS}ターン以内に ${enemy.name} を倒しきれず、引き分け（一時撤退）となりました。`,
          type: "combat",
        });
        monsterState.currentProgress = 0;
        area.monsters[enemyIdx] = monsterState;
      }
    }
  }

  return {
    logs,
    areaUpdated: true,
    gold: currentGold,
    inventory: nextInventory,
  };
}
