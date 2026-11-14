import React from "react";

import { ITEMS } from "../../data/masterData";
import {
  getExploredDepth,
  getGatherDepth,
  getMonsterDepth,
} from "../../store/dungeonSpatialHelper";
import type { DungeonArea, Villager } from "../../types/game";

interface DungeonDepthMinimapProps {
  area: DungeonArea;
  villagers: Villager[];
  onSelectDepth: (depth: number) => void;
}

/**
 * 入口 (0m) 〜 最深部 (maxDepth) の位置関係・開拓前線・村人・魔物を1次元レーダー表示する。
 */
export const DungeonDepthMinimap: React.FC<DungeonDepthMinimapProps> = ({
  area,
  villagers,
  onSelectDepth,
}) => {
  const maxDepth = area.maxDepth || 100;
  const exploredDepth = getExploredDepth(area);
  const exploredPct = Math.min(100, Math.max(0, (exploredDepth / maxDepth) * 100));

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSelectDepth(Math.round(ratio * maxDepth));
  };

  return (
    <div className="space-y-1">
      <div
        onClick={handleBarClick}
        className="relative h-5 w-full rounded bg-slate-950 border border-slate-800 cursor-pointer overflow-hidden"
        title="クリックした深度へカメラを移動"
      >
        {/* 開拓済みエリア */}
        <div
          className="absolute inset-y-0 left-0 bg-sky-500/15 border-r border-sky-400/70 transition-all duration-300"
          style={{ width: `${exploredPct}%` }}
        />

        {/* 採取スポットピン (緑) */}
        {area.gathers.map((g) => {
          const unlocked = area.explorationProgress >= (g.unlockedAtProgress || 0);
          if (!unlocked) return null;
          const pct = Math.min(98, Math.max(2, (getGatherDepth(area, g) / maxDepth) * 100));
          const isRespawning = !!(g.respawnTimeLeft && g.respawnTimeLeft > 0);
          return (
            <div
              key={g.itemId}
              style={{ left: `${pct}%` }}
              title={`${ITEMS[g.itemId]?.name || g.itemId} (${getGatherDepth(area, g)}m)`}
              className={`absolute bottom-0.5 w-1.5 h-1.5 -translate-x-1/2 rounded-full ${
                isRespawning ? "bg-slate-600" : "bg-emerald-400"
              }`}
            />
          );
        })}

        {/* モンスターピン (赤/ボス金) */}
        {area.monsters.map((m) => {
          const unlocked = area.explorationProgress >= (m.unlockedAtProgress || 0);
          if (!unlocked) return null;
          const pct = Math.min(98, Math.max(2, (getMonsterDepth(area, m) / maxDepth) * 100));
          const isRespawning = !!(m.respawnTimeLeft && m.respawnTimeLeft > 0);
          return (
            <div
              key={m.id}
              style={{ left: `${pct}%` }}
              title={`${m.name} (${getMonsterDepth(area, m)}m)`}
              className={`absolute top-0.5 -translate-x-1/2 ${
                m.isBoss
                  ? "w-2 h-2 rotate-45 bg-amber-400 border border-amber-200"
                  : `w-1.5 h-1.5 rounded-full ${isRespawning ? "bg-slate-600" : "bg-red-400"}`
              }`}
            />
          );
        })}

        {/* 村人ピン */}
        {villagers.map((v) => {
          const depth = v.dungeonState?.currentDepth ?? 0;
          const pct = Math.min(98, Math.max(2, (depth / maxDepth) * 100));
          const isFighting = v.dungeonState?.phase === "fighting";
          return (
            <div
              key={v.id}
              style={{ left: `${pct}%` }}
              title={`${v.name} (${Math.round(depth)}m)`}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white shadow transition-all duration-300 ${
                isFighting ? "bg-amber-500 animate-pulse" : "bg-sky-400"
              }`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
        <span>入口 0m</span>
        <span className="text-sky-400/90">
          開拓前線 {exploredDepth}m / {maxDepth}m
        </span>
        <span>最深部 {maxDepth}m</span>
      </div>
    </div>
  );
};
