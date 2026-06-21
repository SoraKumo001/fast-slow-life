import { ShoppingBag } from "lucide-react";
import React, { useState } from "react";

import { ITEMS, getRecipeForItem } from "../../data/masterData";
import { useInventory, useFacilities, useDungeons } from "../../hooks";
import { Item } from "../../types/game";
import {
  getCategoryBadgeColor,
  getCategoryLabel,
  getEquipmentBonusString,
} from "../../utils/itemHelpers";
import { ItemDetailModal } from "../modals/ItemDetailModal";
import { FilterTabs } from "../ui/FilterTabs";
import { Panel } from "../ui/Panel";
import { SortSelect } from "../ui/SortSelect";

export const InventoryPanel: React.FC = () => {
  const { inventory, targetAmounts } = useInventory();
  const facilities = useFacilities();
  const { currentTier, dungeons } = useDungeons();

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  type FilterTab = "all" | "material" | "food" | "consumable" | "gear";
  type SortOption = "count-desc" | "count-asc" | "price-desc" | "price-asc" | "name-asc";

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("count-desc");

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
      return itemB.sellPrice - itemA.sellPrice;
    }
    if (sortBy === "price-asc") {
      return itemA.sellPrice - itemB.sellPrice;
    }
    if (sortBy === "name-asc") {
      return itemA.name.localeCompare(itemB.name, "ja");
    }
    return 0;
  };

  // 製造または入手が可能か（現在所持しているか、解放エリアで採取・ドロップできるか、施設でクラフトできるか）
  const isItemAvailable = (item: Item, visited = new Set<string>()): boolean => {
    if (visited.has(item.id)) return false;
    visited.add(item.id);

    if ((inventory[item.id] || 0) > 0) return true;

    const isGatherable = dungeons.some((d) => {
      if (d.unlockedAtTier > currentTier) return false;
      return d.gathers.some((g) => {
        if (g.itemId !== item.id) return false;
        return d.explorationProgress >= (g.unlockedAtProgress || 0);
      });
    });
    if (isGatherable) return true;

    const isDroppable = dungeons.some((d) => {
      if (d.unlockedAtTier > currentTier) return false;
      return d.monsters.some((m) => {
        const isMonsUnlocked = d.explorationProgress >= (m.unlockedAtProgress || 0);
        if (!isMonsUnlocked) return false;
        return m.drops.some((drop) => drop.itemId === item.id);
      });
    });
    if (isDroppable) return true;

    const recipe = getRecipeForItem(item.id);
    if (recipe) {
      const facilityLevel = facilities[recipe.facilityId]?.level || 0;
      const isFacilityUnlocked = facilityLevel >= recipe.requiredFacilityLevel;
      if (isFacilityUnlocked) {
        return recipe.requiredItems.every((req) => {
          const reqItem = ITEMS[req.itemId];
          if (!reqItem) return false;
          return isItemAvailable(reqItem, new Set(visited));
        });
      }
    }

    return false;
  };

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
          { value: "price-desc", label: "売却価格順 (高)" },
          { value: "price-asc", label: "売却価格順 (安)" },
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
          .filter((item) => isItemAvailable(item))
          .filter(filterItem)
          .sort(sortItems)
          .map((item) => {
            const currentCount = Math.floor(inventory[item.id] || 0);
            const target = targetAmounts[item.id] || 0;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-slate-950/80 border border-slate-850 hover:border-slate-750 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition cursor-pointer"
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
                    <span>
                      売値: <span className="text-amber-500 font-bold">{item.sellPrice} G</span>
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
