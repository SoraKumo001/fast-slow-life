import * as THREE from "three";

import { addPaperEdgesToGroup } from "./paperStyle";

interface MonsterVisualSpec {
  color: number;
  accentColor: number;
  scale: number;
  shape: "humanoid" | "beast" | "spider" | "bat" | "slime" | "dragon" | "golem";
}

const MONSTER_SPECS: Record<string, MonsterVisualSpec> = {
  goblin: { color: 0x4d7c0f, accentColor: 0x854d0e, scale: 0.85, shape: "humanoid" },
  wild_boar: { color: 0x78350f, accentColor: 0xfef3c7, scale: 0.95, shape: "beast" },
  goblin_leader: { color: 0x3f6212, accentColor: 0xfacc15, scale: 1.9, shape: "humanoid" },
  bat: { color: 0x4c1d95, accentColor: 0xf43f5e, scale: 0.85, shape: "bat" },
  spider: { color: 0x1e293b, accentColor: 0xef4444, scale: 0.95, shape: "spider" },
  slime: { color: 0x64748b, accentColor: 0x94a3b8, scale: 1.0, shape: "slime" },
  golem: { color: 0x475569, accentColor: 0x38bdf8, scale: 2.1, shape: "golem" },
  orc: { color: 0x15803d, accentColor: 0x991b1b, scale: 1.15, shape: "humanoid" },
  harpy: { color: 0x0284c7, accentColor: 0xfde047, scale: 1.0, shape: "bat" },
  werewolf: { color: 0x334155, accentColor: 0xf87171, scale: 1.2, shape: "beast" },
  chimera: { color: 0x991b1b, accentColor: 0xf59e0b, scale: 2.2, shape: "dragon" },
  demon: { color: 0x7f1d1d, accentColor: 0xf97316, scale: 1.2, shape: "humanoid" },
  treant: { color: 0x3f6212, accentColor: 0x5c4033, scale: 1.4, shape: "golem" },
  gargoyle: { color: 0x475569, accentColor: 0xa855f7, scale: 1.25, shape: "bat" },
  archdemon: { color: 0x581c87, accentColor: 0xef4444, scale: 2.3, shape: "dragon" },
  dragon_spawn: { color: 0xb91c1c, accentColor: 0xfbbf24, scale: 1.35, shape: "dragon" },
  shadow_knight: { color: 0x0f172a, accentColor: 0xc084fc, scale: 1.3, shape: "humanoid" },
  ancient_dragon: { color: 0x1e1b4b, accentColor: 0xf43f5e, scale: 2.6, shape: "dragon" },
};

/**
 * モンスターIDに応じたプロシージャル3Dモデルを構築する。
 */
export function buildMonsterMesh(monsterId: string, isBoss: boolean = false): THREE.Group {
  const spec = MONSTER_SPECS[monsterId] || {
    color: 0xdc2626,
    accentColor: 0xfbbf24,
    scale: isBoss ? 2.0 : 1.0,
    shape: "humanoid" as const,
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mainMat = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    emissive: isBoss ? spec.accentColor : 0x000000,
    emissiveIntensity: isBoss ? 0.35 : 0,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  if (spec.shape === "slime") {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mainMat);
    blob.scale.set(1.1, 0.8, 1.1);
    blob.position.y = 0.42;
    body.add(blob);
    for (const ex of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
      eye.position.set(ex, 0.5, 0.48);
      body.add(eye);
    }
  } else if (spec.shape === "spider") {
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mainMat);
    abdomen.position.set(0, 0.42, -0.2);
    body.add(abdomen);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), mainMat);
    head.position.set(0, 0.38, 0.25);
    body.add(head);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.06), accentMat);
        leg.position.set(side * 0.42, 0.26, -0.25 + i * 0.18);
        leg.rotation.z = side * -0.45;
        body.add(leg);
      }
    }
  } else if (spec.shape === "bat") {
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), mainMat);
    torso.position.y = 1.05;
    body.add(torso);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.06), accentMat);
      wing.position.set(side * 0.52, 1.1, 0);
      wing.rotation.z = side * 0.25;
      body.add(wing);
    }
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
      eye.position.set(ex, 1.12, 0.28);
      body.add(eye);
    }
  } else if (spec.shape === "beast") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.9), mainMat);
    torso.position.y = 0.52;
    body.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.44), mainMat);
    head.position.set(0, 0.65, 0.55);
    body.add(head);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), accentMat);
      tusk.rotation.x = Math.PI / 2;
      tusk.position.set(side * 0.16, 0.54, 0.82);
      body.add(tusk);
    }
  } else if (spec.shape === "dragon") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 1.0), mainMat);
    torso.position.y = 0.85;
    body.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.55), mainMat);
    head.position.set(0, 1.38, 0.55);
    body.add(head);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.08), accentMat);
      wing.position.set(side * 0.75, 1.25, -0.15);
      wing.rotation.z = side * 0.35;
      body.add(wing);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), accentMat);
      horn.position.set(side * 0.18, 1.7, 0.42);
      body.add(horn);
    }
    for (const ex of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), eyeMat);
      eye.position.set(ex, 1.42, 0.83);
      body.add(eye);
    }
  } else {
    // humanoid / golem
    const isGolem = spec.shape === "golem";
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(isGolem ? 0.85 : 0.56, isGolem ? 0.85 : 0.65, isGolem ? 0.55 : 0.34),
      mainMat,
    );
    torso.position.y = isGolem ? 0.95 : 0.78;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), mainMat);
    head.position.y = isGolem ? 1.58 : 1.32;
    body.add(head);

    if (isBoss) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.32, 6), accentMat);
      crown.position.y = (isGolem ? 1.58 : 1.32) + 0.34;
      body.add(crown);
    }

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(isGolem ? 0.28 : 0.18, isGolem ? 0.75 : 0.54, isGolem ? 0.28 : 0.18),
        accentMat,
      );
      arm.position.set(side * (isGolem ? 0.58 : 0.4), isGolem ? 0.9 : 0.78, 0.1);
      body.add(arm);
    }

    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), eyeMat);
      eye.position.set(ex, isGolem ? 1.6 : 1.35, 0.22);
      body.add(eye);
    }
  }

  // ペーパークラフト風: 紙の折り目線を付ける（目・ボスオーラは対象外になる）
  addPaperEdgesToGroup(root);

  body.scale.setScalar(spec.scale);

  // ボス用威圧オーラリング
  if (isBoss) {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 24),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.05;
    aura.name = "bossAura";
    root.add(aura);
  }

  root.userData.bodyGroup = body;
  root.userData.mainMat = mainMat;
  root.userData.isBoss = isBoss;
  return root;
}

export function animateMonsterMesh(
  root: THREE.Group,
  timeSec: number,
  attackPulse: number,
  hurtPulse: number,
): void {
  const body = root.userData.bodyGroup as THREE.Group | undefined;
  const mainMat = root.userData.mainMat as THREE.MeshStandardMaterial | undefined;
  if (!body || !mainMat) return;

  const bob = Math.sin(timeSec * 3.2) * 0.06;
  const lunge = attackPulse > 0 ? Math.sin(attackPulse * Math.PI) * 0.55 : 0;
  body.position.y = Math.max(0, bob);
  body.position.z = lunge; // 手前(+Z)の村人側へ踏み込む

  const aura = root.getObjectByName("bossAura");
  if (aura) {
    aura.rotation.z = timeSec * 0.8;
  }

  if (hurtPulse > 0) {
    mainMat.emissive.setHex(0xffffff);
    mainMat.emissiveIntensity = hurtPulse * 0.85;
  } else {
    mainMat.emissiveIntensity = 0;
  }
}
