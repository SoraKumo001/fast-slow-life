import { create } from "zustand";
import { persist } from "zustand/middleware";

import { STARTING_GOLD, TIER_LIMIT_DAYS } from "../constants";
import { GameState, GameActions, StoreSet, StoreGet } from "../types/game";
import { createBossActions } from "./actions/bossActions";
import { createCraftActions } from "./actions/craftActions";
import { createEquipActions } from "./actions/equipActions";
import { createInventoryActions } from "./actions/inventoryActions";
import { createLogActions } from "./actions/logActions";
import { createSalaryActions } from "./actions/salaryActions";
import { createSoulActions } from "./actions/soulActions";
import { createTimeActions } from "./actions/timeActions";
import { createTradeActions } from "./actions/tradeActions";
import { createTradeRuleActions } from "./actions/tradeRuleActions";
import { createVillagerActions } from "./actions/villagerActions";
import {
  getInitialVillagers,
  getInitialFacilities,
  getInitialDungeons,
  getDefaultTargetAmounts,
  DEFAULT_INVENTORY,
  getInitialTowns,
  getInitialCaravans,
  getInitialStats,
} from "./initialState";
import { partialize, merge, customStorage } from "./persistence";

declare global {
  var IS_TEST_ENVIRONMENT: boolean | undefined;
}

type FullStore = GameState & GameActions;

const createStore = (set: StoreSet, get: StoreGet): FullStore => ({
  currentDay: 1,
  currentHour: 0,
  gold: STARTING_GOLD,
  soulPoints: 0,
  villagers: getInitialVillagers(0),
  facilities: getInitialFacilities(),
  dungeons: getInitialDungeons(),
  inventory: { ...DEFAULT_INVENTORY },
  targetAmounts: getDefaultTargetAmounts(),
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
  gameOverReason: "",
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
  towns: getInitialTowns(),
  caravans: getInitialCaravans(),
  isSalaryUnpaid: false,
  consecutiveNegativeGoldDays: 0,
  lastSchedulerTick: -4,
  stats: getInitialStats(),

  ...createLogActions(set as StoreSet, get as StoreGet),
  ...createTimeActions(set as StoreSet, get as StoreGet),
  ...createInventoryActions(set as StoreSet, get as StoreGet),
  ...createEquipActions(set as StoreSet, get as StoreGet),
  ...createTradeRuleActions(set as StoreSet, get as StoreGet),
  ...createVillagerActions(set as StoreSet, get as StoreGet),
  ...createCraftActions(set as StoreSet, get as StoreGet),
  ...createBossActions(set as StoreSet, get as StoreGet),
  ...createSoulActions(set as StoreSet, get as StoreGet),
  ...createTradeActions(set as StoreSet, get as StoreGet),
  ...createSalaryActions(set as StoreSet, get as StoreGet),
});

import type { UseBoundStore } from "zustand/react";
import type { StoreApi } from "zustand/vanilla";

export const useGameStore = (globalThis.IS_TEST_ENVIRONMENT
  ? create<FullStore>()(createStore)
  : create<FullStore>()(
      persist<FullStore, [], [], GameState>(createStore, {
        name: "fast-slow-life-save-state",
        partialize,
        merge,
        storage: customStorage,
      }),
    )) as unknown as UseBoundStore<StoreApi<FullStore>>;
