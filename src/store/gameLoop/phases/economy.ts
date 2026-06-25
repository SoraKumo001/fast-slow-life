/**
 * Phase: Economy (Caravans, Town Unlock, Auto Trade, Pool Purchase, Salary Check)
 */

import { processAutoTrade } from "../../autoTradeHelper";
import { processCaravanProgress, unlockTownsByTier } from "../../caravanProgressHelper";
import { processItemPoolPurchase } from "../../poolPurchase";
import type { GamePhaseAccumulator } from "../types";

export const economyPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  if (acc.gameOver) return acc;

  // ---- Caravan Progress ----
  const caravanRes = processCaravanProgress(
    acc.caravans,
    acc.towns,
    acc.gold,
    acc.inventory,
    acc.nextStats,
  );
  acc.caravans = caravanRes.caravans;
  acc.towns = caravanRes.towns;
  acc.gold = caravanRes.gold;
  acc.inventory = caravanRes.inventory;
  acc.logsToAppend.push(...caravanRes.logs);

  // ---- Auto Caravan Reset ----
  acc.caravans = acc.caravans.map((c) => {
    if (c.status !== "returned" || !c.isAuto) return c;
    return {
      ...c,
      status: "idle" as const,
      destinationTownId: null,
      type: null,
      timeLeft: 0,
      totalTime: 0,
      cargo: [],
      goldCost: 0,
      goldEarned: 0,
    };
  });

  // ---- Town Unlock by Tier ----
  const unlockRes = unlockTownsByTier(acc.towns, acc.currentTier);
  acc.towns = unlockRes.towns;
  acc.logsToAppend.push(...unlockRes.logs);

  // ---- Auto Trade ----
  const tradeRes = processAutoTrade({
    facilities: acc.facilities,
    tradeRules: acc.tradeRules,
    inventory: acc.inventory,
    gold: acc.gold,
    caravans: acc.caravans,
    towns: acc.towns,
  });
  acc.gold = tradeRes.gold;
  acc.inventory = tradeRes.inventory;
  acc.caravans = tradeRes.caravans;
  acc.logsToAppend.push(...tradeRes.logs);

  // ---- Pool Purchase ----
  const poolRes = processItemPoolPurchase(acc.gold, acc.inventory, acc.villagers, acc.nextStats);
  acc.gold = poolRes.gold;
  acc.inventory = poolRes.inventory;
  acc.villagers = poolRes.villagers;
  acc.logsToAppend.push(...poolRes.logs);

  // ---- Update unpaid salary flag ----
  acc.isSalaryUnpaid = acc.villagers.some((v) => v.gold < 0);

  return acc;
};
