/**
* Phase: Economy (Caravans, Town Unlock, Auto Trade, Pool Purchase, Salary Check)
*
* 経済v2 (Phase 3):
* - 日境界で市場価格を再計算する
* - 日境界で前日分の内部フローを精算し、lastSettlement とログに残す
*/

import { processAutoTrade} from "../../autoTradeHelper";
import { processCaravanProgress, unlockTownsByTier} from "../../caravanProgressHelper";
import { getInitialDailyFlows} from "../../initialState";
import { computeAllMarketPrices} from "../../market";
import { processItemPoolPurchase} from "../../poolPurchase";
import type { GamePhaseAccumulator} from "../types";

export const economyPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
if (acc.gameOver) return acc;

if (!acc.dailyFlows) acc.dailyFlows = getInitialDailyFlows();
if (!acc.marketPrices) acc.marketPrices = {};
if (!acc.pricePolicy) acc.pricePolicy = "standard";

// ---- Day boundary: recompute market prices for the new day ----
if (acc.isNewDay) {
acc.marketPrices = computeAllMarketPrices(
acc.inventory,
acc.facilities.market?.level?? 0,
acc.pricePolicy,
);
}

// ---- Caravan Progress ----
const goldBeforeCaravan = acc.gold;
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
if (c.status!== "returned" ||!c.isAuto) return c;
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

// キャラバンの日次ネットは、キャラバン個別の収支を直接集計する代わりに、
// economy フェーズ内のキャラバン関連処理（進行＋自動交易）の前後の gold 差分で近似する。
acc.dailyFlows.caravanNet += acc.gold - goldBeforeCaravan;

// ---- Pool Purchase (市場価格・予算制限) ----
const poolRes = processItemPoolPurchase(
acc.gold,
acc.inventory,
acc.villagers,
acc.nextStats,
acc.marketPrices,
);
acc.gold = poolRes.gold;
acc.inventory = poolRes.inventory;
acc.villagers = poolRes.villagers;
acc.logsToAppend.push(...poolRes.logs);
acc.dailyFlows.poolPurchase += poolRes.totalSpent;

// 金庫不足で買い残しが発生した場合は要約ログを1日1回まで出す
if (poolRes.hasFundShortageLeftover &&!acc.dailyFlows.poolShortageLogged) {
acc.logsToAppend.push({
message: "金庫不足のため、仮置き場の一部アイテムを買取できませんでした。",
type: "warning",
});
acc.dailyFlows.poolShortageLogged = true;
}

// ---- Day boundary: settlement for the day that just ended ----
if (acc.isNewDay) {
const flows = acc.dailyFlows;
const settledDay = acc.currentDay - 1;
acc.lastSettlement = {
day: settledDay,
poolPurchase: flows.poolPurchase,
foodIncome: flows.foodIncome,
craftWages: flows.craftWages,
caravanNet: flows.caravanNet,
};
const caravanSign = flows.caravanNet >= 0? "+": "-";
acc.logsToAppend.push({
message: `${settledDay}日目: 買取 -${flows.poolPurchase} G / 食料代 +${flows.foodIncome} G / 賃金 -${flows.craftWages} G / キャラバン ${caravanSign}${Math.abs(Math.round(flows.caravanNet))} G`,
type: "info",
});
acc.dailyFlows = getInitialDailyFlows();
}

// ---- Update unpaid salary flag ----
acc.isSalaryUnpaid = acc.villagers.some((v) => v.gold < 0);

return acc;
};
