import { describe, it, expect } from "vitest";

import { DUNGEONS } from "../data/dungeons";
import type { Facility, FacilityType, Villager } from "../types/game";
import { carryCapacity, carriedCount, isAtCapacity } from "./carryCapacity";
import { processVillagerActivities } from "./villagerAI";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト採取者",
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
    status: "active",
    order: "gather",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: "wheat",
    targetMonsterId: null,
    autoTargetName: null,
    isStarving: false,
    dungeonState: {
      currentDepth: 12,
      targetDepth: 12,
      lane: -1.3,
      phase: "gathering",
      targetNodeId: "wheat",
    },
    ...overrides,
  } as Villager;
}

const facilities = {
  inn: { id: "inn", name: "宿屋", level: 1 },
} as unknown as Record<FacilityType, Facility>;

function runHour(v: Villager) {
  const forest = JSON.parse(JSON.stringify(DUNGEONS[0]));
  return processVillagerActivities(
    [v],
    [forest],
    facilities,
    {},
    { wheat: 50 }, // 派遣目標は未達（在庫0）→ 目標達成帰還は発動しない
    null,
    false,
    false,
    {},
    1000,
    10,
    false,
  );
}

describe("carryCapacity", () => {
  it("容量は 10 + floor(str / 2)", () => {
    expect(carryCapacity(makeVillager({ str: 10 }))).toBe(15);
    expect(carryCapacity(makeVillager({ str: 15 }))).toBe(17);
    expect(carryCapacity(makeVillager({ str: 0 }))).toBe(10);
  });

  it("carriedCount は pool の合計", () => {
    const v = makeVillager({ pool: { wheat: 3, wood: 2 } });
    expect(carriedCount(v)).toBe(5);
    expect(carriedCount(makeVillager({ pool: {} }))).toBe(0);
  });

  it("isAtCapacity は容量到達で true", () => {
    expect(isAtCapacity(makeVillager({ str: 10, pool: { wheat: 15 } }))).toBe(true);
    expect(isAtCapacity(makeVillager({ str: 10, pool: { wheat: 14 } }))).toBe(false);
  });
});

describe("capacity return (processVillagerActivities)", () => {
  it("容量いっぱいの採取者は帰還を開始すること", () => {
    const v = makeVillager({ str: 10, pool: { wheat: 15 } });
    const result = runHour(v);
    const after = result.villagers[0];
    expect(after.status).toBe("traveling_back");
    expect(after.travelTimeLeft).toBe(1); // forest.distance
    expect(after.dungeonState?.phase).toBe("returning");
    // 消耗帰還と違い order は維持される（帰還後は idle になる）
    expect(after.order).toBe("gather");
    const log = result.logs.find((l) => l.message.includes("荷物がいっぱい"));
    expect(log).toBeDefined();
  });

  it("容量未満の採取者は活動を継続すること", () => {
    const v = makeVillager({ str: 10, pool: { wheat: 14 } });
    const result = runHour(v);
    expect(result.villagers[0].status).toBe("active");
  });

  it("容量いっぱいの討伐者も帰還すること", () => {
    const v = makeVillager({
      str: 10,
      pool: { raw_meat: 15 },
      order: "hunt",
      targetGatherItemId: null,
      targetMonsterId: "goblin",
    });
    const result = runHour(v);
    expect(result.villagers[0].status).toBe("traveling_back");
  });
});
