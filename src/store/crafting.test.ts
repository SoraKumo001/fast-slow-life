import "./setupMockStorage";
import { describe, it, expect, vi, afterEach } from "vitest";

import { getInitialFacilities } from "./initialState";
import { processAutoCraft, processCraftingAndUpgrades } from "./crafting";
import type { Villager, Facility, FacilityType } from "../types/game";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト職人",
    currentJob: "職人",
    jobHistory: ["職人"],
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

function makeFacilities(overrides: Partial<Record<FacilityType, Partial<Facility>>> = {}) {
  const base = getInitialFacilities();
  const result = { ...base };
  (Object.keys(overrides) as FacilityType[]).forEach((key) => {
    result[key] = { ...base[key], ...(overrides[key] || {}) } as Facility;
  });
  return result;
}

describe("crafting - processCraftingAndUpgrades: 施設アップグレード", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("アップグレード完了で施設のレベルが上がり、担当村人が解放されること", () => {
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        upgradeTimeLeft: 1, // 1時間で完了
        upgradeTotalTime: 1,
        upgradeAssignedVillagerId: "v1",
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "active", assignedCraftJobId: "upg_1" })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 0, 1);
    expect(result.facilities.workshop.level).toBe(2);
    expect(result.facilities.workshop.upgradeTimeLeft).toBe(0);
    expect(result.facilities.workshop.upgradeAssignedVillagerId).toBeNull();
    expect(result.villagers[0].status).toBe("idle");
    expect(result.villagers[0].assignedCraftJobId).toBeNull();
  });

  it("アップグレード進行中で完了しない場合は時間が減るだけ", () => {
    const facilities = makeFacilities({
      workshop: { level: 1, upgradeTimeLeft: 5, upgradeTotalTime: 10 } as Partial<Facility>,
    });
    const result = processCraftingAndUpgrades(facilities, [makeVillager()], {}, {}, 0, 1);
    expect(result.facilities.workshop.level).toBe(1);
    expect(result.facilities.workshop.upgradeTimeLeft).toBe(4);
  });

  it("アップグレード完了時にログが出力されること", () => {
    const facilities = makeFacilities({
      inn: { level: 1, upgradeTimeLeft: 1, upgradeTotalTime: 1 } as Partial<Facility>,
    });
    const result = processCraftingAndUpgrades(facilities, [makeVillager()], {}, {}, 0, 1);
    const log = result.logs.find((l) => l.message.includes("アップグレードが完了"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("upgrade");
  });
});

describe("crafting - processCraftingAndUpgrades: クラフト完了", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Math.random=0 (大成功) でアイテムが2倍生成されること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          {
            id: "job1",
            itemId: "iron_ingot",
            timeLeft: 1,
            totalTime: 1,
            assignedVillagerId: "v1",
          },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "active", assignedCraftJobId: "job1" })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 100, 1);
    // iron_ingot のレシピ outputCount が 1 で大成功なので 2
    expect(result.inventory.iron_ingot).toBe(2);
    const greatLog = result.logs.find((l) => l.message.includes("大成功"));
    expect(greatLog).toBeDefined();
  });

  it("Math.random=0.99 (大成功失敗) でアイテムが1個生成されること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          {
            id: "job1",
            itemId: "iron_ingot",
            timeLeft: 1,
            totalTime: 1,
            assignedVillagerId: "v1",
          },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "active", assignedCraftJobId: "job1" })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 100, 1);
    expect(result.inventory.iron_ingot).toBe(1);
  });

  it("クラフト完了時に担当村人が解放されて status=idle になること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          {
            id: "job1",
            itemId: "iron_ingot",
            timeLeft: 1,
            totalTime: 1,
            assignedVillagerId: "v1",
          },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "active", assignedCraftJobId: "job1" })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 100, 1);
    expect(result.villagers[0].status).toBe("idle");
    expect(result.villagers[0].assignedCraftJobId).toBeNull();
  });

  it("クラフト完了で工賃が支払われ gold が減少・村人 gold が増加すること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          {
            id: "job1",
            itemId: "iron_ingot",
            timeLeft: 1,
            totalTime: 1,
            assignedVillagerId: "v1",
          },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "active", assignedCraftJobId: "job1", dex: 20 })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 1000, 1);
    // プレイヤーゴールド減少・村人ゴールド増加
    expect(result.gold).toBeLessThan(1000);
    expect(result.villagers[0].gold).toBeGreaterThan(0);
  });

  it("進行中のクラフトジョブはキューに残る", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          {
            id: "job1",
            itemId: "iron_ingot",
            timeLeft: 3,
            totalTime: 5,
            assignedVillagerId: "v1",
          },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1" })];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 100, 1);
    expect(result.facilities.workshop.craftQueue).toHaveLength(1);
    expect(result.facilities.workshop.craftQueue[0].timeLeft).toBe(2);
  });

  it("村人が割り当てられていないクラフトジョブでも完了処理は実行されること", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          { id: "job1", itemId: "iron_ingot", timeLeft: 1, totalTime: 1, assignedVillagerId: null },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    const result = processCraftingAndUpgrades(facilities, villagers, {}, {}, 100, 1);
    expect(result.inventory.iron_ingot).toBe(1);
    // 工賃支払いは発生しない
    expect(result.gold).toBe(100);
  });
});

describe("crafting - processAutoCraft", () => {
  it("施設Lv0 では自動クラフトしないこと", () => {
    const facilities = makeFacilities({
      alchemy: { level: 0 } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    const result = processAutoCraft(facilities, villagers, { herb: 100 }, { potion: 5 });
    expect(result.facilities.alchemy.craftQueue).toHaveLength(0);
  });

  it("素材不足の場合は自動クラフトしないこと", () => {
    const facilities = makeFacilities({
      alchemy: { level: 1 } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    // potion レシピに必要な素材がない
    const result = processAutoCraft(facilities, villagers, {}, { potion: 5 });
    expect(result.facilities.alchemy.craftQueue).toHaveLength(0);
  });

  it("素材あり・在庫不足の場合に自動クラフトがキューに追加されること", () => {
    const facilities = makeFacilities({
      workshop: { level: 1 } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    // wood_plank: wood 3個が必要
    const inventory = { wood: 5 };
    const result = processAutoCraft(facilities, villagers, inventory, { wood_plank: 3 });
    // キューにクラフトジョブが追加される
    expect(result.facilities.workshop.craftQueue.length).toBeGreaterThan(0);
    // 素材が消費される
    expect(result.inventory.wood).toBeLessThan(5);
  });

  it("在庫が目標量以上の場合は自動クラフトしないこと", () => {
    const facilities = makeFacilities({
      workshop: { level: 1 } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    // wood_plank を既に 3 持っている → target 3 で達成
    const inventory = { wood_plank: 3, wood: 5 };
    const result = processAutoCraft(facilities, villagers, inventory, { wood_plank: 3 });
    expect(result.facilities.workshop.craftQueue).toHaveLength(0);
  });

  it("担当の村人が active ステータスになること", () => {
    const facilities = makeFacilities({
      workshop: { level: 1 } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", status: "idle" })];
    const inventory = { wood: 5 };
    const result = processAutoCraft(facilities, villagers, inventory, { wood_plank: 3 });
    // 担当にされた村人は active になり、craftJobId が設定される
    const assignedVillager = result.villagers[0];
    expect(assignedVillager.status).toBe("active");
    expect(assignedVillager.assignedCraftJobId).not.toBeNull();
  });

  it("クラフトキューが満杯の場合は新規追加しないこと", () => {
    const facilities = makeFacilities({
      workshop: {
        level: 1,
        craftQueue: [
          { id: "j1", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j2", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j3", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j4", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j5", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager()];
    const inventory = { wood: 5 };
    const result = processAutoCraft(facilities, villagers, inventory, { wood_plank: 10 });
    // キューは5のまま
    expect(result.facilities.workshop.craftQueue).toHaveLength(5);
  });

  it("回帰: 複数レシピがあり空き1でも上限4を超えないこと", () => {
    // workshop level=3 で wood_plank/iron_ingot/silver_ingot/reinforced_plank/crystal_powder の
    // 5レシピが対象。素材と目標量を全レシピに設定 → 元コードでは5件 push して上限超過していた
    const facilities = makeFacilities({
      workshop: {
        level: 3,
        craftQueue: [
          { id: "j1", itemId: "wood_plank", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j2", itemId: "iron_ingot", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
          { id: "j3", itemId: "silver_ingot", timeLeft: 5, totalTime: 5, assignedVillagerId: null },
        ],
      } as Partial<Facility>,
    });
    const villagers = [makeVillager({ id: "v1", currentJob: "農民" })];
    const inventory = {
      wood: 100,
      iron_ore: 100,
      silver_ore: 100,
      crystal_fragment: 100,
      wood_plank: 0,
      iron_ingot: 0,
      silver_ingot: 0,
      reinforced_plank: 0,
      crystal_powder: 0,
    };
    const result = processAutoCraft(facilities, villagers, inventory, {
      wood_plank: 10,
      iron_ingot: 10,
      silver_ingot: 10,
      reinforced_plank: 10,
      crystal_powder: 10,
    });
    // 空きは 1 なので 1 件だけ追加され、上限 4 を超えない
    expect(result.facilities.workshop.craftQueue.length).toBeLessThanOrEqual(4);
    expect(result.facilities.workshop.craftQueue.length).toBeGreaterThan(3);
  });
});