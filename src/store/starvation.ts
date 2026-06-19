import { FOOD_CONSUMPTION_PER_VILLAGER } from "../constants";

export function processStarvation(inventory: Record<string, number>, villagersCount: number) {
  const foodConsumed = villagersCount * FOOD_CONSUMPTION_PER_VILLAGER;
  let hasStarvation = false;
  let currentFood = inventory.food || 0;
  if (currentFood < foodConsumed) {
    currentFood = 0;
    hasStarvation = true;
  } else {
    currentFood -= foodConsumed;
  }
  return { inventory: { ...inventory, food: currentFood }, hasStarvation };
}
