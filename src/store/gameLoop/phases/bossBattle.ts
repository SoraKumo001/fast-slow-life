/**
 * Phase: Boss Battle
 */

import { processBossBattle } from "../../bossBattle";
import type { GamePhaseAccumulator } from "../types";

export const bossBattlePhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  const bossRes = processBossBattle(
    acc.activeBoss,
    acc.villagers,
    acc.dungeons,
    acc.currentTier,
    acc.bossDefeated,
    acc.gameLimitDays,
    acc.hasStarvation,
    acc.soulUpgrades,
    acc.isSalaryUnpaid,
    acc.nextStats,
  );
  acc.activeBoss = bossRes.activeBoss;
  acc.villagers = bossRes.villagers;
  acc.bossDefeated = bossRes.bossDefeated;
  acc.currentTier = bossRes.currentTier;
  acc.gameLimitDays = bossRes.gameLimitDays;
  acc.logsToAppend.push(...bossRes.logs);

  // Boss clear → game over (victory)
  if (bossRes.gameOver) {
    acc.gameOver = true;
    acc.gameOverReason = "クリア";
    acc.isPaused = true;
  }

  return acc;
};
