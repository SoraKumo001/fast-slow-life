import { describe, it, expect } from "vitest";

import type { Villager } from "../types/game";
import { calculateCraftTime, generateId } from "./craftHelpers";

describe("craftHelpers - generateId", () => {
  it("文字列のIDを返すこと", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("連続呼び出しで異なるIDを返すこと (ランダム生成)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    // 100個全てがユニークである確率が高い
    expect(ids.size).toBeGreaterThan(90);
  });
});

describe("craftHelpers - calculateCraftTime", () => {
  function makeVillager(overrides: Partial<Villager> = {}): Villager {
    return {
      id: "v1",
      name: "テスト",
      currentJob: "農民",
      jobHistory: ["農民"],
      gold: 0,
      pool: {},
      activeFoodBuffId: null,
      lastTrainingDay: 0,
      level: 1,
      exp: 0,
      maxHp: 100,
      currentHp: 100,
      stamina: 100,
      maxStamina: 100,
      str: 10,
      int: 10,
      dex: 10,
      agi: 10,
      vit: 10,
      bonusStr: 0,
      bonusInt: 0,
      bonusDex: 0,
      bonusAgi: 0,
      bonusVit: 0,
      bonusMaxHp: 0,
      bonusMaxStamina: 0,
      potionCount: 0,
      potionItemId: "potion",
      staminaDrinkCount: 0,
      staminaDrinkItemId: "stamina_drink",
      weaponId: "none",
      armorId: "none",
      status: "idle",
      order: "rest",
      destinationAreaId: null,
      travelTimeLeft: 0,
      assignedCraftJobId: null,
      targetGatherItemId: null,
      targetMonsterId: null,
      autoTargetName: null,
      isStarving: false,
      ...overrides,
    } as Villager;
  }

  it("村人未指定 (null) の場合は baseTime をそのまま返すこと", () => {
    expect(calculateCraftTime(10, null)).toBe(10);
    expect(calculateCraftTime(10, undefined)).toBe(10);
  });

  it("DEX=10 の基本村人ではほぼ baseTime と同じになること", () => {
    const v = makeVillager({ dex: 10 });
    expect(calculateCraftTime(10, v)).toBe(10);
  });

  it("職人は他の職業より速くクラフトできること", () => {
    const farmer = makeVillager({ currentJob: "農民" });
    const crafter = makeVillager({ currentJob: "職人" });
    expect(calculateCraftTime(10, crafter)).toBeLessThan(calculateCraftTime(10, farmer));
  });

  it("DEX が高いと時間が短縮されること", () => {
    const low = makeVillager({ dex: 10 });
    const high = makeVillager({ dex: 50 });
    expect(calculateCraftTime(10, high)).toBeLessThan(calculateCraftTime(10, low));
  });

  it("計算結果は最低でも 1 であること", () => {
    const v = makeVillager({ dex: 9999, currentJob: "職人" });
    const result = calculateCraftTime(5, v);
    expect(result).toBeGreaterThanOrEqual(1);
  });
});
