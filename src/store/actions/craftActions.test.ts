import "../../store/setupMockStorage";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useGameStore } from "../../store/gameStore";
import type { GameLog } from "../../types/game";

describe("craftActions - startCraft", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    // ワークショップを Lv1 以上に + wood_plank 用の素材を用意
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        workshop: { ...s.facilities.workshop, level: 1 },
      },
      inventory: { ...s.inventory, wood: 10, iron_ore: 10 },
    }));
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("正常系: クラフトキューにジョブが追加され素材が消費されること", () => {
    // iron_ingot: iron_ore × 3 必要
    useGameStore.getState().startCraft("workshop", "iron_ingot");
    const after = useGameStore.getState();
    expect(after.facilities.workshop.craftQueue).toHaveLength(1);
    expect(after.facilities.workshop.craftQueue[0].itemId).toBe("iron_ingot");
    // 素材が消費される (iron_ore: 3個)
    expect(after.inventory.iron_ore).toBeLessThan(10);
  });

  it("クラフト開始で idle 村人が active になること", () => {
    useGameStore.setState({
      villagers: [
        {
          ...useGameStore.getState().villagers[0],
          id: "v1",
          status: "idle",
          currentJob: "職人",
        },
      ],
    });
    useGameStore.getState().startCraft("workshop", "iron_ingot");
    const after = useGameStore.getState();
    expect(after.villagers[0].status).toBe("active");
    expect(after.villagers[0].assignedCraftJobId).not.toBeNull();
  });

  it("クラフト開始時に craft ログが出力されること", () => {
    useGameStore.getState().startCraft("workshop", "iron_ingot");
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("クラフトを開始"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("craft");
  });

  it("素材不足の場合はクラフト開始されず warning ログが出ること", () => {
    useGameStore.setState({ inventory: {} });
    useGameStore.getState().startCraft("workshop", "iron_ingot");
    const after = useGameStore.getState();
    expect(after.facilities.workshop.craftQueue).toHaveLength(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("素材"));
    expect(log?.type).toBe("warning");
  });

  it("施設レベルが足りない場合はクラフト開始されないこと", () => {
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        weapon_shop: { ...s.facilities.weapon_shop, level: 0 },
      },
    }));
    useGameStore.getState().startCraft("weapon_shop", "iron_sword");
    const after = useGameStore.getState();
    expect(after.facilities.weapon_shop.craftQueue).toHaveLength(0);
  });

  it("レシピに存在しないアイテムはクラフト開始されないこと", () => {
    useGameStore.getState().startCraft("workshop", "nonexistent_item");
    const after = useGameStore.getState();
    expect(after.facilities.workshop.craftQueue).toHaveLength(0);
  });

  it("別施設のレシピは該当施設以外で開始できないこと", () => {
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        workshop: { ...s.facilities.workshop, level: 1 },
        alchemy: { ...s.facilities.alchemy, level: 1 },
      },
      inventory: { ...s.inventory, herb: 10, vegetable: 10, iron_ore: 10 },
    }));
    // iron_ingot は workshop のレシピ。alchemy で開始しようとしても失敗
    useGameStore.getState().startCraft("alchemy", "iron_ingot");
    const after = useGameStore.getState();
    expect(after.facilities.alchemy.craftQueue).toHaveLength(0);
  });
});

describe("craftActions - startFacilityUpgrade", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    useGameStore.setState((s) => ({
      gold: 10000,
      inventory: { wood: 100, stone: 100 },
    }));
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("アップグレードが開始され施設の upgradeTimeLeft が設定されること", () => {
    useGameStore.getState().startFacilityUpgrade("inn");
    const after = useGameStore.getState();
    expect(after.facilities.inn.upgradeTimeLeft).toBeGreaterThan(0);
    expect(after.facilities.inn.upgradeAssignedVillagerId).not.toBeNull();
  });

  it("アップグレード開始でゴールドが消費されること", () => {
    const before = useGameStore.getState().gold;
    useGameStore.getState().startFacilityUpgrade("inn");
    const after = useGameStore.getState();
    expect(after.gold).toBeLessThan(before);
  });

  it("ゴールド不足の場合はアップグレード開始されず warning ログが出ること", () => {
    useGameStore.setState({ gold: 0 });
    useGameStore.getState().startFacilityUpgrade("inn");
    const after = useGameStore.getState();
    expect(after.facilities.inn.upgradeTimeLeft).toBe(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("ゴールド"));
    expect(log?.type).toBe("warning");
  });
});

describe("craftActions - startTraining", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        training_ground: { ...s.facilities.training_ground, level: 1 },
      },
      villagers: s.villagers.map((v) => ({
        ...v,
        status: "idle" as const,
        gold: 1000,
        lastTrainingDay: 0,
      })),
    }));
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("正常系: 訓練キューにジョブが追加され村人が active になること", () => {
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    expect(after.facilities.training_ground.trainingQueue).toHaveLength(1);
    const v1 = after.villagers.find((v) => v.id === v1Id);
    expect(v1?.status).toBe("active");
    expect(v1?.assignedCraftJobId).not.toBeNull();
  });

  it("訓練開始で craft ログが出力されること", () => {
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("訓練"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("craft");
  });

  it("クールダウン中の村人は訓練開始できず warning ログが出ること", () => {
    useGameStore.setState((s) => ({
      villagers: s.villagers.map((v, idx) =>
        idx === 0 ? { ...v, lastTrainingDay: Math.max(1, s.currentDay - 1) } : v,
      ),
    }));
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    expect(after.facilities.training_ground.trainingQueue).toHaveLength(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("経過していない"));
    expect(log?.type).toBe("warning");
  });

  it("村人所持金不足の場合は訓練開始できず warning ログが出ること", () => {
    useGameStore.setState((s) => ({
      villagers: s.villagers.map((v, idx) => (idx === 0 ? { ...v, gold: 0 } : v)),
    }));
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    expect(after.facilities.training_ground.trainingQueue).toHaveLength(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("所持金"));
    expect(log?.type).toBe("warning");
  });

  it("active な村人は訓練対象にならず warning ログが出ること", () => {
    useGameStore.setState((s) => ({
      villagers: s.villagers.map((v, idx) => (idx === 0 ? { ...v, status: "active" as const } : v)),
    }));
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    expect(after.facilities.training_ground.trainingQueue).toHaveLength(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("待機中"));
    expect(log?.type).toBe("warning");
  });

  it("訓練場 Lv0 の場合は warning ログが出ること", () => {
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        training_ground: { ...s.facilities.training_ground, level: 0 },
      },
    }));
    const v1Id = useGameStore.getState().villagers[0].id;
    useGameStore.getState().startTraining("training_str_1", v1Id);
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("訓練場"));
    expect(log?.type).toBe("warning");
  });
});
