import { GameState } from "../types/game";
import { FacilityType } from "../types/game";
import { getInitialFacilities } from "./initialState";

export const partialize = (state: GameState): Partial<GameState> => ({
  currentDay: state.currentDay,
  currentHour: state.currentHour,
  gold: state.gold,
  soulPoints: state.soulPoints,
  villagers: state.villagers,
  facilities: state.facilities,
  dungeons: state.dungeons,
  inventory: state.inventory,
  targetAmounts: state.targetAmounts,
  logs: state.logs,
  currentTier: state.currentTier,
  activeBoss: state.activeBoss,
  bossDefeated: state.bossDefeated,
  gameLimitDays: state.gameLimitDays,
  gameOver: state.gameOver,
  soulUpgrades: state.soulUpgrades,
});

export const merge = (persistedState: any, currentState: any) => {
  if (!persistedState) return currentState;

  const merged = { ...currentState, ...persistedState };

  merged.inventory = {
    ...currentState.inventory,
    ...persistedState.inventory,
  };
  merged.targetAmounts = {
    ...currentState.targetAmounts,
    ...persistedState.targetAmounts,
  };

  if (persistedState.dungeons) {
    merged.dungeons = currentState.dungeons.map((curD: any) => {
      const persD = persistedState.dungeons.find((d: any) => d.id === curD.id);
      return {
        ...curD,
        explorationProgress: persD ? persD.explorationProgress : 0,
        gathers: curD.gathers.map((curG: any) => {
          const persG = persD?.gathers?.find((g: any) => g.itemId === curG.itemId);
          return {
            ...curG,
            currentProgress: persG?.currentProgress !== undefined ? persG.currentProgress : 0,
            respawnTimeLeft: persG?.respawnTimeLeft !== undefined ? persG.respawnTimeLeft : 0,
          };
        }),
        monsters: curD.monsters.map((curM: any) => {
          const persM = persD?.monsters?.find((m: any) => m.id === curM.id);
          return {
            ...curM,
            currentProgress: persM?.currentProgress !== undefined ? persM.currentProgress : 0,
            respawnTimeLeft: persM?.respawnTimeLeft !== undefined ? persM.respawnTimeLeft : 0,
          };
        }),
      };
    });
  }

  if (persistedState.facilities) {
    const initialFacs = getInitialFacilities();
    merged.facilities = { ...persistedState.facilities };

    Object.keys(merged.facilities).forEach((key) => {
      const fac = merged.facilities[key as FacilityType];
      const initFac = initialFacs[key as FacilityType];
      if (fac && initFac && fac.level === 0) {
        fac.upgradeCost = { ...initFac.upgradeCost };
      }
    });
  }

  if (persistedState.villagers) {
    merged.villagers = persistedState.villagers.map((v: any) => ({
      ...v,
      potionCount: v.potionCount !== undefined ? v.potionCount : 0,
    }));
  }

  return merged;
};
