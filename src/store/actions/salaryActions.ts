import { useToastStore } from "../../hooks/useToastStore";
import { StoreSet, StoreGet } from "../../types/game";

export const createSalaryActions = (set: StoreSet, get: StoreGet) => ({
  payVillagerReward: (villagerId: string, amount: number) => {
    const addToast = useToastStore.getState().addToast;

    // バリデーション: 金額は正の整数
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      addToast("報奨金は1G以上の整数で指定してください", "warning");
      return;
    }

    const state = get();
    const target = state.villagers.find((v) => v.id === villagerId);
    if (!target) {
      addToast("対象村人が見つかりません", "error");
      return;
    }

    if (state.gold < amount) {
      addToast(`ゴールドが不足しています（必要: ${amount} G / 所持: ${state.gold} G）`, "error");
      return;
    }

    set((s) => ({
      gold: s.gold - amount,
      villagers: s.villagers.map((v) =>
        v.id === villagerId ? { ...v, gold: v.gold + amount } : v,
      ),
      logs: [
        ...s.logs,
        {
          id: `reward_${villagerId}_${Date.now()}`,
          timestamp: `${s.currentDay}日目 ${String(s.currentHour).padStart(2, "0")}:00`,
          message: `【報奨】${target.name} に ${amount} G の報奨金を支払いました。`,
          type: "system",
        },
      ],
    }));

    addToast(`${target.name} に ${amount} G を支給しました。`, "success");
  },
});
