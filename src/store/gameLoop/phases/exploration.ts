/**
 * Phase: Exploration
 */

import { processExploration } from "../../exploration";
import type { GamePhaseAccumulator } from "../types";

export const explorationPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  const explRes = processExploration(acc.dungeons, acc.villagers, acc.currentTier);
  acc.dungeons = explRes.dungeons;
  acc.logsToAppend.push(...explRes.logs);

  return acc;
};
