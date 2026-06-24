import React from "react";

import { ITEMS } from "../../data/masterData";
import { useVillagers, useInventory, useEquipmentActions } from "../../hooks";
import { Villager, Item } from "../../types/game";
import { getEquipmentBonusString } from "../../utils/itemHelpers";
import { Modal } from "../ui/Modal";
import { EquipmentSlot } from "./EquipmentSlot";

interface EquipmentModalProps {
  villager: Villager;
  onClose: () => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ villager, onClose }) => {
  const villagers = useVillagers();
  const { inventory } = useInventory();
  const { equipItem, unequipItem } = useEquipmentActions();

  // ストアから常に最新の村人データを取得（装備変更後にリアルタイムで反映される）
  const currentVillager = villagers.find((v) => v.id === villager.id) ?? villager;

  const handleEquip = (itemId: string, slot: "weapon" | "armor") => {
    equipItem(currentVillager.id, itemId, slot);
  };

  const handleUnequip = (slot: "weapon" | "armor") => {
    unequipItem(currentVillager.id, slot);
  };

  const currentWeapon =
    currentVillager.weaponId !== "none" ? ITEMS[currentVillager.weaponId] : null;
  const currentArmor = currentVillager.armorId !== "none" ? ITEMS[currentVillager.armorId] : null;

  const weaponItems = (Object.entries(ITEMS) as [string, Item][])
    .filter(([_, item]) => item.category === "gear_weapon")
    .filter(([itemId, _]) => (inventory[itemId] || 0) > 0 || currentVillager.weaponId === itemId)
    .sort(([, a], [, b]) => b.basePrice - a.basePrice);

  const armorItems = (Object.entries(ITEMS) as [string, Item][])
    .filter(([_, item]) => item.category === "gear_armor")
    .filter(([itemId, _]) => (inventory[itemId] || 0) > 0 || currentVillager.armorId === itemId)
    .sort(([, a], [, b]) => b.basePrice - a.basePrice);

  return (
    <Modal onClose={onClose} size="lg" showCloseButton>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{currentVillager.name} の装備変更</h3>
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

        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <EquipmentSlot
            slot="weapon"
            items={weaponItems}
            equippedItemId={currentVillager.weaponId !== "none" ? currentVillager.weaponId : null}
            currentItem={currentWeapon}
            inventory={inventory}
            onEquip={(itemId) => handleEquip(itemId, "weapon")}
            onUnequip={() => handleUnequip("weapon")}
          />
          <EquipmentSlot
            slot="armor"
            items={armorItems}
            equippedItemId={currentVillager.armorId !== "none" ? currentVillager.armorId : null}
            currentItem={currentArmor}
            inventory={inventory}
            onEquip={(itemId) => handleEquip(itemId, "armor")}
            onUnequip={() => handleUnequip("armor")}
          />
        </div>
      </div>
    </Modal>
  );
};
