import type { DungeonArea, DungeonGather, DungeonMonster } from "../types/game";

/**
 * Phase 7: ダンジョンの2D迷路グラフ（純関数・決定的）。
 *
 * グリッド（横7列 × rows行）の全セルがノードになる。迷路はダンジョンIDの
 * ハッシュを種にした PRNG（mulberry32）で生成する再帰的バックトラッカの
 * spanning tree + 約10%の追加開通（ループ）で決定的に作られる。
 * ゲーム側の乱数ストリーム（store/random.ts）は一切消費しない。
 *
 * ノードの `depth` は「入口から迷路を辿った経路距離 (m)」に再定義される。
 * 1セルの歩幅 stepMeters = maxDepth / ボス門までの歩数 で校正し、
 * ボス門の経路距離がちょうど maxDepth に一致する。
 * シミュレーション側は従来どおり一次元（currentDepth）で動き、
 * depth の供給元である getGatherDepth / getMonsterDepth が
 * 本モジュールのノード経路距離を返すことで追随する。
 */

export type DungeonNodeKind = "entrance" | "passage" | "gather" | "monster" | "boss_gate";

export interface DungeonNode {
  id: string;
  kind: DungeonNodeKind;
  /** 採取ポイントの itemId（kind === "gather" のみ） */
  itemId?: string;
  /** 魔物の monsterId（kind === "monster" のみ） */
  monsterId?: string;
  /** 入口からの経路距離 (m) */
  depth: number;
  /** 入口からの経路歩数（BFS） */
  steps: number;
  /** グリッド座標（gx: 0..cols-1 左→右、gy: 0..rows-1 上→下。入口は最下段） */
  gx: number;
  gy: number;
  /** 表示座標 x = gx × 6 */
  x: number;
  /** 表示座標 z = gy × 6 */
  z: number;
}

export interface DungeonMap {
  dungeonId: string;
  nodes: DungeonNode[];
  /** 無向エッジ（[idA, idB]、idA < idB で正規化）。掘られた隣接のみ */
  edges: [string, string][];
  byId: Map<string, DungeonNode>;
  byCell: Map<string, DungeonNode>;
  adjacency: Map<string, string[]>;
  cols: number;
  rows: number;
  /** 1セルの歩幅 (m) = maxDepth / bossSteps */
  stepMeters: number;
  /** 入口→ボス門の経路歩数 */
  bossSteps: number;
}

export const ENTRANCE_NODE_ID = "entrance";
export const BOSS_GATE_NODE_ID = "boss_gate";

/** 霧の解放半径 (m): 村人の現在深度がこの範囲に入ったノードが解放される */
export const FOG_REVEAL_RADIUS = 15;

/** 迷路グリッドの列数（固定） */
export const MAZE_COLS = 7;

/** セルキーの生成（byCell 用） */
export function cellKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function passageNodeId(gx: number, gy: number): string {
  return `cell_${gx}_${gy}`;
}

// ---------------------------------------------------------------------------
// マスタデータ上の depth（配置順序の決定にのみ使う。従来の helper と同じ式）
// ---------------------------------------------------------------------------

/** 採取スポットのマスタデータ深度 (m)（迷路配置の順序付け用） */
export function getGatherDataDepth(area: DungeonArea, gather: DungeonGather): number {
  if (typeof gather.depth === "number") return gather.depth;
  const maxDepth = area.maxDepth || 100;
  const pct = (gather.unlockedAtProgress ?? 0) / 100;
  return Math.max(8, Math.min(maxDepth - 10, Math.round(maxDepth * (pct + 0.12))));
}

/** モンスターのマスタデータ深度 (m)（迷路配置の順序付け用） */
export function getMonsterDataDepth(area: DungeonArea, monster: DungeonMonster): number {
  const maxDepth = area.maxDepth || 100;
  if (monster.isBoss) return maxDepth;
  if (typeof monster.depth === "number") return monster.depth;
  const pct = (monster.unlockedAtProgress ?? 0) / 100;
  return Math.max(12, Math.min(maxDepth - 12, Math.round(maxDepth * (pct + 0.15))));
}

// ---------------------------------------------------------------------------
// 決定的 PRNG（ダンジョンIDのハッシュを種にする。ゲーム乱数とは無関係）
// ---------------------------------------------------------------------------

function hashString(seed: string): number {
  // FNV-1a 32bit
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 迷路生成
// ---------------------------------------------------------------------------

interface MazeLayout {
  cols: number;
  rows: number;
  /** 掘られた隣接（セルインデックス同士、a < b で正規化したキー "a|b"） */
  carved: Set<string>;
  /** セルインデックス → 入口からの経路歩数 */
  steps: number[];
  entranceIdx: number;
  bossIdx: number;
  bossSteps: number;
}

function mazeRows(maxDepth: number): number {
  return Math.min(40, Math.max(8, Math.round(maxDepth / 8) + 1));
}

function generateMaze(dungeonId: string, maxDepth: number): MazeLayout {
  const cols = MAZE_COLS;
  const rows = mazeRows(maxDepth);
  const cellCount = cols * rows;
  const idx = (gx: number, gy: number) => gy * cols + gx;
  const gxOf = (i: number) => i % cols;
  const gyOf = (i: number) => Math.floor(i / cols);

  const rand = mulberry32(hashString(`maze:${dungeonId}`));
  const entranceIdx = idx(Math.floor(cols / 2), rows - 1);

  // 隣接セル（N, E, S, W の固定順）
  const neighborsOf = (i: number): number[] => {
    const gx = gxOf(i);
    const gy = gyOf(i);
    const out: number[] = [];
    if (gy > 0) out.push(i - cols);
    if (gx < cols - 1) out.push(i + 1);
    if (gy < rows - 1) out.push(i + cols);
    if (gx > 0) out.push(i - 1);
    return out;
  };
  const edgeKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // 再帰的バックトラッカ（反復版）で全セルを結ぶ spanning tree を掘る
  const carved = new Set<string>();
  const visited = new Array<boolean>(cellCount).fill(false);
  visited[entranceIdx] = true;
  const stack: number[] = [entranceIdx];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = neighborsOf(current).filter((n) => !visited[n]);
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(rand() * candidates.length)];
    carved.add(edgeKey(current, next));
    visited[next] = true;
    stack.push(next);
  }

  // 残りの壁の約10%を追加で取り払い、ループ（経路選択）を作る
  const closed: [number, number][] = [];
  for (let i = 0; i < cellCount; i++) {
    for (const n of neighborsOf(i)) {
      if (n > i && !carved.has(edgeKey(i, n))) closed.push([i, n]);
    }
  }
  // Fisher-Yates（決定的 PRNG）
  for (let i = closed.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [closed[i], closed[j]] = [closed[j], closed[i]];
  }
  const openCount = Math.round(closed.length * 0.1);
  for (let i = 0; i < openCount; i++) {
    carved.add(edgeKey(closed[i][0], closed[i][1]));
  }

  // 入口からの経路歩数（BFS）
  const steps = new Array<number>(cellCount).fill(-1);
  steps[entranceIdx] = 0;
  const queue: number[] = [entranceIdx];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of neighborsOf(current)) {
      if (!carved.has(edgeKey(current, n)) || steps[n] !== -1) continue;
      steps[n] = steps[current] + 1;
      queue.push(n);
    }
  }

  // ボス門セル: 経路歩数が最大のセル（タイブレークは座標順）
  let bossIdx = entranceIdx;
  for (let i = 0; i < cellCount; i++) {
    if (steps[i] > steps[bossIdx]) bossIdx = i;
  }

  return { cols, rows, carved, steps, entranceIdx, bossIdx, bossSteps: steps[bossIdx] };
}

// ---------------------------------------------------------------------------
// マップ構築
// ---------------------------------------------------------------------------

// 同一ダンジョンのグラフはマスタデータ由来で静的なため、署名でメモ化する。
const mapCache = new Map<string, DungeonMap>();

function mapSignature(dungeon: DungeonArea): string {
  const g = (dungeon.gathers ?? [])
    .map((g) => `${g.itemId}:${getGatherDataDepth(dungeon, g)}`)
    .join(",");
  const m = (dungeon.monsters ?? [])
    .map((m) => `${m.id}:${getMonsterDataDepth(dungeon, m)}:${m.isBoss ? 1 : 0}`)
    .join(",");
  return `${dungeon.id}|${dungeon.maxDepth}|${g}|${m}`;
}

interface ContentItem {
  id: string;
  kind: "gather" | "monster";
  dataDepth: number;
  itemId?: string;
  monsterId?: string;
}

/**
 * ダンジョンの迷路グラフを決定論的に構築する。
 * ノードは全セル（入口 / passage / 採取 / 魔物 / ボス門）。
 * コンテンツはマスタデータ depth 昇順に、経路歩数順のセルへ等間隔に割り当て、
 * 可能な範囲で行き止まりセルを採取に、接続3以上のセルを魔物に優先する
 * （単調性＝データ depth 順と経路歩数順の一致は崩さない）。
 */
export function buildDungeonMap(dungeon: DungeonArea): DungeonMap {
  const signature = mapSignature(dungeon);
  const cached = mapCache.get(signature);
  if (cached) return cached;

  const maxDepth = dungeon.maxDepth || 100;
  const maze = generateMaze(dungeon.id, maxDepth);
  const { cols, rows, carved, steps, entranceIdx, bossIdx, bossSteps } = maze;
  const cellCount = cols * rows;
  const gxOf = (i: number) => i % cols;
  const gyOf = (i: number) => Math.floor(i / cols);
  const stepMeters = maxDepth / bossSteps;
  const depthOf = (i: number) =>
    i === bossIdx ? maxDepth : Math.round(steps[i] * stepMeters * 10) / 10;

  // セルの接続数（掘られた隣接の数）
  const degree = new Array<number>(cellCount).fill(0);
  const carvedPairs: [number, number][] = [];
  for (const key of carved) {
    const [a, b] = key.split("|").map(Number);
    carvedPairs.push([a, b]);
    degree[a]++;
    degree[b]++;
  }

  // --- コンテンツ配置 ---
  const content: ContentItem[] = [
    ...(dungeon.gathers ?? []).map((g) => ({
      id: g.itemId,
      kind: "gather" as const,
      dataDepth: getGatherDataDepth(dungeon, g),
      itemId: g.itemId,
    })),
    ...(dungeon.monsters ?? []).map((m) => ({
      id: m.id,
      kind: "monster" as const,
      dataDepth: getMonsterDataDepth(dungeon, m),
      monsterId: m.id,
    })),
  ].sort(
    (a, b) =>
      a.dataDepth - b.dataDepth ||
      (a.kind === b.kind ? 0 : a.kind === "gather" ? -1 : 1) ||
      (a.id < b.id ? -1 : 1),
  );

  // 候補セル（入口・ボス門を除く）を経路歩数順に並べる
  const candidates: number[] = [];
  for (let i = 0; i < cellCount; i++) {
    if (i !== entranceIdx && i !== bossIdx) candidates.push(i);
  }
  candidates.sort((a, b) => steps[a] - steps[b] || gyOf(a) - gyOf(b) || gxOf(a) - gxOf(b));

  // 等間隔の基準スロットを割り当てる
  const assigned = new Map<number, number>(); // content index -> cell idx
  const usedCells = new Set<number>();
  let prevSlot = -1;
  content.forEach((_, i) => {
    let slot = Math.floor(((i + 0.5) * candidates.length) / content.length);
    slot = Math.max(slot, prevSlot + 1);
    prevSlot = slot;
    assigned.set(i, candidates[slot]);
    usedCells.add(candidates[slot]);
  });

  // 優先セルへの寄せ替え（単調性を保つ範囲でのみ）:
  // 採取は行き止まり（接続1）、魔物は接続3以上のセルを優先する。
  content.forEach((item, i) => {
    const prefOk = (cell: number) =>
      item.kind === "gather" ? degree[cell] === 1 : degree[cell] >= 3;
    const current = assigned.get(i)!;
    if (prefOk(current)) return;
    const lower = i > 0 ? steps[assigned.get(i - 1)!] : 0;
    const upper = i < content.length - 1 ? steps[assigned.get(i + 1)!] : bossSteps;
    let best: number | null = null;
    for (const cell of candidates) {
      if (usedCells.has(cell) || !prefOk(cell)) continue;
      if (steps[cell] < lower || steps[cell] > upper) continue;
      if (
        best === null ||
        Math.abs(steps[cell] - steps[current]) < Math.abs(steps[best] - steps[current]) ||
        (Math.abs(steps[cell] - steps[current]) === Math.abs(steps[best] - steps[current]) &&
          (gyOf(cell) < gyOf(best) || (gyOf(cell) === gyOf(best) && gxOf(cell) < gxOf(best))))
      ) {
        best = cell;
      }
    }
    if (best !== null) {
      usedCells.delete(current);
      usedCells.add(best);
      assigned.set(i, best);
    }
  });

  const contentByCell = new Map<number, ContentItem>();
  content.forEach((item, i) => contentByCell.set(assigned.get(i)!, item));

  // --- ノード生成（全セル） ---
  const nodes: DungeonNode[] = [];
  const nodeIdByCell = new Array<string>(cellCount);
  for (let i = 0; i < cellCount; i++) {
    const gx = gxOf(i);
    const gy = gyOf(i);
    let id: string;
    let kind: DungeonNodeKind;
    let extra: { itemId?: string; monsterId?: string } = {};
    if (i === entranceIdx) {
      id = ENTRANCE_NODE_ID;
      kind = "entrance";
    } else if (i === bossIdx) {
      id = BOSS_GATE_NODE_ID;
      kind = "boss_gate";
    } else if (contentByCell.has(i)) {
      const item = contentByCell.get(i)!;
      id = item.id;
      kind = item.kind;
      extra = { itemId: item.itemId, monsterId: item.monsterId };
    } else {
      id = passageNodeId(gx, gy);
      kind = "passage";
    }
    nodeIdByCell[i] = id;
    nodes.push({
      id,
      kind,
      depth: depthOf(i),
      steps: steps[i],
      gx,
      gy,
      x: gx * 6,
      z: gy * 6,
      ...extra,
    });
  }
  // ノード順は決定的に（入口 → 経路歩数順 → 座標順）。解放リスト等の順序安定のため
  nodes.sort(
    (a, b) => a.steps - b.steps || a.gy - b.gy || a.gx - b.gx || (a.id < b.id ? -1 : 1),
  );

  // --- エッジ（掘られた隣接のみ） ---
  const edges: [string, string][] = carvedPairs.map(([a, b]) => {
    const idA = nodeIdByCell[a];
    const idB = nodeIdByCell[b];
    return (idA < idB ? [idA, idB] : [idB, idA]) as [string, string];
  });
  edges.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));

  const byId = new Map<string, DungeonNode>();
  const byCell = new Map<string, DungeonNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
    byCell.set(cellKey(node.gx, node.gy), node);
  }

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const [a, b] of edges) {
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  }
  for (const list of adjacency.values()) list.sort();

  const map: DungeonMap = {
    dungeonId: dungeon.id,
    nodes,
    edges,
    byId,
    byCell,
    adjacency,
    cols,
    rows,
    stepMeters,
    bossSteps,
  };
  mapCache.set(signature, map);
  return map;
}

export function nodeById(map: DungeonMap, id: string): DungeonNode | undefined {
  return map.byId.get(id);
}

/** 採取ノードの経路距離 (m)。マップに無い場合は undefined */
export function gatherNodeDepth(area: DungeonArea, gather: DungeonGather): number | undefined {
  return buildDungeonMap(area).byId.get(gather.itemId)?.depth;
}

/** 魔物ノードの経路距離 (m)。マップに無い場合は undefined */
export function monsterNodeDepth(area: DungeonArea, monster: DungeonMonster): number | undefined {
  return buildDungeonMap(area).byId.get(monster.id)?.depth;
}

/** コンテンツノード（採取・魔物・ボス門）だけを返す */
export function contentNodes(map: DungeonMap): DungeonNode[] {
  return map.nodes.filter(
    (n) => n.kind === "gather" || n.kind === "monster" || n.kind === "boss_gate",
  );
}

/** 解放率表示用: コンテンツノード基準の解放数 / 総数 */
export function countContentRevealed(
  map: DungeonMap,
  revealedIds: Iterable<string>,
): { revealed: number; total: number } {
  const revealed = new Set(revealedIds);
  const contents = contentNodes(map);
  return {
    revealed: contents.filter((n) => revealed.has(n.id)).length,
    total: contents.length,
  };
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
 * 入口 + (探索度% × maxDepth) 以下の経路距離のノードを解放済みにする。
 */
export function initialRevealedNodes(dungeon: DungeonArea): string[] {
  const map = buildDungeonMap(dungeon);
  const maxDepth = dungeon.maxDepth || 100;
  const frontier = (Math.min(100, Math.max(0, dungeon.explorationProgress)) / 100) * maxDepth;
  return map.nodes.filter((n) => n.depth <= frontier).map((n) => n.id);
}

/**
 * 旧セーブの revealedNodes を新マップへ移行する。
 * 新マップに存在しないIDを落とし、探索度からの初期解放と union する。
 * 戻り値は map のノード順に整列した決定的な配列。
 */
export function sanitizeRevealedNodes(dungeon: DungeonArea, ids: Iterable<string>): string[] {
  const map = buildDungeonMap(dungeon);
  const kept = new Set<string>();
  for (const id of ids) {
    if (map.byId.has(id)) kept.add(id);
  }
  for (const id of initialRevealedNodes(dungeon)) kept.add(id);
  return map.nodes.filter((n) => kept.has(n.id)).map((n) => n.id);
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

/**
 * 入口から targetNodeId への BFS パスに沿って、経路距離 depth に対応する
 * グリッド座標（小数）を補間して返す。表示専用（村人・魔物の描画位置）。
 * targetNodeId が無い / 到達不能な場合は入口セルの座標を返す。
 */
export function interpolateGridPosition(
  map: DungeonMap,
  targetNodeId: string | null | undefined,
  depth: number,
): { gx: number; gy: number } {
  const entrance = map.byId.get(ENTRANCE_NODE_ID)!;
  if (!targetNodeId || targetNodeId === ENTRANCE_NODE_ID) {
    return { gx: entrance.gx, gy: entrance.gy };
  }
  const path = pathBetween(map, ENTRANCE_NODE_ID, targetNodeId);
  if (!path || path.length === 0) return { gx: entrance.gx, gy: entrance.gy };

  const target = map.byId.get(targetNodeId)!;
  const d = Math.max(0, Math.min(depth, target.depth));
  for (let i = 0; i < path.length - 1; i++) {
    const a = map.byId.get(path[i])!;
    const b = map.byId.get(path[i + 1])!;
    if (d <= b.depth) {
      const span = b.depth - a.depth;
      const t = span > 0 ? (d - a.depth) / span : 0;
      return { gx: a.gx + (b.gx - a.gx) * t, gy: a.gy + (b.gy - a.gy) * t };
    }
  }
  return { gx: target.gx, gy: target.gy };
}
