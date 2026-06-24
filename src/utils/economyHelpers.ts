import { ITEMS } from "../data/masterData";
import type { CraftRecipe, Town } from "../types/game";
import { getMarketSellBonus } from "./marketHelpers";

export function getEffectiveExportPrice(itemId: string, _town: Town, marketLvl: number): number {
  // _town kept for API compatibility
  const item = ITEMS[itemId];
  if (!item) return 0;

  const marketBonus = getMarketSellBonus(marketLvl);
  const price = Math.floor(item.basePrice * (1 + marketBonus));

  return price;
}

export function getBestExportPrice(
  itemId: string,
  towns: Town[],
  marketLvl: number,
): { price: number; townName: string } {
  let bestPrice = 0;
  let bestTownName = "";

  for (const town of towns) {
    if (!town.isUnlocked) continue;
    const price = getEffectiveExportPrice(itemId, town, marketLvl);
    if (price > bestPrice) {
      bestPrice = price;
      bestTownName = town.name;
    }
  }

  return { price: bestPrice, townName: bestTownName };
}

export function getResourceFacilityGValue(
  facilityId: string,
  lvl: number,
): {
  label: string;
  gValue: number;
} {
  if (lvl <= 0) return { label: "なし", gValue: 0 };

  if (facilityId === "farm") {
    const wheat = Math.floor((1 + lvl) / 2);
    const vegetable = Math.floor(lvl / 2);
    const rawMeat = Math.floor((lvl - 1) / 2);
    const value = wheat * 1 + vegetable * 1 + rawMeat * 2;
    const parts: string[] = [];
    if (wheat > 0) parts.push(`小麦+${wheat}`);
    if (vegetable > 0) parts.push(`野菜+${vegetable}`);
    if (rawMeat > 0) parts.push(`生肉+${rawMeat}`);
    return { label: parts.join("、"), gValue: value };
  }

  if (facilityId === "lumberyard") {
    const wood = lvl;
    let value = wood * 1;
    const parts: string[] = [`原木+${wood}`];
    if (lvl >= 3) {
      const plankProb = Math.round((lvl - 2) * 30);
      parts.push(`木板(確率:${plankProb}%)`);
      value += Math.round(wood * (lvl - 2) * 0.3) * 5;
    }
    return { label: parts.join("、"), gValue: value };
  }

  if (facilityId === "quarry") {
    const stone = lvl;
    let value = stone * 1;
    const parts: string[] = [`石材+${stone}`];
    if (lvl >= 3) {
      const ironProb = Math.round((lvl - 2) * 30);
      parts.push(`鉄鉱石(確率:${ironProb}%)`);
      value += Math.round(stone * (lvl - 2) * 0.3) * 2;
    }
    if (lvl >= 5) {
      parts.push("銀鉱石(確率:25%)");
      value += Math.round(stone * 0.25) * 4;
    }
    return { label: parts.join("、"), gValue: value };
  }

  return { label: "なし", gValue: 0 };
}

const FOOD_IDS = new Set([
  "food_dragon_hotpot",
  "food_beast_roast",
  "food_stamina_stew",
  "food_sandwich",
  "food_dried_meat",
  "food_herb_salad",
  "food_bread",
]);

const RAW_FOOD_IDS = new Set(["wheat", "vegetable", "raw_meat"]);

export function getDailyFoodConsumption(villagerCount: number): number {
  return villagerCount;
}

export function getTotalFoodStock(inventory: Record<string, number>): number {
  let total = 0;
  for (const id of FOOD_IDS) total += inventory[id] || 0;
  for (const id of RAW_FOOD_IDS) total += inventory[id] || 0;
  return total;
}

export function getFoodDaysRemaining(
  inventory: Record<string, number>,
  villagerCount: number,
): number {
  const totalFood = getTotalFoodStock(inventory);
  const daily = getDailyFoodConsumption(villagerCount);
  if (daily <= 0) return 999;
  return Math.floor(totalFood / daily);
}

export function getRecipeValueInfo(recipe: CraftRecipe): {
  materialCost: number;
  resultPrice: number;
  valueAdd: number;
  valuePerHour: number;
} {
  let materialCost = 0;
  for (const req of recipe.requiredItems) {
    const item = ITEMS[req.itemId];
    if (item) materialCost += item.basePrice * req.count;
  }
  const resultItem = ITEMS[recipe.resultItemId];
  const resultPrice = resultItem?.basePrice || 0;
  const valueAdd = resultPrice - materialCost;
  const valuePerHour = recipe.requiredTime > 0 ? Math.floor(valueAdd / recipe.requiredTime) : 0;
  return { materialCost, resultPrice, valueAdd, valuePerHour };
}
