import {
  BASE_MAX_VILLAGERS,
  VILLAGERS_PER_GUILD_LEVEL,
  MAX_VILLAGERS_ABSOLUTE,
  HIRE_COST,
  BODY_STAT_PER_LEVEL,
} from "../constants";
import { VILLAGER_NAMES } from "../data/masterData";
import { Villager, Facility } from "../types/game";
import { generateId } from "../utils/craftHelpers";
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

  const name = VILLAGER_NAMES[villagers.length % VILLAGER_NAMES.length] + " (新人)";
  const statBonus = (soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
  const newVillager: Villager = {
    id: "v_" + generateId(),
    name,
    level: 1,
    exp: 0,
    currentJob: "無職",
    jobHistory: ["無職"],
    maxHp: 100 + statBonus * 10,
    currentHp: 100 + statBonus * 10,
    stamina: 100,
    maxStamina: 100,
    str: 10 + statBonus,
    int: 10 + statBonus,
    dex: 10 + statBonus,
    agi: 10 + statBonus,
    vit: 10 + statBonus,
    weaponId: "none",
    armorId: "none",
    order: "gather",
    status: "idle",
    destinationAreaId: null,
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    potionItemId: "potion",
    potionCount: 0,
    staminaDrinkItemId: "stamina_drink",
    staminaDrinkCount: 0,
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
  };

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
