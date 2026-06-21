export interface TownMaster {
  id: string;
  name: string;
  distance: number;
  description: string;
  specialties: string[];
  demands: { itemId: string; multiplier: number }[];
  unlockedAtTier: number;
}

export const TOWNS_DATA: TownMaster[] = [
  {
    id: "komorebi",
    name: "コモレビ村",
    distance: 12, // 往復12時間
    description:
      "自然に囲まれたのどかな集落。木材や薬草の需要が高く、特産果物や木工品を仕入れることができる。",
    specialties: ["food", "wood", "herb", "wood_plank", "leather_cloak", "ancient_bark", "elixir"],
    demands: [
      { itemId: "stone", multiplier: 1.4 },
      { itemId: "iron_sword", multiplier: 1.3 },
      { itemId: "potion", multiplier: 1.2 },
    ],
    unlockedAtTier: 1,
  },
  {
    id: "ironport",
    name: "港町アイアンポート",
    distance: 24, // 往復24時間
    description:
      "海運と重工業で栄える海沿いの都市。武具や加工用木材を求めており、金属素材を仕入れることができる。",
    specialties: [
      "copper_ore",
      "iron_ore",
      "iron_ingot",
      "iron_sword",
      "iron_armor",
      "silver_ore",
      "silver_ingot",
      "silver_rapier",
      "silver_chainmail",
    ],
    demands: [
      { itemId: "wood_plank", multiplier: 1.4 },
      { itemId: "elixir", multiplier: 1.5 },
      { itemId: "leather", multiplier: 1.3 },
    ],
    unlockedAtTier: 2,
  },
  {
    id: "magica",
    name: "魔法都市マギカ",
    distance: 36, // 往復36時間
    description:
      "天に聳える魔導塔を中心に栄える神秘の学園都市。回復薬や稀少な魔物素材を求めており、魔法に関する素材・装備を仕入れることができる。",
    specialties: [
      "crystal_fragment",
      "mana_stone",
      "stamina_drink",
      "potion",
      "mid_potion",
      "dark_crystal",
      "wooden_staff",
      "mythril_staff",
      "mythril_robe",
    ],
    demands: [
      { itemId: "ancient_bark", multiplier: 1.6 },
      { itemId: "silver_rapier", multiplier: 1.4 },
      { itemId: "feather", multiplier: 1.3 },
    ],
    unlockedAtTier: 3,
  },
];

export function getFriendshipLevel(friendship: number): number {
  if (friendship >= 900) return 5;
  if (friendship >= 600) return 4;
  if (friendship >= 300) return 3;
  if (friendship >= 100) return 2;
  return 1;
}

export function getFriendshipThreshold(level: number): number {
  if (level === 1) return 100;
  if (level === 2) return 300;
  if (level === 3) return 600;
  if (level === 4) return 900;
  return 9999;
}

export function getTownShopItems(townId: string, level: number): string[] {
  if (townId === "komorebi") {
    const items = ["food", "wood", "herb"];
    if (level >= 2) items.push("wood_plank");
    if (level >= 3) items.push("leather_cloak");
    if (level >= 4) items.push("ancient_bark");
    if (level >= 5) items.push("elixir");
    return items;
  }
  if (townId === "ironport") {
    const items = ["copper_ore", "iron_ore"];
    if (level >= 2) items.push("iron_ingot");
    if (level >= 3) items.push("iron_sword", "iron_armor");
    if (level >= 4) items.push("silver_ore", "silver_ingot");
    if (level >= 5) items.push("silver_rapier", "silver_chainmail");
    return items;
  }
  if (townId === "magica") {
    const items = ["crystal_fragment"];
    if (level >= 2) items.push("mana_stone", "stamina_drink");
    if (level >= 3) items.push("potion", "mid_potion");
    if (level >= 4) items.push("dark_crystal", "wooden_staff");
    if (level >= 5) items.push("mythril_staff", "mythril_robe");
    return items;
  }
  return [];
}

export function getInvestCost(level: number): number {
  return 500 * Math.pow(2, level - 1); // 500 -> 1000 -> 2000 -> 4000 -> 8000
}
