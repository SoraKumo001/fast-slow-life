import {
  TIER_LIMIT_DAYS,
  BOSS_BATTLE_ROUNDS,
  BOSS_REGEN_PERCENT,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  WARRIOR_DAMAGE_BONUS,
  MIN_DAMAGE,
  MIN_BOSS_DAMAGE,
  EDUCATION_EXP_BONUS,
  STAT_GROWTH_PER_LEVEL,
  HP_GROWTH_PER_LEVEL,
  EXP_NEEDED_PER_LEVEL,
} from "../constants";
import { ITEMS, MONSTERS } from "../data/masterData";
import { Villager, DungeonArea, ActiveBossState } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function processBossBattle(
  activeBoss: ActiveBossState | null,
  villagers: Villager[],
  _dungeons: DungeonArea[],
  currentTier: number,
  bossDefeated: boolean,
  gameLimitDays: number,
  hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
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
          if (v.currentHp <= v.maxHp * 0.5 && v.potionCount > 0) {
            const updatedV = { ...v };
            updatedV.potionCount -= 1;
            const pId = updatedV.potionItemId || "potion";
            const healAmt = ITEMS[pId]?.healAmount || 50;
            updatedV.currentHp = Math.min(updatedV.maxHp, updatedV.currentHp + healAmt);
            nextVillagers[i] = updatedV;

            logs.push({
              message: `[ボス戦] ${updatedV.name} は回復薬を使用し、HPを ${healAmt} 回復した。 (残り ${updatedV.potionCount} 個)`,
              type: "info",
            });
          }

          // 2. 攻撃処理
          const currentV = nextVillagers[i];
          const hitRate = Math.max(50, Math.min(100, 85 + (currentV.dex - monster.agi) * 1.5));
          const isHit = Math.random() * 100 < hitRate;

          if (!isHit) {
            logs.push({
              message: `[ボス戦] ${currentV.name} の攻撃！ しかし【${monster.name}】に回避された。`,
              type: "combat",
            });
          } else {
            const critRate = Math.min(30, currentV.dex * 0.1);
            const isCritical = Math.random() * 100 < critRate;

            const isMagicUser = ["魔術師", "僧侶", "薬師"].includes(currentV.currentJob);
            const efficiency =
              (hasStarvation ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
              (currentV.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);
            let damage = 0;

            if (isMagicUser) {
              let defenderDef = monster.mdef + monster.int * 0.5;
              if (isCritical) {
                defenderDef = defenderDef * 0.5;
              }
              const weaponInt = ITEMS[currentV.weaponId]?.equipment?.bonuses.int || 0;
              const baseDamage = currentV.int * 1.8 + weaponInt - defenderDef;
              damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency));
            } else {
              let defenderDef = monster.def + monster.vit * 0.5;
              if (isCritical) {
                defenderDef = defenderDef * 0.5;
              }
              const weaponAtk = ITEMS[currentV.weaponId]?.equipment?.bonuses.attack || 0;
              const isWarrior = currentV.currentJob === "戦士";
              const jobBonus = isWarrior ? WARRIOR_DAMAGE_BONUS : 1.0;
              const baseDamage = currentV.str * 1.5 + weaponAtk - defenderDef;
              damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency * jobBonus));
            }

            if (isCritical) {
              damage = Math.floor(damage * 1.5);
            }

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

            // 命中判定
            const enemyHitRate = Math.max(
              50,
              Math.min(100, 85 + (monster.dex - villager.agi) * 1.5),
            );
            const isEnemyHit = Math.random() * 100 < enemyHitRate;

            if (!isEnemyHit) {
              logs.push({
                message: `[ボス戦]【${monster.name}】の攻撃！ しかし ${villager.name} は回避した。`,
                type: "combat",
              });
            } else {
              const enemyCritRate = Math.min(30, monster.dex * 0.1);
              const isEnemyCrit = Math.random() * 100 < enemyCritRate;

              const armorDef = ITEMS[villager.armorId]?.equipment?.bonuses.defense || 0;
              let defenderDef = villager.vit + armorDef;
              if (isEnemyCrit) {
                defenderDef = defenderDef * 0.5;
              }

              const baseDamage = monster.atk - defenderDef;
              let damageToVillager = Math.max(MIN_BOSS_DAMAGE, Math.floor(baseDamage));
              if (isEnemyCrit) {
                damageToVillager = Math.floor(damageToVillager * 1.5);
              }

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
              const expNeeded = updatedV.level * EXP_NEEDED_PER_LEVEL;
              if (updatedV.exp >= expNeeded) {
                updatedV.level += 1;
                updatedV.exp -= expNeeded;
                updatedV.str += STAT_GROWTH_PER_LEVEL;
                updatedV.int += STAT_GROWTH_PER_LEVEL;
                updatedV.dex += STAT_GROWTH_PER_LEVEL;
                updatedV.agi += STAT_GROWTH_PER_LEVEL;
                updatedV.vit += STAT_GROWTH_PER_LEVEL;
                updatedV.maxHp += HP_GROWTH_PER_LEVEL;
                updatedV.currentHp = updatedV.maxHp;
                logs.push({
                  message: `${updatedV.name} が レベル ${updatedV.level} に上がりました！`,
                  type: "info",
                });
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
