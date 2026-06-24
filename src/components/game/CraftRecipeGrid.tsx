import { Hammer } from "lucide-react";
import React from "react";

import { ITEMS, getRecipeForItem } from "../../data/masterData";
import type { FacilityType, Item, Villager } from "../../types/game";
import { getRecipeValueInfo } from "../../utils/economyHelpers";

interface CraftRecipeGridProps {
  facilityId: FacilityType;
  facilityLevel: number;
  inventory: Record<string, number>;
  gold: number;
  villagers: Villager[];
  craftableItems: Item[];
  isUnlocked: boolean;
  onStartCraft: (itemId: string, villagerId?: string) => void;
  onSelectItem: (item: Item) => void;
}

export const CraftRecipeGrid: React.FC<CraftRecipeGridProps> = ({
  craftableItems,
  isUnlocked,
  onSelectItem,
}) => {
  if (craftableItems.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Hammer className="w-3 h-3 text-sky-400" />
        {isUnlocked ? "生産レシピ (最大3枠)" : "解放される生産レシピ"}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {craftableItems.map((item) => {
          const recipe = getRecipeForItem(item.id)!;
          const valueInfo = getRecipeValueInfo(recipe);
          return (
            <div
              key={item.id}
              className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 flex flex-col gap-1"
            >
              <p
                className="text-xs font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(item);
                }}
              >
                {item.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                必要:{" "}
                {recipe.requiredItems.map((r, i) => (
                  <React.Fragment key={r.itemId}>
                    {i > 0 && <span>, </span>}
                    <span
                      className="text-sky-300 hover:text-sky-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const reqItem = ITEMS[r.itemId];
                        if (reqItem) onSelectItem(reqItem);
                      }}
                    >
                      {ITEMS[r.itemId]?.name}x{r.count}
                    </span>
                  </React.Fragment>
                ))}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                所要時間: {recipe.requiredTime}時間
                {valueInfo.valueAdd !== 0 && (
                  <span
                    className={`ml-1.5 font-bold ${valueInfo.valueAdd > 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {valueInfo.valueAdd > 0 ? "+" : ""}
                    {valueInfo.valueAdd}G ({valueInfo.valuePerHour >= 0 ? "+" : ""}
                    {valueInfo.valuePerHour}G/h)
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
