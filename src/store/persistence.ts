import { StateStorage, createJSONStorage } from "zustand/middleware";

import {
  GameState,
  GameActions,
  Villager,
  DungeonArea,
  DungeonGather,
  DungeonMonster,
} from "../types/game";
import { FacilityType } from "../types/game";
import { getInitialFacilities, getInitialTowns, getInitialCaravans } from "./initialState";

export const partialize = (state: GameState & GameActions): GameState => ({
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
  isPaused: state.isPaused,
  playSpeed: state.playSpeed,
  soulUpgrades: state.soulUpgrades,
  tradeRules: state.tradeRules,
  towns: state.towns,
  caravans: state.caravans,
  marketTrend: state.marketTrend,
  isSalaryUnpaid: state.isSalaryUnpaid,
});

export const merge = <S extends GameState & GameActions>(
  persistedState: unknown,
  currentState: S,
): S => {
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
      staminaDrinkItemId:
        v.staminaDrinkItemId !== undefined ? v.staminaDrinkItemId : "stamina_drink",
      staminaDrinkCount: v.staminaDrinkCount !== undefined ? v.staminaDrinkCount : 0,
      bonusStr: v.bonusStr !== undefined ? v.bonusStr : 0,
      bonusInt: v.bonusInt !== undefined ? v.bonusInt : 0,
      bonusDex: v.bonusDex !== undefined ? v.bonusDex : 0,
      bonusAgi: v.bonusAgi !== undefined ? v.bonusAgi : 0,
      bonusVit: v.bonusVit !== undefined ? v.bonusVit : 0,
      bonusMaxHp: v.bonusMaxHp !== undefined ? v.bonusMaxHp : 0,
      bonusMaxStamina: v.bonusMaxStamina !== undefined ? v.bonusMaxStamina : 0,
      activeFoodBuffId: v.activeFoodBuffId !== undefined ? v.activeFoodBuffId : null,
    }));
  }

  merged.tradeRules = persisted.tradeRules || [];
  merged.towns = persisted.towns || getInitialTowns();
  merged.caravans = persisted.caravans || getInitialCaravans();
  merged.marketTrend = persisted.marketTrend !== undefined ? persisted.marketTrend : null;
  merged.isSalaryUnpaid = persisted.isSalaryUnpaid !== undefined ? persisted.isSalaryUnpaid : false;

  return merged;
};

// ==========================================
// デバウンス付き永続化ストレージの実装
// ==========================================
const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const createDebouncedLocalStorage = (delayMs: number): StateStorage => {
  const storage = window.localStorage;
  const pendingWrites = new Map<string, string>();
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (name: string) => {
    if (pendingWrites.has(name)) {
      try {
        storage.setItem(name, pendingWrites.get(name)!);
      } catch (e) {
        console.error(e);
      }
      pendingWrites.delete(name);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
        timeouts.delete(name);
      }
    }
  };

  const flushAll = () => {
    Array.from(pendingWrites.keys()).forEach(flush);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushAll);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushAll();
      }
    });
  }

  return {
    getItem: (name) => {
      if (pendingWrites.has(name)) {
        return pendingWrites.get(name)!;
      }
      return storage.getItem(name);
    },
    setItem: (name, value) => {
      pendingWrites.set(name, value);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
      }
      timeouts.set(
        name,
        setTimeout(() => {
          flush(name);
        }, delayMs),
      );
    },
    removeItem: (name) => {
      pendingWrites.delete(name);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
        timeouts.delete(name);
      }
      storage.removeItem(name);
    },
  };
};

const createDummyStorage = (): StateStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) || null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
};

const storageImpl = isBrowser ? createDebouncedLocalStorage(1000) : createDummyStorage();

export const customStorage = createJSONStorage(() => storageImpl);
