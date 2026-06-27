import {
  DEFAULT_GATHER_RESPAWN_HOURS,
  HARD_GATHER_RESPAWN_HOURS,
  RARE_GATHER_RESPAWN_HOURS,
  DEFAULT_MONSTER_RESPAWN_HOURS,
  HARD_MONSTER_RESPAWN_HOURS,
  BOSS_MONSTER_RESPAWN_HOURS,
} from "../constants";
import { FACILITY_UPGRADE_MATERIALS } from "../data/facilityUpgradeMaterials";
import { DUNGEONS, ITEMS } from "../data/masterData";
import { TOWNS_DATA } from "../data/towns";
import type { RunStats } from "../types/game";
import { Facility, FacilityType, DungeonArea } from "../types/game";
import { createVillager, generateRandomName } from "../utils/villagerHelpers";

export function getInitialVillagers(bodyLvl: number = 0): ReturnType<typeof createVillager>[] {
  const statBonus = bodyLvl * 2;
  const existingNames: string[] = [];

  const makeVillager = (
    id: string,
    overrides: Partial<{ str: number; int: number; dex: number; agi: number; vit: number }> = {},
  ) => {
    const name = generateRandomName(existingNames);
    existingNames.push(name);
    return createVillager({ id, name, statBonus, ...overrides });
  };

  return [
    makeVillager("v1"),
    makeVillager("v2", { str: 8, int: 12, dex: 11, agi: 9, vit: 10 }),
    makeVillager("v3", { str: 12, int: 8, dex: 9, agi: 11, vit: 10 }),
    makeVillager("v4", { str: 10, int: 10, dex: 13, agi: 8, vit: 9 }),
    makeVillager("v5", { str: 9, int: 9, dex: 10, agi: 10, vit: 12 }),
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
    threatLevel: 0,
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
  const MAX_LEVEL = 5;

  /** 施設定義: 可変部分のみ指定し、固定値はマッピングで付与 */
  const blueprints: {
    id: FacilityType;
    name: string;
    initialLevel: number;
    upgradeGold: number;
  }[] = [
    // 初期Lv1
    {
      id: "inn",
      name: "宿屋",
      initialLevel: 1,
      upgradeGold: 200,
    },
    {
      id: "workshop",
      name: "加工工房",
      initialLevel: 1,
      upgradeGold: 300,
    },
    {
      id: "farm",
      name: "農場",
      initialLevel: 1,
      upgradeGold: 200,
    },
    {
      id: "kitchen",
      name: "調理場",
      initialLevel: 1,
      upgradeGold: 250,
    },
    // 初期Lv0 (未建設)
    {
      id: "alchemy",
      name: "錬金工房",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "market",
      name: "交易所",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "guild",
      name: "冒険者ギルド",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "weapon_shop",
      name: "武器屋",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "lumberyard",
      name: "伐採所",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "quarry",
      name: "鉱山",
      initialLevel: 0,
      upgradeGold: 0,
    },
    {
      id: "training_ground",
      name: "訓練場",
      initialLevel: 0,
      upgradeGold: 0,
    },
  ];

  const facilities = {} as Record<FacilityType, Facility>;
  for (const b of blueprints) {
    const targetLevel = b.initialLevel + 1; // initialLevel=0→建設(Lv1), initialLevel=1→最初の強化(Lv2)
    facilities[b.id] = {
      id: b.id,
      name: b.name,
      level: b.initialLevel,
      maxLevel: MAX_LEVEL,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: b.upgradeGold,
        materials: FACILITY_UPGRADE_MATERIALS[b.id]?.[targetLevel] ?? [],
      },
      craftQueue: [],
      trainingQueue: [],
      upgradeAssignedVillagerId: null,
    };
  }
  return facilities;
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
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    totalCriticalHits: 0,
    totalAttacksLanded: 0,
    totalAttacksAttempted: 0,
    totalPotionHealing: 0,
  };
}

export function getInitialTowns(): import("../types/game").Town[] {
  return TOWNS_DATA.map((t) => ({
    id: t.id,
    name: t.name,
    distance: t.distance,
    description: t.description,
    specialties: t.specialties,
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
      isAuto: false,
    },
  ];
}
