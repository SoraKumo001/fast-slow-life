import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";

import { STARTING_GOLD, TIER_LIMIT_DAYS } from "../constants";
import { ITEMS } from "../data/masterData";
import { GameState, GameActions } from "../types/game";
import { createBossActions } from "./actions/bossActions";
import { createCraftActions } from "./actions/craftActions";
import { createInventoryActions } from "./actions/inventoryActions";
import { createLogActions } from "./actions/logActions";
import { createSoulActions } from "./actions/soulActions";
import { createTimeActions } from "./actions/timeActions";
import { createVillagerActions } from "./actions/villagerActions";
import {
  getInitialVillagers,
  getInitialFacilities,
  getInitialDungeons,
  DEFAULT_INVENTORY,
} from "./initialState";
import { partialize, merge } from "./persistence";

declare global {
  var IS_TEST_ENVIRONMENT: boolean | undefined;
}

const maybePersist = <T extends object>(
  config: StateCreator<T, [], []>,
  options: unknown,
): StateCreator<T, [], []> => {
  if (globalThis.IS_TEST_ENVIRONMENT) {
    return config;
  }
  return persist(config, options as never) as unknown as StateCreator<T, [], []>;
};

export const useGameStore = create<GameState & GameActions>()(
  maybePersist<GameState & GameActions>(
    (set, get) => ({
      currentDay: 1,
      currentHour: 0,
      gold: STARTING_GOLD,
      soulPoints: 0,
      villagers: getInitialVillagers(0),
      facilities: getInitialFacilities(),
      dungeons: getInitialDungeons(),
      inventory: { ...DEFAULT_INVENTORY },
      targetAmounts: Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
      tradeRules: [],
      logs: [
        {
          id: "init",
          timestamp: "1日目 00:00",
          message: "ゲームが開始されました。村を発展させましょう！",
          type: "system",
        },
      ],
      currentTier: 1,
      activeBoss: null,
      bossDefeated: false,
      gameLimitDays: TIER_LIMIT_DAYS[1],
      gameOver: false,
      isPaused: true,
      playSpeed: "normal",
      soulUpgrades: {
        heritage: 0,
        storage: 0,
        education: 0,
        body: 0,
        building: 0,
        discount: 0,
      },

      ...createLogActions(set, get),
      ...createTimeActions(set, get),
      ...createInventoryActions(set, get),
      ...createVillagerActions(set, get),
      ...createCraftActions(set, get),
      ...createBossActions(set, get),
      ...createSoulActions(set, get),
    }),
    {
      name: "fast-slow-life-save-state",
      partialize,
      merge,
    },
  ) as unknown as StateCreator<GameState & GameActions, [], []>,
);
