import { describe, it, expect } from "vitest";

import type { Caravan, RunStats, Town } from "../types/game";
import { processCaravanProgress, unlockTownsByTier } from "./caravanProgressHelper";

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

describe("caravanProgressHelper", () => {
  describe("processCaravanProgress", () => {
    it("trading中の馬車のtimeLeftが1減少すること", () => {
      const caravan = makeCaravan({
        status: "trading",
        timeLeft: 5,
        totalTime: 12,
      });
      const result = processCaravanProgress([caravan], [], 100, {}, makeStats());

      expect(result.caravans[0].timeLeft).toBe(4);
      expect(result.caravans[0].status).toBe("trading");
    });

    it("輸出馬車の帰還時にゴールドが増加すること", () => {
      const caravan = makeCaravan({
        status: "trading",
        type: "export",
        destinationTownId: "komorebi",
        timeLeft: 1,
        goldEarned: 60,
      });
      const town = makeTown({ id: "komorebi" });
      const stats = makeStats();
      const result = processCaravanProgress([caravan], [town], 100, {}, stats);

      expect(result.gold).toBe(160);
      expect(result.caravans[0].status).toBe("returned");
      expect(stats.totalGoldFromExports).toBe(60);
    });

    it("輸入馬車の帰還時に在庫が追加されること", () => {
      const caravan = makeCaravan({
        status: "trading",
        type: "import",
        destinationTownId: "komorebi",
        timeLeft: 1,
        cargo: [{ itemId: "potion", count: 2 }],
        goldCost: 30,
      });
      const town = makeTown({ id: "komorebi" });
      const stats = makeStats();
      const result = processCaravanProgress([caravan], [town], 100, { potion: 5 }, stats);

      expect(result.inventory.potion).toBe(7);
      expect(result.caravans[0].status).toBe("returned");
      // B1 修正: 輸入コストの集計は tradeActions.sendImportCaravan（派遣時）の責務。
      // processCaravanProgress は caravan 進行のみを担当し、stats を変更しない。
      expect(stats.totalGoldSpentOnImports).toBe(0);
      expect(result.gold).toBe(100);
    });

    it("輸入馬車の帰還時に stats が増減しないこと（B1 回帰テスト）", () => {
      // B1 修正後の contract: helper は stats を mutate しない。
      // 集計は tradeActions.sendImportCaravan 側の責務。
      const caravan = makeCaravan({
        status: "trading",
        type: "import",
        destinationTownId: "komorebi",
        timeLeft: 1,
        cargo: [{ itemId: "potion", count: 2 }],
        goldCost: 30,
      });
      const town = makeTown({ id: "komorebi" });
      const stats = makeStats();
      const before = { ...stats };

      processCaravanProgress([caravan], [town], 100, { potion: 5 }, stats);

      expect(stats.totalGoldSpentOnImports).toBe(before.totalGoldSpentOnImports);
      expect(stats.totalGoldFromExports).toBe(before.totalGoldFromExports);
    });

    it("目的地の街が見つからない場合はreturnedにリセットされること", () => {
      const caravan = makeCaravan({
        status: "trading",
        type: "export",
        destinationTownId: "unknown",
        timeLeft: 1,
        goldEarned: 60,
      });
      const result = processCaravanProgress([caravan], [], 100, {}, makeStats());

      expect(result.caravans[0].status).toBe("returned");
      expect(result.gold).toBe(100);
    });

    it("帰還ログが出力されること（輸出）", () => {
      const caravan = makeCaravan({
        status: "trading",
        type: "export",
        destinationTownId: "komorebi",
        timeLeft: 1,
        goldEarned: 60,
      });
      const town = makeTown({ id: "komorebi", name: "コモレビ村" });
      const result = processCaravanProgress([caravan], [town], 100, {}, makeStats());

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("コモレビ村");
      expect(result.logs[0].message).toContain("60");
    });

    it("帰還ログが出力されること（輸入）", () => {
      const caravan = makeCaravan({
        status: "trading",
        type: "import",
        destinationTownId: "komorebi",
        timeLeft: 1,
        cargo: [{ itemId: "potion", count: 2 }],
        goldCost: 30,
      });
      const town = makeTown({ id: "komorebi", name: "コモレビ村" });
      const result = processCaravanProgress([caravan], [town], 100, {}, makeStats());

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("コモレビ村");
      expect(result.logs[0].message).toContain("回復薬");
    });

    it("idle状態の馬車は変更されないこと", () => {
      const caravan = makeCaravan({ status: "idle" });
      const result = processCaravanProgress([caravan], [], 100, {}, makeStats());

      expect(result.caravans[0].status).toBe("idle");
    });
  });

  describe("unlockTownsByTier", () => {
    it("Tier2で港町アイアンポートがアンロックされること", () => {
      const towns = [
        makeTown({ id: "komorebi", isUnlocked: true }),
        makeTown({
          id: "ironport",
          name: "港町アイアンポート",
          isUnlocked: false,
        }),
        makeTown({ id: "magica", isUnlocked: false }),
      ];
      const result = unlockTownsByTier(towns, 2);

      expect(result.towns.find((t) => t.id === "ironport")?.isUnlocked).toBe(true);
      expect(result.towns.find((t) => t.id === "magica")?.isUnlocked).toBe(false);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("アイアンポート");
    });

    it("Tier3で魔法都市マギカがアンロックされること", () => {
      const towns = [
        makeTown({ id: "komorebi", isUnlocked: true }),
        makeTown({ id: "ironport", isUnlocked: true }),
        makeTown({ id: "magica", name: "魔法都市マギカ", isUnlocked: false }),
      ];
      const result = unlockTownsByTier(towns, 3);

      expect(result.towns.find((t) => t.id === "magica")?.isUnlocked).toBe(true);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].message).toContain("マギカ");
    });

    it("既にアンロック済みの街はログが出力されないこと", () => {
      const towns = [
        makeTown({ id: "ironport", isUnlocked: true }),
        makeTown({ id: "magica", isUnlocked: true }),
      ];
      const result = unlockTownsByTier(towns, 3);

      expect(result.logs.length).toBe(0);
    });

    it("Tier1では新しい街はアンロックされないこと", () => {
      const towns = [
        makeTown({ id: "ironport", isUnlocked: false }),
        makeTown({ id: "magica", isUnlocked: false }),
      ];
      const result = unlockTownsByTier(towns, 1);

      expect(result.towns.find((t) => t.id === "ironport")?.isUnlocked).toBe(false);
      expect(result.towns.find((t) => t.id === "magica")?.isUnlocked).toBe(false);
    });
  });
});
