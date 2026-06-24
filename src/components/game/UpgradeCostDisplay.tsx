import React from "react";

import { ITEMS } from "../../data/masterData";

interface UpgradeCostDisplayProps {
  cost: { gold: number; materials: { itemId: string; count: number }[] };
  inventory: Record<string, number>;
  gold: number;
  isExpanded?: boolean;
}

export const UpgradeCostDisplay: React.FC<UpgradeCostDisplayProps> = ({
  cost,
  inventory,
  gold,
  isExpanded = false,
}) => {
  if (isExpanded) {
    return (
      <div className="text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/50 leading-relaxed">
        <span className="font-semibold text-slate-300">必要: </span>
        <span className={gold >= cost.gold ? "text-amber-400" : "text-red-400"}>{cost.gold} G</span>
        {cost.materials.map((m) => {
          const current = Math.floor(inventory[m.itemId] || 0);
          return (
            <span
              key={m.itemId}
              className={`ml-2 whitespace-nowrap ${current >= m.count ? "text-slate-300" : "text-red-400"}`}
            >
              {ITEMS[m.itemId].name}({current}/{m.count})
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <span className="text-slate-500 font-semibold">建設条件: </span>
      <span className={gold >= cost.gold ? "text-amber-400" : "text-red-400"}>{cost.gold}G</span>
      {cost.materials.map((m) => {
        const current = Math.floor(inventory[m.itemId] || 0);
        return (
          <span key={m.itemId} className={current >= m.count ? "text-slate-400" : "text-red-400"}>
            {ITEMS[m.itemId].name}({current}/{m.count})
          </span>
        );
      })}
    </>
  );
};
