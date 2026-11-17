import * as THREE from "three";

import type { DungeonActivityPhase, JobType } from "../../../types/game";
import { addPaperEdgesToGroup } from "./paperStyle";

interface JobVisualStyle {
  tunicColor: number;
  accentColor: number;
  hatStyle: "none" | "straw" | "bandana" | "helmet" | "wizard" | "hood" | "mitre";
  weaponStyle: "none" | "sword" | "axe" | "pickaxe" | "staff" | "bow" | "hoe";
}

const JOB_STYLES: Record<JobType, JobVisualStyle> = {
  無職: { tunicColor: 0x94a3b8, accentColor: 0x64748b, hatStyle: "none", weaponStyle: "none" },
  農民: { tunicColor: 0x84cc16, accentColor: 0xfacc15, hatStyle: "straw", weaponStyle: "hoe" },
  木こり: { tunicColor: 0xb45309, accentColor: 0x78350f, hatStyle: "bandana", weaponStyle: "axe" },
  鉱夫: { tunicColor: 0x64748b, accentColor: 0xf59e0b, hatStyle: "helmet", weaponStyle: "pickaxe" },
  薬師: { tunicColor: 0x10b981, accentColor: 0x6ee7b7, hatStyle: "hood", weaponStyle: "staff" },
  猟師: { tunicColor: 0x15803d, accentColor: 0x854d0e, hatStyle: "hood", weaponStyle: "bow" },
  戦士: { tunicColor: 0x2563eb, accentColor: 0xcbd5e1, hatStyle: "helmet", weaponStyle: "sword" },
  魔術師: { tunicColor: 0x7c3aed, accentColor: 0x38bdf8, hatStyle: "wizard", weaponStyle: "staff" },
  僧侶: { tunicColor: 0xf8fafc, accentColor: 0xfbbf24, hatStyle: "mitre", weaponStyle: "staff" },
  職人: { tunicColor: 0xea580c, accentColor: 0xfdba74, hatStyle: "bandana", weaponStyle: "axe" },
};

export interface VillagerRig {
  bodyGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tunicMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
}

/**
 * 職業に応じた装備・武器を持つプロシージャル3D村人キャラクターを構築する。
 */
export function buildVillagerMesh(job: JobType): THREE.Group {
  const style = JOB_STYLES[job] || JOB_STYLES["無職"];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfde0c6,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const tunicMat = new THREE.MeshStandardMaterial({
    color: style.tunicColor,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });

  // 胴体
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.28), tunicMat);
  torso.position.y = 0.72;
  bodyGroup.add(torso);

  // 頭部
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  head.position.y = 1.22;
  bodyGroup.add(head);

  // 目（前方向 -Z に向けるため z = -0.195）
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  for (const ex of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), eyeMat);
    eye.position.set(ex, 1.24, -0.195);
    bodyGroup.add(eye);
  }

  // 職業別の帽子・兜
  const accentMat = new THREE.MeshStandardMaterial({
    color: style.accentColor,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  if (style.hatStyle === "helmet") {
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.44), accentMat);
    helm.position.y = 1.38;
    bodyGroup.add(helm);
  } else if (style.hatStyle === "wizard") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 10), tunicMat);
    brim.position.y = 1.4;
    bodyGroup.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 8), tunicMat);
    cone.position.y = 1.64;
    bodyGroup.add(cone);
  } else if (style.hatStyle === "straw") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 10), accentMat);
    brim.position.y = 1.4;
    bodyGroup.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 10), accentMat);
    crown.position.y = 1.48;
    bodyGroup.add(crown);
  } else if (style.hatStyle === "hood" || style.hatStyle === "bandana") {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.16, 0.41), accentMat);
    cap.position.y = 1.38;
    bodyGroup.add(cap);
  } else if (style.hatStyle === "mitre") {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 6), accentMat);
    hat.position.y = 1.56;
    bodyGroup.add(hat);
  }

  // 腕（左右ピボット）
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.94, 0);
  const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.14), tunicMat);
  lArmMesh.position.y = -0.18;
  leftArm.add(lArmMesh);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.94, 0);
  const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.14), tunicMat);
  rArmMesh.position.y = -0.18;
  rightArm.add(rArmMesh);

  // 右手の武器・道具（前方 -Z 向き）
  const weapon = buildWeaponMesh(style.weaponStyle, style.accentColor);
  if (weapon) {
    weapon.position.set(0, -0.36, -0.14);
    rightArm.add(weapon);
  }
  bodyGroup.add(rightArm);

  // 戦士の盾（左手）
  if (job === "戦士") {
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.42, 0.32),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0,
        roughness: 0.92,
        flatShading: true,
      }),
    );
    shield.position.set(-0.08, -0.22, -0.1);
    leftArm.add(shield);
  }

  // 脚（左右ピボット）
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.44, 0);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), legMat);
  lLegMesh.position.y = -0.22;
  leftLeg.add(lLegMesh);
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.44, 0);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), legMat);
  rLegMesh.position.y = -0.22;
  rightLeg.add(rLegMesh);
  bodyGroup.add(rightLeg);

  // 足元シャドウリング
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 14),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // ペーパークラフト風: 紙の折り目線を付ける（目・足元シャドウは対象外になる）
  addPaperEdgesToGroup(root);

  const rig: VillagerRig = {
    bodyGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tunicMat,
    headMat: skinMat,
  };
  root.userData.rig = rig;
  root.userData.job = job;
  return root;
}

function buildWeaponMesh(
  style: JobVisualStyle["weaponStyle"],
  accentColor: number,
): THREE.Group | null {
  if (style === "none") return null;
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0,
    roughness: 0.92,
    flatShading: true,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });

  if (style === "sword") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.1), metalMat);
    blade.position.set(0, 0.18, -0.18);
    blade.rotation.x = -Math.PI / 3;
    g.add(blade);
  } else if (style === "axe" || style === "pickaxe" || style === "hoe") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6), woodMat);
    handle.rotation.x = -Math.PI / 3;
    handle.position.set(0, 0.1, -0.15);
    g.add(handle);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(style === "pickaxe" ? 0.36 : 0.22, 0.14, 0.08),
      metalMat,
    );
    head.position.set(0, 0.28, -0.34);
    g.add(head);
  } else if (style === "staff") {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), woodMat);
    rod.position.set(0, 0.18, -0.05);
    rod.rotation.x = -0.2;
    g.add(rod);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11),
      new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.8,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
      }),
    );
    gem.position.set(0, 0.66, -0.14);
    g.add(gem);
  } else if (style === "bow") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI), woodMat);
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0, 0.06, -0.12);
    g.add(bow);
  }
  return g;
}

/**
 * 村人メッシュをフェーズと時刻に応じてアニメーションさせる。
 * moveDx, moveDz はワールド空間での進行方向ベクトル（移動していない場合は 0）。
 */
export function animateVillagerMesh(
  root: THREE.Group,
  phase: DungeonActivityPhase,
  timeSec: number,
  attackPulse: number,
  hurtPulse: number,
  moveDx: number = 0,
  moveDz: number = 0,
): void {
  const rig = root.userData.rig as VillagerRig | undefined;
  if (!rig) return;

  // 進行方向に応じて向きを決定（ローカル -Z が正面）
  const moveDistSq = moveDx * moveDx + moveDz * moveDz;
  let targetRotY = 0;
  if (moveDistSq > 0.0025) {
    targetRotY = Math.atan2(-moveDx, -moveDz);
  } else if (phase === "returning") {
    targetRotY = Math.PI;
  }

  // 最短角度差で滑らかに回転補間（±π跨ぎの逆回転を防止）
  const diff = Math.atan2(
    Math.sin(targetRotY - rig.bodyGroup.rotation.y),
    Math.cos(targetRotY - rig.bodyGroup.rotation.y),
  );
  rig.bodyGroup.rotation.y += diff * 0.22;

  const isMoving =
    moveDistSq > 0.0025 ||
    phase === "moving_to_target" ||
    phase === "returning" ||
    phase === "traveling_to";

  if (isMoving && phase !== "fighting" && phase !== "gathering") {
    const walk = Math.sin(timeSec * 9);
    rig.leftLeg.rotation.x = walk * 0.65;
    rig.rightLeg.rotation.x = -walk * 0.65;
    rig.leftArm.rotation.x = -walk * 0.5;
    rig.rightArm.rotation.x = walk * 0.5;
    rig.bodyGroup.position.y = Math.abs(walk) * 0.06;
    rig.bodyGroup.position.z = 0;
  } else if (phase === "gathering") {
    const swing = Math.sin(timeSec * 6.5);
    rig.leftLeg.rotation.x = 0.15;
    rig.rightLeg.rotation.x = -0.15;
    rig.rightArm.rotation.x = -0.8 + swing * 0.75;
    rig.leftArm.rotation.x = -0.25;
    rig.bodyGroup.position.y = Math.max(0, -swing) * 0.04;
    rig.bodyGroup.position.z = 0;
  } else if (phase === "fighting") {
    const idleBob = Math.sin(timeSec * 4) * 0.03;
    const slash = attackPulse > 0 ? Math.sin(attackPulse * Math.PI) : 0;
    rig.leftLeg.rotation.x = 0.2;
    rig.rightLeg.rotation.x = -0.2;
    rig.rightArm.rotation.x = -0.45 - slash * 1.35;
    rig.leftArm.rotation.x = -0.35;
    rig.bodyGroup.position.y = idleBob + slash * 0.08;
    rig.bodyGroup.position.z = -slash * 0.45;
  } else {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.leftArm.rotation.x = 0;
    rig.rightArm.rotation.x = 0;
    rig.bodyGroup.position.y = Math.sin(timeSec * 2) * 0.02;
    rig.bodyGroup.position.z = 0;
  }

  // 被弾赤フラッシュ
  if (hurtPulse > 0) {
    rig.tunicMat.emissive.setHex(0xef4444);
    rig.tunicMat.emissiveIntensity = hurtPulse * 0.9;
    rig.headMat.emissive.setHex(0xef4444);
    rig.headMat.emissiveIntensity = hurtPulse * 0.6;
  } else {
    rig.tunicMat.emissiveIntensity = 0;
    rig.headMat.emissiveIntensity = 0;
  }
}
