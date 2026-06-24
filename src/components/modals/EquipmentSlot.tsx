import React from "react";

import { STAT_LABEL_MAP } from "../../constants";
import { Item } from "../../types/game";
import { getBonusDiff } from "../../utils/itemHelpers";
import { Button } from "../ui/Button";

interface EquipmentSlotProps {
  slot: "weapon" | "armor";
  items: [string, Item][]; // pre-filtered and pre-sorted items
  equippedItemId: string | null;
  currentItem: Item | null; // currently equipped item in this slot
  inventory: Record<string, number>;
  onEquip: (itemId: string) => void;
  onUnequip: () => void;
}

const SLOT_HEADER: Record<"weapon" | "armor", string> = {
  weapon: "武器 (攻撃UP)",
  armor: "防具 (防御UP)",
};

export const EquipmentSlot: React.FC<EquipmentSlotProps> = ({
  slot,
  items,
  equippedItemId,
  currentItem,
  inventory,
  onEquip,
  onUnequip,
}) => {
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
        {SLOT_HEADER[slot]}
      </h4>
      <div className="space-y-2">
        {/* 装備なし */}
        <div className="flex justify-between items-start bg-slate-950/50 p-2.5 border border-slate-800 rounded">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-slate-400 font-bold">装備なし</span>
            {currentItem && (
              <div className="flex flex-wrap gap-x-2 text-[10px] font-mono mt-0.5">
                {Object.entries(currentItem.equipment?.bonuses || {}).map(([stat, val]) => {
                  if (!val) return null;
                  return (
                    <span key={stat} className="text-slate-500">
                      {STAT_LABEL_MAP[stat] || stat.toUpperCase()}: {val} → 0{" "}
                      <span className="text-red-400 font-bold">(-{val})</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="shrink-0 ml-2 self-start">
            {equippedItemId !== null ? (
              <Button onClick={onUnequip} variant="secondary" size="sm">
                外す
              </Button>
            ) : (
              <span className="text-[10px] text-sky-400 font-bold">装備中</span>
            )}
          </div>
        </div>

        {/* 倉庫内の装備 */}
        {items.map(([itemId, item]) => {
          const count = Math.floor(inventory[itemId] || 0);
          const isEquipped = equippedItemId === itemId;

          return (
            <div
              key={itemId}
              className="flex justify-between items-start bg-slate-950/50 p-2.5 border border-slate-800 rounded"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200">{item.name}</p>

                {/* ステータス変化 */}
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono leading-none">
                  {getBonusDiff(item, currentItem).map((d) => (
                    <span key={d.stat} className="text-slate-400">
                      {d.stat}: {d.before} → {d.after}{" "}
                      <span
                        className={
                          d.diff > 0
                            ? "text-emerald-400 font-bold"
                            : d.diff < 0
                              ? "text-red-400 font-bold"
                              : "text-slate-500"
                        }
                      >
                        ({d.diff > 0 ? `+${d.diff}` : d.diff})
                      </span>
                    </span>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500 font-mono">倉庫在庫: {count}個</p>
              </div>
              <div className="shrink-0 ml-2 self-start">
                {isEquipped ? (
                  <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                ) : (
                  <Button
                    onClick={() => onEquip(itemId)}
                    disabled={count <= 0}
                    variant="primary"
                    size="sm"
                  >
                    装備
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
