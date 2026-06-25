/**
 * Detects boss defeat by watching tier progression and triggers the announcement banner.
 * This replaces the direct UI store call previously embedded in timeActions.ts.
 */
import { useEffect, useRef } from "react";

import { MONSTERS } from "../data/masterData";
import { useGameStore } from "../store/gameStore";
import { useBossDefeatStore } from "./useBossDefeatStore";

export function useBossDefeatDetector(): void {
  const currentTier = useGameStore((s) => s.currentTier);
  const activeBoss = useGameStore((s) => s.activeBoss);
  const gameLimitDays = useGameStore((s) => s.gameLimitDays);
  const prevTierRef = useRef(currentTier);

  useEffect(() => {
    if (currentTier > prevTierRef.current && activeBoss) {
      const monster = MONSTERS[activeBoss.monsterId];
      useBossDefeatStore.getState().announce({
        bossName: monster?.name || activeBoss.monsterId,
        tier: currentTier,
        gameLimitDays,
      });
    }
    prevTierRef.current = currentTier;
  }, [currentTier, activeBoss, gameLimitDays]);
}
