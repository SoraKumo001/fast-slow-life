import { Camera, Compass, Eye } from "lucide-react";
import React, { useState } from "react";

import { getVillagerPhaseLabel } from "../../store/dungeonSpatialHelper";
import { useGameStore } from "../../store/gameStore";
import type { ActiveBossState, DungeonArea, DungeonVisualEvent, Villager } from "../../types/game";
import { DungeonDepthMinimap } from "../three/DungeonDepthMinimap";
import { CameraViewAngle, DungeonThreeViewport } from "../three/DungeonThreeViewport";
import { Modal } from "../ui/Modal";

interface DungeonFullViewModalProps {
  area: DungeonArea;
  villagers: Villager[];
  activeBoss: ActiveBossState | null;
  dungeonEvents: DungeonVisualEvent[];
  onClose: () => void;
}

export const DungeonFullViewModal: React.FC<DungeonFullViewModalProps> = ({
  area,
  villagers,
  activeBoss,
  dungeonEvents,
  onClose,
}) => {
  const [cameraMode, setCameraMode] = useState<"auto" | "free">("auto");
  const [cameraView, setCameraView] = useState<CameraViewAngle>("quarter");
  const [focusDepth, setFocusDepth] = useState<number | null>(null);
  const revealedNodeIds = useGameStore((s) => s.revealedNodes[area.id]);

  const handleSelectDepth = (depth: number) => {
    setCameraMode("free");
    setFocusDepth(depth);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      showCloseButton
      title={
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-slate-100">{area.name} — 3Dライブビュー</span>
          <span className="text-xs font-mono text-sky-400 ml-2">
            探索度 {Math.floor(area.explorationProgress)}%
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        {/* コントロールバー */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px] mr-1">視点:</span>
            {(
              [
                ["quarter", "斜め俯瞰"],
                ["follow", "後方追従"],
                ["side", "サイドビュー"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCameraView(key)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                  cameraView === key
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setCameraMode(cameraMode === "auto" ? "free" : "auto")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                cameraMode === "auto"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              {cameraMode === "auto" ? "自動追尾 ON" : "フリーカメラ"}
            </button>
          </div>
        </div>

        {/* 大型 3D ビューポート */}
        <DungeonThreeViewport
          area={area}
          villagers={villagers}
          activeBoss={activeBoss}
          dungeonEvents={dungeonEvents}
          cameraMode={cameraMode}
          cameraView={cameraView}
          focusDepth={focusDepth}
          heightClass="h-[420px]"
          revealedNodeIds={revealedNodeIds}
        />

        {/* 深度ミニマップ */}
        <DungeonDepthMinimap
          area={area}
          villagers={villagers}
          onSelectDepth={handleSelectDepth}
          revealedNodeIds={revealedNodeIds}
        />

        {/* 派遣中キャラクターの現在位置リスト */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
          <p className="text-[10px] font-bold text-slate-400 mb-1.5">
            エリア内の冒険者 ({villagers.length}名)
          </p>
          {villagers.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              現在このダンジョンに派遣中の村人はいません。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {villagers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectDepth(v.dungeonState?.currentDepth ?? 0)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-left transition"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-200">{v.name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">({v.currentJob})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-sky-400">
                      {getVillagerPhaseLabel(v)}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500">
                      HP {v.currentHp}/{v.maxHp}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
