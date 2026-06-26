import { BASE_GREAT_SUCCESS_RATE, TRAINING_COOLDOWN_DAYS } from "../constants";
import { getTrainingProgram, getTrainingProgramsForFacility } from "../data/masterData";
import { Villager, VillagerBonuses, Facility, FacilityType } from "../types/game";
import { generateId } from "../utils/craftHelpers";
import { LogPayload } from "./gameLoopTypes";

const BONUS_MAP: Record<string, keyof VillagerBonuses> = {
  str: "bonusStr",
  int: "bonusInt",
  dex: "bonusDex",
  agi: "bonusAgi",
  vit: "bonusVit",
};

/**
 * 訓練完了時のステータス上昇を適用する。大成功時は効果2倍。
 * 村人を破壊的に更新せず、新しいオブジェクトを返す。
 */
export function applyTrainingBonus(
  villager: Villager,
  statBonus: Record<string, number>,
  isGreatSuccess: boolean,
): { updated: Villager; statParts: string[] } {
  const v = { ...villager } as Villager;
  const statNames = Object.keys(statBonus);
  const statParts: string[] = [];
  const multiplier = isGreatSuccess ? 2 : 1;

  statNames.forEach((stat) => {
    const bonus = (statBonus[stat] || 0) * multiplier;
    if (stat === "maxHp") {
      v.maxHp += bonus;
      v.currentHp += bonus;
      statParts.push(`HP+${bonus}`);
    } else if (stat === "maxStamina") {
      v.maxStamina += bonus;
      v.stamina += bonus;
      statParts.push(`スタミナ+${bonus}`);
    } else if (stat in BONUS_MAP) {
      const bonusKey = BONUS_MAP[stat];
      v[bonusKey] = (v[bonusKey] || 0) + bonus;
      statParts.push(`${stat.toUpperCase()}+${bonus}`);
    }
  });

  return { updated: v, statParts };
}

/**
 * 大成功確率の計算（職人ボーナス付き）
 */
export function getGreatSuccessRate(villager: Villager): number {
  if (villager.currentJob === "職人") return 0.12;
  return BASE_GREAT_SUCCESS_RATE;
}

/**
 * 訓練場のトレーニングキューを処理する
 */
export function processTrainingQueue(
  fac: Facility,
  villagers: Villager[],
  gold: number,
  currentDay: number,
): { villagers: Villager[]; gold: number; logs: LogPayload[] } {
  const logs: LogPayload[] = [];
  const nextVillagers = [...villagers];
  let currentGold = gold;

  if (fac.id !== "training_ground" || fac.trainingQueue.length === 0) {
    return { villagers: nextVillagers, gold: currentGold, logs };
  }

  const nextTrainingQueue: typeof fac.trainingQueue = [];
  fac.trainingQueue.forEach((job) => {
    const updatedJob = { ...job };
    const vIdx = nextVillagers.findIndex((v) => v.id === updatedJob.assignedVillagerId);

    if (vIdx === -1) return; // 村人が見つからない→破棄

    const v = { ...nextVillagers[vIdx] };
    const cost = updatedJob.goldPerHour;

    if (v.gold < cost) {
      logs.push({
        message: `${v.name} は訓練費(${cost}G)を支払えなかったため、訓練を中断しました。（所持金: ${v.gold} G）`,
        type: "warning",
      });
      nextVillagers[vIdx] = {
        ...v,
        status: "idle",
        assignedCraftJobId: null,
      };
      return;
    }

    v.gold -= cost;
    currentGold += cost;
    updatedJob.timeLeft -= 1;

    if (updatedJob.timeLeft <= 0) {
      const program = getTrainingProgram(updatedJob.programId);
      if (program) {
        const successRate = getGreatSuccessRate(v);
        const isGreatSuccess = Math.random() < successRate;
        const { updated, statParts } = applyTrainingBonus(v, program.statBonus, isGreatSuccess);

        updated.lastTrainingDay = currentDay;
        updated.status = "idle";
        updated.assignedCraftJobId = null;
        nextVillagers[vIdx] = updated;

        logs.push({
          message: `${v.name} が訓練「${program.name}」を完了しました！${statParts.join("、")}${isGreatSuccess ? "【大成功！効果2倍】" : ""}`,
          type: "craft",
        });
      }
    } else {
      nextTrainingQueue.push(updatedJob);
      nextVillagers[vIdx] = v;
    }
  });

  fac.trainingQueue = nextTrainingQueue;

  return { villagers: nextVillagers, gold: currentGold, logs };
}

// ---------- Auto training logic ----------

const TRAINING_QUEUE_MAX_LENGTH = 3;
const TRAINING_GOLD_THRESHOLD = 150;

function getBestTrainingProgram(
  villager: Villager,
  availablePrograms: ReturnType<typeof getTrainingProgramsForFacility>,
) {
  const baseStats = {
    str: villager.str,
    int: villager.int,
    dex: villager.dex,
    agi: villager.agi,
    vit: villager.vit,
  };

  // 最も低いステータスを特定
  const sorted = Object.entries(baseStats).sort(([, a], [, b]) => a - b);

  // availablePrograms を必要施設Lv降順にソートし、最も高Lvのプログラムを優先
  const sortedByLevel = [...availablePrograms].sort(
    (a, b) => b.requiredFacilityLevel - a.requiredFacilityLevel,
  );

  for (const [stat] of sorted) {
    const program = sortedByLevel.find((p) => {
      const bonus = p.statBonus[stat as keyof typeof p.statBonus];
      return bonus !== undefined && bonus > 0;
    });
    if (program) return program;
  }

  return sortedByLevel[0];
}

export function processAutoTraining(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  currentDay: number,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];

  const trainingGround = nextFacilities.training_ground;
  if (!trainingGround || trainingGround.level < 1) {
    return { facilities: nextFacilities, villagers: nextVillagers, logs };
  }

  const queue = trainingGround.trainingQueue;
  const activeCount = queue.length;
  const availablePrograms = getTrainingProgramsForFacility(trainingGround.level);

  if (activeCount >= TRAINING_QUEUE_MAX_LENGTH || availablePrograms.length === 0) {
    return { facilities: nextFacilities, villagers: nextVillagers, logs };
  }

  for (const v of nextVillagers) {
    if (queue.length >= TRAINING_QUEUE_MAX_LENGTH) break;
    if (v.status !== "idle") continue;
    if (v.gold < TRAINING_GOLD_THRESHOLD) continue;
    if (v.lastTrainingDay && currentDay - v.lastTrainingDay < TRAINING_COOLDOWN_DAYS) continue; // 同一村人は TRAINING_COOLDOWN_DAYS 日以上間隔を空ける (lastTrainingDay=0 は未訓練)

    const program = getBestTrainingProgram(v, availablePrograms);
    if (!program) continue;
    if (v.gold < program.goldCost) continue;

    const jobId = generateId();
    const goldPerHour = Math.ceil(program.goldCost / program.requiredTime);

    queue.push({
      id: jobId,
      programId: program.id,
      timeLeft: program.requiredTime,
      totalTime: program.requiredTime,
      assignedVillagerId: v.id,
      goldPerHour,
    });

    const idx = nextVillagers.findIndex((villager) => villager.id === v.id);
    nextVillagers[idx] = {
      ...v,
      status: "active",
      assignedCraftJobId: jobId,
    } as Villager;

    logs.push({
      message: `【自動訓練】${v.name} が訓練「${program.name}」を開始しました。（所要: ${program.requiredTime}時間、総額: ${program.goldCost} G）`,
      type: "craft",
    });
  }

  trainingGround.trainingQueue = queue;
  nextFacilities.training_ground = trainingGround;

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    logs,
  };
}
