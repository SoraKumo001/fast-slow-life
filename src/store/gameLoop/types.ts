import type { RunStats, TradeRule } from "../../types/game";
import type { AdvanceHourResult } from "../gameLoopTypes";

/** Each pipeline phase receives the accumulator, modifies it, and returns it. */
export type GamePhase = (acc: GamePhaseAccumulator) => GamePhaseAccumulator;

/** Internal accumulator carrying all state across phases. */
export interface GamePhaseAccumulator extends AdvanceHourResult {
  isNewDay: boolean;
  nextStats: RunStats;
  hasStarvation: boolean;
  /** State fields accessed by phases but not part of AdvanceHourResult. */
  soulUpgrades: Record<string, number>;
  targetAmounts: Record<string, number>;
  tradeRules: TradeRule[];
}

/** Create an accumulator from the initial state snapshot. */
export function createAccumulator(
  result: AdvanceHourResult,
  isNewDay: boolean,
  nextStats: RunStats,
  soulUpgrades: Record<string, number>,
  targetAmounts: Record<string, number>,
  tradeRules: TradeRule[],
): GamePhaseAccumulator {
  return {
    ...result,
    isNewDay,
    nextStats,
    hasStarvation: false,
    soulUpgrades,
    targetAmounts,
    tradeRules,
  };
}
