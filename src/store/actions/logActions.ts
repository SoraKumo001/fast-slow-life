import { MAX_LOG_COUNT } from "../../constants";
import { GameLog, GameState, GameActions } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

export const createLogActions = (set: StoreSet, get: StoreGet) => ({
  addLog: (message: string, type: GameLog["type"]) => {
    if (globalThis.IS_TEST_ENVIRONMENT) return;
    const { currentDay, currentHour } = get();
    const timestamp = `${currentDay}日目 ${String(currentHour).padStart(2, "0")}:00`;
    const newLog: GameLog = {
      id: generateId(),
      timestamp,
      message,
      type,
    };
    set((state) => ({
      logs: [newLog, ...state.logs].slice(0, MAX_LOG_COUNT),
    }));
  },
});
