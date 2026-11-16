import { describe, it, expect } from "vitest";

import { ITEMS } from "../data/masterData";
import type { Item } from "../types/game";
import { computeAllMarketPrices, computeMarketPrice, targetStock } from "./market";

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
  it("カテゴリ別の基礎値: food=20, 素材系=30, その他=10", () => {
    expect(targetStock(makeItem({ category: "food" }), 0)).toBe(20);
    expect(targetStock(makeItem({ category: "material" }), 0)).toBe(30);
    expect(targetStock(makeItem({ category: "ore" }), 0)).toBe(30);
    expect(targetStock(makeItem({ category: "herb" }), 0)).toBe(30);
    expect(targetStock(makeItem({ category: "mana_stone" }), 0)).toBe(30);
    expect(targetStock(makeItem({ category: "gear_weapon" }), 0)).toBe(10);
    expect(targetStock(makeItem({ category: "gear_armor" }), 0)).toBe(10);
    expect(targetStock(makeItem({ category: "consumable" }), 0)).toBe(10);
  });

  it("交易所レベルで +5/レベル 増える", () => {
    expect(targetStock(makeItem({ category: "food" }), 1)).toBe(25);
    expect(targetStock(makeItem({ category: "material" }), 3)).toBe(45);
    expect(targetStock(makeItem({ category: "consumable" }), 5)).toBe(35);
  });
});

describe("market.computeMarketPrice", () => {
  it("在庫が目標どおりなら basePrice × 方針倍率", () => {
    const item = makeItem({ category: "material", basePrice: 100 }); // target 30 (Lv0)
    expect(computeMarketPrice(item, 30, "standard")).toBe(100);
    expect(computeMarketPrice(item, 30, "cheap")).toBe(80);
    expect(computeMarketPrice(item, 30, "premium")).toBe(125);
  });

  it("在庫0なら係数 1.6 で上限クランプされる", () => {
    const item = makeItem({ category: "material", basePrice: 100 });
    expect(computeMarketPrice(item, 0, "standard")).toBe(160);
  });

  it("在庫が目標の2倍以上なら係数 0.4 で下限クランプされる", () => {
    const item = makeItem({ category: "material", basePrice: 100 }); // target 30
    expect(computeMarketPrice(item, 60, "standard")).toBe(40);
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
    const lv0 = computeMarketPrice(item, 30, "standard", 0); // target 30 → factor 1.0
    const lv5 = computeMarketPrice(item, 30, "standard", 5); // target 55 → factor 1 + 25/55
    expect(lv0).toBe(100);
    expect(lv5).toBe(145);
  });

  it("決定性: 同じ入力では常に同じ価格", () => {
    const item = makeItem({ category: "food", basePrice: 37 });
    const a = computeMarketPrice(item, 7, "premium", 2);
    const b = computeMarketPrice(item, 7, "premium", 2);
    expect(a).toBe(b);
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
