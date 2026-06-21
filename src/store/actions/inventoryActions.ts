import { ITEMS } from "../../data/masterData";
import { GameState, GameActions } from "../../types/game";
import { getMarketSellBonus } from "../../utils/marketHelpers";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

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
    const marketLvl = state.facilities.market.level;
    if (marketLvl === 0) {
      state.addLog("交易所が建設されていないため売却できません。", "warning");
      return;
    }
    const currentCount = state.inventory[itemId] || 0;
    const toSell = Math.min(currentCount, count);
    if (toSell <= 0) return;

    const bonusRate = getMarketSellBonus(marketLvl);
    const basePrice = (ITEMS[itemId]?.sellPrice || 0) * toSell;
    const price = Math.floor(basePrice * (1 + bonusRate));

    set((state) => ({
      inventory: { ...state.inventory, [itemId]: currentCount - toSell },
      gold: state.gold + price,
    }));

    const bonusText = bonusRate > 0 ? ` (ボーナス +${Math.round(bonusRate * 100)}% 適用)` : "";
    state.addLog(
      `${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。${bonusText}`,
      "info",
    );
  },

  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item?.equipment || item.equipment.slot !== slot) return;

    const currentCount = state.inventory[itemId] || 0;
    if (currentCount <= 0) return;

    set((state) => {
      const inv = { ...state.inventory };
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;

        const oldEquipId = slot === "weapon" ? v.weaponId : v.armorId;
        if (oldEquipId && oldEquipId !== "none") {
          inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
        }

        inv[itemId] = Math.max(0, currentCount - 1);

        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: itemId,
        };
      });

      return { villagers: updated, inventory: inv };
    });

    const vName = get().villagers.find((v) => v.id === villagerId)?.name;
    state.addLog(`${vName} に ${ITEMS[itemId].name} を装備しました。`, "info");
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
});
