import { describe, it, expect } from "vitest";

import type { MarketTrend, Town } from "../types/game";
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
    friendship: 0,
    level: 1,
    description: "",
    specialties: [],
    demands: [],
    investCost: 500,
    investLevel: 1,
    isUnlocked: true,
    ...overrides,
  };
}

describe("tradeHelpers", () => {
  describe("getImportPrice", () => {
    it("友好度Lv1・割引0の場合、basePriceの3倍であること", () => {
      // potion: basePrice 10 → 30
      expect(getImportPrice("potion", makeTown({ level: 1 }), 0)).toBe(30);
    });

    it("友好度Lv3・ソウル割引2の場合、30%引きになること", () => {
      // 10 * 3 = 30, rate = 1 - 2*0.05 - 2*0.05 = 0.8 → 24
      expect(getImportPrice("potion", makeTown({ level: 3 }), 2)).toBe(24);
    });

    it("友好度Lv5・ソウル割引5の場合、最低1Gになること", () => {
      // wheat: basePrice 1 → 3, rate = 1 - 4*0.05 - 5*0.05 = 0.55 → floor(1.65) = 1
      expect(getImportPrice("wheat", makeTown({ level: 5 }), 5)).toBe(1);
    });

    it("存在しないアイテムIDの場合は0を返すこと", () => {
      expect(getImportPrice("nonexistent_item", makeTown(), 0)).toBe(0);
    });
  });

  describe("calculateExportEstimates", () => {
    it("トレンドなしの場合、市場ボーナスと友好度ボーナスが乗算されること", () => {
      // potion x5, town.level=1, marketLvl=1
      // price=10, marketBonus=0.1, friendshipBonus=0
      // finalPrice = floor(floor(10 * 1.1) * 5) = floor(11 * 5) = 55
      const result = calculateExportEstimates(makeTown({ level: 1 }), { potion: 5 }, 1, null);
      expect(result.gold).toBe(55);
      expect(result.friendship).toBe(5);
      expect(result.count).toBe(5);
    });

    it("需要トレンド一致の場合、倍率適用後にボーナスが乗算されること", () => {
      // potion x5, town.level=1, marketLvl=1, trend 1.2x
      // price = floor(10 * 1.2) = 12
      // finalPrice = floor(floor(12 * 1.1) * 5) = floor(13 * 5) = 65
      // friendship = 5 * 2 = 10
      const trend: MarketTrend = {
        targetTownId: "komorebi",
        itemId: "potion",
        type: "demand",
        multiplier: 1.2,
      };
      const result = calculateExportEstimates(makeTown({ level: 1 }), { potion: 5 }, 1, trend);
      expect(result.gold).toBe(65);
      expect(result.friendship).toBe(10);
    });

    it("トレンドが別の街を指している場合、倍率は適用されないこと", () => {
      const trend: MarketTrend = {
        targetTownId: "ironport",
        itemId: "potion",
        type: "demand",
        multiplier: 2.0,
      };
      const result = calculateExportEstimates(
        makeTown({ id: "komorebi" }),
        { potion: 5 },
        1,
        trend,
      );
      expect(result.gold).toBe(55);
      expect(result.friendship).toBe(5);
    });

    it("友好度Lv3の場合、友好度ボーナス15%が加算されること", () => {
      // potion x5, town.level=3, marketLvl=1
      // marketBonus=0.1, friendshipBonus=0.1
      // finalPrice = floor(floor(10 * 1.2) * 5) = floor(12 * 5) = 60
      const result = calculateExportEstimates(makeTown({ level: 3 }), { potion: 5 }, 1, null);
      expect(result.gold).toBe(60);
    });

    it("複数アイテムを同時に輸出した場合、それぞれの売却額が合算されること", () => {
      // potion x5: floor(floor(10*1.1)*5)=55
      // iron_ingot x2 (basePrice 12): floor(floor(12*1.1)*2)=floor(13*2)=26
      // total = 81, count = 7
      const result = calculateExportEstimates(
        makeTown({ level: 1 }),
        { potion: 5, iron_ingot: 2 },
        1,
        null,
      );
      expect(result.gold).toBe(81);
      expect(result.count).toBe(7);
    });

    it("存在しないアイテムや個数0以下のアイテムは除外されること", () => {
      const result = calculateExportEstimates(
        makeTown({ level: 1 }),
        { potion: 5, nonexistent_item: 10, wheat: 0 },
        1,
        null,
      );
      expect(result.count).toBe(5);
    });
  });

  describe("calculateImportEstimates", () => {
    it("複数アイテムの仕入れ総額と積載量が合算されること", () => {
      // potion: basePrice 10, town.level=1, discount=0 → importPrice 30, x2 = 60
      // wheat: basePrice 1, town.level=1, discount=0 → importPrice 3, x5 = 15
      // total = 75, count = 7
      const result = calculateImportEstimates(makeTown({ level: 1 }), { potion: 2, wheat: 5 }, 0);
      expect(result.gold).toBe(75);
      expect(result.count).toBe(7);
    });

    it("個数0以下のアイテムは除外されること", () => {
      const result = calculateImportEstimates(makeTown({ level: 1 }), { potion: 0, wheat: -1 }, 0);
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
