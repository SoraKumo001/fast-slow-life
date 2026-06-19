import { CRAFTER_TIME_REDUCTION } from "../constants";
import { Villager } from "../types/game";
import { CraftRecipe } from "../types/game";

export function generateCraftJobId(): string {
  return Math.random().toString(36).substring(2);
}

export function calculateCraftTime(
  recipe: CraftRecipe,
  assignedVillager: Villager | undefined,
): number {
  const baseTime = recipe.requiredTime;
  const isCrafter = assignedVillager?.currentJob === "職人";
  return isCrafter ? Math.max(1, Math.floor(baseTime * CRAFTER_TIME_REDUCTION)) : baseTime;
}

export function findAvailableCrafter(villagers: Villager[]): string | null {
  const idleCrafter = villagers.find((v) => v.status === "idle" && v.currentJob === "職人");
  const idleAny = villagers.find((v) => v.status === "idle");
  return (idleCrafter || idleAny)?.id || null;
}
