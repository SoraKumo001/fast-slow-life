import "../setupMockStorage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGameStore } from "../gameStore";

describe("tradeActions - sendImportCaravan", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    // 交易所を Lv1 にして馬車を 1 台使えるようにする
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        market: { ...s.facilities.market, level: 1 },
      },
    }));
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("B1: 派遣時に totalGoldSpentOnImports が goldCost 分だけ増えること", () => {
    // B1 修正後: 集計は派遣側（sendImportCaravan）の責務。
    // 帰還側（processCaravanProgress）は集計しない。
    const store = useGameStore.getState();
    const goldCost = 50;
    const initialStats = store.stats;
    const initialGold = store.gold;

    store.sendImportCaravan("caravan_1", "komorebi", [{ itemId: "potion", count: 1 }], goldCost);

    const after = useGameStore.getState();
    // 派遣時に1回だけ加算される
    expect(after.stats.totalGoldSpentOnImports).toBe(
      initialStats.totalGoldSpentOnImports + goldCost,
    );
    // ゴールドも派遣時に減算される
    expect(after.gold).toBe(initialGold - goldCost);
  });
});
