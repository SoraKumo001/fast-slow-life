import { ITEMS } from "../data/masterData";
import { Villager, RunStats } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function processItemPoolPurchase(
  gold: number,
  inventory: Record<string, number>,
  villagers: Villager[],
  stats?: RunStats,
  marketPrices?: Record<string, number>,
): {
  gold: number;
  inventory: Record<string, number>;
  villagers: Villager[];
  logs: LogPayload[];
  /** この呼び出しで買取に使った合計額（日次精算用） */
  totalSpent: number;
  /** 金庫不足で買い残しが発生したか（価格0で対象外のものは含まない） */
  hasFundShortageLeftover: boolean;
} {
  let nextGold = gold;
  const nextInventory = { ...inventory };
  const nextVillagers = villagers.map((v) => ({
    ...v,
    pool: { ...(v.pool || {}) },
  }));
  const logs: LogPayload[] = [];
  let totalSpent = 0;
  let hasFundShortageLeftover = false;

  for (const v of nextVillagers) {
    if (!v.pool) continue;
    // Phase 4a: 買取は「町にいる村人」に対してのみ行う。
    // 探索・移動中の村人の pool は所持品として保持され、帰還後に買い取られる。
    // （status が未設定の村人は町にいるとみなす）
    const isAwayFromTown =
      v.status === "traveling_to" ||
      v.status === "traveling_back" ||
      (v.status === "active" && !!v.destinationAreaId);
    if (isAwayFromTown) continue;
    for (const itemId of Object.keys(v.pool)) {
      const count = v.pool[itemId] || 0;
      if (count <= 0) continue;

      const item = ITEMS[itemId];
      if (!item) continue;

      // 経済v2: 単価は市場価格（なければ basePrice にフォールバック）
      const price = marketPrices?.[itemId] ?? item.basePrice;
      if (price <= 0) continue;

      // 予算制限: 金庫が払える個数だけ買う。買えなかった分は pool に残る
      const affordable = nextGold > 0 ? Math.floor(nextGold / price) : 0;
      const buyCount = Math.min(count, affordable);
      if (buyCount < count) {
        hasFundShortageLeftover = true;
      }

      if (buyCount > 0) {
        const cost = buyCount * price;
        if (stats) {
          stats.totalItemsPurchased += buyCount;
          stats.totalGoldFromPurchases += cost;
        }
        nextGold -= cost;
        totalSpent += cost;
        v.gold = (v.gold || 0) + cost;
        v.pool[itemId] -= buyCount;
        nextInventory[itemId] = (nextInventory[itemId] || 0) + buyCount;

        if (v.pool[itemId] <= 0) {
          delete v.pool[itemId];
        }

        logs.push({
          message: `【自動買取】仮置き場から ${v.name} の ${item.name} x${buyCount} を単価 ${price} G、計 ${cost} G で購入しました。`,
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
    totalSpent,
    hasFundShortageLeftover,
  };
}

/**
 * Phase 4a: 採取・討伐の獲得物は即時買取せず、村人の所持品 (pool) に入る。
 * 町の在庫と金は動かず、帰還後に processItemPoolPurchase が市場価格で買い取る。
 * （旧仕様はその場で basePrice 買取しており、pool/容量の概念が実プレイで機能しなかった）
 */
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

  const logs: LogPayload[] = [];
  if (amount > 0) {
    if (!v.pool) v.pool = {};
    v.pool[itemId] = (v.pool[itemId] || 0) + amount;
    logs.push({
      message: `【所持】${v.name} が ${item.name} x${amount} を所持品に加えました（買取は帰還後）。`,
      type: "info",
    });
  }

  return { playerGold, inventory, logs };
}
