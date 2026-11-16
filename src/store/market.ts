/**
 * 市場価格（経済v2・Phase 3）
 *
 * アイテムごとに「目標在庫との差」で変動する価格を純関数で決める。
 * 価格は日境界でのみ再計算され、日中は固定される。乱数は使わない（決定論的）。
 */
import { ITEMS } from "../data/masterData";
import type { Item, ItemCategory, PricePolicy } from "../types/game";

/** 価格方針の倍率 */
export const PRICE_POLICY_MULTIPLIERS: Record<PricePolicy, number> = {
  cheap: 0.8,
  standard: 1.0,
  premium: 1.25,
};

/** 素材系カテゴリ（目標在庫 30） */
const MATERIAL_CATEGORIES: ReadonlySet<ItemCategory> = new Set([
  "material",
  "ore",
  "herb",
  "mana_stone",
]);

/** カテゴリ別の基礎目標在庫 */
function baseTargetStock(item: Item): number {
  if (item.category === "food") return 20;
  if (MATERIAL_CATEGORIES.has(item.category)) return 30;
  return 10;
}

/**
 * 目標在庫: カテゴリ基礎値 + 交易所レベル × 5。
 * 在庫がこの水準にあるとき希少度係数は 1.0 になる。
 */
export function targetStock(item: Item, marketLevel: number): number {
  return baseTargetStock(item) + 5 * Math.max(0, Math.floor(marketLevel));
}

/**
 * 市場価格を計算する。
 * factor = clamp(1 + (target - stock) / target, 0.4, 1.6)
 *   在庫0で 1.6、目標どおりで 1.0、目標の2倍以上で 0.4。
 * 価格 = max(1, round(basePrice × factor × 方針倍率))。
 * basePrice が 0 のアイテムは価格を持たないため null を返す（買取対象外）。
 */
export function computeMarketPrice(
  item: Item,
  stock: number,
  policy: PricePolicy,
  marketLevel: number = 0,
): number | null {
  if (item.basePrice <= 0) return null;
  const target = targetStock(item, marketLevel);
  const safeStock = Math.max(0, stock);
  const rawFactor = 1 + (target - safeStock) / target;
  const factor = Math.min(1.6, Math.max(0.4, rawFactor));
  const price = Math.round(item.basePrice * factor * PRICE_POLICY_MULTIPLIERS[policy]);
  return Math.max(1, price);
}

/**
 * 全アイテムの市場価格を再計算する（日境界用）。
 * 価格を持たない（basePrice 0）アイテムは結果に含めない。
 */
export function computeAllMarketPrices(
  inventory: Record<string, number>,
  marketLevel: number,
  policy: PricePolicy,
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const item of Object.values(ITEMS)) {
    const price = computeMarketPrice(item, inventory[item.id] ?? 0, policy, marketLevel);
    if (price !== null) {
      prices[item.id] = price;
    }
  }
  return prices;
}
