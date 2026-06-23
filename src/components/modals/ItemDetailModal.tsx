import { Target } from "lucide-react";
import React, { useEffect, useState } from "react";

import { ITEMS, RECIPES, getRecipeForItem } from "../../data/masterData";
import { useGameStore } from "../../store/gameStore";
import type { CraftRecipe, Item } from "../../types/game";
import { getEffectiveExportPrice } from "../../utils/economyHelpers";
import { getCategoryBadgeColor, getCategoryLabel } from "../../utils/itemHelpers";
import { getMarketSellBonus } from "../../utils/marketHelpers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface ItemDetailModalProps {
  item: Item;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item: initialItem, onClose }) => {
  const [item, setItem] = useState<Item>(initialItem);

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  const state = useGameStore();
  const {
    inventory,
    targetAmounts,
    tradeRules,
    towns,
    facilities,
    marketTrend,
    setTargetAmount,
    addTradeRule,
    deleteTradeRule,
    toggleTradeRule,
  } = state;

  const [autoSellThreshold, setAutoSellThreshold] = useState<number>(10);

  const currentRule = (tradeRules || []).find((r) => r.itemId === item.id && r.type === "sell");

  const marketLevel = facilities.market?.level || 0;
  const isSellable = marketLevel > 0;

  // コモレビの村を基準とした自動取引の見込み価格計算
  const marketBonus = getMarketSellBonus(marketLevel);
  const komorebi = towns.find((t) => t.id === "komorebi");
  const friendshipBonus = komorebi ? (komorebi.level - 1) * 0.05 : 0;
  const autoSellPrice = Math.floor(item.basePrice * (1 + marketBonus + friendshipBonus));

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
            <span className="text-slate-500">基本価格:</span>
            <div className="text-right">
              <span className="text-amber-400 font-bold">{item.basePrice} G</span>
            </div>
          </div>

          {/* 街別輸出価格 */}
          {isSellable && (
            <div className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-1.5">
              <span className="font-semibold text-slate-400 block text-[10px]">
                輸出価格 (街別):
              </span>
              <div className="space-y-1">
                {towns
                  .filter((t) => t.isUnlocked)
                  .map((t) => {
                    const info = getEffectiveExportPrice(item.id, t, marketLevel, marketTrend);
                    if (info.price <= 0) return null;
                    const bonusStr = [
                      info.isTrend && `需要×${info.trendMultiplier}`,
                      info.friendshipBonus > 0 && `友好+${Math.round(info.friendshipBonus * 100)}%`,
                      info.marketBonus > 0 && `市場+${Math.round(info.marketBonus * 100)}%`,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <div
                        key={t.id}
                        className={`flex justify-between text-[11px] font-mono py-0.5 px-1 rounded ${info.isTrend ? "bg-amber-950/20" : ""}`}
                      >
                        <span className="text-slate-400">{t.name}</span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${info.isTrend ? "text-yellow-400" : "text-amber-400"}`}
                          >
                            {info.price} G
                          </span>
                          {bonusStr && (
                            <span className="text-[9px] text-slate-500">({bonusStr})</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 食料Buff */}
          {item.category === "food" &&
            item.foodBuff &&
            Object.values(item.foodBuff).some((v) => v) && (
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
                  {recipe.requiredItems.map((req: { itemId: string; count: number }) => {
                    const reqItem = ITEMS[req.itemId];
                    return (
                      <p key={req.itemId}>
                        •{" "}
                        {reqItem ? (
                          <span
                            onClick={() => setItem(reqItem)}
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
          {getUsageRecipes(item.id).length > 0 && (
            <div>
              <span className="font-semibold text-slate-500 block mb-1">
                主な使い道 (クラフト材料):
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {getUsageRecipes(item.id).map((r) => (
                  <Badge
                    key={r.id}
                    variant="default"
                    className="hover:bg-slate-800 hover:text-sky-400 border border-transparent hover:border-sky-500/20 cursor-pointer transition"
                    onClick={() => setItem(r)}
                  >
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 自動交易設定セクション */}
        {isSellable ? (
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                自動交易（売却）設定
              </span>
            </div>

            {currentRule ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 leading-normal">
                    所持数 <strong className="text-amber-500">{currentRule.threshold}</strong>{" "}
                    個超過時、自動で交易馬車へ
                    <br />
                    <span className="text-[10px] text-slate-400">
                      (コモレビ村への輸出目安:{" "}
                      <strong className="text-amber-500 font-bold">{autoSellPrice} G</strong> / 個)
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      currentRule.isEnabled
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}
                  >
                    {currentRule.isEnabled ? "有効中" : "無効化中"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => toggleTradeRule(currentRule.id)}
                    variant={currentRule.isEnabled ? "secondary" : "custom"}
                    size="sm"
                    className={
                      currentRule.isEnabled
                        ? "flex-1 font-bold"
                        : "bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-400 font-bold flex-1"
                    }
                  >
                    {currentRule.isEnabled ? "一時無効" : "有効化"}
                  </Button>
                  <Button
                    onClick={() => deleteTradeRule(currentRule.id)}
                    variant="danger"
                    size="sm"
                    className="flex-1 font-bold"
                  >
                    設定削除
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <label className="text-xs text-slate-400">
                    閾値 (この個数を超過時に交易に出す):
                  </label>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      value={autoSellThreshold}
                      onChange={(e) =>
                        setAutoSellThreshold(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="w-16 bg-transparent text-xs font-mono text-right text-amber-500 font-bold focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">個</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    addTradeRule(item.id, "sell", autoSellThreshold);
                  }}
                  variant="custom"
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <span>自動交易を設定する</span>
                  <span className="text-[11px] text-amber-300 font-mono">
                    (目安: {autoSellPrice} G)
                  </span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 text-center py-2 border border-slate-850 bg-slate-950/20 rounded">
            交易所が建設された後、自動交易売却を設定できます。
          </div>
        )}
      </div>
    </Modal>
  );
};
