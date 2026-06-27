/**
 * Phase: Threat — ダンジョン脅威度の進行とゲームオーバー判定
 */

import { updateAllThreatLevels } from "../../threatLogic";
import type { GamePhaseAccumulator } from "../types";

export const threatPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  // 1. 全未攻略ダンジョンの脅威度を更新
  const threatResult = updateAllThreatLevels(
    acc.dungeons,
    acc.currentTier,
    acc.bossDefeated,
    acc.currentDay,
    acc.currentHour,
    acc.tierStartDay,
  );
  acc.dungeons = threatResult.dungeons;
  acc.logsToAppend.push(...threatResult.logs);

  // 2. 最大到達脅威度を追跡
  if (threatResult.maxThreatReached > acc.maxThreatLevelReached) {
    acc.maxThreatLevelReached = threatResult.maxThreatReached;
  }

  // 3. 脅威度 100% 到達 → 即ゲームオーバー
  if (threatResult.gameOver) {
    acc.gameOver = true;
    acc.gameOverReason = threatResult.gameOverReason ?? "脅威度";
    acc.isPaused = true;
  }

  return acc;
};
