/**
 * Phase: Production (Crafting + Upgrades + Resource Facilities)
 */

import { processCraftingAndUpgrades } from "../../crafting";
import { processResourceFacilities } from "../../resourceFacilitiesHelper";
import type { GamePhaseAccumulator } from "../types";

export const productionPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  // ---- Crafting & Upgrades ----
  const craftRes = processCraftingAndUpgrades(
    acc.facilities,
    acc.villagers,
    acc.inventory,
    acc.soulUpgrades,
    acc.gold,
    acc.currentDay,
    acc.nextStats,
  );
  acc.facilities = craftRes.facilities;
  acc.villagers = craftRes.villagers;
  acc.inventory = { ...acc.inventory, ...craftRes.inventory };
  acc.gold = craftRes.gold;
  acc.logsToAppend.push(...craftRes.logs);

  // ---- Resource Facilities (every 12 hours) ----
  if (acc.currentHour % 12 === 0) {
    const prodResult = processResourceFacilities(acc.facilities, acc.inventory);
    acc.inventory = prodResult.inventory;
    acc.logsToAppend.push(...prodResult.logs);
  }

  return acc;
};
