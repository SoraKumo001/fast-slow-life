import { ITEMS } from "../data/masterData";
import { GameState } from "../types/game";
import { getSellBonus, getSlotsForLevel } from "../utils/marketHelpers";
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

  const weaponShop = state.facilities.weapon_shop;
  const pharmacy = state.facilities.pharmacy;

  const weaponShopLvl = weaponShop?.level || 0;
  const pharmacyLvl = pharmacy?.level || 0;

  // 各施設の枠内ルールを抽出
  // 1. 武器屋（武器・防具の自動売却ルール）
  const maxGearSlots = getSlotsForLevel(weaponShopLvl);
  const activeGearRules = state.tradeRules
    .filter((rule) => {
      if (!rule.isEnabled || rule.type !== "sell") return false;
      const item = ITEMS[rule.itemId];
      return item && (item.category === "gear_weapon" || item.category === "gear_armor");
    })
    .slice(0, maxGearSlots);

  // 2. 薬屋（消耗品の自動売却ルール）
  const maxConsSlots = getSlotsForLevel(pharmacyLvl);
  const activeConsRules = state.tradeRules
    .filter((rule) => {
      if (!rule.isEnabled || rule.type !== "sell") return false;
      const item = ITEMS[rule.itemId];
      return item && item.category === "consumable";
    })
    .slice(0, maxConsSlots);

  // 全てのアクティブルールを結合して処理する
  const rulesToProcess = [...activeGearRules, ...activeConsRules];

  for (const rule of rulesToProcess) {
    const item = ITEMS[rule.itemId];
    if (!item) continue;

    const currentCount = inventory[rule.itemId] || 0;

    if (rule.type === "sell") {
      // 売却ルール: 閾値を超えた分を売る
      if (currentCount > rule.threshold) {
        const toSell = 1;
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
  }

  return { gold, inventory, logs };
}
