import React from "react";

import { TIER_LIMIT_DAYS } from "../../constants";
import {
  useBankruptcyWarning,
  useDungeons,
  useGameStatus,
  useGameTime,
  usePlayerResources,
  useVillagers,
} from "../../hooks";
import { ProgressBar } from "../ui/ProgressBar";

export const StatusBar: React.FC = () => {
  const { currentDay } = useGameTime();
  const { gameLimitDays } = useGameStatus();
  const { gold } = usePlayerResources();
  const { consecutiveNegativeGoldDays } = useBankruptcyWarning();
  const villagers = useVillagers();
  const { currentTier, bossDefeated } = useDungeons();

  const avgLevel =
    villagers.length > 0
      ? (villagers.reduce((sum, v) => sum + v.level, 0) / villagers.length).toFixed(1)
      : "0.0";

  const daysElapsed = currentDay;
  const limitDays = TIER_LIMIT_DAYS[currentTier] || gameLimitDays;
  const progressPct = Math.min(100, Math.round((daysElapsed / limitDays) * 100));

  const tierNames = ["", "始まりの森", "廃鉱山", "魔獣の谷", "世界樹の根", "深淵の奈落"];

  return (
    <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-1.5 flex items-center gap-5 text-[10px] text-slate-400 shrink-0 select-none overflow-x-auto no-scrollbar">
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">村人</span>
        <span className="text-sky-400 font-bold font-mono">{villagers.length}/10</span>
      </span>

      <span className="w-px h-3 bg-slate-800 shrink-0" />

      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">平均Lv</span>
        <span className="text-amber-400 font-bold font-mono">{avgLevel}</span>
      </span>

      <span className="w-px h-3 bg-slate-800 shrink-0" />

      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">資産</span>
        <span className={`font-bold font-mono ${gold < 0 ? "text-red-400" : "text-amber-400"}`}>
          {Math.floor(gold).toLocaleString()} G
        </span>
        {gold < 0 && (
          <span className="text-red-400 font-bold font-mono ml-1">
            (破産まであと{3 - consecutiveNegativeGoldDays}日)
          </span>
        )}
      </span>

      <span className="w-px h-3 bg-slate-800 shrink-0" />

      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">進行度</span>
        <div className="w-16">
          <ProgressBar
            value={progressPct}
            height={1.5}
            color={bossDefeated ? "emerald" : "sky"}
            className="border border-slate-900"
          />
        </div>
        <span
          className={`font-mono font-bold ${bossDefeated ? "text-emerald-400" : "text-sky-400"}`}
        >
          {progressPct}%
        </span>
      </span>

      <span className="w-px h-3 bg-slate-800 shrink-0" />

      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-500">地域</span>
        <span className="text-indigo-400 font-bold">
          {tierNames[currentTier] || `Tier ${currentTier}`}
        </span>
      </span>

      <span className="w-px h-3 bg-slate-800 shrink-0" />

      <span
        className={`flex items-center gap-1.5 shrink-0 ${bossDefeated ? "text-emerald-500" : "text-red-400"}`}
      >
        <span className="text-slate-500">期限</span>
        <span className="font-bold font-mono">残り{Math.max(0, limitDays - daysElapsed)}日</span>
      </span>
    </div>
  );
};
