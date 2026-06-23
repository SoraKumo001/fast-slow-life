import { describe, it, expect } from "vitest";

import {
  getFriendshipLevel,
  getFriendshipThreshold,
  getTownShopItems,
  getInvestCost,
} from "./towns";

describe("towns", () => {
  describe("getFriendshipLevel", () => {
    it("友好度0の場合はLv1であること", () => {
      expect(getFriendshipLevel(0)).toBe(1);
    });

    it("友好度99の場合はLv1であること", () => {
      expect(getFriendshipLevel(99)).toBe(1);
    });

    it("友好度100の場合はLv2であること", () => {
      expect(getFriendshipLevel(100)).toBe(2);
    });

    it("友好度299の場合はLv2であること", () => {
      expect(getFriendshipLevel(299)).toBe(2);
    });

    it("友好度300の場合はLv3であること", () => {
      expect(getFriendshipLevel(300)).toBe(3);
    });

    it("友好度600の場合はLv4であること", () => {
      expect(getFriendshipLevel(600)).toBe(4);
    });

    it("友好度900の場合はLv5であること", () => {
      expect(getFriendshipLevel(900)).toBe(5);
    });

    it("友好度1000の場合はLv5であること", () => {
      expect(getFriendshipLevel(1000)).toBe(5);
    });
  });

  describe("getFriendshipThreshold", () => {
    it("Lv1の閾値は100であること", () => {
      expect(getFriendshipThreshold(1)).toBe(100);
    });

    it("Lv2の閾値は300であること", () => {
      expect(getFriendshipThreshold(2)).toBe(300);
    });

    it("Lv3の閾値は600であること", () => {
      expect(getFriendshipThreshold(3)).toBe(600);
    });

    it("Lv4の閾値は900であること", () => {
      expect(getFriendshipThreshold(4)).toBe(900);
    });

    it("Lv5以上の閾値は9999であること", () => {
      expect(getFriendshipThreshold(5)).toBe(9999);
    });
  });

  describe("getTownShopItems", () => {
    it("コモレビ村Lv1は基本食材5種を販売すること", () => {
      const items = getTownShopItems("komorebi", 1);
      expect(items).toEqual(["wheat", "vegetable", "raw_meat", "wood", "herb"]);
    });

    it("コモレビ村Lv3は木板と革マントが追加されること", () => {
      const items = getTownShopItems("komorebi", 3);
      expect(items).toContain("wood_plank");
      expect(items).toContain("leather_cloak");
      expect(items).toHaveLength(7);
    });

    it("コモレビ村Lv5は古代樹皮とエリクサーが追加されること", () => {
      const items = getTownShopItems("komorebi", 5);
      expect(items).toContain("ancient_bark");
      expect(items).toContain("elixir");
      expect(items).toHaveLength(9);
    });

    it("港町アイアンポートLv1は銅鉱石と鉄鉱石を販売すること", () => {
      const items = getTownShopItems("ironport", 1);
      expect(items).toEqual(["copper_ore", "iron_ore"]);
    });

    it("港町アイアンポートLv3は鉄の剣と鉄の鎧が追加されること", () => {
      const items = getTownShopItems("ironport", 3);
      expect(items).toContain("iron_sword");
      expect(items).toContain("iron_armor");
    });

    it("魔法都市マギカLv2は魔力石とスタミナドリンクが追加されること", () => {
      const items = getTownShopItems("magica", 2);
      expect(items).toContain("mana_stone");
      expect(items).toContain("stamina_drink");
    });

    it("魔法都市マギカLv5はミスリルの杖とミスリルローブが追加されること", () => {
      const items = getTownShopItems("magica", 5);
      expect(items).toContain("mythril_staff");
      expect(items).toContain("mythril_robe");
    });

    it("存在しない街IDの場合は空配列を返すこと", () => {
      expect(getTownShopItems("unknown", 5)).toEqual([]);
    });
  });

  describe("getInvestCost", () => {
    it("Lv1の投資コストは500Gであること", () => {
      expect(getInvestCost(1)).toBe(500);
    });

    it("Lv2の投資コストは1000Gであること", () => {
      expect(getInvestCost(2)).toBe(1000);
    });

    it("Lv3の投資コストは2000Gであること", () => {
      expect(getInvestCost(3)).toBe(2000);
    });

    it("Lv4の投資コストは4000Gであること", () => {
      expect(getInvestCost(4)).toBe(4000);
    });

    it("Lv5の投資コストは8000Gであること", () => {
      expect(getInvestCost(5)).toBe(8000);
    });
  });
});
