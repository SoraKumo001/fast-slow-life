import {
  GameState,
  Villager,
  DungeonArea,
  Facility,
  ActiveBossState,
  GameLog,
  FacilityType,
} from "../types/game";

import { ITEMS, MONSTERS, JOBS, getRecipeForItem, getRecipesForFacility } from "../data/masterData";

export interface LogPayload {
  message: string;
  type: GameLog["type"];
}

export interface AdvanceHourResult {
  currentDay: number;
  currentHour: number;
  food: number;
  villagers: Villager[];
  facilities: Record<FacilityType, Facility>;
  dungeons: DungeonArea[];
  inventory: Record<string, number>;
  currentTier: number;
  activeBoss: ActiveBossState | null;
  bossDefeated: boolean;
  gameLimitDays: number;
  gameOver: boolean;
  isPaused: boolean;
  logsToAppend: LogPayload[];
}

/**
 * リスポーン時間経過処理
 */
export function processRespawns(dungeons: DungeonArea[]): DungeonArea[] {
  return dungeons.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({
      ...g,
      respawnTimeLeft: g.respawnTimeLeft ? Math.max(0, g.respawnTimeLeft - 1) : 0,
    })),
    monsters: d.monsters.map((m) => ({
      ...m,
      respawnTimeLeft: m.respawnTimeLeft ? Math.max(0, m.respawnTimeLeft - 1) : 0,
    })),
  }));
}

/**
 * ① 食料消費と飢餓判定
 */
export function processStarvation(food: number, villagersCount: number) {
  const foodConsumed = villagersCount * (1.0 / 24.0);
  let hasStarvation = false;
  let nextFood = food;
  if (food < foodConsumed) {
    nextFood = 0;
    hasStarvation = true;
  } else {
    nextFood -= foodConsumed;
  }
  return { nextFood, hasStarvation };
}

/**
 * ② 探索度の進行処理
 */
export function processExploration(
  dungeons: DungeonArea[],
  villagers: Villager[],
  currentTier: number,
) {
  const logs: LogPayload[] = [];
  const nextDungeons = dungeons.map((d) => {
    if (d.unlockedAtTier > currentTier || d.explorationProgress >= 100) return d;

    const activeVillagers = villagers.filter(
      (v) => v.status === "active" && v.destinationAreaId === d.id && v.order !== "rest",
    );

    if (activeVillagers.length === 0) return d;

    let totalProgressGained = 0;
    activeVillagers.forEach((v) => {
      const hourlyGain = (v.dex * 0.2 + v.agi * 0.2) / d.difficulty / 24.0;
      totalProgressGained += hourlyGain;
    });

    const prevProgress = d.explorationProgress;
    const nextProgress = Math.min(100, prevProgress + totalProgressGained);

    if (nextProgress >= 100 && prevProgress < 100) {
      logs.push({
        message: `【探索完了】${d.name} の探索度が 100% に達しました！ボスに挑戦可能になりました。`,
        type: "system",
      });
    } else {
      const thresholds = [40, 50, 70];
      thresholds.forEach((th) => {
        if (prevProgress < th && nextProgress >= th) {
          const unlockedItems = d.gathers
            .filter((g) => g.unlockedAtProgress === th)
            .map((g) => ITEMS[g.itemId]?.name);
          const unlockedMons = d.monsters
            .filter((m) => m.unlockedAtProgress === th)
            .map((m) => m.name);
          const itemsStr = unlockedItems.length > 0 ? ` [素材: ${unlockedItems.join(", ")}]` : "";
          const monsStr = unlockedMons.length > 0 ? ` [魔物: ${unlockedMons.join(", ")}]` : "";
          logs.push({
            message: `【探索進行】${d.name} の探索度が ${th}% に達しました！新たな要素が解放されました：${itemsStr}${monsStr}`,
            type: "system",
          });
        }
      });
    }

    return {
      ...d,
      explorationProgress: nextProgress,
    };
  });

  return { dungeons: nextDungeons, logs };
}

/**
 * ③ 施設クラフト・アップグレード進捗処理
 */
export function processCraftingAndUpgrades(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  food: number,
  soulUpgrades: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  let nextFood = food;

  Object.keys(nextFacilities).forEach((facKey) => {
    const fac = { ...nextFacilities[facKey as FacilityType] };

    if (fac.upgradeTimeLeft > 0) {
      fac.upgradeTimeLeft -= 1;
      if (fac.upgradeTimeLeft === 0) {
        fac.level += 1;
        logs.push({
          message: `${fac.name} のアップグレードが完了し、Lv.${fac.level} になりました！`,
          type: "upgrade",
        });

        fac.upgradeCost = {
          gold: fac.level * 300,
          materials: fac.upgradeCost.materials.map((m) => ({
            ...m,
            count: m.count + 5,
          })),
        };
      }
    }

    fac.craftQueue = fac.craftQueue.filter((job) => {
      const updatedJob = { ...job };
      updatedJob.timeLeft -= 1;
      if (updatedJob.timeLeft <= 0) {
        const successBonus = 0.05 + JOBS["職人"].statsMultiplier.dex * 0.05;
        const isGreatSuccess = Math.random() < successBonus;
        const recipe = getRecipeForItem(updatedJob.itemId);
        const craftCount = (recipe?.outputCount || 1) * (isGreatSuccess ? 2 : 1);

        nextInventory[updatedJob.itemId] = (nextInventory[updatedJob.itemId] || 0) + craftCount;
        if (updatedJob.itemId === "food") {
          nextFood += craftCount;
        }

        logs.push({
          message: `${fac.name} で ${ITEMS[updatedJob.itemId]?.name || updatedJob.itemId} の加工が完了しました！${isGreatSuccess ? "【大成功！2倍獲得】" : ""}`,
          type: "craft",
        });

        if (updatedJob.assignedVillagerId) {
          const idx = nextVillagers.findIndex((v) => v.id === updatedJob.assignedVillagerId);
          if (idx !== -1) {
            nextVillagers[idx] = {
              ...nextVillagers[idx],
              status: "idle",
              assignedCraftJobId: null,
            };
          }
        }
        return false;
      }
      return true;
    });

    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
    food: nextFood,
    logs,
  };
}

/**
 * ③.5 ボス討伐の進行処理
 */
export function processBossBattle(
  activeBoss: ActiveBossState | null,
  villagers: Villager[],
  dungeons: DungeonArea[],
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

  const TIER_LIMIT_DAYS = [0, 30, 70, 120, 180, 250];

  if (nextActiveBoss) {
    const monster = MONSTERS[nextActiveBoss.monsterId];
    const attackers = nextVillagers.filter(
      (v) => nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active",
    );

    if (attackers.length > 0) {
      const regen = Math.floor(nextActiveBoss.maxHp * 0.01);
      nextActiveBoss.currentHp = Math.min(nextActiveBoss.maxHp, nextActiveBoss.currentHp + regen);

      for (let t = 0; t < 5; t++) {
        if (nextActiveBoss.currentHp <= 0) break;
        attackers.forEach((v) => {
          if (v.currentHp <= 0 || nextActiveBoss!.currentHp <= 0) return;
          const weaponAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
          const efficiency = (hasStarvation ? 0.5 : 1.0) * (v.stamina === 0 ? 0.3 : 1.0);
          const vAtk = Math.floor(
            (v.str * 1.5 + weaponAtk) * (v.currentJob === "戦士" ? 1.3 : 1.0) * efficiency,
          );
          const damage = Math.max(2, vAtk - monster.def);
          nextActiveBoss!.currentHp -= damage;
        });

        if (nextActiveBoss.currentHp > 0) {
          const target = attackers[Math.floor(Math.random() * attackers.length)];
          if (target && target.currentHp > 0) {
            const vIdx = nextVillagers.findIndex((v) => v.id === target.id);
            if (vIdx !== -1) {
              const villager = { ...nextVillagers[vIdx] };
              const armorDef = ITEMS[villager.armorId]?.equipment?.bonuses.defense || 0;
              const efficiency = (hasStarvation ? 0.5 : 1.0) * (villager.stamina === 0 ? 0.3 : 1.0);
              const vDef = Math.floor((villager.vit + armorDef) * efficiency);
              const damage = Math.max(5, monster.atk - vDef);
              villager.currentHp = Math.max(0, villager.currentHp - damage);
              nextVillagers[vIdx] = villager;
            }
          }
        }
      }

      if (nextActiveBoss.currentHp <= 0) {
        logs.push({
          message: `エリアボス【${monster.name}】を撃破しました！`,
          type: "system",
        });
        nextBossDefeated = true;

        nextVillagers = nextVillagers.map((v) => {
          if (nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active") {
            const updatedV = { ...v };
            if (updatedV.currentHp > 0) {
              const eduBonus = 1.0 + (soulUpgrades.education || 0) * 0.1;
              const expGained = Math.floor(monster.expReward * eduBonus);
              updatedV.exp += expGained;
              const expNeeded = updatedV.level * 100;
              if (updatedV.exp >= expNeeded) {
                updatedV.level += 1;
                updatedV.exp -= expNeeded;
                updatedV.str += 2;
                updatedV.int += 2;
                updatedV.dex += 2;
                updatedV.agi += 2;
                updatedV.vit += 2;
                updatedV.maxHp += 15;
                updatedV.currentHp = updatedV.maxHp;
                logs.push({
                  message: `${updatedV.name} が レベル ${updatedV.level} に上がりました！`,
                  type: "info",
                });
              }
            }
            updatedV.status = "idle";
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
      const regen = Math.floor(nextActiveBoss.maxHp * 0.01);
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

/**
 * ④ 村人の行動・移動・戦闘・採取処理
 */
export function processVillagerActivities(
  villagers: Villager[],
  dungeons: DungeonArea[],
  facilities: Record<FacilityType, Facility>,
  inventory: Record<string, number>,
  food: number,
  targetAmounts: Record<string, number>,
  activeBoss: ActiveBossState | null,
  bossDefeated: boolean,
  hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
  gold: number,
) {
  const logs: LogPayload[] = [];
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  const nextDungeons = dungeons.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({ ...g })),
    monsters: d.monsters.map((m) => ({ ...m })),
  }));
  let nextFood = food;
  let gameOver = false;
  let isPaused = false;

  for (let i = 0; i < nextVillagers.length; i++) {
    const v = { ...nextVillagers[i] };

    if (v.status === "resting") {
      const innLvl = facilities.inn.level;
      const hpRecovery = 10 + innLvl * 5;
      const staminaRecovery = 15 + innLvl * 5;

      v.currentHp = Math.min(v.maxHp, v.currentHp + hpRecovery);
      v.stamina = Math.min(100, v.stamina + staminaRecovery);

      if (v.currentHp === v.maxHp && v.stamina === 100) {
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
      v.currentHp = Math.max(1, v.currentHp - Math.floor(v.maxHp * 0.004));
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
      v.stamina = Math.max(0, v.stamina - 5);

      const efficiency = (hasStarvation ? 0.5 : 1.0) * (v.stamina === 0 ? 0.3 : 1.0);

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

            const score =
              baseMultiplier * jobMod * statVal * (1.0 + v.agi * 0.01) * efficiency * targetPenalty;
            if (score > maxScore) {
              maxScore = score;
              bestItemId = gather.itemId;
            }
          });

          if (bestItemId) {
            v.autoTargetName = ITEMS[bestItemId]?.name || null;
          } else {
            v.autoTargetName = null;
          }
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
              const baseAmount = item.id === "food" ? 10 : 1;

              let jobMod = 1.0;
              const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
              if (jobAdapt) jobMod = jobAdapt;

              const amount = Math.max(1, Math.floor(baseAmount * jobMod * efficiency));

              nextInventory[bestItemId] = (nextInventory[bestItemId] || 0) + amount;
              if (bestItemId === "food") {
                nextFood += amount;
              }

              const eduBonus = 1.0 + (soulUpgrades.education || 0) * 0.1;
              const itemDiff = item.difficulty || 1.0;
              const expGained = Math.max(1, Math.floor(itemDiff * 5 * eduBonus));
              v.exp += expGained;

              logs.push({
                message: `${v.name} が ${area.name} で ${item.name} を ${amount} 個採取しました。（+${expGained} EXP）`,
                type: "gather",
              });

              const expNeeded = v.level * 100;
              if (v.exp >= expNeeded) {
                v.level += 1;
                v.exp -= expNeeded;
                v.str += 2;
                v.int += 2;
                v.dex += 2;
                v.agi += 2;
                v.vit += 2;
                v.maxHp += 15;
                v.currentHp = v.maxHp;
                logs.push({
                  message: `${v.name} が レベル ${v.level} に上がりました！`,
                  type: "info",
                });
              }

              // リスポーン設定
              gather.respawnTimeLeft = gather.respawnTimeTotal || 3;
              gather.currentProgress = 0;
              area.gathers[gatherIdx] = gather;
            }
          }
        }
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
            const randMons = normalMonsters[Math.floor(Math.random() * normalMonsters.length)];
            enemy = { ...randMons };
            enemyIdx = area.monsters.findIndex((m) => m.id === randMons.id);
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

            const weaponAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
            const armorDef = ITEMS[v.armorId]?.equipment?.bonuses.defense || 0;

            const vAtk = Math.floor(
              (v.str * 1.5 + weaponAtk) * (v.currentJob === "戦士" ? 1.3 : 1.0) * efficiency,
            );
            const vDef = Math.floor((v.vit + armorDef) * efficiency);

            let enemyHp = enemy.hp;
            let battleWon = false;
            let villagerDefeated = false;

            for (let turn = 1; turn <= 10; turn++) {
              const damageToEnemy = Math.max(2, vAtk - enemy.def);
              enemyHp -= damageToEnemy;

              if (enemyHp <= 0) {
                battleWon = true;
                break;
              }

              const damageToVillager = Math.max(2, enemy.atk - vDef);
              v.currentHp = Math.max(0, v.currentHp - damageToVillager);

              logs.push({
                message: `[Turn ${turn}] ${enemy.name} の反撃！ ${v.name} は ${damageToVillager} ダメージを受けた。`,
                type: "combat",
              });

              if (v.currentHp <= 0) {
                villagerDefeated = true;
                break;
              }
            }

            if (battleWon) {
              const eduBonus = 1.0 + (soulUpgrades.education || 0) * 0.1;
              const expGained = Math.floor(enemy.expReward * eduBonus);
              v.exp += expGained;

              logs.push({
                message: `${v.name} は ${enemy.name} に勝利！ 経験値 ${expGained} を獲得。`,
                type: "combat",
              });

              const expNeeded = v.level * 100;
              if (v.exp >= expNeeded) {
                v.level += 1;
                v.exp -= expNeeded;
                v.str += 2;
                v.int += 2;
                v.dex += 2;
                v.agi += 2;
                v.vit += 2;
                v.maxHp += 15;
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
                  if (drop.itemId === "food") {
                    nextFood += 1;
                  }
                  logs.push({
                    message: `敵から ${ITEMS[drop.itemId]?.name || drop.itemId} を獲得しました。`,
                    type: "combat",
                  });
                }
              });

              // リスポーン設定
              monsterState.respawnTimeLeft = monsterState.respawnTimeTotal || 4;
              monsterState.currentProgress = 0;
              area.monsters[enemyIdx] = monsterState;
            } else if (villagerDefeated) {
              logs.push({
                message: `${v.name} が戦闘不能（死亡）になりました…`,
                type: "error",
              });
              nextVillagers.splice(i, 1);
              i--;

              if (nextVillagers.length === 0 && gold < 100) {
                logs.push({
                  message: "すべての村人が死亡し、雇用するゴールドもありません。ゲームオーバー！",
                  type: "error",
                });
                gameOver = true;
                isPaused = true;
                break;
              }
            } else {
              logs.push({
                message: `10ターン以内に ${enemy.name} を倒しきれず、引き分け（一時撤退）となりました。`,
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
    food: nextFood,
    dungeons: nextDungeons,
    logs,
    gameOver,
    isPaused,
  };
}

/**
 * ⑤ 自動化（自動アサイン＆自動クラフト）
 */
export function processAutoCraft(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  food: number,
  targetAmounts: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  let nextFood = food;

  Object.keys(nextFacilities).forEach((facKey) => {
    const fac = { ...nextFacilities[facKey as FacilityType] };
    if (fac.level > 0 && fac.craftQueue.length < 3) {
      getRecipesForFacility(fac.id, fac.level).forEach((recipe) => {
        const itemId = recipe.resultItemId;
        const item = ITEMS[itemId];
        if (item) {
          const currentCount = nextInventory[itemId] || 0;
          const inQueueCount = fac.craftQueue.filter((j) => j.itemId === itemId).length;
          const target = targetAmounts[itemId] || 0;

          if (currentCount + inQueueCount < target) {
            const hasMaterials = recipe.requiredItems.every(
              (req) => (nextInventory[req.itemId] || 0) >= req.count,
            );
            if (hasMaterials) {
              recipe.requiredItems.forEach((req) => {
                nextInventory[req.itemId] = Math.max(
                  0,
                  (nextInventory[req.itemId] || 0) - req.count,
                );
                if (req.itemId === "food") {
                  nextFood = Math.max(0, nextFood - req.count);
                }
              });

              const idleCrafter = nextVillagers.find(
                (v) => v.status === "idle" && v.currentJob === "職人",
              );
              const idleAny = nextVillagers.find((v) => v.status === "idle");
              const assignedId = (idleCrafter || idleAny)?.id || null;

              const jobId = Math.random().toString(36).substring(2);
              const baseTime = recipe.requiredTime;
              const isCrafter = assignedId
                ? nextVillagers.find((v) => v.id === assignedId)?.currentJob === "職人"
                : false;
              const timeNeeded = isCrafter ? Math.max(1, Math.floor(baseTime * 0.8)) : baseTime;

              fac.craftQueue.push({
                id: jobId,
                itemId,
                timeLeft: timeNeeded,
                totalTime: timeNeeded,
                assignedVillagerId: assignedId,
              });

              if (assignedId) {
                const idx = nextVillagers.findIndex((v) => v.id === assignedId);
                nextVillagers[idx] = {
                  ...nextVillagers[idx],
                  status: "active",
                  assignedCraftJobId: jobId,
                };
              }

              logs.push({
                message: `【自動クラフト】${fac.name} で ${item.name} の生産を開始しました。`,
                type: "craft",
              });
            }
          }
        }
      });
    }
    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
    food: nextFood,
    logs,
  };
}

/**
 * コアゲームループ計算の統合
 */
export function calculateAdvanceHour(state: GameState): AdvanceHourResult {
  let {
    currentDay,
    currentHour,
    gold,
    food,
    villagers,
    facilities,
    dungeons,
    inventory,
    currentTier,
    activeBoss,
    bossDefeated,
    gameLimitDays,
    gameOver,
    isPaused,
    targetAmounts,
    soulUpgrades,
  } = state;

  const logsToAppend: LogPayload[] = [];

  currentHour += 1;
  if (currentHour >= 24) {
    currentHour = 0;
    currentDay += 1;
  }

  // ボス期限切れ判定
  if (currentDay > gameLimitDays && !bossDefeated) {
    logsToAppend.push({
      message: `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。ゲームオーバー！`,
      type: "error",
    });
    return {
      currentDay,
      currentHour,
      food,
      villagers,
      facilities,
      dungeons,
      inventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameLimitDays,
      gameOver: true,
      isPaused: true,
      logsToAppend,
    };
  }

  // リスポーン時間の進捗
  dungeons = processRespawns(dungeons);

  // ① 食料消費と飢餓判定
  const { nextFood, hasStarvation } = processStarvation(food, villagers.length);
  food = nextFood;

  const updatedInventory = { ...inventory, food: Math.floor(food) };

  // ② 探索度の進行処理
  const explRes = processExploration(dungeons, villagers, currentTier);
  dungeons = explRes.dungeons;
  logsToAppend.push(...explRes.logs);

  // ③ 施設クラフト・アップグレード進捗処理
  const craftRes = processCraftingAndUpgrades(
    facilities,
    villagers,
    updatedInventory,
    food,
    soulUpgrades,
  );
  facilities = craftRes.facilities;
  villagers = craftRes.villagers;
  Object.assign(updatedInventory, craftRes.inventory);
  food = craftRes.food;
  logsToAppend.push(...craftRes.logs);

  // ③.5 ボス討伐の進行処理
  const bossRes = processBossBattle(
    activeBoss,
    villagers,
    dungeons,
    currentTier,
    bossDefeated,
    gameLimitDays,
    hasStarvation,
    soulUpgrades,
  );
  activeBoss = bossRes.activeBoss;
  villagers = bossRes.villagers;
  bossDefeated = bossRes.bossDefeated;
  currentTier = bossRes.currentTier;
  gameLimitDays = bossRes.gameLimitDays;
  logsToAppend.push(...bossRes.logs);

  // ④ 村人の行動・移動・戦闘・採取処理
  const actRes = processVillagerActivities(
    villagers,
    dungeons,
    facilities,
    updatedInventory,
    food,
    targetAmounts,
    activeBoss,
    bossDefeated,
    hasStarvation,
    soulUpgrades,
    gold,
  );
  villagers = actRes.villagers;
  Object.assign(updatedInventory, actRes.inventory);
  food = actRes.food;
  dungeons = actRes.dungeons;
  logsToAppend.push(...actRes.logs);
  if (actRes.gameOver) {
    return {
      currentDay,
      currentHour,
      food,
      villagers,
      facilities,
      dungeons,
      inventory: updatedInventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameLimitDays,
      gameOver: actRes.gameOver,
      isPaused: actRes.isPaused,
      logsToAppend,
    };
  }

  // ⑤ 自動化（自動アサイン＆自動クラフト）
  const autoRes = processAutoCraft(facilities, villagers, updatedInventory, food, targetAmounts);
  facilities = autoRes.facilities;
  villagers = autoRes.villagers;
  Object.assign(updatedInventory, autoRes.inventory);
  food = autoRes.food;
  logsToAppend.push(...autoRes.logs);

  return {
    currentDay,
    currentHour,
    food,
    villagers,
    facilities,
    dungeons,
    inventory: updatedInventory,
    currentTier,
    activeBoss,
    bossDefeated,
    gameLimitDays,
    gameOver,
    isPaused,
    logsToAppend,
  };
}
