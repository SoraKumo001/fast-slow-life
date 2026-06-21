import { STAT_LABEL_MAP } from "../constants";
import { ItemCategory, Item } from "../types/game";

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
