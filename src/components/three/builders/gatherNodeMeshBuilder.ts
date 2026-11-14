import * as THREE from "three";

/**
 * 採取スポット (木材、鉱石、小麦、薬草、クリスタル等) のプロシージャル3Dメッシュを生成する。
 */
export function buildGatherNodeMesh(itemId: string): THREE.Group {
  const group = new THREE.Group();
  const content = new THREE.Group();
  content.name = "gatherContent";
  group.add(content);

  if (itemId === "wood") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }),
    );
    trunk.position.y = 0.55;
    content.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 1.4, 7),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.8,
      }),
    );
    crown.position.y = 1.45;
    content.add(crown);
  } else if (["stone", "iron_ore", "silver_ore"].includes(itemId)) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.58, 0),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }),
    );
    rock.position.y = 0.42;
    rock.scale.set(1.15, 0.85, 1.0);
    content.add(rock);

    if (itemId !== "stone") {
      const oreColors: Record<string, number> = {
        iron_ore: 0x94a3b8,
        silver_ore: 0xe2e8f0,
      };
      const oreMat = new THREE.MeshStandardMaterial({
        color: oreColors[itemId] ?? 0x94a3b8,
        metalness: 0.7,
        roughness: 0.25,
        emissive: oreColors[itemId] ?? 0x000000,
        emissiveIntensity: 0.2,
      });
      for (const offset of [
        [0.24, 0.65, 0.18],
        [-0.22, 0.55, -0.15],
        [0.05, 0.78, -0.12],
      ]) {
        const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), oreMat);
        vein.position.set(offset[0], offset[1], offset[2]);
        content.add(vein);
      }
    }
  } else if (["crystal_fragment", "mana_stone", "dark_crystal"].includes(itemId)) {
    const colorMap: Record<string, { c: number; e: number }> = {
      crystal_fragment: { c: 0x67e8f9, e: 0x06b6d4 },
      mana_stone: { c: 0x38bdf8, e: 0x0284c7 },
      dark_crystal: { c: 0xc084fc, e: 0x7e22ce },
    };
    const col = colorMap[itemId] || colorMap.mana_stone;
    const mat = new THREE.MeshStandardMaterial({
      color: col.c,
      emissive: col.e,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.3,
    });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), mat);
    main.position.y = 0.65;
    main.scale.set(0.7, 1.4, 0.7);
    content.add(main);

    const sub = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mat);
    sub.position.set(0.28, 0.38, 0.15);
    sub.rotation.z = -0.4;
    content.add(sub);
  } else if (itemId === "wheat") {
    const wheatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
    for (let i = -1; i <= 1; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.85, 6), wheatMat);
      stalk.position.set(i * 0.2, 0.42, (i % 2) * 0.1);
      stalk.rotation.z = i * 0.12;
      content.add(stalk);
    }
  } else {
    // herb 等
    const color = itemId === "herb" ? 0x10b981 : 0x84cc16;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: itemId === "herb" ? 0x059669 : 0x000000,
      emissiveIntensity: itemId === "herb" ? 0.35 : 0,
      roughness: 0.7,
    });
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), mat);
      const angle = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.18, 0.28, Math.sin(angle) * 0.18);
      leaf.rotation.z = Math.cos(angle) * 0.35;
      leaf.rotation.x = Math.sin(angle) * 0.35;
      content.add(leaf);
    }
  }

  // 足元マーカーリング
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.65, 16),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = "nodeRing";
  group.add(ring);

  return group;
}
