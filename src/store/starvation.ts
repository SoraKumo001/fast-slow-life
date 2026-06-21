import { FOOD_CONSUMPTION_PER_VILLAGER } from "../constants";

const FOOD_PRIORITY = [
  "food_dragon_hotpot",
  "food_beast_roast",
  "food_stamina_stew",
  "food_sandwich",
  "food_dried_meat",
  "food_herb_salad",
  "food",
];

export function processStarvation(inventory: Record<string, number>, villagersCount: number) {
  const foodConsumed = villagersCount * FOOD_CONSUMPTION_PER_VILLAGER;
  let hasStarvation = false;
  let activeFoodBuffId: string | null = null;
  const nextInventory = { ...inventory };

  // 優先度順に、人数分きっちり足りる食料を探す
  let consumedId = "";
  for (const foodId of FOOD_PRIORITY) {
    const count = nextInventory[foodId] || 0;
    if (count >= foodConsumed) {
      consumedId = foodId;
      break;
    }
  }

  if (consumedId) {
    // 上位または通常食料が人数分あった場合
    nextInventory[consumedId] -= foodConsumed;
    if (consumedId !== "food") {
      activeFoodBuffId = consumedId;
    }
  } else {
    // どの食料も人数分足りなかった場合：通常の 'food' を可能な限り消費して飢餓状態へ
    const currentFood = nextInventory.food || 0;
    if (currentFood < foodConsumed) {
      nextInventory.food = 0;
      hasStarvation = true;
    } else {
      nextInventory.food = currentFood - foodConsumed;
    }
  }

  return { inventory: nextInventory, hasStarvation, activeFoodBuffId };
}
