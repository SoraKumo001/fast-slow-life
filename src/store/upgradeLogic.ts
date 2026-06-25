import { BUILDING_COST_REDUCTION } from "../constants";
import type { Facility, FacilityType, Villager, GameState } from "../types/game";
import { calculateUpgradeTime, selectBestUpgradeVillager } from "../utils/upgradeHelpers";

export interface StartUpgradeResult {
  facilities: Record<FacilityType, Facility>;
  villagers: Villager[];
  inventory: Record<string, number>;
  gold: number;
  logMessage: string;
  logType: "warning" | "upgrade";
}

export function startFacilityUpgradeHelper(
  state: GameState,
  facilityId: FacilityType,
  villagerId?: string,
): StartUpgradeResult | null {
  const facility = state.facilities[facilityId];
  if (!facility || facility.level >= facility.maxLevel) return null;

  // すでにアップグレード中または予約済み
  if (facility.upgradeTimeLeft > 0 || facility.upgradeAssignedVillagerId) {
    return {
      facilities: state.facilities,
      villagers: state.villagers,
      inventory: state.inventory,
      gold: state.gold,
      logMessage: `${facility.name} はすでにアップグレードが進行中です。`,
      logType: "warning",
    };
  }

  const buildLvl = state.soulUpgrades.building || 0;
  const costReduction = 1 - buildLvl * BUILDING_COST_REDUCTION;

  const goldCost = Math.floor(facility.upgradeCost.gold * costReduction);
  if (state.gold < goldCost) {
    return {
      facilities: state.facilities,
      villagers: state.villagers,
      inventory: state.inventory,
      gold: state.gold,
      logMessage: "ゴールドが不足しています。",
      logType: "warning",
    };
  }

  const missing = facility.upgradeCost.materials.filter((req) => {
    const reqCount = Math.floor(req.count * costReduction);
    return (state.inventory[req.itemId] || 0) < reqCount;
  });

  if (missing.length > 0) {
    return {
      facilities: state.facilities,
      villagers: state.villagers,
      inventory: state.inventory,
      gold: state.gold,
      logMessage: "アップグレードの必要素材が不足しています。",
      logType: "warning",
    };
  }

  // 担当村人の選択
  let selectedVillager: Villager | null = null;
  if (villagerId) {
    selectedVillager = state.villagers.find((v) => v.id === villagerId) || null;
  }
  if (!selectedVillager) {
    selectedVillager = selectBestUpgradeVillager(state.villagers);
  }

  if (!selectedVillager) {
    return {
      facilities: state.facilities,
      villagers: state.villagers,
      inventory: state.inventory,
      gold: state.gold,
      logMessage: "アップグレードを担当できる村人がいません。",
      logType: "warning",
    };
  }

  const baseTime = 5 + facility.level * 5;
  const actualTime = calculateUpgradeTime(baseTime, selectedVillager);
  const jobName = selectedVillager.currentJob;

  // 共通: 資材消費
  const inv = { ...state.inventory };
  facility.upgradeCost.materials.forEach((req) => {
    const reqCount = Math.floor(req.count * costReduction);
    inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - reqCount);
  });

  // ダンジョン活動中の村人は帰還を待つ（予約状態）
  if (selectedVillager.status === "active" || selectedVillager.status === "traveling_to") {
    const area = state.dungeons.find((d) => d.id === selectedVillager.destinationAreaId);

    const updatedVillagers = state.villagers.map((v) => {
      if (v.id !== selectedVillager!.id) return v;
      return {
        ...v,
        gold: v.gold + goldCost,
        status: "traveling_back",
        travelTimeLeft: area ? area.distance : 1,
        order: "rest",
        destinationAreaId: null,
        potionCount: 0,
        staminaDrinkCount: 0,
      } as Villager;
    });

    const updatedFacilities = { ...state.facilities } as Record<FacilityType, Facility>;
    updatedFacilities[facilityId] = {
      ...facility,
      upgradeTimeLeft: actualTime,
      upgradeTotalTime: actualTime,
      upgradeAssignedVillagerId: selectedVillager.id,
    };

    return {
      gold: state.gold - goldCost,
      inventory: inv,
      villagers: updatedVillagers,
      facilities: updatedFacilities,
      logMessage: `${facility.name} のアップグレード予約: ${selectedVillager.name}(${jobName}) を担当に割り当てました（ダンジョンから帰還後に開始、所要 ${actualTime} 時間）。`,
      logType: "upgrade",
    };
  }

  // 村にいる村人の場合、ゴールドを支給して即座に開始
  const updatedVillagers = state.villagers.map((v) => {
    if (v.id !== selectedVillager!.id) return v;
    return {
      ...v,
      gold: v.gold + goldCost,
      status: "active",
      assignedCraftJobId: `upgrade_${facilityId}`,
    } as Villager;
  });

  const updatedFacilities = { ...state.facilities } as Record<FacilityType, Facility>;
  updatedFacilities[facilityId] = {
    ...facility,
    upgradeTimeLeft: actualTime,
    upgradeTotalTime: actualTime,
    upgradeAssignedVillagerId: selectedVillager.id,
  };

  return {
    gold: state.gold - goldCost,
    inventory: inv,
    villagers: updatedVillagers,
    facilities: updatedFacilities,
    logMessage: `${facility.name} のアップグレードを開始しました。担当: ${selectedVillager.name}(${jobName})（レベル ${facility.level + 1} まであと ${actualTime} 時間、支給 ${goldCost} G）。`,
    logType: "upgrade",
  };
}
