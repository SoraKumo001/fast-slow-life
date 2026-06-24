import { ITEMS } from "../data/masterData";
import { GameState, Villager, RunStats } from "../types/game";
import { processAutoTrade } from "./autoTradeHelper";
import { processBossBattle } from "./bossBattle";
import { processCaravanProgress, unlockTownsByTier } from "./caravanProgressHelper";
import { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
import { processExploration } from "./exploration";
import { AdvanceHourResult } from "./gameLoopTypes";
import { isBankrupt, isTimeOver, buildGameOverLog } from "./gameOverHelper";
import { getInitialStats } from "./initialState";
import { processItemPoolPurchase } from "./poolPurchase";
import { processResourceFacilities } from "./resourceFacilitiesHelper";
import { processRespawns } from "./respawns";
import { SCHEDULER_INTERVAL_HOURS } from "./schedulerConfig";
import { processStarvation } from "./starvation";
import { processAutoTraining } from "./trainingLogic";
import { processVillagerActivities } from "./villagerAI";
import { runVillagerScheduler } from "./villagerScheduler";

export type { AdvanceHourResult, LogPayload } from "./gameLoopTypes";

export { processRespawns } from "./respawns";
export { processStarvation } from "./starvation";
export { processExploration } from "./exploration";
export { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
export { processAutoTraining } from "./trainingLogic";
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
    towns,
    caravans,
    isSalaryUnpaid,
    consecutiveNegativeGoldDays,
    lastSchedulerTick,
    stats,
  } = state;

  const nextStats: RunStats = stats ? { ...stats } : getInitialStats();
  const logsToAppend: import("./gameLoopTypes").LogPayload[] = [];

  currentHour += 1;
  let isNewDay = false;
  if (currentHour >= 24) {
    currentHour = 0;
    currentDay += 1;
    isNewDay = true;
  }

  let isSalaryUnpaidNext = isSalaryUnpaid;
  let consecutiveNegativeGoldDaysNext = consecutiveNegativeGoldDays ?? 0;

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
      gameLimitDays,
      gameOver: true,
      gameOverReason: "破産",
      isPaused: true,
      logsToAppend,
      towns,
      caravans,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      lastSchedulerTick,
      stats: nextStats,
    };
  }

  if (isTimeOver(currentDay, gameLimitDays, bossDefeated)) {
    logsToAppend.push(buildGameOverLog("期限切れ", gameLimitDays));
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
      gameLimitDays,
      gameOver: true,
      gameOverReason: "期限切れ",
      isPaused: true,
      logsToAppend,
      towns,
      caravans,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      lastSchedulerTick,
      stats: nextStats,
    };
  }

  dungeons = processRespawns(dungeons);

  const {
    inventory: starvedInventory,
    villagers: starvedVillagers,
    hasStarvation,
    logs: starvationLogs,
  } = processStarvation(inventory, villagers);
  inventory = starvedInventory;
  villagers = starvedVillagers as Villager[];
  starvationLogs.forEach((msg) => {
    logsToAppend.push({ message: msg, type: "warning" });
  });

  if (isNewDay) {
    // 村人全員の食料代を請求
    let totalFoodCost = 0;
    villagers = villagers.map((v) => {
      let foodCost = 0;
      if (v.isStarving) {
        foodCost = 0;
      } else if (v.activeFoodBuffId) {
        foodCost = ITEMS[v.activeFoodBuffId]?.basePrice || 2;
      } else {
        foodCost = 2; // 生の食材の基本価格
      }

      const nextV = { ...v };
      nextV.gold -= foodCost;
      totalFoodCost += foodCost;
      return nextV;
    });

    gold += totalFoodCost;
    nextStats.totalGoldFromTax += totalFoodCost;
    logsToAppend.push({
      message: `【経済】村人全員の食料代（計 ${totalFoodCost} G）が引き落とされ、プレイヤーに支払われました。`,
      type: "info",
    });
  }

  const fedVillagers = villagers.filter((v) => v.activeFoodBuffId);
  if (fedVillagers.length > 0) {
    const foodNames = Array.from(
      new Set(fedVillagers.map((v) => ITEMS[v.activeFoodBuffId!]?.name || v.activeFoodBuffId)),
    ).join("、");
    logsToAppend.push({
      message: `【配給】村人たちは食料（${foodNames}）を食べ、ステータスが強化されました！`,
      type: "info",
    });
  }

  const explRes = processExploration(dungeons, villagers, currentTier);
  dungeons = explRes.dungeons;
  logsToAppend.push(...explRes.logs);

  const craftRes = processCraftingAndUpgrades(
    facilities,
    villagers,
    inventory,
    soulUpgrades,
    gold,
    currentDay,
    nextStats,
  );
  facilities = craftRes.facilities;
  villagers = craftRes.villagers;
  inventory = { ...inventory, ...craftRes.inventory };
  gold = craftRes.gold;
  logsToAppend.push(...craftRes.logs);

  // 資源生産施設による供給（12時間ごと）
  if (currentHour % 12 === 0) {
    const prodResult = processResourceFacilities(facilities, inventory);
    inventory = prodResult.inventory;
    logsToAppend.push(...prodResult.logs);
  }

  const bossRes = processBossBattle(
    activeBoss,
    villagers,
    dungeons,
    currentTier,
    bossDefeated,
    gameLimitDays,
    hasStarvation,
    soulUpgrades,
    isSalaryUnpaidNext,
    nextStats,
  );
  activeBoss = bossRes.activeBoss;
  villagers = bossRes.villagers;
  bossDefeated = bossRes.bossDefeated;
  currentTier = bossRes.currentTier;
  gameLimitDays = bossRes.gameLimitDays;
  logsToAppend.push(...bossRes.logs);

  if (bossRes.gameOver) {
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
      gameLimitDays,
      gameOver: true,
      gameOverReason: "クリア",
      isPaused: true,
      logsToAppend,
      towns,
      caravans,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      lastSchedulerTick,
      stats: nextStats,
    };
  }

  // スケジューリング処理（一定間隔でターゲットを再割り当て）
  const cumulativeTick = currentDay * 24 + currentHour;
  if (cumulativeTick - lastSchedulerTick >= SCHEDULER_INTERVAL_HOURS) {
    const schedRes = runVillagerScheduler({
      villagers,
      dungeons,
      inventory,
      targetAmounts,
    });
    villagers = schedRes.villagers;
    logsToAppend.push(...schedRes.logs);
    lastSchedulerTick = cumulativeTick;
  }

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
    isSalaryUnpaidNext,
    nextStats,
  );
  villagers = actRes.villagers;
  inventory = { ...inventory, ...actRes.inventory };
  dungeons = actRes.dungeons;
  gold = actRes.gold; // 宿代引き落としや採取・討伐完了による売買が反映される
  logsToAppend.push(...actRes.logs);

  const autoRes = processAutoCraft(facilities, villagers, inventory, targetAmounts);
  facilities = autoRes.facilities;
  villagers = autoRes.villagers;
  inventory = { ...inventory, ...autoRes.inventory };
  logsToAppend.push(...autoRes.logs);

  const trainingRes = processAutoTraining(facilities, villagers, currentDay);
  facilities = trainingRes.facilities;
  villagers = trainingRes.villagers;
  logsToAppend.push(...trainingRes.logs);

  // 交易馬車の進行処理（帰還時は報酬を自動回収し、returned状態にする）
  const caravanRes = processCaravanProgress(caravans, towns, gold, inventory, nextStats);
  caravans = caravanRes.caravans;
  towns = caravanRes.towns;
  gold = caravanRes.gold;
  inventory = caravanRes.inventory;
  logsToAppend.push(...caravanRes.logs);

  // 自動交易が有効な馬車は即座に idle に戻して次の交易に備える
  caravans = caravans.map((c) => {
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

  // Tierアップ時に対応する町をアンロック
  const unlockRes = unlockTownsByTier(towns, currentTier);
  towns = unlockRes.towns;
  logsToAppend.push(...unlockRes.logs);

  // 自動取引の実行
  const tradeRes = processAutoTrade({
    facilities,
    tradeRules: state.tradeRules,
    inventory,
    gold,
    caravans,
    towns,
  });
  gold = tradeRes.gold;
  inventory = tradeRes.inventory;
  caravans = tradeRes.caravans;
  logsToAppend.push(...tradeRes.logs);

  // 毎時間のプール自動購入処理
  const poolRes = processItemPoolPurchase(gold, inventory, villagers, nextStats);
  gold = poolRes.gold;
  inventory = poolRes.inventory;
  villagers = poolRes.villagers;
  logsToAppend.push(...poolRes.logs);

  // ツケ（マイナスゴールド）がある村人がいるかどうかで未払いフラグを更新
  isSalaryUnpaidNext = villagers.some((v) => v.gold < 0);

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
    gameLimitDays,
    gameOver,
    gameOverReason: state.gameOverReason,
    isPaused,
    logsToAppend,
    towns,
    caravans,
    isSalaryUnpaid: isSalaryUnpaidNext,
    consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
    lastSchedulerTick,
    stats: nextStats,
  };
}
