import type {
  DungeonArea,
  DungeonGather,
  DungeonMonster,
  Villager,
  VillagerDungeonState,
} from "../types/game";

/** デフォルトのダンジョン内状態 */
export function createDefaultDungeonState(): VillagerDungeonState {
  return {
    currentDepth: 0,
    targetDepth: 0,
    lane: 0,
    phase: "idle",
    targetNodeId: null,
  };
}

/** 探索度に応じた現在の開拓前線深度 (m) */
export function getExploredDepth(area: DungeonArea): number {
  const maxDepth = area.maxDepth || 100;
  return Math.round((maxDepth * Math.min(100, Math.max(0, area.explorationProgress))) / 100);
}

/** 採取スポットのダンジョン内配置深度 (m) */
export function getGatherDepth(area: DungeonArea, gather: DungeonGather): number {
  if (typeof gather.depth === "number") return gather.depth;
  const maxDepth = area.maxDepth || 100;
  const pct = (gather.unlockedAtProgress ?? 0) / 100;
  return Math.max(8, Math.min(maxDepth - 10, Math.round(maxDepth * (pct + 0.12))));
}

/** モンスターのダンジョン内配置深度 (m) */
export function getMonsterDepth(area: DungeonArea, monster: DungeonMonster): number {
  const maxDepth = area.maxDepth || 100;
  if (monster.isBoss) return maxDepth;
  if (typeof monster.depth === "number") return monster.depth;
  const pct = (monster.unlockedAtProgress ?? 0) / 100;
  return Math.max(12, Math.min(maxDepth - 12, Math.round(maxDepth * (pct + 0.15))));
}

/**
 * 村人の現在深度を目標深度へ向けて移動させる。
 * 1時間あたりの移動速度は AGI と移動距離に応じて決まる。
 */
export function moveTowardDepth(
  currentDepth: number,
  targetDepth: number,
  stepMeters: number,
): { depth: number; arrived: boolean } {
  const diff = targetDepth - currentDepth;
  if (Math.abs(diff) <= stepMeters) {
    return { depth: targetDepth, arrived: true };
  }
  const next = currentDepth + Math.sign(diff) * stepMeters;
  return { depth: Math.round(next * 10) / 10, arrived: false };
}

/** 村人のダンジョン内状態に応じた日本語ラベル */
export function getVillagerPhaseLabel(v: Villager): string {
  const ds = v.dungeonState;
  if (!ds || v.status === "idle") return "待機中";
  if (v.status === "resting") return "休息中";
  if (v.status === "traveling_to") return `入口へ移動中 (残${v.travelTimeLeft}h)`;
  if (v.status === "traveling_back") return `帰還中 (残${v.travelTimeLeft}h)`;

  const depthText = `${Math.round(ds.currentDepth)}m`;
  switch (ds.phase) {
    case "moving_to_target":
      return `${depthText}→${Math.round(ds.targetDepth)}m 移動中`;
    case "gathering":
      return `${depthText}地点で採取中`;
    case "fighting":
      return `${depthText}地点で交戦中`;
    case "returning":
      return `${depthText}から撤収中`;
    default:
      return `${depthText}地点で待機`;
  }
}
