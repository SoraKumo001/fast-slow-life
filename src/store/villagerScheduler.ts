import { ITEMS, JOBS } from "../data/masterData";
import { Villager, DungeonArea, DungeonMonster, DungeonGather, Item } from "../types/game";
import { isMagicJob } from "../utils/villagerHelpers";
import { LogPayload } from "./gameLoopTypes";
import { MAX_HUNTERS_PER_MONSTER, MAX_GATHERERS_PER_RESOURCE } from "./schedulerConfig";

export interface SchedulerInput {
  villagers: Villager[];
  dungeons: DungeonArea[];
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
}

export interface SchedulerResult {
  villagers: Villager[];
  logs: LogPayload[];
}

/**
 * 全アクティブ村人のターゲットを一定間隔で再割り当てする。
 * エリアごとに Greedy アルゴリズムで重複を最小化する。
 * - 手動ターゲット (targetMonsterId) が設定されている村人は除外
 * - クラフト/アップグレード作業中の村人は除外
 * - リスポーン中のターゲットは割り当て対象外
 */
export function runVillagerScheduler(input: SchedulerInput): SchedulerResult {
  const { dungeons, inventory, targetAmounts } = input;
  const updatedVillagers = input.villagers.map((v) => ({ ...v }));
  const logs: LogPayload[] = [];

  // スケジュール対象の抽出
  const eligible = updatedVillagers.filter(
    (v) =>
      v.status === "active" &&
      !!v.destinationAreaId &&
      (v.order === "gather" || v.order === "hunt") &&
      !v.targetMonsterId &&
      !v.assignedCraftJobId,
  );

  if (eligible.length === 0) {
    return { villagers: updatedVillagers, logs };
  }

  // autoTargetName をいったんクリア（スケジューラーが完全再割り当てする）
  for (const v of eligible) {
    v.autoTargetName = null;
  }

  // エリアごとにグループ化
  const byArea = new Map<string, Villager[]>();
  for (const v of eligible) {
    const areaId = v.destinationAreaId!;
    const list = byArea.get(areaId);
    if (list) list.push(v);
    else byArea.set(areaId, [v]);
  }

  for (const [areaId, areaVillagers] of byArea.entries()) {
    const area = dungeons.find((d) => d.id === areaId);
    if (!area) continue;

    const hunters = areaVillagers.filter((v) => v.order === "hunt");
    const gatherers = areaVillagers.filter((v) => v.order === "gather");

    if (hunters.length > 0) {
      assignHuntTargets(hunters, area, inventory, targetAmounts, logs);
    }
    if (gatherers.length > 0) {
      assignGatherTargets(gatherers, area, inventory, targetAmounts, logs);
    }
  }

  return { villagers: updatedVillagers, logs };
}

// ════════════════════════════════════════════
//  討伐ターゲット割り当て
// ════════════════════════════════════════════

function assignHuntTargets(
  hunters: Villager[],
  area: DungeonArea,
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  logs: LogPayload[],
): void {
  // 利用可能なモンスター
  const available = area.monsters.filter(
    (m) =>
      !m.isBoss &&
      area.explorationProgress >= (m.unlockedAtProgress || 0) &&
      !(m.respawnTimeLeft && m.respawnTimeLeft > 0),
  );
  if (available.length === 0) {
    logs.push({
      message: `【配備】${area.name} に討伐可能なモンスターがいないため、討伐隊員は待機します。`,
      type: "system",
    });
    return;
  }

  // モンスター需要スコア（各ドロップの不足率の平均、未指定なら0.5）
  type ScoredMonster = { monster: DungeonMonster; demand: number };
  const demandScores: ScoredMonster[] = available.map((m) => {
    const ratios = m.drops
      .map((d) => {
        const target = targetAmounts[d.itemId] || 0;
        if (target <= 0) return null;
        return Math.max(0, 1 - (inventory[d.itemId] || 0) / target);
      })
      .filter((r): r is number => r !== null);
    return {
      monster: m,
      demand: ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0.5,
    };
  });
  demandScores.sort((a, b) => b.demand - a.demand);

  const assigned = new Set<string>();
  const countPerMonster = new Map<string, number>();

  // 需要順にモンスターを処理
  for (const { monster } of demandScores) {
    const unassigned = hunters.filter((v) => !assigned.has(v.id));
    if (unassigned.length === 0) break;

    const currentCount = countPerMonster.get(monster.name) ?? 0;
    const slotsLeft = MAX_HUNTERS_PER_MONSTER - currentCount;
    if (slotsLeft <= 0) continue;

    // 戦闘適性順にソートして上限まで割り当て
    const candidates = unassigned
      .map((v) => ({ v, score: calcHunterScore(v, monster) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, slotsLeft);

    for (const { v } of candidates) {
      v.autoTargetName = monster.name;
      assigned.add(v.id);
    }
    countPerMonster.set(monster.name, currentCount + candidates.length);
  }

  // 余剰ハンター → 需要最高のモンスターに（cap無視）
  const remaining = hunters.filter((v) => !assigned.has(v.id));
  if (remaining.length > 0) {
    const overflowTarget = demandScores[0].monster;
    for (const v of remaining) {
      v.autoTargetName = overflowTarget.name;
    }
  }

  const assignedCount = hunters.filter((v) => v.autoTargetName).length;
  logs.push({
    message: `【配備】${area.name} の討伐隊 ${assignedCount}人を再配置しました。`,
    type: "system",
  });
}

/** 村人 × モンスターの戦闘適性スコア */
function calcHunterScore(v: Villager, monster: DungeonMonster): number {
  const isMagic = isMagicJob(v.currentJob);
  const enemyDefense = isMagic ? monster.mdef + monster.int * 0.5 : monster.def + monster.vit * 0.5;
  // 防御が低いほど高スコア（最大2.0、最小0.5にクランプ）
  return Math.max(0.5, Math.min(2.0, 30 / (enemyDefense + monster.atk + 1)));
}

// ════════════════════════════════════════════
//  採取ターゲット割り当て
// ════════════════════════════════════════════

function assignGatherTargets(
  gatherers: Villager[],
  area: DungeonArea,
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  logs: LogPayload[],
): void {
  // 利用可能な採取ポイント
  const available = area.gathers.filter(
    (g) =>
      area.explorationProgress >= (g.unlockedAtProgress || 0) &&
      !(g.respawnTimeLeft && g.respawnTimeLeft > 0),
  );
  if (available.length === 0) {
    logs.push({
      message: `【配備】${area.name} に採取可能な資源がないため、採取隊員は待機します。`,
      type: "system",
    });
    return;
  }

  // 需要スコア（目標在庫の不足率、未設定なら0.3）
  type ScoredGather = { gather: DungeonGather; demand: number };
  const demandScores: ScoredGather[] = available
    .map((g) => {
      const target = targetAmounts[g.itemId] || 0;
      const current = inventory[g.itemId] || 0;
      const demand = target > 0 ? Math.max(0, 1 - current / target) : 0;
      return { gather: g, demand };
    })
    .sort((a, b) => b.demand - a.demand);

  const assigned = new Set<string>();
  const countPerItem = new Map<string, number>();

  for (const { gather } of demandScores) {
    const unassigned = gatherers.filter((v) => !assigned.has(v.id));
    if (unassigned.length === 0) break;

    const item = ITEMS[gather.itemId];
    if (!item) continue;

    const currentCount = countPerItem.get(item.name) ?? 0;
    const slotsLeft = MAX_GATHERERS_PER_RESOURCE - currentCount;
    if (slotsLeft <= 0) continue;

    const candidates = unassigned
      .map((v) => ({ v, score: calcGathererScore(v, item, gather) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, slotsLeft);

    for (const { v } of candidates) {
      v.autoTargetName = item.name;
      assigned.add(v.id);
    }
    countPerItem.set(item.name, currentCount + candidates.length);
  }

  // 余剰 → 需要最高のポイントに
  const remaining = gatherers.filter((v) => !assigned.has(v.id));
  if (remaining.length > 0) {
    const topItem = ITEMS[demandScores[0].gather.itemId];
    if (topItem) {
      for (const v of remaining) {
        v.autoTargetName = topItem.name;
      }
    }
  }

  const assignedCount = gatherers.filter((v) => v.autoTargetName).length;
  logs.push({
    message: `【配備】${area.name} の採取隊 ${assignedCount}人を再配置しました。`,
    type: "system",
  });
}

/** 村人 × 採取ポイントの適性スコア */
function calcGathererScore(v: Villager, item: Item, gather: DungeonGather): number {
  const baseMultiplier = 1.0 / gather.difficulty;
  let jobMod = 1.0;
  const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
  if (jobAdapt) jobMod = jobAdapt;
  const statVal = v.str * 0.6 + v.dex * 0.4;
  return baseMultiplier * Math.pow(jobMod, 2) * statVal;
}
