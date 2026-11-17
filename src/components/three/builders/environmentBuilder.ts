import * as THREE from "three";

import {
  BOSS_GATE_NODE_ID,
  ENTRANCE_NODE_ID,
  interpolateGridPosition,
  pathBetween,
  type DungeonMap,
} from "../../../store/dungeonMap";
import { addPaperEdges, addPaperEdgesToGroup } from "./paperStyle";

export const DEPTH_SCALE = 0.45;
export const LANE_SCALE = 1.6;

/** 旧・直線通路用の座標変換（互換のため残置） */
export function depthToZ(depth: number): number {
  return -depth * DEPTH_SCALE;
}

/** 旧・直線通路用の座標変換（互換のため残置） */
export function laneToX(lane: number): number {
  return lane * LANE_SCALE;
}

/** Phase 7: 迷路グリッドの1セルの一辺（ワールド単位） */
export const GRID_CELL_WORLD = 6;

/**
 * Phase 7: グリッド座標 → 3Dワールド座標。
 * グリッド中心が原点、入口行（gy = rows-1）が +Z（手前）になる。
 */
export function gridToWorld(
  gx: number,
  gy: number,
  cols: number,
  rows: number,
): { x: number; z: number } {
  return {
    x: (gx - (cols - 1) / 2) * GRID_CELL_WORLD,
    z: (gy - (rows - 1) / 2) * GRID_CELL_WORLD,
  };
}

export interface DungeonTheme {
  skyColor: number;
  fogColor: number;
  floorColor: number;
  pathColor: number;
  accentColor: number;
  ambientIntensity: number;
  lightColor: number;
  wallStyle: "trees" | "mine" | "canyon" | "roots" | "abyss";
}

export const DUNGEON_THEMES: Record<string, DungeonTheme> = {
  forest: {
    skyColor: 0x0f2419,
    fogColor: 0x132c1f,
    floorColor: 0x1e3f28,
    pathColor: 0x4a3c2c,
    accentColor: 0x4ade80,
    ambientIntensity: 0.9,
    lightColor: 0xffe4b5,
    wallStyle: "trees",
  },
  mine: {
    skyColor: 0x11131a,
    fogColor: 0x161822,
    floorColor: 0x262936,
    pathColor: 0x353947,
    accentColor: 0xf59e0b,
    ambientIntensity: 0.65,
    lightColor: 0xffa94d,
    wallStyle: "mine",
  },
  valley: {
    skyColor: 0x261515,
    fogColor: 0x2e1a18,
    floorColor: 0x4a2c25,
    pathColor: 0x5c3a31,
    accentColor: 0xfb7185,
    ambientIntensity: 0.8,
    lightColor: 0xffb4a2,
    wallStyle: "canyon",
  },
  world_tree: {
    skyColor: 0x0c1b29,
    fogColor: 0x102536,
    floorColor: 0x173545,
    pathColor: 0x25495c,
    accentColor: 0x38bdf8,
    ambientIntensity: 0.85,
    lightColor: 0x7dd3fc,
    wallStyle: "roots",
  },
  abyss: {
    skyColor: 0x090712,
    fogColor: 0x120b24,
    floorColor: 0x1a112b,
    pathColor: 0x26193d,
    accentColor: 0xc084fc,
    ambientIntensity: 0.6,
    lightColor: 0xd8b4fe,
    wallStyle: "abyss",
  },
};

/** テーマごとの壁（生け垣・岩壁など）の色 */
const WALL_COLORS: Record<DungeonTheme["wallStyle"], number> = {
  trees: 0x2f4d23,
  mine: 0x3b404e,
  canyon: 0x63392d,
  roots: 0x274435,
  abyss: 0x271b3d,
};

/** 霧で暗く沈ませる色（未解放） */
const FOG_DARK_COLOR = 0x12141a;

export interface FogMeshRef<T> {
  mesh: THREE.Mesh;
  /** このメッシュが属するセル（タイル用） */
  nodeId?: string;
  /** 接続する2セル（通路・壁用）。どちらか一方が解放済みなら明るくする */
  aId?: string;
  bId?: string;
  userData?: T;
}

export interface BuiltEnvironment {
  group: THREE.Group;
  frontierMesh: THREE.Group;
  theme: DungeonTheme;
  /** Phase 4a: ノードID → プラットフォームのマテリアル（霧の解放状態で色を変える） */
  nodePlatforms: Map<string, THREE.MeshStandardMaterial>;
  /** Phase 7: セルタイル（霧で素材を差し替える） */
  fogTiles: FogMeshRef<never>[];
  /** Phase 7: 通路ストリップ（掘られたエッジ） */
  fogEdges: FogMeshRef<never>[];
  /** Phase 7: 壁（掘られていない隣接辺） */
  fogWalls: FogMeshRef<never>[];
  /** Phase 7: 霧の差し替え用共有マテリアル */
  fogMats: {
    tileLit: THREE.MeshStandardMaterial;
    tileDark: THREE.MeshStandardMaterial;
    edgeLit: THREE.MeshStandardMaterial;
    edgeDark: THREE.MeshStandardMaterial;
    wallLit: THREE.MeshStandardMaterial;
    wallDark: THREE.MeshStandardMaterial;
  };
}

/**
 * ダンジョンテーマに応じた3D環境を構築する。
 * map が渡された場合は Phase 7 の迷路（セルタイル＋通路＋壁＋コンテンツ
 * プラットフォーム）を構築し、渡されない場合は旧来の直線通路を構築する。
 */
export function buildDungeonEnvironment(
  areaId: string,
  maxDepth: number,
  map?: DungeonMap,
): BuiltEnvironment {
  const theme = DUNGEON_THEMES[areaId] || DUNGEON_THEMES.forest;
  const group = new THREE.Group();
  const nodePlatforms = new Map<string, THREE.MeshStandardMaterial>();

  // ペーパークラフト風: 全て flatShading + マットな紙（金属感なし）
  const fogMats: BuiltEnvironment["fogMats"] = {
    tileLit: new THREE.MeshStandardMaterial({
      color: theme.pathColor,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    }),
    tileDark: new THREE.MeshStandardMaterial({
      color: FOG_DARK_COLOR,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    }),
    edgeLit: new THREE.MeshStandardMaterial({
      color: theme.pathColor,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    }),
    edgeDark: new THREE.MeshStandardMaterial({
      color: FOG_DARK_COLOR,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    }),
    wallLit: new THREE.MeshStandardMaterial({
      color: WALL_COLORS[theme.wallStyle],
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    }),
    wallDark: new THREE.MeshStandardMaterial({
      color: FOG_DARK_COLOR,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    }),
  };
  const fogTiles: BuiltEnvironment["fogTiles"] = [];
  const fogEdges: BuiltEnvironment["fogEdges"] = [];
  const fogWalls: BuiltEnvironment["fogWalls"] = [];

  let frontierMesh: THREE.Group;

  if (map) {
    frontierMesh = buildMazeEnvironment(
      group,
      theme,
      maxDepth,
      map,
      nodePlatforms,
      fogMats,
      fogTiles,
      fogEdges,
      fogWalls,
    );
  } else {
    frontierMesh = buildLegacyCorridor(group, theme, maxDepth, nodePlatforms);
  }

  return { group, frontierMesh, theme, nodePlatforms, fogTiles, fogEdges, fogWalls, fogMats };
}

// ---------------------------------------------------------------------------
// Phase 7: 迷路環境
// ---------------------------------------------------------------------------

function buildMazeEnvironment(
  group: THREE.Group,
  theme: DungeonTheme,
  maxDepth: number,
  map: DungeonMap,
  nodePlatforms: Map<string, THREE.MeshStandardMaterial>,
  fogMats: BuiltEnvironment["fogMats"],
  fogTiles: BuiltEnvironment["fogTiles"],
  fogEdges: BuiltEnvironment["fogEdges"],
  fogWalls: BuiltEnvironment["fogWalls"],
): THREE.Group {
  const { cols, rows } = map;
  const gridW = cols * GRID_CELL_WORLD;
  const gridD = rows * GRID_CELL_WORLD;
  const world = (gx: number, gy: number) => gridToWorld(gx, gy, cols, rows);

  // 地面（グリッド全体を覆う広いベース）
  const floorGeo = new THREE.PlaneGeometry(gridW + 26, gridD + 26);
  const floorMat = new THREE.MeshStandardMaterial({
    color: theme.floorColor,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // セルタイル（全セルに舗装タイル。霧で暗くする）
  const tileGeo = new THREE.PlaneGeometry(
    GRID_CELL_WORLD - 0.08,
    GRID_CELL_WORLD - 0.08,
  );
  for (const node of map.nodes) {
    const tile = new THREE.Mesh(tileGeo, fogMats.tileDark);
    tile.rotation.x = -Math.PI / 2;
    const p = world(node.gx, node.gy);
    tile.position.set(p.x, 0, p.z);
    tile.receiveShadow = true;
    group.add(tile);
    fogTiles.push({ mesh: tile, nodeId: node.id });
  }

  // 通路ストリップ（掘られたエッジ。隣接セル中心同士は常に距離6・軸平行）
  const edgeGeo = new THREE.BoxGeometry(3.1, 0.05, GRID_CELL_WORLD + 0.1);
  map.edges.forEach(([aId, bId], i) => {
    const a = map.byId.get(aId)!;
    const b = map.byId.get(bId)!;
    const pa = world(a.gx, a.gy);
    const pb = world(b.gx, b.gy);
    const seg = new THREE.Mesh(edgeGeo, fogMats.edgeDark);
    seg.position.set((pa.x + pb.x) / 2, 0.03 + (i % 7) * 0.0012, (pa.z + pb.z) / 2);
    // 縦方向の接続はそのまま、横方向の接続は90度回転
    if (a.gx !== b.gx) seg.rotation.y = Math.PI / 2;
    seg.receiveShadow = true;
    group.add(seg);
    fogEdges.push({ mesh: seg, aId, bId });
  });

  // 壁（グリッド内で掘られていない隣接辺に低い壁を置く）
  const wallGeoX = new THREE.BoxGeometry(GRID_CELL_WORLD + 0.1, 1.35, 0.5);
  const wallGeoZ = new THREE.BoxGeometry(0.5, 1.35, GRID_CELL_WORLD + 0.1);
  for (const node of map.nodes) {
    const neighbors = new Set(map.adjacency.get(node.id) ?? []);
    // 右隣（gx+1）と下隣（gy+1）だけを見て二重生成を避ける
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const other = map.byCell.get(`${node.gx + dx},${node.gy + dy}`);
      if (!other || neighbors.has(other.id)) continue;
      const pa = world(node.gx, node.gy);
      const pb = world(other.gx, other.gy);
      const wall = new THREE.Mesh(dx === 1 ? wallGeoZ : wallGeoX, fogMats.wallDark);
      wall.position.set((pa.x + pb.x) / 2, 0.675, (pa.z + pb.z) / 2);
      // 紙の折り目線。壁の材質は霧で差し替わるため、インク色は解放時の壁色から導く
      // （線はメッシュの子なので材質差し替えの影響を受けない）
      addPaperEdges(wall, { baseColor: WALL_COLORS[theme.wallStyle] });
      group.add(wall);
      fogWalls.push({ mesh: wall, aId: node.id, bId: other.id });
    }
  }

  // コンテンツノードのプラットフォーム + リング
  const platformGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.12, 20);
  const ringGeo = new THREE.RingGeometry(1.55, 1.8, 24);
  for (const node of map.nodes) {
    if (node.kind === "passage") continue;
    const mat = new THREE.MeshStandardMaterial({
      color: theme.pathColor,
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
    });
    const p = world(node.gx, node.gy);
    const platform = new THREE.Mesh(platformGeo, mat);
    platform.position.set(p.x, 0.04, p.z);
    platform.receiveShadow = true;
    addPaperEdges(platform);
    group.add(platform);
    nodePlatforms.set(node.id, mat);

    const ringMat = new THREE.MeshBasicMaterial({
      color: node.kind === "boss_gate" ? 0xf59e0b : theme.accentColor,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.11, p.z);
    group.add(ring);
  }

  // 経路距離マーカー（入口→ボス門パス上に 20m ごと、通路脇に石標とランタン）
  const markerMat = new THREE.MeshStandardMaterial({
    color: theme.accentColor,
    emissive: theme.accentColor,
    emissiveIntensity: 0.5,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92, metalness: 0, flatShading: true });
  const postGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
  const lanternGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const bossPath = pathBetween(map, ENTRANCE_NODE_ID, BOSS_GATE_NODE_ID) ?? [];
  if (bossPath.length > 1) {
    let markerIndex = 0;
    for (let d = 0; d <= maxDepth; d += 20, markerIndex++) {
      const pos = interpolateGridPosition(map, BOSS_GATE_NODE_ID, d);
      const ahead = interpolateGridPosition(
        map,
        BOSS_GATE_NODE_ID,
        Math.min(maxDepth, d + map.stepMeters),
      );
      const dirX = ahead.gx - pos.gx;
      const dirZ = ahead.gy - pos.gy;
      const len = Math.hypot(dirX, dirZ) || 1;
      // 進行方向の右側にずらす（符号はマーカーごとに交互）
      const side = markerIndex % 2 === 0 ? 1 : -1;
      const offX = (-dirZ / len) * 2.7 * side;
      const offZ = (dirX / len) * 2.7 * side;
      const p = world(pos.gx, pos.gy);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(p.x + offX, 0.45, p.z + offZ);
      group.add(post);
      const lantern = new THREE.Mesh(lanternGeo, markerMat);
      lantern.position.set(p.x + offX, 0.98, p.z + offZ);
      group.add(lantern);
    }
  }

  // 周囲の環境オブジェクト（グリッド外周に木・岩などを散らす）
  const halfW = gridW / 2;
  const halfD = gridD / 2;
  for (let z = -halfD - 3; z <= halfD + 3; z += 4.5) {
    const seed = Math.abs(Math.sin(z * 12.9898) * 43758.5453) % 1;
    for (const side of [-1, 1]) {
      const prop = createSideProp(theme, seed, side);
      prop.position.set(side * (halfW + 2.4 + seed * 1.6), 0, z + (seed - 0.5) * 1.5);
      prop.rotation.y = seed * Math.PI * 2;
      group.add(prop);
    }
  }
  for (let x = -halfW; x <= halfW; x += 6.5) {
    const seed = Math.abs(Math.sin(x * 78.233) * 12543.21) % 1;
    for (const side of [-1, 1]) {
      const prop = createSideProp(theme, seed, side);
      prop.position.set(x + (seed - 0.5) * 2, 0, side * (halfD + 2.4 + seed * 1.6));
      prop.rotation.y = seed * Math.PI * 2;
      group.add(prop);
    }
  }

  // 入口アーチ（入口セルの南縁）
  const entrance = map.byId.get(ENTRANCE_NODE_ID)!;
  const ep = world(entrance.gx, entrance.gy);
  const gateGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0, flatShading: true });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), pillarMat);
    pillar.position.set(side * 3.1, 1.3, 0);
    gateGroup.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 0.5), pillarMat);
  lintel.position.set(0, 2.65, 0);
  gateGroup.add(lintel);
  addPaperEdgesToGroup(gateGroup);
  gateGroup.position.set(ep.x, 0, ep.z + 3.1);
  group.add(gateGroup);

  // ボス台座（ボス門セル）
  const boss = map.byId.get(BOSS_GATE_NODE_ID)!;
  const bp = world(boss.gx, boss.gy);
  const altarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.25, 16), altarMat);
  altar.position.set(bp.x, 0.1, bp.z);
  addPaperEdges(altar);
  group.add(altar);

  const bossRingMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const bossRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 24), bossRingMat);
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.set(bp.x, 0.24, bp.z);
  group.add(bossRing);

  // 開拓前線バリア（ビューポート側で経路上の前線位置へ移動させる）
  const frontierMesh = new THREE.Group();
  const veilGeo = new THREE.PlaneGeometry(7, 5);
  const veilMat = new THREE.MeshBasicMaterial({
    color: theme.accentColor,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const veil = new THREE.Mesh(veilGeo, veilMat);
  veil.position.set(0, 2.2, 0);
  frontierMesh.add(veil);

  const lineMat = new THREE.MeshBasicMaterial({
    color: theme.accentColor,
    transparent: true,
    opacity: 0.65,
  });
  const line = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), lineMat);
  line.position.set(0, 0.06, 0);
  frontierMesh.add(line);
  frontierMesh.position.set(ep.x, 0, ep.z);
  group.add(frontierMesh);

  return frontierMesh;
}

// ---------------------------------------------------------------------------
// 旧来の直線通路（map 未指定時のフォールバック）
// ---------------------------------------------------------------------------

function buildLegacyCorridor(
  group: THREE.Group,
  theme: DungeonTheme,
  maxDepth: number,
  nodePlatforms: Map<string, THREE.MeshStandardMaterial>,
): THREE.Group {
  void nodePlatforms;
  const totalLength = maxDepth * DEPTH_SCALE + 18;
  const centerZ = -totalLength / 2 + 6;

  const floorGeo = new THREE.PlaneGeometry(24, totalLength);
  const floorMat = new THREE.MeshStandardMaterial({
    color: theme.floorColor,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, centerZ);
  floor.receiveShadow = true;
  group.add(floor);

  const pathGeo = new THREE.PlaneGeometry(6.4, totalLength);
  const pathMat = new THREE.MeshStandardMaterial({
    color: theme.pathColor,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0, centerZ);
  path.receiveShadow = true;
  group.add(path);

  if (theme.wallStyle === "mine") {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0,
      roughness: 0.92,
      flatShading: true,
    });
    for (const rx of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, totalLength), railMat);
      rail.position.set(rx, 0.025, centerZ);
      group.add(rail);
    }
  }

  const markerMat = new THREE.MeshStandardMaterial({
    color: theme.accentColor,
    emissive: theme.accentColor,
    emissiveIntensity: 0.5,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92, metalness: 0, flatShading: true });

  for (let d = 0; d <= maxDepth; d += 20) {
    const z = depthToZ(d);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), postMat);
      post.position.set(side * 3.3, 0.45, z);
      group.add(post);

      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), markerMat);
      lantern.position.set(side * 3.3, 0.98, z);
      group.add(lantern);
    }
  }

  const step = 4.5;
  for (let d = -4; d <= maxDepth + 8; d += step) {
    const z = depthToZ(d);
    const seed = Math.abs(Math.sin(d * 12.9898) * 43758.5453) % 1;
    for (const side of [-1, 1]) {
      const xBase = side * (4.1 + seed * 1.4);
      const prop = createSideProp(theme, seed, side);
      prop.position.set(xBase, 0, z + (seed - 0.5) * 1.5);
      prop.rotation.y = seed * Math.PI * 2;
      group.add(prop);
    }
  }

  const gateGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0, flatShading: true });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), pillarMat);
    pillar.position.set(side * 3.1, 1.3, 0.5);
    gateGroup.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 0.5), pillarMat);
  lintel.position.set(0, 2.65, 0.5);
  gateGroup.add(lintel);
  addPaperEdgesToGroup(gateGroup);
  group.add(gateGroup);

  const bossZ = depthToZ(maxDepth);
  const altarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.25, 16), altarMat);
  altar.position.set(0, 0.1, bossZ);
  addPaperEdges(altar);
  group.add(altar);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const bossRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 24), ringMat);
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.set(0, 0.24, bossZ);
  group.add(bossRing);

  const frontierMesh = new THREE.Group();
  const veilGeo = new THREE.PlaneGeometry(10, 5);
  const veilMat = new THREE.MeshBasicMaterial({
    color: theme.accentColor,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const veil = new THREE.Mesh(veilGeo, veilMat);
  veil.position.set(0, 2.2, 0);
  frontierMesh.add(veil);

  const lineMat = new THREE.MeshBasicMaterial({
    color: theme.accentColor,
    transparent: true,
    opacity: 0.65,
  });
  const line = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), lineMat);
  line.position.set(0, 0.06, 0);
  frontierMesh.add(line);
  group.add(frontierMesh);

  return frontierMesh;
}

function createSideProp(theme: DungeonTheme, seed: number, _side: number): THREE.Group {
  const g = new THREE.Group();
  const scale = 0.85 + seed * 0.55;

  if (theme.wallStyle === "trees") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 1.4 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.92, metalness: 0, flatShading: true }),
    );
    trunk.position.y = 0.7 * scale;
    g.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 * scale, 2.4 * scale, 7),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.92, metalness: 0, flatShading: true }),
    );
    leaves.position.y = 2.1 * scale;
    g.add(leaves);
  } else if (theme.wallStyle === "mine") {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.2 * scale, 0),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95, metalness: 0, flatShading: true }),
    );
    rock.position.y = 0.9 * scale;
    rock.scale.set(1, 1.5, 1);
    g.add(rock);
  } else if (theme.wallStyle === "canyon") {
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 3.4 * scale, 5),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.92, metalness: 0, flatShading: true }),
    );
    spire.position.y = 1.7 * scale;
    g.add(spire);
  } else if (theme.wallStyle === "roots") {
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.55 * scale, 3.2 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.92, metalness: 0, flatShading: true }),
    );
    root.position.y = 1.5 * scale;
    root.rotation.z = (seed - 0.5) * 0.4;
    g.add(root);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22 * scale),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
      }),
    );
    orb.position.y = 2.4 * scale;
    g.add(orb);
  } else {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9 * scale),
      new THREE.MeshStandardMaterial({
        color: 0x4c1d95,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.5,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
      }),
    );
    crystal.position.y = 1.4 * scale;
    crystal.scale.set(0.7, 1.8, 0.7);
    g.add(crystal);
  }

  // ペーパークラフト風: 紙の折り目線を付ける（発光オーブ等は対象外になる）
  addPaperEdgesToGroup(g);

  return g;
}
