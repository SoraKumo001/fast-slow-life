import "../../store/setupMockStorage";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useGameStore } from "../../store/gameStore";
import type { GameLog } from "../../types/game";

describe("soulActions - buySoulUpgrade", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    useGameStore.setState({
      soulUpgrades: {
        heritage: 0,
        storage: 0,
        education: 0,
        body: 0,
        building: 0,
        discount: 0,
      },
    });
    // addLog は IS_TEST_ENVIRONMENT=true でログを出力しないため、false に切替
    globalThis.IS_TEST_ENVIRONMENT = false;
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("SP 十分な場合にレベルが上がり SP が消費されること", () => {
    const state = useGameStore.getState();
    useGameStore.setState({ soulPoints: 100 });

    // heritage: costs[0]=8
    useGameStore.getState().buySoulUpgrade("heritage");

    const after = useGameStore.getState();
    expect(after.soulUpgrades.heritage).toBe(1);
    expect(after.soulPoints).toBe(92); // 100 - 8
  });

  it("SP 不足の場合はレベルが上がらず SP も減らないこと（警告ログ追加）", () => {
    useGameStore.setState({ soulPoints: 5 });

    useGameStore.getState().buySoulUpgrade("heritage"); // costs[0]=8

    const after = useGameStore.getState();
    expect(after.soulUpgrades.heritage).toBe(0);
    expect(after.soulPoints).toBe(5);
    const warnLog = after.logs.find((l: GameLog) => l.message.includes("ソウルポイントが不足"));
    expect(warnLog).toBeDefined();
    expect(warnLog?.type).toBe("warning");
  });

  it("最大レベルに達している場合は何もしないこと", () => {
    // education: maxLevel=5, costs=[15, 30, 45, 80, 140]
    useGameStore.setState({
      soulPoints: 1000,
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, education: 5 },
    });

    useGameStore.getState().buySoulUpgrade("education");

    const after = useGameStore.getState();
    expect(after.soulUpgrades.education).toBe(5);
    expect(after.soulPoints).toBe(1000);
  });

  it("存在しない upgradeId の場合は何もしないこと", () => {
    useGameStore.setState({ soulPoints: 1000 });

    useGameStore.getState().buySoulUpgrade("nonexistent_upgrade");

    const after = useGameStore.getState();
    // SP は変化しない
    expect(after.soulPoints).toBe(1000);
    // 既存の soulUpgrades も変化しない
    expect(after.soulUpgrades).toEqual({
      heritage: 0,
      storage: 0,
      education: 0,
      body: 0,
      building: 0,
      discount: 0,
    });
  });

  it("複数回連続で強化すると段階的にコストが上がること", () => {
    // heritage: costs=[8, 16, 24, ...]
    useGameStore.setState({ soulPoints: 100 });

    useGameStore.getState().buySoulUpgrade("heritage"); // -8 SP, lvl 1
    useGameStore.getState().buySoulUpgrade("heritage"); // -16 SP, lvl 2
    useGameStore.getState().buySoulUpgrade("heritage"); // -24 SP, lvl 3

    const after = useGameStore.getState();
    expect(after.soulUpgrades.heritage).toBe(3);
    expect(after.soulPoints).toBe(52); // 100 - 8 - 16 - 24
  });

  it("強化成功時に system ログが追加されること", () => {
    useGameStore.setState({ soulPoints: 100 });

    useGameStore.getState().buySoulUpgrade("heritage");

    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("先祖の遺産"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("system");
  });
});

describe("soulActions - downgradeSoulUpgrade", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    useGameStore.setState({
      soulUpgrades: {
        heritage: 0,
        storage: 0,
        education: 0,
        body: 0,
        building: 0,
        discount: 0,
      },
    });
    globalThis.IS_TEST_ENVIRONMENT = false;
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("レベル 1 以上に強化済みのバフを下げると SP が払戻されること", () => {
    // heritage: costs=[8, 16, 24, ...] → レベル2 なら払戻額は costs[1]=16
    useGameStore.setState({
      soulPoints: 0,
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, heritage: 2 },
    });

    useGameStore.getState().downgradeSoulUpgrade("heritage");

    const after = useGameStore.getState();
    expect(after.soulUpgrades.heritage).toBe(1);
    expect(after.soulPoints).toBe(16);
  });

  it("払戻額は現在のレベル到達時に支払った SP と一致すること", () => {
    // education: costs=[15, 30, 45, 80, 140]
    // レベル3 → 払戻額は costs[2]=45
    useGameStore.setState({
      soulPoints: 0,
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, education: 3 },
    });

    useGameStore.getState().downgradeSoulUpgrade("education");

    const after = useGameStore.getState();
    expect(after.soulUpgrades.education).toBe(2);
    expect(after.soulPoints).toBe(45);
  });

  it("レベル 0 のバフを下げようとしても何もしないこと", () => {
    useGameStore.setState({
      soulPoints: 100,
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, heritage: 0 },
    });

    useGameStore.getState().downgradeSoulUpgrade("heritage");

    const after = useGameStore.getState();
    expect(after.soulUpgrades.heritage).toBe(0);
    expect(after.soulPoints).toBe(100);
  });

  it("存在しない upgradeId の場合は何もしないこと", () => {
    useGameStore.setState({ soulPoints: 100 });

    useGameStore.getState().downgradeSoulUpgrade("nonexistent_upgrade");

    const after = useGameStore.getState();
    expect(after.soulPoints).toBe(100);
  });

  it("払戻時に system ログが追加されること", () => {
    useGameStore.setState({
      soulPoints: 0,
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, building: 1 },
    });

    useGameStore.getState().downgradeSoulUpgrade("building");

    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("効率的な建築"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("system");
  });
});

describe("soulActions - resetGame", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("通常リセット (prestige=false): 状態が初期化され soulPoints は維持されること", () => {
    useGameStore.setState({
      currentDay: 50,
      currentHour: 12,
      gold: 9999,
      soulPoints: 100,
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    expect(after.currentDay).toBe(1);
    expect(after.currentHour).toBe(0);
    expect(after.gold).toBeLessThan(9999); // 初期値に戻る
    // 通常リセットは SP を維持
    expect(after.soulPoints).toBe(100);
  });

  it("prestige=true (任意転生): SP が加算されて新たな周回を開始すること", () => {
    // gold=5000 → SP floor(5000/1000)=5, inventory={wheat:100} → SP floor(100/100)=1, total=6
    useGameStore.setState({
      gold: 5000,
      inventory: { ...useGameStore.getState().inventory, wheat: 100 },
      currentTier: 1,
      bossDefeated: false,
      soulPoints: 10,
    });

    useGameStore.getState().resetGame(true);

    const after = useGameStore.getState();
    // 既存の 10 SP + 獲得分 (5 + 1 = 6) = 16
    expect(after.soulPoints).toBe(16);
    // 初期化されている
    expect(after.currentDay).toBe(1);
    expect(after.gameOver).toBe(false);
  });

  it("prestige=true + gameOver=true: 獲得 SP は加算されない (advanceHour 時点で加算済みのため)", () => {
    useGameStore.setState({
      gold: 5000,
      gameOver: true,
      currentDay: 100,
      currentTier: 2,
      bossDefeated: false,
      soulPoints: 50,
    });

    useGameStore.getState().resetGame(true);

    const after = useGameStore.getState();
    // gameOver 経由のリセットは SP 加算なし
    expect(after.soulPoints).toBe(50);
  });

  it("リセット後に logs がクリアされて init ログのみが残ること", () => {
    useGameStore.setState({
      logs: [
        ...useGameStore.getState().logs,
        {
          id: "old",
          timestamp: "10日目 12:00",
          message: "古いログ",
          type: "info" as const,
        },
      ],
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    expect(after.logs).toHaveLength(1);
    expect(after.logs[0].id).toBe("init");
    expect(after.logs[0].message).toContain("リスタート");
  });

  it("リセット後に村人が初期数に戻ること", () => {
    const initialVillagers = useGameStore.getState().villagers;
    useGameStore.setState({
      villagers: [
        ...initialVillagers,
        { id: "extra" } as unknown as (typeof initialVillagers)[number],
      ],
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    // 初期は 5 人
    expect(after.villagers.length).toBe(5);
  });

  it("body バフが soulUpgrade.body に応じて初期村人の能力に反映されること", () => {
    // body Lv2 → statBonus = 2*2 = 4
    useGameStore.setState({
      soulUpgrades: { ...useGameStore.getState().soulUpgrades, body: 2 },
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    // 初期村人の STR は 10 + statBonus(4) = 14
    const v0 = after.villagers[0];
    expect(v0.str).toBe(14);
  });

  it("heritage バフに応じて初期ゴールドが増加すること", () => {
    // HERITAGE_GOLD_PER_LEVEL × heritage Lv + STARTING_GOLD
    const heritageLvl = 3;
    useGameStore.setState({
      soulUpgrades: {
        ...useGameStore.getState().soulUpgrades,
        heritage: heritageLvl,
      },
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    // 初期 gold がベース値より多いことを確認 (具体的な初期値は変わる可能性あり)
    expect(after.gold).toBeGreaterThanOrEqual(500);
  });

  it("リセット後に tradeRules が空配列に戻ること", () => {
    useGameStore.setState({
      tradeRules: [
        {
          id: "r1",
          itemId: "potion",
          type: "sell",
          threshold: 5,
          isEnabled: true,
        },
      ],
    });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    expect(after.tradeRules).toEqual([]);
  });

  it("リセット後に consecutiveNegativeGoldDays が 0 に戻ること", () => {
    useGameStore.setState({ consecutiveNegativeGoldDays: 2 });

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    expect(after.consecutiveNegativeGoldDays).toBe(0);
  });

  it("リセット後に towns/caravans が初期状態に戻ること", () => {
    useGameStore.setState((s: ReturnType<typeof useGameStore.getState>) => ({
      towns: s.towns.map((t) => ({ ...t, isUnlocked: true })),
      caravans: s.caravans.map((c) => ({ ...c, status: "trading" as const })),
    }));

    useGameStore.getState().resetGame(false);

    const after = useGameStore.getState();
    // 初期状態では komorebi のみアンロック
    expect(after.towns.filter((t) => t.isUnlocked)).toHaveLength(1);
    // 全馬車 idle
    expect(after.caravans.every((c) => c.status === "idle")).toBe(true);
  });
});
