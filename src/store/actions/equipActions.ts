import { ITEMS } from "../../data/masterData";
import { StoreSet, StoreGet } from "../../types/game";
import { autoEquipAllHelper } from "../autoEquipLogic";

export const createEquipActions = (set: StoreSet, get: StoreGet) => ({
  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item?.equipment || item.equipment.slot !== slot) return;

    const currentCount = state.inventory[itemId] || 0;
    if (currentCount <= 0) return;

    const villager = state.villagers.find((v) => v.id === villagerId);
    if (!villager) return;

    const oldEquipId = slot === "weapon" ? villager.weaponId : villager.armorId;
    if (oldEquipId === itemId) return;

    const price = item.basePrice || 0;
    if (villager.gold < price) {
      state.addLog(
        `【警告】${villager.name} のゴールド不足により、${item.name} を購入できません（必要: ${price}G / 所持: ${villager.gold}G）。`,
        "warning",
      );
      return;
    }

    set((state) => {
      const inv = { ...state.inventory };
      let playerGold = state.gold;
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;

        v.gold -= price;
        playerGold += price;

        if (oldEquipId && oldEquipId !== "none") {
          inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
        }

        inv[itemId] = Math.max(0, currentCount - 1);

        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: itemId,
        };
      });

      return { villagers: updated, inventory: inv, gold: playerGold };
    });

    const vName = get().villagers.find((v) => v.id === villagerId)?.name;
    state.addLog(`${vName} が ${ITEMS[itemId].name} を購入して装備しました。`, "info");
  },

  unequipItem: (villagerId: string, slot: "weapon" | "armor") => {
    const state = get();
    const villager = state.villagers.find((v) => v.id === villagerId);
    if (!villager) return;

    const itemId = slot === "weapon" ? villager.weaponId : villager.armorId;
    if (!itemId || itemId === "none") return;

    set((state) => {
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;
        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: "none",
        };
      });
      const inv = { ...state.inventory };
      inv[itemId] = (inv[itemId] || 0) + 1;

      return { villagers: updated, inventory: inv };
    });

    state.addLog(`${villager.name} の装備を外しました。`, "info");
  },

  autoEquipAll: () => {
    const state = get();
    const result = autoEquipAllHelper(state);
    set({ villagers: result.villagers, inventory: result.inventory, gold: result.gold });
    result.logs.forEach((log) => state.addLog(log, "info"));
  },
});
