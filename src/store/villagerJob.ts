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

    // 前職のレベルアップによるボーナスを計算して蓄積
    const lvlBonus = v.level - 1;
    const currMult = JOBS[v.currentJob].statsMultiplier;

    const addStr = Math.floor(lvlBonus * 1.5 * currMult.str);
    const addInt = Math.floor(lvlBonus * 1.5 * currMult.int);
    const addDex = Math.floor(lvlBonus * 1.5 * currMult.dex);
    const addAgi = Math.floor(lvlBonus * 1.5 * currMult.agi);
    const addVit = Math.floor(lvlBonus * 1.5 * currMult.vit);
    const addMaxHp = Math.floor(lvlBonus * 10 * currMult.vit);
    const addMaxStamina = lvlBonus * STAMINA_GROWTH_PER_LEVEL;

    const newBonusStr = (v.bonusStr || 0) + addStr;
    const newBonusInt = (v.bonusInt || 0) + addInt;
    const newBonusDex = (v.bonusDex || 0) + addDex;
    const newBonusAgi = (v.bonusAgi || 0) + addAgi;
    const newBonusVit = (v.bonusVit || 0) + addVit;
    const newBonusMaxHp = (v.bonusMaxHp || 0) + addMaxHp;
    const newBonusMaxStamina = (v.bonusMaxStamina || 0) + addMaxStamina;

    const mult = JOBS[job].statsMultiplier;

    // 転職後の新最大HP・最大スタミナ
    const newMaxHp = Math.floor(100 * mult.vit) + newBonusMaxHp;
    const newMaxStamina = 100 + newBonusMaxStamina;

    return {
      ...v,
      currentJob: job,
      jobHistory: history,
      level: 1, // レベル1に戻る
      exp: 0, // 経験値リセット
      bonusStr: newBonusStr,
      bonusInt: newBonusInt,
      bonusDex: newBonusDex,
      bonusAgi: newBonusAgi,
      bonusVit: newBonusVit,
      bonusMaxHp: newBonusMaxHp,
      bonusMaxStamina: newBonusMaxStamina,
      str: Math.floor(baseStr * mult.str) + newBonusStr,
      int: Math.floor(baseInt * mult.int) + newBonusInt,
      dex: Math.floor(baseDex * mult.dex) + newBonusDex,
      agi: Math.floor(baseAgi * mult.agi) + newBonusAgi,
      vit: Math.floor(baseVit * mult.vit) + newBonusVit,
      maxHp: newMaxHp,
      currentHp: newMaxHp, // 転職時に全回復
      maxStamina: newMaxStamina,
      stamina: newMaxStamina, // 転職時に全回復
    };
  });

  return {
    success: true,
    villagers: updatedVillagers,
    gold: gold - cost,
    logs: [
      {
        message: `${villager.name} が ${job} に転職しました。レベルが 1 に戻り、職業レベルボーナスが累積されました！`,
        type: "info",
      },
    ],
  };
}
