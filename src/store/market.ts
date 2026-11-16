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
  // Phase 5 バランス再調整 (レバー2): 素材系 30→15, その他 10→6。
  // 典型在庫が目標を上回りやすくなり希少性係数が下がる → 全体価格が下がり、
  // 買取・食料代のフローが細って村人の成長（訓練・転職）が緩やかになる。
  // food はレバー3で 20→40: 料理の在庫が目標に届かず価格が高止まりし、食料代が重くなる。
  if (item.category === "food") return 40;
  if (MATERIAL_CATEGORIES.has(item.category)) return 15;
  return 6;
}

/**
 * 目標在庫: カテゴリ基礎値 + 交易所レベル × 5。
 * 在庫がこの水準にあるとき希少度係数は 1.0 になる。
 */
export function targetStock(item: Item, marketLevel: number): number {
  return baseTargetStock(item) + 5 * Math.max(0, Math.floor(marketLevel));
}

/**
 * 需要係数（経済v2・Phase 5）。
 * プレイヤーが目標個数を設定したアイテムだけに働く:
 *   不足率 = clamp(1 − 在庫 / 目標, 0, 1)
 *   需要係数 = 1 + 0.3 × 不足率（最大 ×1.3、在庫が目標以上なら ×1.0）
 * 目標未設定（targetAmount <= 0）のアイテムは常に ×1.0。下げ方向には働かない。
 */
export function demandFactor(stock: number, targetAmount: number): number {
  if (targetAmount <= 0) return 1;
  const safeStock = Math.max(0, stock);
  const shortfall = Math.min(1, Math.max(0, 1 - safeStock / targetAmount));
  return 1 + 0.3 * shortfall;
}

/**
 * 市場価格を計算する。
 * factor = clamp(1 + (target - stock) / target, 0.4, 1.6)
 *   在庫0で 1.6、目標どおりで 1.0、目標の2倍以上で 0.4。
 * 価格 = max(1, round(basePrice × factor × 方針倍率 × 需要係数))。
 * targetAmount はプレイヤー設定の目標個数（需要係数用、未設定なら 0）。
 * basePrice が 0 のアイテムは価格を持たないため null を返す（買取対象外）。
 */
export function computeMarketPrice(
  item: Item,
  stock: number,
  policy: PricePolicy,
  marketLevel: number = 0,
  targetAmount: number = 0,
): number | null {
  if (item.basePrice <= 0) return null;
  const target = targetStock(item, marketLevel);
  const safeStock = Math.max(0, stock);
  const rawFactor = 1 + (target - safeStock) / target;
  const factor = Math.min(1.6, Math.max(0.4, rawFactor));
  const price = Math.round(
    item.basePrice * factor * PRICE_POLICY_MULTIPLIERS[policy] * demandFactor(stock, targetAmount),
  );
  return Math.max(1, price);
}

/**
 * 全アイテムの市場価格を再計算する（日境界用）。
 * 価格を持たない（basePrice 0）アイテムは結果に含めない。
 * targetAmounts はプレイヤー設定の目標個数（需要係数用）。
 */
export function computeAllMarketPrices(
  inventory: Record<string, number>,
  marketLevel: number,
  policy: PricePolicy,
  targetAmounts: Record<string, number> = {},
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const item of Object.values(ITEMS)) {
    const price = computeMarketPrice(
      item,
      inventory[item.id] ?? 0,
      policy,
      marketLevel,
      targetAmounts[item.id] ?? 0,
    );
    if (price !== null) {
      prices[item.id] = price;
    }
  }
  return prices;
}

/** 需要ボードの1行分（目標設定済みアイテムの不足状況） */
export interface DemandShortage {
  item: Item;
  stock: number;
  target: number;
  /** 不足数 = max(0, target − stock) */
  shortage: number;
  /** 不足率 0..1（在庫が目標以上なら 0） */
  shortfall: number;
  /** 需要係数 1..1.3 */
  demandFactor: number;
}

/**
 * 需要ボード用データ: 目標設定済み（target > 0）アイテムを
 * 不足率の大きい順（同率なら不足数→名前順）に並べる。
 * 在庫が目標以上のアイテムは不足率 0 として末尾に残る。
 */
export function listDemandShortages(
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
): DemandShortage[] {
  const entries: DemandShortage[] = [];
  for (const item of Object.values(ITEMS)) {
    const target = targetAmounts[item.id] ?? 0;
    if (target <= 0) continue;
    const stock = Math.max(0, Math.floor(inventory[item.id] ?? 0));
    const shortage = Math.max(0, target - stock);
    const shortfall = Math.min(1, Math.max(0, 1 - stock / target));
    entries.push({
      item,
      stock,
      target,
      shortage,
      shortfall,
      demandFactor: demandFactor(stock, target),
    });
  }
  entries.sort(
    (a, b) =>
      b.shortfall - a.shortfall ||
      b.shortage - a.shortage ||
      a.item.name.localeCompare(b.item.name, "ja"),
  );
  return entries;
}
