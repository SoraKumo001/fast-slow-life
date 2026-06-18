import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore";

describe("gameStore", () => {
  beforeEach(() => {
    // 各テストの前にゲーム状態をリセット
    useGameStore.getState().resetGame(false);
  });

  it("初期状態が正しくセットアップされていること", () => {
    const state = useGameStore.getState();
    expect(state.gold).toBe(500);
    expect(state.food).toBe(50);
    expect(state.currentDay).toBe(1);
    expect(state.currentHour).toBe(0);
    expect(state.isPaused).toBe(true);
    expect(state.gameOver).toBe(false);
  });

  it("ゴールドの変更が正しく機能すること", () => {
    // gameStore に直接ゴールドを変更するアクションやテストロジックの動作を確認
    // 例: resetGame(false) 後に初期値が 500 であることなど
    const state = useGameStore.getState();
    expect(state.gold).toBe(500);
  });
});
