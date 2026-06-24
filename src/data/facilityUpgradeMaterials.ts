import { FacilityType } from "../types/game";

/**
 * 施設アップグレード素材スケジュール。
 * キー = ターゲットレベル（そのレベルに到達するために必要な素材）。
 * Lv1: 建設コスト / Lv2〜5: アップグレードコスト
 */
export const FACILITY_UPGRADE_MATERIALS: Record<
  FacilityType,
  Record<number, { itemId: string; count: number }[]>
> = {
  inn: {
    1: [{ itemId: "wood", count: 10 }],
    2: [{ itemId: "wood", count: 15 }],
    3: [{ itemId: "wood_plank", count: 8 }],
    4: [
      { itemId: "wood_plank", count: 12 },
      { itemId: "iron_ingot", count: 3 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "silver_ingot", count: 2 },
    ],
  },
  workshop: {
    1: [
      { itemId: "wood", count: 15 },
      { itemId: "stone", count: 10 },
    ],
    2: [
      { itemId: "wood", count: 20 },
      { itemId: "stone", count: 15 },
    ],
    3: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "iron_ingot", count: 3 },
    ],
    4: [
      { itemId: "wood_plank", count: 12 },
      { itemId: "iron_ingot", count: 6 },
      { itemId: "crystal_powder", count: 2 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "dark_ingot", count: 2 },
    ],
  },
  farm: {
    1: [{ itemId: "wood", count: 10 }],
    2: [
      { itemId: "wood", count: 15 },
      { itemId: "stone", count: 5 },
    ],
    3: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 2 },
    ],
    4: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "iron_ingot", count: 4 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 3 },
      { itemId: "silver_ingot", count: 2 },
    ],
  },
  kitchen: {
    1: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "stone", count: 10 },
    ],
    2: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "stone", count: 15 },
    ],
    3: [
      { itemId: "wood_plank", count: 10 },
      { itemId: "iron_ingot", count: 3 },
    ],
    4: [
      { itemId: "reinforced_plank", count: 3 },
      { itemId: "silver_ingot", count: 2 },
      { itemId: "crystal_powder", count: 2 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "dark_ingot", count: 1 },
      { itemId: "mana_stone", count: 3 },
    ],
  },
  alchemy: {
    1: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "iron_ingot", count: 3 },
    ],
    2: [
      { itemId: "wood_plank", count: 10 },
      { itemId: "iron_ingot", count: 5 },
      { itemId: "mana_stone", count: 2 },
    ],
    3: [
      { itemId: "crystal_powder", count: 3 },
      { itemId: "mana_stone", count: 4 },
    ],
    4: [
      { itemId: "mana_stone", count: 6 },
      { itemId: "dark_crystal", count: 2 },
      { itemId: "crystal_powder", count: 5 },
    ],
    5: [
      { itemId: "mana_stone", count: 8 },
      { itemId: "dark_crystal", count: 3 },
      { itemId: "dark_ingot", count: 1 },
    ],
  },
  market: {
    1: [{ itemId: "wood", count: 5 }],
    2: [
      { itemId: "wood", count: 10 },
      { itemId: "stone", count: 5 },
    ],
    3: [
      { itemId: "wood_plank", count: 5 },
      { itemId: "iron_ingot", count: 2 },
    ],
    4: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "silver_ingot", count: 2 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 4 },
      { itemId: "dark_ingot", count: 1 },
    ],
  },
  guild: {
    1: [
      { itemId: "wood", count: 10 },
      { itemId: "stone", count: 5 },
    ],
    2: [
      { itemId: "wood", count: 15 },
      { itemId: "stone", count: 10 },
    ],
    3: [
      { itemId: "wood_plank", count: 8 },
      { itemId: "iron_ingot", count: 3 },
    ],
    4: [
      { itemId: "wood_plank", count: 10 },
      { itemId: "silver_ingot", count: 2 },
      { itemId: "mana_stone", count: 2 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "dark_ingot", count: 1 },
      { itemId: "mana_stone", count: 4 },
    ],
  },
  weapon_shop: {
    1: [
      { itemId: "wood_plank", count: 10 },
      { itemId: "stone", count: 10 },
    ],
    2: [
      { itemId: "wood_plank", count: 12 },
      { itemId: "iron_ingot", count: 5 },
    ],
    3: [
      { itemId: "iron_ingot", count: 8 },
      { itemId: "leather", count: 5 },
      { itemId: "reinforced_plank", count: 2 },
    ],
    4: [
      { itemId: "silver_ingot", count: 4 },
      { itemId: "reinforced_plank", count: 4 },
      { itemId: "leather", count: 8 },
    ],
    5: [
      { itemId: "dark_ingot", count: 3 },
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "mana_stone", count: 5 },
    ],
  },
  lumberyard: {
    1: [{ itemId: "stone", count: 10 }],
    2: [
      { itemId: "stone", count: 15 },
      { itemId: "wood", count: 5 },
    ],
    3: [
      { itemId: "iron_ingot", count: 3 },
      { itemId: "wood_plank", count: 5 },
    ],
    4: [
      { itemId: "iron_ingot", count: 5 },
      { itemId: "reinforced_plank", count: 2 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 4 },
      { itemId: "dark_ingot", count: 1 },
    ],
  },
  quarry: {
    1: [{ itemId: "wood", count: 10 }],
    2: [
      { itemId: "wood", count: 15 },
      { itemId: "stone", count: 5 },
    ],
    3: [
      { itemId: "iron_ingot", count: 3 },
      { itemId: "wood_plank", count: 5 },
    ],
    4: [
      { itemId: "iron_ingot", count: 5 },
      { itemId: "silver_ingot", count: 2 },
    ],
    5: [
      { itemId: "dark_ingot", count: 1 },
      { itemId: "reinforced_plank", count: 3 },
    ],
  },
  training_ground: {
    1: [
      { itemId: "wood", count: 15 },
      { itemId: "stone", count: 10 },
    ],
    2: [
      { itemId: "wood", count: 20 },
      { itemId: "stone", count: 15 },
    ],
    3: [
      { itemId: "wood_plank", count: 10 },
      { itemId: "iron_ingot", count: 5 },
    ],
    4: [
      { itemId: "reinforced_plank", count: 3 },
      { itemId: "silver_ingot", count: 2 },
      { itemId: "iron_ingot", count: 5 },
    ],
    5: [
      { itemId: "reinforced_plank", count: 5 },
      { itemId: "dark_ingot", count: 2 },
      { itemId: "mana_stone", count: 3 },
    ],
  },
};

/**
 * 指定施設のターゲットレベルに必要なアップグレード素材を取得する。
 * スケジュールに存在しないレベル（例: maxLevel到達後）の場合は空配列を返す。
 */
export function getUpgradeMaterialsForLevel(
  facilityId: FacilityType,
  targetLevel: number,
): { itemId: string; count: number }[] {
  const schedule = FACILITY_UPGRADE_MATERIALS[facilityId];
  if (!schedule) return [];
  return schedule[targetLevel] ?? [];
}
