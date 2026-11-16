import { describe, it, expect } from "vitest";

import { ITEMS } from "../data/masterData";
import type { Item } from "../types/game";
import {
  computeAllMarketPrices,
  computeMarketPrice,
  demandFactor,
  listDemandShortages,
  targetStock,
} from "./market";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test_item",
    name: "テストアイテム",
    category: "material",
    basePrice: 100,
    difficulty: 1.0,
    ...overrides,
  };
}

describe("market.targetStock", () => {
  it("カテゴリ別の基礎値: food=40, 素材系=15, その他=6 (Phase 5 レバー2/3)", () => {
    expect(targetStock(makeItem({ category: "food" }), 0)).toBe(40);
    expect(targetStock(makeItem({ category: "material" }), 0)).toBe(15);
    expect(targetStock(makeItem({ category: "ore" }), 0)).toBe(15);
    expect(targetStock(makeItem({ category: "herb" }), 0)).toBe(15);
    expect(targetStock(makeItem({ category: "mana_stone" }), 0)).toBe(15);
    expect(targetStock(makeItem({ category: "gear_weapon" }), 0)).toBe(6);
    expect(targetStock(makeItem({ category: "gear_armor" }), 0)).toBe(6);
    expect(targetStock(makeItem({ category: "consumable" }), 0)).toBe(6);
  });

  it("交易所レベルで +5/レベル 増える", () => {
    expect(targetStock(makeItem({ category: "food" }), 1)).toBe(45);
    expect(targetStock(makeItem({ category: "material" }), 3)).toBe(30);
    expect(targetStock(makeItem({ category: "consumable" }), 5)).toBe(31);
  });
});

describe("market.computeMarketPrice", () => {
  it("在庫が目標どおりなら basePrice × 方針倍率", () => {
    const item = makeItem({ category: "material", basePrice: 100 }); // target 15 (Lv0)
    expect(computeMarketPrice(item, 15, "standard")).toBe(100);
    expect(computeMarketPrice(item, 15, "cheap")).toBe(80);
    expect(computeMarketPrice(item, 15, "premium")).toBe(125);
  });

  it("在庫0なら係数 1.6 で上限クランプされる", () => {
    const item = makeItem({ category: "material", basePrice: 100 });
    expect(computeMarketPrice(item, 0, "standard")).toBe(160);
  });

  it("在庫が目標の2倍以上なら係数 0.4 で下限クランプされる", () => {
    const item = makeItem({ category: "material", basePrice: 100 }); // target 15
    expect(computeMarketPrice(item, 30, "standard")).toBe(40);
    expect(computeMarketPrice(item, 300, "standard")).toBe(40);
  });

  it("在庫が増えると価格は単調に下がる（または同値）", () => {
    const item = makeItem({ category: "material", basePrice: 100 });
    let prev = Infinity;
    for (let stock = 0; stock <= 90; stock += 3) {
      const price = computeMarketPrice(item, stock, "standard")!;
      expect(price).toBeLessThanOrEqual(prev);
      prev = price;
    }
  });

  it("価格は最低 1G", () => {
    const item = makeItem({ category: "material", basePrice: 1 });
    expect(computeMarketPrice(item, 1000, "cheap")).toBe(1);
  });

  it("basePrice 0 のアイテムは価格を持たない (null)", () => {
    expect(computeMarketPrice(makeItem({ basePrice: 0 }), 0, "standard")).toBeNull();
  });

  it("交易所レベルが上がると目標在庫が増え、同在庫でも価格が上がる", () => {
    const item = makeItem({ category: "material", basePrice: 100 });
    const lv0 = computeMarketPrice(item, 15, "standard", 0); // target 15 → factor 1.0
    const lv5 = computeMarketPrice(item, 15, "standard", 5); // target 40 → factor 1 + 25/40 → 1.6 クランプ
    expect(lv0).toBe(100);
    expect(lv5).toBe(160);
  });

  it("決定性: 同じ入力では常に同じ価格", () => {
    const item = makeItem({ category: "food", basePrice: 37 });
    const a = computeMarketPrice(item, 7, "premium", 2);
    const b = computeMarketPrice(item, 7, "premium", 2);
    expect(a).toBe(b);
  });
});

describe("market.demandFactor (Phase 5 需要係数)", () => {
  it("目標未設定 (target <= 0) なら常に 1.0", () => {
    expect(demandFactor(0, 0)).toBe(1);
    expect(demandFactor(10, 0)).toBe(1);
    expect(demandFactor(0, -5)).toBe(1);
  });

  it("在庫が目標以上なら 1.0（下げ方向には働かない）", () => {
    expect(demandFactor(30, 30)).toBe(1);
    expect(demandFactor(45, 30)).toBe(1);
    expect(demandFactor(300, 30)).toBe(1);
  });

  it("在庫 0 なら最大の 1.3", () => {
    expect(demandFactor(0, 30)).toBeCloseTo(1.3);
    expect(demandFactor(0, 1)).toBeCloseTo(1.3);
  });

  it("部分的な不足は不足率に比例する", () => {
    expect(demandFactor(15, 30)).toBeCloseTo(1.15); // 不足率 0.5
    expect(demandFactor(20, 30)).toBeCloseTo(1.1); // 不足率 1/3
    expect(demandFactor(27, 30)).toBeCloseTo(1.03); // 不足率 0.1
  });

  it("computeMarketPrice に需要係数が乗る", () => {
    const item = makeItem({ category: "material", basePrice: 100 }); // scarcity target 15
    // 在庫15 = 希少性係数 1.0。プレイヤー目標 30 なら需要係数 1.15
    expect(computeMarketPrice(item, 15, "standard", 0, 30)).toBe(115);
    // プレイヤー目標が未設定なら従来どおり
    expect(computeMarketPrice(item, 15, "standard", 0, 0)).toBe(100);
    expect(computeMarketPrice(item, 15, "standard", 0)).toBe(100);
    // 在庫がプレイヤー目標以上なら需要係数は付かない
    expect(computeMarketPrice(item, 15, "standard", 0, 15)).toBe(100);
    expect(computeMarketPrice(item, 15, "standard", 0, 10)).toBe(100);
  });

  it("computeAllMarketPrices に targetAmounts が伝わる", () => {
    const withTarget = computeAllMarketPrices({ wheat: 0 }, 0, "standard", { wheat: 30 });
    expect(withTarget.wheat).toBe(computeMarketPrice(ITEMS.wheat, 0, "standard", 0, 30));
    // 高額アイテムでは需要係数ぶんの値上がりが価格に表れる
    const priced = computeAllMarketPrices({ herb: 0 }, 0, "standard", { herb: 40 });
    const plain = computeAllMarketPrices({ herb: 0 }, 0, "standard");
    expect(priced.herb).toBeGreaterThan(plain.herb);
  });
});

describe("market.listDemandShortages (Phase 5 需要ボード)", () => {
  it("目標未設定のアイテムは含めない", () => {
    const entries = listDemandShortages({ wheat: 0 }, {});
    expect(entries).toHaveLength(0);
    const withZero = listDemandShortages({ wheat: 0 }, { wheat: 0 });
    expect(withZero).toHaveLength(0);
  });

  it("不足率の大きい順に並ぶ（同率なら不足数→名前順）", () => {
    const entries = listDemandShortages(
      { wheat: 0, wood: 5, herb: 25, stone: 0 },
      { wheat: 30, wood: 10, herb: 30, stone: 10 },
    );
    // wheat: 不足率 1.0 / 不足30、stone: 不足率 1.0 / 不足10 → wheat が先
    // wood: 不足率 0.5、herb: 不足率 約0.167
    expect(entries.map((e) => e.item.id)).toEqual(["wheat", "stone", "wood", "herb"]);
    expect(entries[0].shortage).toBe(30);
    expect(entries[0].shortfall).toBeCloseTo(1);
    expect(entries[0].demandFactor).toBeCloseTo(1.3);
  });

  it("在庫が目標以上のアイテムは不足率 0 で末尾に残る", () => {
    const entries = listDemandShortages(
      { wheat: 50, wood: 0 },
      { wheat: 30, wood: 10 },
    );
    expect(entries.map((e) => e.item.id)).toEqual(["wood", "wheat"]);
    const wheat = entries[1];
    expect(wheat.shortage).toBe(0);
    expect(wheat.shortfall).toBe(0);
    expect(wheat.demandFactor).toBe(1);
  });

  it("在庫は整数化され、負数にならない", () => {
    const entries = listDemandShortages({ wheat: 3.7 }, { wheat: 10 });
    expect(entries[0].stock).toBe(3);
    expect(entries[0].shortage).toBe(7);
  });
});

describe("market.computeAllMarketPrices", () => {
  it("全アイテム分を再計算し、basePrice 0 のアイテムは含めない", () => {
    const prices = computeAllMarketPrices({}, 0, "standard");
    for (const item of Object.values(ITEMS)) {
      if (item.basePrice > 0) {
        expect(prices[item.id]).toBe(computeMarketPrice(item, 0, "standard", 0));
      } else {
        expect(prices[item.id]).toBeUndefined();
      }
    }
  });

  it("在庫のあるアイテムは在庫なしより安くなる", () => {
    const empty = computeAllMarketPrices({}, 0, "standard");
    const stocked = computeAllMarketPrices({ wheat: 30 }, 0, "standard");
    expect(stocked.wheat).toBeLessThan(empty.wheat);
  });
});
