import React from "react";

interface ThreatGaugeProps {
  threatLevel: number;
  maxThreat?: number;
  className?: string;
  showLabel?: boolean;
}

const getThreatColor = (pct: number): string => {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 75) return "bg-orange-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-yellow-500";
  return "bg-emerald-500";
};

const getThreatTextColor = (pct: number): string => {
  if (pct >= 100) return "text-red-400";
  if (pct >= 75) return "text-orange-400";
  if (pct >= 50) return "text-amber-400";
  if (pct >= 25) return "text-yellow-400";
  return "text-emerald-400";
};

export const ThreatGauge: React.FC<ThreatGaugeProps> = ({
  threatLevel,
  maxThreat = 100,
  className = "",
  showLabel = true,
}) => {
  const pct = Math.min(100, (threatLevel / maxThreat) * 100);
  const color = getThreatColor(pct);
  const textColor = getThreatTextColor(pct);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className={`text-[10px] font-bold font-mono ${textColor} shrink-0`}>
          脅威度 {Math.floor(threatLevel)}%
        </span>
      )}
      <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
