import * as THREE from "three";

import { CELL_SIZE, gridToWorld, type TownBuildingDef } from "../../../data/townLayout";

/**
 * 町の建物をプロシージャルに構築する (flatShading、テクスチャなし)。
 * 返した Group の userData:
 * - buildingId: string
 * - level: number
 * - windowMats: MeshStandardMaterial[] (夜に emissiveIntensity を上げる窓材質)
 */

function mat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function addBox(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  material?: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material ?? mat(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

/** 切妻屋根 (三角形を押し出したプリズム) */
function gableRoof(width: number, height: number, depth: number, color: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat(color, 0.7));
}

interface Palette {
  wall: number;
  roof: number;
  wallHeight: number;
}

const PALETTES: Record<string, Palette> = {
  inn: { wall: 0xf3e2c7, roof: 0xb4502d, wallHeight: 3.0 },
  workshop: { wall: 0xd8c6ac, roof: 0x6b4a35, wallHeight: 2.2 },
  kitchen: { wall: 0xf5eeda, roof: 0xc2a13d, wallHeight: 1.9 },
  alchemy: { wall: 0xd9d2e8, roof: 0x5b2a86, wallHeight: 2.6 },
  market: { wall: 0xe8d9b0, roof: 0xd9a441, wallHeight: 2.0 },
  guild: { wall: 0xdde4ee, roof: 0x2f4d8a, wallHeight: 2.6 },
  weapon_shop: { wall: 0xd8d8dc, roof: 0x555f6e, wallHeight: 2.2 },
  warehouse: { wall: 0xa9835f, roof: 0x4f3820, wallHeight: 1.4 },
};

function makeWindowMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2b3a4a,
    emissive: 0xffca7a,
    emissiveIntensity: 0,
    roughness: 0.4,
    flatShading: true,
  });
}

/** 南面にドア・看板・窓を付ける (実体のある建物用) */
function addFacade(
  group: THREE.Group,
  def: TownBuildingDef,
  bw: number,
  bd: number,
  wallHeight: number,
  windowMats: THREE.MeshStandardMaterial[],
): void {
  const frontZ = bd / 2;
  // ドア
  addBox(group, 0.85, 1.45, 0.1, 0x4a3421, 0, 0.73, frontZ + 0.03);
  // 看板 (色で施設を判別する)
  addBox(group, 1.7, 0.5, 0.12, def.signColor, 0, wallHeight - 0.15, frontZ + 0.05);
  // 窓
  const windowMat = makeWindowMat();
  windowMats.push(windowMat);
  const offsets = bw >= 5 ? [-bw / 4, bw / 4] : [0];
  for (const ox of offsets) {
    if (ox === 0 && bw < 5) {
      // ドアの真上を避けて左右に 1 つずつ
      addBox(group, 0.5, 0.6, 0.06, 0, -bw / 4, 1.25, frontZ + 0.04, windowMat);
      addBox(group, 0.5, 0.6, 0.06, 0, bw / 4, 1.25, frontZ + 0.04, windowMat);
    } else {
      addBox(group, 0.5, 0.6, 0.06, 0, ox, 1.25, frontZ + 0.04, windowMat);
    }
  }
}

function addChimney(group: THREE.Group, x: number, y: number, z: number): void {
  addBox(group, 0.45, 0.9, 0.45, 0x8a8f98, x, y, z);
  addBox(group, 0.55, 0.12, 0.55, 0x5b6068, x, y + 0.5, z);
}

/** 小屋 (作業場ゾーンの付属建物) */
function addHut(
  group: THREE.Group,
  cx: number,
  cz: number,
  roofColor: number,
  windowMats: THREE.MeshStandardMaterial[],
): void {
  const hut = new THREE.Group();
  hut.position.set(cx, 0, cz);
  addBox(hut, 2.2, 1.5, 2.0, 0xd8c6ac, 0, 0.75, 0);
  const roof = gableRoof(2.7, 0.9, 2.5, roofColor);
  roof.position.y = 1.5;
  hut.add(roof);
  const windowMat = makeWindowMat();
  windowMats.push(windowMat);
  addBox(hut, 0.45, 0.5, 0.06, 0, 0.6, 1.0, 1.03, windowMat);
  addBox(hut, 0.7, 1.2, 0.08, 0x4a3421, -0.5, 0.6, 1.03);
  group.add(hut);
}

export function buildBuildingMesh(def: TownBuildingDef, level = 1): THREE.Group {
  const group = new THREE.Group();
  const fw = def.w * CELL_SIZE;
  const fd = def.d * CELL_SIZE;
  const origin = gridToWorld(def.x, def.z);
  group.position.set(origin.x + fw / 2, 0, origin.z + fd / 2);

  const windowMats: THREE.MeshStandardMaterial[] = [];
  const heightScale = 1 + (level - 1) * 0.15;
  const bw = fw - 0.7;
  const bd = fd - 0.7;

  switch (def.id) {
    case "gate": {
      const stone = 0x8a8f98;
      for (const side of [-1, 1]) {
        addBox(group, 0.9, 3.4, 0.9, stone, side * (fw / 2 - 0.7), 1.7, 0);
        addBox(group, 1.1, 0.35, 1.1, def.signColor, side * (fw / 2 - 0.7), 3.55, 0);
      }
      addBox(group, fw - 0.4, 0.55, 1.0, stone, 0, 3.35, 0);
      addBox(group, 1.8, 0.5, 0.14, def.signColor, 0, 2.7, 0.55);
      break;
    }
    case "farm": {
      // 土の畝 + 作物の列 + 小屋
      addBox(group, fw - 0.3, 0.14, fd - 0.3, 0x6d4c2f, 0, 0.07, 0);
      for (let i = 0; i < 4; i++) {
        const rz = -fd / 2 + 1.2 + i * 1.5;
        addBox(group, fw - 1.6, 0.22, 0.7, 0x7a5a36, 0.6, 0.18, rz);
        for (let cx = -fw / 2 + 1.6; cx < fw / 2 - 0.6; cx += 1.1) {
          const crop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 5), mat(0x65a83e, 0.9));
          crop.position.set(cx, 0.55, rz);
          group.add(crop);
        }
      }
      addHut(group, -fw / 2 + 1.6, -fd / 2 + 1.4, def.signColor, windowMats);
      break;
    }
    case "lumberyard": {
      addBox(group, fw - 0.3, 0.12, fd - 0.3, 0x8a7350, 0, 0.06, 0);
      // 丸太の山
      const logMat = mat(0x7a5230, 0.9);
      const logPositions: Array<[number, number, number]> = [
        [-1.2, 0.35, 0.8],
        [0.2, 0.35, 0.8],
        [1.6, 0.35, 0.8],
        [-0.5, 0.95, 0.8],
        [0.9, 0.95, 0.8],
        [0.2, 1.5, 0.8],
      ];
      for (const [lx, ly, lz] of logPositions) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.2, 8), logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(lx, ly, lz);
        group.add(log);
      }
      addHut(group, -fw / 2 + 1.7, -fd / 2 + 1.5, def.signColor, windowMats);
      break;
    }
    case "quarry": {
      addBox(group, fw - 0.3, 0.12, fd - 0.3, 0x767c85, 0, 0.06, 0);
      const rockMat = mat(0x59616e, 0.95);
      const rocks: Array<[number, number, number, number]> = [
        [-2.2, 0.7, 0.4, 1.1],
        [0.4, 0.55, -0.6, 0.85],
        [2.4, 0.85, 0.6, 1.3],
        [1.2, 0.4, 1.2, 0.6],
      ];
      for (const [rx, ry, rz, s] of rocks) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
        rock.position.set(rx, ry, rz);
        rock.scale.y = 1.25;
        group.add(rock);
      }
      addHut(group, -fw / 2 + 1.6, fd / 2 - 1.4, def.signColor, windowMats);
      break;
    }
    case "training_ground": {
      addBox(group, fw - 0.3, 0.1, fd - 0.3, 0xb8a888, 0, 0.05, 0);
      // 囲いの柱
      for (let fx = -fw / 2 + 0.4; fx <= fw / 2 - 0.4; fx += 1.6) {
        addBox(group, 0.16, 0.8, 0.16, 0x6b4a35, fx, 0.4, -fd / 2 + 0.3);
        addBox(group, 0.16, 0.8, 0.16, 0x6b4a35, fx, 0.4, fd / 2 - 0.3);
      }
      // 的 (丸い板 + 中心)
      for (const tx of [-2.2, 1.8]) {
        addBox(group, 0.18, 1.3, 0.18, 0x6b4a35, tx, 0.65, -0.8);
        const target = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.14, 12),
          mat(0xe8e2d4, 0.8),
        );
        target.rotation.x = Math.PI / 2;
        target.position.set(tx, 1.55, -0.8);
        group.add(target);
        const center = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.16, 10),
          mat(def.signColor, 0.8),
        );
        center.rotation.x = Math.PI / 2;
        center.position.set(tx, 1.55, -0.78);
        group.add(center);
      }
      break;
    }
    case "plaza": {
      // 石畳の台 + 井戸 + 掲示板 + ベンチ (地面タイルは環境ビルダー側)
      addBox(group, fw - 0.2, 0.16, fd - 0.2, 0x9aa0a6, 0, 0.08, 0);
      // 井戸
      const well = new THREE.Group();
      well.position.set(-2.2, 0, -2.0);
      const wellBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.8, 8),
        mat(0x7d838c, 0.9),
      );
      wellBody.position.y = 0.55;
      well.add(wellBody);
      for (const side of [-1, 1]) {
        addBox(well, 0.14, 1.5, 0.14, 0x6b4a35, side * 0.8, 1.3, 0);
      }
      const wellRoof = gableRoof(2.1, 0.6, 1.4, 0x8a4b2f);
      wellRoof.position.y = 2.05;
      well.add(wellRoof);
      group.add(well);
      // 掲示板
      const board = new THREE.Group();
      board.position.set(2.4, 0, -2.2);
      addBox(board, 0.14, 1.5, 0.14, 0x6b4a35, -0.7, 0.75, 0);
      addBox(board, 0.14, 1.5, 0.14, 0x6b4a35, 0.7, 0.75, 0);
      addBox(board, 1.9, 1.1, 0.1, 0x9a7448, 0, 1.35, 0);
      addBox(board, 1.5, 0.75, 0.12, 0xe8dfc8, 0, 1.35, 0.02);
      group.add(board);
      // ベンチ
      for (const bx of [-1.6, 2.0]) {
        addBox(group, 1.5, 0.12, 0.45, 0x8a6844, bx, 0.5, 2.4);
        addBox(group, 0.12, 0.5, 0.4, 0x6b4a35, bx - 0.6, 0.25, 2.4);
        addBox(group, 0.12, 0.5, 0.4, 0x6b4a35, bx + 0.6, 0.25, 2.4);
      }
      break;
    }
    case "market": {
      const palette = PALETTES.market;
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      // テント屋根 (看板色の大きな切妻)
      const tent = gableRoof(bw + 1.2, 1.3, bd + 1.2, def.signColor);
      tent.position.y = wallH;
      group.add(tent);
      addFacade(group, def, bw, bd, wallH, windowMats);
      // 屋台
      for (const sx of [-bw / 2 - 0.2, bw / 2 + 0.2]) {
        addBox(group, 1.3, 0.85, 0.9, 0x9a7448, sx * 0.92, 0.43, bd / 2 + 0.9);
        addBox(group, 1.5, 0.1, 1.1, def.signColor, sx * 0.92, 1.15, bd / 2 + 0.9);
      }
      break;
    }
    case "alchemy": {
      const palette = PALETTES.alchemy;
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      // 塔状の円錐屋根
      const tower = new THREE.Mesh(
        new THREE.ConeGeometry(bw * 0.62, 2.0, 6),
        mat(palette.roof, 0.7),
      );
      tower.position.y = wallH + 1.0;
      group.add(tower);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3),
        new THREE.MeshStandardMaterial({
          color: def.signColor,
          emissive: def.signColor,
          emissiveIntensity: 0.7,
          flatShading: true,
        }),
      );
      orb.position.y = wallH + 2.25;
      group.add(orb);
      addFacade(group, def, bw, bd, wallH, windowMats);
      break;
    }
    case "guild": {
      const palette = PALETTES.guild;
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      const roof = gableRoof(bw + 0.7, 1.3, bd + 0.7, palette.roof);
      roof.position.y = wallH;
      group.add(roof);
      addFacade(group, def, bw, bd, wallH, windowMats);
      // 旗
      addBox(group, 0.1, 2.2, 0.1, 0x6b4a35, bw / 2 - 0.3, wallH + 0.6, bd / 2 - 0.3);
      addBox(group, 0.95, 0.6, 0.06, def.signColor, bw / 2 + 0.15, wallH + 1.35, bd / 2 - 0.3);
      break;
    }
    case "weapon_shop": {
      const palette = PALETTES.weapon_shop;
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      const roof = gableRoof(bw + 0.6, 1.0, bd + 0.6, palette.roof);
      roof.position.y = wallH;
      group.add(roof);
      addFacade(group, def, bw, bd, wallH, windowMats);
      // 看板の剣 (縦刃 + 横ガード)
      addBox(group, 0.14, 0.95, 0.08, 0xd7dde6, bw / 2 - 0.5, wallH + 0.35, bd / 2 + 0.1);
      addBox(group, 0.55, 0.13, 0.08, 0xd7dde6, bw / 2 - 0.5, wallH + 0.05, bd / 2 + 0.1);
      break;
    }
    case "warehouse": {
      const palette = PALETTES.warehouse;
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      const roof = gableRoof(bw + 0.5, 0.7, bd + 0.5, palette.roof);
      roof.position.y = wallH;
      group.add(roof);
      addFacade(group, def, bw, bd, wallH, windowMats);
      // 積まれた箱
      addBox(group, 0.9, 0.9, 0.9, 0x9a7448, -bw / 2 - 0.3, 0.45, bd / 2 - 0.6);
      addBox(group, 0.7, 0.7, 0.7, 0x86643c, -bw / 2 - 0.25, 1.25, bd / 2 - 0.6);
      break;
    }
    default: {
      // 宿屋・加工工房・調理場・民家などの標準形状
      const isHouse = def.kind === "house";
      const palette: Palette = PALETTES[def.id] ?? {
        wall: 0xeee3d0,
        roof: def.signColor,
        wallHeight: 1.6,
      };
      const wallH = palette.wallHeight * heightScale;
      addBox(group, bw, wallH, bd, palette.wall, 0, wallH / 2, 0);
      const roof = gableRoof(bw + 0.6, isHouse ? 0.95 : 1.1, bd + 0.6, palette.roof);
      roof.position.y = wallH;
      group.add(roof);
      addFacade(group, def, bw, bd, wallH, windowMats);
      if (def.id === "inn") {
        addChimney(group, bw / 2 - 0.7, wallH + 0.9, -bd / 4);
        // 2階の窓明かり用にもう1段窓を付ける
        const extraMat = makeWindowMat();
        windowMats.push(extraMat);
        addBox(group, 0.5, 0.55, 0.06, 0, -bw / 4, wallH - 0.7, bd / 2 + 0.04, extraMat);
        addBox(group, 0.5, 0.55, 0.06, 0, bw / 4, wallH - 0.7, bd / 2 + 0.04, extraMat);
      }
      if (def.id === "workshop" || def.id === "kitchen") {
        addChimney(group, bw / 2 - 0.6, wallH + 0.75, -bd / 4);
      }
      if (def.id === "workshop") {
        // 作業台
        addBox(group, 1.6, 0.75, 0.8, 0x8a6844, -bw / 2 - 0.5, 0.38, bd / 2 - 0.4);
      }
      break;
    }
  }

  group.userData.buildingId = def.id;
  group.userData.level = level;
  group.userData.windowMats = windowMats;
  return group;
}
