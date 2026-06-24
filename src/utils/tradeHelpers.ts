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
 * 輸出価格（1個あたり）の計算。
 * 市場売却ボーナス、友好度ボーナス、需要トレンド倍率を適用する。
 */
export function calcExportPrice(
  basePrice: number,
  itemId: string,
  town: Town,
  marketLvl: number,
  marketTrend: MarketTrend | null,
): number {
  const priceWithTrend = getPriceWithTrend(basePrice, "export", itemId, [town], marketTrend);
  const marketBonus = getMarketSellBonus(marketLvl);
  const friendshipBonus = (town.level - 1) * 0.05;
  return Math.floor(priceWithTrend.price * (1 + marketBonus + friendshipBonus));
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

  Object.entries(exportCargo).forEach(([itemId, count]) => {
    const item = ITEMS[itemId];
    if (!item || count <= 0) return;

    const isTrend =
      marketTrend && marketTrend.targetTownId === activeTown.id && marketTrend.itemId === itemId;
    const finalPrice =
      calcExportPrice(item.basePrice, itemId, activeTown, marketLvl, marketTrend) * count;

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

export interface PriceWithTrendInfo {
  price: number;
  isTrend: boolean;
  isAnyTrend: boolean;
  trendMultiplier: number;
}

/**
 * トレンド倍率を考慮した価格計算。
 * type が "export" の場合、指定した町群のいずれかに該当アイテムのトレンドが存在すれば倍率を適用する。
 * - isAnyTrend: トレンド有無（需要/余剰問わず）。特需バッジ表示用。
 * - isTrend: 需要トレンドのみ。価格倍率表示用。
 * type が "import" の場合はトレンドは適用されない。
 */
export function getPriceWithTrend(
  basePrice: number,
  type: "export" | "import",
  itemId: string,
  towns: Town[],
  marketTrend: MarketTrend | null,
): PriceWithTrendInfo {
  if (type === "import" || !marketTrend) {
    return { price: basePrice, isTrend: false, isAnyTrend: false, trendMultiplier: 1 };
  }

  const isAnyTrend =
    marketTrend.itemId === itemId && towns.some((t) => t.id === marketTrend.targetTownId);
  const isTrend = isAnyTrend && marketTrend.type === "demand";

  if (isTrend) {
    return {
      price: Math.floor(basePrice * marketTrend.multiplier),
      isTrend: true,
      isAnyTrend: true,
      trendMultiplier: marketTrend.multiplier,
    };
  }

  return { price: basePrice, isTrend: false, isAnyTrend, trendMultiplier: 1 };
}
