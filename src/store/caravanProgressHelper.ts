import { ITEMS } from "../data/masterData";
import { Caravan, RunStats, Town } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export interface CaravanProgressResult {
  caravans: Caravan[];
  towns: Town[];
  gold: number;
  inventory: Record<string, number>;
  logs: LogPayload[];
}

/**
 * 交易馬車の進行処理（帰還時は自動回収して待機状態にする）
 */
export function processCaravanProgress(
  caravans: Caravan[],
  towns: Town[],
  gold: number,
  inventory: Record<string, number>,
  stats: RunStats,
): CaravanProgressResult {
  let currentGold = gold;
  let currentTowns = [...towns];
  const nextInventory = { ...inventory };
  const logs: LogPayload[] = [];

  const nextCaravans = caravans.map((caravan) => {
    if (caravan.status !== "trading") return caravan;
    const nextTimeLeft = caravan.timeLeft - 1;
    if (nextTimeLeft <= 0) {
      const destTown = currentTowns.find((t) => t.id === caravan.destinationTownId);
      if (!destTown) {
        return {
          ...caravan,
          status: "returned",
          destinationTownId: null,
          type: null,
          timeLeft: 0,
          totalTime: 0,
          cargo: [],
          goldCost: 0,
          goldEarned: 0,
        } as Caravan;
      }

      if (caravan.type === "export") {
        currentGold += caravan.goldEarned;
        stats.totalGoldFromExports += caravan.goldEarned;

        logs.push({
          message: `【交易帰還】${destTown.name} から交易馬車が帰還！ ${caravan.goldEarned} G を獲得。`,
          type: "info",
        });
      } else if (caravan.type === "import") {
        for (const entry of caravan.cargo) {
          nextInventory[entry.itemId] = (nextInventory[entry.itemId] || 0) + entry.count;
        }
        stats.totalGoldSpentOnImports += caravan.goldCost;

        const itemsStr = caravan.cargo
          .map((entry) => `${ITEMS[entry.itemId]?.name || entry.itemId} x${entry.count}`)
          .join(", ");
        logs.push({
          message: `【交易帰還】仕入れ馬車が ${destTown.name} から帰還し、品物を受け取りました：${itemsStr}`,
          type: "info",
        });
      }

      return {
        ...caravan,
        status: "returned",
      } as Caravan;
    }
    return {
      ...caravan,
      timeLeft: nextTimeLeft,
    } as Caravan;
  });

  return {
    caravans: nextCaravans,
    towns: currentTowns,
    gold: currentGold,
    inventory: nextInventory,
    logs,
  };
}

/**
 * Tierアップ時に対応する町をアンロック
 */
export function unlockTownsByTier(
  towns: Town[],
  currentTier: number,
): {
  towns: Town[];
  logs: LogPayload[];
} {
  const logs: LogPayload[] = [];
  const nextTowns = towns.map((t) => {
    if (!t.isUnlocked && t.id === "ironport" && currentTier >= 2) {
      logs.push({
        message: `【交易】噂が広まり、新たな交易先「港町アイアンポート」への航路が拓かれました！`,
        type: "system",
      });
      return { ...t, isUnlocked: true };
    }
    if (!t.isUnlocked && t.id === "magica" && currentTier >= 3) {
      logs.push({
        message: `【交易】噂が広まり、新たな交易先「魔法都市マギカ」への街道が解放されました！`,
        type: "system",
      });
      return { ...t, isUnlocked: true };
    }
    return t;
  });
  return { towns: nextTowns, logs };
}
