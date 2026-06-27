/**
 * B2: 食料費で金凭空生成するバグの回帰テスト
 *
 * バグ: 旧実装では村人の gold に関わらず全額 foodCost を totalFoodCost に加算し、
 *     acc.gold に +totalFoodCost していたため、無一文の村人からも徴収して
 *     プレイヤー側に金が増えていた。
 *
 * 修正: 各村人で paid = min(foodCost, max(0, v.gold)) を計算し、
 *      paid のみを totalFoodCost に加算し、v.gold -= paid で gold を減算する。
 */
import { describe, expect, it } from "vitest";

import type { RunStats, Villager } from "../../../types/game";
import { getInitialStats } from "../../initialState";
import type { GamePhaseAccumulator } from "../types";
import { survivalPhase } from "./survival";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "Test",
    level: 1,
    exp: 0,
    currentJob: "農民",
    jobHistory: ["農民"],
    maxHp: 100,
    currentHp: 100,
    stamina: 100,
    maxStamina: 100,
    str: 10,
    int: 10,
    dex: 10,
    agi: 10,
    vit: 10,
    weaponId: "none",
    armorId: "none",
    order: "rest",
    status: "idle",
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
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    ...overrides,
  };
}

function makeAcc(overrides: Partial<GamePhaseAccumulator> = {}): GamePhaseAccumulator {
  const stats: RunStats = getInitialStats();
  return {
    currentDay: 1,
    currentHour: 0,
    gold: 0,
    villagers: [],
    facilities: {} as GamePhaseAccumulator["facilities"],
    dungeons: [],
    inventory: {},
    currentTier: 1,
    activeBoss: null,
    bossDefeated: false,
    gameOver: false,
    gameOverReason: "",
    isPaused: false,
    logsToAppend: [],
    towns: [],
    caravans: [],
    isSalaryUnpaid: false,
    consecutiveNegativeGoldDays: 0,
    lastSchedulerTick: -4,
    stats,
    maxThreatLevelReached: 0,
    tierStartDay: 1,
    isNewDay: true,
    nextStats: stats,
    hasStarvation: false,
    soulUpgrades: {},
    targetAmounts: {},
    tradeRules: [],
    ...overrides,
  };
}

describe("survivalPhase - B2 食料費 (回帰テスト)", () => {
  it("ケース1: gold=0 の村人からは徴収しないこと", () => {
    const villager = makeVillager({ gold: 0 });
    const acc = makeAcc({
      villagers: [villager],
      gold: 100,
      // 食料を潤沢に補給 → isStarving にならない
      inventory: { wheat: 10, vegetable: 10, raw_meat: 10 },
    });

    const after = survivalPhase(acc);

    // プレイヤー gold は増えない（村人から徴収できないため）
    expect(after.gold).toBe(100);
    // totalGoldFromTax は増えない
    expect(after.nextStats.totalGoldFromTax).toBe(0);
    // 村人 gold は変化なし（負数にもしない）
    expect(after.villagers[0].gold).toBe(0);
    // 飢餓状態ではない（村人側）
    expect(after.villagers[0].isStarving).toBe(false);
  });

  it("ケース2: gold=1 の村人から 1G だけ徴収すること（部分徴収）", () => {
    const villager = makeVillager({ gold: 1 });
    const acc = makeAcc({
      villagers: [villager],
      gold: 100,
      inventory: { wheat: 10, vegetable: 10, raw_meat: 10 },
    });

    const after = survivalPhase(acc);

    // プレイヤー gold は 1 増える
    expect(after.gold).toBe(101);
    // totalGoldFromTax は 1 増える
    expect(after.nextStats.totalGoldFromTax).toBe(1);
    // 村人 gold は 0 になる（負数にならない）
    expect(after.villagers[0].gold).toBe(0);
  });

  it("ケース3: gold=100 の村人からは全額 (2G) 徴収すること（既存挙動維持）", () => {
    const villager = makeVillager({ gold: 100 });
    const acc = makeAcc({
      villagers: [villager],
      gold: 100,
      inventory: { wheat: 10, vegetable: 10, raw_meat: 10 },
    });

    const after = survivalPhase(acc);

    // プレイヤー gold は 2 増える（既存挙動）
    expect(after.gold).toBe(102);
    // totalGoldFromTax は 2 増える
    expect(after.nextStats.totalGoldFromTax).toBe(2);
    // 村人 gold は 98 になる（負数にならない）
    expect(after.villagers[0].gold).toBe(98);
  });

  it("ケース4: 複数村人混在時、無一文の村人からは徴収しないこと", () => {
    const rich = makeVillager({ id: "rich", gold: 100 });
    const poor = makeVillager({ id: "poor", gold: 0 });
    const acc = makeAcc({
      villagers: [rich, poor],
      gold: 1000,
      inventory: { wheat: 10, vegetable: 10, raw_meat: 10 },
    });

    const after = survivalPhase(acc);

    // rich から 2G 徴収、poor からは 0G
    expect(after.gold).toBe(1002);
    expect(after.nextStats.totalGoldFromTax).toBe(2);
    expect(after.villagers[0].gold).toBe(98);
    expect(after.villagers[1].gold).toBe(0); // 変化なし・負数なし
  });
});
