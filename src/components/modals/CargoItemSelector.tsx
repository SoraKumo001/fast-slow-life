import { Coins } from "lucide-react";
import React from "react";

import type { Item, Town } from "../../types/game";
import { getEffectiveExportPrice } from "../../utils/economyHelpers";
import { getImportPrice } from "../../utils/tradeHelpers";

export interface CargoItemSelectorProps {
  type: "export" | "import";
  items: [string, Item][];
  /** 輸出時の在庫数マップ（itemId -> 所持数）。輸入では未使用。 */
  availableCounts?: Record<string, number>;
  cargo: { itemId: string; count: number }[];
  cargoLimit: number;
  activeTown: Town;
  /** 輸出時の交易所レベル（価格計算に使用）。 */
  marketLvl: number;
  /** 輸入時の割引レベル（価格計算に使用）。 */
  discountLvl: number;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onSetQuantity: (itemId: string, count: number) => void;
}

export const CargoItemSelector: React.FC<CargoItemSelectorProps> = ({
  type,
  items,
  availableCounts,
  cargo,
  cargoLimit,
  activeTown,
  marketLvl,
  discountLvl,
  onAdd,
  onRemove,
}) => {
  const cargoMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of cargo) {
      map[entry.itemId] = entry.count;
    }
    return map;
  }, [cargo]);

  const totalLoaded = React.useMemo(
    () => Object.values(cargoMap).reduce((a, b) => a + b, 0),
    [cargoMap],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map(([itemId, item]) => {
        if (!item) return null;
        const loaded = cargoMap[itemId] || 0;
        const availableCount = availableCounts?.[itemId];

        if (type === "export") {
          const effectivePrice = getEffectiveExportPrice(itemId, activeTown, marketLvl);

          return (
            <div
              key={itemId}
              className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">{item.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  倉庫: {availableCount ?? 0} / 積載: {loaded}
                </p>
                <p className="text-[10px] font-mono mt-0.5">
                  <span className="text-amber-400 font-bold">{effectivePrice} G/個</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 select-none">
                <button
                  onClick={() => onRemove(itemId)}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-800 cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => {
                    if (totalLoaded < cargoLimit && loaded < (availableCount ?? 0)) {
                      onAdd(itemId);
                    }
                  }}
                  className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-800 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          );
        }

        // type === "import"
        const buyPrice = getImportPrice(itemId, activeTown, discountLvl);

        return (
          <div
            key={itemId}
            className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200">{item.name}</p>
              <p className="text-[10px] text-amber-500 font-mono mt-0.5 flex items-center gap-0.5">
                <Coins className="w-3 h-3" />
                {buyPrice} G / 1個
              </p>
              <p className="text-[9px] text-slate-500 font-mono">仕入れ注文数: {loaded}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 select-none">
              <button
                onClick={() => onRemove(itemId)}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-800 cursor-pointer"
              >
                -
              </button>
              <button
                onClick={() => {
                  if (totalLoaded < cargoLimit) {
                    onAdd(itemId);
                  }
                }}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-800 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
