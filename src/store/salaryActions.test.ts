import { describe, it, expect, beforeEach } from "vitest";

import { useToastStore } from "../hooks/useToastStore";
import { useGameStore } from "./gameStore";

describe("payVillagerReward", () => {
  beforeEach(() => {
    // ゲーム状態と Toast 状態をリセット
    useGameStore.getState().resetGame(false);
    useToastStore.setState({ toasts: [] });
  });

  it("正常系: 100G を支払うと player gold -100, villager gold +100, log 追加", () => {
    const store = useGameStore.getState();
    useGameStore.setState((s) => ({
      gold: 1000,
      villagers: s.villagers.map((v) =>
        v.id === s.villagers[0].id ? { ...v, gold: 50, name: "テスト村人A" } : v,
      ),
    }));

    const target = useGameStore.getState().villagers[0];
    store.payVillagerReward(target.id, 100);

    const after = useGameStore.getState();
    expect(after.gold).toBe(900);
    const afterTarget = after.villagers.find((v) => v.id === target.id);
    expect(afterTarget?.gold).toBe(150);
    const rewardLog = after.logs.find((l) => l.message.includes("テスト村人A に 100 G の報奨金"));
    expect(rewardLog).toBeDefined();
    expect(rewardLog?.type).toBe("system");
  });

  it("借金完済: v.gold = -30, amount = 50 → v.gold = 20, success Toast", () => {
    useGameStore.setState((s) => ({
      gold: 1000,
      villagers: s.villagers.map((v) =>
        v.id === s.villagers[0].id ? { ...v, gold: -30, name: "借金持ち村人" } : v,
      ),
    }));

    const target = useGameStore.getState().villagers[0];
    useGameStore.getState().payVillagerReward(target.id, 50);

    const after = useGameStore.getState();
    expect(after.gold).toBe(950);
    const afterTarget = after.villagers.find((v) => v.id === target.id);
    expect(afterTarget?.gold).toBe(20);
    const toasts = useToastStore.getState().toasts;
    const debtClearToast = toasts.find((t) => t.message.includes("借金を完済"));
    expect(debtClearToast).toBeDefined();
    expect(debtClearToast?.type).toBe("success");
  });

  it("資金不足: player gold < amount → 状態不変, error Toast", () => {
    useGameStore.setState((s) => ({
      gold: 50,
      villagers: s.villagers.map((v) =>
        v.id === s.villagers[0].id ? { ...v, gold: 0, name: "村人B" } : v,
      ),
    }));

    const target = useGameStore.getState().villagers[0];
    const logsBefore = useGameStore.getState().logs.length;
    useGameStore.getState().payVillagerReward(target.id, 100);

    const after = useGameStore.getState();
    expect(after.gold).toBe(50);
    const afterTarget = after.villagers.find((v) => v.id === target.id);
    expect(afterTarget?.gold).toBe(0);
    expect(after.logs.length).toBe(logsBefore); // ログ追加なし
    const toasts = useToastStore.getState().toasts;
    const insufficientToast = toasts.find((t) => t.message.includes("ゴールドが不足"));
    expect(insufficientToast).toBeDefined();
    expect(insufficientToast?.type).toBe("error");
  });

  it("amount = 0: バリデーションエラー, 状態不変, warning Toast", () => {
    useGameStore.setState((s) => ({
      gold: 1000,
      villagers: s.villagers.map((v) =>
        v.id === s.villagers[0].id ? { ...v, gold: 0, name: "村人C" } : v,
      ),
    }));

    const target = useGameStore.getState().villagers[0];
    const goldBefore = useGameStore.getState().gold;
    useGameStore.getState().payVillagerReward(target.id, 0);

    const after = useGameStore.getState();
    expect(after.gold).toBe(goldBefore);
    const afterTarget = after.villagers.find((v) => v.id === target.id);
    expect(afterTarget?.gold).toBe(0);
    const toasts = useToastStore.getState().toasts;
    const validationToast = toasts.find((t) => t.message.includes("1G以上の整数"));
    expect(validationToast).toBeDefined();
    expect(validationToast?.type).toBe("warning");
  });

  it("amount が小数: バリデーションエラー, 状態不変", () => {
    useGameStore.setState((s) => ({
      gold: 1000,
      villagers: s.villagers.map((v) =>
        v.id === s.villagers[0].id ? { ...v, gold: 0, name: "村人D" } : v,
      ),
    }));

    const target = useGameStore.getState().villagers[0];
    useGameStore.getState().payVillagerReward(target.id, 10.5);

    const after = useGameStore.getState();
    expect(after.gold).toBe(1000);
    const afterTarget = after.villagers.find((v) => v.id === target.id);
    expect(afterTarget?.gold).toBe(0);
    const toasts = useToastStore.getState().toasts;
    const validationToast = toasts.find((t) => t.message.includes("1G以上の整数"));
    expect(validationToast).toBeDefined();
  });

  it("villager 不在: エラー Toast, 状態不変", () => {
    useGameStore.setState((s) => ({
      gold: 1000,
      villagers: s.villagers.map((v) => ({ ...v, gold: 0 })),
    }));

    const goldBefore = useGameStore.getState().gold;
    useGameStore.getState().payVillagerReward("v_nonexistent", 100);

    const after = useGameStore.getState();
    expect(after.gold).toBe(goldBefore);
    after.villagers.forEach((v) => {
      expect(v.gold).toBe(0);
    });
    const toasts = useToastStore.getState().toasts;
    const notFoundToast = toasts.find((t) => t.message.includes("対象村人が見つかりません"));
    expect(notFoundToast).toBeDefined();
    expect(notFoundToast?.type).toBe("error");
  });
});
