import { Terminal } from "lucide-react";
import React from "react";

import { useDungeons, useInventory, useLogs, useVillagers } from "../../hooks";
import { getDailyFoodConsumption, getFoodDaysRemaining } from "../../utils/economyHelpers";
import { getLogColorClass } from "../../utils/logHelpers";

interface StatusBarProps {
  onOpenLogHistory?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onOpenLogHistory }) => {
  const villagers = useVillagers();
  const { currentTier } = useDungeons();
  const { inventory } = useInventory();
  const logs = useLogs();

  const avgLevel =
    villagers.length > 0
      ? (villagers.reduce((sum, v) => sum + v.level, 0) / villagers.length).toFixed(1)
      : "0.0";

  const tierNames = ["", "始まりの森", "廃鉱山", "魔獣の谷", "世界樹の根", "深淵の奈落"];

  const dailyConsumption = getDailyFoodConsumption(villagers.length);
  const foodDays = getFoodDaysRemaining(inventory, villagers.length);

  // P0-1: 最新の 3 件のログを結合表示
  const recentLogs = logs.slice(-3);
  const hasLogs = recentLogs.length > 0;

  return (
    <div className="bg-slate-900/60 border-b border-slate-800 shrink-0 select-none overflow-x-auto no-scrollbar">
      {/* Row 1: 村人 / 平均Lv / 食料 / 進行度 */}
      <div className="px-6 py-1 flex items-center gap-5 text-[10px] text-slate-400">
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
          <span className="text-slate-500">食料</span>
          {/* P0-3: 食料日数 < 2 のときパルス点滅 */}
          <span
            className={`font-bold font-mono ${
              foodDays < 2
                ? "text-red-400 animate-pulse-slow"
                : foodDays < 3
                  ? "text-red-400"
                  : "text-emerald-400"
            }`}
          >
            {foodDays}日分
          </span>
          <span className="text-slate-600 text-[9px]">(-{dailyConsumption}/日)</span>
        </span>
      </div>

      {/* Row 2: 地域 / ログ */}
      <div className="px-6 py-1 flex items-center gap-5 text-[10px] text-slate-400 border-t border-slate-800/50">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-500">地域</span>
          <span className="text-indigo-400 font-bold">
            {tierNames[currentTier] || `Tier ${currentTier}`}
          </span>
        </span>

        {onOpenLogHistory && (
          <>
            <span className="w-px h-3 bg-slate-800 shrink-0" />
            <button
              type="button"
              onClick={onOpenLogHistory}
              title={
                hasLogs
                  ? recentLogs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n")
                  : "ログ履歴を開く (L キー)"
              }
              className="flex items-start gap-1.5 flex-1 min-w-0 hover:bg-slate-800/40 rounded px-1 py-0.5 transition cursor-pointer text-left"
            >
              <Terminal className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
              <span className="text-slate-500 shrink-0 mt-0.5">ログ:</span>
              {hasLogs ? (
                <span className="flex flex-col gap-0.5 font-mono min-w-0 flex-1">
                  {recentLogs.slice(-2).map((log) => (
                    <span
                      key={log.id}
                      className={`${getLogColorClass(log.type)} break-words leading-tight`}
                    >
                      {log.message}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-slate-600 italic">なし</span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
