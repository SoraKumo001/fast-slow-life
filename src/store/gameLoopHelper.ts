import { ITEMS } from "../data/masterData";
import { getFriendshipLevel } from "../data/towns";
import { GameState, Villager, RunStats } from "../types/game";
import { processAutoTrade } from "./autoTradeHelper";
import { processBossBattle } from "./bossBattle";
import { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
import { processExploration } from "./exploration";
import { AdvanceHourResult } from "./gameLoopTypes";
import { getInitialStats } from "./initialState";
import { processItemPoolPurchase } from "./poolPurchase";
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
    towns,
    caravans,
    marketTrend,
    isSalaryUnpaid,
    consecutiveNegativeGoldDays,
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
      logsToAppend.push({
        message: `【経済警告】プレイヤーの所持金がマイナスになっています（連続 ${consecutiveNegativeGoldDaysNext} 日目）。`,
        type: "warning",
      });
    } else {
      consecutiveNegativeGoldDaysNext = 0;
    }

    const unlockedTowns = towns.filter((t) => t.isUnlocked);

    if (unlockedTowns.length > 0) {
      const randomTown = unlockedTowns[Math.floor(Math.random() * unlockedTowns.length)];
      if (randomTown.demands && randomTown.demands.length > 0) {
        const demand = randomTown.demands[Math.floor(Math.random() * randomTown.demands.length)];
        const multiplier = Math.round((1.5 + Math.random() * 1.0) * 10) / 10;
        marketTrend = {
          targetTownId: randomTown.id,
          itemId: demand.itemId,
          type: "demand",
          multiplier,
        };
        const item = ITEMS[demand.itemId];
        logsToAppend.push({
          message: `【経済相場】本日、${randomTown.name}で ${item?.name || demand.itemId} の需要が急増中！ 輸出価格が ${multiplier}倍になります。`,
          type: "info",
        });
      }
    }
  }

  if (consecutiveNegativeGoldDaysNext >= 3) {
    logsToAppend.push({
      message: `【ゲームオーバー】所持金マイナス状態が3日間続いたため、破産しました！`,
      type: "error",
    });
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
      marketTrend,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      stats: nextStats,
    };
  }

  if (currentDay > gameLimitDays && !bossDefeated) {
    logsToAppend.push({
      message: `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。ゲームオーバー！`,
      type: "error",
    });
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
      marketTrend,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
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
    nextStats,
  );
  facilities = craftRes.facilities;
  villagers = craftRes.villagers;
  inventory = { ...inventory, ...craftRes.inventory };
  logsToAppend.push(...craftRes.logs);

  // 資源生産施設による供給（12時間ごと）
  if (currentHour % 12 === 0) {
    let producedWheat = 0;
    let producedVegetable = 0;
    let producedRawMeat = 0;
    let producedWood = 0;
    let producedStone = 0;

    if (facilities.farm && facilities.farm.level > 0) {
      const lvl = facilities.farm.level;
      producedWheat = Math.floor((1 + lvl) / 2);
      producedVegetable = Math.floor(lvl / 2);
      producedRawMeat = Math.floor((lvl - 1) / 2);

      if (producedWheat > 0) inventory.wheat = (inventory.wheat || 0) + producedWheat;
      if (producedVegetable > 0)
        inventory.vegetable = (inventory.vegetable || 0) + producedVegetable;
      if (producedRawMeat > 0) inventory.raw_meat = (inventory.raw_meat || 0) + producedRawMeat;
    }
    if (facilities.lumberyard && facilities.lumberyard.level > 0) {
      producedWood = Math.floor((1 + facilities.lumberyard.level * 1) / 2);
      inventory.wood = (inventory.wood || 0) + producedWood;
    }
    if (facilities.quarry && facilities.quarry.level > 0) {
      producedStone = Math.floor((1 + facilities.quarry.level * 1) / 2);
      inventory.stone = (inventory.stone || 0) + producedStone;
    }

    const hasFarmProd = producedWheat > 0 || producedVegetable > 0 || producedRawMeat > 0;
    if (hasFarmProd || producedWood > 0 || producedStone > 0) {
      const prodLogs: string[] = [];
      if (hasFarmProd) {
        const farmLogs: string[] = [];
        if (producedWheat > 0) farmLogs.push(`小麦+${producedWheat}`);
        if (producedVegetable > 0) farmLogs.push(`野菜+${producedVegetable}`);
        if (producedRawMeat > 0) farmLogs.push(`生肉+${producedRawMeat}`);
        prodLogs.push(farmLogs.join("、"));
      }
      if (producedWood > 0) prodLogs.push(`原木+${producedWood}`);
      if (producedStone > 0) prodLogs.push(`石材+${producedStone}`);
      logsToAppend.push({
        message: `【生産】資源施設が稼働しました（${prodLogs.join("、")}）。`,
        type: "info",
      });
    }
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
  if (actRes.gameOver) {
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
      gameOver: actRes.gameOver,
      gameOverReason: "全滅",
      isPaused: actRes.isPaused,
      logsToAppend,
      towns,
      caravans,
      marketTrend,
      isSalaryUnpaid: isSalaryUnpaidNext,
      consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
      stats: nextStats,
    };
  }

  const autoRes = processAutoCraft(facilities, villagers, inventory, targetAmounts);
  facilities = autoRes.facilities;
  villagers = autoRes.villagers;
  inventory = { ...inventory, ...autoRes.inventory };
  logsToAppend.push(...autoRes.logs);

  // 交易馬車の進行処理（帰還時は自動回収して待機状態にする）
  caravans = caravans.map((caravan) => {
    if (caravan.status !== "trading") return caravan;
    const nextTimeLeft = caravan.timeLeft - 1;
    if (nextTimeLeft <= 0) {
      const destTown = towns.find((t) => t.id === caravan.destinationTownId);
      if (!destTown) {
        return {
          ...caravan,
          status: "idle",
          destinationTownId: null,
          type: null,
          timeLeft: 0,
          totalTime: 0,
          cargo: [],
          goldCost: 0,
          goldEarned: 0,
          friendshipEarned: 0,
        };
      }

      if (caravan.type === "export") {
        gold += caravan.goldEarned;
        nextStats.totalGoldFromExports += caravan.goldEarned;

        towns = towns.map((t) => {
          if (t.id === destTown.id) {
            const nextFriendship = Math.min(1000, t.friendship + caravan.friendshipEarned);
            const nextLevel = getFriendshipLevel(nextFriendship);
            return { ...t, friendship: nextFriendship, level: nextLevel };
          }
          return t;
        });

        const updatedTown = towns.find((t) => t.id === destTown.id)!;
        logsToAppend.push({
          message: `【交易帰還】${destTown.name} から交易馬車が帰還！ ${caravan.goldEarned} G を獲得、友好度 +${caravan.friendshipEarned}（現在の友好度Lv: ${updatedTown.level}）。`,
          type: "info",
        });
      } else if (caravan.type === "import") {
        for (const entry of caravan.cargo) {
          inventory[entry.itemId] = (inventory[entry.itemId] || 0) + entry.count;
        }
        nextStats.totalGoldSpentOnImports += caravan.goldCost;

        const itemsStr = caravan.cargo
          .map((entry) => `${ITEMS[entry.itemId]?.name || entry.itemId} x${entry.count}`)
          .join(", ");
        logsToAppend.push({
          message: `【交易帰還】仕入れ馬車が ${destTown.name} から帰還し、品物を受け取りました：${itemsStr}`,
          type: "info",
        });
      }

      return {
        ...caravan,
        status: "idle",
        destinationTownId: null,
        type: null,
        timeLeft: 0,
        totalTime: 0,
        cargo: [],
        goldCost: 0,
        goldEarned: 0,
        friendshipEarned: 0,
      };
    }
    return {
      ...caravan,
      timeLeft: nextTimeLeft,
    };
  });

  // Tierアップ時に対応する町をアンロック
  towns = towns.map((t) => {
    if (!t.isUnlocked && t.id === "ironport" && currentTier >= 2) {
      logsToAppend.push({
        message: `【交易】噂が広まり、新たな交易先「港町アイアンポート」への航路が拓かれました！`,
        type: "system",
      });
      return { ...t, isUnlocked: true };
    }
    if (!t.isUnlocked && t.id === "magica" && currentTier >= 3) {
      logsToAppend.push({
        message: `【交易】噂が広まり、新たな交易先「魔法都市マギカ」への街道が解放されました！`,
        type: "system",
      });
      return { ...t, isUnlocked: true };
    }
    return t;
  });

  // 自動取引の実行
  const tradeRes = processAutoTrade({
    facilities,
    tradeRules: state.tradeRules,
    inventory,
    gold,
    caravans,
    towns,
    marketTrend,
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
    marketTrend,
    isSalaryUnpaid: isSalaryUnpaidNext,
    consecutiveNegativeGoldDays: consecutiveNegativeGoldDaysNext,
    stats: nextStats,
  };
}
