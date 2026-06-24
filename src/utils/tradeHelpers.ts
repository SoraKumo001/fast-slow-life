import { ITEMS } from "../data/masterData";
import type { Town } from "../types/game";
import { getMarketSellBonus } from "./marketHelpers";

/**
 * 仕入れ価格の計算。
 * 売値の3倍がベース、ソウル割引で最大40%引き。
 */
export function getImportPrice(itemId: string, _town: Town, discountLevel: number): number {
  const item = ITEMS[itemId];
  if (!item) return 0;
  const basePrice = item.basePrice * 3;
  const rate = 1 - discountLevel * 0.05;
  return Math.max(1, Math.floor(basePrice * rate));
}

export interface ExportEstimate {
  gold: number;
  count: number;
}

/**
 * 輸出価格（1個あたり）の計算。
 * 市場売却ボーナスを適用する。
 */
export function calcExportPrice(
  basePrice: number,
  _itemId: string,
  _town: Town,
  marketLvl: number,
): number {
  const marketBonus = getMarketSellBonus(marketLvl);
  return Math.floor(basePrice * (1 + marketBonus));
}

/**
 * 輸出総額の推定
 */
export function calculateExportEstimates(
  activeTown: Town,
  exportCargo: Record<string, number>,
  marketLvl: number,
): ExportEstimate {
  let totalGold = 0;
  let totalCount = 0;

  Object.entries(exportCargo).forEach(([itemId, count]) => {
    const item = ITEMS[itemId];
    if (!item || count <= 0) return;

    const finalPrice = calcExportPrice(item.basePrice, itemId, activeTown, marketLvl) * count;

    totalGold += finalPrice;
    totalCount += count;
  });

  return { gold: totalGold, count: totalCount };
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
