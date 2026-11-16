import type { DungeonArea } from "../types/game";
import { getGatherDepth, getMonsterDepth } from "./dungeonSpatialHelper";

/**
 * Phase 4a: ダンジョンのノードグラフ（純関数）。
 *
 * ノード = 入口 (depth 0) + 採取ポイント (itemId) + 魔物 (monsterId) + 最深部のボス門。
 * 表示座標は x = lane × 6、z = depth（ミニマップ等の2D表示用）。
 * 3D表示では lane / depth から既存の laneToX / depthToZ で変換する。
 */

export type DungeonNodeKind = "entrance" | "gather" | "monster" | "boss_gate";

export interface DungeonNode {
  id: string;
  kind: DungeonNodeKind;
  /** 採取ポイントの itemId（kind === "gather" のみ） */
  itemId?: string;
  /** 魔物の monsterId（kind === "monster" のみ） */
  monsterId?: string;
  depth: number;
  lane: number;
  /** 表示座標 x = lane × 6 */
  x: number;
  /** 表示座標 z = depth */
  z: number;
}

export interface DungeonMap {
  dungeonId: string;
  nodes: DungeonNode[];
  /** 無向エッジ（[idA, idB]、idA < idB で正規化） */
  edges: [string, string][];
  byId: Map<string, DungeonNode>;
  adjacency: Map<string, string[]>;
}

export const ENTRANCE_NODE_ID = "entrance";
export const BOSS_GATE_NODE_ID = "boss_gate";

/** 霧の解放半径 (m): 村人の現在深度がこの範囲に入ったノードが解放される */
export const FOG_REVEAL_RADIUS = 15;

function makeNode(
  id: string,
  kind: DungeonNodeKind,
  depth: number,
  lane: number,
  extra?: { itemId?: string; monsterId?: string },
): DungeonNode {
  return {
    id,
    kind,
    depth,
    lane,
    x: lane * 6,
    z: depth,
    ...extra,
  };
}

// 同一ダンジョンのグラフはマスタデータ由来で静的なため、署名でメモ化する。
// （state 側の DungeonArea は毎ティック複製されるが、depth/lane/ID は不変）
const mapCache = new Map<string, DungeonMap>();

function mapSignature(dungeon: DungeonArea): string {
  const g = (dungeon.gathers ?? [])
    .map((g) => `${g.itemId}:${getGatherDepth(dungeon, g)}:${g.lane ?? ""}`)
    .join(",");
  const m = (dungeon.monsters ?? [])
    .map((m) => `${m.id}:${getMonsterDepth(dungeon, m)}:${m.lane ?? ""}`)
    .join(",");
  return `${dungeon.id}|${dungeon.maxDepth}|${g}|${m}`;
}

/**
 * ダンジョンのノードグラフを決定論的に構築する。
 * エッジ: depth 帯を昇順に見て、各ノードを前の帯の lane が最も近いノード最大2つと結ぶ。
 * 入口は最初の帯の全ノードと接続する。
 */
export function buildDungeonMap(dungeon: DungeonArea): DungeonMap {
  const signature = mapSignature(dungeon);
  const cached = mapCache.get(signature);
  if (cached) return cached;

  const nodes: DungeonNode[] = [makeNode(ENTRANCE_NODE_ID, "entrance", 0, 0)];

  (dungeon.gathers ?? []).forEach((g, idx) => {
    const depth = getGatherDepth(dungeon, g);
    const lane = g.lane ?? (idx % 2 === 0 ? -1.2 : 1.2);
    nodes.push(makeNode(g.itemId, "gather", depth, lane, { itemId: g.itemId }));
  });
  (dungeon.monsters ?? []).forEach((m) => {
    const depth = getMonsterDepth(dungeon, m);
    const lane = m.lane ?? 0;
    nodes.push(makeNode(m.id, "monster", depth, lane, { monsterId: m.id }));
  });
  nodes.push(makeNode(BOSS_GATE_NODE_ID, "boss_gate", dungeon.maxDepth || 100, 0));

  // depth 帯（入口を除く、同 depth のノード群）を昇順に並べる
  const bands = new Map<number, DungeonNode[]>();
  for (const node of nodes) {
    if (node.kind === "entrance") continue;
    const band = bands.get(node.depth) ?? [];
    band.push(node);
    bands.set(node.depth, band);
  }
  const sortedDepths = [...bands.keys()].sort((a, b) => a - b);
  const sortedBands = sortedDepths.map((d) => {
    const band = [...bands.get(d)!];
    band.sort((a, b) => a.lane - b.lane || (a.id < b.id ? -1 : 1));
    return band;
  });

  const edgeKeys = new Set<string>();
  const edges: [string, string][] = [];
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(a < b ? [a, b] : [b, a]);
  };

  // 入口 → 最初の帯の全ノード
  if (sortedBands.length > 0) {
    for (const node of sortedBands[0]) {
      addEdge(ENTRANCE_NODE_ID, node.id);
    }
  }
  // 各帯 → 前の帯（lane が最も近い最大2ノード）
  for (let i = 1; i < sortedBands.length; i++) {
    const prev = sortedBands[i - 1];
    for (const node of sortedBands[i]) {
      const nearest = [...prev]
        .sort(
          (a, b) =>
            Math.abs(a.lane - node.lane) - Math.abs(b.lane - node.lane) ||
            a.lane - b.lane ||
            (a.id < b.id ? -1 : 1),
        )
        .slice(0, 2);
      for (const target of nearest) {
        addEdge(target.id, node.id);
      }
    }
  }
  edges.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));

  const byId = new Map<string, DungeonNode>();
  for (const node of nodes) byId.set(node.id, node);

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const [a, b] of edges) {
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  }
  for (const list of adjacency.values()) list.sort();

  const map: DungeonMap = { dungeonId: dungeon.id, nodes, edges, byId, adjacency };
  mapCache.set(signature, map);
  return map;
}

export function nodeById(map: DungeonMap, id: string): DungeonNode | undefined {
  return map.byId.get(id);
}

/** BFS で最短パス（ノードID列）を返す。到達不能なら null。 */
export function pathBetween(map: DungeonMap, fromId: string, toId: string): string[] | null {
  if (!map.byId.has(fromId) || !map.byId.has(toId)) return null;
  if (fromId === toId) return [fromId];

  const prev = new Map<string, string | null>();
  prev.set(fromId, null);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of map.adjacency.get(current) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      if (next === toId) {
        const path: string[] = [toId];
        let cursor: string | null = current;
        while (cursor !== null) {
          path.unshift(cursor);
          cursor = prev.get(cursor) ?? null;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** 指定 depth に最も近いノードを返す（同距離なら浅い方 → ID 順で決定的に選ぶ）。 */
export function nearestNodeAtDepth(map: DungeonMap, depth: number): DungeonNode {
  let best = map.nodes[0];
  for (const node of map.nodes) {
    const diff = Math.abs(node.depth - depth);
    const bestDiff = Math.abs(best.depth - depth);
    if (
      diff < bestDiff ||
      (diff === bestDiff &&
        (node.depth < best.depth || (node.depth === best.depth && node.id < best.id)))
    ) {
      best = node;
    }
  }
  return best;
}

/**
 * 探索度から初期の解放済みノードを決める（セーブ移行・初期状態用）。
 * 入口 + (探索度% × maxDepth) 以下の depth のノードを解放済みにする。
 */
export function initialRevealedNodes(dungeon: DungeonArea): string[] {
  const map = buildDungeonMap(dungeon);
  const maxDepth = dungeon.maxDepth || 100;
  const frontier = (Math.min(100, Math.max(0, dungeon.explorationProgress)) / 100) * maxDepth;
  return map.nodes.filter((n) => n.depth <= frontier).map((n) => n.id);
}

/**
 * 霧の解放計算（純関数）。
 * いずれかの村人の現在深度がノード depth の ±FOG_REVEAL_RADIUS 以内に入ったら、
 * そのノードとグラフ上で隣接するノードを解放する。
 * 戻り値は map のノード順に整列した解放済みID配列（決定的）。
 */
export function computeRevealedNodes(
  map: DungeonMap,
  current: Iterable<string>,
  villagerDepths: number[],
): string[] {
  const revealed = new Set<string>(current);
  revealed.add(ENTRANCE_NODE_ID);

  if (villagerDepths.length > 0) {
    for (const node of map.nodes) {
      const inRange = villagerDepths.some(
        (d) => Math.abs(d - node.depth) <= FOG_REVEAL_RADIUS,
      );
      if (!inRange) continue;
      revealed.add(node.id);
      for (const neighbor of map.adjacency.get(node.id) ?? []) {
        revealed.add(neighbor);
      }
    }
  }

  return map.nodes.filter((n) => revealed.has(n.id)).map((n) => n.id);
}
