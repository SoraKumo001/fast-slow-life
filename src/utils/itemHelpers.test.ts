import { describe, it, expect } from "vitest";

import { ITEMS, RECIPES } from "../data/masterData";
import type { DungeonArea, Facility, FacilityType, ItemCategory } from "../types/game";
import {
  getCategoryBadgeColor,
  getCategoryLabel,
  getBonusDiff,
  getEquipmentBonusString,
  isItemAvailable,
} from "./itemHelpers";

describe("itemHelpers - getCategoryBadgeColor", () => {
  const categories: ItemCategory[] = [
    "food", "ore", "herb", "mana_stone", "material",
    "gear_weapon", "gear_armor", "consumable",
  ];

  it("全カテゴリでクラス文字列が返ること", () => {
    categories.forEach((cat) => {
      const color = getCategoryBadgeColor(cat);
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    });
  });

  it("同じカテゴリは常に同じ色を返すこと", () => {
    expect(getCategoryBadgeColor("food")).toBe(getCategoryBadgeColor("food"));
    expect(getCategoryBadgeColor("gear_weapon")).toBe(getCategoryBadgeColor("gear_weapon"));
  });
});

describe("itemHelpers - getCategoryLabel", () => {
  it("各カテゴリの日本語ラベルが返ること", () => {
    expect(getCategoryLabel("food")).toBe("食料");
    expect(getCategoryLabel("ore")).toBe("鉱石");
    expect(getCategoryLabel("herb")).toBe("薬草");
    expect(getCategoryLabel("mana_stone")).toBe("魔法石");
    expect(getCategoryLabel("material")).toBe("素材");
    expect(getCategoryLabel("gear_weapon")).toBe("武器");
    expect(getCategoryLabel("gear_armor")).toBe("防具");
    expect(getCategoryLabel("consumable")).toBe("消耗品");
  });
});

describe("itemHelpers - getBonusDiff", () => {
  it("装備品のステータス差分を返すこと", () => {
    const item = {
      ...ITEMS["iron_sword"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 30, str: 5 },
      },
    };
    const current = {
      ...ITEMS["wooden_club"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 10 },
      },
    };
    const diffs = getBonusDiff(item, current);
    expect(diffs.length).toBeGreaterThan(0);
    // attack: 30 - 10 = 20
    const attackDiff = diffs.find((d) => d.stat === "攻撃");
    expect(attackDiff?.diff).toBe(20);
  });

  it("currentItem が null の場合はアイテム単独の差分を返すこと", () => {
    const item = {
      ...ITEMS["iron_sword"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 30 },
      },
    };
    const diffs = getBonusDiff(item, null);
    // attack: 30 - 0 = 30
    const attackDiff = diffs.find((d) => d.stat === "攻撃");
    expect(attackDiff?.after).toBe(30);
    expect(attackDiff?.before).toBe(0);
  });

  it("ボーナス変更があったステータス差分が返ること", () => {
    const item = {
      ...ITEMS["wooden_club"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 10 },
      },
    };
    const current = {
      ...ITEMS["wooden_club"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 5 },
      },
    };
    const diffs = getBonusDiff(item, current);
    // attack: 10 - 5 = 5 → 含まれる
    const attackDiff = diffs.find((d) => d.stat === "攻撃");
    expect(attackDiff?.diff).toBe(5);
  });

  it("両方 0 のボーナス差は結果に含まれないこと", () => {
    // 両方のアイテムが bonuses に含まないステータス → diff 0
    const item = {
      ...ITEMS["iron_sword"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 30 },
      },
    };
    const current = {
      ...ITEMS["wooden_club"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 10 },
      },
    };
    const diffs = getBonusDiff(item, current);
    // str が両方 0 → str は結果に含まれない
    const strDiff = diffs.find((d) => d.stat === "STR");
    expect(strDiff).toBeUndefined();
  });
});

describe("itemHelpers - getEquipmentBonusString", () => {
  it("装備ボーナスを「ラベル+値」形式で連結すること", () => {
    const item = {
      ...ITEMS["iron_sword"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 30, str: 5 },
      },
    };
    const result = getEquipmentBonusString(item);
    expect(result).toContain("攻撃+30");
    expect(result).toContain("STR+5");
  });

  it("equipment がないアイテムは空文字を返すこと", () => {
    const item = ITEMS["potion"]; // equipment なし
    const result = getEquipmentBonusString(item);
    expect(result).toBe("");
  });

  it("ボーナスが全て 0 の場合は空文字を返すこと", () => {
    const item = {
      ...ITEMS["iron_sword"],
      equipment: {
        slot: "weapon" as const,
        bonuses: { attack: 0 },
      },
    };
    const result = getEquipmentBonusString(item);
    expect(result).toBe("");
  });
});

describe("itemHelpers - isItemAvailable", () => {
  function makeFacility(level: number = 1): Facility {
    return {
      id: "workshop",
      name: "加工工房",
      level,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: { gold: 0, materials: [] },
      craftQueue: [],
      trainingQueue: [],
      upgradeAssignedVillagerId: null,
    } as Facility;
  }

  it("インベントリに存在すれば true", () => {
    const result = isItemAvailable(
      "potion",
      [],
      [],
      { potion: 1 },
      {} as Record<FacilityType, Facility>,
      1,
    );
    expect(result).toBe(true);
  });

  it("インベントリになく、採取もドロップもクラフトも不可なら false", () => {
    const result = isItemAvailable(
      "nonexistent_item",
      [],
      [],
      {},
      {} as Record<FacilityType, Facility>,
      1,
    );
    expect(result).toBe(false);
  });

  it("採取可能なエリアがあれば true", () => {
    const dungeons: DungeonArea[] = [
      {
        id: "forest",
        name: "森",
        distance: 1,
        recommendedLevel: 1,
        unlockedAtTier: 1,
        gathers: [
          {
            itemId: "wheat",
            difficulty: 1.0,
            currentProgress: 0,
            respawnTimeLeft: 0,
            respawnTimeTotal: 3,
          },
        ],
        monsters: [],
        explorationProgress: 100,
        difficulty: 1.0,
        threatLevel: 0,
      } as DungeonArea,
    ];
    const result = isItemAvailable(
      "wheat",
      dungeons,
      [],
      {},
      {} as Record<FacilityType, Facility>,
      1,
    );
    expect(result).toBe(true);
  });

  it("アンロックされていない Tier のエリアは対象外", () => {
    const dungeons: DungeonArea[] = [
      {
        id: "forest",
        name: "森",
        distance: 1,
        recommendedLevel: 1,
        unlockedAtTier: 5, // Tier5 限定
        gathers: [
          {
            itemId: "mana_stone",
            difficulty: 1.0,
            currentProgress: 0,
            respawnTimeLeft: 0,
            respawnTimeTotal: 3,
          },
        ],
        monsters: [],
        explorationProgress: 100,
        difficulty: 1.0,
        threatLevel: 0,
      } as DungeonArea,
    ];
    const result = isItemAvailable(
      "mana_stone",
      dungeons,
      [],
      {},
      {} as Record<FacilityType, Facility>,
      1, // currentTier=1 → Tier5 エリアは対象外
    );
    expect(result).toBe(false);
  });

  it("クラフト可能 (施設 Lv 十分 + 素材も再帰的に available) なら true", () => {
    // iron_ingot は iron_ore を必要とする
    // iron_ore はインベントリにある → クラフト可能
    const dungeons: DungeonArea[] = [];
    const facilities: Record<FacilityType, Facility> = {
      workshop: makeFacility(1),
    } as Record<FacilityType, Facility>;
    const result = isItemAvailable(
      "iron_ingot",
      dungeons,
      Object.values(RECIPES),
      { iron_ore: 5 },
      facilities,
      1,
    );
    expect(result).toBe(true);
  });

  it("クラフト施設のレベル不足なら false", () => {
    const dungeons: DungeonArea[] = [];
    const facilities: Record<FacilityType, Facility> = {
      workshop: makeFacility(0), // Lv0
    } as Record<FacilityType, Facility>;
    const result = isItemAvailable(
      "iron_ingot",
      dungeons,
      Object.values(RECIPES),
      { iron_ore: 5 },
      facilities,
      1,
    );
    expect(result).toBe(false);
  });

  it("循環参照 (再帰呼び出し) してもクラッシュしないこと", () => {
    // 循環するレシピを作成
    const cycleRecipes = [
      {
        id: "a",
        resultItemId: "item_a",
        facilityId: "workshop" as FacilityType,
        requiredFacilityLevel: 1,
        requiredItems: [{ itemId: "item_b", count: 1 }],
        requiredTime: 1,
        outputCount: 1,
      },
      {
        id: "b",
        resultItemId: "item_b",
        facilityId: "workshop" as FacilityType,
        requiredFacilityLevel: 1,
        requiredItems: [{ itemId: "item_a", count: 1 }], // 循環
        requiredTime: 1,
        outputCount: 1,
      },
    ];
    const facilities: Record<FacilityType, Facility> = {
      workshop: makeFacility(1),
    } as Record<FacilityType, Facility>;
    // 無限ループしないこと
    const start = Date.now();
    const result = isItemAvailable(
      "item_a",
      [],
      cycleRecipes,
      {},
      facilities,
      1,
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // 100ms 以内
    expect(result).toBe(false);
  });
});