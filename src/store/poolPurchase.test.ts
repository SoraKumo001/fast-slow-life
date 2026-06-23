import { describe, it, expect } from "vitest";

import type { RunStats, Villager } from "../types/game";
import { processItemAcquisition, processItemPoolPurchase } from "./poolPurchase";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
    gold: 0,
    pool: {},
    ...overrides,
  } as Villager;
}

function makeStats(): RunStats {
  return {
    totalGoldFromExports: 0,
    totalGoldSpentOnImports: 0,
    totalItemsGathered: 0,
    totalMonstersDefeated: 0,
    totalBossesDefeated: 0,
    totalItemsCrafted: 0,
    totalGoldFromPurchases: 0,
    totalItemsPurchased: 0,
    totalGoldFromTax: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    totalCriticalHits: 0,
    totalAttacksLanded: 0,
    totalAttacksAttempted: 0,
    totalPotionHealing: 0,
  };
}

describe("poolPurchase", () => {
  describe("processItemPoolPurchase", () => {
    it("単一村人の単一アイテムpoolを精算すること", () => {
      // wheat basePrice=1, pool={wheat: 6}, gold=100
      // cost = 6 * 1 = 6, nextGold = 94, v.gold = 6
      const v = makeVillager({ id: "v1", pool: { wheat: 6 } });
      const result = processItemPoolPurchase(100, { wheat: 5 }, [v]);

      expect(result.gold).toBe(94);
      expect(result.inventory.wheat).toBe(11);
      expect(result.villagers[0].gold).toBe(6);
      expect(result.villagers[0].pool.wheat).toBeUndefined();
    });

    it("複数村人の複数アイテムpoolを一括精算すること", () => {
      // v1: pool={wheat: 3, potion: 1}, gold=0
      //   wheat cost=3*1=3, potion cost=1*10=10, total=13, v1.gold=13
      // v2: pool={potion: 2}, gold=10
      //   potion cost=2*10=20, v2.gold=30
      // nextGold = 100 - 13 - 20 = 67
      const v1 = makeVillager({ id: "v1", pool: { wheat: 3, potion: 1 } });
      const v2 = makeVillager({ id: "v2", gold: 10, pool: { potion: 2 } });
      const result = processItemPoolPurchase(100, { wheat: 0, potion: 0 }, [v1, v2]);

      expect(result.gold).toBe(67);
      expect(result.inventory.wheat).toBe(3);
      expect(result.inventory.potion).toBe(3);
      expect(result.villagers[0].gold).toBe(13);
      expect(result.villagers[1].gold).toBe(30);
      expect(result.villagers[0].pool.wheat).toBeUndefined();
      expect(result.villagers[0].pool.potion).toBeUndefined();
      expect(result.villagers[1].pool.potion).toBeUndefined();
    });

    it("存在しないアイテムIDはスキップされること", () => {
      const v = makeVillager({ pool: { nonexistent_item: 5 } });
      const result = processItemPoolPurchase(100, {}, [v]);

      expect(result.gold).toBe(100);
      expect(result.villagers[0].pool.nonexistent_item).toBe(5);
    });

    it("poolの個数が0以下のアイテムはスキップされること", () => {
      const v = makeVillager({ pool: { wheat: 0 } });
      const result = processItemPoolPurchase(100, { wheat: 5 }, [v]);

      expect(result.gold).toBe(100);
      expect(result.inventory.wheat).toBe(5);
    });

    it("statsを渡した場合、totalItemsPurchasedとtotalGoldFromPurchasesが集計されること", () => {
      // v1: wheat x3 (cost 3) + potion x1 (cost 10) → 4 items, 13 gold
      // v2: potion x2 (cost 20) → 2 items, 20 gold
      // total: 6 items, 33 gold
      const v1 = makeVillager({ id: "v1", pool: { wheat: 3, potion: 1 } });
      const v2 = makeVillager({ id: "v2", pool: { potion: 2 } });
      const stats = makeStats();

      processItemPoolPurchase(100, {}, [v1, v2], stats);

      expect(stats.totalItemsPurchased).toBe(6);
      expect(stats.totalGoldFromPurchases).toBe(33);
    });

    it("精算後にログが出力されること", () => {
      const v = makeVillager({ name: "アルフ", pool: { wheat: 3 } });
      const result = processItemPoolPurchase(100, {}, [v]);

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("アルフ");
      expect(result.logs[0].message).toContain("自動買取");
    });
  });

  describe("processItemAcquisition", () => {
    it("全量買取でプレイヤーゴールドが減少し、村人ゴールドが増加すること", () => {
      // wheat basePrice=1, amount=5, playerGold=10
      // cost = 5 * 1 = 5, nextPlayerGold = 5, v.gold = 5
      const v = makeVillager({ gold: 0 });
      const result = processItemAcquisition(v, "wheat", 5, 10, {});

      expect(result.playerGold).toBe(5);
      expect(result.inventory.wheat).toBe(5);
      expect(v.gold).toBe(5);
    });

    it("存在しないアイテムIDの場合は何も変化しないこと", () => {
      const v = makeVillager({ gold: 0 });
      const result = processItemAcquisition(v, "nonexistent_item", 5, 10, { wheat: 3 });

      expect(result.playerGold).toBe(10);
      expect(result.inventory.wheat).toBe(3);
      expect(v.gold).toBe(0);
      expect(result.logs.length).toBe(0);
    });

    it("買取ログが出力されること", () => {
      const v = makeVillager({ name: "アルフ", gold: 0 });
      const result = processItemAcquisition(v, "wheat", 5, 10, {});

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("買取");
      expect(result.logs[0].message).toContain("アルフ");
    });
  });
});
