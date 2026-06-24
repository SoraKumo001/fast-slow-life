import React, { useEffect, useState } from "react";
import { shallow } from "zustand/shallow";

import { useGameStore } from "../../store/gameStore";
import type { Item } from "../../types/game";
import { getCategoryBadgeColor, getCategoryLabel } from "../../utils/itemHelpers";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { ItemRecipeInfo } from "./ItemRecipeInfo";
import { ItemTradeSettings } from "./ItemTradeSettings";

interface ItemDetailModalProps {
  item: Item;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item: initialItem, onClose }) => {
  const [item, setItem] = useState<Item>(initialItem);

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  const inventory = useGameStore((s) => s.inventory);
  const targetAmounts = useGameStore((s) => s.targetAmounts);
  const tradeRules = useGameStore((s) => s.tradeRules);
  const towns = useGameStore((s) => s.towns);
  const facilities = useGameStore((s) => s.facilities);

  const { setTargetAmount, addTradeRule, deleteTradeRule, toggleTradeRule } = useGameStore(
    (s) => ({
      setTargetAmount: s.setTargetAmount,
      addTradeRule: s.addTradeRule,
      deleteTradeRule: s.deleteTradeRule,
      toggleTradeRule: s.toggleTradeRule,
    }),
    shallow,
  );

  const marketLevel = facilities.market?.level || 0;

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
            <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2.5 rounded border border-slate-800">
              {item.description}
            </p>
          )}
        </div>

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
    </Modal>
  );
};
