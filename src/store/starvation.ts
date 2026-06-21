import { FOOD_CONSUMPTION_PER_VILLAGER } from "../constants";
import { Villager } from "../types/game";

export function processStarvation(
  inventory: Record<string, number>,
  villagers: Villager[] | number,
) {
  const villagersCount = typeof villagers === "number" ? villagers : villagers.length;
  const foodConsumed = villagersCount * FOOD_CONSUMPTION_PER_VILLAGER;
  let hasStarvation = false;
  let activeFoodBuffId: string | null = null;
  const nextInventory = { ...inventory };

  // 有職の村人の中で所持金が20G未満、もしくはツケがある人がいるかチェック
  const hasPoorVillager =
    typeof villagers === "number"
      ? false
      : villagers.some((v) => v.currentJob !== "無職" && v.gold < 20);

  // 所持金に余裕がない村人がいる場合は、価格の安い食べ物を優先する
  const foodPriority = hasPoorVillager
    ? [
        "wheat",
        "vegetable",
        "raw_meat",
        "food_bread",
        "food_dried_meat",
        "food_herb_salad",
        "food_sandwich",
        "food_stamina_stew",
        "food_beast_roast",
        "food_dragon_hotpot",
      ]
    : [
        "food_dragon_hotpot",
        "food_beast_roast",
        "food_stamina_stew",
        "food_sandwich",
        "food_dried_meat",
        "food_herb_salad",
        "food_bread",
        "raw_meat",
        "vegetable",
        "wheat",
      ];

  // 1. まず人数分足りるアイテムを優先度順に探す（料理および生の食材）
  let consumedId = "";
  for (const foodId of foodPriority) {
    const count = nextInventory[foodId] || 0;
    if (count >= foodConsumed) {
      consumedId = foodId;
      break;
    }
  }

  const rawIngredients = ["raw_meat", "vegetable", "wheat"];

  if (consumedId) {
    nextInventory[consumedId] -= foodConsumed;
    if (!rawIngredients.includes(consumedId)) {
      activeFoodBuffId = consumedId;
    }
  } else {
    // 2. どの単一アイテムも人数分足りなかった場合、生の食材を組み合わせて消費する
    let needed = foodConsumed;
    for (const rawId of rawIngredients) {
      const available = nextInventory[rawId] || 0;
      if (available >= needed) {
        nextInventory[rawId] -= needed;
        needed = 0;
        break;
      } else {
        nextInventory[rawId] = 0;
        needed -= available;
      }
    }

    if (needed > 0) {
      hasStarvation = true;
    }
  }

  return { inventory: nextInventory, hasStarvation, activeFoodBuffId };
}
