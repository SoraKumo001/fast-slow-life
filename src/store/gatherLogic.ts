import {
  FOOD_GATHER_AMOUNT,
  BASE_GATHER_AMOUNT,
  DEFAULT_GATHER_RESPAWN_HOURS,
  EDUCATION_EXP_BONUS,
  AUTO_GATHER_TARGET_PENALTY,
  AUTO_GATHER_EXCEED_PENALTY,
  GATHER_STAT_WEIGHT_PRIMARY,
  GATHER_STAT_WEIGHT_SECONDARY,
  GATHER_PROGRESS_DEX_FACTOR,
  GATHER_PROGRESS_BASE,
  CATEGORY_FOOD,
  CATEGORY_ORE,
  CATEGORY_MATERIAL,
  STAT_GATHER_AMOUNT_FACTOR,
} from "../constants";
import { ITEMS, JOBS } from "../data/masterData";
import { Villager, DungeonArea } from "../types/game";
import { getFoodBuffBonus } from "./combatEngine";
import { LogPayload } from "./gameLoopTypes";
import { tryLevelUp } from "./levelUpHelper";

export function processVillagerGather(
  v: Villager,
  i: number,
  area: DungeonArea,
  nextVillagers: Villager[],
  nextInventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  efficiency: number,
  soulUpgrades: Record<string, number>,
): { logs: LogPayload[]; areaUpdated: boolean } {
  const logs: LogPayload[] = [];
  let bestItemId = "";
  const progress = area.explorationProgress;

  const buffStr = getFoodBuffBonus(v.activeFoodBuffId || null, "str");
  const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
  const buffDex = getFoodBuffBonus(v.activeFoodBuffId || null, "dex");
  const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");

  const effectiveStr = v.str + buffStr;
  const effectiveInt = v.int + buffInt;
  const effectiveDex = v.dex + buffDex;
  const effectiveAgi = v.agi + buffAgi;

  const targetedGather = area.gathers.find((g) => g.itemId === v.targetGatherItemId);
  if (
    targetedGather &&
    progress >= (targetedGather.unlockedAtProgress || 0) &&
    !(targetedGather.respawnTimeLeft && targetedGather.respawnTimeLeft > 0)
  ) {
    bestItemId = v.targetGatherItemId!;
    v.autoTargetName = null;
  } else {
    let maxScore = -1;
    const availableGathers = area.gathers.filter(
      (g) =>
        progress >= (g.unlockedAtProgress || 0) && !(g.respawnTimeLeft && g.respawnTimeLeft > 0),
    );

    availableGathers.forEach((gather) => {
      const item = ITEMS[gather.itemId];
      if (!item) return;
      const baseMultiplier = 1.0 / gather.difficulty;

      let jobMod = 1.0;
      const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
      if (jobAdapt) jobMod = jobAdapt;

      let statVal = 0;
      if (
        item.category === CATEGORY_FOOD ||
        item.category === CATEGORY_ORE ||
        item.category === CATEGORY_MATERIAL
      ) {
        statVal =
          effectiveStr * GATHER_STAT_WEIGHT_PRIMARY + effectiveDex * GATHER_STAT_WEIGHT_SECONDARY;
      } else {
        statVal =
          effectiveInt * GATHER_STAT_WEIGHT_PRIMARY + effectiveDex * GATHER_STAT_WEIGHT_SECONDARY;
      }

      const currentCount = nextInventory[gather.itemId] || 0;
      const targetCount = targetAmounts[gather.itemId] || 0;
      let targetPenalty = 1.0;
      if (targetCount === 0) {
        targetPenalty = AUTO_GATHER_TARGET_PENALTY;
      } else if (currentCount >= targetCount) {
        targetPenalty = AUTO_GATHER_EXCEED_PENALTY;
      }

      let dupPenalty = 1.0;
      const isTargetedByOthers = nextVillagers.some((otherV, idx) => {
        if (idx === i) return false;
        if (otherV.status !== "active" || otherV.destinationAreaId !== v.destinationAreaId)
          return false;
        const otherTarget = otherV.targetGatherItemId || otherV.autoTargetName;
        return otherTarget === gather.itemId || otherTarget === item.name;
      });
      if (isTargetedByOthers) {
        dupPenalty = 0.05;
      }

      const score =
        baseMultiplier *
        Math.pow(jobMod, 2) *
        statVal *
        (1.0 + effectiveAgi * 0.01) *
        efficiency *
        targetPenalty *
        dupPenalty;
      if (score > maxScore) {
        maxScore = score;
        bestItemId = gather.itemId;
      }
    });

    v.autoTargetName = bestItemId ? ITEMS[bestItemId]?.name || null : null;
  }

  if (bestItemId) {
    const gatherIdx = area.gathers.findIndex((g) => g.itemId === bestItemId);
    if (gatherIdx !== -1) {
      const gather = { ...area.gathers[gatherIdx] };
      const progressSpeed =
        (effectiveDex * GATHER_PROGRESS_DEX_FACTOR + GATHER_PROGRESS_BASE) / gather.difficulty;
      gather.currentProgress = Math.min(
        100,
        (gather.currentProgress || 0) + progressSpeed * efficiency,
      );
      area.gathers[gatherIdx] = gather;

      if (gather.currentProgress >= 100) {
        const item = ITEMS[bestItemId];
        const baseAmount = item.id === "food" ? FOOD_GATHER_AMOUNT : BASE_GATHER_AMOUNT;

        let jobMod = 1.0;
        const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
        if (jobAdapt) jobMod = jobAdapt;

        let statVal = 0;
        if (
          item.category === CATEGORY_FOOD ||
          item.category === CATEGORY_ORE ||
          item.category === CATEGORY_MATERIAL
        ) {
          statVal =
            effectiveStr * GATHER_STAT_WEIGHT_PRIMARY + effectiveDex * GATHER_STAT_WEIGHT_SECONDARY;
        } else {
          statVal =
            effectiveInt * GATHER_STAT_WEIGHT_PRIMARY + effectiveDex * GATHER_STAT_WEIGHT_SECONDARY;
        }

        const statMod = 1.0 + statVal * STAT_GATHER_AMOUNT_FACTOR;
        const amount = Math.max(1, Math.floor(baseAmount * jobMod * statMod * efficiency));

        nextInventory[bestItemId] = (nextInventory[bestItemId] || 0) + amount;

        const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
        const itemDiff = item.difficulty || 1.0;
        const expGained = Math.max(1, Math.floor(itemDiff * 10 * eduBonus));
        v.exp += expGained;

        logs.push({
          message: `${v.name} が ${area.name} で ${item.name} を ${amount} 個採取しました。（+${expGained} EXP）`,
          type: "gather",
        });

        const { leveled, updated: leveledV } = tryLevelUp(v);
        if (leveled) {
          v.level = leveledV.level;
          v.exp = leveledV.exp;
          v.str = leveledV.str;
          v.int = leveledV.int;
          v.dex = leveledV.dex;
          v.agi = leveledV.agi;
          v.vit = leveledV.vit;
          v.maxHp = leveledV.maxHp;
          v.maxStamina = leveledV.maxStamina;
          v.currentHp = leveledV.currentHp;
          logs.push({
            message: `${v.name} が レベル ${v.level} に上がりました！`,
            type: "info",
          });
        }

        gather.respawnTimeLeft = gather.respawnTimeTotal || DEFAULT_GATHER_RESPAWN_HOURS;
        gather.currentProgress = 0;
        area.gathers[gatherIdx] = gather;
      }
    }
  }

  return { logs, areaUpdated: true };
}
