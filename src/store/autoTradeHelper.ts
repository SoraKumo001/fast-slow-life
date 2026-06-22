import { ITEMS } from "../data/masterData";
import { GameState, Caravan, Town } from "../types/game";
import { getMarketSellBonus } from "../utils/marketHelpers";
import { LogPayload } from "./gameLoopTypes";

export function processAutoTrade(
  state: Pick<
    GameState,
    "facilities" | "tradeRules" | "inventory" | "gold" | "caravans" | "towns" | "marketTrend"
  >,
): {
  gold: number;
  inventory: Record<string, number>;
  caravans: Caravan[];
  logs: LogPayload[];
} {
  let gold = state.gold;
  const inventory = { ...state.inventory };
  let caravans = [...state.caravans];
  const logs: LogPayload[] = [];

  const market = state.facilities.market;
  const marketLvl = market?.level || 0;
  if (marketLvl === 0) {
    return { gold, inventory, caravans, logs };
  }

  const maxCaravans = marketLvl === 1 ? 1 : marketLvl === 2 ? 2 : 3;
  const marketBonus = getMarketSellBonus(marketLvl);

  // 1. 待機中（idle）の馬車をスロット枠内で探す
  for (let i = 0; i < maxCaravans; i++) {
    const caravan = caravans[i];
    if (!caravan || caravan.status !== "idle") continue;

    // 2. 有効化された tradeRules をチェック
    // 倉庫内のアイテム数（今積載決定した分を差し引いた残り）が threshold を超えているものをリストアップ
    const cargoCandidates: { itemId: string; excess: number; basePrice: number }[] = [];

    for (const rule of state.tradeRules) {
      if (!rule.isEnabled || rule.type !== "sell") continue;
      const item = ITEMS[rule.itemId];
      if (!item) continue;

      const currentCount = inventory[rule.itemId] || 0;
      const excess = currentCount - rule.threshold;
      if (excess > 0) {
        cargoCandidates.push({
          itemId: rule.itemId,
          excess,
          basePrice: item.basePrice,
        });
      }
    }

    if (cargoCandidates.length === 0) continue;

    // 3. 派遣先の街を決定する
    // アンロックされている街の中から、今回の cargo を輸出した場合の売却見込み額が最も高い街を選ぶ
    const unlockedTowns = state.towns.filter((t) => t.isUnlocked);
    if (unlockedTowns.length === 0) continue;

    let bestTown: Town | null = null;
    let bestTownEstimates: {
      cargo: { itemId: string; count: number }[];
      goldEarned: number;
      friendshipEarned: number;
      totalTime: number;
    } | null = null;

    for (const town of unlockedTowns) {
      // 街の積載上限
      const cargoLimit = 15 + (town.investLevel - 1) * 10;

      // この街に積載可能な cargo を作成
      // 価値が高いアイテムを優先的に積む（または単純に超過分を積めるだけ積む）
      // 基本価格の高い順に並び替えて積む
      const sortedCandidates = [...cargoCandidates].sort((a, b) => b.basePrice - a.basePrice);

      let currentCargoCount = 0;
      const tempCargo: { itemId: string; count: number }[] = [];
      let totalGoldEarned = 0;
      let totalFriendshipEarned = 0;

      for (const cand of sortedCandidates) {
        if (currentCargoCount >= cargoLimit) break;

        const countToLoad = Math.min(cand.excess, cargoLimit - currentCargoCount);
        if (countToLoad <= 0) continue;

        let price = cand.basePrice;
        const isTrend =
          state.marketTrend &&
          state.marketTrend.targetTownId === town.id &&
          state.marketTrend.itemId === cand.itemId;

        if (isTrend && state.marketTrend?.type === "demand") {
          price = Math.floor(price * state.marketTrend.multiplier);
        }

        const friendshipBonus = (town.level - 1) * 0.05;
        const finalPrice = Math.floor(
          Math.floor(price * (1 + marketBonus + friendshipBonus)) * countToLoad,
        );

        tempCargo.push({ itemId: cand.itemId, count: countToLoad });
        totalGoldEarned += finalPrice;
        totalFriendshipEarned += Math.floor(countToLoad * (isTrend ? 2 : 1));
        currentCargoCount += countToLoad;
      }

      if (tempCargo.length === 0) continue;

      // 往復所要時間
      const timeReduction = Math.min(0.5, (town.investLevel - 1) * 0.1);
      const totalTime = Math.max(1, Math.ceil(town.distance * (1 - timeReduction)));

      // 友好関係を考慮して、最も見込み額が高くなる街を評価
      if (!bestTownEstimates || totalGoldEarned > bestTownEstimates.goldEarned) {
        bestTown = town;
        bestTownEstimates = {
          cargo: tempCargo,
          goldEarned: totalGoldEarned,
          friendshipEarned: totalFriendshipEarned,
          totalTime,
        };
      }
    }

    if (bestTown && bestTownEstimates) {
      // 4. 馬車を派遣
      // インベントリから引く
      for (const entry of bestTownEstimates.cargo) {
        inventory[entry.itemId] -= entry.count;
      }

      caravans[i] = {
        ...caravan,
        status: "trading",
        destinationTownId: bestTown.id,
        type: "export",
        timeLeft: bestTownEstimates.totalTime,
        totalTime: bestTownEstimates.totalTime,
        cargo: bestTownEstimates.cargo,
        goldCost: 0,
        goldEarned: bestTownEstimates.goldEarned,
        friendshipEarned: bestTownEstimates.friendshipEarned,
        isAuto: true,
      };

      logs.push({
        message: `【自動交易】交易馬車 #${i + 1} を ${bestTown.name} へ派遣しました（輸出: 所要時間 ${bestTownEstimates.totalTime} 時間）。`,
        type: "info",
      });
    }
  }

  return { gold, inventory, caravans, logs };
}
