import {
  BOSS_BATTLE_ROUNDS,
  BOSS_REGEN_PERCENT,
  BOSS_DISENGAGE_GRACE_HOURS,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  MIN_BOSS_DAMAGE,
  EDUCATION_EXP_BONUS,
} from "../constants";
import { MONSTERS } from "../data/masterData";
import {
  Villager,
  DungeonArea,
  ActiveBossState,
  RunStats,
  DungeonVisualEvent,
} from "../types/game";
import { generateId } from "../utils/craftHelpers";
import { isMagicJob } from "../utils/villagerHelpers";
import { random } from "./random";
import {
  executePlayerAttack,
  executeEnemyAttack,
  useBattlePotion,
  getFoodBuffBonus,
  applySalaryDebuff,
} from "./combatEngine";
import { LogPayload } from "./gameLoopTypes";
import { tryLevelUp } from "./levelUpHelper";
import { resetAllThreats } from "./threatLogic";

export function processBossBattle(
  activeBoss: ActiveBossState | null,
  villagers: Villager[],
  dungeons: DungeonArea[],
  currentTier: number,
  bossDefeated: boolean,
  soulUpgrades: Record<string, number>,
  stats: RunStats | undefined,
  currentDay: number,
  tierStartDay: number,
  currentHour: number = 0,
) {
  const logs: LogPayload[] = [];
  const dungeonEvents: DungeonVisualEvent[] = [];
  let nextActiveBoss = activeBoss ? { ...activeBoss } : null;
  let nextVillagers = [...villagers];
  let nextDungeons = [...dungeons];
  let nextBossDefeated = bossDefeated;
  let nextCurrentTier = currentTier;
  let nextTierStartDay = tierStartDay;

  if (nextActiveBoss) {
    const monster = MONSTERS[nextActiveBoss.monsterId];
    const bossArea = nextDungeons.find((d) =>
      d.monsters.some((m) => m.id === nextActiveBoss?.monsterId),
    );
    const bossAreaId = bossArea?.id || "forest";
    const bossDepth = bossArea?.maxDepth ?? 100;
    const attackers = nextVillagers.filter(
      (v) => nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active",
    );

    // ---- Phase 6: ボス戦の離脱リセット ----
    // 勝利なくボス戦が終わったら、ボスは全回復して次回挑戦は満タンから始まる。
    // (a) 全アタッカーが戦闘不能 (HP 0) → 即時離脱
    // (b) 交戦可能なアタッカーが1人もいない状態が24時間継続 → 離脱
    // 「交戦可能なアタッカー」は戦闘側の抽出 (attackerIds ∩ status "active") に揃え、
    // それに加えてボスへ移動中 (traveling_to で対象がこのボス) の者も復帰途中として数える。
    // 治療のための一時的な離脱では即リセットせず、24時間の猶予を与えるための計測。
    let disengaged = false;
    const elapsedHour = (currentDay - 1) * 24 + currentHour;
    if (Number.isFinite(elapsedHour)) {
      const bossState = nextActiveBoss;
      const engagedCapable = nextVillagers.filter((v) => {
        if (!bossState.attackerIds.includes(v.id) || v.currentHp <= 0) return false;
        if (v.status === "active") return true;
        return (
          v.status === "traveling_to" &&
          v.destinationAreaId === bossAreaId &&
          (v.targetMonsterId === bossState.monsterId ||
            v.dungeonState?.targetNodeId === bossState.monsterId)
        );
      });
      const allAttackersDowned =
        bossState.attackerIds.length > 0 &&
        bossState.attackerIds.every((id) => {
          const v = nextVillagers.find((villager) => villager.id === id);
          return !v || v.currentHp <= 0;
        });

      if (allAttackersDowned) {
        disengaged = true;
      } else if (engagedCapable.length > 0) {
        // 交戦中・復帰中・追加参戦のいずれか → 離脱タイマーをリセット
        nextActiveBoss.lastEngagedAtElapsedHour = elapsedHour;
      } else if (bossState.lastEngagedAtElapsedHour === undefined) {
        // 旧セーブ等で未記録の場合は現在時刻を起点にする (即離脱させない)
        nextActiveBoss.lastEngagedAtElapsedHour = elapsedHour;
      } else if (
        elapsedHour - bossState.lastEngagedAtElapsedHour >=
        BOSS_DISENGAGE_GRACE_HOURS
      ) {
        disengaged = true;
      }

      if (disengaged) {
        logs.push({
          message: `【ボス戦】${monster.name}は巣へ戻り、傷を癒した。次に挑むときは万全の状態だ。`,
          type: "system",
        });
      }
    }

    if (disengaged) {
      // 離脱確定: activeBoss を破棄し、この時間は戦闘も自然回復も行わない
      nextActiveBoss = null;
    } else if (attackers.length > 0) {
      const regen = Math.floor(nextActiveBoss.maxHp * BOSS_REGEN_PERCENT);
      nextActiveBoss.currentHp = Math.min(nextActiveBoss.maxHp, nextActiveBoss.currentHp + regen);

      for (let t = 0; t < BOSS_BATTLE_ROUNDS; t++) {
        if (nextActiveBoss.currentHp <= 0) break;

        // 各アタッカーの行動
        for (let i = 0; i < nextVillagers.length; i++) {
          const v = nextVillagers[i];
          if (
            !nextActiveBoss.attackerIds.includes(v.id) ||
            v.status !== "active" ||
            v.currentHp <= 0
          )
            continue;
          if (nextActiveBoss.currentHp <= 0) break;

          // 1. 各アタッカーの回復薬使用
          const potionResult = useBattlePotion(v, v.gold < 0);
          if (potionResult.used) {
            nextVillagers[i] = potionResult.updated;
            if (stats) stats.totalPotionHealing += potionResult.healed;
            logs.push({
              message: `[ボス戦] ${v.name} は回復薬を使用し、HPを ${potionResult.healed} 回復した。 (残り ${potionResult.updated.potionCount} 個)`,
              type: "info",
            });
          }

          // 2. 攻撃処理
          const currentV = nextVillagers[i];
          const cvBuffInt = getFoodBuffBonus(currentV.activeFoodBuffId || null, "int");
          const cvEffectiveInt = applySalaryDebuff(currentV.int + cvBuffInt, currentV.gold < 0);
          let isHealed = false;

          if (currentV.currentJob === "僧侶") {
            let targetToHeal: Villager | null = null;
            let targetIdx = -1;
            let minHpRatio = Infinity;

            for (let j = 0; j < nextVillagers.length; j++) {
              const member = nextVillagers[j];
              if (
                nextActiveBoss.attackerIds.includes(member.id) &&
                member.status === "active" &&
                member.currentHp > 0
              ) {
                const mBuffMaxHp = getFoodBuffBonus(member.activeFoodBuffId || null, "maxHp");
                const mEffectiveMaxHp = applySalaryDebuff(
                  member.maxHp + mBuffMaxHp,
                  member.gold < 0,
                );
                const ratio = member.currentHp / mEffectiveMaxHp;
                if (ratio < minHpRatio) {
                  minHpRatio = ratio;
                  targetToHeal = member;
                  targetIdx = j;
                }
              }
            }

            if (targetToHeal && minHpRatio <= 0.5 && targetIdx !== -1) {
              const healAmount = Math.max(10, Math.floor(cvEffectiveInt * 1.5 + 10));
              const tBuffMaxHp = getFoodBuffBonus(targetToHeal.activeFoodBuffId || null, "maxHp");
              const tEffectiveMaxHp = applySalaryDebuff(
                targetToHeal.maxHp + tBuffMaxHp,
                targetToHeal.gold < 0,
              );
              const actualHeal = Math.min(tEffectiveMaxHp - targetToHeal.currentHp, healAmount);

              nextVillagers[targetIdx] = {
                ...targetToHeal,
                currentHp: targetToHeal.currentHp + actualHeal,
              };

              logs.push({
                message: `[ボス戦] 僧侶 ${currentV.name} はヒールを唱え、${targetToHeal.name} のHPを ${actualHeal} 回復した。`,
                type: "combat",
              });
              isHealed = true;
            }
          }

          if (isHealed) {
            continue;
          }

          const isMagicUser = isMagicJob(currentV.currentJob);
          const efficiency =
            (currentV.isStarving ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
            (currentV.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);

          const playerAttackResult = executePlayerAttack({
            attacker: currentV,
            defender: monster,
            efficiency,
            isMagicUser,
            isSalaryUnpaid: currentV.gold < 0,
            stats,
            logPrefix: "[ボス戦] ",
            attackerName: currentV.name,
            defenderName: `【${monster.name}】`,
          });

          logs.push(playerAttackResult.log);
          if (playerAttackResult.hit) {
            nextActiveBoss.currentHp = Math.max(
              0,
              nextActiveBoss.currentHp - playerAttackResult.damage,
            );
            dungeonEvents.push({
              id: generateId(),
              areaId: bossAreaId,
              type: playerAttackResult.isCritical ? "crit" : "attack",
              actorId: currentV.id,
              targetId: monster.id,
              depth: bossDepth,
              lane: 0,
              value: playerAttackResult.damage,
              isCrit: playerAttackResult.isCritical,
              label: playerAttackResult.isCritical
                ? `${playerAttackResult.damage}!`
                : `${playerAttackResult.damage}`,
            });
          } else {
            dungeonEvents.push({
              id: generateId(),
              areaId: bossAreaId,
              type: "miss",
              actorId: currentV.id,
              targetId: monster.id,
              depth: bossDepth,
              lane: 0,
              label: "MISS",
            });
          }
        }

        // 3. ボスの反撃（アタッカーが生存していれば） -- 1ラウンドに2回攻撃
        for (let counter = 0; counter < 2; counter++) {
          const activeAttackers = nextVillagers.filter(
            (v) =>
              nextActiveBoss?.attackerIds.includes(v.id) &&
              v.status === "active" &&
              v.currentHp > 0,
          );
          if (nextActiveBoss.currentHp <= 0 || activeAttackers.length === 0) break;

          const target = activeAttackers[Math.floor(random() * activeAttackers.length)];
          const vIdx = nextVillagers.findIndex((v) => v.id === target.id);
          if (vIdx === -1) continue;

          const villager = { ...nextVillagers[vIdx] };

          const enemyAttackResult = executeEnemyAttack({
            attacker: monster,
            defender: villager,
            minDamage: MIN_BOSS_DAMAGE,
            isSalaryUnpaid: villager.gold < 0,
            stats,
            logPrefix: "[ボス戦] ",
            attackerName: `【${monster.name}】`,
            defenderName: villager.name,
          });

          logs.push(enemyAttackResult.log);
          if (enemyAttackResult.hit) {
            villager.currentHp = Math.max(0, villager.currentHp - enemyAttackResult.damage);
            nextVillagers[vIdx] = villager;
            dungeonEvents.push({
              id: generateId(),
              areaId: bossAreaId,
              type: "enemy_attack",
              actorId: monster.id,
              targetId: villager.id,
              depth: villager.dungeonState?.currentDepth ?? bossDepth - 3.5,
              lane: villager.dungeonState?.lane ?? 0,
              value: enemyAttackResult.damage,
              isCrit: enemyAttackResult.isCritical,
              label: `-${enemyAttackResult.damage}`,
            });
          }
        }
      }

      // 戦闘不能（HP0）になったアタッカーを強制帰還させ、アタッカーリストから除外
      nextVillagers = nextVillagers.map((v) => {
        if (
          nextActiveBoss?.attackerIds.includes(v.id) &&
          v.status === "active" &&
          v.currentHp <= 0
        ) {
          const area = dungeons.find((d: DungeonArea) => d.id === v.destinationAreaId);
          const distance = area ? area.distance : 2;
          logs.push({
            message: `${v.name} がボス戦で戦闘不能になりました。村への帰還を開始します（残り時間: ${distance}h）。`,
            type: "warning",
          });
          return {
            ...v,
            status: "traveling_back",
            travelTimeLeft: distance,
            order: "rest",
            targetMonsterId: null,
            autoTargetName: null,
          };
        }
        return v;
      });

      if (nextActiveBoss) {
        nextActiveBoss.attackerIds = nextActiveBoss.attackerIds.filter((id) => {
          const v = nextVillagers.find((villager) => villager.id === id);
          return v && v.currentHp > 0;
        });

        // 生存しているアタッカーが0人になった場合、ボス戦を自動終了
        // Phase 6: 全滅による離脱 → ボスは全回復し、次回挑戦は満タンから始まる
        if (nextActiveBoss.attackerIds.length === 0) {
          logs.push({
            message: `【ボス戦】戦闘に参加した村人が全員戦闘不能になったため、ボスとの対決は終了しました。`,
            type: "system",
          });
          logs.push({
            message: `【ボス戦】${monster.name}は巣へ戻り、傷を癒した。次に挑むときは万全の状態だ。`,
            type: "system",
          });
          nextActiveBoss = null;
        }
      }

      if (nextActiveBoss && nextActiveBoss.currentHp <= 0) {
        if (stats) stats.totalBossesDefeated += 1;
        logs.push({
          message: `エリアボス【${monster.name}】を撃破しました！`,
          type: "combat",
        });
        nextBossDefeated = true;

        nextVillagers = nextVillagers.map((v) => {
          if (nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active") {
            const updatedV = { ...v };
            if (updatedV.currentHp > 0) {
              const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
              const expGained = Math.floor(monster.expReward * eduBonus);
              updatedV.exp += expGained;

              const { leveled, updated: leveledV } = tryLevelUp(updatedV);
              if (leveled) {
                logs.push({
                  message: `${leveledV.name} が レベル ${leveledV.level} に上がりました！`,
                  type: "info",
                });
                updatedV.exp = leveledV.exp;
                updatedV.level = leveledV.level;
                updatedV.str = leveledV.str;
                updatedV.int = leveledV.int;
                updatedV.dex = leveledV.dex;
                updatedV.agi = leveledV.agi;
                updatedV.vit = leveledV.vit;
                updatedV.maxHp = leveledV.maxHp;
                updatedV.maxStamina = leveledV.maxStamina;
                updatedV.currentHp = leveledV.currentHp;
              }
            }
            updatedV.status = "idle";
            updatedV.order = "gather";
            updatedV.targetMonsterId = null;
            updatedV.autoTargetName = null;
            return updatedV;
          }
          return v;
        });

        let isClear = false;
        if (nextCurrentTier < 5) {
          nextCurrentTier += 1;
          nextBossDefeated = false;
          // 新 Tier 開始日を更新（次 Tier の脅威度進行 of 基準日）
          nextTierStartDay = currentDay;
          logs.push({
            message: `新しいエリアと施設が解放されました！`,
            type: "system",
          });
        } else {
          isClear = true;
          logs.push({
            message: `【ゲームクリア】伝説の魔獣【終焉の竜】を討伐しました！世界に平和が戻りました。`,
            type: "system",
          });
        }
        nextActiveBoss = null;
        nextDungeons = resetAllThreats(nextDungeons);

        if (isClear) {
          return {
            activeBoss: null,
            villagers: nextVillagers,
            bossDefeated: true,
            currentTier: nextCurrentTier,
            tierStartDay: nextTierStartDay,
            logs,
            dungeonEvents,
            gameOver: true,
            gameOverReason: "クリア",
            dungeons: nextDungeons,
          };
        }
      }
    } else if (nextActiveBoss) {
      // 交戦可能なアタッカー不在 (離脱猶予中) は自然回復のみ
      const regen = Math.floor(nextActiveBoss.maxHp * BOSS_REGEN_PERCENT);
      nextActiveBoss.currentHp = Math.min(nextActiveBoss.maxHp, nextActiveBoss.currentHp + regen);
    }
  }

  return {
    activeBoss: nextActiveBoss,
    villagers: nextVillagers,
    bossDefeated: nextBossDefeated,
    currentTier: nextCurrentTier,
    tierStartDay: nextTierStartDay,
    logs,
    dungeonEvents,
    gameOver: false,
    gameOverReason: undefined,
    dungeons: nextDungeons,
  };
}
