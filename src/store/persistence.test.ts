import { describe, it, expect } from "vitest";

import type { GameState, GameActions, Villager, Facility } from "../types/game";
import { getInitialFacilities } from "./initialState";
import { SAVE_VERSION, partialize, merge } from "./persistence";

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

function makeBaseState(): GameState & GameActions {
  return {
    currentDay: 1,
    currentHour: 0,
    gold: 100,
    soulPoints: 0,
    villagers: [makeVillager()],
    facilities: getInitialFacilities(),
    dungeons: [],
    inventory: { wheat: 10 },
    targetAmounts: {},
    logs: [],
    currentTier: 1,
    activeBoss: null,
    bossDefeated: false,
    gameOver: false,
    gameOverReason: "",
    isPaused: true,
    playSpeed: "normal",
    soulUpgrades: {
      heritage: 0,
      storage: 0,
      education: 0,
      body: 0,
      building: 0,
      discount: 0,
    },
    towns: [],
    caravans: [],
    isSalaryUnpaid: false,
    consecutiveNegativeGoldDays: 0,
    lastSchedulerTick: -4,
    maxThreatLevelReached: 0,
    tierStartDay: 1,
    stats: null,
    selectedItem: null,
    tradeRules: [],
    setSelectedItem: () => {},
  } as unknown as GameState & GameActions;
}

describe("persistence.SAVE_VERSION", () => {
  it("現在のセーブデータバージョンは 5 であること", () => {
    expect(SAVE_VERSION).toBe(5);
  });
});

describe("persistence.partialize", () => {
  it("saveVersion フィールドが追加されること", () => {
    const state = makeBaseState();
    const persisted = partialize(state);
    expect(persisted.saveVersion).toBe(SAVE_VERSION);
  });

  it("主要な永続化対象フィールドが含まれること", () => {
    const state = makeBaseState();
    const persisted = partialize(state);
    expect(persisted.gold).toBe(100);
    expect(persisted.currentDay).toBe(1);
    expect(persisted.villagers).toHaveLength(1);
    expect(persisted.facilities).toBeDefined();
    expect(persisted.dungeons).toBeDefined();
    expect(persisted.inventory).toEqual({ wheat: 10 });
  });

  it("アクション関数 (setSelectedItem 等) は含まれないこと", () => {
    const state = makeBaseState();
    const persisted = partialize(state);
    // 型エラー回避のためキャスト。アクションは partialize で除外される
    const persistedAny = persisted as unknown as Record<string, unknown>;
    expect(persistedAny.setSelectedItem).toBeUndefined();
    expect(persistedAny.advanceHour).toBeUndefined();
  });
});

describe("persistence.merge - 入力検証", () => {
  it("persistedState が undefined の場合は currentState をそのまま返すこと", () => {
    const state = makeBaseState();
    const merged = merge(undefined, state);
    expect(merged).toBe(state);
  });

  it("persistedState が null の場合は currentState をそのまま返すこと", () => {
    const state = makeBaseState();
    const merged = merge(null, state);
    expect(merged).toBe(state);
  });
});

describe("persistence.merge - 基本マージ", () => {
  it("currentState の各フィールドを persistedState が上書きすること", () => {
    const state = makeBaseState();
    const persisted = {
      currentDay: 10,
      gold: 999,
      saveVersion: SAVE_VERSION,
    };
    const merged = merge(persisted, state);
    expect(merged.currentDay).toBe(10);
    expect(merged.gold).toBe(999);
  });

  it("saveVersion を最新に更新すること", () => {
    const state = makeBaseState();
    const persisted = { gold: 50 };
    const merged = merge(persisted, state);
    const mergedAny = merged as unknown as { saveVersion: number };
    expect(mergedAny.saveVersion).toBe(SAVE_VERSION);
  });
});

describe("persistence.merge - 重要フィールドの null 保護", () => {
  it("towns が null の場合は currentState の値が維持されること", () => {
    const state = makeBaseState();
    state.towns = [{ id: "komorebi" } as never];
    const persisted = { towns: null, saveVersion: SAVE_VERSION };
    const merged = merge(persisted, state);
    expect(merged.towns).toEqual([{ id: "komorebi" }]);
  });

  it("caravans が null の場合は currentState の値が維持されること", () => {
    const state = makeBaseState();
    state.caravans = [{ id: "caravan_1" } as never];
    const persisted = { caravans: null, saveVersion: SAVE_VERSION };
    const merged = merge(persisted, state);
    expect(merged.caravans).toEqual([{ id: "caravan_1" }]);
  });

  it("soulUpgrades が null の場合は currentState の値が維持されること", () => {
    const state = makeBaseState();
    state.soulUpgrades = { heritage: 5 } as never;
    const persisted = { soulUpgrades: null, saveVersion: SAVE_VERSION };
    const merged = merge(persisted, state);
    expect(merged.soulUpgrades).toEqual({ heritage: 5 });
  });

  it("lastSchedulerTick が undefined の場合は currentState の値が維持されること", () => {
    const state = makeBaseState();
    state.lastSchedulerTick = 100;
    const persisted = {
      lastSchedulerTick: undefined,
      saveVersion: SAVE_VERSION,
    };
    const merged = merge(persisted, state);
    expect(merged.lastSchedulerTick).toBe(100);
  });
});

describe("persistence.merge - inventory / targetAmounts の shallow merge", () => {
  it("inventory は currentState に persisted を shallow merge すること", () => {
    const state = makeBaseState();
    state.inventory = { wheat: 10, vegetable: 5 };
    const persisted = { inventory: { potion: 100 }, saveVersion: SAVE_VERSION };
    const merged = merge(persisted, state);
    // wheat と vegetable は currentState から保持、potion は persisted から追加
    expect(merged.inventory.wheat).toBe(10);
    expect(merged.inventory.vegetable).toBe(5);
    expect(merged.inventory.potion).toBe(100);
  });

  it("targetAmounts も同様に shallow merge されること", () => {
    const state = makeBaseState();
    state.targetAmounts = { wood: 5 };
    const persisted = {
      targetAmounts: { stone: 20 },
      saveVersion: SAVE_VERSION,
    };
    const merged = merge(persisted, state);
    expect(merged.targetAmounts.wood).toBe(5);
    expect(merged.targetAmounts.stone).toBe(20);
  });
});

describe("persistence.merge - Lv0 施設のアップグレードコスト上書き", () => {
  it("Lv0 施設の upgradeCost は getInitialFacilities の最新値で上書きされること", () => {
    const state = makeBaseState();
    const facilities = getInitialFacilities();
    const persistedFacilities = { ...facilities };
    // alchemy (key=alchemy) は初期 Lv0、upgradeCost を不正な値に変更
    (persistedFacilities.alchemy as Facility).upgradeCost = {
      gold: 9999,
      materials: [{ itemId: "dummy", count: 99 }],
    };
    const persisted = {
      facilities: persistedFacilities,
      saveVersion: SAVE_VERSION,
    };
    const merged = merge(persisted, state);
    // 初期値で上書きされている
    expect(merged.facilities.alchemy.upgradeCost.gold).not.toBe(9999);
    // 初期値と一致
    expect(merged.facilities.alchemy.upgradeCost.gold).toBe(
      getInitialFacilities().alchemy.upgradeCost.gold,
    );
    // materials も上書きされている
    expect(merged.facilities.alchemy.upgradeCost.materials).not.toEqual([
      { itemId: "dummy", count: 99 },
    ]);
  });

  it("Lv1 以上の施設は upgradeCost が上書きされないこと", () => {
    const state = makeBaseState();
    const facilities = getInitialFacilities();
    const workshop = facilities.workshop;
    // 既存セーブで Lv2 にアップグレード済み
    const persistedWorkshop: Facility = {
      ...workshop,
      level: 2,
      upgradeCost: { gold: 12345, materials: [] },
    };
    const persisted = {
      facilities: { ...facilities, workshop: persistedWorkshop },
      saveVersion: SAVE_VERSION,
    };
    const merged = merge(persisted, state);
    // Lv2 なので upgradeCost は保持される
    expect(merged.facilities.workshop.upgradeCost.gold).toBe(12345);
  });
});

describe("persistence.merge - マイグレーション", () => {
  it("saveVersion=0 (バージョン管理未導入) のデータを最新までマイグレーションすること", () => {
    const state = makeBaseState();
    const persisted = {
      gold: 50,
      // saveVersion が無い = 0
      villagers: [{ id: "v1", name: "旧村人" }], // potionCount 等が無い
      facilities: {
        inn: { level: 1 }, // trainingQueue 等が無い
      },
      dungeons: [{ id: "forest", name: "森" }], // threatLevel が無い
    };
    const merged = merge(persisted, state);
    const mergedAny = merged as unknown as { saveVersion: number };
    expect(mergedAny.saveVersion).toBe(SAVE_VERSION);
    // 旧村人にデフォルト値が補完されている
    expect(merged.villagers[0].potionCount).toBe(0);
    expect(merged.villagers[0].bonusStr).toBe(0);
    expect(merged.villagers[0].isStarving).toBe(false);
  });

  it("v0 → v1 → v2 → v3 マイグレーションで threatLevel 等の新フィールドが追加されること", () => {
    const state = makeBaseState();
    // v2 の状態 = saveVersion=2、threatLevel なし
    const persisted = {
      saveVersion: 2,
      villagers: [],
      dungeons: [{ id: "forest", name: "森", threatLevel: undefined }],
      maxThreatLevelReached: undefined,
      raidFailureCount: undefined,
    };
    const merged = merge(persisted, state);
    const mergedAny = merged as unknown as { saveVersion: number };
    expect(mergedAny.saveVersion).toBe(SAVE_VERSION);
    expect(merged.maxThreatLevelReached).toBe(0);
    expect(merged.dungeons[0].threatLevel).toBe(0);
  });

  it("v4 → v5 マイグレーションで raid フィールドが削除されること", () => {
    const state = makeBaseState();
    const persisted = {
      saveVersion: 4,
      dungeons: [
        {
          id: "forest",
          name: "森",
          threatLevel: 50,
          raid: { someField: "old" }, // 旧システム
        },
      ],
    };
    const merged = merge(persisted, state);
    const mergedAny = merged as unknown as { saveVersion: number };
    expect(mergedAny.saveVersion).toBe(SAVE_VERSION);
    expect(merged.dungeons[0].threatLevel).toBe(50);
    // raid が削除されている
    expect((merged.dungeons[0] as unknown as { raid?: unknown }).raid).toBeUndefined();
  });

  it("saveVersion がすでに最新の場合は何もしないこと", () => {
    const state = makeBaseState();
    const persisted = { gold: 777, saveVersion: SAVE_VERSION };
    const merged = merge(persisted, state);
    expect(merged.gold).toBe(777);
  });

  it("中間バージョンのマイグレーションがスキップされてもクラッシュしないこと", () => {
    const state = makeBaseState();
    // マイグレーションが定義されていない中間バージョンでもクラッシュしない
    const persisted = { saveVersion: 999, gold: 10 };
    const merged = merge(persisted, state);
    expect(merged.gold).toBe(10);
  });
});
