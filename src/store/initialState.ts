import {
  DEFAULT_GATHER_RESPAWN_HOURS,
  HARD_GATHER_RESPAWN_HOURS,
  RARE_GATHER_RESPAWN_HOURS,
  DEFAULT_MONSTER_RESPAWN_HOURS,
  HARD_MONSTER_RESPAWN_HOURS,
  BOSS_MONSTER_RESPAWN_HOURS,
} from "../constants";
import { DUNGEONS, ITEMS } from "../data/masterData";
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

export const createInitialInventory = (foodOverride?: number): Record<string, number> => ({
  ...Object.fromEntries(Object.values(ITEMS).map((item) => [item.id, item.initialCount || 0])),
  ...(foodOverride === undefined ? {} : { food: foodOverride }),
});

export const DEFAULT_INVENTORY: Record<string, number> = createInitialInventory();

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
    },
    blacksmith: {
      id: "blacksmith",
      name: "鍛冶屋",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 500,
        materials: [
          { itemId: "wood_plank", count: 5 },
          { itemId: "stone", count: 15 },
        ],
      },
      craftQueue: [],
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
        materials: [{ itemId: "wood", count: 20 }],
      },
      craftQueue: [],
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
    },
  };
}
