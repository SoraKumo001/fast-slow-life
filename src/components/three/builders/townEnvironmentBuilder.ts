import * as THREE from "three";

import {
  CELL_SIZE,
  TOWN_BUILDINGS,
  TOWN_GRID_SIZE,
  buildingCells,
  gridToWorldCenter,
  isRoad,
  isWalkable,
} from "../../../data/townLayout";

/**
 * 町の地面・道・広場タイル・木・柵・街灯を構築する。
 * 返した lampMats / lampGlowMats は夜に emissive / opacity を上げるための材質。
 */

export interface BuiltTownEnvironment {
  group: THREE.Group;
  lampMats: THREE.MeshStandardMaterial[];
  lampGlowMats: THREE.MeshBasicMaterial[];
}

function mat(color: number, roughness = 0.95): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function seededRandom(seed: number): number {
  const v = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function buildTownEnvironment(): BuiltTownEnvironment {
  const group = new THREE.Group();
  const townSize = TOWN_GRID_SIZE * CELL_SIZE;

  // 外側の地面 (町の外の草原)
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x3f6b34));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.06;
  group.add(outer);

  // 町全体の草地
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(townSize, townSize), mat(0x679c4f));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);

  // 建物占有マス集合 (木の配置回避用、開けた作業場も含む)
  const buildingCellSet = new Set<string>();
  for (const def of TOWN_BUILDINGS) {
    for (const c of buildingCells(def)) buildingCellSet.add(`${c.x},${c.z}`);
  }
  const plaza = TOWN_BUILDINGS.find((b) => b.id === "plaza");
  const plazaCellSet = new Set<string>();
  if (plaza) {
    for (const c of buildingCells(plaza)) plazaCellSet.add(`${c.x},${c.z}`);
  }

  // 道タイル (土) と広場タイル (石畳) を InstancedMesh で敷く
  const roadCells: Array<{ x: number; z: number }> = [];
  const stoneCells: Array<{ x: number; z: number }> = [];
  for (let z = 0; z < TOWN_GRID_SIZE; z++) {
    for (let x = 0; x < TOWN_GRID_SIZE; x++) {
      if (plazaCellSet.has(`${x},${z}`)) stoneCells.push({ x, z });
      else if (isRoad(x, z)) roadCells.push({ x, z });
    }
  }
  const dummy = new THREE.Object3D();
  const tileGeo = new THREE.BoxGeometry(CELL_SIZE, 0.06, CELL_SIZE);
  const roadMesh = new THREE.InstancedMesh(tileGeo, mat(0x9a8563), roadCells.length);
  roadCells.forEach((c, i) => {
    const w = gridToWorldCenter(c.x, c.z);
    dummy.position.set(w.x, 0.03, w.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    roadMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(roadMesh);

  const stoneMesh = new THREE.InstancedMesh(tileGeo, mat(0x9aa0a6), stoneCells.length);
  stoneCells.forEach((c, i) => {
    const w = gridToWorldCenter(c.x, c.z);
    dummy.position.set(w.x, 0.035, w.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    stoneMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(stoneMesh);

  // 木: 草地マスに決定的ランダムで配置 (道・建物・入口周辺は避ける)
  const treePositions: Array<{ x: number; z: number; scale: number }> = [];
  for (let z = 0; z < TOWN_GRID_SIZE; z++) {
    for (let x = 0; x < TOWN_GRID_SIZE; x++) {
      if (!isWalkable(x, z) || isRoad(x, z)) continue;
      if (buildingCellSet.has(`${x},${z}`)) continue;
      // 建物に隣接するマスは空けておく
      let nearBuilding = false;
      for (let dz = -1; dz <= 1 && !nearBuilding; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (buildingCellSet.has(`${x + dx},${z + dz}`)) {
            nearBuilding = true;
            break;
          }
        }
      }
      if (nearBuilding) continue;
      const r = seededRandom(x * 31 + z * 57 + 3);
      const isSouthForest = z >= TOWN_GRID_SIZE - 2;
      if (isSouthForest ? r > 0.35 : r > 0.93) {
        const w = gridToWorldCenter(x, z);
        treePositions.push({ x: w.x, z: w.z, scale: 0.85 + r * 0.5 });
        if (treePositions.length >= 48) break;
      }
    }
    if (treePositions.length >= 48) break;
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.26, 1.3, 6),
    mat(0x4b3621, 0.9),
    treePositions.length,
  );
  const leavesMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.05, 2.3, 7),
    mat(0x2f7a33, 0.85),
    treePositions.length,
  );
  treePositions.forEach((t, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.position.set(t.x, 0.65 * t.scale, t.z);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x, (1.3 + 1.05) * t.scale, t.z);
    dummy.updateMatrix();
    leavesMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(trunkMesh);
  group.add(leavesMesh);

  // 柵: 農場の南辺と訓練所の北辺に沿って
  const fenceMat = mat(0x8a6844, 0.9);
  const addFenceRun = (x1: number, z1: number, x2: number, z2: number) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    for (let i = 0; i <= steps; i++) {
      const gx = x1 + Math.round(((x2 - x1) * i) / Math.max(1, steps));
      const gz = z1 + Math.round(((z2 - z1) * i) / Math.max(1, steps));
      const w = gridToWorldCenter(gx, gz);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), fenceMat);
      post.position.set(w.x - CELL_SIZE / 2, 0.35, w.z - CELL_SIZE / 2);
      group.add(post);
    }
  };
  addFenceRun(2, 7, 7, 7);
  addFenceRun(24, 21, 28, 21);

  // 街灯: 広場の角と幹線の交点
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffdf9e,
    emissive: 0xffb84d,
    emissiveIntensity: 0,
    roughness: 0.4,
    flatShading: true,
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lampCells = [
    { x: 14, z: 14 },
    { x: 17, z: 14 },
    { x: 14, z: 17 },
    { x: 17, z: 17 },
    { x: 15, z: 7 },
    { x: 6, z: 13 },
    { x: 25, z: 19 },
    { x: 11, z: 29 },
  ];
  const poleMat = mat(0x3f4750, 0.7);
  for (const cell of lampCells) {
    const w = gridToWorldCenter(cell.x, cell.z);
    const lamp = new THREE.Group();
    lamp.position.set(w.x + 0.7, 0, w.z + 0.7);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.3, 6), poleMat);
    pole.position.y = 1.15;
    lamp.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), lampMat);
    bulb.position.y = 2.45;
    lamp.add(bulb);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16), lampGlowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.06;
    lamp.add(glow);
    group.add(lamp);
  }

  return { group, lampMats: [lampMat], lampGlowMats: [lampGlowMat] };
}
