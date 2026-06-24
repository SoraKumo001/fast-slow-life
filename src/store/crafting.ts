import {
  BASE_GREAT_SUCCESS_RATE,
  CRAFT_QUEUE_MAX_LENGTH,
  UPGRADE_COST_GOLD_MULTIPLIER,
  CRAFT_DEX_FACTOR,
  CRAFT_WAGE_BASE,
  CRAFT_WAGE_DEX_FACTOR,
  CRAFT_WAGE_CRAFTER_MULTIPLIER,
  CRAFT_EXP_PER_HOUR,
  EDUCATION_EXP_BONUS,
} from "../constants";
import { getUpgradeMaterialsForLevel } from "../data/facilityUpgradeMaterials";
import { ITEMS, getRecipeForItem, getRecipesForFacility } from "../data/masterData";
import { Villager, Facility, FacilityType, RunStats } from "../types/game";
import { calculateCraftTime, generateId } from "../utils/craftHelpers";
import { LogPayload } from "./gameLoopTypes";
import { tryLevelUp } from "./levelUpHelper";
import { processTrainingQueue } from "./trainingLogic";

export function processCraftingAndUpgrades(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  soulUpgrades: Record<string, number>,
  gold: number = 0,
  currentDay: number = 1,
  stats?: RunStats,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  let currentGold = gold;

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

        // 担当村人を解放
        if (fac.upgradeAssignedVillagerId) {
          const workerIdx = nextVillagers.findIndex((v) => v.id === fac.upgradeAssignedVillagerId);
          if (workerIdx !== -1) {
            nextVillagers[workerIdx] = {
              ...nextVillagers[workerIdx],
              status: "idle",
              assignedCraftJobId: null,
            };
          }
          fac.upgradeAssignedVillagerId = null;
        }

        fac.upgradeCost = {
          gold: fac.level * UPGRADE_COST_GOLD_MULTIPLIER,
          materials: getUpgradeMaterialsForLevel(fac.id, fac.level + 1),
        };
      }
    }

    const nextQueue: typeof fac.craftQueue = [];
    fac.craftQueue.forEach((job) => {
      const updatedJob = { ...job };
      updatedJob.timeLeft -= 1;
      if (updatedJob.timeLeft <= 0) {
        let successBonus = BASE_GREAT_SUCCESS_RATE;
        if (updatedJob.assignedVillagerId) {
          const v = nextVillagers.find((villager) => villager.id === updatedJob.assignedVillagerId);
          if (v) {
            if (v.currentJob === "職人") {
              successBonus = 0.12;
            } else {
              successBonus = 0.05 + (v.dex - 10) * CRAFT_DEX_FACTOR;
            }
          }
        }
        const isGreatSuccess = Math.random() < successBonus;
        const recipe = getRecipeForItem(updatedJob.itemId);
        const craftCount = (recipe?.outputCount || 1) * (isGreatSuccess ? 2 : 1);

        if (stats) stats.totalItemsCrafted += craftCount;
        nextInventory[updatedJob.itemId] = (nextInventory[updatedJob.itemId] || 0) + craftCount;

        logs.push({
          message: `${fac.name} で ${ITEMS[updatedJob.itemId]?.name || updatedJob.itemId} の加工が完了しました！${isGreatSuccess ? "【大成功！2倍獲得】" : ""}`,
          type: "craft",
        });

        if (updatedJob.assignedVillagerId) {
          const idx = nextVillagers.findIndex((v) => v.id === updatedJob.assignedVillagerId);
          if (idx !== -1) {
            const worker = nextVillagers[idx];
            // 工賃計算: (基本額 + Dex補正) × 職人ボーナス
            const jobMultiplier =
              worker.currentJob === "職人" ? CRAFT_WAGE_CRAFTER_MULTIPLIER : 1.0;
            const wage = Math.floor(
              (CRAFT_WAGE_BASE + worker.dex * CRAFT_WAGE_DEX_FACTOR) * jobMultiplier,
            );
            currentGold -= wage;
            worker.gold += wage;
            if (stats) stats.totalGoldFromPurchases += wage;

            logs.push({
              message: `${worker.name} に工賃 ${wage} G を支払いました。（Dex: ${worker.dex}${worker.currentJob === "職人" ? "、職人ボーナス×1.5" : ""}）`,
              type: "info",
            });

            // クラフト経験値
            const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
            const expGained = Math.max(
              1,
              Math.floor((recipe?.requiredTime || 1) * CRAFT_EXP_PER_HOUR * eduBonus),
            );
            worker.exp += expGained;
            logs.push({
              message: `${worker.name} がクラフトで経験値 ${expGained} を獲得。`,
              type: "craft",
            });

            const { leveled, updated: leveledV } = tryLevelUp(worker);
            if (leveled) {
              worker.level = leveledV.level;
              worker.exp = leveledV.exp;
              worker.str = leveledV.str;
              worker.int = leveledV.int;
              worker.dex = leveledV.dex;
              worker.agi = leveledV.agi;
              worker.vit = leveledV.vit;
              worker.maxHp = leveledV.maxHp;
              worker.maxStamina = leveledV.maxStamina;
              worker.currentHp = leveledV.currentHp;
              logs.push({
                message: `${worker.name} が レベル ${worker.level} に上がりました！`,
                type: "info",
              });
            }

            nextVillagers[idx] = {
              ...worker,
              status: "idle",
              assignedCraftJobId: null,
            };
          }
        }
      } else {
        nextQueue.push(updatedJob);
      }
    });
    fac.craftQueue = nextQueue;

    // 訓練キュー処理（trainingLogic に委譲）
    if (fac.id === "training_ground" && fac.trainingQueue.length > 0) {
      const trainRes = processTrainingQueue(fac, nextVillagers, currentGold, currentDay);
      currentGold = trainRes.gold;
      logs.push(...trainRes.logs);
      // 村人の更新は trainRes.villagers を nextVillagers のインデックスで反映
      trainRes.villagers.forEach((updatedV, idx) => {
        if (updatedV !== nextVillagers[idx]) {
          nextVillagers[idx] = updatedV;
        }
      });
    }

    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
    gold: currentGold,
    logs,
  };
}

export function processAutoCraft(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };

  Object.keys(nextFacilities).forEach((facKey) => {
    const fac = { ...nextFacilities[facKey as FacilityType] };
    if (fac.level > 0 && fac.craftQueue.length < CRAFT_QUEUE_MAX_LENGTH) {
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
              });

              const idleCrafter = nextVillagers.find(
                (v) => v.status === "idle" && v.currentJob === "職人",
              );
              const idleAny = nextVillagers.find((v) => v.status === "idle");
              const assignedId = (idleCrafter || idleAny)?.id || null;

              const jobId = generateId();
              const baseTime = recipe.requiredTime;
              const assignedVillager = assignedId
                ? nextVillagers.find((v) => v.id === assignedId)
                : null;
              const timeNeeded = calculateCraftTime(baseTime, assignedVillager);

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
    logs,
  };
}
