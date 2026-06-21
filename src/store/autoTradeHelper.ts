import { ITEMS } from "../data/masterData";
import { GameState } from "../types/game";
import { getMarketSellBonus } from "../utils/marketHelpers";
import { LogPayload } from "./gameLoopTypes";

export function processAutoTrade(
  state: Pick<GameState, "facilities" | "tradeRules" | "inventory" | "gold">,
): {
  gold: number;
  inventory: Record<string, number>;
  logs: LogPayload[];
} {
  let gold = state.gold;
  const inventory = { ...state.inventory };
  const logs: LogPayload[] = [];

  const market = state.facilities.market;
  if (!market || market.level === 0) {
    return { gold, inventory, logs };
  }

  // 設定可能上限数を考慮
  const maxSlots = market.level === 1 ? 2 : market.level === 2 ? 4 : market.level >= 3 ? 8 : 0;
  const activeRules = state.tradeRules.slice(0, maxSlots).filter((rule) => rule.isEnabled);

  const sellBonus = getMarketSellBonus(market.level);

  for (const rule of activeRules) {
    const item = ITEMS[rule.itemId];
    if (!item) continue;

    const currentCount = inventory[rule.itemId] || 0;

    if (rule.type === "sell") {
      // 売却ルール: 閾値を超えた分を売る
      if (currentCount > rule.threshold) {
        const excess = currentCount - rule.threshold;
        const toSell = rule.amount > 0 ? Math.min(excess, rule.amount) : excess;
        if (toSell > 0) {
          const basePrice = item.sellPrice * toSell;
          const finalPrice = Math.floor(basePrice * (1 + sellBonus));

          inventory[rule.itemId] = currentCount - toSell;
          gold += finalPrice;

          logs.push({
            message: `【自動取引】${item.name} を ${toSell} 個自動売却し、${finalPrice} G 獲得しました。`,
            type: "info",
          });
        }
      }
    } else if (rule.type === "buy") {
      // 購入ルール: 閾値を下回った場合、指定量（amount）を購入
      if (currentCount < rule.threshold) {
        const toBuy = rule.amount;
        if (toBuy > 0) {
          const buyPrice = item.sellPrice * 2;
          const totalCost = buyPrice * toBuy;

          if (gold >= totalCost) {
            inventory[rule.itemId] = currentCount + toBuy;
            gold -= totalCost;

            logs.push({
              message: `【自動取引】${item.name} を ${toBuy} 個自動購入し、${totalCost} G 消費しました。`,
              type: "info",
            });
          } else {
            logs.push({
              message: `【自動取引】ゴールド不足のため、${item.name} の自動購入（${toBuy} 個）をスキップしました。`,
              type: "warning",
            });
          }
        }
      }
    }
  }

  return { gold, inventory, logs };
}
