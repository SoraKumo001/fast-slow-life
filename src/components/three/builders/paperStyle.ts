import * as THREE from "three";

/**
 * ペーパークラフト風スタイリングの共通ヘルパー。
 *
 * - 材質側: 各ビルダーが MeshStandardMaterial に flatShading: true /
 *   roughness >= 0.9 / metalness: 0 を指定して「マットな紙」の質感にする。
 * - 形状側: 本ヘルパーが EdgesGeometry の線をメッシュの子として付け、
 *   紙模型の折り目・切り口のようなインク線を描く。
 *
 * 線の色はメッシュ自身の紙色から導く（彩度と明度を落とした同系色）。
 * EdgesGeometry と線材質はキャッシュして共有する（ジオメトリ単位 / 色単位）。
 * 線はクリック判定に干渉しないよう raycast を無効化する。
 */

/** 折り目として拾う最小の二面角（度）。これ未満の面（三角分割の対角など）は線にしない */
export const PAPER_EDGE_THRESHOLD_ANGLE = 30;

/** インク線の不透明度 */
export const PAPER_EDGE_OPACITY = 0.65;

const edgeGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
const lineMaterialCache = new Map<string, THREE.LineBasicMaterial>();

/** 紙色から折り目インク色を導出する（彩度・明度を落とした同系色） */
export function paperInkColor(color: THREE.ColorRepresentation): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const ink = new THREE.Color();
  ink.setHSL(hsl.h, hsl.s * 0.7, THREE.MathUtils.clamp(hsl.l * 0.4, 0.03, 0.3));
  return ink;
}

function lineMaterialFor(inkHex: number, opacity: number): THREE.LineBasicMaterial {
  const key = `${inkHex}:${opacity}`;
  let mat = lineMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: inkHex,
      transparent: true,
      opacity,
    });
    lineMaterialCache.set(key, mat);
  }
  return mat;
}

/** 線を付けないジオメトリ（地面シート・円形デカールなど平らなもの） */
const FLAT_GEOMETRY_TYPES = new Set([
  "PlaneGeometry",
  "CircleGeometry",
  "RingGeometry",
  "ShapeGeometry",
]);

export interface PaperEdgeOptions {
  /** 折り目として拾う最小の二面角（度）。既定は PAPER_EDGE_THRESHOLD_ANGLE */
  thresholdAngle?: number;
  /**
   * インク色の導出元になる紙色を明示する。霧でマテリアルが差し替わる壁など、
   * メッシュの現在色（=霧の暗色）から導けない場合に、解放時の色を渡す。
   */
  baseColor?: THREE.ColorRepresentation;
  /** インク線の不透明度。既定は PAPER_EDGE_OPACITY */
  opacity?: number;
}

/**
 * メッシュに紙の折り目線（EdgesGeometry の LineSegments）を子として付ける。
 * 対象は MeshStandardMaterial の単一材質メッシュのみで、以下は対象外として null を返す:
 * - InstancedMesh（インスタンシングと両立しない）
 * - MeshBasicMaterial など標準材質以外（デカール・目・リング等）
 * - emissive が設定された材質（窓・ランプ・宝石などの発光部）
 * - 平らなジオメトリ（地面シート・円形デカール）
 * 既に線が付いているメッシュには二重に付けない。
 */
export function addPaperEdges(
  mesh: THREE.Mesh,
  options: PaperEdgeOptions = {},
): THREE.LineSegments | null {
  if (mesh instanceof THREE.InstancedMesh) return null;
  const material = mesh.material;
  if (!material || Array.isArray(material)) return null;
  if (!(material instanceof THREE.MeshStandardMaterial)) return null;
  if (material.emissive && material.emissive.getHex() !== 0) return null;
  if (FLAT_GEOMETRY_TYPES.has(mesh.geometry.type)) return null;
  if (mesh.getObjectByName("paperEdge")) return null;

  const threshold = options.thresholdAngle ?? PAPER_EDGE_THRESHOLD_ANGLE;
  // 閾値違いのジオメトリはキャッシュを分けない（本プロジェクトでは既定値のみ使用）
  let edgeGeo = edgeGeometryCache.get(mesh.geometry);
  if (!edgeGeo) {
    edgeGeo = new THREE.EdgesGeometry(mesh.geometry, threshold);
    edgeGeometryCache.set(mesh.geometry, edgeGeo);
  }
  const ink = paperInkColor(options.baseColor ?? material.color);
  const lines = new THREE.LineSegments(
    edgeGeo,
    lineMaterialFor(ink.getHex(), options.opacity ?? PAPER_EDGE_OPACITY),
  );
  lines.name = "paperEdge";
  // 町のクリック選択（レイキャスト）に干渉させない
  lines.raycast = () => {};
  mesh.add(lines);
  return lines;
}

/** グループ配下の全メッシュに折り目線を付ける */
export function addPaperEdgesToGroup(root: THREE.Object3D, options: PaperEdgeOptions = {}): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshes.push(obj);
  });
  for (const mesh of meshes) addPaperEdges(mesh, options);
}
