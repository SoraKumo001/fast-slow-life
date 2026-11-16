/**
 * Phase: Exploration
 */

import { buildDungeonMap, computeRevealedNodes } from "../../dungeonMap";
import { processExploration } from "../../exploration";
import type { GamePhaseAccumulator } from "../types";

export const explorationPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  const explRes = processExploration(acc.dungeons, acc.villagers, acc.currentTier);
  acc.dungeons = explRes.dungeons;
  acc.logsToAppend.push(...explRes.logs);

  // Phase 4a: 霧の解放。探索中の村人の現在深度 ±15m にあるノードと
  // その隣接ノードを解放する。
  const nextRevealed: Record<string, string[]> = { ...(acc.revealedNodes ?? {}) };
  for (const dungeon of acc.dungeons) {
    const depths = acc.villagers
      .filter(
        (v) =>
          v.status === "active" &&
          v.destinationAreaId === dungeon.id &&
          v.dungeonState,
      )
      .map((v) => v.dungeonState!.currentDepth);
    const map = buildDungeonMap(dungeon);
    nextRevealed[dungeon.id] = computeRevealedNodes(
      map,
      nextRevealed[dungeon.id] ?? [],
      depths,
    );
  }
  acc.revealedNodes = nextRevealed;

  return acc;
};
