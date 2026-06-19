import { GameState } from "../types/game";
import { processBossBattle } from "./bossBattle";
import { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
import { processExploration } from "./exploration";
import { AdvanceHourResult } from "./gameLoopTypes";
import { processRespawns } from "./respawns";
import { processStarvation } from "./starvation";
import { processVillagerActivities } from "./villagerAI";

export type { AdvanceHourResult, LogPayload } from "./gameLoopTypes";

export { processRespawns } from "./respawns";
export { processStarvation } from "./starvation";
export { processExploration } from "./exploration";
export { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
export { processBossBattle } from "./bossBattle";
export { processVillagerActivities } from "./villagerAI";

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
    gameLimitDays,
    gameOver,
    isPaused,
    targetAmounts,
    soulUpgrades,
  } = state;

  const logsToAppend: import("./gameLoopTypes").LogPayload[] = [];

  currentHour += 1;
  if (currentHour >= 24) {
    currentHour = 0;
    currentDay += 1;
  }

  if (currentDay > gameLimitDays && !bossDefeated) {
    logsToAppend.push({
      message: `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。ゲームオーバー！`,
      type: "error",
    });
    return {
      currentDay,
      currentHour,
      villagers,
      facilities,
      dungeons,
      inventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameLimitDays,
      gameOver: true,
      isPaused: true,
      logsToAppend,
    };
  }

  dungeons = processRespawns(dungeons);

  const { inventory: starvedInventory, hasStarvation } = processStarvation(
    inventory,
    villagers.length,
  );
  inventory = starvedInventory;

  const explRes = processExploration(dungeons, villagers, currentTier);
  dungeons = explRes.dungeons;
  logsToAppend.push(...explRes.logs);

  const craftRes = processCraftingAndUpgrades(facilities, villagers, inventory, soulUpgrades);
  facilities = craftRes.facilities;
  villagers = craftRes.villagers;
  Object.assign(inventory, craftRes.inventory);
  logsToAppend.push(...craftRes.logs);

  const bossRes = processBossBattle(
    activeBoss,
    villagers,
    dungeons,
    currentTier,
    bossDefeated,
    gameLimitDays,
    hasStarvation,
    soulUpgrades,
  );
  activeBoss = bossRes.activeBoss;
  villagers = bossRes.villagers;
  bossDefeated = bossRes.bossDefeated;
  currentTier = bossRes.currentTier;
  gameLimitDays = bossRes.gameLimitDays;
  logsToAppend.push(...bossRes.logs);

  const actRes = processVillagerActivities(
    villagers,
    dungeons,
    facilities,
    inventory,
    targetAmounts,
    activeBoss,
    bossDefeated,
    hasStarvation,
    soulUpgrades,
    gold,
  );
  villagers = actRes.villagers;
  Object.assign(inventory, actRes.inventory);
  dungeons = actRes.dungeons;
  logsToAppend.push(...actRes.logs);
  if (actRes.gameOver) {
    return {
      currentDay,
      currentHour,
      villagers,
      facilities,
      dungeons,
      inventory,
      currentTier,
      activeBoss,
      bossDefeated,
      gameLimitDays,
      gameOver: actRes.gameOver,
      isPaused: actRes.isPaused,
      logsToAppend,
    };
  }

  const autoRes = processAutoCraft(facilities, villagers, inventory, targetAmounts);
  facilities = autoRes.facilities;
  villagers = autoRes.villagers;
  Object.assign(inventory, autoRes.inventory);
  logsToAppend.push(...autoRes.logs);

  return {
    currentDay,
    currentHour,
    villagers,
    facilities,
    dungeons,
    inventory,
    currentTier,
    activeBoss,
    bossDefeated,
    gameLimitDays,
    gameOver,
    isPaused,
    logsToAppend,
  };
}
