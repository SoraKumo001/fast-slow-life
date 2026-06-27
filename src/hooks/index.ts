import { useShallow } from "zustand/react/shallow";

import { useGameStore } from "../store/gameStore";

export const useGameTime = () =>
  useGameStore(
    useShallow((s) => ({
      currentDay: s.currentDay,
      currentHour: s.currentHour,
    })),
  );

export const usePlayerResources = () =>
  useGameStore(useShallow((s) => ({ gold: s.gold, soulPoints: s.soulPoints })));

export const useInventory = () =>
  useGameStore(
    useShallow((s) => ({
      inventory: s.inventory,
      targetAmounts: s.targetAmounts,
      tradeRules: s.tradeRules,
      caravans: s.caravans,
    })),
  );

export const useInventoryActions = () =>
  useGameStore(
    useShallow((s) => ({
      setTargetAmount: s.setTargetAmount,
      addTradeRule: s.addTradeRule,
      updateTradeRule: s.updateTradeRule,
      deleteTradeRule: s.deleteTradeRule,
      toggleTradeRule: s.toggleTradeRule,
    })),
  );

export const useVillagers = () => useGameStore((s) => s.villagers);

export const useFacilities = () => useGameStore((s) => s.facilities);

export const useDungeons = () =>
  useGameStore(
    useShallow((s) => ({
      dungeons: s.dungeons,
      currentTier: s.currentTier,
      activeBoss: s.activeBoss,
      bossDefeated: s.bossDefeated,
    })),
  );

export const useGameStatus = () =>
  useGameStore(
    useShallow((s) => ({
      isPaused: s.isPaused,
      playSpeed: s.playSpeed,
      gameOver: s.gameOver,
      gameOverReason: s.gameOverReason,
    })),
  );

export const useLogs = () => useGameStore((s) => s.logs);

export const useSoulUpgrades = () => useGameStore((s) => s.soulUpgrades);

export const useGameControls = () =>
  useGameStore(
    useShallow((s) => ({
      togglePause: s.togglePause,
      setPlaySpeed: s.setPlaySpeed,
      advanceDay: s.advanceDay,
      advanceHour: s.advanceHour,
    })),
  );

export const useVillagerActions = () =>
  useGameStore(
    useShallow((s) => ({
      setVillagerOrder: s.setVillagerOrder,
      changeVillagerJob: s.changeVillagerJob,
      hireVillager: s.hireVillager,
    })),
  );

export const useCraftActions = () =>
  useGameStore(
    useShallow((s) => ({
      startCraft: s.startCraft,
      startFacilityUpgrade: s.startFacilityUpgrade,
      startTraining: s.startTraining,
    })),
  );

export const useBossActions = () =>
  useGameStore(
    useShallow((s) => ({
      startBossBattle: s.startBossBattle,
      withdrawFromBossBattle: s.withdrawFromBossBattle,
      offerToDungeon: s.offerToDungeon,
    })),
  );

export const useSoulActions = () =>
  useGameStore(
    useShallow((s) => ({
      buySoulUpgrade: s.buySoulUpgrade,
      downgradeSoulUpgrade: s.downgradeSoulUpgrade,
      resetGame: s.resetGame,
    })),
  );

export const useGameStats = () => useGameStore((s) => s.stats);

export const useBankruptcyWarning = () =>
  useGameStore(
    useShallow((s) => ({
      gold: s.gold,
      consecutiveNegativeGoldDays: s.consecutiveNegativeGoldDays,
    })),
  );

export const useThreatData = () =>
  useGameStore(
    useShallow((s) => ({
      dungeons: s.dungeons,
      maxThreatLevelReached: s.maxThreatLevelReached,
      currentTier: s.currentTier,
      bossDefeated: s.bossDefeated,
    })),
  );
