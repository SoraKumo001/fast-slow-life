import React from "react";

import { ITEMS, RECIPES, getRecipeForItem } from "../../data/masterData";
import type { CraftRecipe, Item } from "../../types/game";
import { Badge } from "../ui/Badge";

interface ItemRecipeInfoProps {
  item: Item;
  onSelectItem: (item: Item) => void;
}

export const ItemRecipeInfo: React.FC<ItemRecipeInfoProps> = ({ item, onSelectItem }) => {
  // このアイテムが使われるレシピを逆引き
  const getUsageRecipes = (itemId: string) => {
    return (Object.values(RECIPES) as CraftRecipe[])
      .filter((recipe: CraftRecipe) =>
        recipe.requiredItems.some(
          (req: { itemId: string; count: number }) => req.itemId === itemId,
        ),
      )
      .map((recipe: CraftRecipe) => ITEMS[recipe.resultItemId])
      .filter((i): i is Item => Boolean(i));
  };

  const usageRecipes = getUsageRecipes(item.id);

  return (
    <>
      {/* 食料Buff */}
      {item.category === "food" && item.foodBuff && Object.values(item.foodBuff).some((v) => v) && (
        <div className="bg-emerald-950/20 p-2.5 rounded border border-emerald-900/40 space-y-1">
          <span className="text-[10px] font-semibold text-emerald-400 block">
            配給効果 (1時間持続):
          </span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono text-emerald-300">
            {Object.entries(item.foodBuff).map(([stat, val]) => {
              if (!val) return null;
              const labelMap: Record<string, string> = {
                str: "STR",
                int: "INT",
                dex: "DEX",
                agi: "AGI",
                vit: "VIT",
                maxHp: "最大HP",
                maxStamina: "最大ｽﾀﾐﾅ",
              };
              return (
                <span key={stat}>
                  {labelMap[stat] || stat}: <span className="font-bold">+{val}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 装備性能 */}
      {item.equipment && (
        <div className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-1">
          <span className="font-semibold text-slate-400 block mb-1">装備性能:</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300 font-mono text-[11px]">
            {Object.entries(item.equipment.bonuses).map(([stat, val]) => {
              if (val === undefined || val === 0) return null;
              const labelMap: Record<string, string> = {
                attack: "攻撃力 (ATK)",
                defense: "防御力 (DEF)",
                str: "STR (腕力)",
                int: "INT (魔力)",
                dex: "DEX (器用)",
                agi: "AGI (敏捷)",
                vit: "VIT (耐久)",
              };
              const label = labelMap[stat] || stat.toUpperCase();
              return (
                <div key={stat} className="flex justify-between border-b border-slate-900 pb-0.5">
                  <span className="text-slate-500">{label}:</span>
                  <span className="text-emerald-400 font-bold">+{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(() => {
        const recipe = getRecipeForItem(item.id) as CraftRecipe | undefined;
        if (!recipe) return null;
        return (
          <div className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-1">
            <span className="font-semibold text-slate-400 block mb-1">クラフトレシピ:</span>
            <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
              {recipe.requiredItems.map((req: { itemId: string; count: number }) => {
                const reqItem = ITEMS[req.itemId];
                return (
                  <p key={req.itemId}>
                    •{" "}
                    {reqItem ? (
                      <span
                        onClick={() => onSelectItem(reqItem)}
                        className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer font-bold"
                      >
                        {reqItem.name}
                      </span>
                    ) : (
                      req.itemId
                    )}{" "}
                    x {req.count}
                  </p>
                );
              })}
              <p className="text-slate-500 mt-1">所要時間: {recipe.requiredTime}時間</p>
            </div>
          </div>
        );
      })()}

      {/* 用途（逆引きレシピ） */}
      {usageRecipes.length > 0 && (
        <div>
          <span className="font-semibold text-slate-500 block mb-1">
            主な使い道 (クラフト材料):
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {usageRecipes.map((r) => (
              <Badge
                key={r.id}
                variant="default"
                className="hover:bg-slate-800 hover:text-sky-400 border border-transparent hover:border-sky-500/20 cursor-pointer transition"
                onClick={() => onSelectItem(r)}
              >
                {r.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
