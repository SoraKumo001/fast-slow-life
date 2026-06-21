import { MAX_POTIONS_PER_VILLAGER, POTION_PRIORITY } from "../constants";
import {
  CATEGORY_FOOD,
  CATEGORY_ORE,
  CATEGORY_MATERIAL,
  CATEGORY_HERB,
  CATEGORY_MANA_STONE,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { OrderType, Villager, DungeonArea } from "../types/game";
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
        if (job === "農民") preferredCategories = [CATEGORY_FOOD];
        else if (job === "木こり") preferredCategories = [CATEGORY_MATERIAL];
        else if (job === "猟師") preferredCategories = [CATEGORY_FOOD, CATEGORY_MATERIAL];
        else if (job === "鉱夫") preferredCategories = [CATEGORY_ORE, CATEGORY_MATERIAL];
        else if (job === "薬師") preferredCategories = [CATEGORY_HERB, CATEGORY_MANA_STONE];
        else if (job === "魔術師") preferredCategories = [CATEGORY_MANA_STONE];
        else if (job === "僧侶") preferredCategories = [CATEGORY_HERB];
        else if (job === "職人") preferredCategories = [CATEGORY_ORE, CATEGORY_MATERIAL];
        else if (job === "戦士") preferredCategories = [CATEGORY_MATERIAL];

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

      if (!targetAreaId) {
        // 目標アイテムが不足していない場合の自動稼ぎ派遣
        const maxUnlockedDungeon = [...dungeons]
          .filter((d) => d.unlockedAtTier <= currentTier)
          .sort((a, b) => b.unlockedAtTier - a.unlockedAtTier)[0];

        if (maxUnlockedDungeon) {
          targetAreaId = maxUnlockedDungeon.id;
          const combatJobs = ["戦士", "魔術師", "猟師", "僧侶"];
          targetOrder = combatJobs.includes(v.currentJob) ? "hunt" : "gather";

          if (targetOrder === "gather") {
            const availableGathers = maxUnlockedDungeon.gathers
              .filter((g) => maxUnlockedDungeon.explorationProgress >= (g.unlockedAtProgress || 0))
              .sort((a, b) => b.difficulty - a.difficulty);
            resolvedAutoTargetName = availableGathers[0]
              ? ITEMS[availableGathers[0].itemId]?.name || null
              : null;
          } else {
            const availableMonsters = maxUnlockedDungeon.monsters
              .filter(
                (m) =>
                  !m.isBoss &&
                  maxUnlockedDungeon.explorationProgress >= (m.unlockedAtProgress || 0),
              )
              .sort((a, b) => b.level - a.level);
            resolvedAutoTargetName = availableMonsters[0] ? availableMonsters[0].name : null;
          }
        }
      }

      if (targetAreaId) {
        anyDispatched = true;
        const area = dungeons.find((d) => d.id === targetAreaId)!;

        let assignedPotionCount = 0;
        let assignedPotionId = "potion";
        for (const pId of POTION_PRIORITY) {
          const countInInv = nextInventory[pId] || 0;
          if (countInInv > 0) {
            assignedPotionId = pId;
            assignedPotionCount = Math.min(MAX_POTIONS_PER_VILLAGER, countInInv);
            nextInventory[pId] = countInInv - assignedPotionCount;
            break;
          }
        }

        let assignedStaminaCount = 0;
        const staminaDrinkId = "stamina_drink";
        const staminaDrinkInInv = nextInventory[staminaDrinkId] || 0;
        if (staminaDrinkInInv > 0) {
          assignedStaminaCount = Math.min(2, staminaDrinkInInv);
          nextInventory[staminaDrinkId] = staminaDrinkInInv - assignedStaminaCount;
        }

        const potionName = ITEMS[assignedPotionId]?.name || "回復薬";
        const staminaName = ITEMS[staminaDrinkId]?.name || "スタミナポーション";
        let itemStatusText = "";
        if (assignedPotionCount > 0 && assignedStaminaCount > 0) {
          itemStatusText = `、${potionName} x${assignedPotionCount}・${staminaName} x${assignedStaminaCount}所持`;
        } else if (assignedPotionCount > 0) {
          itemStatusText = `、${potionName} x${assignedPotionCount}所持`;
        } else if (assignedStaminaCount > 0) {
          itemStatusText = `、${staminaName} x${assignedStaminaCount}所持`;
        }

        logs.push({
          message: `【自動派遣】${v.name} を ${area.name} へ派遣しました（目的: ${targetOrder === "gather" ? `採取 [${resolvedAutoTargetName}]` : `討伐 [${resolvedAutoTargetName}]`}${itemStatusText}）。`,
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
          staminaDrinkItemId: staminaDrinkId,
          staminaDrinkCount: assignedStaminaCount,
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
