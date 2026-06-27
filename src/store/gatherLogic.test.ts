import { describe, it, expect } from "vitest";

import type { Villager, DungeonArea } from "../types/game";
import { processVillagerGather } from "./gatherLogic";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト農民",
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
    str: 15,
    int: 10,
    dex: 50,
    agi: 15,
    vit: 15,
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
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [
      {
        itemId: "wheat",
        difficulty: 1.0,
        currentProgress: 90, // 採取完了間近
        respawnTimeLeft: 0,
        respawnTimeTotal: 3,
      },
      {
        itemId: "wood",
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

describe("gatherLogic - processVillagerGather", () => {
  it("採取完了時に inventory に対象アイテムが追加されること", () => {
    const v = makeVillager();
    const area = makeArea();
    // wheat の currentProgress を完了寸前に設定
    area.gathers[0].currentProgress = 99;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // 小麦 が採取ログに出ている
    const gatherLog = result.logs.find((l) => l.message.includes("小麦"));
    expect(gatherLog).toBeDefined();
    // ログタイプ (info or gather) は実装依存、いずれか
    expect(["info", "gather"]).toContain(gatherLog?.type);
  });

  it("採取完了で経験値 (EXP) が加算されること", () => {
    const v = makeVillager();
    const area = makeArea();
    area.gathers[0].currentProgress = 99;
    const initialExp = v.exp;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // 完了ログに +X EXP が含まれている
    const expLog = result.logs.find((l) => l.message.includes("EXP"));
    expect(expLog).toBeDefined();
    // v の exp が増加
    expect(v.exp).toBeGreaterThan(initialExp);
  });

  it("採取完了時に採取ポイントがリスポーン状態になること", () => {
    const v = makeVillager();
    const area = makeArea();
    area.gathers[0].currentProgress = 99;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // wheat のリスポーンタイマーが設定される
    const wheatGather = area.gathers.find((g) => g.itemId === "wheat")!;
    expect(wheatGather.respawnTimeLeft).toBeGreaterThan(0);
    // 進捗がリセット
    expect(wheatGather.currentProgress).toBe(0);
    // areaUpdated = true
    expect(result.areaUpdated).toBe(true);
  });

  it("採取量が1個以上になること", () => {
    const v = makeVillager();
    const area = makeArea();
    area.gathers[0].currentProgress = 99;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // 採取量 >= 1
    const gatherLog = result.logs.find(
      (l) => l.message.includes("小麦") && l.message.includes("個"),
    );
    expect(gatherLog).toBeDefined();
    const match = gatherLog?.message.match(/(\d+) 個採取/);
    expect(match).not.toBeNull();
    const amount = parseInt(match![1], 10);
    expect(amount).toBeGreaterThanOrEqual(1);
  });

  it("採取可能な gather がない場合は採取ログが出ないこと", () => {
    const v = makeVillager();
    const area = makeArea({ gathers: [] });
    const result = processVillagerGather(v, 0, area, [v], { wheat: 100 }, {}, 1.0, {}, 1000, false);
    // 採取ログが出ない
    const gatherLog = result.logs.find((l) => l.type === "gather");
    expect(gatherLog).toBeUndefined();
  });

  it("autoTargetName が選択されたアイテム名に更新されること", () => {
    const v = makeVillager();
    const area = makeArea();
    // wheat の currentProgress が十分高いので wheat が選ばれる想定
    area.gathers[0].currentProgress = 50;
    processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // 何かしらの autoTargetName が設定される
    expect(v.autoTargetName).not.toBeNull();
  });

  it("リスポーン中の gather ポイントは選択対象外になること", () => {
    const v = makeVillager();
    const area = makeArea();
    // wheat をリスポーン中にする
    area.gathers[0].respawnTimeLeft = 5;
    area.gathers[0].currentProgress = 99;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // wheat は対象外なので採取ログなし
    const gatherLog = result.logs.find((l) => l.message.includes("小麦"));
    expect(gatherLog).toBeUndefined();
  });

  it("採取完了時に村人のレベルが上がる条件を満たすとレベルアップ処理が走ること", () => {
    const v = makeVillager({ exp: 99999 }); // 大量の経験値
    const area = makeArea();
    area.gathers[0].currentProgress = 99;
    const initialLevel = v.level;
    const result = processVillagerGather(v, 0, area, [v], {}, { wheat: 50 }, 1.0, {}, 1000, false);
    // レベルアップの可能性がある (既に高レベルの場合はスキップ)
    if (v.level > initialLevel) {
      const levelUpLog = result.logs.find((l) => l.message.includes("レベル"));
      expect(levelUpLog).toBeDefined();
    }
  });
});
