import {
  DISCOUNT_PER_SOUL_LEVEL,
  BODY_STAT_PER_LEVEL,
  STAMINA_GROWTH_PER_LEVEL,
} from "../constants";
import { JOBS } from "../data/masterData";
import { Villager, JobType } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export interface JobChangeResult {
  success: boolean;
  villagers: Villager[];
  gold: number;
  logs: LogPayload[];
}

export function changeVillagerJobHelper(params: {
  villagerId: string;
  job: JobType;
  villagers: Villager[];
  gold: number;
  soulUpgrades: Record<string, number>;
}): JobChangeResult {
  const { villagerId, job, villagers, gold, soulUpgrades } = params;
  const villager = villagers.find((v) => v.id === villagerId);

  if (!villager) {
    return {
      success: false,
      villagers,
      gold,
      logs: [],
    };
  }

  const isFree = villager.jobHistory.includes(job);

  if (!isFree) {
    const req = JOBS[job].requirements;
    if (req) {
      if (villager.level < req.level) {
        return {
          success: false,
          villagers,
          gold,
          logs: [
            {
              message: `転職条件を達成していません (必要レベル: ${req.level})。`,
              type: "warning",
            },
          ],
        };
      }
      if (req.jobs && req.jobs.length > 0) {
        const hasPrevJob = req.jobs.some((reqJob) => villager.jobHistory.includes(reqJob));
        if (!hasPrevJob) {
          return {
            success: false,
            villagers,
            gold,
            logs: [
              {
                message: `転職条件を達成していません (前提職業: ${req.jobs.join(" または ")} の習得が必要)。`,
                type: "warning",
              },
            ],
          };
        }
      }
    }
  }

  const discountLvl = soulUpgrades.discount || 0;
  const discountRate = 1 - discountLvl * DISCOUNT_PER_SOUL_LEVEL;
  const cost = isFree ? 0 : Math.floor(JOBS[job].cost * discountRate);

  if (gold < cost) {
    return {
      success: false,
      villagers,
      gold,
      logs: [
        {
          message: "転職に必要なゴールドが不足しています。",
          type: "warning",
        },
      ],
    };
  }

  const updatedVillagers = villagers.map((v) => {
    if (v.id !== villagerId) return v;
    const history = v.jobHistory.includes(job) ? v.jobHistory : [...v.jobHistory, job];

    const baseStr = 10 + (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
    const baseInt = 10 + (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
    const baseDex = 10 + (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
    const baseAgi = 10 + (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
    const baseVit = 10 + (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;

    const mult = JOBS[job].statsMultiplier;
    const lvlBonus = v.level - 1;

    return {
      ...v,
      currentJob: job,
      jobHistory: history,
      str: Math.floor((baseStr + lvlBonus * 1.5) * mult.str),
      int: Math.floor((baseInt + lvlBonus * 1.5) * mult.int),
      dex: Math.floor((baseDex + lvlBonus * 1.5) * mult.dex),
      agi: Math.floor((baseAgi + lvlBonus * 1.5) * mult.agi),
      vit: Math.floor((baseVit + lvlBonus * 1.5) * mult.vit),
      maxHp: Math.floor((100 + lvlBonus * 10) * mult.vit),
      maxStamina: 100 + lvlBonus * STAMINA_GROWTH_PER_LEVEL,
    };
  });

  return {
    success: true,
    villagers: updatedVillagers,
    gold: gold - cost,
    logs: [
      {
        message: `${villager.name} が ${job} に転職しました。`,
        type: "info",
      },
    ],
  };
}
