import { ShoppingBag, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { ITEMS, RECIPES } from "../../data/masterData";
import { useDungeons, useFacilities, useInventory } from "../../hooks";
import { useGameStore } from "../../store/gameStore";
import type { Item } from "../../types/game";
import { getBestExportPrice } from "../../utils/economyHelpers";
import {
  getCategoryBadgeColor,
  getCategoryLabel,
  getEquipmentBonusString,
  isItemAvailable,
} from "../../utils/itemHelpers";
import { ItemRecipeInfo } from "../modals/ItemRecipeInfo";
import { ItemTradeSettings } from "../modals/ItemTradeSettings";
import { Badge } from "../ui/Badge";
import { FilterTabs } from "../ui/FilterTabs";
import { Panel } from "../ui/Panel";
import { SortSelect } from "../ui/SortSelect";

// 調理(キッチン)レシピの材料として使われるアイテムID
const KITCHEN_INGREDIENT_IDS = new Set<string>();
for (const recipe of Object.values(RECIPES)) {
  if (recipe.facilityId === "kitchen") {
    for (const req of recipe.requiredItems) {
      KITCHEN_INGREDIENT_IDS.add(req.itemId);
    }
  }
}

export const InventoryPanel: React.FC = () => {
  const { inventory, targetAmounts, tradeRules } = useInventory();
  const facilities = useFacilities();
  const { currentTier, dungeons } = useDungeons();
  const towns = useGameStore((s) => s.towns);
  const marketLvl = facilities.market?.level || 0;
  const {
    setTargetAmount,
    addTradeRule,
    deleteTradeRule,
    toggleTradeRule,
    selectedItem,
    setSelectedItem,
  } = useGameStore();

  const closeDetail = useCallback(() => setSelectedItem(null), [setSelectedItem]);

  // ESCで詳細を閉じる
  useEffect(() => {
    if (!selectedItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedItem, closeDetail]);

  const listAreaRef = useRef<HTMLDivElement>(null);

  // アイテムリスト・拡張パネル以外のクリックで閉じる
  // 他のパネルのアイテムクリック時に stopPropagation() が効くようにバブリングフェーズで監視
  useEffect(() => {
    if (!selectedItem) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // cursor-pointerクラスを持つ要素（他のパネルのアイテムリンクやボタンなど）のクリックは無視する
      if (target.closest(".cursor-pointer")) {
        return;
      }
      if (listAreaRef.current && !listAreaRef.current.contains(target)) {
        closeDetail();
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [selectedItem, closeDetail]);

  type FilterTab = "all" | "material" | "food" | "consumable" | "gear";
  type SortOption = "count-desc" | "count-asc" | "price-desc" | "price-asc" | "name-asc";

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");

  const filterItem = (item: Item) => {
    if (activeTab === "all") return true;
    if (activeTab === "material") {
      return ["ore", "herb", "mana_stone", "material"].includes(item.category);
    }
    if (activeTab === "food") {
      return item.category === "food" || KITCHEN_INGREDIENT_IDS.has(item.id);
    }
    if (activeTab === "consumable") {
      return item.category === "consumable";
    }
    if (activeTab === "gear") {
      return ["gear_weapon", "gear_armor"].includes(item.category);
    }
    return true;
  };

  const sortItems = (itemA: Item, itemB: Item) => {
    const countA = Math.floor(inventory[itemA.id] || 0);
    const countB = Math.floor(inventory[itemB.id] || 0);

    if (sortBy === "count-desc") {
      return countB - countA;
    }
    if (sortBy === "count-asc") {
      return countA - countB;
    }
    if (sortBy === "price-desc") {
      return itemB.basePrice - itemA.basePrice;
    }
    if (sortBy === "price-asc") {
      return itemA.basePrice - itemB.basePrice;
    }
    if (sortBy === "name-asc") {
      return itemA.name.localeCompare(itemB.name, "ja");
    }
    return 0;
  };

  const recipes = Object.values(RECIPES);

  return (
    <Panel
      title="素材・倉庫アイテム"
      icon={<ShoppingBag className="w-5 h-5 text-sky-400 shrink-0" />}
    >
      <SortSelect
        value={sortBy}
        onChange={(val) => setSortBy(val as SortOption)}
        options={[
          { value: "count-desc", label: "所持数順 (多)" },
          { value: "count-asc", label: "所持数順 (少)" },
          { value: "price-desc", label: "基本価格順 (高)" },
          { value: "price-asc", label: "基本価格順 (安)" },
          { value: "name-asc", label: "名前順" },
        ]}
      />

      {/* フィルタータブ */}
      <FilterTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "all", label: "すべて" },
          { id: "material", label: "素材" },
          { id: "food", label: "食料" },
          { id: "consumable", label: "消耗品" },
          { id: "gear", label: "装備" },
        ]}
      />

      {/* 倉庫一覧リスト + インライン詳細パネル */}
      <div ref={listAreaRef} className="flex-1 min-h-0 relative">
        {/* アイテムリスト */}
        <div className="absolute inset-0 overflow-y-auto pr-1 space-y-2">
          {Object.values(ITEMS)
            .filter((item) =>
              isItemAvailable(item.id, dungeons, recipes, inventory, facilities, currentTier),
            )
            .filter(filterItem)
            .sort(sortItems)
            .map((item) => {
              const currentCount = Math.floor(inventory[item.id] || 0);
              const target = targetAmounts[item.id] || 0;
              const exportInfo =
                marketLvl > 0 ? getBestExportPrice(item.id, towns, marketLvl) : null;
              const rule = tradeRules?.find((r) => r.itemId === item.id && r.type === "sell");

              const isShortage = target > 0 && currentCount < target;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`border p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition cursor-pointer ${
                    isShortage
                      ? "bg-red-950/30 border-red-900/60 hover:border-red-700"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* 名前 & カテゴリ */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200 text-sm truncate">{item.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${getCategoryBadgeColor(item.category)}`}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                      {/* P2-4: 目標未達バッジ */}
                      {isShortage && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          ! 不足
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-x-2 items-center">
                      <span>
                        所持数: <span className="text-slate-300 font-bold">{currentCount}</span>
                      </span>
                      {rule && (
                        <span
                          className={
                            rule.isEnabled
                              ? "text-orange-400 font-bold"
                              : "text-slate-500 font-bold"
                          }
                        >
                          (自動交易: {rule.isEnabled ? `${rule.threshold}個超` : "無効"})
                        </span>
                      )}
                      <span>
                        価格: <span className="text-amber-500 font-bold">{item.basePrice} G</span>
                        {exportInfo && exportInfo.price > 0 && (
                          <span className="text-orange-400 text-[9px] ml-1">
                            (輸出: {exportInfo.price}G)
                          </span>
                        )}
                      </span>
                      {target > 0 && (
                        <span className="text-sky-400 font-bold">
                          (目標: {target}) {currentCount >= target ? "✓" : "不足"}
                        </span>
                      )}
                      {item.equipment && (
                        <span className="text-emerald-400 font-sans font-bold">
                          [{getEquipmentBonusString(item)}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Desktop: 右側インライン詳細パネル (リストの右端からはみ出す) */}
        {selectedItem && (
          <div className="hidden lg:flex absolute top-0 left-full w-[24rem] max-h-[75vh] flex-col bg-slate-900 border-l border-slate-800 shadow-2xl z-10 overflow-y-auto rounded-r-xl">
            {/* ヘッダー */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-bold text-slate-100">{selectedItem.name}</h3>
                  <Badge variant="custom" className={getCategoryBadgeColor(selectedItem.category)}>
                    {getCategoryLabel(selectedItem.category)}
                  </Badge>
                </div>
                {selectedItem.description && (
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2 rounded border border-slate-800">
                    {selectedItem.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="詳細を閉じる"
                className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 rounded transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 px-4 py-3 space-y-3">
              <ItemTradeSettings
                item={selectedItem}
                inventory={inventory}
                targetAmounts={targetAmounts}
                tradeRules={tradeRules}
                towns={towns}
                marketLevel={marketLvl}
                onSetTargetAmount={setTargetAmount}
                onAddTradeRule={addTradeRule}
                onDeleteTradeRule={deleteTradeRule}
                onToggleTradeRule={toggleTradeRule}
              >
                <ItemRecipeInfo item={selectedItem} onSelectItem={setSelectedItem} />
              </ItemTradeSettings>
            </div>
          </div>
        )}

        {/* Mobile: 固定オーバーレイ (右スライドドロワー) */}
        {selectedItem && (
          <div
            className="lg:hidden fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs cursor-pointer"
            onClick={closeDetail}
          >
            <aside
              role="dialog"
              aria-label="アイテム詳細"
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-l border-slate-800 w-[24rem] max-w-full h-full overflow-y-auto shadow-2xl cursor-default flex flex-col"
            >
              {/* ヘッダー */}
              <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-100">{selectedItem.name}</h3>
                    <Badge
                      variant="custom"
                      className={getCategoryBadgeColor(selectedItem.category)}
                    >
                      {getCategoryLabel(selectedItem.category)}
                    </Badge>
                  </div>
                  {selectedItem.description && (
                    <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2.5 rounded border border-slate-800">
                      {selectedItem.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  aria-label="詳細を閉じる"
                  className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 rounded transition cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 px-5 py-4 space-y-4">
                <ItemTradeSettings
                  item={selectedItem}
                  inventory={inventory}
                  targetAmounts={targetAmounts}
                  tradeRules={tradeRules}
                  towns={towns}
                  marketLevel={marketLvl}
                  onSetTargetAmount={setTargetAmount}
                  onAddTradeRule={addTradeRule}
                  onDeleteTradeRule={deleteTradeRule}
                  onToggleTradeRule={toggleTradeRule}
                >
                  <ItemRecipeInfo item={selectedItem} onSelectItem={setSelectedItem} />
                </ItemTradeSettings>
              </div>
            </aside>
          </div>
        )}
      </div>
    </Panel>
  );
};
