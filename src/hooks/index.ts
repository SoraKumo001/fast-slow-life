import { shallow } from "zustand/shallow";

import { useGameStore } from "../store/gameStore";

export const useGameTime = () =>
  useGameStore((s) => ({ currentDay: s.currentDay, currentHour: s.currentHour }), shallow);

export const usePlayerResources = () =>
  useGameStore((s) => ({ gold: s.gold, soulPoints: s.soulPoints }), shallow);

export const useInventory = () =>
  useGameStore(
    (s) => ({
      inventory: s.inventory,
      targetAmounts: s.targetAmounts,
      tradeRules: s.tradeRules,
      caravans: s.caravans,
    }),
    shallow,
  );

export const useInventoryActions = () =>
  useGameStore(
    (s) => ({
      setTargetAmount: s.setTargetAmount,
      addTradeRule: s.addTradeRule,
      updateTradeRule: s.updateTradeRule,
      deleteTradeRule: s.deleteTradeRule,
      toggleTradeRule: s.toggleTradeRule,
    }),
    shallow,
  );

export const useVillagers = () => useGameStore((s) => s.villagers);

export const useFacilities = () => useGameStore((s) => s.facilities);

export const useDungeons = () =>
  useGameStore(
    (s) => ({
      dungeons: s.dungeons,
      currentTier: s.currentTier,
      activeBoss: s.activeBoss,
      bossDefeated: s.bossDefeated,
    }),
    shallow,
  );

export const useGameStatus = () =>
  useGameStore(
    (s) => ({
      isPaused: s.isPaused,
      playSpeed: s.playSpeed,
      gameOver: s.gameOver,
      gameLimitDays: s.gameLimitDays,
    }),
    shallow,
  );

export const useLogs = () => useGameStore((s) => s.logs);

export const useSoulUpgrades = () => useGameStore((s) => s.soulUpgrades);

export const useGameControls = () =>
  useGameStore(
    (s) => ({
      togglePause: s.togglePause,
      setPlaySpeed: s.setPlaySpeed,
      advanceDay: s.advanceDay,
      advanceHour: s.advanceHour,
    }),
    shallow,
  );

export const useVillagerActions = () =>
  useGameStore(
    (s) => ({
      setVillagerOrder: s.setVillagerOrder,
      changeVillagerJob: s.changeVillagerJob,
      hireVillager: s.hireVillager,
    }),
    shallow,
  );

export const useEquipmentActions = () =>
  useGameStore((s) => ({ equipItem: s.equipItem, unequipItem: s.unequipItem }), shallow);

export const useCraftActions = () =>
  useGameStore(
    (s) => ({ startCraft: s.startCraft, startFacilityUpgrade: s.startFacilityUpgrade }),
    shallow,
  );

export const useBossActions = () =>
  useGameStore(
    (s) => ({
      startBossBattle: s.startBossBattle,
      withdrawFromBossBattle: s.withdrawFromBossBattle,
    }),
    shallow,
  );

export const useSoulActions = () =>
  useGameStore((s) => ({ buySoulUpgrade: s.buySoulUpgrade, resetGame: s.resetGame }), shallow);
