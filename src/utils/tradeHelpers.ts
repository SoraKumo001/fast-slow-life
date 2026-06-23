import { ITEMS } from "../data/masterData";
import type { MarketTrend, Town } from "../types/game";
import { getMarketSellBonus } from "../utils/marketHelpers";

/**
 * 仕入れ価格の計算。
 * 売値の3倍がベース、友好度Lvとソウル割引で最大40%引き。
 */
export function getImportPrice(itemId: string, town: Town, discountLevel: number): number {
  const item = ITEMS[itemId];
  if (!item) return 0;
  const basePrice = item.basePrice * 3;
  const rate = 1 - (town.level - 1) * 0.05 - discountLevel * 0.05;
  return Math.max(1, Math.floor(basePrice * rate));
}

export interface ExportEstimate {
  gold: number;
  friendship: number;
  count: number;
}

/**
 * 輸出総額と友好度上昇量の推定
 */
export function calculateExportEstimates(
  activeTown: Town,
  exportCargo: Record<string, number>,
  marketLvl: number,
  marketTrend: MarketTrend | null,
): ExportEstimate {
  let totalGold = 0;
  let totalFriendship = 0;
  let totalCount = 0;

  const marketBonus = getMarketSellBonus(marketLvl);

  Object.entries(exportCargo).forEach(([itemId, count]) => {
    const item = ITEMS[itemId];
    if (!item || count <= 0) return;

    let price = item.basePrice;
    const isTrend =
      marketTrend && marketTrend.targetTownId === activeTown.id && marketTrend.itemId === itemId;

    if (isTrend && marketTrend?.type === "demand") {
      price = Math.floor(price * marketTrend.multiplier);
    }

    const friendshipBonus = (activeTown.level - 1) * 0.05;
    const finalPrice = Math.floor(price * (1 + marketBonus + friendshipBonus)) * count;

    totalGold += finalPrice;
    totalFriendship += count * (isTrend ? 2 : 1);
    totalCount += count;
  });

  return { gold: totalGold, friendship: totalFriendship, count: totalCount };
}

export interface ImportEstimate {
  gold: number;
  count: number;
}

/**
 * 輸入の総額と積載量の推定
 */
export function calculateImportEstimates(
  activeTown: Town,
  importCargo: Record<string, number>,
  discountLevel: number,
): ImportEstimate {
  let totalGold = 0;
  let totalCount = 0;

  Object.entries(importCargo).forEach(([itemId, count]) => {
    if (count <= 0) return;
    const price = getImportPrice(itemId, activeTown, discountLevel);
    totalGold += price * count;
    totalCount += count;
  });

  return { gold: totalGold, count: totalCount };
}

/**
 * 積載上限の計算
 */
export function getCargoLimit(town: Town): number {
  return 15 + (town.investLevel - 1) * 10;
}
