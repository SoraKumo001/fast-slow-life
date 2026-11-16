import { describe, it, expect } from "vitest";

import { DUNGEONS } from "../data/dungeons";
import {
  BOSS_GATE_NODE_ID,
  ENTRANCE_NODE_ID,
  buildDungeonMap,
  cellKey,
  computeRevealedNodes,
  contentNodes,
  countContentRevealed,
  getGatherDataDepth,
  getMonsterDataDepth,
  initialRevealedNodes,
  interpolateGridPosition,
  nearestNodeAtDepth,
  pathBetween,
  sanitizeRevealedNodes,
} from "./dungeonMap";

describe("dungeonMap - buildDungeonMap (Phase 7 maze)", () => {
  it("全ダンジョンで入口から全セルに到達できること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      for (const node of map.nodes) {
        const path = pathBetween(map, ENTRANCE_NODE_ID, node.id);
        expect(path, `${dungeon.id}/${node.id}`).not.toBeNull();
        expect(path![0]).toBe(ENTRANCE_NODE_ID);
        expect(path![path!.length - 1]).toBe(node.id);
      }
    }
  });

  it("入口からボス門までのパスが存在すること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      const path = pathBetween(map, ENTRANCE_NODE_ID, BOSS_GATE_NODE_ID);
      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("決定的であること（2回構築して同一のノード・エッジになる）", () => {
    for (const dungeon of DUNGEONS) {
      const a = buildDungeonMap(dungeon);
      // キャッシュを回避するため、別オブジェクト（同内容）でも同じ結果になる
      const clone = JSON.parse(JSON.stringify(dungeon));
      const b = buildDungeonMap(clone);
      expect(b.nodes).toEqual(a.nodes);
      expect(b.edges).toEqual(a.edges);
    }
  });

  it("ノードは全セル分あり、コンテンツは 入口 + 採取 + 魔物 + ボス門 であること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      expect(map.nodes.length).toBe(map.cols * map.rows);
      expect(map.cols).toBe(7);
      expect(contentNodes(map).length).toBe(
        dungeon.gathers.length + dungeon.monsters.length + 1,
      );
      const entrance = map.byId.get(ENTRANCE_NODE_ID);
      expect(entrance?.depth).toBe(0);
      // 入口は最下段の中央セル
      expect(entrance?.gx).toBe(3);
      expect(entrance?.gy).toBe(map.rows - 1);
      const bossGate = map.byId.get(BOSS_GATE_NODE_ID);
      expect(bossGate?.depth).toBe(dungeon.maxDepth);
      for (const g of dungeon.gathers) {
        expect(map.byId.get(g.itemId)?.kind).toBe("gather");
      }
      for (const m of dungeon.monsters) {
        expect(map.byId.get(m.id)?.kind).toBe("monster");
      }
    }
  });

  it("グリッド寸法が rows = clamp(round(maxDepth/8)+1, 8, 40) であること", () => {
    const expected: Record<string, number> = {
      forest: 14,
      mine: 20,
      valley: 26,
      world_tree: 32,
      abyss: 39,
    };
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      expect(map.rows, dungeon.id).toBe(expected[dungeon.id]);
    }
  });

  it("表示座標が x = gx × 6、z = gy × 6 であること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      for (const node of map.nodes) {
        expect(node.x).toBe(node.gx * 6);
        expect(node.z).toBe(node.gy * 6);
        expect(map.byCell.get(cellKey(node.gx, node.gy))).toBe(node);
      }
    }
  });

  it("エッジは直交する隣接セル同士のみで、ループが存在すること（完全迷路でない）", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      for (const [aId, bId] of map.edges) {
        const a = map.byId.get(aId)!;
        const b = map.byId.get(bId)!;
        expect(Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy)).toBe(1);
      }
      // spanning tree の辺数（セル数-1）より多い = ループがある
      expect(map.edges.length).toBeGreaterThan(map.nodes.length - 1);
    }
  });

  it("ボス門が最遠セルで、経路距離 = maxDepth に校正されること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      const boss = map.byId.get(BOSS_GATE_NODE_ID)!;
      expect(boss.depth).toBe(dungeon.maxDepth);
      expect(map.stepMeters).toBeCloseTo(dungeon.maxDepth / map.bossSteps, 10);
      for (const node of map.nodes) {
        expect(node.steps).toBeLessThanOrEqual(boss.steps);
        // 経路距離 = 歩数 × 歩幅（ボス門は厳密に maxDepth、それ以外は 0.1 単位の丸め）
        if (node.id === BOSS_GATE_NODE_ID) {
          expect(node.depth).toBe(dungeon.maxDepth);
        } else {
          expect(Math.abs(node.depth - node.steps * map.stepMeters)).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });

  it("コンテンツ配置が単調であること（データ depth 順 = 経路歩数順）", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      const items = [
        ...dungeon.gathers.map((g) => ({
          id: g.itemId,
          dataDepth: getGatherDataDepth(dungeon, g),
        })),
        ...dungeon.monsters.map((m) => ({
          id: m.id,
          dataDepth: getMonsterDataDepth(dungeon, m),
        })),
      ].sort((a, b) => a.dataDepth - b.dataDepth || (a.id < b.id ? -1 : 1));
      let prevSteps = -1;
      for (const item of items) {
        const node = map.byId.get(item.id)!;
        expect(node, `${dungeon.id}/${item.id}`).toBeDefined();
        expect(
          node.steps,
          `${dungeon.id}/${item.id} dataDepth=${item.dataDepth}`,
        ).toBeGreaterThanOrEqual(prevSteps);
        prevSteps = node.steps;
      }
    }
  });

  it("nearestNodeAtDepth が最も近いノードを返すこと", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const map = buildDungeonMap(forest);
    expect(nearestNodeAtDepth(map, 0).id).toBe(ENTRANCE_NODE_ID);
    expect(nearestNodeAtDepth(map, forest.maxDepth).id).toBe(BOSS_GATE_NODE_ID);
    const mid = nearestNodeAtDepth(map, 50);
    expect(Math.abs(mid.depth - 50)).toBeLessThanOrEqual(15);
  });

  it("interpolateGridPosition がパス上の点を返すこと", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const map = buildDungeonMap(forest);
    const entrance = map.byId.get(ENTRANCE_NODE_ID)!;
    const boss = map.byId.get(BOSS_GATE_NODE_ID)!;

    // depth 0 は入口
    expect(interpolateGridPosition(map, BOSS_GATE_NODE_ID, 0)).toEqual({
      gx: entrance.gx,
      gy: entrance.gy,
    });
    // ボス門の経路距離ではボス門セルに一致
    expect(interpolateGridPosition(map, BOSS_GATE_NODE_ID, forest.maxDepth)).toEqual({
      gx: boss.gx,
      gy: boss.gy,
    });
    // パス上の各ノードの経路距離ではそのノードの座標に一致
    const path = pathBetween(map, ENTRANCE_NODE_ID, BOSS_GATE_NODE_ID)!;
    for (const nodeId of path) {
      const node = map.byId.get(nodeId)!;
      const pos = interpolateGridPosition(map, BOSS_GATE_NODE_ID, node.depth);
      expect(pos.gx).toBeCloseTo(node.gx, 8);
      expect(pos.gy).toBeCloseTo(node.gy, 8);
    }
    // ターゲット無しは入口
    expect(interpolateGridPosition(map, null, 50)).toEqual({
      gx: entrance.gx,
      gy: entrance.gy,
    });
  });
});

describe("dungeonMap - fog", () => {
  it("initialRevealedNodes は探索度に応じた深さまでのノード + 入口を含むこと", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const fresh = { ...forest, explorationProgress: 0 };
    expect(initialRevealedNodes(fresh)).toEqual([ENTRANCE_NODE_ID]);

    const full = { ...forest, explorationProgress: 100 };
    const map = buildDungeonMap(forest);
    expect(initialRevealedNodes(full).sort()).toEqual(
      map.nodes.map((n) => n.id).sort(),
    );
  });

  it("computeRevealedNodes は ±15m 以内のノードとその隣接ノードを解放すること", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const map = buildDungeonMap(forest);
    // 誰もいなければ入口のみ
    expect(computeRevealedNodes(map, [], [])).toEqual([ENTRANCE_NODE_ID]);

    // 最も浅い採取ノード（wheat）の経路距離に村人がいる場合
    const wheat = map.byId.get("wheat")!;
    const revealed = computeRevealedNodes(map, [ENTRANCE_NODE_ID], [wheat.depth]);
    expect(revealed).toContain("wheat");
    // 隣接ノードも解放される
    for (const neighbor of map.adjacency.get("wheat") ?? []) {
      expect(revealed).toContain(neighbor);
    }
    // 最深部はまだ解放されない
    expect(revealed).not.toContain(BOSS_GATE_NODE_ID);
  });

  it("computeRevealedNodes は決定的で、既存の解放を保持すること", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const map = buildDungeonMap(forest);
    const before = [ENTRANCE_NODE_ID, BOSS_GATE_NODE_ID];
    const a = computeRevealedNodes(map, before, []);
    const b = computeRevealedNodes(map, before, []);
    expect(a).toEqual(b);
    expect(a).toContain(BOSS_GATE_NODE_ID);
  });

  it("countContentRevealed はコンテンツノードだけを数えること", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const map = buildDungeonMap(forest);
    const total = contentNodes(map).length;
    expect(countContentRevealed(map, [])).toEqual({ revealed: 0, total });
    // passage を解放しても数えない
    const passage = map.nodes.find((n) => n.kind === "passage")!;
    expect(countContentRevealed(map, [passage.id]).revealed).toBe(0);
    expect(countContentRevealed(map, [ENTRANCE_NODE_ID, "wheat"]).revealed).toBe(1);
    expect(countContentRevealed(map, map.nodes.map((n) => n.id)).revealed).toBe(total);
  });
});

describe("dungeonMap - save migration", () => {
  it("sanitizeRevealedNodes は存在しないIDを落とし、初期解放と union すること", () => {
    const forest = DUNGEONS.find((d) => d.id === "forest")!;
    const fresh = { ...forest, explorationProgress: 0 };
    const migrated = sanitizeRevealedNodes(fresh, [
      "wheat",
      "boss_gate",
      "removed_content_id",
      ENTRANCE_NODE_ID,
    ]);
    expect(migrated).toContain("wheat");
    expect(migrated).toContain(BOSS_GATE_NODE_ID);
    expect(migrated).toContain(ENTRANCE_NODE_ID);
    expect(migrated).not.toContain("removed_content_id");

    // 探索度 100% の旧セーブは全セルが初期解放として union される
    const full = { ...forest, explorationProgress: 100 };
    const map = buildDungeonMap(forest);
    expect(sanitizeRevealedNodes(full, []).sort()).toEqual(
      map.nodes.map((n) => n.id).sort(),
    );
  });
});
