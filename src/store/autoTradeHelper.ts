import { ITEMS } from "../data/masterData";
import { GameState } from "../types/game";
import { getSellBonus } from "../utils/marketHelpers";
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
  const weaponShop = state.facilities.weapon_shop;
  const pharmacy = state.facilities.pharmacy;

  const marketLvl = market?.level || 0;
  const weaponShopLvl = weaponShop?.level || 0;
  const pharmacyLvl = pharmacy?.level || 0;

  const getSlotsForLevel = (lvl: number) => {
    if (lvl === 1) return 2;
    if (lvl === 2) return 4;
    if (lvl >= 3) return 8;
    return 0;
  };

  // 各施設の枠内ルールを抽出
  // 1. 交易所（自動購入ルール）
  const maxBuySlots = getSlotsForLevel(marketLvl);
  const activeBuyRules = state.tradeRules
    .filter((rule) => rule.isEnabled && rule.type === "buy")
    .slice(0, maxBuySlots);

  // 2. 武器屋（武器・防具の自動売却ルール）
  const maxGearSlots = getSlotsForLevel(weaponShopLvl);
  const activeGearRules = state.tradeRules
    .filter((rule) => {
      if (!rule.isEnabled || rule.type !== "sell") return false;
      const item = ITEMS[rule.itemId];
      return item && (item.category === "gear_weapon" || item.category === "gear_armor");
    })
    .slice(0, maxGearSlots);

  // 3. 薬屋（消耗品の自動売却ルール）
  const maxConsSlots = getSlotsForLevel(pharmacyLvl);
  const activeConsRules = state.tradeRules
    .filter((rule) => {
      if (!rule.isEnabled || rule.type !== "sell") return false;
      const item = ITEMS[rule.itemId];
      return item && item.category === "consumable";
    })
    .slice(0, maxConsSlots);

  // 全てのアクティブルールを結合して処理する
  const rulesToProcess = [...activeBuyRules, ...activeGearRules, ...activeConsRules];

  for (const rule of rulesToProcess) {
    const item = ITEMS[rule.itemId];
    if (!item) continue;

    const currentCount = inventory[rule.itemId] || 0;

    if (rule.type === "sell") {
      // 売却ルール: 閾値を超えた分を売る
      if (currentCount > rule.threshold) {
        const excess = currentCount - rule.threshold;
        const toSell = rule.amount > 0 ? Math.min(excess, rule.amount) : excess;
        if (toSell > 0) {
          const sellBonus = getSellBonus(item.category, state.facilities);
          const basePrice = item.sellPrice * toSell;
          const finalPrice = Math.floor(basePrice * (1 + sellBonus));

          inventory[rule.itemId] = currentCount - toSell;
          gold += finalPrice;

          const shopName =
            item.category === "gear_weapon" || item.category === "gear_armor" ? "武器屋" : "薬屋";

          logs.push({
            message: `【自動取引】${item.name} を ${toSell} 個自動売却（${shopName}）し、${finalPrice} G 獲得しました。`,
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
