import { Shield, Swords } from "lucide-react";
import React from "react";

import { useGameStore } from "../../store/gameStore";
import {
  countAliveRaidMonsters,
  getTotalElapsedHours,
  isRaidFighting,
} from "../../store/raidLogic";

/**
 * Phase 4b: 襲撃バナー（ActiveBossBar と同格）。
 * 進軍中は「◯◯の群れが接近中（到着まで X 時間）」、
 * 到着後は「防衛戦中： ◯◯の群れが町を襲っている」を表示する。
 */
export const RaidBanner: React.FC = () => {
  const raid = useGameStore((s) => s.raid);
  const dungeons = useGameStore((s) => s.dungeons);
  const currentDay = useGameStore((s) => s.currentDay);
  const currentHour = useGameStore((s) => s.currentHour);

  if (!raid) return null;

  const dungeon = dungeons.find((d) => d.id === raid.dungeonId);
  const dungeonName = dungeon?.name ?? "ダンジョン";
  const now = getTotalElapsedHours(currentDay, currentHour);
  const fighting = isRaidFighting(raid, now);

  if (!fighting) {
    const hoursLeft = Math.max(0, raid.arrivesAtElapsedHour - now);
    return (
      <div className="bg-amber-950/30 border-b border-amber-900/50 shrink-0">
        <div className="px-6 py-2 flex items-center gap-3">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest shrink-0">
            RAID INCOMING
          </span>
          <span className="text-sm font-bold text-amber-100 truncate">
            {dungeonName}の群れが接近中（到着まで {hoursLeft} 時間）
          </span>
          <span className="text-[11px] font-mono text-amber-400/80 shrink-0 ml-auto">
            魔物 {raid.monsterIds.length} 体
          </span>
        </div>
      </div>
    );
  }

  const aliveCount = dungeon ? countAliveRaidMonsters(raid, dungeon) : raid.monsterIds.length;

  return (
    <div className="bg-red-950/30 border-b border-red-900/50 shrink-0 animate-pulse-slow">
      <div className="px-6 py-2 flex items-center gap-3">
        <Swords className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest shrink-0">
          DEFENCE BATTLE
        </span>
        <span className="text-sm font-bold text-red-100 truncate">
          防衛戦中： {dungeonName}の群れが町を襲っている
        </span>
        <span className="text-[11px] font-mono text-red-400/80 shrink-0 ml-auto">
          残り {aliveCount} / {raid.monsterIds.length} 体
        </span>
      </div>
    </div>
  );
};
