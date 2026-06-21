import { Terminal, X } from "lucide-react";
import React, { useState } from "react";

import { useLogs } from "../../hooks";
import { GameLog } from "../../types/game";

export const FooterLogTicker: React.FC = () => {
  const logs = useLogs();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [filter, setFilter] = useState<GameLog["type"] | "all">("all");

  // 直近8件のログを縦並びで表示
  const recentLogs = logs.slice(0, 8);

  const getLogColorClass = (type: GameLog["type"]) => {
    switch (type) {
      case "combat":
        return "text-red-400";
      case "gather":
        return "text-emerald-400";
      case "craft":
        return "text-sky-400";
      case "upgrade":
        return "text-amber-400";
      case "system":
        return "text-purple-400 font-bold";
      case "warning":
        return "text-yellow-400 font-semibold";
      case "error":
        return "text-red-500 font-bold";
      default:
        return "text-slate-300";
    }
  };

  const filteredHistoryLogs = filter === "all" ? logs : logs.filter((log) => log.type === filter);

  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-xs px-6 py-3 flex items-start justify-between gap-4 select-none shrink-0 sticky bottom-0 z-20">
      {/* 複数行ログ表示エリア */}
      <div className="flex-1 min-w-0 font-mono flex items-start gap-2">
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-950 text-sky-400 tracking-wider shrink-0 mt-0.5">
          LOG
        </span>

        {recentLogs.length === 0 ? (
          <span className="text-slate-500 italic text-[11px]">活動ログはありません</span>
        ) : (
          <div className="flex-1 flex flex-col gap-1.5 text-[11px] h-20 overflow-y-auto pr-1 no-scrollbar">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 font-semibold shrink-0">[{log.timestamp}]</span>
                <span className={`${getLogColorClass(log.type)} break-all`}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 履歴表示ボタン */}
      <button
        onClick={() => setShowHistoryModal(true)}
        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded border border-slate-700 hover:border-slate-600 transition shrink-0 cursor-pointer mt-0.5"
      >
        ログ履歴
      </button>

      {/* ログ履歴ポップアップモーダル */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4 relative flex flex-col max-h-[90vh]">
            {/* モーダルヘッダー */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-sky-400" />
                過去のログ履歴
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-500 hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* カテゴリフィルター */}
            <div className="flex flex-wrap gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 self-start">
              {(["all", "combat", "gather", "craft", "upgrade", "system"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                    filter === type
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      : "text-slate-400 border border-transparent hover:text-slate-200"
                  }`}
                >
                  {type === "all"
                    ? "すべて"
                    : type === "combat"
                      ? "戦闘"
                      : type === "gather"
                        ? "採取"
                        : type === "craft"
                          ? "加工"
                          : type === "upgrade"
                            ? "施設"
                            : "システム"}
                </button>
              ))}
            </div>

            {/* スクロール可能な履歴 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed min-h-[350px] max-h-[60vh]">
              {filteredHistoryLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-10 italic">該当するログはありません</p>
              ) : (
                filteredHistoryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 hover:bg-slate-950/40 py-0.5 rounded px-1"
                  >
                    <span className="text-slate-500 font-bold shrink-0">{log.timestamp}</span>
                    <span className={`wrap-break-word ${getLogColorClass(log.type)}`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition font-semibold"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
