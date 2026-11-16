import { describe, it, expect } from "vitest";

import { DUNGEONS } from "../data/dungeons";
import { createVillager } from "../utils/villagerHelpers";
import { BOSS_GATE_NODE_ID, buildDungeonMap, contentNodes } from "./dungeonMap";
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

  it("採取・モンスターの深度は迷路マップの経路距離と一致し、ボス門が maxDepth になること", () => {
    const forest = DUNGEONS[0];
    const map = buildDungeonMap(forest);
    // Phase 7: 深度 = 所属ノードの経路距離（マスタデータの depth ではない）
    expect(getGatherDepth(forest, forest.gathers[0])).toBe(
      map.byId.get(forest.gathers[0].itemId)?.depth,
    );
    const goblin = forest.monsters.find((m) => m.id === "goblin")!;
    expect(getMonsterDepth(forest, goblin)).toBe(map.byId.get("goblin")?.depth);
    // ボス門はちょうど maxDepth。ボス個体はコンテンツ中最大の経路距離で maxDepth 以下
    expect(map.byId.get(BOSS_GATE_NODE_ID)?.depth).toBe(forest.maxDepth);
    const boss = forest.monsters.find((m) => m.isBoss)!;
    const bossDepth = getMonsterDepth(forest, boss);
    expect(bossDepth).toBeLessThanOrEqual(forest.maxDepth);
    expect(bossDepth).toBe(
      Math.max(...contentNodes(map).filter((n) => n.kind === "monster").map((n) => n.depth)),
    );
    // 全コンテンツの経路距離は (0, maxDepth] に収まる
    for (const node of contentNodes(map)) {
      expect(node.depth).toBeGreaterThan(0);
      expect(node.depth).toBeLessThanOrEqual(forest.maxDepth);
    }
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
