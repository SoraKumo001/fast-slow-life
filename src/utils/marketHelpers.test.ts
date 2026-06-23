import { describe, it, expect } from "vitest";

import { getSlotsForLevel, getMarketSellBonus, getSellBonus } from "./marketHelpers";

describe("marketHelpers", () => {
  describe("getSlotsForLevel", () => {
    it("レベル0の場合は0を返すこと", () => {
      expect(getSlotsForLevel(0)).toBe(0);
    });

    it("レベル1の場合は2を返すこと", () => {
      expect(getSlotsForLevel(1)).toBe(2);
    });

    it("レベル2の場合は4を返すこと", () => {
      expect(getSlotsForLevel(2)).toBe(4);
    });

    it("レベル3以上の場合は8を返すこと", () => {
      expect(getSlotsForLevel(3)).toBe(8);
      expect(getSlotsForLevel(5)).toBe(8);
    });
  });

  describe("getMarketSellBonus", () => {
    it("レベル0の場合は0.3を返すこと（未建設でも最大ボーナス相当）", () => {
      expect(getMarketSellBonus(0)).toBe(0.3);
    });

    it("レベル1の場合は0.1を返すこと", () => {
      expect(getMarketSellBonus(1)).toBe(0.1);
    });

    it("レベル2の場合は0.2を返すこと", () => {
      expect(getMarketSellBonus(2)).toBe(0.2);
    });

    it("レベル3以上の場合は0.3を返すこと", () => {
      expect(getMarketSellBonus(3)).toBe(0.3);
      expect(getMarketSellBonus(5)).toBe(0.3);
    });
  });

  describe("getSellBonus", () => {
    it("交易所レベル0の場合は0.3を返すこと", () => {
      expect(getSellBonus("consumable", { market: { level: 0 } })).toBe(0.3);
    });

    it("交易所レベル1の場合は0.1を返すこと", () => {
      expect(getSellBonus("consumable", { market: { level: 1 } })).toBe(0.1);
    });

    it("交易所レベル2の場合は0.2を返すこと", () => {
      expect(getSellBonus("consumable", { market: { level: 2 } })).toBe(0.2);
    });

    it("marketが未定義の場合はレベル0相当の0.3を返すこと", () => {
      expect(getSellBonus("consumable", { market: undefined as never })).toBe(0.3);
    });
  });
});
