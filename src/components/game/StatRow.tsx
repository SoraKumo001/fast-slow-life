import React from "react";

import { Tooltip } from "../ui/Tooltip";

interface StatRowProps {
  label: string;
  base: number;
  bonus: number;
  buff: number;
  debuff: number;
  tooltipContent?: string;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  base,
  bonus,
  buff,
  debuff,
  tooltipContent,
}) => {
  return (
    <p>
      {tooltipContent ? (
        <Tooltip content={tooltipContent}>
          <span className="border-b border-dotted border-slate-600">{label}</span>
        </Tooltip>
      ) : (
        label
      )}
      : <span className="text-slate-200 font-bold">{base}</span>
      {bonus > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{bonus}</span>}
      {buff > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buff}</span>}
      {debuff > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuff}</span>}
    </p>
  );
};
