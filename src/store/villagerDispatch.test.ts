import "./setupMockStorage";
import { describe, it, expect } from "vitest";

import type { Villager, DungeonArea, Facility, FacilityType } from "../types/game";
import { getInitialFacilities } from "./initialState";
import { dispatchIdleVillagersHelper } from "./villagerDispatch";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト農民",
    currentJob: "農民",
    jobHistory: ["農民"],
    gold: 100,
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

function makeArea(overrides: Partial<DungeonArea> = {}): DungeonArea {
  return {
    id: "forest",
    name: "始まりの森",
    distance: 2,
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
    ...overrides,
  } as DungeonArea;
}

function makeFacilities(): Record<FacilityType, Facility> {
  return getInitialFacilities();
}

describe("villagerDispatch - dispatchIdleVillagersHelper", () => {
  describe("前提条件", () => {
    it("idle 村人がいない場合は何もしないこと", () => {
      const v = makeVillager({ status: "active" });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      expect(result.anyDispatched).toBe(false);
      expect(result.logs).toHaveLength(0);
    });

    it("idle だが order=rest の村人は対象外", () => {
      const v = makeVillager({ status: "idle", order: "rest" });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: {},
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      expect(result.anyDispatched).toBe(false);
    });
  });

  describe("ダンジョン派遣", () => {
    it("idle 村人が指定エリアに派遣されステータス traveling_to になること", () => {
      const v = makeVillager({ status: "idle", order: "gather" });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      expect(result.anyDispatched).toBe(true);
      expect(result.villagers[0].status).toBe("traveling_to");
      expect(result.villagers[0].destinationAreaId).toBe("forest");
      // 距離分の travelTimeLeft
      expect(result.villagers[0].travelTimeLeft).toBe(2);
    });

    it("派遣時に派遣ログが出力されること", () => {
      const v = makeVillager({ status: "idle", order: "gather" });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0].message).toContain("自動派遣");
      expect(result.logs[0].type).toBe("info");
    });

    it("目標アイテムが在庫十分な場合は目標アイテムを探さずダンジョン派遣になること", () => {
      // 在庫が目標に達している → ターゲットアイテムなしの派遣
      const v = makeVillager({ status: "idle", order: "gather" });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: { wheat: 10 },
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      expect(result.anyDispatched).toBe(true);
      // 派遣される
      expect(result.villagers[0].destinationAreaId).toBe("forest");
    });

    it("アンロックされていない Tier のダンジョンには派遣しないこと", () => {
      const v = makeVillager({ status: "idle", order: "gather" });
      const area = makeArea({ id: "forest", unlockedAtTier: 5 });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: {},
        dungeons: [area],
        currentTier: 1,
        bossDefeated: false,
        gold: 100,
        facilities: makeFacilities(),
      });
      // 派遣されない
      expect(result.villagers[0].destinationAreaId).toBeNull();
    });
  });

  describe("ポーション補充", () => {
    it("倉庫に potion があり村人が所持金を持っている場合、購入して携帯すること", () => {
      const v = makeVillager({ status: "idle", order: "gather", gold: 50 });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: { potion: 10 },
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 0,
        facilities: makeFacilities(),
      });
      // 村人が potion を携帯
      expect(result.villagers[0].potionCount).toBeGreaterThan(0);
      // 倉庫から減っている
      expect(result.inventory.potion).toBeLessThan(10);
      // プレイヤーゴールドが増加 (村人 gold から移動)
      expect(result.gold).toBeGreaterThan(0);
    });

    it("村人の所持金が足りない場合は potion を補充しないこと", () => {
      const v = makeVillager({ status: "idle", order: "gather", gold: 0 });
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: { potion: 10 },
        targetAmounts: { wheat: 10 },
        dungeons: [makeArea()],
        currentTier: 1,
        bossDefeated: false,
        gold: 0,
        facilities: makeFacilities(),
      });
      // potion が補充されない
      expect(result.villagers[0].potionCount).toBe(0);
    });
  });

  describe("施設アップグレードの引き継ぎ", () => {
    it("アップグレード中で担当不在の施設に idle 村人が割り当てられること", () => {
      const v = makeVillager({ id: "v1", status: "idle", order: "gather" });
      const facilities = makeFacilities();
      // 既にアップグレード進行中だが担当不在
      (facilities.inn as Facility).upgradeTimeLeft = 5;
      (facilities.inn as Facility).upgradeAssignedVillagerId = null;
      const result = dispatchIdleVillagersHelper({
        villagers: [v],
        inventory: {},
        targetAmounts: {},
        dungeons: [],
        currentTier: 1,
        bossDefeated: false,
        gold: 0,
        facilities,
      });
      // アップグレード担当に割り当て
      expect(result.facilities.inn.upgradeAssignedVillagerId).toBe("v1");
      // 引き継ぎログ
      const takeoverLog = result.logs.find((l) => l.message.includes("アップグレード作業"));
      expect(takeoverLog).toBeDefined();
    });
  });
});
