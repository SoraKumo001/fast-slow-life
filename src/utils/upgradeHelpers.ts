import {
  UPGRADE_DEX_FACTOR,
  UPGRADE_TIME_REDUCTION_CRAFTER,
  UPGRADE_TIME_REDUCTION_MINER,
} from "../constants";
import type { Villager } from "../types/game";

export function calculateUpgradeTime(
  baseTime: number,
  villager: Villager | null | undefined,
): number {
  if (!villager) return baseTime;
  const dexFactor = 1 - (villager.dex - 10) * UPGRADE_DEX_FACTOR;
  let jobFactor = 1.0;
  if (villager.currentJob === "職人") {
    jobFactor = UPGRADE_TIME_REDUCTION_CRAFTER;
  } else if (villager.currentJob === "鉱夫") {
    jobFactor = UPGRADE_TIME_REDUCTION_MINER;
  }
  return Math.max(1, Math.floor(baseTime * dexFactor * jobFactor));
}

export function selectBestUpgradeVillager(villagers: Villager[]): Villager | null {
  const isAvailableForUpgrade = (v: Villager): boolean => {
    // すでにクラフトやアップグレードに割り当てられている村人は除外
    if (v.assignedCraftJobId) return false;
    return true;
  };

  // 1. idle 村人から最適な人材を選択
  const idleVillagers = villagers.filter((v) => v.status === "idle" && isAvailableForUpgrade(v));
  if (idleVillagers.length > 0) {
    const crafter = idleVillagers.find((v) => v.currentJob === "職人");
    if (crafter) return crafter;
    const miner = idleVillagers.find((v) => v.currentJob === "鉱夫");
    if (miner) return miner;
    return idleVillagers[0];
  }

  // 2. ダンジョン活動中の村人から選択（帰還を待つ）
  const activeVillagers = villagers.filter(
    (v) =>
      (v.status === "active" || v.status === "traveling_to") &&
      isAvailableForUpgrade(v) &&
      v.order !== "rest",
  );
  if (activeVillagers.length > 0) {
    const crafter = activeVillagers.find((v) => v.currentJob === "職人");
    if (crafter) return crafter;
    const miner = activeVillagers.find((v) => v.currentJob === "鉱夫");
    if (miner) return miner;
    return activeVillagers[0];
  }

  // 3. traveling_back 中の村人
  const returningVillagers = villagers.filter(
    (v) => v.status === "traveling_back" && isAvailableForUpgrade(v),
  );
  if (returningVillagers.length > 0) {
    return returningVillagers[0];
  }

  // 4. resting 中の村人（最終手段）
  const restingVillagers = villagers.filter(
    (v) => v.status === "resting" && isAvailableForUpgrade(v),
  );
  if (restingVillagers.length > 0) {
    return restingVillagers[0];
  }

  return null;
}
