import { describe, it, expect } from "vitest";

import type { Town } from "../types/game";
import {
  getImportPrice,
  calculateExportEstimates,
  calculateImportEstimates,
  getCargoLimit,
} from "./tradeHelpers";

function makeTown(overrides: Partial<Town> = {}): Town {
  return {
    id: "komorebi",
    name: "コモレビ村",
    distance: 12,
    description: "",
    specialties: [],
    investCost: 500,
    investLevel: 1,
    isUnlocked: true,
    ...overrides,
  };
}

describe("tradeHelpers", () => {
  describe("getImportPrice", () => {
    it("割引0の場合、basePriceの3倍であること", () => {
      // potion: basePrice 10 → 30
      expect(getImportPrice("potion", makeTown(), 0)).toBe(30);
    });

    it("ソウル割引2の場合、10%引きになること", () => {
      // 10 * 3 = 30, rate = 1 - 2*0.05 = 0.9 → 27
      expect(getImportPrice("potion", makeTown(), 2)).toBe(27);
    });

    it("ソウル割引5の場合、最低1Gになること", () => {
      // wheat: basePrice 1 → 3, rate = 1 - 5*0.05 = 0.75 → floor(2.25) = 2
      expect(getImportPrice("wheat", makeTown(), 5)).toBe(2);
    });

    it("存在しないアイテムIDの場合は0を返すこと", () => {
      expect(getImportPrice("nonexistent_item", makeTown(), 0)).toBe(0);
    });
  });

  describe("calculateExportEstimates", () => {
    it("市場ボーナスのみ乗算されること", () => {
      // potion x5, marketLvl=1
      // price=10, marketBonus=0.1
      // finalPrice = floor(10 * 1.1) * 5 = floor(11) * 5 = 55
      const result = calculateExportEstimates(makeTown(), { potion: 5 }, 1);
      expect(result.gold).toBe(55);
      expect(result.count).toBe(5);
    });

    it("複数アイテムを同時に輸出した場合、それぞれの売却額が合算されること", () => {
      // potion x5: floor(10*1.1)*5=55
      // iron_ingot x2 (basePrice 12): floor(12*1.1)*2=floor(13)*2=26
      // total = 81, count = 7
      const result = calculateExportEstimates(makeTown(), { potion: 5, iron_ingot: 2 }, 1);
      expect(result.gold).toBe(81);
      expect(result.count).toBe(7);
    });

    it("存在しないアイテムや個数0以下のアイテムは除外されること", () => {
      const result = calculateExportEstimates(
        makeTown(),
        { potion: 5, nonexistent_item: 10, wheat: 0 },
        1,
      );
      expect(result.count).toBe(5);
    });
  });

  describe("calculateImportEstimates", () => {
    it("複数アイテムの仕入れ総額と積載量が合算されること", () => {
      // potion: basePrice 10, discount=0 → importPrice 30, x2 = 60
      // wheat: basePrice 1, discount=0 → importPrice 3, x5 = 15
      // total = 75, count = 7
      const result = calculateImportEstimates(makeTown(), { potion: 2, wheat: 5 }, 0);
      expect(result.gold).toBe(75);
      expect(result.count).toBe(7);
    });

    it("個数0以下のアイテムは除外されること", () => {
      const result = calculateImportEstimates(makeTown(), { potion: 0, wheat: -1 }, 0);
      expect(result.gold).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe("getCargoLimit", () => {
    it("投資Lv1の場合は15であること", () => {
      expect(getCargoLimit(makeTown({ investLevel: 1 }))).toBe(15);
    });

    it("投資Lv3の場合は35であること", () => {
      expect(getCargoLimit(makeTown({ investLevel: 3 }))).toBe(35);
    });

    it("投資Lv6の場合は65であること", () => {
      expect(getCargoLimit(makeTown({ investLevel: 6 }))).toBe(65);
    });
  });
});
