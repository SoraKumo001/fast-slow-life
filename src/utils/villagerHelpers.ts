import { MAX_POTIONS_PER_VILLAGER } from "../constants";

export function assignPotions(inventory: Record<string, number>): {
  assignedCount: number;
  updatedInventory: Record<string, number>;
} {
  const availablePotions = inventory.potion || 0;
  if (availablePotions <= 0) {
    return { assignedCount: 0, updatedInventory: { ...inventory } };
  }
  const assignedCount = Math.min(MAX_POTIONS_PER_VILLAGER, availablePotions);
  return {
    assignedCount,
    updatedInventory: {
      ...inventory,
      potion: availablePotions - assignedCount,
    },
  };
}

export function returnPotions(
  potionCount: number,
  inventory: Record<string, number>,
): { updatedInventory: Record<string, number> } {
  if (potionCount <= 0) {
    return { updatedInventory: { ...inventory } };
  }
  return {
    updatedInventory: {
      ...inventory,
      potion: (inventory.potion || 0) + potionCount,
    },
  };
}
