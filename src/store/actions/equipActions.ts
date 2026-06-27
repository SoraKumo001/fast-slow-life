import { StoreSet, StoreGet } from "../../types/game";
import { autoEquipAllHelper } from "../autoEquipLogic";

export const createEquipActions = (set: StoreSet, get: StoreGet) => ({
  autoEquipAll: () => {
    const state = get();
    const result = autoEquipAllHelper(state);
    set({
      villagers: result.villagers,
      inventory: result.inventory,
      gold: result.gold,
    });
    result.logs.forEach((log) => state.addLog(log, "info"));
  },
});
