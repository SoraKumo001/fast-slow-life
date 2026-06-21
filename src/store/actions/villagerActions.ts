import { GameState, GameActions, OrderType, JobType } from "../../types/game";
import { hireVillagerHelper } from "../villagerHire";
import { changeVillagerJobHelper } from "../villagerJob";
import { setVillagerOrderHelper } from "../villagerOrder";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

export const createVillagerActions = (set: StoreSet, get: StoreGet) => ({
  setVillagerOrder: (
    id: string,
    order: OrderType,
    areaId: string | null,
    targetGatherItemId?: string | null,
    targetMonsterId?: string | null,
  ) => {
    const state = get();
    const result = setVillagerOrderHelper({
      villagerId: id,
      order,
      areaId,
      targetGatherItemId,
      targetMonsterId,
      villagers: state.villagers,
      inventory: state.inventory,
    });

    result.logs.forEach((log) => state.addLog(log.message, log.type));
    set({
      villagers: result.villagers,
      inventory: result.inventory,
    });
  },

  changeVillagerJob: (id: string, job: JobType) => {
    const state = get();
    const result = changeVillagerJobHelper({
      villagerId: id,
      job,
      villagers: state.villagers,
      gold: state.gold,
      soulUpgrades: state.soulUpgrades,
    });

    result.logs.forEach((log) => state.addLog(log.message, log.type));
    if (result.success) {
      set({
        villagers: result.villagers,
        gold: result.gold,
      });
      get().autoEquipAll();
    }
  },

  hireVillager: () => {
    const state = get();
    const result = hireVillagerHelper({
      gold: state.gold,
      villagers: state.villagers,
      guildFacility: state.facilities.guild,
      soulUpgrades: state.soulUpgrades,
    });

    result.logs.forEach((log) => state.addLog(log.message, log.type));
    if (result.success) {
      set({
        gold: result.gold,
        villagers: result.villagers,
      });
      get().autoEquipAll();
      get().dispatchIdleVillagers();
    }
  },
});
