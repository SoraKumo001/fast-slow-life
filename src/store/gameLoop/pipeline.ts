import type { AdvanceHourResult, LogPayload } from "../gameLoopTypes";
/**
 * Pipeline engine — chains GamePhase functions sequentially.
 * Each phase receives the accumulator, mutates it, and returns it.
 * Phases short-circuit when `gameOver` is set.
 */
import type { GamePhase, GamePhaseAccumulator } from "./types";

/** Run phases in order. Returns the final accumulator with public fields. */
export function runPipeline(
  acc: GamePhaseAccumulator,
  phases: GamePhase[],
): { result: AdvanceHourResult; logs: LogPayload[] } {
  for (const phase of phases) {
    if (acc.gameOver) break;
    acc = phase(acc);
  }

  const { isNewDay: _nd, nextStats: _ns, hasStarvation: _hs, ...result } = acc;
  return { result: result as AdvanceHourResult, logs: acc.logsToAppend };
}
