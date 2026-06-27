import "../../store/setupMockStorage";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useGameStore } from "../../store/gameStore";
import type { DungeonArea } from "../../types/game";

function makeDungeon(overrides: Partial<DungeonArea> = {}): DungeonArea {
  return {
    id: "forest",
    name: "始まりの森",
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [],
    monsters: [],
    explorationProgress: 100,
    difficulty: 1.0,
    threatLevel: 50,
    ...overrides,
  } as DungeonArea;
}

describe("offeringActions - offerToDungeon", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("正常系: ゴールドを消費し脅威度が低下すること", () => {
    useGameStore.setState({
      gold: 10000,
      dungeons: [makeDungeon({ threatLevel: 50 })],
    });

    const result = useGameStore.getState().offerToDungeon("forest", 30);
    expect(result).toBeNull(); // 成功
    const after = useGameStore.getState();
    expect(after.dungeons[0].threatLevel).toBeLessThan(50);
    expect(after.gold).toBeLessThan(10000);
  });

  it("正常系: お布施ログが追加されること", () => {
    useGameStore.setState({
      gold: 10000,
      dungeons: [makeDungeon({ threatLevel: 50 })],
    });

    useGameStore.getState().offerToDungeon("forest", 30);
    const after = useGameStore.getState();
    const log = after.logs.find((l) => l.message.includes("お布施"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("info");
  });

  it("存在しないダンジョンID の場合はエラーメッセージを返すこと", () => {
    useGameStore.setState({ gold: 10000 });
    const result = useGameStore.getState().offerToDungeon("nonexistent", 30);
    expect(result).not.toBeNull();
    expect(result).toContain("見つかりません");
  });

  it("脅威度 0 のダンジョンには適用不可 (エラーメッセージ)", () => {
    useGameStore.setState({
      gold: 10000,
      dungeons: [makeDungeon({ threatLevel: 0 })],
    });
    const result = useGameStore.getState().offerToDungeon("forest", 30);
    expect(result).not.toBeNull();
  });

  it("ゴールド不足の場合はエラーメッセージを返すこと", () => {
    useGameStore.setState({
      gold: 1, // ゴールド不足
      dungeons: [makeDungeon({ threatLevel: 50 })],
    });
    const result = useGameStore.getState().offerToDungeon("forest", 30);
    expect(result).not.toBeNull();
    expect(result).toContain("ゴールド");
    // ゴールドは減らない
    expect(useGameStore.getState().gold).toBe(1);
  });

  it("軽減率 0 や 100 超はエラーメッセージを返すこと", () => {
    useGameStore.setState({
      gold: 10000,
      dungeons: [makeDungeon({ threatLevel: 50 })],
    });
    expect(useGameStore.getState().offerToDungeon("forest", 0)).not.toBeNull();
    expect(useGameStore.getState().offerToDungeon("forest", 101)).not.toBeNull();
  });

  it("実行後はゴールドが実際に消費された金額分減少すること", () => {
    useGameStore.setState({
      gold: 100000,
      dungeons: [makeDungeon({ threatLevel: 50 })],
    });
    const before = useGameStore.getState().gold;
    useGameStore.getState().offerToDungeon("forest", 30);
    const after = useGameStore.getState();
    // ゴールドが減っている
    expect(after.gold).toBeLessThan(before);
  });
});
