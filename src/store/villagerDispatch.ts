import { MAX_POTIONS_PER_VILLAGER } from "../constants";
import { ITEMS } from "../data/masterData";
import { Villager, OrderType, DungeonArea } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export interface DispatchResult {
  villagers: Villager[];
  inventory: Record<string, number>;
  logs: LogPayload[];
  anyDispatched: boolean;
}

export function dispatchIdleVillagersHelper(params: {
  villagers: Villager[];
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
  dungeons: DungeonArea[];
  currentTier: number;
  bossDefeated: boolean;
}): DispatchResult {
  const { villagers, inventory, targetAmounts, dungeons, currentTier, bossDefeated } = params;

  const hasIdleVillagers = villagers.some((v) => v.status === "idle" && v.order !== "rest");
  if (!hasIdleVillagers) {
    return {
      villagers,
      inventory,
      logs: [],
      anyDispatched: false,
    };
  }

  let anyDispatched = false;
  const nextInventory = { ...inventory };
  const logs: LogPayload[] = [];

  const updatedVillagers = villagers.map((v) => {
    if (v.status === "idle" && v.order !== "rest") {
      let targetAreaId: string | null = null;
      let targetOrder: OrderType = "gather";
      let resolvedAutoTargetName: string | null = null;

      const missingItemIds = Object.keys(targetAmounts).filter((itemId) => {
        const count = nextInventory[itemId] || 0;
        const target = targetAmounts[itemId] || 0;
        return count < target;
      });

      if (missingItemIds.length > 0) {
        let preferredCategories: string[] = [];
        const job = v.currentJob;
        if (job === "農民") preferredCategories = ["food"];
        else if (job === "木こり") preferredCategories = ["material"];
        else if (job === "猟師") preferredCategories = ["food", "material"];
        else if (job === "鉱夫") preferredCategories = ["ore", "material"];
        else if (job === "薬師") preferredCategories = ["herb", "mana_stone"];
        else if (job === "魔術師") preferredCategories = ["mana_stone"];
        else if (job === "僧侶") preferredCategories = ["herb"];
        else if (job === "職人") preferredCategories = ["ore", "material"];
        else if (job === "戦士") preferredCategories = ["material"];

        const sortedMissingItemIds = [...missingItemIds].sort((a, b) => {
          const aCategory = ITEMS[a]?.category || "";
          const bCategory = ITEMS[b]?.category || "";
          const aPref = preferredCategories.includes(aCategory) ? 1 : 0;
          const bPref = preferredCategories.includes(bCategory) ? 1 : 0;

          if (aPref !== bPref) {
            return bPref - aPref;
          }

          const aCount = nextInventory[a] || 0;
          const aTarget = targetAmounts[a] || 1;
          const aRatio = aCount / aTarget;

          const bCount = nextInventory[b] || 0;
          const bTarget = targetAmounts[b] || 1;
          const bRatio = bCount / bTarget;

          return aRatio - bRatio;
        });

        for (const missingId of sortedMissingItemIds) {
          const area = dungeons.find(
            (d) =>
              d.unlockedAtTier <= currentTier &&
              d.gathers.some(
                (g) =>
                  g.itemId === missingId &&
                  d.explorationProgress >= (g.unlockedAtProgress || 0) &&
                  !(g.respawnTimeLeft && g.respawnTimeLeft > 0),
              ),
          );
          if (area) {
            targetAreaId = area.id;
            targetOrder = "gather";
            resolvedAutoTargetName = ITEMS[missingId]?.name || null;
            break;
          }

          const dropArea = dungeons.find(
            (d) =>
              d.unlockedAtTier <= currentTier &&
              d.monsters.some(
                (m) =>
                  d.explorationProgress >= (m.unlockedAtProgress || 0) &&
                  (!m.isBoss || bossDefeated) &&
                  !(m.respawnTimeLeft && m.respawnTimeLeft > 0) &&
                  m.drops.some((dr) => dr.itemId === missingId),
              ),
          );
          if (dropArea) {
            targetAreaId = dropArea.id;
            targetOrder = "hunt";
            const targetMonster = dropArea.monsters.find(
              (m) =>
                dropArea.explorationProgress >= (m.unlockedAtProgress || 0) &&
                (!m.isBoss || bossDefeated) &&
                !(m.respawnTimeLeft && m.respawnTimeLeft > 0) &&
                m.drops.some((dr) => dr.itemId === missingId),
            );
            resolvedAutoTargetName = targetMonster ? targetMonster.name : null;
            break;
          }
        }
      }

      if (targetAreaId) {
        anyDispatched = true;
        const area = dungeons.find((d) => d.id === targetAreaId)!;

        let assignedPotionCount = 0;
        let assignedPotionId = "potion";
        const potionPriority = ["high_potion", "mid_potion", "potion"];
        for (const pId of potionPriority) {
          const countInInv = nextInventory[pId] || 0;
          if (countInInv > 0) {
            assignedPotionId = pId;
            assignedPotionCount = Math.min(MAX_POTIONS_PER_VILLAGER, countInInv);
            nextInventory[pId] = countInInv - assignedPotionCount;
            break;
          }
        }

        const potionName = ITEMS[assignedPotionId]?.name || "回復薬";
        logs.push({
          message: `【自動派遣】${v.name} を ${area.name} へ派遣しました（目的: ${targetOrder === "gather" ? `採取 [${resolvedAutoTargetName}]` : `討伐 [${resolvedAutoTargetName}]`}${assignedPotionCount > 0 ? `、${potionName} x${assignedPotionCount}所持` : ""}）。`,
          type: "info",
        });

        return {
          ...v,
          status: "traveling_to",
          destinationAreaId: targetAreaId,
          order: targetOrder,
          autoTargetName: resolvedAutoTargetName,
          travelTimeLeft: area.distance,
          potionItemId: assignedPotionId,
          potionCount: assignedPotionCount,
        } as Villager;
      }
    }
    return v;
  });

  return {
    villagers: updatedVillagers,
    inventory: nextInventory,
    logs,
    anyDispatched,
  };
}
