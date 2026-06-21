import { ITEMS } from "../../data/masterData";
import { StoreSet, StoreGet } from "../../types/game";

export const createInventoryActions = (set: StoreSet, get: StoreGet) => ({
  setTargetAmount: (itemId: string, count: number) => {
    set((state) => ({
      targetAmounts: {
        ...state.targetAmounts,
        [itemId]: Math.max(0, count),
      },
    }));
    get().dispatchIdleVillagers();
  },

  sellItem: (itemId: string, count: number) => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item) return;

    const marketLvl = state.facilities.market.level;
    const weaponShopLvl = state.facilities.weapon_shop?.level || 0;
    const pharmacyLvl = state.facilities.pharmacy?.level || 0;

    const isGear = item.category === "gear_weapon" || item.category === "gear_armor";
    const isConsumable = item.category === "consumable";

    const isSellable =
      marketLvl > 0 || (isGear && weaponShopLvl > 0) || (isConsumable && pharmacyLvl > 0);

    if (!isSellable) {
      if (isGear) {
        state.addLog("武器屋または交易所が建設されていないため、装備を売却できません。", "warning");
      } else if (isConsumable) {
        state.addLog(
          "薬屋または交易所が建設されていないため、ポーション等を売却できません。",
          "warning",
        );
      } else {
        state.addLog("交易所が建設されていないため売却できません。", "warning");
      }
      return;
    }

    const currentCount = state.inventory[itemId] || 0;
    const toSell = Math.min(currentCount, count);
    if (toSell <= 0) return;

    const price = item.sellPrice * toSell;

    set((state) => ({
      inventory: { ...state.inventory, [itemId]: currentCount - toSell },
      gold: state.gold + price,
    }));

    state.addLog(`${item.name} を ${toSell} 個売却し、${price} G 獲得しました。`, "info");
  },
});
