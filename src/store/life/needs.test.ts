import { describe, it, expect } from "vitest";

import type { Villager } from "../../types/game";
import { createVillager } from "../../utils/villagerHelpers";
import { deriveNeeds, hash01 } from "./needs";

function makeVillager(id: string, overrides: Partial<Villager> = {}): Villager {
  return { ...createVillager({ id, name: `村人${id}` }), ...overrides };
}

describe("deriveNeeds: 境界値", () => {
  it("スタミナ満タンで疲労0、スタミナ0で疲労100", () => {
    expect(deriveNeeds(makeVillager("v1", { stamina: 100, maxStamina: 100 }), 12).fatigue).toBe(
      0,
    );
    expect(deriveNeeds(makeVillager("v1", { stamina: 0, maxStamina: 100 }), 12).fatigue).toBe(
      100,
    );
    expect(deriveNeeds(makeVillager("v1", { stamina: 25, maxStamina: 100 }), 12).fatigue).toBe(
      75,
    );
  });

  it("HP満タンで健康欠乏0、HP0で健康欠乏100", () => {
    expect(
      deriveNeeds(makeVillager("v1", { currentHp: 100, maxHp: 100 }), 12).illHealth,
    ).toBe(0);
    expect(deriveNeeds(makeVillager("v1", { currentHp: 0, maxHp: 100 }), 12).illHealth).toBe(
      100,
    );
  });

  it("空腹: 飢餓なら90、食事バフがあれば20", () => {
    expect(deriveNeeds(makeVillager("v1", { isStarving: true }), 12).hunger).toBe(90);
    expect(
      deriveNeeds(makeVillager("v1", { activeFoodBuffId: "food_bread" }), 12).hunger,
    ).toBe(20);
    // 飢餓がバフより優先される
    expect(
      deriveNeeds(makeVillager("v1", { isStarving: true, activeFoodBuffId: "food_bread" }), 12)
        .hunger,
    ).toBe(90);
  });

  it("満足欠乏: 0G→80、200G→40、1000G以上→10、ツケ→95", () => {
    expect(deriveNeeds(makeVillager("v1", { gold: 0 }), 12).wealthLack).toBe(80);
    expect(deriveNeeds(makeVillager("v1", { gold: 200 }), 12).wealthLack).toBe(40);
    expect(deriveNeeds(makeVillager("v1", { gold: 1000 }), 12).wealthLack).toBe(10);
    expect(deriveNeeds(makeVillager("v1", { gold: 5000 }), 12).wealthLack).toBe(10);
    expect(deriveNeeds(makeVillager("v1", { gold: -1 }), 12).wealthLack).toBe(95);
  });
});

describe("deriveNeeds: 単調性と範囲", () => {
  it("空腹は日中 (6〜22時) 単調に増え、40〜70 の範囲に収まる", () => {
    const v = makeVillager("v1");
    let prev = -Infinity;
    for (let h = 6; h <= 22; h++) {
      const hunger = deriveNeeds(v, h).hunger;
      expect(hunger, `hour=${h}`).toBeGreaterThanOrEqual(prev);
      expect(hunger).toBeGreaterThanOrEqual(40);
      expect(hunger).toBeLessThanOrEqual(70);
      prev = hunger;
    }
    expect(deriveNeeds(v, 6).hunger).toBe(40);
    expect(deriveNeeds(v, 18).hunger).toBe(70);
  });

  it("満足欠乏は所持金に対して単調に減る", () => {
    let prev = Infinity;
    for (const gold of [0, 100, 200, 400, 700, 1000, 2000]) {
      const w = deriveNeeds(makeVillager("v1", { gold }), 12).wealthLack;
      expect(w, `gold=${gold}`).toBeLessThanOrEqual(prev);
      prev = w;
    }
  });

  it("全欲求が常に 0〜100 に収まる (全時刻・極端な入力)", () => {
    const v = makeVillager("v1", {
      stamina: 0,
      currentHp: 0,
      gold: -500,
      isStarving: true,
    });
    for (let h = 0; h < 24; h++) {
      const n = deriveNeeds(v, h);
      for (const value of Object.values(n)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("社交には id ハッシュによる個人差がある", () => {
    const socials = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"].map(
      (id) => deriveNeeds(makeVillager(id), 12).social,
    );
    expect(new Set(socials).size).toBeGreaterThan(1);
    // 個人差は ±15 以内なので、全員が基礎値 (12時: 52.5) の ±15 に収まる
    for (const s of socials) {
      expect(Math.abs(s - 52.5)).toBeLessThanOrEqual(15);
    }
  });
});

describe("deriveNeeds: 決定性", () => {
  it("同じ入力では常に同じ出力", () => {
    const v = makeVillager("v3", { stamina: 42, currentHp: 77, gold: 350 });
    for (let h = 0; h < 24; h++) {
      expect(deriveNeeds(v, h)).toEqual(deriveNeeds(v, h));
    }
  });

  it("hash01 は 0〜1 未満で決定論的", () => {
    for (const seed of ["v1", "v2:meal", "abc", ""]) {
      const x = hash01(seed);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      expect(hash01(seed)).toBe(x);
    }
  });
});
