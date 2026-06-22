import {
  TIER_LIMIT_DAYS,
  BOSS_BATTLE_ROUNDS,
  BOSS_REGEN_PERCENT,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  MIN_BOSS_DAMAGE,
  EDUCATION_EXP_BONUS,
} from "../constants";
import { MONSTERS } from "../data/masterData";
import { Villager, DungeonArea, ActiveBossState } from "../types/game";
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

export function processBossBattle(
  activeBoss: ActiveBossState | null,
  villagers: Villager[],
  _dungeons: DungeonArea[],
  currentTier: number,
  bossDefeated: boolean,
  gameLimitDays: number,
  _hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
  _isSalaryUnpaid: boolean = false,
) {
  const logs: LogPayload[] = [];
  let nextActiveBoss = activeBoss ? { ...activeBoss } : null;
  let nextVillagers = [...villagers];
  let nextBossDefeated = bossDefeated;
  let nextCurrentTier = currentTier;
  let nextGameLimitDays = gameLimitDays;

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
            logs.push({
              message: `[ボス戦] ${v.name} は回復薬を使用し、HPを ${potionResult.healed} 回復した。 (残り ${potionResult.updated.potionCount} 個)`,
              type: "info",
            });
          }

          // 2. 攻撃処理
          const currentV = nextVillagers[i];
          const cvBuffInt = getFoodBuffBonus(currentV.activeFoodBuffId || null, "int");
          const cvBuffDex = getFoodBuffBonus(currentV.activeFoodBuffId || null, "dex");
          const cvEffectiveInt = applySalaryDebuff(currentV.int + cvBuffInt, currentV.gold < 0);
          const cvEffectiveDex = applySalaryDebuff(currentV.dex + cvBuffDex, currentV.gold < 0);
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

          const hitRate = calculateHitRate(cvEffectiveDex, monster.agi);
          const isHit = Math.random() * 100 < hitRate;

          if (!isHit) {
            logs.push({
              message: `[ボス戦] ${currentV.name} の攻撃！ しかし【${monster.name}】に回避された。`,
              type: "combat",
            });
          } else {
            const critRate = calculateCritRate(cvEffectiveDex);
            const isCritical = Math.random() * 100 < critRate;
            const isMagicUser = isMagicJob(currentV.currentJob);
            const efficiency =
              (currentV.isStarving ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
              (currentV.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);

            const damage = calculatePlayerDamage({
              attacker: currentV,
              defender: monster,
              isCritical,
              efficiency,
              isMagicUser,
              isSalaryUnpaid: currentV.gold < 0,
            });

            nextActiveBoss.currentHp = Math.max(0, nextActiveBoss.currentHp - damage);
            logs.push({
              message: `[ボス戦] ${currentV.name} の攻撃！【${monster.name}】に ${damage} ダメージを与えた。${isCritical ? " (クリティカル！)" : ""}`,
              type: "combat",
            });
          }
        }

        // 3. ボスの反撃（アタッカーが生存していれば）
        const activeAttackers = nextVillagers.filter(
          (v) =>
            nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active" && v.currentHp > 0,
        );

        if (nextActiveBoss.currentHp > 0 && activeAttackers.length > 0) {
          const target = activeAttackers[Math.floor(Math.random() * activeAttackers.length)];
          const vIdx = nextVillagers.findIndex((v) => v.id === target.id);
          if (vIdx !== -1) {
            const villager = { ...nextVillagers[vIdx] };

            const vBuffAgi = getFoodBuffBonus(villager.activeFoodBuffId || null, "agi");
            const vEffectiveAgi = applySalaryDebuff(villager.agi + vBuffAgi, villager.gold < 0);
            const enemyHitRate = calculateHitRate(monster.dex, vEffectiveAgi);
            const isEnemyHit = Math.random() * 100 < enemyHitRate;

            if (!isEnemyHit) {
              logs.push({
                message: `[ボス戦]【${monster.name}】の攻撃！ しかし ${villager.name} は回避した。`,
                type: "combat",
              });
            } else {
              const enemyCritRate = calculateCritRate(monster.dex);
              const isEnemyCrit = Math.random() * 100 < enemyCritRate;

              const damageToVillager = calculateEnemyDamage({
                attacker: monster,
                defender: villager,
                isCritical: isEnemyCrit,
                minDamage: MIN_BOSS_DAMAGE,
                isSalaryUnpaid: villager.gold < 0,
              });

              villager.currentHp = Math.max(0, villager.currentHp - damageToVillager);
              nextVillagers[vIdx] = villager;

              logs.push({
                message: `[ボス戦]【${monster.name}】の攻撃！ ${villager.name} は ${damageToVillager} ダメージを受けた。${isEnemyCrit ? " (クリティカル！)" : ""}`,
                type: "combat",
              });
            }
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
          const area = _dungeons.find((d) => d.id === v.destinationAreaId);
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
            targetGatherItemId: null,
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
        logs.push({
          message: `エリアボス【${monster.name}】を撃破しました！`,
          type: "system",
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
            updatedV.targetGatherItemId = null;
            updatedV.autoTargetName = null;
            return updatedV;
          }
          return v;
        });

        if (nextCurrentTier < 5) {
          nextCurrentTier += 1;
          nextGameLimitDays = TIER_LIMIT_DAYS[nextCurrentTier];
          nextBossDefeated = false;
          logs.push({
            message: `新しいエリアと施設が解放されました！ 次のボス期限は ${nextGameLimitDays} 日目まで。`,
            type: "system",
          });
        }
        nextActiveBoss = null;
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
    gameLimitDays: nextGameLimitDays,
    logs,
  };
}
