import {
  BASE_GREAT_SUCCESS_RATE,
  CRAFT_QUEUE_MAX_LENGTH,
  UPGRADE_COST_GOLD_MULTIPLIER,
  UPGRADE_COST_MATERIAL_INCREMENT,
  CRAFT_DEX_FACTOR,
} from "../constants";
import { ITEMS, getRecipeForItem, getRecipesForFacility } from "../data/masterData";
import { Villager, Facility, FacilityType } from "../types/game";
import { calculateCraftTime, generateId } from "../utils/craftHelpers";
import { LogPayload } from "./gameLoopTypes";

export function processCraftingAndUpgrades(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  _soulUpgrades: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };

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
          gold: fac.level * UPGRADE_COST_GOLD_MULTIPLIER,
          materials: fac.upgradeCost.materials.map((m) => ({
            ...m,
            count: m.count + UPGRADE_COST_MATERIAL_INCREMENT,
          })),
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

        nextInventory[updatedJob.itemId] = (nextInventory[updatedJob.itemId] || 0) + craftCount;

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
      } else {
        nextQueue.push(updatedJob);
      }
    });
    fac.craftQueue = nextQueue;

    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
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
