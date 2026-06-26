import { FOOD_CONSUMPTION_PER_VILLAGER } from "../constants";
import { ITEMS } from "../data/masterData";
import { Villager } from "../types/game";

export function processStarvation(
  inventory: Record<string, number>,
  villagers: Villager[] | number,
) {
  const nextInventory = { ...inventory };
  const logs: string[] = [];

  const rawIngredients = ["raw_meat", "vegetable", "wheat"];

  if (typeof villagers === "number") {
    // 従来の簡易的な一律処理（シミュレータ等のため）
    const villagersCount = villagers;
    const foodConsumed = villagersCount * FOOD_CONSUMPTION_PER_VILLAGER;
    let hasStarvation = false;
    let activeFoodBuffId: string | null = null;

    const foodPriority = [
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

    let consumedId = "";
    for (const foodId of foodPriority) {
      const count = nextInventory[foodId] || 0;
      if (count >= foodConsumed) {
        consumedId = foodId;
        break;
      }
    }

    if (consumedId) {
      nextInventory[consumedId] -= foodConsumed;
      if (!rawIngredients.includes(consumedId)) {
        activeFoodBuffId = consumedId;
      }
    } else {
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

    // Clamp negative values to 0 (preserve fractional values for precision)
    Object.keys(nextInventory).forEach((key) => {
      if (nextInventory[key] < 0) nextInventory[key] = 0;
    });

    return {
      inventory: nextInventory,
      villagers: villagers,
      hasStarvation,
      activeFoodBuffId,
      logs,
    };
  }

  // villagers が Villager[] の場合の個別処理
  const updatedVillagers = villagers.map((v) => {
    const isPoor = v.currentJob !== "無職" && v.gold < 200;
    const foodPriority = isPoor
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

    let consumedId: string | null = null;
    for (const foodId of foodPriority) {
      const count = nextInventory[foodId] || 0;
      if (count >= FOOD_CONSUMPTION_PER_VILLAGER) {
        const item = ITEMS[foodId];
        const price = item?.basePrice || (rawIngredients.includes(foodId) ? 2 : 1);

        // 価格が 3G 以下の食料（パン、生の食材など）や無職の村人は所持金に関係なく消費可能。
        // それ以外は所持金が価格以上である場合のみ消費可能。
        const canAfford = price <= 3 || v.gold >= price;

        if (canAfford) {
          consumedId = foodId;
          break;
        }
      }
    }

    const nextV = { ...v };

    if (consumedId) {
      nextInventory[consumedId] -= FOOD_CONSUMPTION_PER_VILLAGER;
      if (rawIngredients.includes(consumedId)) {
        nextV.activeFoodBuffId = null;
      } else {
        nextV.activeFoodBuffId = consumedId;
      }
      nextV.isStarving = false;
    } else {
      // 単一アイテムで足りない場合は、生の食材を組み合わせて消費する
      let needed = FOOD_CONSUMPTION_PER_VILLAGER;
      let consumedRawSuccess = false;
      for (const rawId of rawIngredients) {
        const available = nextInventory[rawId] || 0;
        if (available >= needed) {
          nextInventory[rawId] -= needed;
          needed = 0;
          consumedRawSuccess = true;
          break;
        } else {
          nextInventory[rawId] = 0;
          needed -= available;
        }
      }

      if (consumedRawSuccess && needed === 0) {
        nextV.activeFoodBuffId = null;
        nextV.isStarving = false;
      } else {
        nextV.activeFoodBuffId = null;
        nextV.isStarving = true;
      }
    }

    return nextV;
  });

  const starvedCount = updatedVillagers.filter((v) => v.isStarving).length;
  const hasStarvation = starvedCount > 0;
  if (starvedCount > 0) {
    logs.push(`【警告】食料が不足しており、${starvedCount}名の村人が飢餓状態になっています！`);
  }

  // Clamp negative values to 0 (preserve fractional values for precision)
  Object.keys(nextInventory).forEach((key) => {
    if (nextInventory[key] < 0) nextInventory[key] = 0;
  });

  return {
    inventory: nextInventory,
    villagers: updatedVillagers,
    hasStarvation,
    logs,
  };
}
