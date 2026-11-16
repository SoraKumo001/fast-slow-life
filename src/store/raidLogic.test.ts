import { describe, it, expect, vi, afterEach } from "vitest";

import type {
  DungeonArea,
  DungeonMonster,
  Facility,
  FacilityType,
  GameState,
  Villager,
} from "../types/game";
import { calculateAdvanceHour } from "./gameLoop/index";
import { useGameStore } from "./gameStore";
import {
  getInitialCaravans,
  getInitialDailyFlows,
  getInitialDungeons,
  getInitialFacilities,
  getInitialRevealedNodes,
  getInitialStats,
  getInitialTowns,
  getInitialVillagers,
} from "./initialState";
import {
  buildRaidState,
  countAliveRaidMonsters,
  getRaidDefenders,
  getRaidMonsterHp,
  isRaidFighting,
  raidBaseMonsterId,
  resolveRaidRound,
  selectRaidMonsterBases,
} from "./raidLogic";
import { resolveVillagerDestination } from "./town/townSpatial";
import { dispatchIdleVillagersHelper } from "./villagerDispatch";

// ──────────────────────────────────────────
// フィクスチャ
// ──────────────────────────────────────────

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

function makeMonster(overrides: Partial<DungeonMonster> = {}): DungeonMonster {
  return {
    id: "slime",
    name: "スライム",
    level: 1,
    hp: 10,
    maxHp: 10,
    atk: 1,
    def: 0,
    mdef: 0,
    str: 1,
    int: 0,
    dex: 1,
    agi: 1,
    vit: 0,
    expReward: 5,
    drops: [{ itemId: "wheat", chance: 1 }],
    isBoss: false,
    unlockedAtProgress: 0,
    ...overrides,
  } as DungeonMonster;
}

function makeDungeon(overrides: Partial<DungeonArea> = {}): DungeonArea {
  return {
    id: "forest",
    name: "始まりの森",
    distance: 1,
    maxDepth: 100,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [
      { itemId: "wheat", difficulty: 1.0, unlockedAtProgress: 0 },
      { itemId: "herb", difficulty: 1.0, unlockedAtProgress: 0 },
    ],
    monsters: [makeMonster()],
    explorationProgress: 100,
    difficulty: 1.0,
    threatLevel: 100,
    ...overrides,
  } as DungeonArea;
}

function makeFacilities(): Record<FacilityType, Facility> {
  return getInitialFacilities();
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────
// 編成
// ──────────────────────────────────────────

describe("selectRaidMonsterBases / buildRaidState", () => {
  it("強さ順（レベル降順）に選び、ボスは除外する", () => {
    const dungeon = makeDungeon({
      monsters: [
        makeMonster({ id: "weak", level: 1 }),
        makeMonster({ id: "boss", level: 9, isBoss: true }),
        makeMonster({ id: "strong", level: 5 }),
        makeMonster({ id: "mid", level: 3 }),
      ],
    });
    const bases = selectRaidMonsterBases(dungeon);
    expect(bases.map((m) => m.id)).toEqual(["strong", "mid", "weak"]);
  });

  it("種類が足りない場合は循環して3体にし、インスタンスIDは一意になる", () => {
    const dungeon = makeDungeon({
      monsters: [makeMonster({ id: "a", level: 5 }), makeMonster({ id: "b", level: 1 })],
    });
    const raid = buildRaidState(dungeon, 100);
    expect(raid).not.toBeNull();
    expect(raid!.monsterIds).toHaveLength(3);
    expect(new Set(raid!.monsterIds).size).toBe(3);
    expect(raidBaseMonsterId(raid!.monsterIds[2])).toBe("a"); // 最強が循環で3体目
    expect(raid!.arrivesAtElapsedHour).toBe(106); // 到着まで6時間
    for (const id of raid!.monsterIds) {
      expect(getRaidMonsterHp(raid!, dungeon, id)).toBe(10); // 満タン
    }
  });

  it("種類が多い場合は最大5体まで", () => {
    const dungeon = makeDungeon({
      monsters: Array.from({ length: 8 }, (_, i) =>
        makeMonster({ id: `m${i}`, level: i + 1 }),
      ),
    });
    const raid = buildRaidState(dungeon, 0);
    expect(raid!.monsterIds).toHaveLength(5);
    expect(countAliveRaidMonsters(raid!, dungeon)).toBe(5);
  });

  it("決定的である（同じ入力で同じ編成）", () => {
    const dungeon = makeDungeon({
      monsters: [
        makeMonster({ id: "x", level: 2, atk: 5 }),
        makeMonster({ id: "y", level: 2, atk: 9 }),
        makeMonster({ id: "z", level: 2, atk: 9, maxHp: 50, hp: 50 }),
      ],
    });
    expect(buildRaidState(dungeon, 7)).toEqual(buildRaidState(dungeon, 7));
  });

  it("ボスしかいないダンジョンでは襲撃を編成できない", () => {
    const dungeon = makeDungeon({ monsters: [makeMonster({ id: "boss", isBoss: true })] });
    expect(buildRaidState(dungeon, 0)).toBeNull();
  });

  it("isRaidFighting は到着時刻で切り替わる", () => {
    const raid = buildRaidState(makeDungeon(), 10)!;
    expect(isRaidFighting(raid, 15)).toBe(false);
    expect(isRaidFighting(raid, 16)).toBe(true);
    expect(isRaidFighting(null, 99)).toBe(false);
  });
});

// ──────────────────────────────────────────
// 防衛側の選定
// ──────────────────────────────────────────

describe("getRaidDefenders", () => {
  it("町にいる村人（休息中・施設作業中を含む）が防衛者になり、町外とHP0は除外される", () => {
    const villagers = [
      makeVillager({ id: "idle", status: "idle", currentHp: 80 }),
      makeVillager({ id: "resting", status: "resting", currentHp: 50 }),
      makeVillager({
        id: "crafter",
        status: "active",
        destinationAreaId: null,
        assignedCraftJobId: "job1",
        currentHp: 100,
      }),
      makeVillager({ id: "going", status: "traveling_to", currentHp: 100 }),
      makeVillager({ id: "back", status: "traveling_back", currentHp: 100 }),
      makeVillager({
        id: "away",
        status: "active",
        destinationAreaId: "forest",
        currentHp: 100,
      }),
      makeVillager({ id: "down", status: "idle", currentHp: 0 }),
    ];
    const defenders = getRaidDefenders(villagers);
    expect(defenders.map((v) => v.id).sort()).toEqual(["crafter", "idle", "resting"]);
  });
});

// ──────────────────────────────────────────
// 防衛戦ラウンド
// ──────────────────────────────────────────

describe("resolveRaidRound", () => {
  it("勝利: 群れを全滅させると脅威度30・戦利品・経験値が得られ、休息中の村人も参加する", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // 全攻撃命中
    const dungeon = makeDungeon(); // スライム hp10 が3体（循環編成）
    const raid = buildRaidState(dungeon, 0)!;
    const defenders = [
      makeVillager({ id: "a", name: "A", str: 50, agi: 30 }),
      makeVillager({ id: "b", name: "B", str: 50, agi: 20, status: "resting" }),
      makeVillager({ id: "c", name: "C", str: 50, agi: 10 }),
    ];
    const result = resolveRaidRound({
      raid,
      dungeon,
      villagers: defenders,
      inventory: {},
      gold: 500,
      facilities: makeFacilities(),
    });
    expect(result.outcome).toBe("victory");
    expect(result.raid).toBeNull();
    expect(result.dungeon.threatLevel).toBe(30);
    // 戦利品: 採取物から最大3種 ×2
    expect(result.inventory.wheat).toBe(2);
    expect(result.inventory.herb).toBe(2);
    // 経験値: 3体 × expReward 5 = 15（全生存者へ）
    for (const v of result.villagers) {
      expect(v.exp).toBe(15);
      expect(v.currentHp).toBe(100); // 敵の反撃前に全滅させたので無傷
    }
    expect(result.logs.some((l) => l.message.includes("勝利"))).toBe(true);
  });

  it("襲撃側HPはラウンドをまたいで保持される（集中攻撃で先頭だけ減る）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const tough = makeMonster({ id: "tough", hp: 200, maxHp: 200, atk: 5, dex: 1 });
    const dungeon = makeDungeon({ monsters: [tough] });
    const raid = buildRaidState(dungeon, 0)!;
    const defender = makeVillager({
      id: "solo",
      str: 10,
      dex: 10,
      agi: 10,
      vit: 10,
      maxHp: 500,
      currentHp: 500,
    });

    // 1ラウンド目: 村人の攻撃 22 ダメージ（str10→15、クリティカル×1.5）
    // 敵3体の反撃は各18ダメージ（最低ダメージ10×クリティカル1.8）
    const round1 = resolveRaidRound({
      raid,
      dungeon,
      villagers: [defender],
      inventory: {},
      gold: 0,
      facilities: makeFacilities(),
    });
    expect(round1.outcome).toBe("ongoing");
    expect(round1.raid).not.toBeNull();
    const [first, second, third] = round1.raid!.monsterIds;
    expect(round1.raid!.monsterHps[first]).toBe(178);
    expect(round1.raid!.monsterHps[second]).toBe(200);
    expect(round1.raid!.monsterHps[third]).toBe(200);
    expect(round1.villagers[0].currentHp).toBe(446);

    // 2ラウンド目: 前ラウンドのHPから継続する
    const round2 = resolveRaidRound({
      raid: round1.raid!,
      dungeon,
      villagers: round1.villagers,
      inventory: {},
      gold: 0,
      facilities: makeFacilities(),
    });
    expect(round2.outcome).toBe("ongoing");
    expect(round2.raid!.monsterHps[first]).toBe(156);
    expect(round2.villagers[0].currentHp).toBe(392);
  });

  it("敗北: 防衛側が全滅すると略奪され、施設がLv-1し、脅威度50になる（ゲームオーバーではない）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const brute = makeMonster({
      id: "brute",
      hp: 5000,
      maxHp: 5000,
      atk: 200,
      dex: 10,
      expReward: 0,
    });
    const dungeon = makeDungeon({ monsters: [brute] });
    const raid = buildRaidState(dungeon, 0)!;
    const facilities = makeFacilities();
    facilities.workshop = { ...facilities.workshop, level: 3 };
    const defender = makeVillager({ id: "weak", currentHp: 30, maxHp: 30, str: 5 });

    const result = resolveRaidRound({
      raid,
      dungeon,
      villagers: [defender],
      inventory: { wheat: 8 },
      gold: 1000,
      facilities,
    });
    expect(result.outcome).toBe("defeat");
    expect(result.raid).toBeNull();
    expect(result.dungeon.threatLevel).toBe(50);
    expect(result.gold).toBe(800); // 金庫の20%を略奪
    expect(result.inventory.wheat).toBe(6); // 8個から2個（1/4）略奪
    expect(result.facilities.workshop.level).toBe(2); // 最もLvの高い施設がLv-1
    const downed = result.villagers[0];
    expect(downed.currentHp).toBe(0);
    expect(downed.status).toBe("resting"); // 戦闘不能 → 休息（死亡しない）
    expect(downed.order).toBe("rest");
    expect(result.logs.some((l) => l.message.includes("敗北"))).toBe(true);
  });

  it("Phase 6: 連敗数に応じて略奪率が上がる（2連敗目=30%、上限50%）", () => {
    const dungeon = makeDungeon();
    const raid = buildRaidState(dungeon, 0)!;
    const facilities = makeFacilities();
    // 防衛者ゼロ → 即敗北。金庫1000で率だけを見る
    const r1 = resolveRaidRound({
      raid,
      dungeon,
      villagers: [],
      inventory: {},
      gold: 1000,
      facilities,
      defeatStreak: 1,
    });
    expect(r1.outcome).toBe("defeat");
    expect(r1.gold).toBe(700); // 30% 略奪
    expect(r1.nextDefeatStreak).toBe(2);

    const r2 = resolveRaidRound({
      raid,
      dungeon,
      villagers: [],
      inventory: {},
      gold: 1000,
      facilities,
      defeatStreak: 10,
    });
    expect(r2.gold).toBe(500); // 上限50%
    expect(r2.nextDefeatStreak).toBe(11);
  });

  it("Phase 6: 勝利で連敗数がリセットされ、継続中は据え置き", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // 全攻撃命中
    const dungeon = makeDungeon(); // スライム hp10 が3体
    const raid = buildRaidState(dungeon, 0)!;
    const defenders = [
      makeVillager({ id: "a", name: "A", str: 50, agi: 30 }),
      makeVillager({ id: "b", name: "B", str: 50, agi: 20 }),
      makeVillager({ id: "c", name: "C", str: 50, agi: 10 }),
    ];
    const win = resolveRaidRound({
      raid,
      dungeon,
      villagers: defenders,
      inventory: {},
      gold: 0,
      facilities: makeFacilities(),
      defeatStreak: 3,
    });
    expect(win.outcome).toBe("victory");
    expect(win.nextDefeatStreak).toBe(0);
  });

  it("敗北時、Lv2以上の施設がなければ施設は下がらない（Lv1未満にはならない）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const dungeon = makeDungeon();
    const raid = buildRaidState(dungeon, 0)!;
    const facilities = makeFacilities(); // 全て Lv1 以下
    const result = resolveRaidRound({
      raid,
      dungeon,
      villagers: [], // 防衛者ゼロ → 即敗北
      inventory: {},
      gold: 100,
      facilities,
    });
    expect(result.outcome).toBe("defeat");
    expect(result.gold).toBe(80);
    for (const f of Object.values(result.facilities)) {
      expect(f.level).toBeGreaterThanOrEqual(0);
    }
    expect(result.facilities.inn.level).toBe(1);
    expect(result.facilities.workshop.level).toBe(1);
  });
});

// ──────────────────────────────────────────
// 派遣ブロック
// ──────────────────────────────────────────

describe("襲撃中の派遣ブロック", () => {
  it("blockedAreaId のダンジョンへは自動派遣されない", () => {
    const villager = makeVillager({ status: "idle", order: "gather" });
    const dungeon = makeDungeon();
    const base = {
      villagers: [villager],
      inventory: {},
      targetAmounts: {},
      dungeons: [dungeon],
      currentTier: 1,
      bossDefeated: false,
      gold: 0,
      facilities: makeFacilities(),
    };
    const blocked = dispatchIdleVillagersHelper({ ...base, blockedAreaId: "forest" });
    expect(blocked.anyDispatched).toBe(false);
    expect(blocked.villagers[0].status).toBe("idle");

    const allowed = dispatchIdleVillagersHelper({ ...base, blockedAreaId: null });
    expect(allowed.anyDispatched).toBe(true);
    expect(allowed.villagers[0].status).toBe("traveling_to");
    expect(allowed.villagers[0].destinationAreaId).toBe("forest");
  });
});

describe("ストアアクションの手動派遣ブロック", () => {
  it("dispatchParty / setVillagerOrder が襲撃中ダンジョンへの派遣を拒否する", () => {
    useGameStore.getState().resetGame(false);
    const state = useGameStore.getState();
    const target = state.villagers[0];
    const forestId = state.dungeons[0].id;
    useGameStore.setState({
      raid: {
        dungeonId: forestId,
        arrivesAtElapsedHour: 9999,
        monsterIds: ["slime@1"],
        monsterHps: { "slime@1": 10 },
      },
    });

    useGameStore.getState().dispatchParty({
      villagerIds: [target.id],
      areaId: forestId,
      order: "gather",
      targetId: null,
    });
    expect(
      useGameStore.getState().villagers.find((v) => v.id === target.id)!.status,
    ).toBe("idle");

    useGameStore.getState().setVillagerOrder({
      id: target.id,
      order: "gather",
      areaId: forestId,
    });
    expect(
      useGameStore.getState().villagers.find((v) => v.id === target.id)!.status,
    ).toBe("idle");

    // 襲撃と無関係のダンジョンへは通常どおり派遣できる
    const other = useGameStore.getState().dungeons[1];
    useGameStore.getState().dispatchParty({
      villagerIds: [target.id],
      areaId: other.id,
      order: "gather",
      targetId: null,
    });
    expect(
      useGameStore.getState().villagers.find((v) => v.id === target.id)!.status,
    ).toBe("traveling_to");
  });
});

// ──────────────────────────────────────────
// パイプライン統合（calculateAdvanceHour）
// ──────────────────────────────────────────

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    currentDay: 1,
    currentHour: 0,
    gold: 1000,
    soulPoints: 0,
    soulUpgrades: {},
    villagers: getInitialVillagers(),
    facilities: getInitialFacilities(),
    dungeons: getInitialDungeons(),
    inventory: {},
    targetAmounts: {},
    marketPrices: {},
    pricePolicy: "standard",
    lastSettlement: null,
    dailyFlows: getInitialDailyFlows(),
    towns: getInitialTowns(),
    caravans: getInitialCaravans(),
    activeBoss: null,
    bossDefeated: false,
    gameOver: false,
    gameOverReason: "",
    isPaused: false,
    playSpeed: "normal",
    selectedItem: null,
    dungeonEvents: [],
    revealedNodes: getInitialRevealedNodes(),
    raid: null,
    consecutiveNegativeGoldDays: 0,
    lastSchedulerTick: 0,
    maxThreatLevelReached: 0,
    tierStartDay: 1,
    stats: getInitialStats(),
    tradeRules: [],
    logs: [],
    isSalaryUnpaid: false,
    currentTier: 1,
    ...overrides,
  } as GameState;
}

describe("calculateAdvanceHour と襲撃", () => {
  it("脅威度が100%に達すると襲撃が発生し、ゲームオーバーにはならない", () => {
    const dungeons = getInitialDungeons();
    const forest = { ...dungeons[0], threatLevel: 99.86 };
    const state = makeState({
      dungeons: [forest, ...dungeons.slice(1)],
      // advanceHour で day=5, hour=16 になり tierElapsedHours=88。
      // Phase 5 の脅威度定数では delta (calc(88)-calc(87)≈0.43) で 100% を超える
      currentDay: 5,
      currentHour: 15,
    });
    const result = calculateAdvanceHour(state);
    expect(result.gameOver).toBe(false);
    expect(result.raid).not.toBeNull();
    expect(result.raid!.dungeonId).toBe(forest.id);
    expect(result.raid!.monsterIds.length).toBeGreaterThanOrEqual(3);
    const after = result.dungeons.find((d) => d.id === forest.id);
    expect(after!.threatLevel).toBe(100);
    expect(result.logsToAppend.some((l) => l.message.includes("進軍中"))).toBe(true);
  });

  it("進軍中は脅威度が100%に留まる（お布施で下がった想定でも戻る）", () => {
    const dungeons = getInitialDungeons();
    const forest = { ...dungeons[0], threatLevel: 40 };
    const raid = buildRaidState(forest, 0)!; // 到着は elapsed 6
    const state = makeState({
      dungeons: [forest, ...dungeons.slice(1)],
      raid,
      currentDay: 1,
      currentHour: 0,
    });
    const result = calculateAdvanceHour(state);
    expect(result.gameOver).toBe(false);
    expect(result.raid).not.toBeNull();
    const after = result.dungeons.find((d) => d.id === forest.id);
    expect(after!.threatLevel).toBe(100);
    // まだ到着していないので村人は無傷
    for (const v of result.villagers) {
      expect(v.currentHp).toBe(v.maxHp);
    }
  });

  it("到着すると防衛戦が始まり、襲撃側HPが減る（または解決する）", () => {
    const dungeons = getInitialDungeons();
    const weak = makeMonster({ id: "weak_slime", hp: 10, maxHp: 10, atk: 1 });
    const forest = {
      ...dungeons[0],
      threatLevel: 100,
      monsters: [weak],
      gathers: dungeons[0].gathers,
    };
    const raid = {
      dungeonId: forest.id,
      arrivesAtElapsedHour: 1,
      monsterIds: ["weak_slime@1", "weak_slime@2", "weak_slime@3"],
      monsterHps: { "weak_slime@1": 10, "weak_slime@2": 10, "weak_slime@3": 10 },
    };
    const state = makeState({
      dungeons: [forest, ...dungeons.slice(1)],
      raid,
      currentDay: 1,
      currentHour: 0,
    });
    const result = calculateAdvanceHour(state);
    expect(result.gameOver).toBe(false);
    expect(result.logsToAppend.some((l) => l.message.includes("防衛戦開始"))).toBe(true);
    if (result.raid === null) {
      // 勝利した場合は脅威度30にリセットされている
      const after = result.dungeons.find((d) => d.id === forest.id);
      expect(after!.threatLevel).toBe(30);
    } else {
      const totalHp = Object.values(result.raid.monsterHps).reduce((a, b) => a + b, 0);
      expect(totalHp).toBeLessThan(30);
    }
  });
});

// ──────────────────────────────────────────
// townSpatial の防衛時分岐
// ──────────────────────────────────────────

describe("townSpatial: 防衛戦中は門に集結する", () => {
  it("休息中の村人でも defenceActive なら門へ向かう", () => {
    const facilities = makeFacilities();
    const resting = makeVillager({ status: "resting", currentHp: 50 });
    const normal = resolveVillagerDestination(resting, facilities, null, 10, 0);
    expect(normal.activity).toBe("rest");
    const defence = resolveVillagerDestination(resting, facilities, null, 10, 0, undefined, true);
    expect(defence.activity).toBe("defence");
    expect(defence.buildingId).toBe("gate");
  });

  it("町外（移動中）の村人は防衛分岐より移動が優先される", () => {
    const facilities = makeFacilities();
    const going = makeVillager({ status: "traveling_to", destinationAreaId: "forest" });
    const dest = resolveVillagerDestination(going, facilities, null, 10, 0, undefined, true);
    expect(dest.activity).toBe("dungeon");
  });
});
