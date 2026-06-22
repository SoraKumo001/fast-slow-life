import { ITEMS } from "../../data/masterData";
import { TradeRule, StoreSet, StoreGet } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";

export const createTradeRuleActions = (set: StoreSet, get: StoreGet) => ({
  addTradeRule: (itemId: string, type: "sell", threshold: number) => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item) return;

    const marketLvl = state.facilities.market?.level || 0;
    if (marketLvl === 0) {
      state.addLog("交易所が建設されていないため、自動交易を設定できません。", "warning");
      return;
    }

    const exists = state.tradeRules.some((r) => r.itemId === itemId && r.type === type);
    if (exists) {
      state.addLog(`すでに ${item.name} の自動交易ルールが存在します。`, "warning");
      return;
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

    state.addLog(`自動交易ルール（${item.name}）を追加しました。`, "info");
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
