import React from "react";

interface RespawnBarProps {
  timeLeft: number;
  timeTotal?: number;
}

export const RespawnBar: React.FC<RespawnBarProps> = ({ timeLeft, timeTotal }) => {
  const total = timeTotal || timeLeft;
  const pct = total > 0 ? (1 - timeLeft / total) * 100 : 0;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`リスポーン残り ${timeLeft}h / ${total}h`}
    >
      <span className="w-8 bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-900">
        <span className="block bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-amber-500">{timeLeft}h</span>
    </span>
  );
};
