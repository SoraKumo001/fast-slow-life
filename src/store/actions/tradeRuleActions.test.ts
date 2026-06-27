import "../../store/setupMockStorage";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { useGameStore } from "../../store/gameStore";
import type { GameLog } from "../../types/game";

describe("tradeRuleActions - addTradeRule", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    // 交易所を Lv1 に
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

  it("正常系: tradeRule が追加されログが出ること", () => {
    useGameStore.getState().addTradeRule("potion", "sell", 10);
    const after = useGameStore.getState();
    expect(after.tradeRules).toHaveLength(1);
    expect(after.tradeRules[0].itemId).toBe("potion");
    expect(after.tradeRules[0].type).toBe("sell");
    expect(after.tradeRules[0].threshold).toBe(10);
    expect(after.tradeRules[0].isEnabled).toBe(true);

    const log = after.logs.find((l: GameLog) => l.message.includes("自動交易ルール"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("info");
  });

  it("存在しないアイテムID の場合は追加されないこと", () => {
    const before = useGameStore.getState().tradeRules.length;
    useGameStore.getState().addTradeRule("nonexistent_item", "sell", 10);
    const after = useGameStore.getState();
    expect(after.tradeRules.length).toBe(before);
  });

  it("交易所 Lv0 の場合は追加されないこと (warning ログ)", () => {
    useGameStore.setState((s) => ({
      facilities: { ...s.facilities, market: { ...s.facilities.market, level: 0 } },
    }));
    useGameStore.getState().addTradeRule("potion", "sell", 10);
    const after = useGameStore.getState();
    expect(after.tradeRules).toHaveLength(0);
    const log = after.logs.find((l: GameLog) => l.message.includes("交易所が建設"));
    expect(log?.type).toBe("warning");
  });

  it("同じアイテムのルールが既に存在する場合は追加されないこと (warning ログ)", () => {
    useGameStore.getState().addTradeRule("potion", "sell", 10);
    useGameStore.getState().addTradeRule("potion", "sell", 20);
    const after = useGameStore.getState();
    expect(after.tradeRules).toHaveLength(1);
    expect(after.tradeRules[0].threshold).toBe(10); // 既存が優先
    const dupLog = after.logs.find((l: GameLog) => l.message.includes("すでに"));
    expect(dupLog?.type).toBe("warning");
  });

  it("複数の異なるアイテムのルールを追加できること", () => {
    useGameStore.getState().addTradeRule("potion", "sell", 10);
    useGameStore.getState().addTradeRule("iron_ingot", "sell", 5);
    const after = useGameStore.getState();
    expect(after.tradeRules).toHaveLength(2);
    expect(after.tradeRules.map((r) => r.itemId)).toEqual(["potion", "iron_ingot"]);
  });
});

describe("tradeRuleActions - updateTradeRule", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    useGameStore.setState((s) => ({
      facilities: {
        ...s.facilities,
        market: { ...s.facilities.market, level: 1 },
      },
      tradeRules: [
        {
          id: "rule_1",
          itemId: "potion",
          type: "sell" as const,
          threshold: 10,
          isEnabled: true,
        },
      ],
    }));
  });

  it("threshold を更新できること", () => {
    useGameStore.getState().updateTradeRule("rule_1", { threshold: 20 });
    const after = useGameStore.getState();
    expect(after.tradeRules[0].threshold).toBe(20);
  });

  it("isEnabled を更新できること", () => {
    useGameStore.getState().updateTradeRule("rule_1", { isEnabled: false });
    const after = useGameStore.getState();
    expect(after.tradeRules[0].isEnabled).toBe(false);
  });

  it("存在しない ruleId の場合は何も変わらないこと", () => {
    const before = useGameStore.getState().tradeRules[0].threshold;
    useGameStore.getState().updateTradeRule("nonexistent_rule", { threshold: 999 });
    const after = useGameStore.getState();
    expect(after.tradeRules[0].threshold).toBe(before);
  });

  it("複数フィールドを同時に更新できること", () => {
    useGameStore.getState().updateTradeRule("rule_1", { threshold: 30, isEnabled: false });
    const after = useGameStore.getState();
    expect(after.tradeRules[0].threshold).toBe(30);
    expect(after.tradeRules[0].isEnabled).toBe(false);
  });
});

describe("tradeRuleActions - deleteTradeRule", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    globalThis.IS_TEST_ENVIRONMENT = false;
    useGameStore.setState({
      tradeRules: [
        {
          id: "rule_1",
          itemId: "potion",
          type: "sell" as const,
          threshold: 10,
          isEnabled: true,
        },
      ],
    });
  });

  afterEach(() => {
    globalThis.IS_TEST_ENVIRONMENT = true;
  });

  it("指定した ruleId のルールが削除されること", () => {
    useGameStore.getState().deleteTradeRule("rule_1");
    const after = useGameStore.getState();
    expect(after.tradeRules).toHaveLength(0);
  });

  it("削除時に info ログが出力されること", () => {
    useGameStore.getState().deleteTradeRule("rule_1");
    const after = useGameStore.getState();
    const log = after.logs.find((l: GameLog) => l.message.includes("削除"));
    expect(log).toBeDefined();
    expect(log?.type).toBe("info");
  });

  it("存在しない ruleId の場合は何も変わらないこと", () => {
    const before = useGameStore.getState().tradeRules.length;
    useGameStore.getState().deleteTradeRule("nonexistent_rule");
    const after = useGameStore.getState();
    expect(after.tradeRules.length).toBe(before);
  });
});

describe("tradeRuleActions - toggleTradeRule", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame(false);
    useGameStore.setState({
      tradeRules: [
        {
          id: "rule_1",
          itemId: "potion",
          type: "sell" as const,
          threshold: 10,
          isEnabled: true,
        },
      ],
    });
  });

  it("isEnabled が true→false に切り替わること", () => {
    useGameStore.getState().toggleTradeRule("rule_1");
    expect(useGameStore.getState().tradeRules[0].isEnabled).toBe(false);
  });

  it("再度トグルすると false→true に戻ること", () => {
    useGameStore.getState().toggleTradeRule("rule_1");
    useGameStore.getState().toggleTradeRule("rule_1");
    expect(useGameStore.getState().tradeRules[0].isEnabled).toBe(true);
  });

  it("存在しない ruleId の場合は何も変わらないこと", () => {
    useGameStore.getState().toggleTradeRule("nonexistent_rule");
    expect(useGameStore.getState().tradeRules[0].isEnabled).toBe(true);
  });
});
