import { ITEMS } from "../../data/masterData";
import { OrderType, JobType, StoreSet, StoreGet } from "../../types/game";
import { hireVillagerHelper } from "../villagerHire";
import { changeVillagerJobHelper } from "../villagerJob";
import { setVillagerOrderHelper } from "../villagerOrder";

export const createVillagerActions = (set: StoreSet, get: StoreGet) => ({
  setVillagerOrder: (params: {
    id: string;
    order: OrderType;
    areaId: string | null;
    targetMonsterId?: string | null;
  }) => {
    const state = get();
    // Phase 4b: 襲撃発生中のダンジョンへは新規派遣できない
    if (params.areaId && state.raid?.dungeonId === params.areaId) {
      const area = state.dungeons.find((d) => d.id === params.areaId);
      state.addLog(
        `【襲撃】${area?.name ?? "ダンジョン"} は魔物の群れが接近中のため派遣できません。`,
        "warning",
      );
      return;
    }
    const result = setVillagerOrderHelper({
      villagerId: params.id,
      order: params.order,
      areaId: params.areaId,
      targetMonsterId: params.targetMonsterId,
      villagers: state.villagers,
      inventory: state.inventory,
      gold: state.gold,
    });

    result.logs.forEach((log) => state.addLog(log.message, log.type));
    set({
      villagers: result.villagers,
      inventory: result.inventory,
      gold: result.gold,
    });
  },

  // Phase 4a: 探索中の村人を帰還させる。自然帰還（消耗時）と同じ遷移を踏む:
  // status=traveling_back / order=rest（到着後は休息）/ dungeonState.phase=returning。
  recallVillager: (villagerId: string) => {
    const state = get();
    const target = state.villagers.find((v) => v.id === villagerId);
    if (!target) return;
    // ボス戦参加中は帰還させない
    if (state.activeBoss?.attackerIds.includes(villagerId)) return;

    let changed = false;
    const villagers = state.villagers.map((v) => {
      if (v.id !== villagerId) return v;
      const area = state.dungeons.find((d) => d.id === v.destinationAreaId);
      if (!area) return v;
      if (v.status === "active") {
        changed = true;
        return {
          ...v,
          status: "traveling_back" as const,
          travelTimeLeft: area.distance,
          order: "rest" as const,
          autoTargetName: null,
          dungeonState: v.dungeonState
            ? { ...v.dungeonState, phase: "returning" as const, targetDepth: 0 }
            : v.dungeonState,
        };
      }
      if (v.status === "traveling_to") {
        changed = true;
        // 進んだ分だけ引き返す
        const remaining = Math.max(1, area.distance - (v.travelTimeLeft || 0));
        return {
          ...v,
          status: "traveling_back" as const,
          travelTimeLeft: remaining,
          order: "rest" as const,
          autoTargetName: null,
          dungeonState: v.dungeonState
            ? { ...v.dungeonState, phase: "returning" as const, targetDepth: 0 }
            : v.dungeonState,
        };
      }
      return v;
    });

    if (changed) {
      set({ villagers });
      state.addLog(`【帰還指示】${target.name} に帰還を指示しました。`, "info");
    }
  },

  // Phase 4a: 最大4人を同一ターゲットへ一括派遣する（新しいパーティ状態は持たない）。
  // 既存の setVillagerOrder を連鎖適用し、共通ターゲット名を autoTargetName に揃える
  // （採取は gatherLogic の事前割当、討伐は processPartyHunt のパーティ戦闘が参照する）。
  dispatchParty: (params: {
    villagerIds: string[];
    areaId: string;
    order: "gather" | "hunt";
    targetId?: string | null;
  }) => {
    const state = get();
    const ids = params.villagerIds.slice(0, 4);
    if (ids.length === 0) return;

    // Phase 4b: 襲撃発生中のダンジョンへは新規派遣できない
    if (state.raid?.dungeonId === params.areaId) {
      const area = state.dungeons.find((d) => d.id === params.areaId);
      state.addLog(
        `【襲撃】${area?.name ?? "ダンジョン"} は魔物の群れが接近中のため派遣できません。`,
        "warning",
      );
      return;
    }

    let villagers = state.villagers;
    let inventory = state.inventory;
    let gold = state.gold;
    for (const id of ids) {
      const result = setVillagerOrderHelper({
        villagerId: id,
        order: params.order,
        areaId: params.areaId,
        targetMonsterId: params.order === "hunt" ? (params.targetId ?? null) : null,
        villagers,
        inventory,
        gold,
      });
      villagers = result.villagers;
      inventory = result.inventory;
      gold = result.gold;
      result.logs.forEach((log) => state.addLog(log.message, log.type));
    }

    const area = state.dungeons.find((d) => d.id === params.areaId);
    let targetName: string | null = null;
    if (params.targetId) {
      targetName =
        params.order === "gather"
          ? (ITEMS[params.targetId]?.name ?? null)
          : (area?.monsters.find((m) => m.id === params.targetId)?.name ?? null);
    }
    if (targetName) {
      villagers = villagers.map((v) =>
        ids.includes(v.id)
          ? {
              ...v,
              autoTargetName: targetName,
              // 討伐パーティは processPartyHunt の対象条件（offset 定義済み + 同一 target 名）
              ...(params.order === "hunt" ? { partyEngagementOffset: 0 } : {}),
            }
          : v,
      );
      state.addLog(
        `【パーティ派遣】${ids.length} 人を ${area?.name ?? ""} の「${targetName}」へ派遣しました。`,
        "info",
      );
    }

    set({ villagers, inventory, gold });
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
