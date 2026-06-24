import { describe, it, expect } from "vitest";

import { getTownShopItems, getInvestCost } from "./towns";

describe("towns", () => {
  describe("getTownShopItems", () => {
    it("コモレビ村は全てのアイテム9種を販売すること", () => {
      const items = getTownShopItems("komorebi");
      expect(items).toEqual([
        "wheat",
        "vegetable",
        "raw_meat",
        "wood",
        "herb",
        "wood_plank",
        "leather_cloak",
        "ancient_bark",
        "elixir",
      ]);
    });

    it("港町アイアンポートは全てのアイテム9種を販売すること", () => {
      const items = getTownShopItems("ironport");
      expect(items).toEqual([
        "copper_ore",
        "iron_ore",
        "iron_ingot",
        "iron_sword",
        "iron_armor",
        "silver_ore",
        "silver_ingot",
        "silver_rapier",
        "silver_chainmail",
      ]);
    });

    it("魔法都市マギカは全てのアイテム9種を販売すること", () => {
      const items = getTownShopItems("magica");
      expect(items).toEqual([
        "crystal_fragment",
        "mana_stone",
        "stamina_drink",
        "potion",
        "mid_potion",
        "dark_crystal",
        "wooden_staff",
        "mythril_staff",
        "mythril_robe",
      ]);
    });

    it("存在しない街IDの場合は空配列を返すこと", () => {
      expect(getTownShopItems("unknown")).toEqual([]);
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
