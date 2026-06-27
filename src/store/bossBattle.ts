import {
  BOSS_BATTLE_ROUNDS,
  BOSS_REGEN_PERCENT,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  MIN_BOSS_DAMAGE,
  EDUCATION_EXP_BONUS,
} from "../constants";
import { MONSTERS } from "../data/masterData";
import { Villager, DungeonArea, ActiveBossState, RunStats } from "../types/game";
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
) {
  const logs: LogPayload[] = [];
  let nextActiveBoss = activeBoss ? { ...activeBoss } : null;
  let nextVillagers = [...villagers];
  let nextDungeons = [...dungeons];
  let nextBossDefeated = bossDefeated;
  let nextCurrentTier = currentTier;
  let nextTierStartDay = tierStartDay;

  if (nextActiveBoss) {
    const monster = MONSTERS[nextActiveBoss.monsterId];
    const attackers = nextVillagers.filter(
      (v) => nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active",
    );

    if (attackers.length > 0) {
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

          const target = activeAttackers[Math.floor(Math.random() * activeAttackers.length)];
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
        if (nextActiveBoss.attackerIds.length === 0) {
          logs.push({
            message: `【ボス戦】戦闘に参加した村人が全員戦闘不能になったため、ボスとの対決は終了しました。`,
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
            gameOver: true,
            gameOverReason: "クリア",
            dungeons: nextDungeons,
          };
        }
      }
    } else {
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
    gameOver: false,
    gameOverReason: undefined,
    dungeons: nextDungeons,
  };
}
