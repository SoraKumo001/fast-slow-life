import {
  STAMINA_COST_PER_HOUR,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  STARVATION_HP_LOSS_PERCENT,
  BASE_HP_RECOVERY,
  HP_RECOVERY_PER_INN_LEVEL,
  BASE_STAMINA_RECOVERY,
  STAMINA_RECOVERY_PER_INN_LEVEL,
  HUNT_MAX_TURNS,
  WARRIOR_DAMAGE_BONUS,
  MIN_DAMAGE,
  FOOD_GATHER_AMOUNT,
  BASE_GATHER_AMOUNT,
  DEFAULT_GATHER_RESPAWN_HOURS,
  EDUCATION_EXP_BONUS,
  STAT_GROWTH_PER_LEVEL,
  HP_GROWTH_PER_LEVEL,
  EXP_NEEDED_PER_LEVEL,
  STAMINA_GROWTH_PER_LEVEL,
} from "../constants";
import { ITEMS, JOBS } from "../data/masterData";
import {
  Villager,
  DungeonArea,
  Facility,
  FacilityType,
  DungeonMonster,
  ActiveBossState,
} from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function processVillagerActivities(
  villagers: Villager[],
  dungeons: DungeonArea[],
  facilities: Record<FacilityType, Facility>,
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  activeBoss: ActiveBossState | null,
  _bossDefeated: boolean,
  hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
  _gold: number,
) {
  const logs: LogPayload[] = [];
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  const nextDungeons = dungeons.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({ ...g })),
    monsters: d.monsters.map((m) => ({ ...m })),
  }));
  let gameOver = false;
  let isPaused = false;

  for (let i = 0; i < nextVillagers.length; i++) {
    const v = { ...nextVillagers[i] };

    if (v.status === "resting") {
      const innLvl = facilities.inn.level;
      const hpRecovery = BASE_HP_RECOVERY + innLvl * HP_RECOVERY_PER_INN_LEVEL;
      const staminaRecovery = BASE_STAMINA_RECOVERY + innLvl * STAMINA_RECOVERY_PER_INN_LEVEL;

      const maxStamina = v.maxStamina || 100;
      v.currentHp = Math.min(v.maxHp, v.currentHp + hpRecovery);
      v.stamina = Math.min(maxStamina, v.stamina + staminaRecovery);

      if (v.currentHp === v.maxHp && v.stamina === maxStamina) {
        v.status = "idle";
        v.order = "gather";
        logs.push({
          message: `${v.name} は体力が全回復し、行動可能になりました。`,
          type: "info",
        });
      }
      nextVillagers[i] = v;
      continue;
    }

    if (hasStarvation) {
      v.currentHp = Math.max(1, v.currentHp - Math.floor(v.maxHp * STARVATION_HP_LOSS_PERCENT));
    }

    if (v.status === "traveling_to") {
      v.travelTimeLeft -= 1;
      if (v.travelTimeLeft <= 0) {
        v.status = "active";
        const areaName = nextDungeons.find((d) => d.id === v.destinationAreaId)?.name || "";
        logs.push({
          message: `${v.name} が ${areaName} に到着し、活動を開始しました。`,
          type: "info",
        });
      }
      nextVillagers[i] = v;
      continue;
    }

    if (v.status === "traveling_back") {
      v.travelTimeLeft -= 1;
      if (v.travelTimeLeft <= 0) {
        v.destinationAreaId = null;
        if (v.potionCount > 0) {
          const returnId = v.potionItemId || "potion";
          nextInventory[returnId] = (nextInventory[returnId] || 0) + v.potionCount;
          const pName = ITEMS[returnId]?.name || "回復薬";
          logs.push({
            message: `${v.name} が未使用の${pName} ${v.potionCount} 個を倉庫に返却しました。`,
            type: "info",
          });
          v.potionCount = 0;
        }
        if (v.order === "rest") {
          v.status = "resting";
          logs.push({
            message: `${v.name} が村に帰還し、宿屋で休息を開始しました。`,
            type: "info",
          });
        } else {
          v.status = "idle";
          logs.push({
            message: `${v.name} が村に帰還しました。`,
            type: "info",
          });
        }
      }
      nextVillagers[i] = v;
      continue;
    }

    if (v.status === "active" && v.destinationAreaId) {
      const areaIdx = nextDungeons.findIndex((d) => d.id === v.destinationAreaId);
      if (areaIdx === -1) {
        nextVillagers[i] = v;
        continue;
      }
      const area = nextDungeons[areaIdx];
      v.stamina = Math.max(0, v.stamina - STAMINA_COST_PER_HOUR);

      const efficiency =
        (hasStarvation ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
        (v.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);

      if (v.currentHp <= v.maxHp * 0.5 && v.potionCount > 0) {
        v.potionCount -= 1;
        const pId = v.potionItemId || "potion";
        const healAmt = ITEMS[pId]?.healAmount || 50;
        v.currentHp = Math.min(v.maxHp, v.currentHp + healAmt);
        logs.push({
          message: `${v.name} が${ITEMS[pId]?.name || "回復薬"}を使用し、HPを ${healAmt} 回復しました。`,
          type: "info",
        });
      }

      if (v.currentHp < v.maxHp * 0.3 || v.stamina <= 0) {
        v.status = "traveling_back";
        v.travelTimeLeft = area.distance;
        v.order = "rest";
        v.autoTargetName = null;
        logs.push({
          message: `${v.name} は消耗が激しいため、村への帰還を開始しました（残り時間: ${area.distance}h）。`,
          type: "warning",
        });
        nextVillagers[i] = v;
        continue;
      }

      if (activeBoss && activeBoss.attackerIds.includes(v.id)) {
        nextVillagers[i] = v;
        continue;
      }

      const isAutoGatherCompleted =
        v.order === "gather" &&
        !v.targetGatherItemId &&
        !area.gathers.some((g) => {
          const target = targetAmounts[g.itemId] || 0;
          return target > 0 && (nextInventory[g.itemId] || 0) < target;
        });

      const isAutoHuntCompleted =
        v.order === "hunt" &&
        !v.targetMonsterId &&
        !area.monsters.some((m) =>
          m.drops.some((dr) => {
            const target = targetAmounts[dr.itemId] || 0;
            return target > 0 && (nextInventory[dr.itemId] || 0) < target;
          }),
        );

      if (isAutoGatherCompleted || isAutoHuntCompleted) {
        v.status = "traveling_back";
        v.travelTimeLeft = area.distance;
        v.autoTargetName = null;
        logs.push({
          message: `${v.name} は ${area.name} での派遣目標を達成したため、帰還を開始しました（残り時間: ${area.distance}h）。`,
          type: "info",
        });
        nextVillagers[i] = v;
        continue;
      }

      // --- Gather logic ---
      if (v.order === "gather") {
        let bestItemId = "";
        const progress = area.explorationProgress;

        const targetedGather = area.gathers.find((g) => g.itemId === v.targetGatherItemId);
        if (
          targetedGather &&
          progress >= (targetedGather.unlockedAtProgress || 0) &&
          !(targetedGather.respawnTimeLeft && targetedGather.respawnTimeLeft > 0)
        ) {
          bestItemId = v.targetGatherItemId!;
          v.autoTargetName = null;
        } else {
          let maxScore = -1;
          const availableGathers = area.gathers.filter(
            (g) =>
              progress >= (g.unlockedAtProgress || 0) &&
              !(g.respawnTimeLeft && g.respawnTimeLeft > 0),
          );

          availableGathers.forEach((gather) => {
            const item = ITEMS[gather.itemId];
            if (!item) return;
            const baseMultiplier = 1.0 / gather.difficulty;

            let jobMod = 1.0;
            const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
            if (jobAdapt) jobMod = jobAdapt;

            let statVal = 0;
            if (
              item.category === "food" ||
              item.category === "ore" ||
              item.category === "material"
            ) {
              statVal = v.str * 0.7 + v.dex * 0.3;
            } else {
              statVal = v.int * 0.7 + v.dex * 0.3;
            }

            const currentCount = nextInventory[gather.itemId] || 0;
            const targetCount = targetAmounts[gather.itemId] || 0;
            let targetPenalty = 1.0;
            if (targetCount === 0) {
              targetPenalty = 0.1;
            } else if (currentCount >= targetCount) {
              targetPenalty = 0.01;
            }

            // 同エリアで同じアイテムを狙っている他のアクティブな村人がいる場合はスコアを下げる（ターゲットの重複を避ける）
            let dupPenalty = 1.0;
            const isTargetedByOthers = nextVillagers.some((otherV, idx) => {
              if (idx === i) return false;
              if (otherV.status !== "active" || otherV.destinationAreaId !== v.destinationAreaId)
                return false;
              const otherTarget = otherV.targetGatherItemId || otherV.autoTargetName;
              return otherTarget === gather.itemId || otherTarget === item.name;
            });
            if (isTargetedByOthers) {
              dupPenalty = 0.05;
            }

            const score =
              baseMultiplier *
              jobMod *
              statVal *
              (1.0 + v.agi * 0.01) *
              efficiency *
              targetPenalty *
              dupPenalty;
            if (score > maxScore) {
              maxScore = score;
              bestItemId = gather.itemId;
            }
          });

          v.autoTargetName = bestItemId ? ITEMS[bestItemId]?.name || null : null;
        }

        if (bestItemId) {
          const gatherIdx = area.gathers.findIndex((g) => g.itemId === bestItemId);
          if (gatherIdx !== -1) {
            const gather = { ...area.gathers[gatherIdx] };
            const progressSpeed = (v.dex * 0.8 + 10) / gather.difficulty;
            gather.currentProgress = Math.min(
              100,
              (gather.currentProgress || 0) + progressSpeed * efficiency,
            );
            area.gathers[gatherIdx] = gather;

            if (gather.currentProgress >= 100) {
              const item = ITEMS[bestItemId];
              const baseAmount = item.id === "food" ? FOOD_GATHER_AMOUNT : BASE_GATHER_AMOUNT;

              let jobMod = 1.0;
              const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
              if (jobAdapt) jobMod = jobAdapt;

              const amount = Math.max(1, Math.floor(baseAmount * jobMod * efficiency));

              nextInventory[bestItemId] = (nextInventory[bestItemId] || 0) + amount;

              const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
              const itemDiff = item.difficulty || 1.0;
              const expGained = Math.max(1, Math.floor(itemDiff * 10 * eduBonus));
              v.exp += expGained;

              logs.push({
                message: `${v.name} が ${area.name} で ${item.name} を ${amount} 個採取しました。（+${expGained} EXP）`,
                type: "gather",
              });

              const expNeeded = v.level * EXP_NEEDED_PER_LEVEL;
              if (v.exp >= expNeeded) {
                v.level += 1;
                v.exp -= expNeeded;
                v.str += STAT_GROWTH_PER_LEVEL;
                v.int += STAT_GROWTH_PER_LEVEL;
                v.dex += STAT_GROWTH_PER_LEVEL;
                v.agi += STAT_GROWTH_PER_LEVEL;
                v.vit += STAT_GROWTH_PER_LEVEL;
                v.maxHp += HP_GROWTH_PER_LEVEL;
                v.maxStamina = (v.maxStamina || 100) + STAMINA_GROWTH_PER_LEVEL;
                v.currentHp = v.maxHp;
                logs.push({
                  message: `${v.name} が レベル ${v.level} に上がりました！`,
                  type: "info",
                });
              }

              gather.respawnTimeLeft = gather.respawnTimeTotal || DEFAULT_GATHER_RESPAWN_HOURS;
              gather.currentProgress = 0;
              area.gathers[gatherIdx] = gather;
            }
          }
        }
        // --- Hunt logic ---
      } else if (v.order === "hunt") {
        const progress = area.explorationProgress;
        const availableMonsters = area.monsters.filter(
          (m) =>
            progress >= (m.unlockedAtProgress || 0) &&
            !(m.respawnTimeLeft && m.respawnTimeLeft > 0),
        );

        let enemy: DungeonMonster | null = null;
        let enemyIdx = -1;

        const targetedMonsterIdx = area.monsters.findIndex((m) => m.id === v.targetMonsterId);
        const targetedMonster =
          targetedMonsterIdx !== -1 ? area.monsters[targetedMonsterIdx] : null;
        if (
          targetedMonster &&
          progress >= (targetedMonster.unlockedAtProgress || 0) &&
          !(targetedMonster.respawnTimeLeft && targetedMonster.respawnTimeLeft > 0)
        ) {
          enemy = { ...targetedMonster };
          enemyIdx = targetedMonsterIdx;
          v.autoTargetName = null;
        } else {
          const normalMonsters = availableMonsters.filter((m) => !m.isBoss);
          if (normalMonsters.length > 0) {
            let selectedMonster = normalMonsters[Math.floor(Math.random() * normalMonsters.length)];
            let bestTargetRatio = Infinity;

            normalMonsters.forEach((monster) => {
              const neededDropRatios = monster.drops
                .map((drop) => {
                  const target = targetAmounts[drop.itemId] || 0;
                  if (target <= 0) return null;
                  return (nextInventory[drop.itemId] || 0) / target;
                })
                .filter((ratio): ratio is number => ratio !== null && ratio < 1);

              if (neededDropRatios.length === 0) return;

              let monsterRatio = Math.min(...neededDropRatios);

              // 同エリアで同じモンスターを狙っている他のアクティブな村人がいる場合は優先度を下げる（ターゲットの重複を避ける）
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
            });

            enemy = { ...selectedMonster };
            enemyIdx = area.monsters.findIndex((m) => m.id === selectedMonster.id);
            v.autoTargetName = enemy.name;
          } else {
            v.autoTargetName = null;
          }
        }

        if (enemy && enemyIdx !== -1) {
          const monsterState = { ...area.monsters[enemyIdx] };
          const progressSpeed = (v.agi * 0.8 + 10) / enemy.level;
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

            for (let turn = 1; turn <= HUNT_MAX_TURNS; turn++) {
              // 各ターン開始時：HP50%以下なら回復薬を使用
              if (v.currentHp <= v.maxHp * 0.5 && v.potionCount > 0) {
                v.potionCount -= 1;
                const pId = v.potionItemId || "potion";
                const healAmt = ITEMS[pId]?.healAmount || 50;
                v.currentHp = Math.min(v.maxHp, v.currentHp + healAmt);
                logs.push({
                  message: `[Turn ${turn}] ${v.name} は戦闘中に${ITEMS[pId]?.name || "回復薬"}を使用し、HPを ${healAmt} 回復した。 (残り ${v.potionCount} 個)`,
                  type: "combat",
                });
              }

              // --- 1. 村人の攻撃フェーズ ---
              // 命中判定
              const hitRate = Math.max(50, Math.min(100, 85 + (v.dex - enemy.agi) * 1.5));
              const isHit = Math.random() * 100 < hitRate;

              if (!isHit) {
                logs.push({
                  message: `[Turn ${turn}] ${v.name} の攻撃！ しかし ${enemy.name} に回避された。`,
                  type: "combat",
                });
              } else {
                // クリティカル判定
                const critRate = Math.min(30, v.dex * 0.1);
                const isCritical = Math.random() * 100 < critRate;

                // 物理/魔法の分岐
                const isMagicUser = ["魔術師", "僧侶", "薬師"].includes(v.currentJob);
                let damage = 0;

                if (isMagicUser) {
                  // 魔法攻撃
                  let defenderDef = enemy.mdef + enemy.int * 0.5;
                  if (isCritical) {
                    defenderDef = defenderDef * 0.5;
                  }
                  const weaponInt = ITEMS[v.weaponId]?.equipment?.bonuses.int || 0;
                  const baseDamage = v.int * 1.8 + weaponInt - defenderDef;
                  damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency));
                } else {
                  // 物理攻撃
                  let defenderDef = enemy.def + enemy.vit * 0.5;
                  if (isCritical) {
                    defenderDef = defenderDef * 0.5;
                  }
                  const weaponAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
                  const isWarrior = v.currentJob === "戦士";
                  const jobBonus = isWarrior ? WARRIOR_DAMAGE_BONUS : 1.0;
                  const baseDamage = v.str * 1.5 + weaponAtk - defenderDef;
                  damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency * jobBonus));
                }

                if (isCritical) {
                  damage = Math.floor(damage * 1.5);
                }

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

              // --- 2. 魔物の反撃フェーズ ---
              // 命中判定
              const enemyHitRate = Math.max(50, Math.min(100, 85 + (enemy.dex - v.agi) * 1.5));
              const isEnemyHit = Math.random() * 100 < enemyHitRate;

              if (!isEnemyHit) {
                logs.push({
                  message: `[Turn ${turn}] ${enemy.name} の反撃！ しかし ${v.name} は回避した。`,
                  type: "combat",
                });
              } else {
                // クリティカル判定
                const enemyCritRate = Math.min(30, enemy.dex * 0.1);
                const isEnemyCrit = Math.random() * 100 < enemyCritRate;

                const armorDef = ITEMS[v.armorId]?.equipment?.bonuses.defense || 0;
                let defenderDef = v.vit + armorDef;
                if (isEnemyCrit) {
                  defenderDef = defenderDef * 0.5;
                }

                const baseDamage = enemy.atk - defenderDef;
                let damageToVillager = Math.max(MIN_DAMAGE, Math.floor(baseDamage));
                if (isEnemyCrit) {
                  damageToVillager = Math.floor(damageToVillager * 1.5);
                }

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
              const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
              const expGained = Math.floor(enemy.expReward * eduBonus);
              v.exp += expGained;

              logs.push({
                message: `${v.name} は ${enemy.name} に勝利！ 経験値 ${expGained} を獲得。`,
                type: "combat",
              });

              const expNeeded = v.level * EXP_NEEDED_PER_LEVEL;
              if (v.exp >= expNeeded) {
                v.level += 1;
                v.exp -= expNeeded;
                v.str += STAT_GROWTH_PER_LEVEL;
                v.int += STAT_GROWTH_PER_LEVEL;
                v.dex += STAT_GROWTH_PER_LEVEL;
                v.agi += STAT_GROWTH_PER_LEVEL;
                v.vit += STAT_GROWTH_PER_LEVEL;
                v.maxHp += HP_GROWTH_PER_LEVEL;
                v.maxStamina = (v.maxStamina || 100) + STAMINA_GROWTH_PER_LEVEL;
                v.currentHp = v.maxHp;
                logs.push({
                  message: `${v.name} が レベル ${v.level} に上がりました！`,
                  type: "info",
                });
              }

              enemy.drops.forEach((drop) => {
                const hunterBonus = v.currentJob === "猟師" ? 1.5 : 1.0;
                if (Math.random() < drop.chance * hunterBonus) {
                  nextInventory[drop.itemId] = (nextInventory[drop.itemId] || 0) + 1;
                  logs.push({
                    message: `敵から ${ITEMS[drop.itemId]?.name || drop.itemId} を獲得しました。`,
                    type: "combat",
                  });
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
              v.status = "traveling_back";
              v.travelTimeLeft = area.distance;
              v.order = "rest";
              v.autoTargetName = null;
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
      }
    }
    nextVillagers[i] = v;
  }

  return {
    villagers: nextVillagers,
    inventory: nextInventory,
    dungeons: nextDungeons,
    logs,
    gameOver,
    isPaused,
  };
}
