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
  calculateHitRate,
  calculateCritRate,
  calculatePlayerDamage,
  calculateEnemyDamage,
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
    const isTargetedByOthers = nextVillagers.some((otherV, idx) => {
      if (idx === i) return false;
      if (otherV.status !== "active" || otherV.destinationAreaId !== v.destinationAreaId)
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

export function processVillagerHunt(
  v: Villager,
  i: number,
  area: DungeonArea,
  nextVillagers: Villager[],
  nextInventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  efficiency: number,
  soulUpgrades: Record<string, number>,
  gold: number,
  _isSalaryUnpaid: boolean = false,
  stats?: RunStats,
): { logs: LogPayload[]; areaUpdated: boolean; gold: number } {
  const logs: LogPayload[] = [];
  let currentGold = gold;

  const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
  const buffDex = getFoodBuffBonus(v.activeFoodBuffId || null, "dex");
  const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
  const buffMaxHp = getFoodBuffBonus(v.activeFoodBuffId || null, "maxHp");

  const effectiveAgi = applySalaryDebuff(v.agi + buffAgi, v.gold < 0);
  const effectiveDex = applySalaryDebuff(v.dex + buffDex, v.gold < 0);
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
          const hitRate = calculateHitRate(effectiveDex, enemy.agi);
          const isHit = Math.random() * 100 < hitRate;

          if (!isHit) {
            logs.push({
              message: `[Turn ${turn}] ${v.name} の攻撃！ しかし ${enemy.name} に回避された。`,
              type: "combat",
            });
          } else {
            const critRate = calculateCritRate(effectiveDex);
            const isCritical = Math.random() * 100 < critRate;

            const damage = calculatePlayerDamage({
              attacker: v,
              defender: enemy,
              isCritical,
              efficiency,
              isMagicUser,
              isSalaryUnpaid: v.gold < 0,
            });

            enemyHp -= damage;
            logs.push({
              message: `[Turn ${turn}] ${v.name} の攻撃！ ${enemy.name} に ${damage} ダメージを与えた。${isCritical ? " (クリティカル！)" : ""}`,
              type: "combat",
            });
          }

          if (enemyHp <= 0) {
            battleWon = true;
            break;
          }
        }

        const enemyHitRate = calculateHitRate(enemy.dex, effectiveAgi);
        const isEnemyHit = Math.random() * 100 < enemyHitRate;

        if (!isEnemyHit) {
          logs.push({
            message: `[Turn ${turn}] ${enemy.name} の反撃！ しかし ${v.name} は回避した。`,
            type: "combat",
          });
        } else {
          const enemyCritRate = calculateCritRate(enemy.dex);
          const isEnemyCrit = Math.random() * 100 < enemyCritRate;

          const damageToVillager = calculateEnemyDamage({
            attacker: enemy,
            defender: v,
            isCritical: isEnemyCrit,
            isSalaryUnpaid: v.gold < 0,
          });

          v.currentHp = Math.max(0, v.currentHp - damageToVillager);
          logs.push({
            message: `[Turn ${turn}] ${enemy.name} の反撃！ ${v.name} は ${damageToVillager} ダメージを受けた。${isEnemyCrit ? " (クリティカル！)" : ""}`,
            type: "combat",
          });
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
            Object.keys(nextInventory).forEach((k) => delete nextInventory[k]);
            Object.assign(nextInventory, acqRes.inventory);
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

  return { logs, areaUpdated: true, gold: currentGold };
}
