import { STAT_LABEL_MAP } from "../constants";
import { ITEMS } from "../data/masterData";
import {
  CraftRecipe,
  DungeonArea,
  Facility,
  FacilityType,
  Item,
  ItemCategory,
} from "../types/game";

export const getCategoryBadgeColor = (cat: ItemCategory) => {
  switch (cat) {
    case "food":
      return "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60";
    case "ore":
      return "bg-amber-950/60 text-amber-400 border border-amber-900/60";
    case "herb":
      return "bg-teal-950/60 text-teal-400 border border-teal-900/60";
    case "mana_stone":
      return "bg-purple-950/60 text-purple-400 border border-purple-900/60";
    case "material":
      return "bg-slate-800 text-slate-300 border border-slate-700";
    case "gear_weapon":
      return "bg-red-950/60 text-red-400 border border-red-900/60";
    case "gear_armor":
      return "bg-sky-950/60 text-sky-400 border border-sky-900/60";
    case "consumable":
      return "bg-indigo-950/60 text-indigo-400 border border-indigo-900/60";
    default:
      return "bg-slate-900 text-slate-400";
  }
};

export const getCategoryLabel = (cat: ItemCategory): string => {
  switch (cat) {
    case "food":
      return "食料";
    case "ore":
      return "鉱石";
    case "herb":
      return "薬草";
    case "mana_stone":
      return "魔法石";
    case "material":
      return "素材";
    case "gear_weapon":
      return "武器";
    case "gear_armor":
      return "防具";
    case "consumable":
      return "消耗品";
  }
};

export const getBonusDiff = (
  item: Item,
  currentItem: Item | null,
): { stat: string; before: number; after: number; diff: number }[] => {
  type BonusKey = "attack" | "defense" | "str" | "int" | "dex" | "agi" | "vit";
  const diffs: { stat: string; before: number; after: number; diff: number }[] = [];
  const allStats = new Set<BonusKey>([
    ...Object.keys(item.equipment?.bonuses || {}),
    ...Object.keys(currentItem?.equipment?.bonuses || {}),
  ] as BonusKey[]);

  allStats.forEach((stat) => {
    const before = currentItem?.equipment?.bonuses?.[stat] || 0;
    const after = item.equipment?.bonuses?.[stat] || 0;
    const diff = after - before;
    if (before !== 0 || after !== 0) {
      diffs.push({
        stat: STAT_LABEL_MAP[stat] || stat.toUpperCase(),
        before,
        after,
        diff,
      });
    }
  });

  return diffs;
};

export const getEquipmentBonusString = (item: Item): string => {
  if (!item.equipment?.bonuses) return "";
  const parts: string[] = [];
  const bonuses = item.equipment.bonuses;

  for (const [key, val] of Object.entries(bonuses)) {
    if (val !== undefined && val !== 0) {
      const label = STAT_LABEL_MAP[key] || key.toUpperCase();
      parts.push(`${label}+${val}`);
    }
  }

  return parts.join(" ");
};

// 製造または入手が可能か（現在所持しているか、解放エリアで採取・ドロップできるか、施設でクラフトできるか）
export const isItemAvailable = (
  itemId: string,
  dungeons: DungeonArea[],
  recipes: CraftRecipe[],
  inventory: Record<string, number>,
  facilities: Record<FacilityType, Facility>,
  currentTier: number,
  visited = new Set<string>(),
): boolean => {
  if (visited.has(itemId)) return false;
  visited.add(itemId);

  if ((inventory[itemId] || 0) > 0) return true;

  const isGatherable = dungeons.some((d) => {
    if (d.unlockedAtTier > currentTier) return false;
    return d.gathers.some((g) => {
      if (g.itemId !== itemId) return false;
      return d.explorationProgress >= (g.unlockedAtProgress || 0);
    });
  });
  if (isGatherable) return true;

  const isDroppable = dungeons.some((d) => {
    if (d.unlockedAtTier > currentTier) return false;
    return d.monsters.some((m) => {
      const isMonsUnlocked = d.explorationProgress >= (m.unlockedAtProgress || 0);
      if (!isMonsUnlocked) return false;
      return m.drops.some((drop) => drop.itemId === itemId);
    });
  });
  if (isDroppable) return true;

  const recipe = recipes.find((r) => r.resultItemId === itemId);
  if (recipe) {
    const facilityLevel = facilities[recipe.facilityId]?.level || 0;
    const isFacilityUnlocked = facilityLevel >= recipe.requiredFacilityLevel;
    if (isFacilityUnlocked) {
      return recipe.requiredItems.every((req) => {
        const reqItem = ITEMS[req.itemId];
        if (!reqItem) return false;
        return isItemAvailable(
          reqItem.id,
          dungeons,
          recipes,
          inventory,
          facilities,
          currentTier,
          new Set(visited),
        );
      });
    }
  }

  return false;
};
