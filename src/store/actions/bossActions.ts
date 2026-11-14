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
          const bossIdx = villagerIds.indexOf(v.id);
          const bossLanes = [-1.0, -0.35, 0.35, 1.0];
          const maxDepth = area?.maxDepth ?? 100;
          return {
            ...v,
            status: "active" as VillagerStatus,
            destinationAreaId: area?.id || null,
            travelTimeLeft: 0,
            order: "hunt" as OrderType,
            targetMonsterId: monsterId,
            assignedCraftJobId: null,
            dungeonState: {
              currentDepth: Math.max(0, maxDepth - 3.5),
              targetDepth: maxDepth,
              lane: bossLanes[bossIdx] ?? 0,
              phase: "fighting" as const,
              targetNodeId: monsterId,
            },
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
            dungeonState: {
              currentDepth: 0,
              targetDepth: 0,
              lane: 0,
              phase: "idle" as const,
              targetNodeId: null,
            },
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
