import { describe, it, expect } from "vitest";

import type { Caravan, Facility, FacilityType, Town } from "../types/game";
import { processAutoTrade } from "./autoTradeHelper";

function makeTown(overrides: Partial<Town> = {}): Town {
  return {
    id: "komorebi",
    name: "コモレビ村",
    distance: 12,
    description: "",
    investCost: 500,
    investLevel: 1,
    isUnlocked: true,
    ...overrides,
  };
}

function makeCaravan(overrides: Partial<Caravan> = {}): Caravan {
  return {
    id: "caravan_1",
    status: "idle",
    destinationTownId: null,
    type: null,
    timeLeft: 0,
    totalTime: 0,
    cargo: [],
    goldCost: 0,
    goldEarned: 0,
    isAuto: false,
    ...overrides,
  };
}

function makeMarketFacility(level: number) {
  return { market: { level } } as unknown as Record<FacilityType, Facility>;
}

describe("autoTradeHelper", () => {
  describe("processAutoTrade", () => {
    it("交易所レベル0の場合は何も実行されないこと", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(0),
        tradeRules: [],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown()],
      });

      expect(result.gold).toBe(100);
      expect(result.inventory.potion).toBe(15);
      expect(result.caravans[0].status).toBe("idle");
    });

    it("閾値超過のアイテムが馬車に積載され派遣されること", () => {
      // potion basePrice=10, threshold=10, excess=5
      // marketLvl=1, marketBonus=0.1
      // finalPrice = floor(10*1.1)*5 = 55
      // totalTime = max(1, ceil(12*1)) = 12
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown()],
      });

      expect(result.inventory.potion).toBe(10);
      expect(result.caravans[0].status).toBe("trading");
      expect(result.caravans[0].destinationTownId).toBe("komorebi");
      expect(result.caravans[0].goldEarned).toBe(55);
      expect(result.caravans[0].timeLeft).toBe(12);
    });

    it("市場ボーナスが適用された価格で売却されること", () => {
      // potion basePrice=10, marketLvl=1, marketBonus=0.1
      // finalPrice = floor(10*1.1)*5 = 55
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown()],
      });

      expect(result.caravans[0].goldEarned).toBe(55);
    });

    it("積載上限を超える場合は上限まで積載されること", () => {
      // investLevel=1 → cargoLimit=15
      // excess=20, 15個だけ積載
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 30 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown({ investLevel: 1 })],
      });

      expect(result.caravans[0].cargo[0].count).toBe(15);
      expect(result.inventory.potion).toBe(15);
    });

    it("投資Lv3の場合、積載上限が35になること", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 0,
            isEnabled: true,
          },
        ],
        inventory: { potion: 40 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown({ investLevel: 3 })],
      });

      expect(result.caravans[0].cargo[0].count).toBe(35);
    });

    it("複数街がある場合、先頭の街が選択されること", () => {
      // 両方の街で calcExportPrice は同一（marketLvlのみ依存）
      // potion x5 → floor(10*1.1)*5 = 55
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [
          makeTown({ id: "komorebi", name: "コモレビ村", distance: 12 }),
          makeTown({
            id: "ironport",
            name: "港町アイアンポート",
            distance: 24,
          }),
        ],
      });

      expect(result.caravans[0].destinationTownId).toBe("komorebi");
      expect(result.caravans[0].goldEarned).toBe(55);
    });

    it("高価品が優先的に積載されること", () => {
      // potion basePrice=10, wheat basePrice=1
      // sortedCandidates: potion > wheat
      // cargoLimit=15, potion excess=20 → potion 15個
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 0,
            isEnabled: true,
          },
          {
            id: "r2",
            itemId: "wheat",
            type: "sell",
            threshold: 0,
            isEnabled: true,
          },
        ],
        inventory: { potion: 20, wheat: 20 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown()],
      });

      expect(result.caravans[0].cargo).toHaveLength(1);
      expect(result.caravans[0].cargo[0].itemId).toBe("potion");
      expect(result.caravans[0].cargo[0].count).toBe(15);
    });

    it("アンロックされていない街は選択されないこと", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown({ id: "ironport", isUnlocked: false })],
      });

      expect(result.caravans[0].status).toBe("idle");
    });

    it("idle以外の馬車は派遣されないこと", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan({ status: "trading" })],
        towns: [makeTown()],
      });

      expect(result.inventory.potion).toBe(15);
    });

    it("無効化されたtradeRuleはスキップされること", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: false,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown()],
      });

      expect(result.caravans[0].status).toBe("idle");
      expect(result.inventory.potion).toBe(15);
    });

    it("交易所レベル2の場合、2台の馬車が派遣されること", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(2),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 40 },
        gold: 100,
        caravans: [makeCaravan({ id: "caravan_1" }), makeCaravan({ id: "caravan_2" })],
        towns: [makeTown({ investLevel: 1 })],
      });

      // cargoLimit=15, excess=30
      // 1台目: 15個積載
      // 2台目: 残り15個積載
      expect(result.caravans[0].status).toBe("trading");
      expect(result.caravans[1].status).toBe("trading");
      expect(result.caravans[0].cargo[0].count).toBe(15);
      expect(result.caravans[1].cargo[0].count).toBe(15);
    });

    it("投資Lvによる交易時間短縮が反映されること", () => {
      // investLevel=3 → timeReduction=min(0.5, 2*0.1)=0.2
      // totalTime=max(1, ceil(12*0.8))=ceil(9.6)=10
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown({ investLevel: 3, distance: 12 })],
      });

      expect(result.caravans[0].timeLeft).toBe(10);
    });

    it("派遣ログが出力されること", () => {
      const result = processAutoTrade({
        facilities: makeMarketFacility(1),
        tradeRules: [
          {
            id: "r1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
        inventory: { potion: 15 },
        gold: 100,
        caravans: [makeCaravan()],
        towns: [makeTown({ name: "コモレビ村" })],
      });

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("コモレビ村");
      expect(result.logs[0].message).toContain("自動交易");
    });
  });
});
