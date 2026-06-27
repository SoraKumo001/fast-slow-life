import { describe, it, expect } from "vitest";

import type { Villager } from "../types/game";
import { setVillagerOrderHelper } from "./villagerOrder";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
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

describe("villagerOrder - setVillagerOrderHelper", () => {
  describe("rest 指示", () => {
    it("order=rest で status=resting, destinationAreaId=null になること", () => {
      const v = makeVillager({ status: "active", destinationAreaId: "forest" });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "rest",
        areaId: null,
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      const updated = result.villagers[0];
      expect(updated.status).toBe("resting");
      expect(updated.destinationAreaId).toBeNull();
      expect(updated.travelTimeLeft).toBe(0);
    });

    it("rest 指示時に potion が所持していたら倉庫に返却されること", () => {
      const v = makeVillager({ potionCount: 3 });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "rest",
        areaId: null,
        villagers: [v],
        inventory: { potion: 5 },
        gold: 0,
      });
      // potionCount が 0 になる
      expect(result.villagers[0].potionCount).toBe(0);
      // 倉庫の potion が増える
      expect(result.inventory.potion).toBe(8); // 5 + 3
    });
  });

  describe("gather 指示", () => {
    it("新規エリアへの gather 指示で traveling_to ステータスになること", () => {
      const v = makeVillager({ status: "idle", destinationAreaId: null });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      const updated = result.villagers[0];
      expect(updated.status).toBe("traveling_to");
      expect(updated.destinationAreaId).toBe("forest");
      // forest の distance = 1 なので travelTimeLeft = 1
      expect(updated.travelTimeLeft).toBeGreaterThan(0);
    });

    it("同じエリアへの再指示では移動しないこと (既に active)", () => {
      const v = makeVillager({
        status: "active",
        destinationAreaId: "forest",
        travelTimeLeft: 0,
      });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      // 移動しないので status は active のまま
      expect(result.villagers[0].status).toBe("active");
    });

    it("指針変更ログが出力されること", () => {
      const v = makeVillager();
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      const log = result.logs.find((l) => l.message.includes("採取"));
      expect(log).toBeDefined();
    });
  });

  describe("hunt 指示", () => {
    it("order=hunt でターゲットモンスター指定ができること", () => {
      const v = makeVillager();
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "hunt",
        areaId: "forest",
        targetMonsterId: "goblin",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      expect(result.villagers[0].order).toBe("hunt");
      expect(result.villagers[0].targetMonsterId).toBe("goblin");
      const log = result.logs.find((l) => l.message.includes("討伐"));
      expect(log).toBeDefined();
    });

    it("ターゲット指定なしの hunt 指示でも動作すること", () => {
      const v = makeVillager();
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "hunt",
        areaId: "forest",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      expect(result.villagers[0].order).toBe("hunt");
      expect(result.villagers[0].destinationAreaId).toBe("forest");
    });
  });

  describe("ポーションの自動補充", () => {
    it("エリアへの指示変更時に倉庫から potion を購入して村人が携帯すること", () => {
      const v = makeVillager({
        status: "idle",
        gold: 100,
        destinationAreaId: null,
      });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: { potion: 10 }, // 倉庫に10個
        gold: 0, // プレイヤーゴールド0 (村人100Gで買う)
      });
      // 村人が potion を携帯
      expect(result.villagers[0].potionCount).toBeGreaterThan(0);
      // 倉庫から減っている
      expect(result.inventory.potion).toBeLessThan(10);
    });

    it("村人の所持金が少ないと購入できないこと", () => {
      const v = makeVillager({
        status: "idle",
        gold: 0,
        destinationAreaId: null,
      });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: { potion: 10 },
        gold: 0,
      });
      // ゴールド不足のため購入できず
      expect(result.villagers[0].potionCount).toBe(0);
    });

    it("倉庫に potion がない場合は補充されないこと", () => {
      const v = makeVillager({
        status: "idle",
        gold: 100,
        destinationAreaId: null,
      });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: {}, // 空
        gold: 0,
      });
      expect(result.villagers[0].potionCount).toBe(0);
    });
  });

  describe("指示変更全体", () => {
    it("指示変更時に autoTargetName がクリアされること", () => {
      const v = makeVillager({ autoTargetName: "古いのターゲット" });
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: "forest",
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      expect(result.villagers[0].autoTargetName).toBeNull();
    });

    it("areaId=null で order=gather は idle 状態にすること", () => {
      const v = makeVillager();
      const result = setVillagerOrderHelper({
        villagerId: "v1",
        order: "gather",
        areaId: null,
        villagers: [v],
        inventory: {},
        gold: 0,
      });
      expect(result.villagers[0].status).toBe("idle");
      expect(result.villagers[0].destinationAreaId).toBeNull();
    });
  });
});
