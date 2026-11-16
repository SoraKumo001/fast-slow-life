import * as THREE from "three";

import type { DungeonMap } from "../../../store/dungeonMap";

export const DEPTH_SCALE = 0.45;
export const LANE_SCALE = 1.6;

export function depthToZ(depth: number): number {
  return -depth * DEPTH_SCALE;
}

export function laneToX(lane: number): number {
  return lane * LANE_SCALE;
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

export interface BuiltEnvironment {
  group: THREE.Group;
  frontierMesh: THREE.Group;
  theme: DungeonTheme;
  /** Phase 4a: ノードID → プラットフォームのマテリアル（霧の解放状態で色を変える） */
  nodePlatforms: Map<string, THREE.MeshStandardMaterial>;
}

/**
 * ダンジョンテーマに応じた3D通路環境・壁面装飾・開拓前線ゲートを構築する。
 * map が渡された場合は Phase 4a のノードプラットフォーム + 接続パスを構築し、
 * 中央の直線パス（と鉱山レール）は描かない。
 */
export function buildDungeonEnvironment(
  areaId: string,
  maxDepth: number,
  map?: DungeonMap,
): BuiltEnvironment {
  const theme = DUNGEON_THEMES[areaId] || DUNGEON_THEMES.forest;
  const group = new THREE.Group();
  const totalLength = maxDepth * DEPTH_SCALE + 18;
  const centerZ = -totalLength / 2 + 6;

  // 地面（広いベース）
  const floorGeo = new THREE.PlaneGeometry(24, totalLength);
  const floorMat = new THREE.MeshStandardMaterial({
    color: theme.floorColor,
    roughness: 0.92,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, centerZ);
  floor.receiveShadow = true;
  group.add(floor);

  const nodePlatforms = new Map<string, THREE.MeshStandardMaterial>();

  if (map) {
    // Phase 4a: ノードプラットフォーム + 接続パス
    const platformGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.12, 20);
    const ringGeo = new THREE.RingGeometry(1.55, 1.8, 24);
    for (const node of map.nodes) {
      const mat = new THREE.MeshStandardMaterial({
        color: theme.pathColor,
        roughness: 0.9,
        metalness: 0.05,
      });
      const platform = new THREE.Mesh(platformGeo, mat);
      platform.position.set(laneToX(node.lane), 0.04, depthToZ(node.depth));
      platform.receiveShadow = true;
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
      ring.position.set(laneToX(node.lane), 0.11, depthToZ(node.depth));
      group.add(ring);
    }

    // エッジ = ノード間を結ぶパスセグメント
    const edgeMat = new THREE.MeshStandardMaterial({
      color: theme.pathColor,
      roughness: 0.95,
      metalness: 0.02,
    });
    for (const [aId, bId] of map.edges) {
      const a = map.byId.get(aId);
      const b = map.byId.get(bId);
      if (!a || !b) continue;
      const ax = laneToX(a.lane);
      const az = depthToZ(a.depth);
      const bx = laneToX(b.lane);
      const bz = depthToZ(b.depth);
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, len), edgeMat);
      seg.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
      seg.rotation.y = Math.atan2(bx - ax, bz - az);
      seg.receiveShadow = true;
      group.add(seg);
    }
  } else {
    // 中央の冒険道（少し色を変えたパス）
    const pathGeo = new THREE.PlaneGeometry(6.4, totalLength);
    const pathMat = new THREE.MeshStandardMaterial({
      color: theme.pathColor,
      roughness: 0.95,
      metalness: 0.02,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0, centerZ);
    path.receiveShadow = true;
    group.add(path);
  }

  // 廃鉱山の場合はトロッコのレールを描画（ノードマップ表示時はパスと重なるため省略）
  if (theme.wallStyle === "mine" && !map) {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.3,
    });
    for (const rx of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, totalLength), railMat);
      rail.position.set(rx, 0.025, centerZ);
      group.add(rail);
    }
  }

  // 深度マーカー（25mごとに小石標やランタンを配置し、進んでいる感覚を強調）
  const markerMat = new THREE.MeshStandardMaterial({
    color: theme.accentColor,
    emissive: theme.accentColor,
    emissiveIntensity: 0.5,
  });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });

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

  // 左右の環境オブジェクト（木、岩柱、根、浮遊クリスタル等）
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

  // 入口アーチ (depth = 0)
  const gateGroup = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), pillarMat);
    pillar.position.set(side * 3.1, 1.3, 0.5);
    gateGroup.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 0.5), pillarMat);
  lintel.position.set(0, 2.65, 0.5);
  gateGroup.add(lintel);
  group.add(gateGroup);

  // 最深部ボス台座 (depth = maxDepth)
  const bossZ = depthToZ(maxDepth);
  const altarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.2,
  });
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.25, 16), altarMat);
  altar.position.set(0, 0.1, bossZ);
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

  // 開拓前線バリア（未開拓エリアを視覚的に示す半透明の霧カーテン）
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

  return { group, frontierMesh, theme, nodePlatforms };
}

function createSideProp(theme: DungeonTheme, seed: number, _side: number): THREE.Group {
  const g = new THREE.Group();
  const scale = 0.85 + seed * 0.55;

  if (theme.wallStyle === "trees") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 1.4 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9 }),
    );
    trunk.position.y = 0.7 * scale;
    g.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 * scale, 2.4 * scale, 7),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 }),
    );
    leaves.position.y = 2.1 * scale;
    g.add(leaves);
  } else if (theme.wallStyle === "mine") {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.2 * scale, 0),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 }),
    );
    rock.position.y = 0.9 * scale;
    rock.scale.set(1, 1.5, 1);
    g.add(rock);
  } else if (theme.wallStyle === "canyon") {
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 3.4 * scale, 5),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 }),
    );
    spire.position.y = 1.7 * scale;
    g.add(spire);
  } else if (theme.wallStyle === "roots") {
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.55 * scale, 3.2 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.85 }),
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
        roughness: 0.3,
      }),
    );
    crystal.position.y = 1.4 * scale;
    crystal.scale.set(0.7, 1.8, 0.7);
    g.add(crystal);
  }

  return g;
}
