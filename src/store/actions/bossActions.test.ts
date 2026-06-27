import "../../store/setupMockStorage";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useGameStore } from "../../store/gameStore";
import type { GameLog, Villager } from "../../types/game";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト戦士",
    currentJob: "戦士",
    jobHistory: ["戦士"],
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
    str: 20,
    int: 10,
    dex: 20,
    agi: 20,
    vit: 15,
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
    status: "active",
    order: "hunt",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    isStarving: false,
    ...overrides,
  } as Villager;
}

describe("bossActions - startBossBattle", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    // activeBoss を持つ特定村人を準備
    useGameStore.setState({
      isPaused: true,
      villagers: [
        makeVillager({ id: "v1", status: "active", destinationAreaId: "forest" }),
        makeVillager({ id: "v2", status: "idle" }),
      ],
    });
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("正常系: activeBoss がセットされ村人が戦闘状態になること", () => {
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    const after = useGameStore.getState();
    expect(after.activeBoss).not.toBeNull();
    expect(after.activeBoss?.monsterId).toBe("goblin_leader");
    expect(after.activeBoss?.maxHp).toBe(800);
    expect(after.activeBoss?.currentHp).toBe(800);
    expect(after.activeBoss?.attackerIds).toEqual(["v1"]);
    // 攻撃対象村人が hunt 状態に
    const v1 = after.villagers.find((v) => v.id === "v1");
    expect(v1?.order).toBe("hunt");
    expect(v1?.targetMonsterId).toBe("goblin_leader");
  });

  it("ボス戦開始で isPaused=false になること", () => {
    expect(useGameStore.getState().isPaused).toBe(true);
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    expect(useGameStore.getState().isPaused).toBe(false);
  });

  it("複数村人をアタッカーに指定できること", () => {
    useGameStore.getState().startBossBattle("goblin_leader", ["v1", "v2"]);
    const after = useGameStore.getState();
    expect(after.activeBoss?.attackerIds).toHaveLength(2);
  });

  it("ボス戦開始時に system ログが出力されること", () => {
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("エリアボス"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("system");
  });

  it("存在しない monsterId の場合は activeBoss がセットされないこと", () => {
    useGameStore.getState().startBossBattle("nonexistent_monster", ["v1"]);
    const after = useGameStore.getState();
    expect(after.activeBoss).toBeNull();
  });

  it("クラフトキューに登録された村人が攻撃参加する場合、キューから外れること", () => {
    // v1 にクラフトジョブを割り当て
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        workshop: {
          ...s.facilities.workshop,
          craftQueue: [
            { id: "job_1", itemId: "iron_ingot", timeLeft: 5, totalTime: 5, assignedVillagerId: "v1" },
          ],
        },
      },
      villagers: s.villagers.map((v) =>
        v.id === "v1" ? { ...v, assignedCraftJobId: "job_1" } : v,
      ),
    }));

    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    const after = useGameStore.getState();
    // クラフトキューの villagerId が null になっている
    expect(after.facilities.workshop.craftQueue[0].assignedVillagerId).toBeNull();
  });
});

describe("bossActions - withdrawFromBossBattle", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("正常系: ボス戦から撤退し activeBoss が null になること", () => {
    useGameStore.setState({
      villagers: [
        makeVillager({ id: "v1", status: "active", order: "hunt", targetMonsterId: "goblin_leader" }),
      ],
    });
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    expect(useGameStore.getState().activeBoss).not.toBeNull();

    useGameStore.getState().withdrawFromBossBattle();
    const after = useGameStore.getState();
    expect(after.activeBoss).toBeNull();
  });

  it("撤退時に attackerIds の村人が idle 状態に戻ること", () => {
    useGameStore.setState({
      villagers: [
        makeVillager({ id: "v1", status: "active", order: "hunt", targetMonsterId: "goblin_leader" }),
      ],
    });
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    useGameStore.getState().withdrawFromBossBattle();
    const after = useGameStore.getState();
    const v1 = after.villagers.find((v) => v.id === "v1");
    expect(v1?.status).toBe("idle");
    expect(v1?.targetMonsterId).toBeNull();
  });

  it("撤退時に info ログが追加されること", () => {
    useGameStore.setState({
      villagers: [
        makeVillager({ id: "v1", status: "active", order: "hunt", targetMonsterId: "goblin_leader" }),
      ],
    });
    useGameStore.getState().startBossBattle("goblin_leader", ["v1"]);
    useGameStore.getState().withdrawFromBossBattle();
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("撤退"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("info");
  });

  it("activeBoss が null の場合は撤退処理は何もしないこと", () => {
    // activeBoss がない状態で撤退を試みる
    useGameStore.getState().resetGame(false);
    const before = useGameStore.getState().villagers.length;
    useGameStore.getState().withdrawFromBossBattle();
    const after = useGameStore.getState();
    expect(after.villagers.length).toBe(before);
  });
});