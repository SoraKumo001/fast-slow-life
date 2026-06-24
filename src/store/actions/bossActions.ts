import { MONSTERS } from "../../data/masterData";
import { FacilityType, VillagerStatus, OrderType, StoreSet, StoreGet } from "../../types/game";

export const createBossActions = (set: StoreSet, get: StoreGet) => ({
  startBossBattle: (monsterId: string, villagerIds: string[]) => {
    const monster = MONSTERS[monsterId];
    if (!monster) return;

    set((state) => {
      const updatedVillagers = state.villagers.map((v) => {
        if (villagerIds.includes(v.id)) {
          const area = state.dungeons.find((d) => d.monsters.some((m) => m.id === monsterId));
          return {
            ...v,
            status: "active" as VillagerStatus,
            destinationAreaId: area?.id || null,
            travelTimeLeft: 0,
            order: "hunt" as OrderType,
            targetMonsterId: monsterId,
            assignedCraftJobId: null,
          };
        }
        return v;
      });

      const updatedFacilities = { ...state.facilities };
      Object.keys(updatedFacilities).forEach((key) => {
        const fac = updatedFacilities[key as FacilityType];
        fac.craftQueue = fac.craftQueue.map((job) => {
          if (job.assignedVillagerId && villagerIds.includes(job.assignedVillagerId)) {
            return { ...job, assignedVillagerId: null };
          }
          return job;
        });
      });

      return {
        activeBoss: {
          monsterId,
          currentHp: monster.hp,
          maxHp: monster.maxHp,
          attackerIds: villagerIds,
        },
        villagers: updatedVillagers,
        facilities: updatedFacilities,
        isPaused: false,
      };
    });

    get().addLog(`エリアボス【${monster.name}】との決戦を開始しました！`, "system");
  },

  withdrawFromBossBattle: () => {
    set((state) => {
      if (!state.activeBoss) return state;

      const updatedVillagers = state.villagers.map((v) => {
        if (state.activeBoss?.attackerIds.includes(v.id)) {
          return {
            ...v,
            status: "idle" as VillagerStatus,
            destinationAreaId: null,
            travelTimeLeft: 0,
            order: "gather" as OrderType,
            targetMonsterId: null,
            autoTargetName: null,
          };
        }
        return v;
      });

      return {
        activeBoss: null,
        villagers: updatedVillagers,
      };
    });

    get().addLog("ボス戦から撤退しました。", "info");
  },
});
