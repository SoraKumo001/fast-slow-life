import { MAX_LOG_COUNT } from "../../constants";
import { GameLog, GameState, GameActions } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";
import { calculateAdvanceHour } from "../gameLoopHelper";
import { calculateEarnedSp } from "../gameReset";
import { dispatchIdleVillagersHelper } from "../villagerDispatch";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

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

    const result = dispatchIdleVillagersHelper({
      villagers: state.villagers,
      inventory: state.inventory,
      targetAmounts: state.targetAmounts,
      dungeons: state.dungeons,
      currentTier: state.currentTier,
      bossDefeated: state.bossDefeated,
    });

    if (result.anyDispatched) {
      result.logs.forEach((log) => state.addLog(log.message, log.type));
      set({
        villagers: result.villagers,
        inventory: result.inventory,
      });
    }
  },

  advanceHour: () => {
    const state = get();
    if (state.gameOver) return;

    const result = calculateAdvanceHour(state);

    if (!globalThis.IS_TEST_ENVIRONMENT) {
      result.logsToAppend.forEach((log) => {
        const timestamp = `${result.currentDay}日目 ${String(result.currentHour).padStart(2, "0")}:00`;
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
      villagers: result.villagers,
      facilities: result.facilities,
      dungeons: result.dungeons,
      inventory: result.inventory,
      currentTier: result.currentTier,
      activeBoss: result.activeBoss,
      bossDefeated: result.bossDefeated,
      gameLimitDays: result.gameLimitDays,
      gameOver: result.gameOver,
      isPaused: result.isPaused,
      ...(result.gameOver && !state.gameOver
        ? {
            soulPoints:
              state.soulPoints +
              calculateEarnedSp({
                gold: state.gold,
                inventory: result.inventory,
                currentTier: result.currentTier,
                bossDefeated: result.bossDefeated,
                currentDay: result.currentDay,
              }),
          }
        : {}),
    });

    get().autoEquipAll();
    get().dispatchIdleVillagers();
  },
});
