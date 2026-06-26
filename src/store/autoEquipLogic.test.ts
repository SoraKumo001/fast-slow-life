import { describe, it, expect, beforeEach } from "vitest";

import type { GameState, Villager } from "../types/game";
import { autoEquipAllHelper } from "./autoEquipLogic";
import { useGameStore } from "./gameStore";

/** テスト用の村人ファクトリ */
function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v_test",
    name: "テスト村人",
    currentJob: "戦士",
    jobHistory: ["戦士"],
    gold: 1000,
    activeFoodBuffId: null,
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
    targetMonsterId: null,
    autoTargetName: null,
    partyEngagementOffset: 0,
    pool: {},
    lastTrainingDay: 0,
    ...overrides,
  } as Villager;
}

describe("autoEquipAllHelper - 現在装備との比較", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
  });

  // ============================================================
  // REGRESSION TEST: 強い装備の強制交換バグ (Critical)
  // ============================================================
  it("REGRESSION: 強い武器装備中に弱い武器が pool にある場合、装備変更しない", () => {
    // 戦士イアンが iron_sword (attack 30) 装備中
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      weaponId: "iron_sword", // 強い武器
    });

    // 倉庫に wooden_club (attack 12) がある = pool の弱いアイテム
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { wooden_club: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 修正前: wooden_club に強制交換されていた
    // 修正後: iron_sword のまま維持される
    expect(result.villagers[0].weaponId).toBe("iron_sword");
    // ログにも何も追加されない (変更なし)
    expect(result.logs.filter((l) => l.includes("購入して装備"))).toHaveLength(0);
  });

  // ============================================================
  // 正常系: 弱い → 強い への交換
  // ============================================================
  it("弱い武器装備中に強い武器が pool にある場合、正しく交換される", () => {
    // 戦士イアンが wooden_club (attack 12) 装備中
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      weaponId: "wooden_club", // 弱い武器
    });

    // 倉庫に iron_sword (attack 30) がある = pool の強いアイテム
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { iron_sword: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 弱い wooden_club から強い iron_sword に交換される
    expect(result.villagers[0].weaponId).toBe("iron_sword");
    // 購入ログが出力される
    expect(result.logs.filter((l) => l.includes("鉄の剣"))).toHaveLength(1);
  });

  // ============================================================
  // 正常系: 同スコアなら変更しない
  // ============================================================
  it("同スコアの武器しかない場合、装備変更しない", () => {
    // iron_sword (attack 30) 装備中
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      weaponId: "iron_sword",
    });

    // pool にも iron_sword がある (同じ)
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { iron_sword: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 同じ装備のまま維持される
    expect(result.villagers[0].weaponId).toBe("iron_sword");
  });

  // ============================================================
  // 正常系: 防具でも同じロジック
  // ============================================================
  it("防具でも同じロジックが適用される", () => {
    // 戦士イアンが iron_armor (defense 30) 装備中
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      armorId: "iron_armor",
    });

    // 倉庫に wooden_shield (defense 8) がある
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { wooden_shield: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 強い iron_armor のまま維持
    expect(result.villagers[0].armorId).toBe("iron_armor");
  });

  // ============================================================
  // 正常系: 現在装備が最強ならログなし
  // ============================================================
  it("現在装備が最強の場合、購入/装備ログが出力されない", () => {
    // iron_sword (attack 30) 装備中
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      weaponId: "iron_sword",
    });

    // pool に同じ iron_sword がある
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { iron_sword: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 装備変更関連のログが 0 件
    const equipLogs = result.logs.filter((l) => l.includes("購入して装備"));
    expect(equipLogs).toHaveLength(0);
  });

  // ============================================================
  // 正常系: 素手 → 武器装備
  // ============================================================
  it("素手状態から pool に武器がある場合、武器を装備する", () => {
    // 素手
    const v = makeVillager({
      id: "v_warrior",
      name: "戦士イアン",
      currentJob: "戦士",
      gold: 1000,
      weaponId: "none",
    });

    // pool に iron_sword
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { iron_sword: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 素手 → iron_sword に装備
    expect(result.villagers[0].weaponId).toBe("iron_sword");
  });

  // ============================================================
  // 正常系: Magic job ペナルティ武器の交換
  // ============================================================
  it("現在装備が magic job ペナルティ対象の場合、適切な武器に交換される", () => {
    // 僧侶 (magic job) が iron_sword (attack 30, int 0) 装備中 → スコア低い
    const v = makeVillager({
      id: "v_priest",
      name: "僧侶サマンサ",
      currentJob: "僧侶",
      gold: 1000,
      weaponId: "iron_sword",
    });

    // pool に wooden_staff (attack 5, int 8) → magic job には高スコア
    const state = {
      ...useGameStore.getState(),
      gold: 5000,
      villagers: [v],
      inventory: { wooden_staff: 1 },
    } as GameState;

    const result = autoEquipAllHelper(state);

    // 僧侶には wooden_staff の方がスコアが高いので交換される
    expect(result.villagers[0].weaponId).toBe("wooden_staff");
  });
});
