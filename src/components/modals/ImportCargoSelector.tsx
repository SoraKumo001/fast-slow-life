import React from "react";

import { ITEMS } from "../../data/masterData";
import { getTownShopItems } from "../../data/towns";
import type { Item, Town } from "../../types/game";
import { getCargoLimit } from "../../utils/tradeHelpers";
import { CargoItemSelector } from "./CargoItemSelector";

interface ImportCargoSelectorProps {
  importCargo: Record<string, number>;
  activeTown: Town;
  marketLvl: number;
  discountLvl: number;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onSetQuantity: (itemId: string, count: number) => void;
}

export const ImportCargoSelector: React.FC<ImportCargoSelectorProps> = ({
  importCargo,
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
        仕入れ商品
      </p>
      <CargoItemSelector
        type="import"
        items={getTownShopItems(activeTown.id).map(
          (itemId) => [itemId, ITEMS[itemId]] as [string, Item],
        )}
        cargo={Object.entries(importCargo).map(([itemId, count]) => ({ itemId, count }))}
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
