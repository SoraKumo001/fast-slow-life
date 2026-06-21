import { ITEMS } from "../../data/masterData";
import { TradeRule, StoreSet, StoreGet } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";
import { getSlotsForLevel } from "../../utils/marketHelpers";

export const createTradeRuleActions = (set: StoreSet, get: StoreGet) => ({
  addTradeRule: (itemId: string, type: "sell", threshold: number) => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item) return;

    const weaponShopLvl = state.facilities.weapon_shop?.level || 0;
    const pharmacyLvl = state.facilities.pharmacy?.level || 0;

    const isGear = item.category === "gear_weapon" || item.category === "gear_armor";
    const isConsumable = item.category === "consumable";

    if (type === "sell") {
      if (isGear) {
        if (weaponShopLvl === 0) {
          state.addLog("武器屋が建設されていないため、装備の自動売却を設定できません。", "warning");
          return;
        }
        const maxSlots = getSlotsForLevel(weaponShopLvl);
        const currentGearRules = state.tradeRules.filter((r) => {
          const rItem = ITEMS[r.itemId];
          return (
            r.type === "sell" &&
            rItem &&
            (rItem.category === "gear_weapon" || rItem.category === "gear_armor")
          );
        });
        if (currentGearRules.length >= maxSlots) {
          state.addLog(
            `武器屋が対応できる自動売却の設定枠（最大 ${maxSlots} 枠）が上限に達しています。`,
            "warning",
          );
          return;
        }
      } else if (isConsumable) {
        if (pharmacyLvl === 0) {
          state.addLog("薬屋が建設されていないため、消耗品の自動売却を設定できません。", "warning");
          return;
        }
        const maxSlots = getSlotsForLevel(pharmacyLvl);
        const currentConsRules = state.tradeRules.filter((r) => {
          const rItem = ITEMS[r.itemId];
          return r.type === "sell" && rItem && rItem.category === "consumable";
        });
        if (currentConsRules.length >= maxSlots) {
          state.addLog(
            `薬屋が対応できる自動売却の設定枠（最大 ${maxSlots} 枠）が上限に達しています。`,
            "warning",
          );
          return;
        }
      } else {
        state.addLog(
          "このアイテムは自動売却（自動販売）に対応していません（装備品または消耗品のみ設定可能です）。",
          "warning",
        );
        return;
      }
    }

    const newRule: TradeRule = {
      id: generateId(),
      itemId,
      type,
      threshold,
      isEnabled: true,
    };

    set((state) => ({
      tradeRules: [...state.tradeRules, newRule],
    }));

    state.addLog(`自動取引ルール（${item.name}）を追加しました。`, "info");
  },

  updateTradeRule: (ruleId: string, updates: Partial<Omit<TradeRule, "id" | "itemId">>) => {
    set((state) => ({
      tradeRules: state.tradeRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          ...updates,
        };
      }),
    }));
  },

  deleteTradeRule: (ruleId: string) => {
    const state = get();
    const rule = state.tradeRules.find((r) => r.id === ruleId);
    set((state) => ({
      tradeRules: state.tradeRules.filter((r) => r.id !== ruleId),
    }));
    if (rule) {
      const itemName = ITEMS[rule.itemId]?.name || rule.itemId;
      state.addLog(`自動取引ルール（${itemName}）を削除しました。`, "info");
    }
  },

  toggleTradeRule: (ruleId: string) => {
    set((state) => ({
      tradeRules: state.tradeRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          isEnabled: !rule.isEnabled,
        };
      }),
    }));
  },
});
