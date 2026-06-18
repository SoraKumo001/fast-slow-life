import React from "react";
import { useGameStore, ITEMS } from "../../store/gameStore";
import { Villager, Item } from "../../types/game";

interface EquipmentModalProps {
  villager: Villager;
  onClose: () => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ villager, onClose }) => {
  const { inventory, equipItem, unequipItem } = useGameStore();

  const handleEquip = (itemId: string, slot: "weapon" | "armor") => {
    equipItem(villager.id, itemId, slot);
    onClose();
  };

  const handleUnequip = (slot: "weapon" | "armor") => {
    unequipItem(villager.id, slot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{villager.name} の装備変更</h3>
          <p className="text-xs text-slate-400">
            現在装備: 武器(
            {villager.weaponId !== "none" ? ITEMS[villager.weaponId].name : "なし"}
            ), 防具(
            {villager.armorId !== "none" ? ITEMS[villager.armorId].name : "なし"})
          </p>
        </div>

        <div className="space-y-4">
          {/* 武器一覧 */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              武器 (攻撃UP)
            </h4>
            <div className="space-y-2">
              {/* 装備なし */}
              <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                <span className="text-xs text-slate-400">装備なし</span>
                {villager.weaponId !== "none" ? (
                  <button
                    onClick={() => handleUnequip("weapon")}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                  >
                    外す
                  </button>
                ) : (
                  <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                )}
              </div>

              {/* 倉庫内の武器 */}
              {(Object.entries(ITEMS) as [string, Item][])
                .filter(([_, item]) => item.category === "gear_weapon")
                .map(([itemId, item]) => {
                  const count = inventory[itemId] || 0;
                  const isEquipped = villager.weaponId === itemId;

                  return (
                    <div
                      key={itemId}
                      className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-200">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">倉庫在庫: {count}個</p>
                      </div>
                      {isEquipped ? (
                        <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                      ) : (
                        <button
                          onClick={() => handleEquip(itemId, "weapon")}
                          disabled={count <= 0}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                        >
                          装備
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 防具一覧 */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              防具 (防御UP)
            </h4>
            <div className="space-y-2">
              {/* 装備なし */}
              <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                <span className="text-xs text-slate-400">装備なし</span>
                {villager.armorId !== "none" ? (
                  <button
                    onClick={() => handleUnequip("armor")}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                  >
                    外す
                  </button>
                ) : (
                  <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                )}
              </div>

              {/* 倉庫内の防具 */}
              {(Object.entries(ITEMS) as [string, Item][])
                .filter(([_, item]) => item.category === "gear_armor")
                .map(([itemId, item]) => {
                  const count = inventory[itemId] || 0;
                  const isEquipped = villager.armorId === itemId;

                  return (
                    <div
                      key={itemId}
                      className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-200">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">倉庫在庫: {count}個</p>
                      </div>
                      {isEquipped ? (
                        <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                      ) : (
                        <button
                          onClick={() => handleEquip(itemId, "armor")}
                          disabled={count <= 0}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                        >
                          装備
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
