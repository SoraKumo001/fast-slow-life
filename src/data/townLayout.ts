import type { FacilityType } from "../types/game";

/**
 * ポリゴンの町 (v2) のレイアウトデータ。
 * 32x32 マス、1マス = 2 ワールド単位。座標は x: 0..31 (東が+)、z: 0..31 (南が+)。
 * ワールド変換は world = (grid - 16) * 2。
 *
 * entrance はエージェントの到着点:
 * - 実体のある建物 (blocked) は南面の外側 1 マス
 * - 開けた作業場・広場 (blocked でない) は南端の内側 1 マス (敷地への入口)
 */

export const TOWN_GRID_SIZE = 32;
export const CELL_SIZE = 2;

export interface GridPoint {
  x: number;
  z: number;
}

export type TownBuildingKind =
  | "gate"
  | "facility"
  | "house"
  | "plaza"
  | "warehouse"
  | "workplace";

export interface TownBuildingDef {
  id: string;
  kind: TownBuildingKind;
  facilityId?: FacilityType;
  name: string;
  /** 左上マス */
  x: number;
  z: number;
  /** 占有マス数 */
  w: number;
  d: number;
  /** エージェントの到着点 (歩行可能マス) */
  entrance: GridPoint;
  /** 看板色 (0xRRGGBB) */
  signColor: number;
  /** true のマスは通行不可 (建物の実体) */
  blocked: boolean;
  /** 作業時の基準マス (歩行可能マス) */
  workAnchor: GridPoint;
}

function southOutside(x: number, z: number, w: number, d: number): GridPoint {
  return { x: x + Math.floor(w / 2), z: z + d };
}

function southInside(x: number, z: number, w: number, d: number): GridPoint {
  return { x: x + Math.floor(w / 2), z: z + d - 1 };
}

function centerOf(x: number, z: number, w: number, d: number): GridPoint {
  return { x: x + Math.floor(w / 2), z: z + Math.floor(d / 2) };
}

interface BuildingSeed {
  id: string;
  kind: TownBuildingKind;
  facilityId?: FacilityType;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  signColor: number;
  blocked: boolean;
  workAnchor?: GridPoint;
}

function toDef(seed: BuildingSeed): TownBuildingDef {
  const entrance = seed.blocked
    ? southOutside(seed.x, seed.z, seed.w, seed.d)
    : southInside(seed.x, seed.z, seed.w, seed.d);
  return {
    ...seed,
    entrance,
    workAnchor: seed.workAnchor ?? (seed.blocked ? entrance : centerOf(seed.x, seed.z, seed.w, seed.d)),
  };
}

const HOUSE_SIGN_COLORS = [0xe07856, 0x56a0e0, 0x7bc96f, 0xe0c056, 0xb07fe0];
const HOUSE_XS = [4, 9, 14, 19, 24];

const HOUSE_DEFS: TownBuildingDef[] = HOUSE_XS.map((hx, i) =>
  toDef({
    id: `house_${i + 1}`,
    kind: "house",
    name: `民家${i + 1}`,
    x: hx,
    z: 26,
    w: 3,
    d: 3,
    signColor: HOUSE_SIGN_COLORS[i],
    blocked: true,
  }),
);

export const TOWN_BUILDINGS: TownBuildingDef[] = [
  toDef({
    id: "gate",
    kind: "gate",
    name: "町の門",
    x: 14,
    z: 0,
    w: 4,
    d: 2,
    signColor: 0x9ca3af,
    blocked: true,
  }),
  toDef({
    id: "farm",
    kind: "workplace",
    facilityId: "farm",
    name: "農場",
    x: 2,
    z: 3,
    w: 6,
    d: 4,
    signColor: 0xa3e635,
    blocked: false,
    workAnchor: { x: 4, z: 5 },
  }),
  toDef({
    id: "lumberyard",
    kind: "workplace",
    facilityId: "lumberyard",
    name: "伐採所",
    x: 24,
    z: 3,
    w: 5,
    d: 4,
    signColor: 0x8b5a2b,
    blocked: false,
    workAnchor: { x: 26, z: 5 },
  }),
  toDef({
    id: "quarry",
    kind: "workplace",
    facilityId: "quarry",
    name: "採石場",
    x: 9,
    z: 2,
    w: 5,
    d: 3,
    signColor: 0x78909c,
    blocked: false,
    workAnchor: { x: 11, z: 3 },
  }),
  toDef({
    id: "inn",
    kind: "facility",
    facilityId: "inn",
    name: "宿屋",
    x: 9,
    z: 10,
    w: 4,
    d: 3,
    signColor: 0xf97316,
    blocked: true,
  }),
  // NOTE: 仕様表の倉庫 (12,10) は宿屋 (9,10 / 4x3) と 1 列重なるため (13,10) にずらした
  toDef({
    id: "warehouse",
    kind: "warehouse",
    name: "倉庫",
    x: 13,
    z: 10,
    w: 3,
    d: 2,
    signColor: 0x5d3a1a,
    blocked: true,
  }),
  toDef({
    id: "workshop",
    kind: "facility",
    facilityId: "workshop",
    name: "加工工房",
    x: 19,
    z: 10,
    w: 4,
    d: 3,
    signColor: 0xa04028,
    blocked: true,
  }),
  toDef({
    id: "guild",
    kind: "facility",
    facilityId: "guild",
    name: "冒険者ギルド",
    x: 9,
    z: 14,
    w: 4,
    d: 3,
    signColor: 0x3b82f6,
    blocked: true,
  }),
  toDef({
    id: "plaza",
    kind: "plaza",
    name: "広場",
    x: 14,
    z: 14,
    w: 4,
    d: 4,
    signColor: 0x9aa0a6,
    blocked: false,
    workAnchor: { x: 16, z: 16 },
  }),
  toDef({
    id: "market",
    kind: "facility",
    facilityId: "market",
    name: "交易所",
    x: 19,
    z: 14,
    w: 4,
    d: 3,
    signColor: 0xd9a441,
    blocked: true,
  }),
  toDef({
    id: "weapon_shop",
    kind: "facility",
    facilityId: "weapon_shop",
    name: "武器屋",
    x: 23,
    z: 16,
    w: 3,
    d: 3,
    signColor: 0xb8c0cc,
    blocked: true,
  }),
  toDef({
    id: "kitchen",
    kind: "facility",
    facilityId: "kitchen",
    name: "調理場",
    x: 10,
    z: 20,
    w: 3,
    d: 3,
    signColor: 0xfacc15,
    blocked: true,
  }),
  toDef({
    id: "alchemy",
    kind: "facility",
    facilityId: "alchemy",
    name: "錬金工房",
    x: 20,
    z: 20,
    w: 3,
    d: 3,
    signColor: 0x9333ea,
    blocked: true,
  }),
  toDef({
    id: "training_ground",
    kind: "workplace",
    facilityId: "training_ground",
    name: "訓練所",
    x: 24,
    z: 22,
    w: 5,
    d: 4,
    signColor: 0x27357a,
    blocked: false,
    workAnchor: { x: 26, z: 23 },
  }),
  ...HOUSE_DEFS,
];

export function getBuildingById(id: string): TownBuildingDef | undefined {
  return TOWN_BUILDINGS.find((b) => b.id === id);
}

export function isInBounds(x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < TOWN_GRID_SIZE && z < TOWN_GRID_SIZE;
}

/** 建物が占有するマス一覧 */
export function buildingCells(def: TownBuildingDef): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let dz = 0; dz < def.d; dz++) {
    for (let dx = 0; dx < def.w; dx++) {
      cells.push({ x: def.x + dx, z: def.z + dz });
    }
  }
  return cells;
}

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

const OCCUPIED_SET: Set<string> = (() => {
  const set = new Set<string>();
  for (const def of TOWN_BUILDINGS) {
    if (!def.blocked) continue;
    for (const c of buildingCells(def)) set.add(cellKey(c.x, c.z));
  }
  return set;
})();

/** 通行不可マスのグリッド [z][x] */
export function buildOccupancyGrid(): boolean[][] {
  const grid: boolean[][] = [];
  for (let z = 0; z < TOWN_GRID_SIZE; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < TOWN_GRID_SIZE; x++) {
      row.push(OCCUPIED_SET.has(cellKey(x, z)));
    }
    grid.push(row);
  }
  return grid;
}

export function isOccupied(x: number, z: number): boolean {
  return OCCUPIED_SET.has(cellKey(x, z));
}

export function isWalkable(x: number, z: number): boolean {
  return isInBounds(x, z) && !isOccupied(x, z);
}

const ROAD_SET: Set<string> = (() => {
  const set = new Set<string>();
  const hRow = (z: number, x1: number, x2: number) => {
    for (let x = x1; x <= x2; x++) set.add(cellKey(x, z));
  };
  const vCol = (x: number, z1: number, z2: number) => {
    for (let z = z1; z <= z2; z++) set.add(cellKey(x, z));
  };
  // 横の幹線
  hRow(7, 2, 29);
  hRow(13, 2, 29);
  hRow(19, 2, 29);
  hRow(24, 2, 22);
  hRow(29, 2, 29);
  // 縦の幹線
  vCol(15, 2, 29);
  vCol(16, 2, 29);
  vCol(6, 7, 29);
  vCol(11, 7, 29);
  vCol(25, 7, 24);
  // 広場の石畳は道と同じコストで扱う
  const plaza = getBuildingById("plaza");
  if (plaza) {
    for (const c of buildingCells(plaza)) set.add(cellKey(c.x, c.z));
  }
  return set;
})();

export function isRoad(x: number, z: number): boolean {
  return ROAD_SET.has(cellKey(x, z)) && isWalkable(x, z);
}

/** グリッド座標 → ワールド座標 (セル原点) */
export function gridToWorld(x: number, z: number): { x: number; z: number } {
  return {
    x: (x - TOWN_GRID_SIZE / 2) * CELL_SIZE,
    z: (z - TOWN_GRID_SIZE / 2) * CELL_SIZE,
  };
}

/** グリッド座標 → ワールド座標 (セル中心) */
export function gridToWorldCenter(x: number, z: number): { x: number; z: number } {
  const origin = gridToWorld(x, z);
  return { x: origin.x + CELL_SIZE / 2, z: origin.z + CELL_SIZE / 2 };
}
