import { MAX_POTIONS_PER_VILLAGER, POTION_PRIORITY } from "../constants";
import {
  CATEGORY_FOOD,
  CATEGORY_ORE,
  CATEGORY_MATERIAL,
  CATEGORY_HERB,
  CATEGORY_MANA_STONE,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { OrderType, Villager, DungeonArea, FacilityType, Facility } from "../types/game";
import { selectBestUpgradeVillager } from "../utils/upgradeHelpers";
import { LogPayload } from "./gameLoopTypes";

export interface DispatchResult {
  villagers: Villager[];
  inventory: Record<string, number>;
  logs: LogPayload[];
  anyDispatched: boolean;
  gold: number;
  facilities: Record<FacilityType, Facility>;
}

export function dispatchIdleVillagersHelper(params: {
  villagers: Villager[];
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
  dungeons: DungeonArea[];
  currentTier: number;
  bossDefeated: boolean;
  gold: number;
  facilities: Record<FacilityType, Facility>;
}): DispatchResult {
  const {
    villagers,
    inventory,
    targetAmounts,
    dungeons,
    currentTier,
    bossDefeated,
    gold,
    facilities,
  } = params;

  const hasIdleVillagers = villagers.some((v) => v.status === "idle" && v.order !== "rest");
  if (!hasIdleVillagers) {
    return {
      villagers,
      inventory,
      logs: [],
      anyDispatched: false,
      gold,
      facilities: { ...facilities },
    };
  }

  let anyDispatched = false;
  const nextInventory = { ...inventory };
  const logs: LogPayload[] = [];
  let updatedVillagers = [...villagers];
  let nextGold = gold;
  const nextFacilities = { ...facilities };

  // ── 最優先: 施設アップグレードの担当割り当て ──
  // 1. アップグレード進行中だが担当不在の施設にidle村民を割り当て
  for (const [facId, fac] of Object.entries(nextFacilities)) {
    if (fac.upgradeTimeLeft > 0 && !fac.upgradeAssignedVillagerId && fac.level < fac.maxLevel) {
      const idleCandidates = updatedVillagers.filter(
        (v) => v.status === "idle" && !v.assignedCraftJobId,
      );
      if (idleCandidates.length > 0) {
        const best = selectBestUpgradeVillager(idleCandidates);
        if (best) {
          const idx = updatedVillagers.findIndex((v) => v.id === best.id);
          updatedVillagers[idx] = {
            ...updatedVillagers[idx],
            status: "active",
            assignedCraftJobId: `upgrade_${facId}`,
          };
          nextFacilities[facId as FacilityType] = {
            ...fac,
            upgradeAssignedVillagerId: best.id,
          };
          logs.push({
            message: `【自動割当】${best.name} が ${fac.name} のアップグレード作業を引き継ぎました。`,
            type: "info",
          });
          anyDispatched = true;
        }
      }
    }
  }

  // 残りのidle村民 → ダンジョン派遣（既存ロジック）
  // 同じエリアの同じ採取対象に複数人を派遣しないよう割り当てを追跡
  const assignedGatherTargets = new Map<string, Set<string>>();

  updatedVillagers = updatedVillagers.map((v) => {
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
            // 同じエリアの同じ採取対象には1人だけ派遣
            const areaAssigned = assignedGatherTargets.get(area.id);
            if (areaAssigned?.has(missingId)) {
              continue;
            }
            targetAreaId = area.id;
            targetOrder = "gather";
            resolvedAutoTargetName = ITEMS[missingId]?.name || null;
            if (!assignedGatherTargets.has(area.id)) {
              assignedGatherTargets.set(area.id, new Set());
            }
            assignedGatherTargets.get(area.id)!.add(missingId);
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
            // 既に割り当て済みの採取対象はスキップ
            const areaAssigned = assignedGatherTargets.get(maxUnlockedDungeon.id);
            const selectedGather = availableGathers.find(
              (g) => !areaAssigned || !areaAssigned.has(g.itemId),
            );
            resolvedAutoTargetName = selectedGather
              ? ITEMS[selectedGather.itemId]?.name || null
              : null;
            if (selectedGather) {
              if (!assignedGatherTargets.has(maxUnlockedDungeon.id)) {
                assignedGatherTargets.set(maxUnlockedDungeon.id, new Set());
              }
              assignedGatherTargets.get(maxUnlockedDungeon.id)!.add(selectedGather.itemId);
            }
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
            const price = ITEMS[pId]?.basePrice || 0;
            const maxCanBuy = Math.floor(v.gold / price);
            const toBuy = Math.min(MAX_POTIONS_PER_VILLAGER, countInInv, maxCanBuy);
            if (toBuy > 0) {
              assignedPotionId = pId;
              assignedPotionCount = toBuy;
              v.gold -= toBuy * price;
              nextGold += toBuy * price;
              nextInventory[pId] = countInInv - toBuy;
              break;
            }
          }
        }

        let assignedStaminaCount = 0;
        const staminaDrinkId = "stamina_drink";
        const staminaDrinkInInv = nextInventory[staminaDrinkId] || 0;
        if (staminaDrinkInInv > 0) {
          const price = ITEMS[staminaDrinkId]?.basePrice || 0;
          const maxCanBuy = Math.floor(v.gold / price);
          const toBuy = Math.min(2, staminaDrinkInInv, maxCanBuy);
          if (toBuy > 0) {
            assignedStaminaCount = toBuy;
            v.gold -= toBuy * price;
            nextGold += toBuy * price;
            nextInventory[staminaDrinkId] = staminaDrinkInInv - toBuy;
          }
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
    gold: nextGold,
    facilities: nextFacilities,
  };
}
