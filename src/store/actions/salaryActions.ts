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
});
