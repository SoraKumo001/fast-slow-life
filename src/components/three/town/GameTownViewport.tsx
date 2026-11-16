import { RotateCcw, RotateCw, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  CELL_SIZE,
  TOWN_BUILDINGS,
  getBuildingById,
  gridToWorldCenter,
  isWalkable,
  type GridPoint,
} from "../../../data/townLayout";
import { useGameStore } from "../../../store/gameStore";
import { findPath } from "../../../store/life/pathfinding";
import {
  resolveVillagerDestination,
  weatherForDay,
  type TownActivity,
  type WeatherKind,
} from "../../../store/town/townSpatial";
import { buildBuildingMesh } from "../builders/buildingMeshBuilder";
import { buildTownEnvironment } from "../builders/townEnvironmentBuilder";
import { animateVillagerMesh, buildVillagerMesh } from "../builders/villagerMeshBuilder";

export type TownSideTab = "inventory" | "villagers" | "facilities" | "dungeons";

export interface GameTownViewportProps {
  onSelectTab?: (tab: TownSideTab) => void;
  heightClass?: string;
}

type Selection = { type: "building"; id: string } | { type: "villager"; id: string } | null;

interface LabelItem {
  id: string;
  name: string;
  subText: string;
  x: number;
  y: number;
  visible: boolean;
}

/* ------------------------------------------------------------------ */
/* 昼夜ライティング (TownViewport と同じキー。夜明けの環境光下限を引き上げ済み) */
/* ------------------------------------------------------------------ */

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
  const color = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), t).getHex();
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

/* ------------------------------------------------------------------ */
/* 村人ランタイム (描画側だけが持つ空間状態。ストアには保存しない)        */
/* ------------------------------------------------------------------ */

interface AgentRuntime {
  mesh: THREE.Group;
  job: string;
  /** グリッド座標 (小数) */
  pos: { x: number; z: number };
  path: GridPoint[];
  pathIndex: number;
  destKey: string;
  activity: TownActivity;
  anchor: GridPoint;
  arrived: boolean;
  hidden: boolean;
  hiddenReason: "sleep" | "dungeon" | null;
  wanderTimer: number;
  wanderSeed: number;
  prevWorldX: number;
  prevWorldZ: number;
}

const PITCH_RAD = (50 * Math.PI) / 180;
const MIN_DISTANCE = 12;
const MAX_DISTANCE = 48;
/** 歩行速度 (セル/秒) @1x。町の端から端 (32セル) を約19秒で渡る */
const BASE_WALK_CELLS_PER_SEC = 1.7;

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}

const WEATHER_LABELS: Record<WeatherKind, string> = {
  sunny: "晴れ",
  rain: "雨",
  snow: "雪",
};

export const GameTownViewport: React.FC<GameTownViewportProps> = ({
  onSelectTab,
  heightClass = "h-full",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [webglError, setWebglError] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [azimuthDeg, setAzimuthDeg] = useState(0);

  // 本体ストア購読
  const villagers = useGameStore((s) => s.villagers);
  const facilities = useGameStore((s) => s.facilities);
  const currentDay = useGameStore((s) => s.currentDay);
  const currentHour = useGameStore((s) => s.currentHour);
  const isPaused = useGameStore((s) => s.isPaused);
  const playSpeed = useGameStore((s) => s.playSpeed);
  const activeBoss = useGameStore((s) => s.activeBoss);
  const gameOver = useGameStore((s) => s.gameOver);

  const propsRef = useRef({
    villagers,
    facilities,
    currentDay,
    currentHour,
    isPaused,
    playSpeed,
    activeBoss,
    gameOver,
    azimuthDeg,
  });
  propsRef.current = {
    villagers,
    facilities,
    currentDay,
    currentHour,
    isPaused,
    playSpeed,
    activeBoss,
    gameOver,
    azimuthDeg,
  };

  const selectionRef = useRef<Selection>(null);
  selectionRef.current = selection;

  const camRef = useRef({
    azimuth: 0,
    // 初期距離は町全体が入る最大寄り
    distance: 46,
    targetDistance: 46,
    centerX: 0,
    centerZ: 0,
    targetCenterX: 0,
    targetCenterZ: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    downX: 0,
    downY: 0,
    downTime: 0,
    movedPx: 0,
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

    const fog = new THREE.Fog(0x87bfe8, 90, 220);
    scene.fog = fog;

    // 環境
    const env = buildTownEnvironment();
    scene.add(env.group);

    // 建物 (レベルが変わったものだけ作り直す)
    const buildingMap = new Map<
      string,
      { group: THREE.Group; level: number; windowMats: THREE.MeshStandardMaterial[] }
    >();
    const syncBuildings = (facs: typeof propsRef.current.facilities) => {
      for (const def of TOWN_BUILDINGS) {
        const level = def.facilityId ? (facs[def.facilityId]?.level ?? 1) : 1;
        const existing = buildingMap.get(def.id);
        if (existing && existing.level === level) continue;
        if (existing) {
          scene.remove(existing.group);
          disposeGroup(existing.group);
        }
        const group = buildBuildingMesh(def, level);
        scene.add(group);
        buildingMap.set(def.id, {
          group,
          level,
          windowMats:
            (group.userData.windowMats as THREE.MeshStandardMaterial[] | undefined) ?? [],
        });
      }
    };
    syncBuildings(propsRef.current.facilities);

    // 天気の粒 (雨・雪)
    const makePoints = (
      count: number,
      color: number,
      size: number,
      opacity: number,
    ): { points: THREE.Points; positions: Float32Array } => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 110;
        positions[i * 3 + 1] = Math.random() * 32;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      return { points, positions };
    };
    const rain = makePoints(700, 0x9db8dd, 0.32, 0.65);
    const snow = makePoints(450, 0xffffff, 0.42, 0.85);

    // 選択リング
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 1.0, 40),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    ring.visible = false;
    scene.add(ring);

    // 村人ランタイム
    const agents = new Map<string, AgentRuntime>();
    const gateDef = getBuildingById("gate")!;

    const startPathTo = (rt: AgentRuntime, target: GridPoint) => {
      const start = { x: Math.round(rt.pos.x), z: Math.round(rt.pos.z) };
      if (start.x === target.x && start.z === target.z) {
        rt.path = [];
        rt.pathIndex = 0;
        rt.arrived = true;
        return;
      }
      const path = findPath(start, target);
      if (!path || path.length <= 1) {
        rt.path = [];
        rt.pathIndex = 0;
        rt.arrived = true;
        // 到達不能でも見た目が破綻しないよう目的地へ寄せる
        rt.pos = { x: target.x, z: target.z };
        return;
      }
      rt.path = path;
      rt.pathIndex = 1;
      rt.arrived = false;
    };

    const applyArrivalVisibility = (rt: AgentRuntime) => {
      if (rt.activity === "sleep") {
        rt.hidden = true;
        rt.hiddenReason = "sleep";
        rt.mesh.visible = false;
      } else if (rt.activity === "dungeon") {
        rt.hidden = true;
        rt.hiddenReason = "dungeon";
        rt.mesh.visible = false;
      }
    };

    const syncAgents = (p: typeof propsRef.current) => {
      const seen = new Set<string>();
      p.villagers.forEach((v, i) => {
        seen.add(v.id);
        const dest = resolveVillagerDestination(v, p.facilities, p.activeBoss, p.currentHour, i);
        const destKey = `${dest.buildingId}:${dest.activity}`;
        let rt = agents.get(v.id);

        if (!rt) {
          const mesh = buildVillagerMesh(v.currentJob);
          mesh.userData.villagerId = v.id;
          const w = gridToWorldCenter(dest.anchor.x, dest.anchor.z);
          mesh.position.set(w.x, 0, w.z);
          scene.add(mesh);
          rt = {
            mesh,
            job: v.currentJob,
            pos: { x: dest.anchor.x, z: dest.anchor.z },
            path: [],
            pathIndex: 0,
            destKey,
            activity: dest.activity,
            anchor: dest.anchor,
            arrived: true,
            hidden: false,
            hiddenReason: null,
            wanderTimer: 1.5 + (i % 4),
            wanderSeed: i * 29 + 11,
            prevWorldX: w.x,
            prevWorldZ: w.z,
          };
          agents.set(v.id, rt);
          if (dest.activity === "sleep" || dest.activity === "dungeon") {
            applyArrivalVisibility(rt);
          }
          return;
        }

        // 職業が変わったらメッシュを作り直す
        if (rt.job !== v.currentJob) {
          const old = rt.mesh;
          scene.remove(old);
          disposeGroup(old);
          const mesh = buildVillagerMesh(v.currentJob);
          mesh.userData.villagerId = v.id;
          mesh.position.copy(old.position);
          mesh.visible = old.visible;
          scene.add(mesh);
          rt.mesh = mesh;
          rt.job = v.currentJob;
        }

        if (rt.destKey === destKey) return;

        // 行き先が変わった
        const wasHiddenReason = rt.hiddenReason;
        rt.destKey = destKey;
        rt.activity = dest.activity;
        rt.anchor = dest.anchor;
        rt.arrived = false;

        if (dest.activity === "dungeon") {
          if (wasHiddenReason === "sleep") {
            // 家から門へ向かう
            rt.hidden = false;
            rt.hiddenReason = null;
            rt.mesh.visible = true;
          }
          startPathTo(rt, dest.anchor);
          if (rt.arrived) applyArrivalVisibility(rt);
          return;
        }

        if (rt.hidden && wasHiddenReason === "dungeon") {
          // ダンジョンから帰ってきた: 門に現れてから歩く
          rt.pos = { x: gateDef.entrance.x, z: gateDef.entrance.z };
          const w = gridToWorldCenter(rt.pos.x, rt.pos.z);
          rt.mesh.position.set(w.x, 0, w.z);
          rt.prevWorldX = w.x;
          rt.prevWorldZ = w.z;
        }
        rt.hidden = false;
        rt.hiddenReason = null;
        rt.mesh.visible = true;
        startPathTo(rt, dest.anchor);
        if (rt.arrived) applyArrivalVisibility(rt);
      });

      // いなくなった村人 (リセット等) の後片付け
      agents.forEach((rt, id) => {
        if (!seen.has(id)) {
          scene.remove(rt.mesh);
          disposeGroup(rt.mesh);
          agents.delete(id);
        }
      });
    };

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // クリック選択 (ドラッグと区別する)
    const raycaster = new THREE.Raycaster();
    const pickAt = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (typeof obj.userData.villagerId === "string") {
            setSelection({ type: "villager", id: obj.userData.villagerId });
            return;
          }
          if (typeof obj.userData.buildingId === "string") {
            setSelection({ type: "building", id: obj.userData.buildingId });
            return;
          }
          obj = obj.parent;
        }
      }
      setSelection(null);
    };

    const dom = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      const cam = camRef.current;
      cam.isDragging = true;
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;
      cam.downX = e.clientX;
      cam.downY = e.clientY;
      cam.downTime = performance.now();
      cam.movedPx = 0;
    };
    const onPointerMove = (e: PointerEvent) => {
      const cam = camRef.current;
      if (!cam.isDragging) return;
      const dx = e.clientX - cam.lastMouseX;
      const dy = e.clientY - cam.lastMouseY;
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;
      cam.movedPx = Math.max(
        cam.movedPx,
        Math.hypot(e.clientX - cam.downX, e.clientY - cam.downY),
      );
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
    const onPointerUp = (e: PointerEvent) => {
      const cam = camRef.current;
      cam.isDragging = false;
      if (cam.movedPx < 6 && performance.now() - cam.downTime < 500) {
        pickAt(e.clientX, e.clientY);
      }
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
    let lastTime = performance.now();
    let lastOverlaySync = 0;
    let lastAgentSync = 0;
    let hourKey = "";
    let hourFrac = 0;

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;
      const p = propsRef.current;
      const cam = camRef.current;

      // --- 時刻 (hour 内の経過割合で昼夜を補間) ---
      const intervalSec = p.playSpeed === "fast" ? 0.3 : p.playSpeed === "super" ? 0.1 : 1.0;
      const key = `${p.currentDay}:${p.currentHour}`;
      if (key !== hourKey) {
        hourKey = key;
        hourFrac = 0;
      }
      if (!p.isPaused && !p.gameOver) {
        hourFrac = Math.min(1, hourFrac + dt / intervalSec);
      }
      const effectiveHour = p.currentHour + hourFrac;
      const weather = weatherForDay(p.currentDay);

      // --- 昼夜ライティング + 天気 ---
      const sky = sampleSky(effectiveHour);
      const skyColor = new THREE.Color(sky.sky);
      let ambientIntensity = sky.ambientIntensity;
      if (weather === "rain") {
        skyColor.lerp(new THREE.Color(0x54687f), 0.45);
        ambientIntensity *= 0.85;
      } else if (weather === "snow") {
        skyColor.lerp(new THREE.Color(0xe8eef5), 0.35);
      }
      scene.background = skyColor;
      fog.color.copy(skyColor);
      fog.near = weather === "sunny" ? 90 : 58;
      fog.far = weather === "sunny" ? 220 : 155;
      ambient.intensity = ambientIntensity;
      ambient.color.setHex(sky.ambientColor);
      sun.intensity = sky.sunIntensity * (weather === "sunny" ? 1 : 0.75);
      sun.color.setHex(sky.sunColor);
      const sunAngle = ((effectiveHour - 6) / 12) * Math.PI;
      sun.position.set(
        Math.cos(sunAngle) * 42,
        Math.max(6, Math.sin(sunAngle) * 48) * (0.4 + sky.sunElevation),
        20,
      );
      buildingMap.forEach((entry) => {
        for (const m of entry.windowMats) m.emissiveIntensity = sky.windowGlow * 1.6;
      });
      for (const m of env.lampMats) m.emissiveIntensity = sky.lampGlow * 2.2;
      for (const m of env.lampGlowMats) m.opacity = sky.lampGlow * 0.16;

      // --- 天気の粒 ---
      rain.points.visible = weather === "rain";
      snow.points.visible = weather === "snow";
      if (weather === "rain") {
        const arr = rain.positions;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= 30 * dt;
          arr[i] += 5 * dt;
          if (arr[i + 1] < 0) {
            arr[i + 1] = 30 + Math.random() * 3;
            arr[i] = (Math.random() - 0.5) * 110;
            arr[i + 2] = (Math.random() - 0.5) * 110;
          }
        }
        (rain.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate =
          true;
      } else if (weather === "snow") {
        const arr = snow.positions;
        for (let i = 0; i < arr.length; i += 3) {
          const n = i / 3;
          arr[i + 1] -= (1.4 + (n % 5) * 0.35) * dt;
          arr[i] += Math.sin(timeSec * 0.9 + n * 1.7) * 0.7 * dt;
          if (arr[i + 1] < 0) {
            arr[i + 1] = 28 + Math.random() * 3;
            arr[i] = (Math.random() - 0.5) * 110;
            arr[i + 2] = (Math.random() - 0.5) * 110;
          }
        }
        (snow.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate =
          true;
      }

      // --- 建物・村人の同期 (約120ms間隔) ---
      if (now - lastAgentSync > 120) {
        lastAgentSync = now;
        syncBuildings(p.facilities);
        syncAgents(p);
      }

      // --- 村人の移動・アニメーション ---
      const frozen = p.isPaused || p.gameOver;
      const speedMult = p.playSpeed === "fast" ? 1000 / 300 : p.playSpeed === "super" ? 10 : 1;
      const walkSpeed = Math.min(14, BASE_WALK_CELLS_PER_SEC * speedMult);
      const agentDt = frozen ? 0 : dt;

      agents.forEach((rt, id) => {
        const v = p.villagers.find((x) => x.id === id);
        if (!v) return;
        let moving = false;

        if (agentDt > 0 && !rt.hidden) {
          if (rt.path.length > 0 && rt.pathIndex < rt.path.length) {
            let distance = walkSpeed * agentDt;
            while (distance > 0 && rt.pathIndex < rt.path.length) {
              const target = rt.path[rt.pathIndex];
              const dx = target.x - rt.pos.x;
              const dz = target.z - rt.pos.z;
              const dist = Math.hypot(dx, dz);
              if (dist <= distance) {
                rt.pos.x = target.x;
                rt.pos.z = target.z;
                distance -= dist;
                rt.pathIndex += 1;
              } else {
                rt.pos.x += (dx / dist) * distance;
                rt.pos.z += (dz / dist) * distance;
                distance = 0;
              }
            }
            moving = rt.pathIndex < rt.path.length;
            if (!moving) {
              rt.arrived = true;
              applyArrivalVisibility(rt);
            }
          } else if (rt.arrived && rt.activity !== "dungeon") {
            // 到着後の小移動 (作業・待機を「生きて」見せる)
            rt.wanderTimer -= agentDt;
            if (rt.wanderTimer <= 0) {
              rt.wanderTimer = 2.2 + (rt.wanderSeed % 3);
              rt.wanderSeed = rt.wanderSeed * 31 + 17;
              const candidates: GridPoint[] = [{ ...rt.anchor }];
              for (let dz = -2; dz <= 2; dz++) {
                for (let dx = -2; dx <= 2; dx++) {
                  const cx = rt.anchor.x + dx;
                  const cz = rt.anchor.z + dz;
                  if (isWalkable(cx, cz)) candidates.push({ x: cx, z: cz });
                }
              }
              const target = candidates[Math.abs(rt.wanderSeed) % candidates.length];
              const start = { x: Math.round(rt.pos.x), z: Math.round(rt.pos.z) };
              if (target.x !== start.x || target.z !== start.z) {
                const path = findPath(start, target);
                if (path && path.length > 1) {
                  rt.path = path;
                  rt.pathIndex = 1;
                  moving = true;
                }
              }
            }
          }
        }

        const w = gridToWorldCenter(rt.pos.x, rt.pos.z);
        const dxw = w.x - rt.prevWorldX;
        const dzw = w.z - rt.prevWorldZ;
        rt.mesh.position.set(w.x, 0, w.z);
        if (!rt.hidden) {
          const phase = moving
            ? "moving_to_target"
            : rt.arrived && rt.activity === "work"
              ? "gathering"
              : "idle";
          const idx = p.villagers.indexOf(v);
          animateVillagerMesh(rt.mesh, phase, timeSec + idx * 0.7, 0, 0, dxw, dzw);
        }
        rt.prevWorldX = w.x;
        rt.prevWorldZ = w.z;
      });

      // --- 選択リング ---
      const sel = selectionRef.current;
      if (!sel) {
        ring.visible = false;
      } else if (sel.type === "villager") {
        const rt = agents.get(sel.id);
        if (rt && !rt.hidden) {
          ring.visible = true;
          ring.scale.setScalar(0.75);
          ring.position.set(rt.mesh.position.x, 0.07, rt.mesh.position.z);
        } else {
          ring.visible = false;
        }
      } else {
        const def = getBuildingById(sel.id);
        if (def) {
          ring.visible = true;
          const cx = (def.x - 16) * CELL_SIZE + (def.w * CELL_SIZE) / 2;
          const cz = (def.z - 16) * CELL_SIZE + (def.d * CELL_SIZE) / 2;
          ring.scale.setScalar(Math.max(def.w, def.d) * (CELL_SIZE / 2) + 0.5);
          ring.position.set(cx, 0.07, cz);
        } else {
          ring.visible = false;
        }
      }

      // --- カメラ ---
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

      // --- 頭上ラベル (約20fps) ---
      if (now - lastOverlaySync > 50) {
        lastOverlaySync = now;
        const w = container.clientWidth || 640;
        const h = container.clientHeight || 480;
        const nextLabels: LabelItem[] = [];
        for (const v of p.villagers) {
          const rt = agents.get(v.id);
          if (!rt || rt.hidden) continue;
          const pos = rt.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0));
          const proj = pos.project(camera);
          const visible =
            proj.z < 1 && proj.x >= -1.1 && proj.x <= 1.1 && proj.y >= -1.1 && proj.y <= 1.1;
          if (!visible) continue;
          nextLabels.push({
            id: v.id,
            name: v.name,
            subText: v.currentJob,
            x: (proj.x * 0.5 + 0.5) * w,
            y: (-proj.y * 0.5 + 0.5) * h,
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

  // Q / E でカメラ回転 (入力中は除く)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "q" || e.key === "Q") setAzimuthDeg((v) => v - 90);
      if (e.key === "e" || e.key === "E") setAzimuthDeg((v) => v + 90);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // ミニカードの内容 (最新のストア値から導出)
  let card: React.ReactNode = null;
  if (selection?.type === "building") {
    const def = getBuildingById(selection.id);
    if (def) {
      const facility = def.facilityId ? facilities[def.facilityId] : undefined;
      const queueCount = facility
        ? facility.craftQueue.length + facility.trainingQueue.length
        : 0;
      const statusText = facility
        ? facility.level === 0
          ? "未建設"
          : facility.upgradeTimeLeft > 0
            ? "アップグレード中"
            : queueCount > 0
              ? `稼働中 (キュー ${queueCount})`
              : "待機中"
        : def.kind === "gate"
          ? "ダンジョンへの出発点"
          : def.kind === "plaza"
            ? "村人の憩いの場"
            : def.kind === "house"
              ? "村人の住まい"
              : "町の施設";
      card = (
        <>
          <div className="text-sm font-bold text-slate-100">{facility?.name ?? def.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {facility ? `Lv ${facility.level}` : def.name} ・ {statusText}
          </div>
          <button
            className="mt-2 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[11px] font-bold text-white transition"
            onClick={() => onSelectTab?.("facilities")}
          >
            施設タブで開く
          </button>
        </>
      );
    }
  } else if (selection?.type === "villager") {
    const v = villagers.find((x) => x.id === selection.id);
    if (v) {
      const idx = villagers.indexOf(v);
      const dest = resolveVillagerDestination(v, facilities, activeBoss, currentHour, idx);
      const destDef = getBuildingById(dest.buildingId);
      const statusText =
        dest.activity === "work"
          ? `${destDef?.name ?? "施設"}で作業中`
          : dest.activity === "dungeon"
            ? "ダンジョン遠征中"
            : dest.activity === "rest"
              ? "休息中"
              : dest.activity === "sleep"
                ? "就寝中"
                : dest.activity === "idle"
                  ? "広場で待機中"
                  : "自宅で待機中";
      card = (
        <>
          <div className="text-sm font-bold text-slate-100">{v.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {v.currentJob} Lv{v.level} ・ {statusText}
          </div>
          <div className="text-[11px] text-slate-500">
            HP {Math.floor(v.currentHp)}/{v.maxHp} ・ スタミナ {Math.floor(v.stamina)}/
            {v.maxStamina}
          </div>
          <button
            className="mt-2 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[11px] font-bold text-white transition"
            onClick={() => onSelectTab?.("villagers")}
          >
            村人タブで開く
          </button>
        </>
      );
    }
  }

  const weather = weatherForDay(currentDay);

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
          ポリゴンの町
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-sky-300">
          {WEATHER_LABELS[weather]}
        </span>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <button
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950/80 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 transition"
          onClick={() => setAzimuthDeg((v) => v - 90)}
        >
          <RotateCcw className="w-3 h-3" /> 回転
        </button>
        <button
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950/80 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 transition"
          onClick={() => setAzimuthDeg((v) => v + 90)}
        >
          <RotateCw className="w-3 h-3" /> 回転
        </button>
      </div>

      {card && (
        <div className="absolute bottom-2 left-2 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2.5 pr-8 shadow-xl">
          <button
            className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-200"
            onClick={() => setSelection(null)}
            aria-label="選択を閉じる"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {card}
        </div>
      )}

      <div className="absolute bottom-1.5 right-2 pointer-events-none text-[9px] text-slate-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
        ドラッグ: パン / ホイール: ズーム / Q・E: 回転 / クリック: 選択
      </div>
    </div>
  );
};
