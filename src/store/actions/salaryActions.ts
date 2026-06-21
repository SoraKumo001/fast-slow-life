import { StoreSet, StoreGet } from "../../types/game";

export const createSalaryActions = (set: StoreSet, get: StoreGet) => ({
  paySalaryDebt: () => {
    const state = get();
    const dailySalaryTotal = state.villagers.reduce((sum, v) => {
      if (v.currentJob === "無職") return sum;
      const totalStat = v.str + v.int + v.dex + v.agi + v.vit;
      return sum + Math.floor(totalStat * 0.1);
    }, 0);

    if (state.gold >= dailySalaryTotal) {
      set((s) => ({
        gold: s.gold - dailySalaryTotal,
        isSalaryUnpaid: false,
        logs: [
          ...s.logs,
          {
            id: `pay_salary_${Date.now()}`,
            timestamp: `${s.currentDay}日目 ${String(s.currentHour).padStart(2, "0")}:00`,
            message: `【給与】未払い給与（計 ${dailySalaryTotal} G）を支払い、デバフを解除しました。`,
            type: "system",
          },
        ],
      }));
    } else {
      set((s) => ({
        logs: [
          ...s.logs,
          {
            id: `pay_salary_failed_${Date.now()}`,
            timestamp: `${s.currentDay}日目 ${String(s.currentHour).padStart(2, "0")}:00`,
            message: `【警告】ゴールドが不足しているため、給与（計 ${dailySalaryTotal} G）を支払えません。`,
            type: "warning",
          },
        ],
      }));
    }
  },
});
