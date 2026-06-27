import { describe, it, expect } from "vitest";

import { DISCOUNT_PER_SOUL_LEVEL } from "../constants";
import { JOBS } from "../data/masterData";
import { Villager } from "../types/game";
import { changeVillagerJobHelper } from "./villagerJob";

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
    order: "gather",
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

describe("villagerJob - changeVillagerJobHelper", () => {
  describe("前提条件チェック", () => {
    it("存在しない村人IDの場合は success=false を返すこと", () => {
      const result = changeVillagerJobHelper({
        villagerId: "nonexistent",
        job: "戦士",
        villagers: [makeVillager()],
        gold: 1000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(false);
      expect(result.logs).toHaveLength(0);
    });

    it("前提職業を持たない場合は転職できないこと (warning ログ)", () => {
      // 戦士になるには猟師 (lv5) が必要
      const v = makeVillager({ level: 10, currentJob: "農民", jobHistory: ["農民"] });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "戦士",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(false);
      const log = result.logs[0];
      expect(log.type).toBe("warning");
      expect(log.message).toContain("転職条件");
    });

    it("必要レベルを満たさない場合は転職できないこと", () => {
      // 戦士は lv5 必須
      const v = makeVillager({ level: 3, currentJob: "猟師", jobHistory: ["農民", "猟師"] });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "戦士",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain("必要レベル");
    });

    it("jobHistory に既に含まれている職業への転職は無料 (成功)", () => {
      // 農民 → 農民 (同一職業) は無料
      const v = makeVillager({ currentJob: "農民", jobHistory: ["農民"] });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "農民",
        villagers: [v],
        gold: 0, // ゴールド0でも成功
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(true);
      expect(result.gold).toBe(0); // コストなし
    });

    it("前提職業と必要レベルを満たせば転職成功すること", () => {
      const v = makeVillager({
        currentJob: "猟師",
        jobHistory: ["農民", "猟師"],
        level: 10,
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "戦士",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("コスト計算", () => {
    it("新規職業の転職コストは JOBS[job].cost と一致すること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        gold: 10000,
      });
      const expectedCost = JOBS["木こり"].cost;
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(true);
      // gold は元の 10000 から expectedCost 分引かれる
      expect(10000 - result.gold).toBe(expectedCost);
    });

    it("ソウル discount バフで転職コストが減額されること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        gold: 10000,
      });
      const baseCost = JOBS["木こり"].cost;
      const discountLvl = 2;
      // discount: 1 - discountLvl * DISCOUNT_PER_SOUL_LEVEL = 1 - 2 * 0.2 = 0.6
      const expectedCost = Math.floor(baseCost * (1 - discountLvl * DISCOUNT_PER_SOUL_LEVEL));
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: discountLvl },
      });
      expect(result.success).toBe(true);
      expect(10000 - result.gold).toBe(expectedCost);
    });

    it("ゴールド不足の場合は転職できないこと (warning ログ)", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        gold: 0,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり", // cost > 0
        villagers: [v],
        gold: 5, // 足りない
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain("ゴールド");
      expect(result.gold).toBe(5); // 減らない
    });
  });

  describe("ステータス変換", () => {
    it("転職時にレベルが1に戻り経験値がリセットされること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        level: 10,
        exp: 500,
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(true);
      const updated = result.villagers[0];
      expect(updated.level).toBe(1);
      expect(updated.exp).toBe(0);
    });

    it("転職時にHPとスタミナが全回復すること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        currentHp: 10,
        stamina: 10,
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      const updated = result.villagers[0];
      expect(updated.currentHp).toBe(updated.maxHp);
      expect(updated.stamina).toBe(updated.maxStamina);
    });

    it("転職後に jobHistory に新職業が追加されること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.villagers[0].jobHistory).toContain("農民");
      expect(result.villagers[0].jobHistory).toContain("木こり");
    });

    it("転職後の stats は新職業の statsMultiplier で再計算されること", () => {
      // 戦士は str 1.4 倍 → STR が大幅に上がる
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民", "猟師"],
        level: 10,
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "戦士",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.success).toBe(true);
      const updated = result.villagers[0];
      // 戦士の statsMultiplier.str = 1.4 → STR は base 10 * 1.4 = 14 以上
      expect(updated.str).toBeGreaterThanOrEqual(14);
    });

    it("転職成功時に info ログが追加されること", () => {
      const v = makeVillager({
        currentJob: "農民",
        jobHistory: ["農民"],
        gold: 10000,
      });
      const result = changeVillagerJobHelper({
        villagerId: "v1",
        job: "木こり",
        villagers: [v],
        gold: 10000,
        soulUpgrades: { discount: 0 },
      });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].type).toBe("info");
      expect(result.logs[0].message).toContain("転職");
    });
  });
});
