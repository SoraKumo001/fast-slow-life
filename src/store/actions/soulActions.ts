import { SOUL_UPGRADES } from "../../data/masterData";
import { StoreSet, StoreGet } from "../../types/game";
import { resetGameHelper } from "../gameReset";

export const createSoulActions = (set: StoreSet, get: StoreGet) => ({
  buySoulUpgrade: (upgradeId: string) => {
    const state = get();
    const currentLvl = state.soulUpgrades[upgradeId] || 0;
    const uDef = SOUL_UPGRADES.find((u) => u.id === upgradeId);
    if (!uDef || currentLvl >= uDef.maxLevel) return;

    const cost = uDef.costs[currentLvl];
    if (state.soulPoints < cost) {
      state.addLog("ソウルポイントが不足しています。", "warning");
      return;
    }

    set((state) => ({
      soulPoints: state.soulPoints - cost,
      soulUpgrades: {
        ...state.soulUpgrades,
        [upgradeId]: currentLvl + 1,
      },
    }));

    state.addLog(`転生バフ【${uDef.name}】のレベルを ${currentLvl + 1} に強化しました。`, "system");
  },

  downgradeSoulUpgrade: (upgradeId: string) => {
    const state = get();
    const currentLvl = state.soulUpgrades[upgradeId] || 0;
    const uDef = SOUL_UPGRADES.find((u) => u.id === upgradeId);
    if (!uDef || currentLvl <= 0) return;

    // 払戻額 = 現レベル到達時に支払ったSP（costs[currentLvl - 1]）
    const refund = uDef.costs[currentLvl - 1];
    const nextLvl = currentLvl - 1;

    set((state) => ({
      soulPoints: state.soulPoints + refund,
      soulUpgrades: {
        ...state.soulUpgrades,
        [upgradeId]: nextLvl,
      },
    }));

    state.addLog(
      `転生バフ【${uDef.name}】のレベルを ${nextLvl} に戻し、${refund} SP を払い戻しました。`,
      "system",
    );
  },

  resetGame: (prestige = false) => {
    const state = get();
    const result = resetGameHelper({
      prestige,
      state: {
        gameOver: state.gameOver,
        gold: state.gold,
        inventory: state.inventory,
        currentTier: state.currentTier,
        bossDefeated: state.bossDefeated,
        currentDay: state.currentDay,
        soulPoints: state.soulPoints,
        soulUpgrades: state.soulUpgrades,
        maxThreatLevelReached: state.maxThreatLevelReached,
      },
    });

    set({
      currentDay: result.currentDay,
      currentHour: result.currentHour,
      gold: result.gold,
      soulPoints: result.soulPoints,
      villagers: result.villagers,
      facilities: result.facilities,
      dungeons: result.dungeons,
      inventory: result.inventory,
      targetAmounts: result.targetAmounts,
      tradeRules: result.tradeRules,
      logs: result.logs,
      currentTier: result.currentTier,
      activeBoss: result.activeBoss,
      bossDefeated: result.bossDefeated,
      tierStartDay: result.tierStartDay,
      gameOver: result.gameOver,
      gameOverReason: result.gameOverReason,
      isPaused: result.isPaused,
      towns: result.towns,
      caravans: result.caravans,
      isSalaryUnpaid: result.isSalaryUnpaid,
      consecutiveNegativeGoldDays: result.consecutiveNegativeGoldDays,
      stats: result.stats,
    });
  },
});
