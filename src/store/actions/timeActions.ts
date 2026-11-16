import { MAX_LOG_COUNT } from "../../constants";
import { GameLog, StoreSet, StoreGet } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";
import { formatGameTime } from "../../utils/timeHelpers";
import { calculateAdvanceHour } from "../gameLoop";
import { calculateEarnedSp } from "../gameReset";
import { getTotalElapsedHours, isRaidFighting } from "../raidLogic";
import { dispatchIdleVillagersHelper } from "../villagerDispatch";

export const createTimeActions = (set: StoreSet, get: StoreGet) => ({
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  setPlaySpeed: (speed: "normal" | "fast" | "super") => set({ playSpeed: speed }),

  advanceDay: () => {
    const state = get();
    if (state.gameOver || !state.isPaused) return;
    state.addLog("【システム】1日（24時間）スキップを開始します。", "system");
    for (let i = 0; i < 24; i++) {
      if (get().gameOver) break;
      get().advanceHour();
    }
    state.addLog("【システム】1日スキップが完了しました。", "system");
  },

  dispatchIdleVillagers: () => {
    const state = get();
    const { villagers } = state;
    const hasIdleVillagers = villagers.some((v) => v.status === "idle" && v.order !== "rest");
    if (!hasIdleVillagers) return;

    // Phase 4b: 防衛戦の最中は町の村人が防衛に就いているため自動派遣を止める
    if (isRaidFighting(state.raid ?? null, getTotalElapsedHours(state.currentDay, state.currentHour))) {
      return;
    }

    const result = dispatchIdleVillagersHelper({
      villagers: state.villagers,
      inventory: state.inventory,
      targetAmounts: state.targetAmounts,
      dungeons: state.dungeons,
      currentTier: state.currentTier,
      bossDefeated: state.bossDefeated,
      gold: state.gold,
      facilities: state.facilities,
      // Phase 4b: 襲撃発生中のダンジョンへは新規派遣しない
      blockedAreaId: state.raid?.dungeonId ?? null,
    });

    if (result.anyDispatched) {
      result.logs.forEach((log) => state.addLog(log.message, log.type));
      set({
        villagers: result.villagers,
        inventory: result.inventory,
        gold: result.gold,
        facilities: result.facilities,
      });
    }
  },

  advanceHour: () => {
    const state = get();
    if (state.gameOver) return;

    const result = calculateAdvanceHour(state);

    if (!globalThis.IS_TEST_ENVIRONMENT) {
      result.logsToAppend.forEach((log) => {
        const timestamp = formatGameTime(result.currentDay, result.currentHour);
        const newLog: GameLog = {
          id: generateId(),
          timestamp,
          message: log.message,
          type: log.type,
        };
        set((s) => ({
          logs: [newLog, ...s.logs].slice(0, MAX_LOG_COUNT),
        }));
      });
    }

    set({
      currentDay: result.currentDay,
      currentHour: result.currentHour,
      gold: result.gold,
      villagers: result.villagers,
      facilities: result.facilities,
      dungeons: result.dungeons,
      inventory: result.inventory,
      currentTier: result.currentTier,
      marketPrices: result.marketPrices,
      pricePolicy: result.pricePolicy,
      lastSettlement: result.lastSettlement,
      dailyFlows: result.dailyFlows,
      activeBoss: result.activeBoss,
      bossDefeated: result.bossDefeated,
      tierStartDay: result.tierStartDay,
      gameOver: result.gameOver,
      gameOverReason: result.gameOverReason,
      isPaused: result.isPaused,
      towns: result.towns,
      caravans: result.caravans,
      revealedNodes: result.revealedNodes,
      raid: result.raid,
      raidDefeatStreak: result.raidDefeatStreak ?? 0,
      consecutiveNegativeGoldDays: result.consecutiveNegativeGoldDays,
      lastSchedulerTick: result.lastSchedulerTick,
      stats: result.stats,
      dungeonEvents: result.dungeonEvents ?? [],
      ...(result.gameOver && !state.gameOver
        ? {
            soulPoints:
              state.soulPoints +
              calculateEarnedSp({
                gold: result.gold,
                inventory: result.inventory,
                currentTier: result.currentTier,
                bossDefeated: result.bossDefeated,
                currentDay: result.currentDay,
                maxThreatLevelReached: result.maxThreatLevelReached,
              }),
          }
        : {}),
    });

    // ボス撃破検出は useBossDefeatDetector フックに移動（UI層の責務）

    get().autoEquipAll();
    get().dispatchIdleVillagers();
  },
});
