import {
  DEFAULT_GATHER_RESPAWN_HOURS,
  HARD_GATHER_RESPAWN_HOURS,
  RARE_GATHER_RESPAWN_HOURS,
  DEFAULT_MONSTER_RESPAWN_HOURS,
  HARD_MONSTER_RESPAWN_HOURS,
  BOSS_MONSTER_RESPAWN_HOURS,
} from "../constants";
import { DUNGEONS, ITEMS } from "../data/masterData";
import { TOWNS_DATA } from "../data/towns";
import type { RunStats } from "../types/game";
import { Facility, FacilityType, DungeonArea } from "../types/game";
import { createVillager } from "../utils/villagerHelpers";

export function getInitialVillagers(bodyLvl: number = 0): ReturnType<typeof createVillager>[] {
  const statBonus = bodyLvl * 2;
  return [
    createVillager({ id: "v1", name: "アルフ", statBonus }),
    createVillager({
      id: "v2",
      name: "ベアトリス",
      statBonus,
      str: 8,
      int: 12,
      dex: 11,
      agi: 9,
      vit: 10,
    }),
    createVillager({
      id: "v3",
      name: "シリル",
      statBonus,
      str: 12,
      int: 8,
      dex: 9,
      agi: 11,
      vit: 10,
    }),
  ];
}

function getItemRespawnHours(itemId: string): number {
  if (itemId === "mana_stone") return RARE_GATHER_RESPAWN_HOURS;
  if (["stone", "iron_ore", "silver_ore", "crystal_fragment"].includes(itemId))
    return HARD_GATHER_RESPAWN_HOURS;
  return DEFAULT_GATHER_RESPAWN_HOURS;
}

function getMonsterRespawnHours(monsterId: string): number {
  if (["golem", "chimera", "archdemon"].includes(monsterId)) return BOSS_MONSTER_RESPAWN_HOURS;
  if (
    [
      "orc",
      "werewolf",
      "demon",
      "gargoyle",
      "dragon_spawn",
      "harpy",
      "treant",
      "shadow_knight",
    ].includes(monsterId)
  )
    return HARD_MONSTER_RESPAWN_HOURS;
  return DEFAULT_MONSTER_RESPAWN_HOURS;
}

export function getInitialDungeons(): DungeonArea[] {
  return DUNGEONS.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({
      ...g,
      currentProgress: 0,
      respawnTimeLeft: 0,
      respawnTimeTotal: getItemRespawnHours(g.itemId),
    })),
    monsters: d.monsters.map((m) => ({
      ...m,
      currentProgress: 0,
      respawnTimeLeft: 0,
      respawnTimeTotal: getMonsterRespawnHours(m.id),
    })),
  }));
}

export const createInitialInventory = (foodOverride?: number): Record<string, number> => {
  const base = Object.fromEntries(
    Object.values(ITEMS).map((item) => [item.id, item.initialCount || 0]),
  );
  if (foodOverride !== undefined) {
    base.wheat = foodOverride;
    base.vegetable = 0;
    base.raw_meat = 0;
  }
  return base;
};

export const DEFAULT_INVENTORY: Record<string, number> = createInitialInventory();

export function getDefaultTargetAmounts(): Record<string, number> {
  return Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
}

export function getInitialFacilities(): Record<FacilityType, Facility> {
  return {
    inn: {
      id: "inn",
      name: "宿屋",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: { gold: 200, materials: [{ itemId: "wood", count: 10 }] },
      craftQueue: [],
      trainingQueue: [],
    },
    workshop: {
      id: "workshop",
      name: "加工工房",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 300,
        materials: [
          { itemId: "wood", count: 15 },
          { itemId: "stone", count: 10 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    alchemy: {
      id: "alchemy",
      name: "錬金工房",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 600,
        materials: [
          { itemId: "wood_plank", count: 8 },
          { itemId: "iron_ingot", count: 3 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    market: {
      id: "market",
      name: "交易所",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 0,
        materials: [{ itemId: "wood", count: 5 }],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    guild: {
      id: "guild",
      name: "冒険者ギルド",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 300,
        materials: [
          { itemId: "wood", count: 10 },
          { itemId: "stone", count: 5 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    weapon_shop: {
      id: "weapon_shop",
      name: "武器屋",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 400,
        materials: [
          { itemId: "wood_plank", count: 10 },
          { itemId: "stone", count: 10 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    farm: {
      id: "farm",
      name: "農場",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 200,
        materials: [{ itemId: "wood", count: 10 }],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    lumberyard: {
      id: "lumberyard",
      name: "伐採所",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 200,
        materials: [{ itemId: "stone", count: 10 }],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    quarry: {
      id: "quarry",
      name: "採石場",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 200,
        materials: [{ itemId: "wood", count: 10 }],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    kitchen: {
      id: "kitchen",
      name: "調理場",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 250,
        materials: [
          { itemId: "wood_plank", count: 5 },
          { itemId: "stone", count: 10 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
    training_ground: {
      id: "training_ground",
      name: "訓練場",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 400,
        materials: [
          { itemId: "wood", count: 15 },
          { itemId: "stone", count: 10 },
        ],
      },
      craftQueue: [],
      trainingQueue: [],
    },
  };
}

export function getInitialStats(): RunStats {
  return {
    totalGoldFromExports: 0,
    totalGoldSpentOnImports: 0,
    totalItemsGathered: 0,
    totalMonstersDefeated: 0,
    totalBossesDefeated: 0,
    totalItemsCrafted: 0,
    totalGoldFromPurchases: 0,
    totalItemsPurchased: 0,
    totalGoldFromTax: 0,
  };
}

export function getInitialTowns(): import("../types/game").Town[] {
  return TOWNS_DATA.map((t) => ({
    id: t.id,
    name: t.name,
    distance: t.distance,
    description: t.description,
    specialties: t.specialties,
    demands: t.demands,
    friendship: 0,
    level: 1,
    investLevel: 1,
    investCost: 500,
    isUnlocked: t.unlockedAtTier === 1,
  }));
}

export function getInitialCaravans(): import("../types/game").Caravan[] {
  return [
    {
      id: "caravan_1",
      status: "idle",
      destinationTownId: null,
      type: null,
      timeLeft: 0,
      totalTime: 0,
      cargo: [],
      goldCost: 0,
      goldEarned: 0,
      friendshipEarned: 0,
      isAuto: false,
    },
    {
      id: "caravan_2",
      status: "idle",
      destinationTownId: null,
      type: null,
      timeLeft: 0,
      totalTime: 0,
      cargo: [],
      goldCost: 0,
      goldEarned: 0,
      friendshipEarned: 0,
      isAuto: false,
    },
    {
      id: "caravan_3",
      status: "idle",
      destinationTownId: null,
      type: null,
      timeLeft: 0,
      totalTime: 0,
      cargo: [],
      goldCost: 0,
      goldEarned: 0,
      friendshipEarned: 0,
      isAuto: false,
    },
  ];
}
