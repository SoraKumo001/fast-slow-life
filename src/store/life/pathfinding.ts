import { isRoad, isWalkable, type GridPoint } from "../../data/townLayout";

export type { GridPoint };

export interface PathfindingOptions {
  /** 通行可能判定 (デフォルト: 町の isWalkable) */
  isWalkable?: (x: number, z: number) => boolean;
  /** セルへの進入コスト (デフォルト: 道 1 / その他 3) */
  cost?: (x: number, z: number) => number;
}

export const ROAD_COST = 1;
export const GRASS_COST = 3;

export function defaultCellCost(x: number, z: number): number {
  return isRoad(x, z) ? ROAD_COST : GRASS_COST;
}

function key(x: number, z: number): string {
  return `${x},${z}`;
}

interface OpenNode {
  x: number;
  z: number;
  f: number;
}

/**
 * グリッド A* (4方向)。道はコストが安いので優先的に通る。
 * start と goal を含む経路を返す。到達不能なら null。
 */
export function findPath(
  start: GridPoint,
  goal: GridPoint,
  options: PathfindingOptions = {},
): GridPoint[] | null {
  const walkable = options.isWalkable ?? isWalkable;
  const costOf = options.cost ?? defaultCellCost;

  if (!walkable(start.x, start.z) || !walkable(goal.x, goal.z)) return null;
  if (start.x === goal.x && start.z === goal.z) return [{ ...start }];

  const open: OpenNode[] = [{ x: start.x, z: start.z, f: 0 }];
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, GridPoint>();
  const closed = new Set<string>();
  gScore.set(key(start.x, start.z), 0);

  const heuristic = (x: number, z: number) =>
    (Math.abs(x - goal.x) + Math.abs(z - goal.z)) * ROAD_COST;

  const DIRS = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];

  while (open.length > 0) {
    // f 最小のノードを取り出す (グリッドは最大 32x32 なので線形探索で十分)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const ck = key(current.x, current.z);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (current.x === goal.x && current.z === goal.z) {
      const path: GridPoint[] = [{ x: current.x, z: current.z }];
      let node: GridPoint = { x: current.x, z: current.z };
      while (cameFrom.has(key(node.x, node.z))) {
        node = cameFrom.get(key(node.x, node.z))!;
        path.unshift({ ...node });
      }
      return path;
    }

    const currentG = gScore.get(ck) ?? Infinity;
    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const nz = current.z + dir.z;
      if (!walkable(nx, nz)) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const tentativeG = currentG + costOf(nx, nz);
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, { x: current.x, z: current.z });
        open.push({ x: nx, z: nz, f: tentativeG + heuristic(nx, nz) });
      }
    }
  }
  return null;
}

/** 経路の総コスト (進入コストの合計、先頭セルは除く) */
export function computePathCost(path: GridPoint[], costOf = defaultCellCost): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += costOf(path[i].x, path[i].z);
  }
  return total;
}
