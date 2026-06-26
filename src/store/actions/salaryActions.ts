import { useToastStore } from "../../hooks/useToastStore";
import { StoreSet, StoreGet } from "../../types/game";

export const createSalaryActions = (set: StoreSet, get: StoreGet) => ({
  payVillagerDebts: () => {
    const state = get();
    const totalDebt = state.villagers.reduce((sum, v) => {
      return sum + (v.gold < 0 ? -v.gold : 0);
    }, 0);

    if (totalDebt <= 0) {
      state.addLog("【システム】ツケのある村人は現在いません。", "system");
      return;
    }

    if (state.gold >= totalDebt) {
      set((s) => {
        const playerGold = s.gold - totalDebt;
        const updated = s.villagers.map((v) => {
          if (v.gold < 0) {
            return { ...v, gold: 0 };
          }
          return v;
        });
        return {
          gold: playerGold,
          villagers: updated,
          logs: [
            ...s.logs,
            {
              id: `pay_debts_${Date.now()}`,
              timestamp: `${s.currentDay}日目 ${String(s.currentHour).padStart(2, "0")}:00`,
              message: `【経済】村人全員のツケ（計 ${totalDebt} G）を肩代わりして返済しました。`,
              type: "system",
            },
          ],
        };
      });
    } else {
      set((s) => {
        let playerGold = s.gold;
        let paidTotal = 0;
        const updated = s.villagers.map((v) => {
          if (v.gold < 0 && playerGold > 0) {
            const debt = -v.gold;
            if (playerGold >= debt) {
              playerGold -= debt;
              paidTotal += debt;
              return { ...v, gold: 0 };
            } else {
              const partialPaid = playerGold;
              playerGold = 0;
              paidTotal += partialPaid;
              return { ...v, gold: v.gold + partialPaid };
            }
          }
          return v;
        });

        return {
          gold: playerGold,
          villagers: updated,
          logs: [
            ...s.logs,
            {
              id: `pay_debts_partial_${Date.now()}`,
              timestamp: `${s.currentDay}日目 ${String(s.currentHour).padStart(2, "0")}:00`,
              message: `【警告】ゴールドが不足しているため、村人のツケを一部返済しました（支払額: ${paidTotal} G）。`,
              type: "warning",
            },
          ],
        };
      });
    }
  },

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

    const wasInDebt = target.gold < 0;
    const newVillagerGold = target.gold + amount;

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

    if (wasInDebt && newVillagerGold >= 0) {
      addToast(`${target.name} の借金を完済しました！能力低下が解除されます。`, "success");
    } else {
      addToast(`${target.name} に ${amount} G を支給しました。`, "success");
    }
  },
});
