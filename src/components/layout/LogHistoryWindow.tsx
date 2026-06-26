import { Terminal } from "lucide-react";
import React, { useState } from "react";

import { GameLog } from "../../types/game";
import { getLogColorClass } from "../../utils/logHelpers";
import { Button } from "../ui/Button";
import { DraggableWindow } from "../ui/DraggableWindow";

interface LogHistoryWindowProps {
  logs: GameLog[];
  onClose: () => void;
}

const FILTER_TYPES = ["all", "combat", "gather", "craft", "upgrade", "system"] as const;

const FILTER_LABELS: Record<string, string> = {
  all: "すべて",
  combat: "戦闘",
  gather: "採取",
  craft: "加工",
  upgrade: "施設",
  system: "システム",
};

export const LogHistoryWindow: React.FC<LogHistoryWindowProps> = ({ logs, onClose }) => {
  const [filter, setFilter] = useState<GameLog["type"] | "all">("all");

  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.type === filter);

  return (
    <DraggableWindow
      onClose={onClose}
      title={
        <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-200">
          <Terminal className="w-4 h-4 text-sky-400" />
          過去のログ履歴 (ドラッグ移動可能)
        </span>
      }
      widthClass="w-[90vw] md:w-[576px]"
      maxHeightClass="max-h-[75vh]"
    >
      <div className="space-y-4 flex flex-col flex-1 min-h-0 mt-4">
        <div className="flex flex-wrap gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 self-start">
          {FILTER_TYPES.map((type) => (
            <Button
              key={type}
              onClick={() => setFilter(type)}
              variant="custom"
              size="custom"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                filter === type
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "text-slate-400 border border-transparent hover:text-slate-200"
              }`}
            >
              {FILTER_LABELS[type]}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed min-h-[300px] max-h-[45vh] select-text">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-500 text-center py-10 italic">該当するログはありません</p>
          ) : (
            filteredLogs.map((log) => (
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
          <Button onClick={onClose} variant="secondary" size="md">
            閉じる
          </Button>
        </div>
      </div>
    </DraggableWindow>
  );
};
