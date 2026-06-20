import { Item, CraftRecipe, FacilityType } from "../types/game";
// 各データモジュールのインポート
import { ITEMS } from "./items";
import { RECIPES } from "./recipes";

// データモジュールの再エクスポート
export { ITEMS } from "./items";
export { RECIPES } from "./recipes";
export { MONSTERS } from "./monsters";
export { DUNGEONS } from "./dungeons";
export { SOUL_UPGRADES } from "./soulUpgrades";
export { JOBS } from "./jobs";
export { VILLAGER_NAMES } from "./villagerNames";

// ==========================================
// 2. マスタデータ取得用ヘルパー関数
// ==========================================

export const getRecipeForItem = (itemId: string): CraftRecipe | undefined =>
  Object.values(RECIPES).find((recipe) => recipe.resultItemId === itemId);

export const getRecipesForFacility = (
  facilityId: FacilityType,
  facilityLevel: number,
): CraftRecipe[] =>
  Object.values(RECIPES).filter(
    (recipe) => recipe.facilityId === facilityId && facilityLevel >= recipe.requiredFacilityLevel,
  );

export const getCraftableItemsForFacility = (
  facilityId: FacilityType,
  facilityLevel: number,
): Item[] =>
  getRecipesForFacility(facilityId, facilityLevel)
    .map((recipe) => ITEMS[recipe.resultItemId])
    .filter((item): item is Item => Boolean(item));
