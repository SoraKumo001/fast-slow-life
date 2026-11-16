/**
 * 経済v2 §10: 金の保存則テスト
 *
 * 内部フロー（プール買取・食料代・クラフト賃金・宿代）はすべて「移転」であり、
 * 金の総量（金庫 + 全村人の gold 合計）を変えない。総量が変わるのは対外フロー
 * （キャラバン輸出入・施設アップグレード費・雇用費など）だけである。
 *
 * このテストではキャラバン等の対外フローを止めた固定シナリオで
 * calculateAdvanceHour を24時間（1日）回し、総量が一致することを固定する。
 */
import { describe, it, expect } from "vitest";

import type { GameState, Villager } from "../types/game";
import { calculateAdvanceHour } from "./gameLoop";
import {
  getDefaultTargetAmounts,
  getInitialCaravans,
  getInitialDailyFlows,
  getInitialDungeons,
  getInitialFacilities,
  getInitialStats,
  getInitialTowns,
} from "./initialState";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
    level: 1,
    exp: 0,
    currentJob: "無職",
    jobHistory: ["無職"],
    maxHp: 1000,
    currentHp: 100,
    stamina: 0,
    maxStamina: 1000,
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
    weaponId: "none",
    armorId: "none",
    order: "rest",
    status: "resting",
    destinationAreaId: null,
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetMonsterId: null,
    potionCount: 0,
    staminaDrinkCount: 0,
    potionItemId: undefined,
    staminaDrinkItemId: undefined,
    autoTargetName: null,
    partyEngagementOffset: undefined,
    activeFoodBuffId: null,
    gold: 0,
    lastTrainingDay: 0,
    pool: {},
    isStarving: false,
    ...overrides,
  } as Villager;
}

function totalGold(state: GameState): number {
  return state.gold + state.villagers.reduce((sum, v) => sum + (v.gold || 0), 0);
}

describe("経済v2: 金の保存則", () => {
  it("対外フローを止めた1日では金庫+全村人の gold 合計が不変であること", () => {
    const facilities = getInitialFacilities();
    // クラフトジョブ（1時間で完了）を工房にセットし、担当村人 D に賃金を発生させる
    facilities.workshop = {
      ...facilities.workshop,
      craftQueue: [
        {
          id: "job1",
          itemId: "iron_ingot",
          timeLeft: 1,
          totalTime: 1,
          assignedVillagerId: "vd",
        },
      ],
    };

    const villagers = [
      // A: pool に小麦5（買取で +5G）
      makeVillager({ id: "va", name: "A", gold: 100, pool: { wheat: 5 } }),
      // B: pool に回復薬2（買取で +20G）
      makeVillager({ id: "vb", name: "B", gold: 50, pool: { potion: 2 } }),
      // C: pool なし
      makeVillager({ id: "vc", name: "C", gold: 30 }),
      // D: クラフト担当（賃金 +2G）。完了後は idle になる
      makeVillager({
        id: "vd",
        name: "D",
        gold: 10,
        status: "active",
        assignedCraftJobId: "job1",
      }),
    ];

    let state = {
      currentDay: 1,
      currentHour: 0,
      gold: 500,
      soulPoints: 0,
      villagers,
      facilities,
      dungeons: getInitialDungeons(),
      inventory: { wheat: 500 },
      targetAmounts: getDefaultTargetAmounts(),
      tradeRules: [],
      logs: [],
      currentTier: 1,
      activeBoss: null,
      bossDefeated: false,
      gameOver: false,
      gameOverReason: "",
      isPaused: false,
      playSpeed: "normal",
      soulUpgrades: { heritage: 0, storage: 0, education: 0, body: 0, building: 0, discount: 0 },
      towns: getInitialTowns(),
      caravans: getInitialCaravans(), // 全て idle = キャラバンの対外フローなし
      isSalaryUnpaid: false,
      consecutiveNegativeGoldDays: 0,
      lastSchedulerTick: -4,
      maxThreatLevelReached: 0,
      tierStartDay: 1,
      stats: getInitialStats(),
      selectedItem: null,
      dungeonEvents: [],
      marketPrices: {},
      pricePolicy: "standard",
      lastSettlement: null,
      dailyFlows: getInitialDailyFlows(),
    } as unknown as GameState;

    const before = totalGold(state);
    expect(before).toBe(690);

    // 1日（24時間）回す
    for (let i = 0; i < 24; i++) {
      const result = calculateAdvanceHour(state);
      state = {
        ...state,
        currentDay: result.currentDay,
        currentHour: result.currentHour,
        gold: result.gold,
        villagers: result.villagers,
        facilities: result.facilities,
        dungeons: result.dungeons,
        inventory: result.inventory,
        currentTier: result.currentTier,
        activeBoss: result.activeBoss,
        bossDefeated: result.bossDefeated,
        gameOver: result.gameOver,
        gameOverReason: result.gameOverReason,
        isPaused: result.isPaused,
        towns: result.towns,
        caravans: result.caravans,
        isSalaryUnpaid: result.isSalaryUnpaid,
        consecutiveNegativeGoldDays: result.consecutiveNegativeGoldDays,
        lastSchedulerTick: result.lastSchedulerTick,
        stats: result.stats,
        maxThreatLevelReached: result.maxThreatLevelReached,
        tierStartDay: result.tierStartDay,
        marketPrices: result.marketPrices,
        pricePolicy: result.pricePolicy,
        lastSettlement: result.lastSettlement,
        dailyFlows: result.dailyFlows,
      };
    }

    expect(state.currentDay).toBe(2);
    expect(state.currentHour).toBe(0);
    expect(state.gameOver).toBe(false);

    // 保存則: 総量は不変
    expect(totalGold(state)).toBe(before);

    // 内部フローが実際に発生したこと（テストが空転していないこと）
    // 買取: 小麦5×1G + 回復薬2×10G = 25G（初日は市場価格未計算のため basePrice）
    // 賃金: iron_ingot basePrice 12G の 20% = 2G
    // 食料代: 4人 × 2G = 8G（全員 wheat を食べて Buff なし）
    expect(state.lastSettlement).not.toBeNull();
    expect(state.lastSettlement!.day).toBe(1);
    expect(state.lastSettlement!.poolPurchase).toBe(25);
    expect(state.lastSettlement!.craftWages).toBe(2);
    expect(state.lastSettlement!.foodIncome).toBe(8);
    expect(state.lastSettlement!.caravanNet).toBe(0);

    // 個別の残高でも移転を確認する
    const byId = Object.fromEntries(state.villagers.map((v) => [v.id, v.gold]));
    expect(byId.va).toBe(100 + 5 - 2);
    expect(byId.vb).toBe(50 + 20 - 2);
    expect(byId.vc).toBe(30 - 2);
    expect(byId.vd).toBe(10 + 2 - 2);
    expect(state.gold).toBe(500 - 25 - 2 + 8);
  });
});
