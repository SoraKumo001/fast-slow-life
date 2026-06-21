import { ITEMS } from "../../data/masterData";
import { getFriendshipLevel, getInvestCost } from "../../data/towns";
import { StoreGet, StoreSet } from "../../types/game";
import { getMarketSellBonus } from "../../utils/marketHelpers";
import { processItemPoolPurchase } from "../poolPurchase";

export const createTradeActions = (set: StoreSet, get: StoreGet) => ({
  sendExportCaravan: (
    caravanId: string,
    townId: string,
    cargo: { itemId: string; count: number }[],
  ) => {
    const state = get();
    const town = state.towns.find((t) => t.id === townId);
    if (!town || !town.isUnlocked) return;

    // 施設「交易所」のレベルに応じた制限
    const marketLvl = state.facilities.market?.level || 0;
    if (marketLvl === 0) return;

    const maxCaravans = marketLvl === 1 ? 1 : marketLvl === 2 ? 2 : 3;
    const caravanIndex = state.caravans.findIndex((c) => c.id === caravanId);
    if (caravanIndex === -1 || caravanIndex >= maxCaravans) return;

    const caravan = state.caravans[caravanIndex];
    if (caravan.status !== "idle") return;

    // インベントリにアイテムがあるかチェック
    const nextInventory = { ...state.inventory };
    for (const entry of cargo) {
      const current = nextInventory[entry.itemId] || 0;
      if (current < entry.count) {
        state.addLog(
          `【交易】倉庫の ${ITEMS[entry.itemId]?.name || entry.itemId} が不足しています。`,
          "error",
        );
        return;
      }
      nextInventory[entry.itemId] = current - entry.count;
    }

    // 売却額と友好度上昇の計算
    const marketBonus = getMarketSellBonus(marketLvl);
    let totalGoldEarned = 0;
    let totalFriendshipEarned = 0;

    for (const entry of cargo) {
      const item = ITEMS[entry.itemId];
      if (!item) continue;

      let price = item.sellPrice;
      const isTrend =
        state.marketTrend &&
        state.marketTrend.targetTownId === townId &&
        state.marketTrend.itemId === entry.itemId;

      if (isTrend && state.marketTrend?.type === "demand") {
        price = Math.floor(price * state.marketTrend.multiplier);
      }

      const friendshipBonus = (town.level - 1) * 0.05;
      const finalPrice = Math.floor(price * (1 + marketBonus + friendshipBonus)) * entry.count;
      totalGoldEarned += finalPrice;

      // 友好度: 通常1個につき1点、トレンドは1個につき2点
      totalFriendshipEarned += entry.count * (isTrend ? 2 : 1);
    }

    // 所要時間の計算 (投資レベルで最大50%短縮)
    const timeReduction = Math.min(0.5, (town.investLevel - 1) * 0.1);
    const totalTime = Math.max(1, Math.ceil(town.distance * (1 - timeReduction)));

    const updatedCaravans = [...state.caravans];
    updatedCaravans[caravanIndex] = {
      ...caravan,
      status: "trading",
      destinationTownId: townId,
      type: "export",
      timeLeft: totalTime,
      totalTime,
      cargo,
      goldCost: 0,
      goldEarned: totalGoldEarned,
      friendshipEarned: totalFriendshipEarned,
    };

    set({
      inventory: nextInventory,
      caravans: updatedCaravans,
    });

    state.addLog(
      `【交易】交易馬車を ${town.name} へ派遣しました（輸出: 所要時間 ${totalTime} 時間）。`,
      "info",
    );
  },

  sendImportCaravan: (
    caravanId: string,
    townId: string,
    cargo: { itemId: string; count: number }[],
    goldCost: number,
  ) => {
    const state = get();
    const town = state.towns.find((t) => t.id === townId);
    if (!town || !town.isUnlocked) return;

    const marketLvl = state.facilities.market?.level || 0;
    if (marketLvl === 0) return;

    const maxCaravans = marketLvl === 1 ? 1 : marketLvl === 2 ? 2 : 3;
    const caravanIndex = state.caravans.findIndex((c) => c.id === caravanId);
    if (caravanIndex === -1 || caravanIndex >= maxCaravans) return;

    const caravan = state.caravans[caravanIndex];
    if (caravan.status !== "idle") return;

    if (state.gold < goldCost) {
      state.addLog(`【交易】所持ゴールドが不足しています。`, "error");
      return;
    }

    // 所要時間の計算
    const timeReduction = Math.min(0.5, (town.investLevel - 1) * 0.1);
    const totalTime = Math.max(1, Math.ceil(town.distance * (1 - timeReduction)));

    const updatedCaravans = [...state.caravans];
    updatedCaravans[caravanIndex] = {
      ...caravan,
      status: "trading",
      destinationTownId: townId,
      type: "import",
      timeLeft: totalTime,
      totalTime,
      cargo,
      goldCost,
      goldEarned: 0,
      friendshipEarned: 0,
    };

    set({
      gold: state.gold - goldCost,
      caravans: updatedCaravans,
    });

    state.addLog(
      `【交易】交易馬車を ${town.name} へ派遣しました（仕入れ: 所要時間 ${totalTime} 時間）。`,
      "info",
    );
  },

  collectCaravan: (caravanId: string) => {
    const state = get();
    const caravanIndex = state.caravans.findIndex((c) => c.id === caravanId);
    if (caravanIndex === -1) return;

    const caravan = state.caravans[caravanIndex];
    if (caravan.status !== "returned") return;

    const town = state.towns.find((t) => t.id === caravan.destinationTownId);
    if (!town) return;

    let nextGold = state.gold;
    const nextInventory = { ...state.inventory };
    let nextTowns = [...state.towns];

    if (caravan.type === "export") {
      // ゴールドの獲得
      nextGold += caravan.goldEarned;

      // 友好度の上昇
      nextTowns = state.towns.map((t) => {
        if (t.id === town.id) {
          const nextFriendship = Math.min(1000, t.friendship + caravan.friendshipEarned);
          const nextLevel = getFriendshipLevel(nextFriendship);
          return {
            ...t,
            friendship: nextFriendship,
            level: nextLevel,
          };
        }
        return t;
      });

      const updatedTown = nextTowns.find((t) => t.id === town.id)!;
      state.addLog(
        `【交易】交易馬車が ${town.name} から帰還！ ${caravan.goldEarned} G を獲得し、友好度が ${caravan.friendshipEarned} 上昇しました（現在の友好度Lv: ${updatedTown.level}）。`,
        "info",
      );
    } else if (caravan.type === "import") {
      // アイテムの獲得
      for (const entry of caravan.cargo) {
        nextInventory[entry.itemId] = (nextInventory[entry.itemId] || 0) + entry.count;
      }

      const itemsStr = caravan.cargo
        .map((entry) => `${ITEMS[entry.itemId]?.name || entry.itemId} x${entry.count}`)
        .join(", ");
      state.addLog(
        `【交易】交易馬車が ${town.name} から帰還し、仕入れた品物を受け取りました：${itemsStr}`,
        "info",
      );
    }

    const poolRes = processItemPoolPurchase(nextGold, nextInventory, state.villagers);
    nextGold = poolRes.gold;
    Object.keys(nextInventory).forEach((k) => delete nextInventory[k]);
    Object.assign(nextInventory, poolRes.inventory);

    // 馬車の状態リセット
    const updatedCaravans = [...state.caravans];
    updatedCaravans[caravanIndex] = {
      id: caravanId,
      status: "idle",
      destinationTownId: null,
      type: null,
      timeLeft: 0,
      totalTime: 0,
      cargo: [],
      goldCost: 0,
      goldEarned: 0,
      friendshipEarned: 0,
      isAuto: caravan.isAuto,
    };

    set({
      gold: nextGold,
      inventory: nextInventory,
      towns: nextTowns,
      caravans: updatedCaravans,
      villagers: poolRes.villagers,
    });

    poolRes.logs.forEach((log) => state.addLog(log.message, log.type));
  },

  investInTown: (townId: string) => {
    const state = get();
    const townIndex = state.towns.findIndex((t) => t.id === townId);
    if (townIndex === -1) return;

    const town = state.towns[townIndex];
    if (!town.isUnlocked) return;

    if (state.gold < town.investCost) {
      state.addLog(`【交易】投資に必要なゴールドが不足しています。`, "error");
      return;
    }

    const nextInvestLevel = town.investLevel + 1;
    const nextInvestCost = getInvestCost(nextInvestLevel);

    const updatedTowns = [...state.towns];
    updatedTowns[townIndex] = {
      ...town,
      investLevel: nextInvestLevel,
      investCost: nextInvestCost,
    };

    set({
      gold: state.gold - town.investCost,
      towns: updatedTowns,
    });

    state.addLog(
      `【交易】${town.name} に投資しました（投資Lv: ${nextInvestLevel} に上昇）。交易時間がさらに短縮されます。`,
      "info",
    );
  },

  toggleCaravanAuto: (caravanId: string) => {
    const state = get();
    const caravanIndex = state.caravans.findIndex((c) => c.id === caravanId);
    if (caravanIndex === -1) return;

    const updatedCaravans = [...state.caravans];
    const caravan = updatedCaravans[caravanIndex];
    const nextAuto = !caravan.isAuto;

    updatedCaravans[caravanIndex] = {
      ...caravan,
      isAuto: nextAuto,
    };

    set({ caravans: updatedCaravans });
    state.addLog(
      `【交易】馬車 #${caravanIndex + 1} の自動交易を ${nextAuto ? "有効" : "無効"} にしました。`,
      "info",
    );
  },
});
