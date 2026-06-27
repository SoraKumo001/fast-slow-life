/**
 * B3: 探索度がバフ/デバフ/飢餓ペナルティを無視するバグの回帰テスト
 *
 * バグ: processExploration が (v.dex * 0.2 + v.agi * 0.2) のみを使い、
 *      getFoodBuffBonus / applySalaryDebuff / 飢餓ペナルティを適用していなかった。
 *      結果として、料理を食べても探索速度が変わらず、ツケ状態でも同じ速度だった。
 *
 * 修正: gatherLogic と同じく effective stat + efficiency を適用する。
 *       v.gold ?? 0 で undefined 安全に。
 *
 * テスト戦略: 1回の呼び出しでは progress が小数以下のため差が見えない。
 * 240回呼び出して 10日分の進行量を集計し、バフ/デバフ/飢餓の差を検証する。
 */
import { describe, expect, it } from "vitest";

import { ITEMS } from "../data/masterData";
import type { DungeonArea, Villager } from "../types/game";
import { processExploration } from "./exploration";

function makeDungeon(overrides: Partial<DungeonArea> = {}): DungeonArea {
  return {
    id: "forest",
    name: "始まりの森",
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [],
    monsters: [],
    explorationProgress: 0,
    difficulty: 1.0,
    threatLevel: 0,
    ...overrides,
  };
}

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  // 呼び出し側で dungeon id と villager.destinationAreaId を一致させる想定。
  return {
    id: "v1",
    name: "アルフ",
    level: 1,
    exp: 0,
    currentJob: "無職",
    jobHistory: ["無職"],
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
    order: "gather",
    status: "active",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetMonsterId: null,
    autoTargetName: null,
    potionCount: 0,
    potionItemId: undefined,
    staminaDrinkCount: 0,
    staminaDrinkItemId: undefined,
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

/** processExploration を N 回繰り返して最終 progress を取得する */
function simulateExploration(dungeon: DungeonArea, villager: Villager, hours: number): number {
  let current = dungeon;
  for (let i = 0; i < hours; i++) {
    current = processExploration([current], [villager], 1).dungeons[0];
  }
  return current.explorationProgress;
}

describe("processExploration - B3 バフ/デバフ反映 (回帰テスト)", () => {
  it("ケース1（基準）: 通常状態で探索度が蓄積すること", () => {
    const progress = simulateExploration(makeDungeon(), makeVillager(), 240);
    expect(progress).toBeGreaterThan(0);
  });

  it("ケース2: 料理バフ適用時は基準より探索が速い", () => {
    // food_sandwich の foodBuff: { dex: 3 } を確認
    const sandwich = ITEMS["food_sandwich"];
    expect(sandwich?.foodBuff).toBeDefined();
    expect(sandwich?.foodBuff?.dex ?? 0).toBeGreaterThan(0);

    const baseProgress = simulateExploration(
      makeDungeon({ id: "d1" }),
      makeVillager({ destinationAreaId: "d1" }),
      240,
    );
    const buffedProgress = simulateExploration(
      makeDungeon({ id: "d2" }),
      makeVillager({
        destinationAreaId: "d2",
        activeFoodBuffId: "food_sandwich",
      }),
      240,
    );

    expect(buffedProgress).toBeGreaterThan(baseProgress);
  });

  it("ケース3: 負債（gold<0）状態では基準より探索が遅い", () => {
    const baseProgress = simulateExploration(
      makeDungeon({ id: "d1" }),
      makeVillager({ destinationAreaId: "d1", gold: 0 }),
      240,
    );
    const debtProgress = simulateExploration(
      makeDungeon({ id: "d2" }),
      makeVillager({ destinationAreaId: "d2", gold: -50 }),
      240,
    );

    expect(debtProgress).toBeLessThan(baseProgress);
  });

  it("ケース4: 飢餓状態では基準より探索が遅い", () => {
    const baseProgress = simulateExploration(
      makeDungeon({ id: "d1" }),
      makeVillager({ destinationAreaId: "d1", isStarving: false }),
      240,
    );
    const starvingProgress = simulateExploration(
      makeDungeon({ id: "d2" }),
      makeVillager({ destinationAreaId: "d2", isStarving: true }),
      240,
    );

    expect(starvingProgress).toBeLessThan(baseProgress);
  });

  it("ケース5: 既存テストと同じく villager.gold が undefined でもクラッシュしない", () => {
    const villager = makeVillager();
    delete (villager as { gold?: number }).gold;
    expect(() => simulateExploration(makeDungeon(), villager, 10)).not.toThrow();
  });
});
