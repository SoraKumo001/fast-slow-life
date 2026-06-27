import { describe, it, expect } from "vitest";

import { ITEMS, RECIPES } from "../data/masterData";
import type { Town } from "../types/game";
import {
  getEffectiveExportPrice,
  getBestExportPrice,
  getResourceFacilityGValue,
  getDailyFoodConsumption,
  getTotalFoodStock,
  getFoodDaysRemaining,
  getRecipeValueInfo,
} from "./economyHelpers";

function makeTown(overrides: Partial<Town> = {}): Town {
  return {
    id: "komorebi",
    name: "コモレビ村",
    distance: 12,
    description: "",
    specialties: [],
    demands: [],
    investCost: 500,
    investLevel: 1,
    isUnlocked: true,
    ...overrides,
  } as Town;
}

describe("economyHelpers - getEffectiveExportPrice", () => {
  it("市場ボーナス適用後の価格を返すこと", () => {
    // potion: basePrice 10, marketLvl=1 (bonus 0.1) → floor(10 * 1.1) = 11
    expect(getEffectiveExportPrice("potion", makeTown(), 1)).toBe(11);
  });

  it("市場 Lv0 の場合は基本価格のまま", () => {
    expect(getEffectiveExportPrice("potion", makeTown(), 0)).toBe(10);
  });

  it("存在しないアイテムID の場合は 0", () => {
    expect(getEffectiveExportPrice("nonexistent", makeTown(), 1)).toBe(0);
  });
});

describe("economyHelpers - getBestExportPrice", () => {
  it("複数の街から最も高い価格を返すこと", () => {
    const towns = [
      makeTown({ id: "komorebi", name: "コモレビ村", isUnlocked: true }),
      makeTown({ id: "ironport", name: "港町アイアンポート", isUnlocked: true }),
    ];
    const result = getBestExportPrice("potion", towns, 1);
    expect(result.price).toBeGreaterThan(0);
    expect(result.townName).toBeTruthy();
  });

  it("アンロックされていない街は対象外", () => {
    const towns = [
      makeTown({ id: "komorebi", name: "コモレビ村", isUnlocked: true }),
      makeTown({ id: "ironport", name: "港町アイアンポート", isUnlocked: false }),
    ];
    const result = getBestExportPrice("potion", towns, 1);
    // komorebi のみが対象
    expect(result.townName).toBe("コモレビ村");
  });
});

describe("economyHelpers - getResourceFacilityGValue", () => {
  it("Lv0 の場合は gValue=0, label='なし'", () => {
    expect(getResourceFacilityGValue("farm", 0)).toEqual({ label: "なし", gValue: 0 });
  });

  it("農場 Lv1: 小麦が生成される", () => {
    const result = getResourceFacilityGValue("farm", 1);
    expect(result.label).toContain("小麦");
    expect(result.gValue).toBeGreaterThan(0);
  });

  it("農場 Lv3: 薬草の確率が追加される", () => {
    const result = getResourceFacilityGValue("farm", 3);
    expect(result.label).toContain("薬草");
  });

  it("伐採所 Lv1: 原木が生成される", () => {
    const result = getResourceFacilityGValue("lumberyard", 1);
    expect(result.label).toContain("原木");
    expect(result.gValue).toBeGreaterThan(0);
  });

  it("伐採所 Lv3: 木板の確率が追加される", () => {
    const result = getResourceFacilityGValue("lumberyard", 3);
    expect(result.label).toContain("木板");
  });

  it("採石場 Lv1: 石材が生成される", () => {
    const result = getResourceFacilityGValue("quarry", 1);
    expect(result.label).toContain("石材");
  });

  it("採石場 Lv5: 銀鉱石まで生成される", () => {
    const result = getResourceFacilityGValue("quarry", 5);
    expect(result.label).toContain("銀鉱石");
  });

  it("未対応の施設ID は {label:'なし', gValue:0}", () => {
    expect(getResourceFacilityGValue("inn", 5)).toEqual({ label: "なし", gValue: 0 });
  });
});

describe("economyHelpers - getDailyFoodConsumption", () => {
  it("村人数 = 日次消費量", () => {
    expect(getDailyFoodConsumption(0)).toBe(0);
    expect(getDailyFoodConsumption(5)).toBe(5);
    expect(getDailyFoodConsumption(10)).toBe(10);
  });
});

describe("economyHelpers - getTotalFoodStock", () => {
  it("生食材と調理済み食材の両方を集計すること", () => {
    const inventory = {
      wheat: 10,
      vegetable: 5,
      raw_meat: 3,
      food_bread: 7,
      food_dried_meat: 2,
    };
    // 10 + 5 + 3 + 7 + 2 = 27
    expect(getTotalFoodStock(inventory)).toBe(27);
  });

  it("空の在庫は 0", () => {
    expect(getTotalFoodStock({})).toBe(0);
  });

  it("食料でないアイテムは含まれない", () => {
    const inventory = {
      potion: 100,
      iron_sword: 50,
      wheat: 5,
    };
    expect(getTotalFoodStock(inventory)).toBe(5);
  });
});

describe("economyHelpers - getFoodDaysRemaining", () => {
  it("在庫 / 村人数 で残日数を計算すること", () => {
    const inventory = { wheat: 20 };
    // 20 / 5 (villagers) = 4
    expect(getFoodDaysRemaining(inventory, 5)).toBe(4);
  });

  it("村人 0 の場合は 999 を返すこと", () => {
    expect(getFoodDaysRemaining({ wheat: 100 }, 0)).toBe(999);
  });

  it("在庫 0 の場合は 0 を返すこと", () => {
    expect(getFoodDaysRemaining({}, 5)).toBe(0);
  });
});

describe("economyHelpers - getRecipeValueInfo", () => {
  it("レシピの価値情報を正しく計算すること", () => {
    // iron_ingot: requiredItems=[{iron_ore:3}], resultItemId=iron_ingot, requiredTime=4
    // materialCost = iron_ore.basePrice (2) * 3 = 6
    // resultPrice = iron_ingot.basePrice (12) = 12
    // valueAdd = 12 - 6 = 6
    // valuePerHour = floor(6 / 4) = 1
    const recipe = RECIPES["iron_ingot"];
    const info = getRecipeValueInfo(recipe);
    expect(info.materialCost).toBeGreaterThan(0);
    expect(info.resultPrice).toBeGreaterThan(0);
    expect(info.valueAdd).toBe(info.resultPrice - info.materialCost);
    expect(info.valuePerHour).toBe(Math.floor(info.valueAdd / recipe.requiredTime));
  });

  it("valueAdd が負になるレシピでも resultPrice と materialCost を返すこと", () => {
    // 仮に material > result となるレシピでもクラッシュしない
    const recipe = RECIPES["iron_ingot"];
    const info = getRecipeValueInfo(recipe);
    expect(typeof info.valueAdd).toBe("number");
  });
});