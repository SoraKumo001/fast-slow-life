import { describe, it, expect } from "vitest";

import { DUNGEONS } from "../data/dungeons";
import {
  BOSS_GATE_NODE_ID,
  ENTRANCE_NODE_ID,
  buildDungeonMap,
  computeRevealedNodes,
  initialRevealedNodes,
  nearestNodeAtDepth,
  pathBetween,
} from "./dungeonMap";

describe("dungeonMap - buildDungeonMap", () => {
  it("全ダンジョンで入口から全ノードに到達できること", () => {
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

  it("ノード構成が 入口 + 採取 + 魔物 + ボス門 であること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      expect(map.nodes.length).toBe(
        1 + dungeon.gathers.length + dungeon.monsters.length + 1,
      );
      const entrance = map.byId.get(ENTRANCE_NODE_ID);
      expect(entrance?.depth).toBe(0);
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

  it("表示座標が x = lane × 6、z = depth であること", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      for (const node of map.nodes) {
        expect(node.x).toBe(node.lane * 6);
        expect(node.z).toBe(node.depth);
      }
    }
  });

  it("エッジは入口→最初の帯、または隣接する depth 帯の間のみであること（帯順序）", () => {
    for (const dungeon of DUNGEONS) {
      const map = buildDungeonMap(dungeon);
      const bandDepths = [
        ...new Set(
          map.nodes.filter((n) => n.kind !== "entrance").map((n) => n.depth),
        ),
      ].sort((a, b) => a - b);
      const bandIndex = new Map(bandDepths.map((d, i) => [d, i]));
      for (const [aId, bId] of map.edges) {
        const a = map.byId.get(aId)!;
        const b = map.byId.get(bId)!;
        if (a.kind === "entrance" || b.kind === "entrance") {
          const other = a.kind === "entrance" ? b : a;
          // 入口は最初の帯（最も浅い帯）にのみ接続する
          expect(bandIndex.get(other.depth)).toBe(0);
        } else {
          // 非入口同士は隣接帯（帯インデックス差 1）のみ
          expect(
            Math.abs(bandIndex.get(a.depth)! - bandIndex.get(b.depth)!),
          ).toBe(1);
        }
      }
      // 各ノード（入口・最初の帯を除く）は前の帯へ最大2本まで
      for (const node of map.nodes) {
        if (node.kind === "entrance") continue;
        const idx = bandIndex.get(node.depth)!;
        if (idx === 0) continue;
        const prevBandIds = new Set(
          map.nodes.filter((n) => bandIndex.get(n.depth) === idx - 1).map((n) => n.id),
        );
        const toPrev = (map.adjacency.get(node.id) ?? []).filter((id) =>
          prevBandIds.has(id),
        );
        expect(toPrev.length).toBeGreaterThanOrEqual(1);
        expect(toPrev.length).toBeLessThanOrEqual(2);
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

    // 最も浅い採取ノード（wheat, depth 12）の深度に村人がいる場合
    const revealed = computeRevealedNodes(map, [ENTRANCE_NODE_ID], [12]);
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
});
