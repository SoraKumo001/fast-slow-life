import { CRAFTER_TIME_REDUCTION, CRAFT_DEX_FACTOR } from "../constants";
import { Villager } from "../types/game";

export function generateId(): string {
  return Math.random().toString(36).substring(2);
}

export function calculateCraftTime(
  baseTime: number,
  villager: Villager | null | undefined,
): number {
  if (!villager) return baseTime;
  const dexFactor = 1 - (villager.dex - 10) * CRAFT_DEX_FACTOR;
  const jobFactor = villager.currentJob === "職人" ? CRAFTER_TIME_REDUCTION : 1.0;
  return Math.max(1, Math.floor(baseTime * dexFactor * jobFactor));
}
