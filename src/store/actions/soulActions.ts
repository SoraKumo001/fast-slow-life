import { SOUL_UPGRADES } from "../../data/masterData";
import { GameState, GameActions } from "../../types/game";
import { resetGameHelper } from "../gameReset";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

export const createSoulActions = (set: StoreSet, get: StoreGet) => ({
  buySoulUpgrade: (upgradeId: string) => {
    const state = get();
    const currentLvl = state.soulUpgrades[upgradeId] || 0;
    const uDef = SOUL_UPGRADES.find((u) => u.id === upgradeId);
    if (!uDef || currentLvl >= uDef.maxLevel) return;

    const cost = uDef.costPerLevel * (currentLvl + 1);
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
      logs: result.logs,
      currentTier: result.currentTier,
      activeBoss: result.activeBoss,
      bossDefeated: result.bossDefeated,
      gameLimitDays: result.gameLimitDays,
      gameOver: result.gameOver,
      isPaused: result.isPaused,
    });
  },
});
