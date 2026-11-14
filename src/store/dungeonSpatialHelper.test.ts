import { describe, it, expect } from "vitest";

import { DUNGEONS } from "../data/dungeons";
import { createVillager } from "../utils/villagerHelpers";
import {
  createDefaultDungeonState,
  getExploredDepth,
  getGatherDepth,
  getMonsterDepth,
  getVillagerPhaseLabel,
  moveTowardDepth,
} from "./dungeonSpatialHelper";

describe("dungeonSpatialHelper", () => {
  it("探索度に応じて開拓前線深度を算出すること", () => {
    const forest = { ...DUNGEONS[0], explorationProgress: 50 };
    expect(getExploredDepth(forest)).toBe(50);

    const mine = { ...DUNGEONS[1], explorationProgress: 40 };
    expect(getExploredDepth(mine)).toBe(60);
  });

  it("採取ノードとモンスターの配置深度を取得し、ボスはmaxDepthになること", () => {
    const forest = DUNGEONS[0];
    expect(getGatherDepth(forest, forest.gathers[0])).toBe(12);
    const goblin = forest.monsters.find((m) => m.id === "goblin")!;
    const boss = forest.monsters.find((m) => m.isBoss)!;
    expect(getMonsterDepth(forest, goblin)).toBe(28);
    expect(getMonsterDepth(forest, boss)).toBe(forest.maxDepth);
  });

  it("moveTowardDepth で目標深度へステップ移動し到達判定できること", () => {
    const step1 = moveTowardDepth(0, 30, 12);
    expect(step1.depth).toBe(12);
    expect(step1.arrived).toBe(false);

    const step2 = moveTowardDepth(25, 30, 12);
    expect(step2.depth).toBe(30);
    expect(step2.arrived).toBe(true);
  });

  it("村人のフェーズラベルを正しく返すこと", () => {
    const v = createVillager({ id: "v1", name: "アリス" });
    expect(getVillagerPhaseLabel(v)).toBe("待機中");

    v.status = "active";
    v.dungeonState = {
      ...createDefaultDungeonState(),
      currentDepth: 42,
      targetDepth: 42,
      phase: "fighting",
    };
    expect(getVillagerPhaseLabel(v)).toBe("42m地点で交戦中");
  });
});
