import { describe, it, expect, vi, afterEach } from "vitest";

import { MONSTERS } from "../data/masterData";
import type { Villager, RunStats } from "../types/game";
import { processBossBattle } from "./bossBattle";
import { useGameStore } from "./gameStore";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
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
    currentJob: "戦士",
    jobHistory: ["戦士"],
    weaponId: "none",
    armorId: "none",
    order: "hunt",
    status: "active",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: "goblin",
    autoTargetName: "ゴブリン",
    potionCount: 0,
    staminaDrinkCount: 0,
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    activeFoodBuffId: null,
    gold: 0,
    pool: {},
    isStarving: false,
    ...overrides,
  };
}

function makeStats(): RunStats {
  return {
    totalAttacksAttempted: 0,
    totalAttacksLanded: 0,
    totalCriticalHits: 0,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    totalPotionHealing: 0,
    totalGoldFromExports: 0,
    totalGoldSpentOnImports: 0,
    totalItemsGathered: 0,
    totalMonstersDefeated: 0,
    totalBossesDefeated: 0,
    totalItemsCrafted: 0,
    totalGoldFromPurchases: 0,
    totalItemsPurchased: 0,
    totalGoldFromTax: 0,
  };
}

describe("bossBattle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processBossBattle", () => {
    it("activeBossがnullの場合は状態が変更されないこと", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const villagers = [makeVillager()];
      const result = processBossBattle(null, villagers, [], 1, false, {}, makeStats());

      expect(result.activeBoss).toBeNull();
      expect(result.villagers).toEqual(villagers);
      expect(result.currentTier).toBe(1);
      expect(result.bossDefeated).toBe(false);
      expect(result.gameOver).toBe(false);
      expect(result.logs).toHaveLength(0);
    });

    it("activeBossが存在しアタッカーがいる場合は戦闘が実行されること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 800,
        maxHp: 800,
        attackerIds: ["v1"],
      };
      const villagers = [
        makeVillager({
          id: "v1",
          str: 1,
          dex: 300,
          maxHp: 10000,
          currentHp: 10000,
          vit: 1,
        }),
      ];
      const stats = makeStats();

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, stats);

      expect(result.activeBoss).not.toBeNull();
      expect(result.activeBoss?.currentHp).toBeLessThan(800);
      expect(result.logs.some((log) => log.type === "combat")).toBe(true);
      expect(stats.totalAttacksAttempted).toBeGreaterThan(0);
      expect(stats.totalDamageDealt).toBeGreaterThan(0);
    });

    it("ボスを撃破すると tier が進行しアタッカーが idle/gather に戻ること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin",
        currentHp: 30,
        maxHp: 30,
        attackerIds: ["v1"],
      };
      const villagers = [makeVillager({ id: "v1", str: 100, dex: 300, currentJob: "戦士" })];

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, makeStats());

      expect(result.activeBoss).toBeNull();
      expect(result.bossDefeated).toBe(false);
      expect(result.currentTier).toBe(2);
      expect(result.villagers[0].status).toBe("idle");
      expect(result.villagers[0].order).toBe("gather");
      expect(result.logs.some((log) => log.message.includes("撃破"))).toBe(true);
      expect(result.logs.some((log) => log.message.includes("新しいエリア"))).toBe(true);
    });

    it("アタッカーが全滅するとボス戦が終了すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin",
        currentHp: 30,
        maxHp: 30,
        attackerIds: ["v1"],
      };
      const villagers = [
        makeVillager({
          id: "v1",
          str: 1,
          dex: 0,
          vit: 1,
          currentHp: 1,
          maxHp: 100,
        }),
      ];

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, makeStats());

      expect(result.activeBoss).toBeNull();
      expect(result.villagers[0].currentHp).toBe(0);
      expect(result.villagers[0].status).toBe("traveling_back");
      expect(result.logs.some((log) => log.message.includes("全員戦闘不能"))).toBe(true);
    });

    it("ボスがラウンド間でHPを回復すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 700,
        maxHp: 800,
        attackerIds: ["v1"],
      };
      // 高耐久なアタッカーで5ラウンド戦闘が続くようにする
      const villagers = [
        makeVillager({
          id: "v1",
          str: 1,
          dex: 0,
          vit: 1000,
          maxHp: 10000,
          currentHp: 10000,
          armorId: "dragon_scale_mail",
        }),
      ];

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, makeStats());

      // regen = floor(800 * 0.002) = 1, player deals 10*5 = 50 over 5 rounds
      expect(result.activeBoss?.currentHp).toBe(651);
    });

    it("僧侶が瀕死のアタッカーを回復すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 20,
        maxHp: 800,
        attackerIds: ["monk1", "warrior1"],
      };
      const villagers = [
        makeVillager({
          id: "monk1",
          name: "僧侶A",
          currentJob: "僧侶",
          jobHistory: ["僧侶"],
          int: 10,
          agi: 1000,
          maxHp: 10000,
          currentHp: 10000,
          str: 1,
        }),
        makeVillager({
          id: "warrior1",
          name: "戦士A",
          currentJob: "戦士",
          jobHistory: ["戦士"],
          level: 4,
          str: 10,
          dex: 300,
          currentHp: 10,
          maxHp: 160,
        }),
      ];

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, makeStats());

      const warrior = result.villagers.find((v) => v.id === "warrior1")!;
      expect(warrior.currentHp).toBe(35);
      expect(result.logs.filter((log) => log.message.includes("ヒール"))).toHaveLength(1);
    });

    it("tier 5 のボス撃破でゲームクリアになること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin",
        currentHp: 30,
        maxHp: 30,
        attackerIds: ["v1"],
      };
      const villagers = [makeVillager({ id: "v1", str: 100, dex: 300 })];

      const result = processBossBattle(activeBoss, villagers, [], 5, false, {}, makeStats());

      expect(result.gameOver).toBe(true);
      expect(result.gameOverReason).toBe("クリア");
      expect(result.activeBoss).toBeNull();
      expect(result.currentTier).toBe(5);
      expect(result.bossDefeated).toBe(true);
      expect(result.logs.some((log) => log.message.includes("ゲームクリア"))).toBe(true);
    });

    it("ソウルアップグレード education が経験値獲得に反映されること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin",
        currentHp: 30,
        maxHp: 30,
        attackerIds: ["v1"],
      };
      const villagers = [makeVillager({ id: "v1", str: 100, dex: 300, exp: 0 })];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        { education: 1 },
        makeStats(),
      );

      const villager = result.villagers[0];
      // goblin expReward=9 (Phase 5 レバー5で 15→9), eduBonus = 1 + 1*1.5 = 2.5
      expect(villager.exp).toBe(22);
    });

    it("アタッカーが一人もいない場合はボスのみ回復して戦闘は発生しないこと", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 600,
        maxHp: 800,
        attackerIds: ["v1"],
      };
      const villagers = [makeVillager({ id: "v1", status: "traveling_to" })];

      const result = processBossBattle(activeBoss, villagers, [], 1, false, {}, makeStats());

      expect(result.activeBoss?.currentHp).toBe(601);
      expect(result.logs).toHaveLength(0);
    });
  });

  describe("Phase 6: ボス戦の離脱リセット", () => {
    // 累計時間の基準: 6日目 4時 = (6-1)*24 + 4 = 124
    const DAY = 6;
    const HOUR = 4;
    const ELAPSED = 124;

    it("全滅で activeBoss が破棄され、離脱ログが出ること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin",
        currentHp: 30,
        maxHp: 30,
        attackerIds: ["v1"],
        lastEngagedAtElapsedHour: ELAPSED,
      };
      const villagers = [
        makeVillager({ id: "v1", str: 1, dex: 0, vit: 1, currentHp: 1, maxHp: 100 }),
      ];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).toBeNull();
      expect(result.logs.some((log) => log.message.includes("巣へ戻り、傷を癒した"))).toBe(true);
    });

    it("離脱後の再挑戦 (startBossBattle) は満タンHPから始まること", () => {
      useGameStore.getState().resetGame(false);
      const state = useGameStore.getState();
      const villagerId = state.villagers[0].id;

      state.startBossBattle("goblin_leader", [villagerId]);

      const boss = useGameStore.getState().activeBoss;
      expect(boss).not.toBeNull();
      expect(boss?.currentHp).toBe(MONSTERS.goblin_leader.hp);
      expect(boss?.currentHp).toBe(boss?.maxHp);
      expect(boss?.lastEngagedAtElapsedHour).toBe(
        (state.currentDay - 1) * 24 + state.currentHour,
      );
    });

    it("全アタッカーが戦闘不能なら、猶予時間内でも即時離脱すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 500,
        maxHp: 1600,
        attackerIds: ["v1"],
        // 猶予はたっぷり残っている (最終交戦 = 現在時刻)
        lastEngagedAtElapsedHour: ELAPSED,
      };
      // 戦闘不能のまま帰還中 (戦闘中ではない経路で倒れたケース)
      const villagers = [
        makeVillager({ id: "v1", status: "traveling_back", currentHp: 0, maxHp: 100 }),
      ];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).toBeNull();
      expect(result.logs.some((log) => log.message.includes("巣へ戻り、傷を癒した"))).toBe(true);
    });

    it("交戦可能なアタッカーが24時間いないと離脱すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 500,
        maxHp: 1600,
        attackerIds: ["v1"],
        lastEngagedAtElapsedHour: ELAPSED - 24,
      };
      // 休息中 = 交戦可能ではない
      const villagers = [makeVillager({ id: "v1", status: "resting" })];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).toBeNull();
      expect(result.logs.some((log) => log.message.includes("巣へ戻り、傷を癒した"))).toBe(true);
    });

    it("交戦可能なアタッカーの不在が24時間未満なら離脱しないこと", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 500,
        maxHp: 1600,
        attackerIds: ["v1"],
        lastEngagedAtElapsedHour: ELAPSED - 23,
      };
      const villagers = [makeVillager({ id: "v1", status: "resting" })];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).not.toBeNull();
      // 戦闘は発生せず自然回復のみ: 500 + floor(1600 * 0.002) = 503
      expect(result.activeBoss?.currentHp).toBe(503);
      expect(result.logs.some((log) => log.message.includes("巣へ戻り"))).toBe(false);
    });

    it("交戦が継続している間はリセットされず、最終交戦時刻が更新されること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 1600,
        maxHp: 1600,
        attackerIds: ["v1"],
        // 100時間前の交戦でも、現在交戦中なら離脱しない
        lastEngagedAtElapsedHour: ELAPSED - 100,
      };
      const villagers = [
        makeVillager({
          id: "v1",
          str: 1,
          dex: 0,
          vit: 1000,
          maxHp: 10000,
          currentHp: 10000,
          armorId: "dragon_scale_mail",
        }),
      ];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).not.toBeNull();
      expect(result.activeBoss?.lastEngagedAtElapsedHour).toBe(ELAPSED);
      expect(result.logs.some((log) => log.message.includes("巣へ戻り"))).toBe(false);
    });

    it("ボスへ移動中の追加参戦で離脱タイマーがリセットされること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 500,
        maxHp: 1600,
        attackerIds: ["v1", "v2"],
        lastEngagedAtElapsedHour: ELAPSED - 100,
      };
      const villagers = [
        makeVillager({ id: "v1", status: "resting" }),
        makeVillager({
          id: "v2",
          status: "traveling_to",
          destinationAreaId: "forest",
          targetMonsterId: "goblin_leader",
          dungeonState: {
            currentDepth: 0,
            targetDepth: 100,
            lane: 0,
            phase: "traveling_to",
            targetNodeId: "goblin_leader",
          },
        }),
      ];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).not.toBeNull();
      expect(result.activeBoss?.lastEngagedAtElapsedHour).toBe(ELAPSED);
      expect(result.logs.some((log) => log.message.includes("巣へ戻り"))).toBe(false);
    });

    it("lastEngagedAtElapsedHour が未記録 (旧セーブ) では即離脱せず現在時刻を起点にすること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const activeBoss = {
        monsterId: "goblin_leader",
        currentHp: 500,
        maxHp: 1600,
        attackerIds: ["v1"],
      };
      const villagers = [makeVillager({ id: "v1", status: "resting" })];

      const result = processBossBattle(
        activeBoss,
        villagers,
        [],
        1,
        false,
        {},
        makeStats(),
        DAY,
        1,
        HOUR,
      );

      expect(result.activeBoss).not.toBeNull();
      expect(result.activeBoss?.lastEngagedAtElapsedHour).toBe(ELAPSED);
    });
  });
});
