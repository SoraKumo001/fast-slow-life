import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useGameStore } from "../../store/gameStore";
import type { Item } from "../../types/game";
import { getCategoryBadgeColor, getCategoryLabel } from "../../utils/itemHelpers";
import { Badge } from "../ui/Badge";
import { ItemRecipeInfo } from "./ItemRecipeInfo";
import { ItemTradeSettings } from "./ItemTradeSettings";

interface ItemDetailDrawerProps {
  item: Item | null;
  onClose: () => void;
}

/**
 * Right-side slide-in drawer for item details.
 *
 * Replaces the previous ItemDetailModal. Key benefits:
 * - Inventory list stays visible / clickable while drawer is open
 * - Clicking another item in the list updates drawer content in place
 * - No need to close → reopen when comparing / switching items
 * - Recipe links (ItemRecipeInfo.onSelectItem) become useful
 */
export const ItemDetailDrawer: React.FC<ItemDetailDrawerProps> = ({
  item: initialItem,
  onClose,
}) => {
  const [item, setItem] = useState<Item | null>(initialItem);

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  // Close on ESC
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item, onClose]);

  const inventory = useGameStore((s) => s.inventory);
  const targetAmounts = useGameStore((s) => s.targetAmounts);
  const tradeRules = useGameStore((s) => s.tradeRules);
  const towns = useGameStore((s) => s.towns);
  const facilities = useGameStore((s) => s.facilities);

  const { setTargetAmount, addTradeRule, deleteTradeRule, toggleTradeRule } = useGameStore();

  const marketLevel = facilities.market?.level || 0;

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-xs cursor-pointer"
      onClick={onClose}
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
              <h3 className="text-lg font-bold text-slate-100">{item.name}</h3>
              <Badge variant="custom" className={getCategoryBadgeColor(item.category)}>
                {getCategoryLabel(item.category)}
              </Badge>
            </div>
            {item.description && (
              <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2.5 rounded border border-slate-800">
                {item.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="詳細を閉じる"
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 rounded transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 px-5 py-4 space-y-4">
          <ItemTradeSettings
            item={item}
            inventory={inventory}
            targetAmounts={targetAmounts}
            tradeRules={tradeRules}
            towns={towns}
            marketLevel={marketLevel}
            onSetTargetAmount={setTargetAmount}
            onAddTradeRule={addTradeRule}
            onDeleteTradeRule={deleteTradeRule}
            onToggleTradeRule={toggleTradeRule}
          >
            <ItemRecipeInfo item={item} onSelectItem={setItem} />
          </ItemTradeSettings>
        </div>
      </aside>
    </div>
  );
};
