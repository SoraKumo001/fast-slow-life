import { ITEMS } from "../data/masterData";
import { Villager, RunStats } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function processItemPoolPurchase(
  gold: number,
  inventory: Record<string, number>,
  villagers: Villager[],
  stats?: RunStats,
): {
  gold: number;
  inventory: Record<string, number>;
  villagers: Villager[];
  logs: LogPayload[];
} {
  let nextGold = gold;
  const nextInventory = { ...inventory };
  const nextVillagers = villagers.map((v) => ({
    ...v,
    pool: { ...(v.pool || {}) },
  }));
  const logs: LogPayload[] = [];

  for (const v of nextVillagers) {
    if (!v.pool) continue;
    for (const itemId of Object.keys(v.pool)) {
      const count = v.pool[itemId] || 0;
      if (count <= 0) continue;

      const item = ITEMS[itemId];
      if (!item) continue;

      const price = item.basePrice;
      if (price <= 0) continue;

      const buyCount = count;

      if (buyCount > 0) {
        const cost = buyCount * price;
        if (stats) {
          stats.totalItemsPurchased += buyCount;
          stats.totalGoldFromPurchases += cost;
        }
        nextGold -= cost;
        v.gold = (v.gold || 0) + cost;
        v.pool[itemId] -= buyCount;
        nextInventory[itemId] = (nextInventory[itemId] || 0) + buyCount;

        if (v.pool[itemId] <= 0) {
          delete v.pool[itemId];
        }

        logs.push({
          message: `【自動買取】仮置き場から ${v.name} の ${item.name} x${buyCount} を計 ${cost} G で購入しました。`,
          type: "info",
        });
      }
    }
  }

  return {
    gold: nextGold,
    inventory: nextInventory,
    villagers: nextVillagers,
    logs,
  };
}

export function processItemAcquisition(
  v: Villager,
  itemId: string,
  amount: number,
  playerGold: number,
  inventory: Record<string, number>,
): {
  playerGold: number;
  inventory: Record<string, number>;
  logs: LogPayload[];
} {
  const item = ITEMS[itemId];
  if (!item) return { playerGold, inventory, logs: [] };

  const price = item.basePrice;
  const logs: LogPayload[] = [];
  const nextInventory = { ...inventory };

  let nextPlayerGold = playerGold;
  if (amount > 0) {
    const cost = amount * price;
    nextPlayerGold -= cost;
    v.gold = (v.gold || 0) + cost;
    nextInventory[itemId] = (nextInventory[itemId] || 0) + amount;
    logs.push({
      message: `【買取】${v.name} が獲得した ${item.name} x${amount} を ${cost} G で買い取りました。`,
      type: "info",
    });
  }

  return { playerGold: nextPlayerGold, inventory: nextInventory, logs };
}
