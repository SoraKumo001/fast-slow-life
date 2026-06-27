import { describe, it, expect } from "vitest";

import type { Villager } from "../types/game";
import { calculateUpgradeTime, selectBestUpgradeVillager } from "./upgradeHelpers";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
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

describe("upgradeHelpers - calculateUpgradeTime", () => {
  it("村人未指定 (null) の場合は baseTime をそのまま返すこと", () => {
    expect(calculateUpgradeTime(10, null)).toBe(10);
    expect(calculateUpgradeTime(10, undefined)).toBe(10);
  });

  it("DEX=10 の基本値村人ではほぼ baseTime と同じになること", () => {
    // DEX=10 → dexFactor = 1 - 0 = 1, jobFactor = 1 → 10*1*1 = 10
    const v = makeVillager({ dex: 10 });
    expect(calculateUpgradeTime(10, v)).toBe(10);
  });

  it("DEX が高いほど時間が短縮されること", () => {
    const low = makeVillager({ id: "v1", dex: 10 });
    const high = makeVillager({ id: "v2", dex: 50 });
    expect(calculateUpgradeTime(10, high)).toBeLessThan(calculateUpgradeTime(10, low));
  });

  it("職人 (crafter) は基本より速くアップグレードできること", () => {
    const farmer = makeVillager({ id: "v1", currentJob: "農民" });
    const crafter = makeVillager({ id: "v2", currentJob: "職人" });
    expect(calculateUpgradeTime(10, crafter)).toBeLessThan(calculateUpgradeTime(10, farmer));
  });

  it("鉱夫 (miner) は基本より少し速くアップグレードできること", () => {
    const farmer = makeVillager({ id: "v1", currentJob: "農民" });
    const miner = makeVillager({ id: "v2", currentJob: "鉱夫" });
    expect(calculateUpgradeTime(10, miner)).toBeLessThan(calculateUpgradeTime(10, farmer));
  });

  it("計算結果は最低でも 1 であること", () => {
    // DEX 超高値でも負や 0 にはならない
    const v = makeVillager({ dex: 9999, currentJob: "職人" });
    const result = calculateUpgradeTime(10, v);
    expect(result).toBeGreaterThanOrEqual(1);
  });
});

describe("upgradeHelpers - selectBestUpgradeVillager", () => {
  it("適切な候補がない場合は null を返すこと", () => {
    expect(selectBestUpgradeVillager([])).toBeNull();
  });

  it("idle 村人から優先的に選択すること", () => {
    const idle = makeVillager({ id: "v1", status: "idle", currentJob: "農民" });
    const active = makeVillager({
      id: "v2",
      status: "active",
      currentJob: "職人",
    });
    const result = selectBestUpgradeVillager([active, idle]);
    expect(result?.id).toBe("v1");
  });

  it("idle の中に職人がいれば最優先", () => {
    const crafter = makeVillager({
      id: "v1",
      status: "idle",
      currentJob: "職人",
    });
    const farmer = makeVillager({
      id: "v2",
      status: "idle",
      currentJob: "農民",
    });
    const miner = makeVillager({
      id: "v3",
      status: "idle",
      currentJob: "鉱夫",
    });
    const result = selectBestUpgradeVillager([farmer, miner, crafter]);
    expect(result?.id).toBe("v1");
  });

  it("idle に職人がいなければ鉱夫を優先", () => {
    const farmer = makeVillager({
      id: "v1",
      status: "idle",
      currentJob: "農民",
    });
    const miner = makeVillager({
      id: "v2",
      status: "idle",
      currentJob: "鉱夫",
    });
    const result = selectBestUpgradeVillager([farmer, miner]);
    expect(result?.id).toBe("v2");
  });

  it("assignedCraftJobId がある村人は対象外", () => {
    const assigned = makeVillager({
      id: "v1",
      status: "idle",
      assignedCraftJobId: "job_1",
    });
    const free = makeVillager({ id: "v2", status: "idle" });
    const result = selectBestUpgradeVillager([assigned, free]);
    expect(result?.id).toBe("v2");
  });

  it("order=rest の active 村人は対象外 (idle なら対象となる)", () => {
    // 仕様: selectBestUpgradeVillager は active 村人選択時に order !== "rest" を要求
    // idle 村人に対しては order を問わない
    const resting = makeVillager({ id: "v1", status: "active", order: "rest" });
    const ready = makeVillager({ id: "v2", status: "active", order: "gather" });
    const result = selectBestUpgradeVillager([resting, ready]);
    expect(result?.id).toBe("v2");
  });

  it("active 村人 (ダンジョン活動中) も選択される", () => {
    // idle がいない → active から選ぶ
    const active = makeVillager({ id: "v1", status: "active", order: "hunt" });
    const result = selectBestUpgradeVillager([active]);
    expect(result?.id).toBe("v1");
  });

  it("traveling_back 状態でも選択される (idle/active がいない場合)", () => {
    const travelingBack = makeVillager({ id: "v1", status: "traveling_back" });
    const result = selectBestUpgradeVillager([travelingBack]);
    expect(result?.id).toBe("v1");
  });

  it("resting 村人も最終手段として選択される", () => {
    // idle/active/traveling_back がいなく resting のみ
    const resting = makeVillager({ id: "v1", status: "resting" });
    const result = selectBestUpgradeVillager([resting]);
    expect(result?.id).toBe("v1");
  });
});
