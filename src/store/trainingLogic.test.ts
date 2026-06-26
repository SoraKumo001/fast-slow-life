import { describe, it, expect, beforeEach } from "vitest";

import { TRAINING_COOLDOWN_DAYS } from "../constants";
import { useToastStore } from "../hooks/useToastStore";
import { useGameStore } from "../store/gameStore";
import { processAutoTraining, processTrainingQueue } from "../store/trainingLogic";
import type { Facility, FacilityType, Villager } from "../types/game";

/** テスト用の村人ファクトリ */
function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v_test",
    name: "テスト村人",
    currentJob: "無職",
    jobHistory: ["無職"],
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

/** テスト用の訓練場 */
function makeTrainingGround(overrides: Partial<Facility> = {}): Facility {
  return {
    id: "training_ground" as FacilityType,
    name: "訓練場",
    level: 1,
    maxLevel: 5,
    upgradeTimeLeft: 0,
    upgradeTotalTime: 0,
    upgradeCost: { gold: 0, materials: [] },
    craftQueue: [],
    trainingQueue: [],
    upgradeAssignedVillagerId: null,
    ...overrides,
  } as Facility;
}

describe("trainingLogic - クールダウン", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    useToastStore.setState({ toasts: [] });
  });

  describe("processAutoTraining: クールダウンチェック", () => {
    it("クールダウン中 (lastTrainingDay から 3 日) は自動訓練をスキップする", () => {
      const v = makeVillager({ id: "v1", gold: 500, lastTrainingDay: 10 });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      // 訓練場と gold をセットアップ
      useGameStore.setState((s) => ({
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      // 現在日 = 13 (lastTrainingDay=10 から 3 日経過、5 日未満)
      const result = processAutoTraining(useGameStore.getState().facilities, [v], 13);

      expect(result.facilities.training_ground?.trainingQueue.length).toBe(0);
    });

    it("クールダウン経過後 (lastTrainingDay から 5 日) は自動訓練を開始する", () => {
      const v = makeVillager({ id: "v1", gold: 500, lastTrainingDay: 10 });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      // 現在日 = 15 (lastTrainingDay=10 から 5 日経過、ちょうど)
      const result = processAutoTraining(useGameStore.getState().facilities, [v], 15);

      expect(result.facilities.training_ground?.trainingQueue.length).toBe(1);
    });

    it("lastTrainingDay が未設定 (undefined) の村人は即座に訓練可能", () => {
      const v = makeVillager({ id: "v1", gold: 500, lastTrainingDay: undefined });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      const result = processAutoTraining(useGameStore.getState().facilities, [v], 1);

      expect(result.facilities.training_ground?.trainingQueue.length).toBe(1);
    });

    it(`TRAINING_COOLDOWN_DAYS = ${TRAINING_COOLDOWN_DAYS} 日ちょうどの場合は許可される`, () => {
      // 閾値の確認: 「未満」(<) なので丁度の差は OK
      const v = makeVillager({ id: "v1", gold: 500, lastTrainingDay: 10 });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      const result = processAutoTraining(useGameStore.getState().facilities, [v], 15);

      expect(result.facilities.training_ground?.trainingQueue.length).toBe(1);
    });
  });

  describe("startTraining: クールダウンチェック (手動)", () => {
    it("クールダウン中の手動訓練は警告ログを出して拒否される", () => {
      const v = makeVillager({
        id: "v_manual",
        name: "手動訓練テスト",
        gold: 1000,
        lastTrainingDay: 10,
        status: "idle",
      });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        currentDay: 12, // 2 日前 (5 日未満)
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      useGameStore.getState().startTraining("training_str_1", v.id);

      const state = useGameStore.getState();
      // 訓練キューに追加されていない
      expect(state.facilities.training_ground.trainingQueue.length).toBe(0);
      // gold は減っていない
      expect(state.villagers[0].gold).toBe(1000);
      // 警告ログが出力されている
      const warnLog = state.logs.find((l) => l.message.includes("経過していない"));
      expect(warnLog).toBeDefined();
      expect(warnLog?.type).toBe("warning");
    });

    it("クールダウン経過後の手動訓練は正常に開始される", () => {
      const v = makeVillager({
        id: "v_manual_ok",
        name: "訓練OK村人",
        gold: 1000,
        lastTrainingDay: 5,
        status: "idle",
      });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        currentDay: 10, // 5 日前丁度
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      useGameStore.getState().startTraining("training_str_1", v.id);

      const state = useGameStore.getState();
      expect(state.facilities.training_ground.trainingQueue.length).toBe(1);
    });

    it("lastTrainingDay = 0 (初期値) の村人は即座に手動訓練可能", () => {
      const v = makeVillager({
        id: "v_fresh",
        name: "新規村人",
        gold: 1000,
        lastTrainingDay: 0,
        status: "idle",
      });
      const fac = makeTrainingGround({ level: 1, trainingQueue: [] });

      useGameStore.setState((s) => ({
        currentDay: 1,
        gold: 10000,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      useGameStore.getState().startTraining("training_str_1", v.id);

      const state = useGameStore.getState();
      expect(state.facilities.training_ground.trainingQueue.length).toBe(1);
    });
  });

  describe("processTrainingQueue: クールダウンフラグ更新", () => {
    it("訓練完了時に lastTrainingDay が更新される", () => {
      const v = makeVillager({ id: "v_complete", gold: 100, lastTrainingDay: 0, status: "active" });
      const fac = makeTrainingGround({
        level: 1,
        trainingQueue: [
          {
            id: "job_1",
            programId: "training_str_1",
            timeLeft: 1, // 1 時間で完了
            totalTime: 1,
            assignedVillagerId: "v_complete",
            goldPerHour: 0,
          },
        ],
      });

      useGameStore.setState((s) => ({
        currentDay: 100,
        villagers: [v],
        facilities: { ...s.facilities, training_ground: fac },
      }));

      const result = processTrainingQueue(fac, [v], 10000, 100);

      const completed = result.villagers.find((vv) => vv.id === "v_complete");
      expect(completed?.lastTrainingDay).toBe(100);
      expect(completed?.status).toBe("idle");
    });
  });
});
