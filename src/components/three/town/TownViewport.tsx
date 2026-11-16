import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { TOWN_BUILDINGS, gridToWorldCenter } from "../../../data/townLayout";
import type {
  PrototypeAgentState,
  PrototypeSimulation,
} from "../../../store/life/prototypeAgents";
import { buildBuildingMesh } from "../builders/buildingMeshBuilder";
import { buildTownEnvironment } from "../builders/townEnvironmentBuilder";
import { animateVillagerMesh, buildVillagerMesh } from "../builders/villagerMeshBuilder";

export interface TownViewportProps {
  /** 呼び出し側が tick で進めるシミュレーション (同一インスタンスを使い続けること) */
  simulation: PrototypeSimulation;
  /** 目標方位角 (度、90度刻み。累積値でもよい) */
  azimuthDeg: number;
  heightClass?: string;
}

interface LabelItem {
  id: string;
  name: string;
  subText: string;
  x: number;
  y: number;
  visible: boolean;
}

const STATE_LABELS: Record<PrototypeAgentState, string> = {
  home: "家でのんびり",
  toWork: "通勤中",
  work: "仕事中",
  toPlaza: "広場へ移動中",
  plaza: "広場で休憩",
  toHome: "帰宅中",
  sleep: "就寝中",
};

interface SkyKey {
  hour: number;
  sky: number;
  ambientIntensity: number;
  ambientColor: number;
  sunIntensity: number;
  sunColor: number;
  sunElevation: number;
  windowGlow: number;
  lampGlow: number;
}

const SKY_KEYS: SkyKey[] = [
  { hour: 0, sky: 0x0b1026, ambientIntensity: 0.34, ambientColor: 0x8fa3cc, sunIntensity: 0.1, sunColor: 0xafc4ff, sunElevation: 0.35, windowGlow: 1, lampGlow: 1 },
  { hour: 5, sky: 0x0e1430, ambientIntensity: 0.52, ambientColor: 0x9db1d9, sunIntensity: 0.2, sunColor: 0xafc4ff, sunElevation: 0.3, windowGlow: 1, lampGlow: 1 },
  { hour: 6.5, sky: 0xdf9a6a, ambientIntensity: 0.68, ambientColor: 0xffd9b0, sunIntensity: 0.72, sunColor: 0xffb37a, sunElevation: 0.14, windowGlow: 0.35, lampGlow: 0.35 },
  { hour: 9, sky: 0x87bfe8, ambientIntensity: 0.88, ambientColor: 0xffffff, sunIntensity: 1.2, sunColor: 0xfff2d8, sunElevation: 0.75, windowGlow: 0, lampGlow: 0 },
  { hour: 16, sky: 0x84b6e2, ambientIntensity: 0.85, ambientColor: 0xffffff, sunIntensity: 1.1, sunColor: 0xffeec9, sunElevation: 0.55, windowGlow: 0, lampGlow: 0 },
  { hour: 18.5, sky: 0xe88a52, ambientIntensity: 0.6, ambientColor: 0xffc9a0, sunIntensity: 0.7, sunColor: 0xff9a5a, sunElevation: 0.12, windowGlow: 0.55, lampGlow: 0.55 },
  { hour: 20, sky: 0x1a2340, ambientIntensity: 0.4, ambientColor: 0x93a7d4, sunIntensity: 0.14, sunColor: 0xafc4ff, sunElevation: 0.3, windowGlow: 1, lampGlow: 1 },
  { hour: 24, sky: 0x0b1026, ambientIntensity: 0.34, ambientColor: 0x8fa3cc, sunIntensity: 0.1, sunColor: 0xafc4ff, sunElevation: 0.35, windowGlow: 1, lampGlow: 1 },
];

function sampleSky(hour: number): SkyKey {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].hour <= h) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const t = (h - a.hour) / Math.max(0.0001, b.hour - a.hour);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const color = (x: number, y: number) =>
    new THREE.Color(x).lerp(new THREE.Color(y), t).getHex();
  return {
    hour: h,
    sky: color(a.sky, b.sky),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity),
    ambientColor: color(a.ambientColor, b.ambientColor),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity),
    sunColor: color(a.sunColor, b.sunColor),
    sunElevation: lerp(a.sunElevation, b.sunElevation),
    windowGlow: lerp(a.windowGlow, b.windowGlow),
    lampGlow: lerp(a.lampGlow, b.lampGlow),
  };
}

const PITCH_RAD = (50 * Math.PI) / 180;
const MIN_DISTANCE = 12;
const MAX_DISTANCE = 48;

export const TownViewport: React.FC<TownViewportProps> = ({
  simulation,
  azimuthDeg,
  heightClass = "h-full",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [webglError, setWebglError] = useState(false);

  const propsRef = useRef({ simulation, azimuthDeg });
  propsRef.current = { simulation, azimuthDeg };

  const camRef = useRef({
    azimuth: 0, // 現在の方位角 (ラジアン、連続値)
    // 初期距離は町全体が入る最大寄り (Phase 0 所見の修正)
    distance: 46,
    targetDistance: 46,
    centerX: 0,
    centerZ: 0,
    targetCenterX: 0,
    targetCenterZ: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 400);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbcd7ff, 0.3);
    fill.position.set(-20, 24, -16);
    scene.add(fill);

    scene.fog = new THREE.Fog(0x87bfe8, 90, 220);

    // 町並み (環境 + 建物)
    const env = buildTownEnvironment();
    scene.add(env.group);
    const windowMats: THREE.MeshStandardMaterial[] = [];
    for (const def of TOWN_BUILDINGS) {
      const building = buildBuildingMesh(def);
      scene.add(building);
      const mats = building.userData.windowMats as THREE.MeshStandardMaterial[] | undefined;
      if (mats) windowMats.push(...mats);
    }

    // 村人メッシュ
    const villagerMeshes = new Map<
      string,
      { mesh: THREE.Group; job: string; prevX: number; prevZ: number }
    >();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    const dom = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      camRef.current.isDragging = true;
      camRef.current.lastMouseX = e.clientX;
      camRef.current.lastMouseY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      const cam = camRef.current;
      if (!cam.isDragging) return;
      const dx = e.clientX - cam.lastMouseX;
      const dy = e.clientY - cam.lastMouseY;
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;
      const scale = cam.distance * 0.0016;
      const az = cam.azimuth;
      const rightX = Math.cos(az);
      const rightZ = -Math.sin(az);
      const fwdX = -Math.sin(az);
      const fwdZ = -Math.cos(az);
      cam.targetCenterX = THREE.MathUtils.clamp(
        cam.targetCenterX - rightX * dx * scale + fwdX * dy * scale,
        -26,
        26,
      );
      cam.targetCenterZ = THREE.MathUtils.clamp(
        cam.targetCenterZ - rightZ * dx * scale + fwdZ * dy * scale,
        -26,
        26,
      );
    };
    const onPointerUp = () => {
      camRef.current.isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.targetDistance = THREE.MathUtils.clamp(
        camRef.current.targetDistance + e.deltaY * 0.02,
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    };
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    let lastOverlaySync = 0;

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const timeSec = now / 1000;
      const sim = propsRef.current.simulation;
      const cam = camRef.current;

      // --- 昼夜ライティング ---
      const sky = sampleSky(sim.hour);
      scene.background = new THREE.Color(sky.sky);
      if (scene.fog) scene.fog.color.setHex(sky.sky);
      ambient.intensity = sky.ambientIntensity;
      ambient.color.setHex(sky.ambientColor);
      sun.intensity = sky.sunIntensity;
      sun.color.setHex(sky.sunColor);
      const sunAngle = ((sim.hour - 6) / 12) * Math.PI;
      sun.position.set(
        Math.cos(sunAngle) * 42,
        Math.max(6, Math.sin(sunAngle) * 48) * (0.4 + sky.sunElevation),
        20,
      );
      for (const m of windowMats) m.emissiveIntensity = sky.windowGlow * 1.6;
      for (const m of env.lampMats) m.emissiveIntensity = sky.lampGlow * 2.2;
      for (const m of env.lampGlowMats) m.opacity = sky.lampGlow * 0.16;

      // --- 村人同期 ---
      sim.agents.forEach((agent, idx) => {
        let entry = villagerMeshes.get(agent.id);
        if (!entry || entry.job !== agent.job) {
          if (entry) scene.remove(entry.mesh);
          const mesh = buildVillagerMesh(agent.job);
          const w = gridToWorldCenter(agent.pos.x, agent.pos.z);
          mesh.position.set(w.x, 0, w.z);
          scene.add(mesh);
          entry = { mesh, job: agent.job, prevX: w.x, prevZ: w.z };
          villagerMeshes.set(agent.id, entry);
        }
        const w = gridToWorldCenter(agent.pos.x, agent.pos.z);
        const dx = w.x - entry.prevX;
        const dz = w.z - entry.prevZ;
        entry.mesh.position.set(w.x, 0, w.z);
        entry.mesh.visible = agent.isVisible;
        if (agent.isVisible) {
          const phase = agent.isMoving
            ? "moving_to_target"
            : agent.state === "work"
              ? "gathering"
              : "idle";
          animateVillagerMesh(entry.mesh, phase, timeSec + idx * 0.7, 0, 0, dx, dz);
        }
        entry.prevX = w.x;
        entry.prevZ = w.z;
      });

      // --- カメラ (方位を最短弧で補間) ---
      const targetAz = (propsRef.current.azimuthDeg * Math.PI) / 180;
      const diff = Math.atan2(
        Math.sin(targetAz - cam.azimuth),
        Math.cos(targetAz - cam.azimuth),
      );
      cam.azimuth += diff * 0.09;
      cam.distance += (cam.targetDistance - cam.distance) * 0.12;
      cam.centerX += (cam.targetCenterX - cam.centerX) * 0.15;
      cam.centerZ += (cam.targetCenterZ - cam.centerZ) * 0.15;

      const horiz = cam.distance * Math.cos(PITCH_RAD);
      const vert = cam.distance * Math.sin(PITCH_RAD);
      camera.position.set(
        cam.centerX + Math.sin(cam.azimuth) * horiz,
        vert,
        cam.centerZ + Math.cos(cam.azimuth) * horiz,
      );
      camera.lookAt(cam.centerX, 0, cam.centerZ);

      renderer.render(scene, camera);

      // --- 頭上ラベル同期 (約20fps) ---
      if (now - lastOverlaySync > 50) {
        lastOverlaySync = now;
        const w = container.clientWidth || 640;
        const h = container.clientHeight || 480;
        const nextLabels: LabelItem[] = [];
        for (const agent of sim.agents) {
          const entry = villagerMeshes.get(agent.id);
          if (!entry || !agent.isVisible) continue;
          const pos = entry.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0));
          const p = pos.project(camera);
          const visible = p.z < 1 && p.x >= -1.1 && p.x <= 1.1 && p.y >= -1.1 && p.y <= 1.1;
          if (!visible) continue;
          nextLabels.push({
            id: agent.id,
            name: agent.name,
            subText: `${agent.job}・${STATE_LABELS[agent.state]}`,
            x: (p.x * 0.5 + 0.5) * w,
            y: (-p.y * 0.5 + 0.5) * h,
            visible,
          });
        }
        setLabels(nextLabels);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div
        className={`${heightClass} w-full rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-400`}
      >
        3Dビューポートを初期化できませんでした (WebGL未対応環境)
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass} rounded-lg overflow-hidden border border-slate-800 bg-slate-950 select-none cursor-grab active:cursor-grabbing`}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {labels.map((item) => (
          <div
            key={item.id}
            style={{
              transform: `translate(-50%, -100%) translate(${item.x}px, ${item.y}px)`,
            }}
            className="absolute top-0 left-0 flex flex-col items-center"
          >
            <div className="px-1.5 py-0.5 rounded text-[9px] font-bold leading-none whitespace-nowrap shadow bg-slate-900/85 text-sky-200 border border-sky-700/60">
              {item.name}
              <span className="ml-1 opacity-75 font-normal">{item.subText}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-bold text-slate-200 backdrop-blur-xs">
          ポリゴンの町 (Phase 0)
        </span>
      </div>

      <div className="absolute bottom-1.5 right-2 pointer-events-none text-[9px] text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
        ドラッグ: パン / ホイール: ズーム / Q・E: 回転
      </div>
    </div>
  );
};
