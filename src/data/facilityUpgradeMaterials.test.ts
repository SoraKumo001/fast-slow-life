import { describe, it, expect } from "vitest";

import {
  FACILITY_UPGRADE_MATERIALS,
  getUpgradeMaterialsForLevel,
} from "./facilityUpgradeMaterials";
import { ITEMS } from "./masterData";

const ALL_FACILITY_TYPES = Object.keys(
  FACILITY_UPGRADE_MATERIALS,
) as (keyof typeof FACILITY_UPGRADE_MATERIALS)[];

describe("FACILITY_UPGRADE_MATERIALS", () => {
  it("全11施設のエントリが存在すること", () => {
    expect(ALL_FACILITY_TYPES.length).toBe(11);
  });

  it.each(ALL_FACILITY_TYPES)("施設 %s に Lv1〜Lv5 の全エントリが存在すること", (facilityId) => {
    const schedule = FACILITY_UPGRADE_MATERIALS[facilityId];
    for (let level = 1; level <= 5; level++) {
      expect(schedule[level], `${facilityId} の Lv${level} エントリが存在しません`).toBeDefined();
    }
  });

  it.each(ALL_FACILITY_TYPES)("施設 %s の全素材IDが ITEMS に存在すること", (facilityId) => {
    const schedule = FACILITY_UPGRADE_MATERIALS[facilityId];
    for (let level = 1; level <= 5; level++) {
      const materials = schedule[level];
      for (const mat of materials) {
        expect(
          ITEMS[mat.itemId],
          `${facilityId} Lv${level}: 不明な素材ID "${mat.itemId}"`,
        ).toBeDefined();
      }
    }
  });

  it.each(ALL_FACILITY_TYPES)("施設 %s の全素材のcountが1以上であること", (facilityId) => {
    const schedule = FACILITY_UPGRADE_MATERIALS[facilityId];
    for (let level = 1; level <= 5; level++) {
      const materials = schedule[level];
      for (const mat of materials) {
        expect(
          mat.count,
          `${facilityId} Lv${level}: ${mat.itemId} のcountが1未満です`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it.each(ALL_FACILITY_TYPES)(
    "施設 %s の Lv1 エントリは1〜2種類の素材であること（建設用）",
    (facilityId) => {
      const materials = FACILITY_UPGRADE_MATERIALS[facilityId][1];
      expect(materials.length).toBeGreaterThanOrEqual(1);
      expect(materials.length).toBeLessThanOrEqual(2);
    },
  );
});

describe("getUpgradeMaterialsForLevel", () => {
  it("既存の施設・レベルの組み合わせで素材配列を返すこと", () => {
    const result = getUpgradeMaterialsForLevel("inn", 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("存在しないレベル（6以上）では空配列を返すこと", () => {
    const result = getUpgradeMaterialsForLevel("inn", 99);
    expect(result).toEqual([]);
  });

  it("不明な施設IDでは空配列を返すこと", () => {
    // @ts-expect-error - 意図的に無効な施設IDを渡すテスト
    const result = getUpgradeMaterialsForLevel("nonexistent", 1);
    expect(result).toEqual([]);
  });
});
