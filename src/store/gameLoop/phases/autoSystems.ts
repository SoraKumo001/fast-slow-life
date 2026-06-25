/**
 * Phase: Auto Systems (Auto Craft + Auto Training)
 */

import { processAutoCraft } from "../../crafting";
import { processAutoTraining } from "../../trainingLogic";
import type { GamePhaseAccumulator } from "../types";

export const autoSystemsPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  // ---- Auto Craft ----
  const autoRes = processAutoCraft(acc.facilities, acc.villagers, acc.inventory, acc.targetAmounts);
  acc.facilities = autoRes.facilities;
  acc.villagers = autoRes.villagers;
  acc.inventory = { ...acc.inventory, ...autoRes.inventory };
  acc.logsToAppend.push(...autoRes.logs);

  // ---- Auto Training ----
  const trainingRes = processAutoTraining(acc.facilities, acc.villagers, acc.currentDay);
  acc.facilities = trainingRes.facilities;
  acc.villagers = trainingRes.villagers;
  acc.logsToAppend.push(...trainingRes.logs);

  return acc;
};
