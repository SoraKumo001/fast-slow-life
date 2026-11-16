import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildDungeonMap, initialRevealedNodes } from "../../store/dungeonMap";
import {
  getExploredDepth,
  getGatherDepth,
  getMonsterDepth,
} from "../../store/dungeonSpatialHelper";
import type { ActiveBossState, DungeonArea, DungeonVisualEvent, Villager } from "../../types/game";
import {
  buildDungeonEnvironment,
  depthToZ,
  laneToX,
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

  // アニメーション・イベント状態
  const animStateRef = useRef({
    targetCamZ: 0,
    currentCamZ: 0,
    manualOffsetZ: 0,
    isDragging: false,
    lastMouseY: 0,
    lastMouseX: 0,
    panX: 0,
    attackPulses: new Map<string, number>(),
    hurtPulses: new Map<string, number>(),
    popups: [] as FloatingPopup[],
    lastEventIds: new Set<string>(),
  });

  // focusDepth が外部から指定されたらカメラを移動
  useEffect(() => {
    if (focusDepth !== null) {
      animStateRef.current.manualOffsetZ = depthToZ(focusDepth);
      animStateRef.current.targetCamZ = depthToZ(focusDepth);
    }
  }, [focusDepth]);

  // 新着の dungeonEvents をポップアップとアクションパルスに変換
  useEffect(() => {
    if (!dungeonEvents || dungeonEvents.length === 0) return;
    const state = animStateRef.current;
    const now = performance.now();

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
        state.popups.push({
          id: ev.id,
          worldPos: new THREE.Vector3(
            laneToX(ev.lane) + ((idx % 3) - 1) * 0.25,
            1.9 + (idx % 3) * 0.22,
            depthToZ(ev.depth),
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
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 220);

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

      envObj = buildDungeonEnvironment(
        targetArea.id,
        targetArea.maxDepth || 100,
        buildDungeonMap(targetArea),
      );
      scene.background = new THREE.Color(envObj.theme.skyColor);
      scene.fog = new THREE.FogExp2(envObj.theme.fogColor, 0.018);
      ambient.intensity = envObj.theme.ambientIntensity;
      dirLight.color.setHex(envObj.theme.lightColor);
      scene.add(envObj.group);

      // 採取ノード配置
      targetArea.gathers.forEach((g, idx) => {
        const mesh = buildGatherNodeMesh(g.itemId);
        const d = getGatherDepth(targetArea, g);
        const lane = g.lane ?? (idx % 2 === 0 ? -1.2 : 1.2);
        mesh.position.set(laneToX(lane), 0, depthToZ(d));
        scene.add(mesh);
        gatherMeshes.set(g.itemId, mesh);
      });

      // モンスター配置
      targetArea.monsters.forEach((m) => {
        const mesh = buildMonsterMesh(m.id, Boolean(m.isBoss));
        const d = getMonsterDepth(targetArea, m);
        const lane = m.lane ?? 0;
        mesh.position.set(laneToX(lane), 0, depthToZ(d));
        scene.add(mesh);
        monsterMeshes.set(m.id, mesh);
      });

      builtAreaId = targetArea.id;
      const startZ = depthToZ(Math.min(18, getExploredDepth(targetArea) * 0.5));
      animStateRef.current.currentCamZ = startZ;
      animStateRef.current.targetCamZ = startZ;
      animStateRef.current.manualOffsetZ = startZ;
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
      animStateRef.current.manualOffsetZ += dy * 0.12;
      animStateRef.current.panX = Math.max(-4, Math.min(4, animStateRef.current.panX - dx * 0.025));
    };
    const onPointerUp = () => {
      animStateRef.current.isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      animStateRef.current.manualOffsetZ -= e.deltaY * 0.03;
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

      // Phase 4a: 霧。解放済みノード集合（未指定時は探索度から導出）
      const revealedSet = new Set(curRevealed ?? initialRevealedNodes(curArea));
      const curMap = buildDungeonMap(curArea);

      // ノードプラットフォームの色: 未解放は暗く沈ませる
      if (envObj) {
        envObj.nodePlatforms.forEach((mat, nodeId) => {
          mat.color.setHex(revealedSet.has(nodeId) ? envObj!.theme.pathColor : 0x14161c);
        });
      }

      const maxDepth = curArea.maxDepth || 100;
      const minZ = depthToZ(maxDepth) - 4;
      const maxZ = 4;

      // 開拓前線の位置更新
      if (envObj) {
        const exploredZ = depthToZ(getExploredDepth(curArea));
        envObj.frontierMesh.position.z += (exploredZ - envObj.frontierMesh.position.z) * 0.12;
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

      let focusVillagerZ: number | null = null;
      let hasFightingVillager = false;

      curVillagers.forEach((v, idx) => {
        let entry = villagerMeshes.get(v.id);
        if (!entry || entry.job !== v.currentJob) {
          if (entry) scene.remove(entry.mesh);
          const mesh = buildVillagerMesh(v.currentJob);
          const initDepth = v.dungeonState?.currentDepth ?? 0;
          mesh.position.set(laneToX(v.dungeonState?.lane ?? (idx % 3) - 1), 0, depthToZ(initDepth));
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

        let targetDepth =
          v.status === "traveling_to"
            ? 0
            : v.status === "traveling_back"
              ? Math.max(0, (ds?.currentDepth ?? 0) * 0.3)
              : (ds?.currentDepth ?? 0);
        let targetLane = ds?.lane ?? ((idx % 3) - 1) * 0.7;

        // Phase 4a: ターゲットノードに近づいたら、そのプラットフォーム位置にスナップする
        if (v.status === "active" && ds?.targetNodeId) {
          const node = curMap.byId.get(ds.targetNodeId);
          if (node && Math.abs((ds.currentDepth ?? 0) - node.depth) <= 10) {
            targetDepth = node.depth;
            targetLane = node.lane;
          }
        }

        const targetX = laneToX(targetLane);
        const targetZ = depthToZ(targetDepth);
        const prevX = entry.mesh.position.x;
        const prevZ = entry.mesh.position.z;
        const stepX = (targetX - prevX) * 0.12;
        const stepZ = (targetZ - prevZ) * 0.12;
        entry.mesh.position.x += stepX;
        entry.mesh.position.z += stepZ;

        animateVillagerMesh(
          entry.mesh,
          phase,
          timeSec + idx * 0.7,
          state.attackPulses.get(v.id) || 0,
          state.hurtPulses.get(v.id) || 0,
          targetX - prevX,
          targetZ - prevZ,
        );

        if (phase === "fighting") {
          focusVillagerZ = entry.mesh.position.z;
          hasFightingVillager = true;
        } else if (!hasFightingVillager && focusVillagerZ === null) {
          focusVillagerZ = entry.mesh.position.z;
        }
      });

      // カメラ位置計算
      if (curCamMode === "auto") {
        if (curBoss && curArea.monsters.some((m) => m.id === curBoss.monsterId)) {
          state.targetCamZ = depthToZ(maxDepth);
        } else if (focusVillagerZ !== null) {
          state.targetCamZ = focusVillagerZ;
        } else {
          state.targetCamZ = depthToZ(Math.max(10, getExploredDepth(curArea) * 0.6));
        }
        state.panX += (0 - state.panX) * 0.1;
      } else {
        state.manualOffsetZ = Math.max(minZ, Math.min(maxZ, state.manualOffsetZ));
        state.targetCamZ = state.manualOffsetZ;
      }

      state.currentCamZ += (state.targetCamZ - state.currentCamZ) * 0.08;

      if (curCamView === "side") {
        camera.position.set(11 + state.panX, 5.2, state.currentCamZ + 2);
        camera.lookAt(0, 1.0, state.currentCamZ - 2);
      } else if (curCamView === "follow") {
        camera.position.set(state.panX, 3.8, state.currentCamZ + 7.5);
        camera.lookAt(state.panX * 0.5, 1.2, state.currentCamZ - 6);
      } else {
        // quarter (斜め俯瞰)
        camera.position.set(4.5 + state.panX, 7.2, state.currentCamZ + 10.5);
        camera.lookAt(state.panX * 0.4, 0.8, state.currentCamZ - 4.5);
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
