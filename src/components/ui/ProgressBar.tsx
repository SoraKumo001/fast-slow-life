import React from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: 1 | 1.5 | 3;
  color?: "red" | "amber" | "sky" | "emerald";
  className?: string;
}

const colorMap: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 1,
  color = "sky",
  className = "",
}) => {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const h = `h-${height === 3 ? "3" : height === 1.5 ? "1.5" : "1"}`;
  return (
    <div className={`w-full bg-slate-900 rounded-full ${h} overflow-hidden ${className}`}>
      <div
        className={`${colorMap[color]} ${h} rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
