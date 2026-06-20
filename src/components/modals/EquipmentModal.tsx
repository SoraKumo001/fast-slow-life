import React from "react";

import { useGameStore, ITEMS } from "../../store/gameStore";
import { Villager, Item } from "../../types/game";
import { getEquipmentBonusString } from "../../utils/itemHelpers";

interface EquipmentModalProps {
  villager: Villager;
  onClose: () => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ villager, onClose }) => {
  const { inventory, equipItem, unequipItem } = useGameStore();

  const handleEquip = (itemId: string, slot: "weapon" | "armor") => {
    equipItem(villager.id, itemId, slot);
  };

  const handleUnequip = (slot: "weapon" | "armor") => {
    unequipItem(villager.id, slot);
  };

  const currentWeapon = villager.weaponId !== "none" ? ITEMS[villager.weaponId] : null;
  const currentArmor = villager.armorId !== "none" ? ITEMS[villager.armorId] : null;

  const getBonusDiff = (item: Item, currentItem: Item | null) => {
    type BonusKey = "attack" | "defense" | "str" | "int" | "dex" | "agi" | "vit";
    const diffs: { stat: string; before: number; after: number; diff: number }[] = [];
    const allStats = new Set<BonusKey>([
      ...Object.keys(item.equipment?.bonuses || {}),
      ...Object.keys(currentItem?.equipment?.bonuses || {}),
    ] as BonusKey[]);

    const labelMap: Record<BonusKey, string> = {
      attack: "攻撃",
      defense: "防御",
      str: "STR",
      int: "INT",
      dex: "DEX",
      agi: "AGI",
      vit: "VIT",
    };

    allStats.forEach((stat) => {
      const before = currentItem?.equipment?.bonuses?.[stat] || 0;
      const after = item.equipment?.bonuses?.[stat] || 0;
      const diff = after - before;
      if (before !== 0 || after !== 0) {
        diffs.push({
          stat: labelMap[stat] || stat.toUpperCase(),
          before,
          after,
          diff,
        });
      }
    });

    return diffs;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 cursor-default"
      >
        <div>
          <h3 className="text-lg font-bold text-slate-100">{villager.name} の装備変更</h3>
          <div className="text-xs text-slate-400 mt-1 leading-relaxed">
            現在装備:
            <div className="ml-2 mt-0.5 font-mono text-[11px]">
              • 武器:{" "}
              {currentWeapon ? (
                <span className="text-slate-200">
                  {currentWeapon.name}{" "}
                  <span className="text-emerald-400 font-bold font-sans">
                    [{getEquipmentBonusString(currentWeapon)}]
                  </span>
                </span>
              ) : (
                <span className="text-slate-500">なし</span>
              )}
            </div>
            <div className="ml-2 mt-0.5 font-mono text-[11px]">
              • 防具:{" "}
              {currentArmor ? (
                <span className="text-slate-200">
                  {currentArmor.name}{" "}
                  <span className="text-emerald-400 font-bold font-sans">
                    [{getEquipmentBonusString(currentArmor)}]
                  </span>
                </span>
              ) : (
                <span className="text-slate-500">なし</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* 武器一覧 */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              武器 (攻撃UP)
            </h4>
            <div className="space-y-2">
              {/* 装備なし */}
              <div className="flex justify-between items-center bg-slate-950/50 p-2.5 border border-slate-800 rounded">
                <div>
                  <span className="text-xs text-slate-400 font-bold">装備なし</span>
                  {currentWeapon && (
                    <div className="flex flex-wrap gap-x-2 text-[10px] font-mono mt-0.5">
                      {Object.entries(currentWeapon.equipment?.bonuses || {}).map(([stat, val]) => {
                        if (!val) return null;
                        const labelMap: Record<string, string> = {
                          attack: "攻撃",
                          defense: "防御",
                          str: "STR",
                          int: "INT",
                          dex: "DEX",
                          agi: "AGI",
                          vit: "VIT",
                        };
                        return (
                          <span key={stat} className="text-slate-500">
                            {labelMap[stat] || stat.toUpperCase()}: {val} → 0{" "}
                            <span className="text-red-400 font-bold">(-{val})</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                .filter(
                  ([itemId, _]) => (inventory[itemId] || 0) > 0 || villager.weaponId === itemId,
                )
                .map(([itemId, item]) => {
                  const count = Math.floor(inventory[itemId] || 0);
                  const isEquipped = villager.weaponId === itemId;

                  return (
                    <div
                      key={itemId}
                      className="flex justify-between items-center bg-slate-950/50 p-2.5 border border-slate-800 rounded"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200">{item.name}</p>

                        {/* ステータス変化 */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono leading-none">
                          {getBonusDiff(item, currentWeapon).map((d) => (
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
                      {isEquipped ? (
                        <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                      ) : (
                        <button
                          onClick={() => handleEquip(itemId, "weapon")}
                          disabled={count <= 0}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition cursor-pointer"
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
              <div className="flex justify-between items-center bg-slate-950/50 p-2.5 border border-slate-800 rounded">
                <div>
                  <span className="text-xs text-slate-400 font-bold">装備なし</span>
                  {currentArmor && (
                    <div className="flex flex-wrap gap-x-2 text-[10px] font-mono mt-0.5">
                      {Object.entries(currentArmor.equipment?.bonuses || {}).map(([stat, val]) => {
                        if (!val) return null;
                        const labelMap: Record<string, string> = {
                          attack: "攻撃",
                          defense: "防御",
                          str: "STR",
                          int: "INT",
                          dex: "DEX",
                          agi: "AGI",
                          vit: "VIT",
                        };
                        return (
                          <span key={stat} className="text-slate-500">
                            {labelMap[stat] || stat.toUpperCase()}: {val} → 0{" "}
                            <span className="text-red-400 font-bold">(-{val})</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                .filter(
                  ([itemId, _]) => (inventory[itemId] || 0) > 0 || villager.armorId === itemId,
                )
                .map(([itemId, item]) => {
                  const count = Math.floor(inventory[itemId] || 0);
                  const isEquipped = villager.armorId === itemId;

                  return (
                    <div
                      key={itemId}
                      className="flex justify-between items-center bg-slate-950/50 p-2.5 border border-slate-800 rounded"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200">{item.name}</p>

                        {/* ステータス変化 */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono leading-none">
                          {getBonusDiff(item, currentArmor).map((d) => (
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
                      {isEquipped ? (
                        <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                      ) : (
                        <button
                          onClick={() => handleEquip(itemId, "armor")}
                          disabled={count <= 0}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition cursor-pointer"
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
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
