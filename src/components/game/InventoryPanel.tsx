import { ShoppingBag } from "lucide-react";
import React, { useState } from "react";

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
import { ItemDetailModal } from "../modals/ItemDetailModal";
import { FilterTabs } from "../ui/FilterTabs";
import { Panel } from "../ui/Panel";
import { SortSelect } from "../ui/SortSelect";

export const InventoryPanel: React.FC = () => {
  const { inventory, targetAmounts, tradeRules } = useInventory();
  const facilities = useFacilities();
  const { currentTier, dungeons } = useDungeons();
  const towns = useGameStore((s) => s.towns);
  const marketLvl = facilities.market?.level || 0;

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

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
      return item.category === "food";
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

      {/* 倉庫一覧リスト */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {Object.values(ITEMS)
          .filter((item) =>
            isItemAvailable(item.id, dungeons, recipes, inventory, facilities, currentTier),
          )
          .filter(filterItem)
          .sort(sortItems)
          .map((item) => {
            const currentCount = Math.floor(inventory[item.id] || 0);
            const target = targetAmounts[item.id] || 0;
            const exportInfo = marketLvl > 0 ? getBestExportPrice(item.id, towns, marketLvl) : null;
            const rule = tradeRules?.find((r) => r.itemId === item.id && r.type === "sell");

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition cursor-pointer"
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
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-x-2 items-center">
                    <span>
                      所持数: <span className="text-slate-300 font-bold">{currentCount}</span>
                    </span>
                    {rule && (
                      <span
                        className={
                          rule.isEnabled ? "text-orange-400 font-bold" : "text-slate-500 font-bold"
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

      {/* 詳細モーダル */}
      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </Panel>
  );
};
