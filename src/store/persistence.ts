import { GameState, Villager, DungeonArea, DungeonGather, DungeonMonster } from "../types/game";
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

export const merge = <S extends GameState>(persistedState: unknown, currentState: S): S => {
  if (!persistedState) return currentState;
  const persisted = persistedState as Partial<GameState>;

  const merged: S = { ...currentState, ...persisted };

  merged.inventory = {
    ...currentState.inventory,
    ...persisted.inventory,
  };
  merged.targetAmounts = {
    ...currentState.targetAmounts,
    ...persisted.targetAmounts,
  };

  if (persisted.dungeons) {
    merged.dungeons = currentState.dungeons.map((curD: DungeonArea) => {
      const persD = persisted.dungeons!.find((d: DungeonArea) => d.id === curD.id);
      return {
        ...curD,
        explorationProgress: persD ? persD.explorationProgress : 0,
        gathers: curD.gathers.map((curG: DungeonGather) => {
          const persG = persD?.gathers?.find((g: DungeonGather) => g.itemId === curG.itemId);
          return {
            ...curG,
            currentProgress: persG?.currentProgress !== undefined ? persG.currentProgress : 0,
            respawnTimeLeft: persG?.respawnTimeLeft !== undefined ? persG.respawnTimeLeft : 0,
          };
        }),
        monsters: curD.monsters.map((curM: DungeonMonster) => {
          const persM = persD?.monsters?.find((m: DungeonMonster) => m.id === curM.id);
          return {
            ...curM,
            currentProgress: persM?.currentProgress !== undefined ? persM.currentProgress : 0,
            respawnTimeLeft: persM?.respawnTimeLeft !== undefined ? persM.respawnTimeLeft : 0,
          };
        }),
      };
    });
  }

  if (persisted.facilities) {
    const initialFacs = getInitialFacilities();
    merged.facilities = { ...persisted.facilities };

    Object.keys(merged.facilities).forEach((key) => {
      const fac = merged.facilities[key as FacilityType];
      const initFac = initialFacs[key as FacilityType];
      if (fac && initFac && fac.level === 0) {
        fac.upgradeCost = { ...initFac.upgradeCost };
      }
    });
  }

  if (persisted.villagers) {
    merged.villagers = persisted.villagers.map((v: Villager) => ({
      ...v,
      potionCount: v.potionCount !== undefined ? v.potionCount : 0,
      bonusStr: v.bonusStr !== undefined ? v.bonusStr : 0,
      bonusInt: v.bonusInt !== undefined ? v.bonusInt : 0,
      bonusDex: v.bonusDex !== undefined ? v.bonusDex : 0,
      bonusAgi: v.bonusAgi !== undefined ? v.bonusAgi : 0,
      bonusVit: v.bonusVit !== undefined ? v.bonusVit : 0,
      bonusMaxHp: v.bonusMaxHp !== undefined ? v.bonusMaxHp : 0,
      bonusMaxStamina: v.bonusMaxStamina !== undefined ? v.bonusMaxStamina : 0,
    }));
  }

  return merged;
};
