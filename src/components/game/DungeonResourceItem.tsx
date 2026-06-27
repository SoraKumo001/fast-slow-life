import React from "react";

import { RespawnBar } from "./RespawnBar";

interface DungeonResourceItemProps {
  keyId: string;
  isUnlocked: boolean;
  unlockedAtProgress: number;
  name: string;
  progress: number;
  respawnTimeLeft?: number;
  respawnTimeTotal?: number;
  gaugeColor: "emerald" | "sky";
  showProgress?: boolean;
  className?: string;
  extraContent?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
}

export const DungeonResourceItem: React.FC<DungeonResourceItemProps> = ({
  keyId,
  isUnlocked,
  unlockedAtProgress,
  name,
  progress,
  respawnTimeLeft,
  respawnTimeTotal,
  gaugeColor,
  showProgress = true,
  className = "",
  extraContent,
  tooltip,
  onClick,
}) => {
  const gaugeBg = gaugeColor === "emerald" ? "bg-emerald-500/15" : "bg-sky-500/15";
  const labelColor = gaugeColor === "emerald" ? "text-emerald-400" : "text-sky-400";
  const isRespawning = !!(respawnTimeLeft && respawnTimeLeft > 0);

  return (
    <li
      key={keyId}
      onClick={(e) => {
        if (isUnlocked && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`relative flex items-center justify-between p-1 px-2 rounded bg-slate-950/40 border border-slate-900/50 overflow-hidden min-w-0 h-7 ${className} ${
        isUnlocked ? "" : "text-slate-600 font-normal"
      } ${isUnlocked && onClick ? "cursor-pointer hover:border-slate-700/80 hover:text-sky-300 transition duration-150" : ""}`}
      title={tooltip}
    >
      {isUnlocked && !isRespawning && (
        <div
          className={`absolute left-0 top-0 bottom-0 transition-all duration-300 pointer-events-none ${gaugeBg}`}
          style={{ width: `${progress || 0}%` }}
        />
      )}
      {isUnlocked && isRespawning ? (
        <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
      ) : null}

      <span className="z-10 truncate whitespace-nowrap text-[10px]">
        • {isUnlocked ? name : `??? (${unlockedAtProgress}%で解放)`}
      </span>

      {extraContent}

      {isUnlocked && showProgress && (
        <div className="z-10 flex items-center shrink-0 font-mono text-[8px] font-bold ml-1">
          {isRespawning ? (
            <RespawnBar timeLeft={respawnTimeLeft!} timeTotal={respawnTimeTotal} />
          ) : (
            <span className={labelColor}>{Math.floor(progress || 0)}%</span>
          )}
        </div>
      )}
    </li>
  );
};
