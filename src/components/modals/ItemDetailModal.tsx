import { Target } from "lucide-react";
import React, { useState, useEffect } from "react";

import { ITEMS, RECIPES, getRecipeForItem } from "../../data/masterData";
import { useInventory, useFacilities, useInventoryActions } from "../../hooks";
import { Item, CraftRecipe } from "../../types/game";
import { getCategoryBadgeColor, getCategoryLabel } from "../../utils/itemHelpers";
import { getSellBonus } from "../../utils/marketHelpers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface ItemDetailModalProps {
  item: Item;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose }) => {
  const { inventory, targetAmounts } = useInventory();
  const facilities = useFacilities();
  const { setTargetAmount, sellItem } = useInventoryActions();

  const maxAmount = Math.floor(inventory[item.id] || 0);
  const [sellAmount, setSellAmount] = useState<number>(1);
  const bonusRate = getSellBonus(item.category, facilities);

  // maxAmount の変化に応じて sellAmount を自動調整する
  useEffect(() => {
    if (maxAmount === 0) {
      setSellAmount(0);
    } else {
      setSellAmount((prev) => {
        if (prev === 0) return 1;
        return Math.min(prev, maxAmount);
      });
    }
  }, [maxAmount]);

  const marketLevel = facilities.market.level;
  const weaponShopLevel = facilities.weapon_shop?.level || 0;
  const pharmacyLevel = facilities.pharmacy?.level || 0;

  const isGear = item.category === "gear_weapon" || item.category === "gear_armor";
  const isConsumable = item.category === "consumable";

  const isSellable =
    marketLevel > 0 || (isGear && weaponShopLevel > 0) || (isConsumable && pharmacyLevel > 0);

  const shopLabel =
    isGear && weaponShopLevel > 0
      ? "武器屋"
      : isConsumable && pharmacyLevel > 0
        ? "薬屋"
        : marketLevel > 0
          ? "交易所"
          : "売却";

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

  return (
    <Modal onClose={onClose} size="sm" showCloseButton>
      <div className="space-y-4 relative">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-slate-100">{item.name}</h3>
            <Badge variant="custom" className={getCategoryBadgeColor(item.category)}>
              {getCategoryLabel(item.category)}
            </Badge>
          </div>
          {item.description && (
            <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2.5 rounded border border-slate-850">
              {item.description}
            </p>
          )}
        </div>

        {/* 所持数 & 目標設定セクション */}
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">現在の所持数:</span>
            <span className="text-slate-100 font-bold font-mono text-sm">
              {Math.floor(inventory[item.id] || 0)} 個
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-900 pt-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-sky-400" /> 自動生産目標数:
              </span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-1">
                <input
                  type="number"
                  value={targetAmounts[item.id] === 0 ? "" : targetAmounts[item.id]}
                  onChange={(e) => setTargetAmount(item.id, parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 bg-transparent text-xs font-mono text-right text-sky-400 font-bold focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-mono">個</span>
              </div>
            </div>
            {/* 目標数調整ボタン */}
            <div className="flex gap-1.5 justify-end">
              <Button onClick={() => setTargetAmount(item.id, 0)} variant="secondary" size="xs">
                リセット
              </Button>
              <Button
                onClick={() => {
                  const cur = targetAmounts[item.id] || 0;
                  setTargetAmount(item.id, cur + 1);
                }}
                variant="custom"
                size="xs"
                className="bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 font-bold"
              >
                +1
              </Button>
              <Button
                onClick={() => {
                  const cur = targetAmounts[item.id] || 0;
                  setTargetAmount(item.id, cur + 10);
                }}
                variant="custom"
                size="xs"
                className="bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 font-bold"
              >
                +10
              </Button>
              <Button
                onClick={() => {
                  const cur = targetAmounts[item.id] || 0;
                  setTargetAmount(item.id, cur + 100);
                }}
                variant="custom"
                size="xs"
                className="bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 font-bold"
              >
                +100
              </Button>
            </div>
          </div>
        </div>

        {/* 価格・用途情報 */}
        <div className="space-y-2.5 text-xs border-t border-slate-800 pt-3.5">
          <div className="flex justify-between font-mono">
            <span className="text-slate-500">売却価格 ({shopLabel}):</span>
            <div className="text-right">
              <span className="text-amber-400 font-bold">{item.sellPrice} G</span>
              {bonusRate > 0 && (
                <span className="text-emerald-400 font-bold ml-1.5 text-[10px]">
                  (+{Math.round(bonusRate * 100)}%ボーナス)
                </span>
              )}
            </div>
          </div>

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
                    <div
                      key={stat}
                      className="flex justify-between border-b border-slate-900 pb-0.5"
                    >
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
                  {recipe.requiredItems.map((req: { itemId: string; count: number }) => (
                    <p key={req.itemId}>
                      • {ITEMS[req.itemId]?.name} x {req.count}
                    </p>
                  ))}
                  <p className="text-slate-500 mt-1">所要時間: {recipe.requiredTime}時間</p>
                </div>
              </div>
            );
          })()}

          {/* 用途（逆引きレシピ） */}
          {getUsageRecipes(item.id).length > 0 && (
            <div>
              <span className="font-semibold text-slate-500 block mb-1">
                主な使い道 (クラフト材料):
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {getUsageRecipes(item.id).map((r) => (
                  <Badge key={r.id} variant="default">
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 交易所取引セクション */}
        {isSellable && (
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                取引 ({shopLabel})
              </span>
              <span className="text-xs font-mono text-slate-400">
                売却数: <span className="text-amber-400 font-bold">{sellAmount}</span> / {maxAmount}
              </span>
            </div>

            {/* スライダー */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={maxAmount > 0 ? 1 : 0}
                max={maxAmount}
                value={sellAmount}
                onChange={(e) => setSellAmount(Number(e.target.value))}
                disabled={maxAmount === 0}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* ショートカットと売却ボタン */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-900/60 pt-2">
              <div className="flex gap-1">
                <Button
                  onClick={() => setSellAmount(maxAmount > 0 ? 1 : 0)}
                  disabled={maxAmount === 0}
                  variant="secondary"
                  size="xs"
                >
                  1
                </Button>
                <Button
                  onClick={() => setSellAmount(Math.max(1, Math.floor(maxAmount / 2)))}
                  disabled={maxAmount < 2}
                  variant="secondary"
                  size="xs"
                >
                  1/2
                </Button>
                <Button
                  onClick={() => setSellAmount(maxAmount)}
                  disabled={maxAmount === 0}
                  variant="secondary"
                  size="xs"
                >
                  MAX
                </Button>
              </div>

              <Button
                onClick={() => {
                  sellItem(item.id, sellAmount);
                }}
                disabled={sellAmount <= 0}
                variant="warning"
                size="sm"
                className="flex items-center gap-1"
              >
                <span>売却</span>
                <span className="font-bold font-mono">
                  ({Math.floor(sellAmount * item.sellPrice * (1 + bonusRate))} G)
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
