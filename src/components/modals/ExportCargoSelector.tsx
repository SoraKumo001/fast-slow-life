import React from "react";

import { ITEMS } from "../../data/masterData";
import type { Item, Town } from "../../types/game";
import { getCargoLimit } from "../../utils/tradeHelpers";
import { CargoItemSelector } from "./CargoItemSelector";

interface ExportCargoSelectorProps {
  inventory: Record<string, number>;
  exportCargo: Record<string, number>;
  activeTown: Town;
  marketLvl: number;
  discountLvl: number;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onSetQuantity: (itemId: string, count: number) => void;
}

export const ExportCargoSelector: React.FC<ExportCargoSelectorProps> = ({
  inventory,
  exportCargo,
  activeTown,
  marketLvl,
  discountLvl,
  onAdd,
  onRemove,
  onSetQuantity,
}) => {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        倉庫から積み込む（輸出可能なアイテム）
      </p>
      <CargoItemSelector
        type="export"
        items={Object.entries(inventory)
          .filter(([, count]) => count > 0)
          .map(([itemId]) => [itemId, ITEMS[itemId]] as [string, Item])
          .filter(([, item]) => item != null)}
        availableCounts={Object.fromEntries(
          Object.entries(inventory).filter(([, count]) => count > 0),
        )}
        cargo={Object.entries(exportCargo).map(([itemId, count]) => ({ itemId, count }))}
        cargoLimit={getCargoLimit(activeTown)}
        activeTown={activeTown}
        marketLvl={marketLvl}
        discountLvl={discountLvl}
        onAdd={onAdd}
        onRemove={onRemove}
        onSetQuantity={onSetQuantity}
      />
    </div>
  );
};
