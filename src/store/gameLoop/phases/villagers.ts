/**
 * Phase: Villager Activities (Scheduler + Dispatch + Core Activities)
 */

import { SCHEDULER_INTERVAL_HOURS } from "../../schedulerConfig";
import { processVillagerActivities } from "../../villagerAI";
import { runVillagerScheduler } from "../../villagerScheduler";
import type { GamePhaseAccumulator } from "../types";

export const villagersPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  // ---- Scheduler (periodic target reassignment) ----
  const cumulativeTick = acc.currentDay * 24 + acc.currentHour;
  if (cumulativeTick - acc.lastSchedulerTick >= SCHEDULER_INTERVAL_HOURS) {
    const schedRes = runVillagerScheduler({
      villagers: acc.villagers,
      dungeons: acc.dungeons,
      inventory: acc.inventory,
      targetAmounts: acc.targetAmounts,
    });
    acc.villagers = schedRes.villagers;
    acc.logsToAppend.push(...schedRes.logs);
    acc.lastSchedulerTick = cumulativeTick;
  }

  // ---- Villager Activities ----
  const actRes = processVillagerActivities(
    acc.villagers,
    acc.dungeons,
    acc.facilities,
    acc.inventory,
    acc.targetAmounts,
    acc.activeBoss,
    acc.bossDefeated,
    acc.hasStarvation,
    acc.soulUpgrades,
    acc.gold,
    acc.isSalaryUnpaid,
    acc.nextStats,
  );
  acc.villagers = actRes.villagers;
  acc.inventory = { ...acc.inventory, ...actRes.inventory };
  acc.dungeons = actRes.dungeons;
  acc.gold = actRes.gold;
  acc.logsToAppend.push(...actRes.logs);

  return acc;
};
