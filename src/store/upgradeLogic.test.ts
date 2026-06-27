import "./setupMockStorage";
import { describe, it, expect } from "vitest";

import type { GameState, Villager, Facility, FacilityType, DungeonArea } from "../types/game";
import { getInitialFacilities, getInitialTowns, getInitialCaravans } from "./initialState";
import { startFacilityUpgradeHelper } from "./upgradeLogic";

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

function makeState(overrides: Partial<GameState> = {}): GameState {
  const facilities = getInitialFacilities();
  return {
    currentDay: 1,
    currentHour: 0,
    gold: 10000,
    soulPoints: 0,
    villagers: [makeVillager()],
    facilities,
    dungeons: [] as DungeonArea[],
    inventory: {},
    targetAmounts: {},
    logs: [],
    currentTier: 1,
    activeBoss: null,
    bossDefeated: false,
    gameOver: false,
    gameOverReason: "",
    isPaused: false,
    playSpeed: "normal",
    soulUpgrades: {
      heritage: 0,
      storage: 0,
      education: 0,
      body: 0,
      building: 0,
      discount: 0,
    },
    towns: getInitialTowns(),
    caravans: getInitialCaravans(),
    isSalaryUnpaid: false,
    consecutiveNegativeGoldDays: 0,
    lastSchedulerTick: -4,
    maxThreatLevelReached: 0,
    tierStartDay: 1,
    stats: null,
    selectedItem: null,
    tradeRules: [],
    ...overrides,
  } as GameState;
}

describe("upgradeLogic - startFacilityUpgradeHelper", () => {
  describe("前提条件チェック", () => {
    it("存在しない施設ID の場合は null を返すこと", () => {
      const state = makeState();
      const result = startFacilityUpgradeHelper(state, "nonexistent" as FacilityType);
      expect(result).toBeNull();
    });

    it("最大レベルの場合は null を返すこと", () => {
      const facilities = getInitialFacilities();
      const innFacility = {
        ...facilities.inn,
        level: facilities.inn.maxLevel,
      } as Facility;
      facilities.inn = innFacility;
      const state = makeState({ facilities });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result).toBeNull();
    });

    it("既にアップグレード中の場合は警告ログを返すこと", () => {
      const facilities = getInitialFacilities();
      facilities.inn = {
        ...facilities.inn,
        upgradeTimeLeft: 3,
        upgradeAssignedVillagerId: "v1",
      } as Facility;
      const state = makeState({ facilities });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result).not.toBeNull();
      expect(result?.logType).toBe("warning");
      expect(result?.logMessage).toContain("進行中");
    });

    it("ゴールド不足の場合は警告ログを返すこと", () => {
      const state = makeState({ gold: 0 });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result).not.toBeNull();
      expect(result?.logType).toBe("warning");
      expect(result?.logMessage).toContain("ゴールド");
    });

    it("素材不足の場合は警告ログを返すこと", () => {
      const state = makeState({ inventory: {} });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result).not.toBeNull();
      expect(result?.logType).toBe("warning");
      expect(result?.logMessage).toContain("素材");
    });
  });

  describe("正常系", () => {
    it("施設アップグレードが即座に開始され、upgradeTimeLeft が設定されること", () => {
      // 素材は十分なゴールドと素材を用意
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
      });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result).not.toBeNull();
      expect(result?.facilities.inn.upgradeTimeLeft).toBeGreaterThan(0);
      expect(result?.facilities.inn.upgradeAssignedVillagerId).toBe("v1");
      expect(result?.logType).toBe("upgrade");
    });

    it("アップグレード開始時にゴールドが減少し、担当村人の gold が増加すること", () => {
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
      });
      const initialPlayerGold = state.gold;
      const initialVillagerGold = state.villagers[0].gold;
      const result = startFacilityUpgradeHelper(state, "inn");
      // ゴールド差し引き（ゴールドは村人 gold に回るがプレイヤー金から減る）
      expect(result!.gold).toBeLessThan(initialPlayerGold);
      // 担当村人のステータス確認
      expect(result!.villagers[0].status).toBe("active");
      // 村人の gold が増えた（プレイヤー金から移動）
      expect(result!.villagers[0].gold).toBeGreaterThan(initialVillagerGold);
    });

    it("村の idle 村人を担当として即座にアップグレード開始すること", () => {
      const v = makeVillager({ id: "v1", status: "idle" });
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
        villagers: [v],
      });
      const result = startFacilityUpgradeHelper(state, "inn");
      expect(result?.villagers[0].status).toBe("active");
      expect(result?.facilities.inn.upgradeAssignedVillagerId).toBe("v1");
    });

    it("ダンジョン活動中の村人は帰還予約として traveling_back 状態になること", () => {
      const v = makeVillager({
        id: "v1",
        status: "active",
        order: "hunt",
        destinationAreaId: "forest",
      });
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
        villagers: [v],
        dungeons: [{ id: "forest", name: "森", distance: 3 } as DungeonArea],
      });
      const result = startFacilityUpgradeHelper(state, "inn");
      // active 村人は帰還状態に
      expect(result?.villagers[0].status).toBe("traveling_back");
      expect(result?.villagers[0].travelTimeLeft).toBeGreaterThan(0);
      // ログは「予約」
      expect(result?.logMessage).toContain("予約");
    });
  });

  describe("ソウルバフ", () => {
    it("building ソウルバフでアップグレードコストが減額されること", () => {
      // 通常コストで計算した gold 消費量を building Lv0/Lv3 で比較
      const stateNoBuff = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
        soulUpgrades: {
          heritage: 0,
          storage: 0,
          education: 0,
          body: 0,
          building: 0,
          discount: 0,
        },
      });
      const stateWithBuff = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
        soulUpgrades: {
          heritage: 0,
          storage: 0,
          education: 0,
          body: 0,
          building: 3,
          discount: 0,
        },
      });
      const costNoBuff = stateNoBuff.gold - startFacilityUpgradeHelper(stateNoBuff, "inn")!.gold;
      const costWithBuff =
        stateWithBuff.gold - startFacilityUpgradeHelper(stateWithBuff, "inn")!.gold;
      // building バフで減額 → コストが小さい
      expect(costWithBuff).toBeLessThan(costNoBuff);
    });
  });

  describe("村人選択", () => {
    it("担当村人が明示的に指定された場合、その村人が割り当てられること", () => {
      const v1 = makeVillager({ id: "v1", status: "idle", currentJob: "農民" });
      const v2 = makeVillager({ id: "v2", status: "idle", currentJob: "職人" });
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
        villagers: [v1, v2],
      });
      const result = startFacilityUpgradeHelper(state, "inn", "v1");
      expect(result?.facilities.inn.upgradeAssignedVillagerId).toBe("v1");
    });

    it("指定された村人が存在しない場合はフォールバックして upgrade が実行されること", () => {
      // 指定された villagerId が見つからない場合、selectBestUpgradeVillager がフォールバック
      const state = makeState({
        gold: 10000,
        inventory: { wood: 100, stone: 100 },
      });
      const result = startFacilityUpgradeHelper(state, "inn", "nonexistent_villager");
      expect(result).not.toBeNull();
      expect(result?.logType).toBe("upgrade");
      // 既定の村人 (v1) が割り当てられる
      expect(result?.facilities.inn.upgradeAssignedVillagerId).toBe("v1");
    });
  });
});
