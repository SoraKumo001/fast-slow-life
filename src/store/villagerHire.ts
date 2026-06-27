import {
  BASE_MAX_VILLAGERS,
  VILLAGERS_PER_GUILD_LEVEL,
  MAX_VILLAGERS_ABSOLUTE,
  HIRE_COST,
} from "../constants";
import { Villager, Facility } from "../types/game";
import { generateId } from "../utils/craftHelpers";
import { createVillager, generateRandomName } from "../utils/villagerHelpers";
import { LogPayload } from "./gameLoopTypes";

export interface HireResult {
  success: boolean;
  villagers: Villager[];
  gold: number;
  logs: LogPayload[];
}

export function hireVillagerHelper(params: {
  gold: number;
  villagers: Villager[];
  guildFacility?: Facility;
  soulUpgrades: Record<string, number>;
}): HireResult {
  const { gold, villagers, guildFacility, soulUpgrades } = params;

  if (!guildFacility || guildFacility.level === 0) {
    return {
      success: false,
      villagers,
      gold,
      logs: [
        {
          message: "冒険者ギルドが建設されていないため雇用できません。",
          type: "warning",
        },
      ],
    };
  }

  const maxVillagers = BASE_MAX_VILLAGERS + guildFacility.level * VILLAGERS_PER_GUILD_LEVEL;
  const actualMax = Math.min(MAX_VILLAGERS_ABSOLUTE, maxVillagers);

  if (gold < HIRE_COST) {
    return {
      success: false,
      villagers,
      gold,
      logs: [
        {
          message: `雇用に必要なゴールド (${HIRE_COST}G) が不足しています。`,
          type: "warning",
        },
      ],
    };
  }

  if (villagers.length >= actualMax) {
    if (actualMax >= MAX_VILLAGERS_ABSOLUTE) {
      return {
        success: false,
        villagers,
        gold,
        logs: [
          {
            message: `これ以上村人を雇用できません（上限${MAX_VILLAGERS_ABSOLUTE}人）。`,
            type: "warning",
          },
        ],
      };
    } else {
      return {
        success: false,
        villagers,
        gold,
        logs: [
          {
            message: `ギルドレベル ${guildFacility.level} の雇用上限に達しています（上限 ${actualMax} 人）。ギルドをアップグレードしてください。`,
            type: "warning",
          },
        ],
      };
    }
  }

  const existingNames = villagers.map((v) => v.name);
  const name = generateRandomName(existingNames);
  const sb = (soulUpgrades.body || 0) * 2;
  const newVillager = createVillager({
    id: "v_" + generateId(),
    name,
    statBonus: sb,
  });

  return {
    success: true,
    villagers: [...villagers, newVillager],
    gold: gold - HIRE_COST,
    logs: [
      {
        message: `新しい村人 ${name} を雇用しました。`,
        type: "info",
      },
    ],
  };
}
