import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { addPaperEdges, addPaperEdgesToGroup, paperInkColor } from "./paperStyle";

describe("paperInkColor", () => {
  it("紙色より暗く、彩度も落ちる", () => {
    const base = new THREE.Color(0x84cc16);
    const ink = paperInkColor(0x84cc16);
    const baseHsl = { h: 0, s: 0, l: 0 };
    const inkHsl = { h: 0, s: 0, l: 0 };
    base.getHSL(baseHsl);
    ink.getHSL(inkHsl);
    expect(inkHsl.l).toBeLessThan(baseHsl.l);
    expect(inkHsl.s).toBeLessThan(baseHsl.s);
    expect(inkHsl.h).toBeCloseTo(baseHsl.h, 3);
  });

  it("真っ白でも真っ黒にはならない", () => {
    const ink = paperInkColor(0xffffff);
    const hsl = { h: 0, s: 0, l: 0 };
    ink.getHSL(hsl);
    expect(hsl.l).toBeGreaterThan(0);
    expect(hsl.l).toBeLessThanOrEqual(0.3);
  });
});

describe("addPaperEdges", () => {
  const standard = (color = 0x84cc16) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });

  it("通常の箱には線が付く", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), standard());
    const lines = addPaperEdges(mesh);
    expect(lines).not.toBeNull();
    expect(lines!.name).toBe("paperEdge");
    expect(mesh.children).toContain(lines);
  });

  it("二重には付かない", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), standard());
    addPaperEdges(mesh);
    expect(addPaperEdges(mesh)).toBeNull();
    expect(mesh.children).toHaveLength(1);
  });

  it("MeshBasicMaterial は対象外", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    expect(addPaperEdges(mesh)).toBeNull();
  });

  it("emissive のある材質（窓・ランプ等）は対象外", () => {
    const mat = standard(0x2b3a4a);
    mat.emissive.setHex(0xffca7a);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), mat);
    expect(addPaperEdges(mesh)).toBeNull();
  });

  it("平面ジオメトリは対象外", () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), standard(0x679c4f));
    expect(addPaperEdges(mesh)).toBeNull();
  });

  it("InstancedMesh は対象外", () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), standard(), 4);
    expect(addPaperEdges(mesh as unknown as THREE.Mesh)).toBeNull();
  });

  it("baseColor を明示できる（霧で材質が差し替わる壁用）", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.35, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x12141a }),
    );
    const lines = addPaperEdges(mesh, { baseColor: 0x2f4d23 });
    expect(lines).not.toBeNull();
    const mat = lines!.material as THREE.LineBasicMaterial;
    expect(mat.color.getHex()).toBe(paperInkColor(0x2f4d23).getHex());
  });

  it("グループ一括付与では対象外が混ざってもよい", () => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), standard());
    const decal = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    group.add(box, decal);
    addPaperEdgesToGroup(group);
    expect(box.children).toHaveLength(1);
    expect(decal.children).toHaveLength(0);
  });
});
