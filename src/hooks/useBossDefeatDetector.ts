/**
 * Detects boss battle results (victory / defeat) and triggers the announcement banner.
 * - victory: currentTier progressed (boss was slain)
 * - defeat:  activeBoss was cleared without tier progression (attackers wiped out)
 */
import { useEffect, useRef } from "react";

import { MONSTERS } from "../data/masterData";
import { useGameStore } from "../store/gameStore";
import { useBossDefeatStore } from "./useBossDefeatStore";

export function useBossDefeatDetector(): void {
  const currentTier = useGameStore((s) => s.currentTier);
  const activeBoss = useGameStore((s) => s.activeBoss);
  const prevTierRef = useRef(currentTier);
  const prevActiveBossRef = useRef(activeBoss);

  useEffect(() => {
    // 撃破検出: currentTier が進行 (= ボス撃破成功)
    if (currentTier > prevTierRef.current && prevActiveBossRef.current) {
      const monster = MONSTERS[prevActiveBossRef.current.monsterId];
      useBossDefeatStore.getState().announce({
        type: "victory",
        bossName: monster?.name || prevActiveBossRef.current.monsterId,
        tier: currentTier,
      });
    }
    // 全滅検出: activeBoss が消え、tier は不変 (= 撃破ではない)
    else if (!activeBoss && prevActiveBossRef.current && currentTier === prevTierRef.current) {
      const monster = MONSTERS[prevActiveBossRef.current.monsterId];
      useBossDefeatStore.getState().announce({
        type: "defeat",
        bossName: monster?.name || prevActiveBossRef.current.monsterId,
        tier: currentTier,
      });
    }
    prevTierRef.current = currentTier;
    prevActiveBossRef.current = activeBoss;
  }, [currentTier, activeBoss]);
}
