/**
 * Game Loop — new entry point replacing gameLoopHelper.ts.
 *
 * The old `calculateAdvanceHour` God function is decomposed into a pipeline
 * of focused phase functions, each handling one subsystem.
 */
import type { GameState } from "../../types/game";
import type { AdvanceHourResult, LogPayload } from "../gameLoopTypes";
import { isBankrupt, buildGameOverLog } from "../gameOverHelper";
import { getInitialStats } from "../initialState";
import { autoSystemsPhase } from "./phases/autoSystems";
import { bossBattlePhase } from "./phases/bossBattle";
import { economyPhase } from "./phases/economy";
import { explorationPhase } from "./phases/exploration";
import { productionPhase } from "./phases/production";
import { survivalPhase } from "./phases/survival";
import { threatPhase } from "./phases/threatPhase";
import { villagersPhase } from "./phases/villagers";
import { runPipeline } from "./pipeline";
import { createAccumulator, type GamePhaseAccumulator } from "./types";

// Re-export for backward compatibility
export type { AdvanceHourResult, LogPayload } from "../gameLoopTypes";
export { processRespawns } from "../respawns";
export { processStarvation } from "../starvation";
export { processExploration } from "../exploration";
export { processCraftingAndUpgrades, processAutoCraft } from "../crafting";
export { processAutoTraining } from "../trainingLogic";
export { processBossBattle } from "../bossBattle";
export { processVillagerActivities } from "../villagerAI";

/** The ordered pipeline of game phases executed each hour. */
const PHASES = [
  survivalPhase,
  threatPhase,
  explorationPhase,
  productionPhase,
  bossBattlePhase,
  villagersPhase,
  autoSystemsPhase,
  economyPhase,
];

/**
 * Advance the game by one hour.
 * Replaces the old monolithic `calculateAdvanceHour` from gameLoopHelper.ts.
 */
export function calculateAdvanceHour(state: GameState): AdvanceHourResult {
  let {
    currentDay,
    currentHour,
    gold,
    villagers,
    facilities,
    dungeons,
    inventory,
    currentTier,
    activeBoss,
    bossDefeated,
    gameOver,
    isPaused,
    targetAmounts,
    soulUpgrades,
    towns,
    caravans,
    isSalaryUnpaid,
    consecutiveNegativeGoldDays,
    lastSchedulerTick,
    stats,
  } = state;

  const nextStats = stats ? { ...stats } : getInitialStats();
  const logsToAppend: LogPayload[] = [];

  // ---- Time advancement ----
  currentHour += 1;
  let isNewDay = false;
  if (currentHour >= 24) {
    currentHour = 0;
    currentDay += 1;
    isNewDay = true;
  }

  let isSalaryUnpaidNext = isSalaryUnpaid;
  let consecutiveNegativeGoldDaysNext = consecutiveNegativeGoldDays ?? 0;

  // ---- Daily bankruptcy check ----
  if (isNewDay) {
    if (gold < 0) {
      consecutiveNegativeGoldDaysNext += 1;
      const daysUntilBankrupt = 3 - consecutiveNegativeGoldDaysNext;
      logsToAppend.push({
        message: `【経済警告】プレイヤーの所持金がマイナスになっています（連続 ${consecutiveNegativeGoldDaysNext} 日目、破産まであと ${daysUntilBankrupt} 日）。`,
        type: "warning",
      });
    } else {
      consecutiveNegativeGoldDaysNext = 0;
    }
  }

  // ---- Extract threat state from GameState ----
  const { maxThreatLevelReached: initialMaxThreat = 0, tierStartDay: initialTierStartDay = 1 } =
    state;

  // ---- Immediate game-over checks (must run BEFORE the pipeline) ----

  if (isBankrupt(consecutiveNegativeGoldDaysNext)) {
    logsToAppend.push(buildGameOverLog("破産"));
    return {
      currentDay,
      currentHour,
      gold,
      villagers,
      facilities,
      dungeons,
      inventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameOver: true,
      gameOverReason: "破産",
      isPaused: true,
      logsToAppend,
      towns,
      caravans,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      lastSchedulerTick,
      maxThreatLevelReached: initialMaxThreat,
      tierStartDay: initialTierStartDay,
      stats: nextStats,
    };
  }

  // ---- Build accumulator and run pipeline ----
  const acc: GamePhaseAccumulator = createAccumulator(
    {
      currentDay,
      currentHour,
      gold,
      villagers,
      facilities,
      dungeons,
      inventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameOver,
      gameOverReason: state.gameOverReason,
      isPaused,
      logsToAppend,
      towns,
      caravans,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      lastSchedulerTick,
      maxThreatLevelReached: initialMaxThreat,
      tierStartDay: initialTierStartDay,
      stats: nextStats,
    },
    isNewDay,
    nextStats,
    soulUpgrades ?? {},
    targetAmounts ?? {},
    state.tradeRules ?? [],
  );

  const { result } = runPipeline(acc, PHASES);
  return result;
}
