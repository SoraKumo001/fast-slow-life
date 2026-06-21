import { ITEMS } from "../data/masterData";
import { getFriendshipLevel } from "../data/towns";
import { GameState } from "../types/game";
import { getMarketSellBonus } from "../utils/marketHelpers";
import { processAutoTrade } from "./autoTradeHelper";
import { processBossBattle } from "./bossBattle";
import { processCraftingAndUpgrades, processAutoCraft } from "./crafting";
import { processExploration } from "./exploration";
import { AdvanceHourResult } from "./gameLoopTypes";
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
  } = state;

  const logsToAppend: import("./gameLoopTypes").LogPayload[] = [];

  currentHour += 1;
  let isNewDay = false;
  if (currentHour >= 24) {
    currentHour = 0;
    currentDay += 1;
    isNewDay = true;
  }

  let isSalaryUnpaidNext = isSalaryUnpaid;

  if (isNewDay) {
    // プレイヤーのゴールドは毎日100G増える
    gold += 100;
    logsToAppend.push({
      message: `【経済】毎日の資金援助としてプレイヤーのゴールドが 100 G 増加しました。`,
      type: "info",
    });

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
      isPaused: true,
      logsToAppend,
      towns,
      caravans,
      marketTrend,
      isSalaryUnpaid: isSalaryUnpaidNext,
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
      if (v.currentJob === "無職") {
        foodCost = 0;
      } else if (v.isStarving) {
        foodCost = 0;
      } else if (v.activeFoodBuffId) {
        foodCost = ITEMS[v.activeFoodBuffId]?.sellPrice || 2;
      } else {
        foodCost = 2; // 生の食材の基本価格
      }

      const nextV = { ...v };
      nextV.gold -= foodCost;
      totalFoodCost += foodCost;
      return nextV;
    });

    gold += totalFoodCost;
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

  const craftRes = processCraftingAndUpgrades(facilities, villagers, inventory, soulUpgrades);
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
      isPaused: actRes.isPaused,
      logsToAppend,
      towns,
      caravans,
      marketTrend,
      isSalaryUnpaid: isSalaryUnpaidNext,
    };
  }

  const autoRes = processAutoCraft(facilities, villagers, inventory, targetAmounts);
  facilities = autoRes.facilities;
  villagers = autoRes.villagers;
  inventory = { ...inventory, ...autoRes.inventory };
  logsToAppend.push(...autoRes.logs);

  // 交易馬車の進行処理
  caravans = caravans.map((caravan) => {
    if (caravan.status !== "trading") return caravan;
    const nextTimeLeft = caravan.timeLeft - 1;
    if (nextTimeLeft <= 0) {
      const destTown = towns.find((t) => t.id === caravan.destinationTownId);
      logsToAppend.push({
        message: `【交易】${destTown?.name || "外の町"} へ派遣していた交易馬車が帰還しました。`,
        type: "info",
      });

      if (caravan.isAuto) {
        // 自動交易：自動的に回収して再派遣する
        if (caravan.type === "export") {
          // 1. 回収（ゴールド加算と友好度上昇）
          gold += caravan.goldEarned;

          towns = towns.map((t) => {
            if (t.id === caravan.destinationTownId) {
              const nextFriendship = Math.min(1000, t.friendship + caravan.friendshipEarned);
              const nextLevel = getFriendshipLevel(nextFriendship);
              return { ...t, friendship: nextFriendship, level: nextLevel };
            }
            return t;
          });

          const updatedTown = towns.find((t) => t.id === caravan.destinationTownId)!;
          logsToAppend.push({
            message: `【自動交易】馬車が帰還！ ${caravan.goldEarned} G 獲得、友好度 +${caravan.friendshipEarned} (Lv.${updatedTown.level})。`,
            type: "info",
          });

          // 2. 再派遣のチェックと実行
          let hasAllItems = true;
          const tempInventory = { ...inventory };
          for (const entry of caravan.cargo) {
            const current = tempInventory[entry.itemId] || 0;
            if (current < entry.count) {
              hasAllItems = false;
              break;
            }
            tempInventory[entry.itemId] = current - entry.count;
          }

          if (hasAllItems) {
            inventory = tempInventory;

            // 輸出見込み額の再計算
            const marketLvl = facilities.market?.level || 0;
            const marketBonus = getMarketSellBonus(marketLvl);
            let totalGoldEarned = 0;
            let totalFriendshipEarned = 0;

            for (const entry of caravan.cargo) {
              const item = ITEMS[entry.itemId];
              if (!item) continue;

              let price = item.sellPrice;
              const isTrend =
                marketTrend &&
                marketTrend.targetTownId === destTown?.id &&
                marketTrend.itemId === entry.itemId;

              if (isTrend && marketTrend?.type === "demand") {
                price = Math.floor(price * marketTrend.multiplier);
              }

              const friendshipBonus = (updatedTown.level - 1) * 0.05;
              const finalPrice =
                Math.floor(price * (1 + marketBonus + friendshipBonus)) * entry.count;
              totalGoldEarned += finalPrice;
              totalFriendshipEarned += entry.count * (isTrend ? 2 : 1);
            }

            const timeReduction = Math.min(0.5, (updatedTown.investLevel - 1) * 0.1);
            const totalTime = Math.max(
              1,
              Math.ceil((destTown?.distance || 1) * (1 - timeReduction)),
            );

            logsToAppend.push({
              message: `【自動交易】馬車を ${updatedTown.name} へ再派遣しました（輸出: 所要時間 ${totalTime} 時間）。`,
              type: "info",
            });

            return {
              ...caravan,
              status: "trading",
              timeLeft: totalTime,
              totalTime,
              goldEarned: totalGoldEarned,
              friendshipEarned: totalFriendshipEarned,
            };
          } else {
            logsToAppend.push({
              message: `【自動交易警告】倉庫のアイテムが不足しているため、馬車の自動取引を停止しました。`,
              type: "warning",
            });
            return {
              ...caravan,
              status: "returned",
              timeLeft: 0,
            };
          }
        } else if (caravan.type === "import") {
          // 1. 回収（仕入れアイテムを倉庫へ）
          for (const entry of caravan.cargo) {
            inventory[entry.itemId] = (inventory[entry.itemId] || 0) + entry.count;
          }

          const itemsStr = caravan.cargo
            .map((entry) => `${ITEMS[entry.itemId]?.name || entry.itemId} x${entry.count}`)
            .join(", ");
          logsToAppend.push({
            message: `【自動交易】馬車が帰還！ 仕入れた品物を受け取りました：${itemsStr}`,
            type: "info",
          });

          // 2. 再派遣のチェックと実行
          // 仕入れ価格の再計算
          let totalGoldCost = 0;
          const discountLvl = soulUpgrades.discount || 0;
          const updatedTown = towns.find((t) => t.id === caravan.destinationTownId)!;

          for (const entry of caravan.cargo) {
            const item = ITEMS[entry.itemId];
            if (!item) continue;
            const basePrice = item.sellPrice * 3;
            const rate = 1 - (updatedTown.level - 1) * 0.05 - discountLvl * 0.05;
            const buyPrice = Math.max(1, Math.floor(basePrice * rate));
            totalGoldCost += buyPrice * entry.count;
          }

          if (gold >= totalGoldCost) {
            gold -= totalGoldCost;

            const timeReduction = Math.min(0.5, (updatedTown.investLevel - 1) * 0.1);
            const totalTime = Math.max(1, Math.ceil(updatedTown.distance * (1 - timeReduction)));

            logsToAppend.push({
              message: `【自動交易】馬車を ${updatedTown.name} へ再派遣しました（仕入れ: 所要時間 ${totalTime} 時間）。`,
              type: "info",
            });

            return {
              ...caravan,
              status: "trading",
              timeLeft: totalTime,
              totalTime,
              goldCost: totalGoldCost,
            };
          } else {
            logsToAppend.push({
              message: `【自動交易警告】ゴールドが不足しているため、馬車の自動取引を停止しました。`,
              type: "warning",
            });
            return {
              ...caravan,
              status: "returned",
              timeLeft: 0,
            };
          }
        }
      }

      // 自動交易が無効な場合は通常通り returned に遷移
      logsToAppend.push({
        message: `【交易】交易所で報告を受け取りましょう。`,
        type: "info",
      });
      return {
        ...caravan,
        timeLeft: 0,
        status: "returned",
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
  });
  gold = tradeRes.gold;
  inventory = tradeRes.inventory;
  logsToAppend.push(...tradeRes.logs);

  // 毎時間のプール自動購入処理
  const poolRes = processItemPoolPurchase(gold, inventory, villagers);
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
    isPaused,
    logsToAppend,
    towns,
    caravans,
    marketTrend,
    isSalaryUnpaid: isSalaryUnpaidNext,
  };
}
