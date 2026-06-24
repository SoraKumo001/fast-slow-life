export interface TownMaster {
  id: string;
  name: string;
  distance: number;
  description: string;
  specialties: string[];
  unlockedAtTier: number;
}

export const TOWNS_DATA: TownMaster[] = [
  {
    id: "komorebi",
    name: "コモレビ村",
    distance: 12, // 往復12時間
    description:
      "自然に囲まれたのどかな集落。木材や薬草の需要が高く、特産果物や木工品を仕入れることができる。",
    specialties: [
      "wheat",
      "vegetable",
      "raw_meat",
      "wood",
      "herb",
      "wood_plank",
      "leather_cloak",
      "ancient_bark",
      "elixir",
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
    unlockedAtTier: 3,
  },
];

export function getTownShopItems(townId: string): string[] {
  if (townId === "komorebi") {
    return [
      "wheat",
      "vegetable",
      "raw_meat",
      "wood",
      "herb",
      "wood_plank",
      "leather_cloak",
      "ancient_bark",
      "elixir",
    ];
  }
  if (townId === "ironport") {
    return [
      "copper_ore",
      "iron_ore",
      "iron_ingot",
      "iron_sword",
      "iron_armor",
      "silver_ore",
      "silver_ingot",
      "silver_rapier",
      "silver_chainmail",
    ];
  }
  if (townId === "magica") {
    return [
      "crystal_fragment",
      "mana_stone",
      "stamina_drink",
      "potion",
      "mid_potion",
      "dark_crystal",
      "wooden_staff",
      "mythril_staff",
      "mythril_robe",
    ];
  }
  return [];
}

export function getInvestCost(level: number): number {
  return 500 * Math.pow(2, level - 1); // 500 -> 1000 -> 2000 -> 4000 -> 8000
}

/**
 * 町が解放される開拓Tierを返す。
 */
export function getTownUnlockTier(townId: string): number {
  const town = TOWNS_DATA.find((t) => t.id === townId);
  return town?.unlockedAtTier ?? 1;
}
