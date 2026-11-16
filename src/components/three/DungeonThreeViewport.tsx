import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  BOSS_GATE_NODE_ID,
  buildDungeonMap,
  initialRevealedNodes,
  interpolateGridPosition,
  type DungeonMap,
} from "../../store/dungeonMap";
import { getExploredDepth } from "../../store/dungeonSpatialHelper";
import type { ActiveBossState, DungeonArea, DungeonVisualEvent, Villager } from "../../types/game";
import {
  buildDungeonEnvironment,
  gridToWorld,
  type BuiltEnvironment,
} from "./builders/environmentBuilder";
import { buildGatherNodeMesh } from "./builders/gatherNodeMeshBuilder";
import { animateMonsterMesh, buildMonsterMesh } from "./builders/monsterMeshBuilder";
import { animateVillagerMesh, buildVillagerMesh } from "./builders/villagerMeshBuilder";

export type CameraViewAngle = "quarter" | "follow" | "side";

interface FloatingPopup {
  id: string;
  worldPos: THREE.Vector3;
  text: string;
  colorClass: string;
  createdAt: number;
}

interface LabelItem {
  id: string;
  name: string;
  subText?: string;
  hpRatio: number;
  isEnemy: boolean;
  isBoss?: boolean;
  x: number;
  y: number;
  visible: boolean;
}

interface PopupScreenItem {
  id: string;
  text: string;
  colorClass: string;
  x: number;
  y: number;
  opacity: number;
}

interface DungeonThreeViewportProps {
  area: DungeonArea;
  villagers: Villager[];
  activeBoss: ActiveBossState | null;
  dungeonEvents: DungeonVisualEvent[];
  cameraMode: "auto" | "free";
  cameraView?: CameraViewAngle;
  focusDepth: number | null;
  heightClass?: string;
  /** Phase 4a: 解放済みノードID（未指定時は探索度から初期値を導出） */
  revealedNodeIds?: string[];
}

/** 経路距離に対応するワールド座標（入口→ボス門パス上の補間） */
function worldAtDepth(map: DungeonMap, depth: number): { x: number; z: number } {
  const g = interpolateGridPosition(map, BOSS_GATE_NODE_ID, depth);
  return gridToWorld(g.gx, g.gy, map.cols, map.rows);
}

/** 村人の表示ワールド座標（ターゲットノードへのパス上で currentDepth を補間） */
function villagerWorldPos(
  map: DungeonMap,
  v: Villager,
): { x: number; z: number } {
  const ds = v.dungeonState;
  const depth =
    v.status === "traveling_to"
      ? 0
      : v.status === "traveling_back"
        ? (ds?.currentDepth ?? 0) * 0.3
        : (ds?.currentDepth ?? 0);
  const targetId =
    ds?.targetNodeId ?? (depth > 0 ? BOSS_GATE_NODE_ID : null);
  const g = interpolateGridPosition(map, targetId, depth);
  return gridToWorld(g.gx, g.gy, map.cols, map.rows);
}

export const DungeonThreeViewport: React.FC<DungeonThreeViewportProps> = ({
  area,
  villagers,
  activeBoss,
  dungeonEvents,
  cameraMode,
  cameraView = "quarter",
  focusDepth,
  heightClass = "h-56",
  revealedNodeIds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [popups, setPopups] = useState<PopupScreenItem[]>([]);
  const [webglError, setWebglError] = useState(false);

  // 最新propsをアニメーションループから参照するためのRef
  const propsRef = useRef({
    area,
    villagers,
    activeBoss,
    cameraMode,
    cameraView,
    revealedNodeIds,
  });
  propsRef.current = { area, villagers, activeBoss, cameraMode, cameraView, revealedNodeIds };

  // アニメーション・イベント状態（Phase 7: カメラ焦点は2Dワールド座標）
  const animStateRef = useRef({
    targetFocus: { x: 0, z: 0 },
    currentFocus: { x: 0, z: 0 },
    manualFocus: { x: 0, z: 0 },
    isDragging: false,
    lastMouseY: 0,
    lastMouseX: 0,
    attackPulses: new Map<string, number>(),
    hurtPulses: new Map<string, number>(),
    popups: [] as FloatingPopup[],
    lastEventIds: new Set<string>(),
  });

  // focusDepth（経路距離）が外部から指定されたら、その経路上の点へカメラを移動
  useEffect(() => {
    if (focusDepth !== null) {
      const map = buildDungeonMap(propsRef.current.area);
      const p = worldAtDepth(map, focusDepth);
      animStateRef.current.manualFocus = { ...p };
      animStateRef.current.targetFocus = { ...p };
    }
  }, [focusDepth]);

  // 新着の dungeonEvents をポップアップとアクションパルスに変換
  useEffect(() => {
    if (!dungeonEvents || dungeonEvents.length === 0) return;
    const state = animStateRef.current;
    const now = performance.now();
    const map = buildDungeonMap(propsRef.current.area);

    dungeonEvents.forEach((ev, idx) => {
      if (ev.areaId !== area.id || state.lastEventIds.has(ev.id)) return;
      state.lastEventIds.add(ev.id);
      if (state.lastEventIds.size > 200) {
        const first = state.lastEventIds.values().next().value;
        if (first) state.lastEventIds.delete(first);
      }

      if (ev.type === "attack" || ev.type === "crit" || ev.type === "miss") {
        state.attackPulses.set(ev.actorId, 1.0);
        if (ev.targetId && ev.type !== "miss") {
          state.hurtPulses.set(ev.targetId, 1.0);
        }
      } else if (ev.type === "enemy_attack") {
        state.attackPulses.set(ev.actorId, 1.0);
        if (ev.targetId) {
          state.hurtPulses.set(ev.targetId, 1.0);
        }
      }

      let colorClass = "text-white";
      if (ev.type === "crit") colorClass = "text-amber-300 font-black scale-110";
      else if (ev.type === "attack") colorClass = "text-sky-300 font-bold";
      else if (ev.type === "miss") colorClass = "text-slate-400 italic";
      else if (ev.type === "enemy_attack") colorClass = "text-red-400 font-bold";
      else if (ev.type === "heal") colorClass = "text-emerald-400 font-bold";
      else if (ev.type === "gather") colorClass = "text-emerald-300 font-bold";
      else if (ev.type === "defeat") colorClass = "text-amber-400 font-black";

      if (ev.label) {
        const p = worldAtDepth(map, ev.depth);
        state.popups.push({
          id: ev.id,
          worldPos: new THREE.Vector3(
            p.x + ((idx % 3) - 1) * 0.25,
            1.9 + (idx % 3) * 0.22,
            p.z,
          ),
          text: ev.label,
          colorClass,
          createdAt: now + idx * 70,
        });
      }
    });
  }, [dungeonEvents, area.id]);

  // Three.js シーン初期化とループ
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

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 224;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 600);

    // ライティング
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff3d6, 1.15);
    dirLight.position.set(8, 16, 10);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    rimLight.position.set(-8, 8, -12);
    scene.add(rimLight);

    let envObj: BuiltEnvironment | null = null;
    let builtAreaId = "";
    const gatherMeshes = new Map<string, THREE.Group>();
    const monsterMeshes = new Map<string, THREE.Group>();
    const villagerMeshes = new Map<string, { mesh: THREE.Group; job: string }>();

    const rebuildAreaScene = (targetArea: DungeonArea) => {
      if (envObj) {
        scene.remove(envObj.group);
      }
      gatherMeshes.forEach((m) => scene.remove(m));
      gatherMeshes.clear();
      monsterMeshes.forEach((m) => scene.remove(m));
      monsterMeshes.clear();

      const map = buildDungeonMap(targetArea);
      envObj = buildDungeonEnvironment(targetArea.id, targetArea.maxDepth || 100, map);
      scene.background = new THREE.Color(envObj.theme.skyColor);
      scene.fog = new THREE.FogExp2(envObj.theme.fogColor, 0.011);
      ambient.intensity = envObj.theme.ambientIntensity;
      dirLight.color.setHex(envObj.theme.lightColor);
      scene.add(envObj.group);

      // 採取ノード配置（所属セルの位置）
      targetArea.gathers.forEach((g) => {
        const node = map.byId.get(g.itemId);
        if (!node) return;
        const mesh = buildGatherNodeMesh(g.itemId);
        const p = gridToWorld(node.gx, node.gy, map.cols, map.rows);
        mesh.position.set(p.x, 0, p.z);
        scene.add(mesh);
        gatherMeshes.set(g.itemId, mesh);
      });

      // モンスター配置（所属セルの位置）
      targetArea.monsters.forEach((m) => {
        const node = map.byId.get(m.id);
        if (!node) return;
        const mesh = buildMonsterMesh(m.id, Boolean(m.isBoss));
        const p = gridToWorld(node.gx, node.gy, map.cols, map.rows);
        mesh.position.set(p.x, 0, p.z);
        scene.add(mesh);
        monsterMeshes.set(m.id, mesh);
      });

      builtAreaId = targetArea.id;
      const start = worldAtDepth(map, Math.min(18, getExploredDepth(targetArea) * 0.5));
      animStateRef.current.currentFocus = { ...start };
      animStateRef.current.targetFocus = { ...start };
      animStateRef.current.manualFocus = { ...start };
    };

    rebuildAreaScene(propsRef.current.area);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 224;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // マウスドラッグ＆ホイール操作（フリーカメラ用）
    const dom = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      animStateRef.current.isDragging = true;
      animStateRef.current.lastMouseX = e.clientX;
      animStateRef.current.lastMouseY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!animStateRef.current.isDragging) return;
      const dx = e.clientX - animStateRef.current.lastMouseX;
      const dy = e.clientY - animStateRef.current.lastMouseY;
      animStateRef.current.lastMouseX = e.clientX;
      animStateRef.current.lastMouseY = e.clientY;
      const st = animStateRef.current;
      st.manualFocus.x = st.manualFocus.x - dx * 0.07;
      st.manualFocus.z = st.manualFocus.z + dy * 0.07;
    };
    const onPointerUp = () => {
      animStateRef.current.isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      animStateRef.current.manualFocus.z -= e.deltaY * 0.045;
    };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    let lastOverlaySync = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now / 1000;

      const {
        area: curArea,
        villagers: curVillagers,
        activeBoss: curBoss,
        cameraMode: curCamMode,
        cameraView: curCamView,
        revealedNodeIds: curRevealed,
      } = propsRef.current;

      if (curArea.id !== builtAreaId) {
        rebuildAreaScene(curArea);
      }

      // Phase 4a/7: 霧。解放済みノード集合（未指定時は探索度から導出）
      const revealedSet = new Set(curRevealed ?? initialRevealedNodes(curArea));
      const curMap = buildDungeonMap(curArea);

      if (envObj) {
        // コンテンツプラットフォーム: 未解放は暗く沈ませる
        envObj.nodePlatforms.forEach((mat, nodeId) => {
          mat.color.setHex(revealedSet.has(nodeId) ? envObj!.theme.pathColor : 0x14161c);
        });
        // セルタイル / 通路 / 壁: 解放状態で共有マテリアルを差し替える
        // （通路と壁は端点のどちらかが解放済みなら明るくする近似）
        const mats = envObj.fogMats;
        for (const t of envObj.fogTiles) {
          const lit = revealedSet.has(t.nodeId!);
          const m = lit ? mats.tileLit : mats.tileDark;
          if (t.mesh.material !== m) t.mesh.material = m;
        }
        for (const e of envObj.fogEdges) {
          const lit = revealedSet.has(e.aId!) || revealedSet.has(e.bId!);
          const m = lit ? mats.edgeLit : mats.edgeDark;
          if (e.mesh.material !== m) e.mesh.material = m;
        }
        for (const w of envObj.fogWalls) {
          const lit = revealedSet.has(w.aId!) || revealedSet.has(w.bId!);
          const m = lit ? mats.wallLit : mats.wallDark;
          if (w.mesh.material !== m) w.mesh.material = m;
        }
      }

      const halfW = (curMap.cols * 6) / 2;
      const halfD = (curMap.rows * 6) / 2;

      // 開拓前線の位置更新（入口→ボス門パス上の前線経路距離の点）
      if (envObj) {
        const fp = worldAtDepth(curMap, getExploredDepth(curArea));
        envObj.frontierMesh.position.x += (fp.x - envObj.frontierMesh.position.x) * 0.12;
        envObj.frontierMesh.position.z += (fp.z - envObj.frontierMesh.position.z) * 0.12;
        envObj.frontierMesh.visible = curArea.explorationProgress < 100;
      }

      // 採取ノードの表示・リスポーン状態更新（未解放ノードは霧で隠す）
      curArea.gathers.forEach((g) => {
        const mesh = gatherMeshes.get(g.itemId);
        if (!mesh) return;
        const unlocked = curArea.explorationProgress >= (g.unlockedAtProgress || 0);
        mesh.visible = unlocked && revealedSet.has(g.itemId);
        if (!mesh.visible) return;

        const isRespawning = !!(g.respawnTimeLeft && g.respawnTimeLeft > 0);
        const content = mesh.getObjectByName("gatherContent");
        if (content) {
          const targetScale = isRespawning ? 0.35 : 1.0;
          content.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        }
      });

      // パルス減衰
      const state = animStateRef.current;
      state.attackPulses.forEach((val, key) => {
        const next = val - dt * 3.2;
        if (next <= 0) state.attackPulses.delete(key);
        else state.attackPulses.set(key, next);
      });
      state.hurtPulses.forEach((val, key) => {
        const next = val - dt * 3.0;
        if (next <= 0) state.hurtPulses.delete(key);
        else state.hurtPulses.set(key, next);
      });

      // モンスター表示・アニメーション（未解放ノードは霧で隠す）
      curArea.monsters.forEach((m) => {
        const mesh = monsterMeshes.get(m.id);
        if (!mesh) return;
        const unlocked = curArea.explorationProgress >= (m.unlockedAtProgress || 0);
        const isRespawning = !!(m.respawnTimeLeft && m.respawnTimeLeft > 0);
        mesh.visible = unlocked && !isRespawning && revealedSet.has(m.id);
        if (mesh.visible) {
          animateMonsterMesh(
            mesh,
            timeSec,
            state.attackPulses.get(m.id) || 0,
            state.hurtPulses.get(m.id) || 0,
          );
        }
      });

      // 村人メッシュの同期と補間移動
      const activeIds = new Set(curVillagers.map((v) => v.id));
      villagerMeshes.forEach((entry, id) => {
        if (!activeIds.has(id)) {
          scene.remove(entry.mesh);
          villagerMeshes.delete(id);
        }
      });

      let focusVillagerPos: { x: number; z: number } | null = null;
      let hasFightingVillager = false;

      curVillagers.forEach((v, idx) => {
        let entry = villagerMeshes.get(v.id);
        if (!entry || entry.job !== v.currentJob) {
          if (entry) scene.remove(entry.mesh);
          const mesh = buildVillagerMesh(v.currentJob);
          const init = villagerWorldPos(curMap, v);
          mesh.position.set(init.x, 0, init.z);
          scene.add(mesh);
          entry = { mesh, job: v.currentJob };
          villagerMeshes.set(v.id, entry);
        }

        const ds = v.dungeonState;
        const phase =
          v.status === "traveling_to"
            ? "traveling_to"
            : v.status === "traveling_back"
              ? "returning"
              : ds?.phase || "moving_to_target";

        // Phase 7: ターゲットノードへの経路上で currentDepth を補間した位置へ
        const target = villagerWorldPos(curMap, v);
        const prevX = entry.mesh.position.x;
        const prevZ = entry.mesh.position.z;
        const stepX = (target.x - prevX) * 0.12;
        const stepZ = (target.z - prevZ) * 0.12;
        entry.mesh.position.x += stepX;
        entry.mesh.position.z += stepZ;

        animateVillagerMesh(
          entry.mesh,
          phase,
          timeSec + idx * 0.7,
          state.attackPulses.get(v.id) || 0,
          state.hurtPulses.get(v.id) || 0,
          target.x - prevX,
          target.z - prevZ,
        );

        if (phase === "fighting") {
          focusVillagerPos = { x: entry.mesh.position.x, z: entry.mesh.position.z };
          hasFightingVillager = true;
        } else if (!hasFightingVillager && focusVillagerPos === null) {
          focusVillagerPos = { x: entry.mesh.position.x, z: entry.mesh.position.z };
        }
      });

      // カメラ焦点の決定（クロージャ内で代入されるため、読み出しは関数経由にして
      // TS のフロー解析による null への絞り込みを避ける）
      const readFocusPos = (): { x: number; z: number } | null => focusVillagerPos;
      const focusPos = readFocusPos();
      if (curCamMode === "auto") {
        if (curBoss && curArea.monsters.some((m) => m.id === curBoss.monsterId)) {
          const bossNode = curMap.byId.get(curBoss.monsterId) ?? curMap.byId.get(BOSS_GATE_NODE_ID);
          if (bossNode) {
            const p = gridToWorld(bossNode.gx, bossNode.gy, curMap.cols, curMap.rows);
            state.targetFocus = { x: p.x, z: p.z };
          }
        } else if (focusPos !== null) {
          state.targetFocus = { x: focusPos.x, z: focusPos.z };
        } else {
          state.targetFocus = worldAtDepth(
            curMap,
            Math.max(10, getExploredDepth(curArea) * 0.6),
          );
        }
      } else {
        state.manualFocus.x = Math.max(-halfW - 10, Math.min(halfW + 10, state.manualFocus.x));
        state.manualFocus.z = Math.max(-halfD - 10, Math.min(halfD + 10, state.manualFocus.z));
        state.targetFocus = { ...state.manualFocus };
      }

      state.currentFocus.x += (state.targetFocus.x - state.currentFocus.x) * 0.08;
      state.currentFocus.z += (state.targetFocus.z - state.currentFocus.z) * 0.08;
      const fx = state.currentFocus.x;
      const fz = state.currentFocus.z;

      if (curCamView === "side") {
        camera.position.set(fx + 14, 6, fz + 2);
        camera.lookAt(fx, 1.0, fz - 2);
      } else if (curCamView === "follow") {
        camera.position.set(fx, 4.5, fz + 9);
        camera.lookAt(fx, 1.2, fz - 5);
      } else {
        // quarter (斜め俯瞰)
        camera.position.set(fx + 6.5, 9.5, fz + 13);
        camera.lookAt(fx, 0.8, fz - 3);
      }

      renderer.render(scene, camera);

      // HTMLオーバーレイ座標の同期 (約20fpsで更新してReact負荷を抑える)
      if (now - lastOverlaySync > 50) {
        lastOverlaySync = now;
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 224;
        const nextLabels: LabelItem[] = [];

        const project = (worldPos: THREE.Vector3) => {
          const p = worldPos.clone().project(camera);
          return {
            x: (p.x * 0.5 + 0.5) * w,
            y: (-p.y * 0.5 + 0.5) * h,
            visible: p.z < 1 && p.x >= -1.15 && p.x <= 1.15 && p.y >= -1.15 && p.y <= 1.15,
          };
        };

        curVillagers.forEach((v) => {
          const entry = villagerMeshes.get(v.id);
          if (!entry) return;
          const pos = entry.mesh.position.clone().add(new THREE.Vector3(0, 1.95, 0));
          const scr = project(pos);
          if (scr.visible) {
            nextLabels.push({
              id: v.id,
              name: v.name,
              subText: v.currentJob,
              hpRatio: Math.max(0, Math.min(1, v.currentHp / Math.max(1, v.maxHp))),
              isEnemy: false,
              ...scr,
            });
          }
        });

        curArea.monsters.forEach((m) => {
          const mesh = monsterMeshes.get(m.id);
          if (!mesh || !mesh.visible) return;
          const isBossActive = curBoss && curBoss.monsterId === m.id;
          const curHp = isBossActive ? curBoss.currentHp : (m.currentHp ?? m.hp);
          const maxHp = isBossActive ? curBoss.maxHp : m.maxHp;
          const pos = mesh.position.clone().add(new THREE.Vector3(0, m.isBoss ? 3.2 : 1.9, 0));
          const scr = project(pos);
          if (scr.visible) {
            nextLabels.push({
              id: m.id,
              name: m.name,
              subText: `Lv.${m.level}`,
              hpRatio: Math.max(0, Math.min(1, curHp / Math.max(1, maxHp))),
              isEnemy: true,
              isBoss: Boolean(m.isBoss),
              ...scr,
            });
          }
        });

        setLabels(nextLabels);

        // フローティングポップアップの更新
        state.popups = state.popups.filter((p) => now - p.createdAt < 1300);
        const nextPopups: PopupScreenItem[] = state.popups
          .filter((p) => now >= p.createdAt)
          .map((p) => {
            const elapsed = (now - p.createdAt) / 1300;
            const wp = p.worldPos.clone().add(new THREE.Vector3(0, elapsed * 1.4, 0));
            const scr = project(wp);
            return {
              id: p.id,
              text: p.text,
              colorClass: p.colorClass,
              x: scr.x,
              y: scr.y,
              opacity: Math.max(0, 1 - elapsed * elapsed),
            };
          });
        setPopups(nextPopups);
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
      className={`relative w-full ${heightClass} rounded-lg overflow-hidden border border-slate-800 bg-slate-950 select-none ${
        cameraMode === "free" ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {/* 頭上ラベル・HPバーオーバーレイ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {labels.map((item) => (
          <div
            key={item.id}
            style={{
              transform: `translate(-50%, -100%) translate(${item.x}px, ${item.y}px)`,
            }}
            className="absolute top-0 left-0 flex flex-col items-center"
          >
            <div
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none whitespace-nowrap shadow ${
                item.isBoss
                  ? "bg-amber-950/90 text-amber-300 border border-amber-500/60"
                  : item.isEnemy
                    ? "bg-red-950/85 text-red-200 border border-red-800/60"
                    : "bg-slate-900/85 text-sky-200 border border-sky-700/60"
              }`}
            >
              {item.name}
              {item.subText && <span className="ml-1 opacity-75 font-normal">{item.subText}</span>}
            </div>
            <div className="w-12 h-1 bg-slate-900/90 rounded-full overflow-hidden mt-0.5 border border-slate-700/70">
              <div
                className={`h-full transition-all duration-200 ${
                  item.isEnemy ? "bg-red-500" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.round(item.hpRatio * 100)}%` }}
              />
            </div>
          </div>
        ))}

        {/* フローティングダメージ・採取ポップアップ */}
        {popups.map((p) => (
          <div
            key={p.id}
            style={{
              transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
              opacity: p.opacity,
            }}
            className={`absolute top-0 left-0 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] whitespace-nowrap ${p.colorClass}`}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* 左上 HUD バッジ */}
      <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-bold text-slate-200 backdrop-blur-xs">
          {area.name} ({area.maxDepth || 100}m)
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-sky-400">
          開拓 {getExploredDepth(area)}m
        </span>
      </div>

      {cameraMode === "free" && (
        <div className="absolute bottom-1.5 right-2 pointer-events-none text-[9px] text-slate-400 bg-slate-950/70 px-1.5 py-0.5 rounded">
          ドラッグ / ホイールで移動
        </div>
      )}
    </div>
  );
};
