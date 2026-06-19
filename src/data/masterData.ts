import {
  Item,
  CraftRecipe,
  Monster,
  DungeonArea,
  SoulUpgrade,
  JobType,
  FacilityType,
} from "../types/game";

// ==========================================
// 1. マスタデータ定義
// ==========================================

export const ITEMS: Record<string, Item> = {
  food: {
    id: "food",
    name: "食料",
    category: "food",
    sellPrice: 1,
    difficulty: 1.0,
    initialCount: 50,
    description: "生きるために必要な食料。毎時間村人が消費する。",
  },
  wood: {
    id: "wood",
    name: "原木",
    category: "material",
    sellPrice: 1,
    difficulty: 1.0,
    initialCount: 5,
    description: "基本的な木材。加工やアップグレードに使用する。",
  },
  stone: {
    id: "stone",
    name: "石材",
    category: "material",
    sellPrice: 1,
    difficulty: 1.2,
    description: "建築や加工に使用する石。",
  },
  iron_ore: {
    id: "iron_ore",
    name: "鉄鉱石",
    category: "ore",
    sellPrice: 2,
    difficulty: 1.8,
    description: "鍛冶屋で精錬してインゴットにする。",
  },
  herb: {
    id: "herb",
    name: "薬草",
    category: "herb",
    sellPrice: 2,
    difficulty: 1.5,
    initialCount: 2,
    description: "回復薬の原料となる草。",
  },
  mana_stone: {
    id: "mana_stone",
    name: "魔法石",
    category: "mana_stone",
    sellPrice: 5,
    difficulty: 2.5,
    description: "魔力の込められた結晶。",
  },
  leather: {
    id: "leather",
    name: "獣の毛皮",
    category: "material",
    sellPrice: 3,
    difficulty: 1.5,
    description: "討伐で手に入る皮。防具のクラフトに使う。",
  },
  bone: {
    id: "bone",
    name: "動物の骨",
    category: "material",
    sellPrice: 2,
    difficulty: 1.2,
    description: "討伐で手に入る骨。",
  },

  // 中間素材
  wood_plank: {
    id: "wood_plank",
    name: "木板",
    category: "material",
    sellPrice: 4,
    difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: "wood", count: 3 }], requiredTime: 1 },
  },
  iron_ingot: {
    id: "iron_ingot",
    name: "鉄インゴット",
    category: "material",
    sellPrice: 10,
    difficulty: 1.0,
    recipe: {
      requiredItems: [{ itemId: "iron_ore", count: 3 }],
      requiredTime: 2,
    },
  },

  // 消費アイテム
  potion: {
    id: "potion",
    name: "回復薬",
    category: "consumable",
    sellPrice: 8,
    difficulty: 1.0,
    recipe: {
      requiredItems: [
        { itemId: "herb", count: 2 },
        { itemId: "food", count: 1 },
      ],
      requiredTime: 2,
    },
  },

  // 装備品
  iron_sword: {
    id: "iron_sword",
    name: "鉄の剣",
    category: "gear_weapon",
    sellPrice: 30,
    difficulty: 1.0,
    equipment: { slot: "weapon", bonuses: { attack: 15 } },
    recipe: {
      requiredItems: [
        { itemId: "iron_ingot", count: 2 },
        { itemId: "wood_plank", count: 1 },
      ],
      requiredTime: 4,
    },
  },
  iron_armor: {
    id: "iron_armor",
    name: "鉄の鎧",
    category: "gear_armor",
    sellPrice: 45,
    difficulty: 1.0,
    equipment: { slot: "armor", bonuses: { defense: 15 } },
    recipe: {
      requiredItems: [
        { itemId: "iron_ingot", count: 3 },
        { itemId: "leather", count: 2 },
      ],
      requiredTime: 5,
    },
  },
  silver_ore: {
    id: "silver_ore",
    name: "銀鉱石",
    category: "ore",
    sellPrice: 4,
    difficulty: 2.0,
    description: "廃鉱山の奥や魔獣の谷で採取できる美しい金属の原石。",
  },
  silver_ingot: {
    id: "silver_ingot",
    name: "銀インゴット",
    category: "material",
    sellPrice: 18,
    difficulty: 1.0,
    recipe: {
      requiredItems: [{ itemId: "silver_ore", count: 3 }],
      requiredTime: 2,
    },
  },
  stamina_drink: {
    id: "stamina_drink",
    name: "スタミナポーション",
    category: "consumable",
    sellPrice: 12,
    difficulty: 1.0,
    recipe: {
      requiredItems: [
        { itemId: "herb", count: 2 },
        { itemId: "food", count: 2 },
      ],
      requiredTime: 2,
    },
  },
  elixir: {
    id: "elixir",
    name: "エリクサー",
    category: "consumable",
    sellPrice: 40,
    difficulty: 1.0,
    recipe: {
      requiredItems: [
        { itemId: "herb", count: 4 },
        { itemId: "mana_stone", count: 2 },
      ],
      requiredTime: 4,
    },
  },
  wooden_staff: {
    id: "wooden_staff",
    name: "見習いの杖",
    category: "gear_weapon",
    sellPrice: 8,
    difficulty: 1.0,
    equipment: { slot: "weapon", bonuses: { attack: 3, int: 5 } },
    recipe: {
      requiredItems: [{ itemId: "wood", count: 2 }],
      requiredTime: 1,
    },
  },
  silver_rapier: {
    id: "silver_rapier",
    name: "銀の細剣",
    category: "gear_weapon",
    sellPrice: 60,
    difficulty: 1.0,
    equipment: { slot: "weapon", bonuses: { attack: 25, agi: 8 } },
    recipe: {
      requiredItems: [
        { itemId: "silver_ingot", count: 2 },
        { itemId: "wood_plank", count: 1 },
      ],
      requiredTime: 4,
    },
  },
  mythril_staff: {
    id: "mythril_staff",
    name: "賢者の杖",
    category: "gear_weapon",
    sellPrice: 150,
    difficulty: 1.0,
    equipment: { slot: "weapon", bonuses: { attack: 15, int: 35, dex: 10 } },
    recipe: {
      requiredItems: [
        { itemId: "mana_stone", count: 3 },
        { itemId: "wood_plank", count: 2 },
        { itemId: "silver_ingot", count: 1 },
      ],
      requiredTime: 6,
    },
  },
  dragon_slayer: {
    id: "dragon_slayer",
    name: "ドラゴンスレイヤー",
    category: "gear_weapon",
    sellPrice: 350,
    difficulty: 1.0,
    equipment: { slot: "weapon", bonuses: { attack: 80, str: 15, vit: 10 } },
    recipe: {
      requiredItems: [
        { itemId: "iron_ingot", count: 4 },
        { itemId: "mana_stone", count: 4 },
        { itemId: "bone", count: 3 },
      ],
      requiredTime: 8,
    },
  },
  leather_cloak: {
    id: "leather_cloak",
    name: "旅人のケープ",
    category: "gear_armor",
    sellPrice: 12,
    difficulty: 1.0,
    equipment: { slot: "armor", bonuses: { defense: 3, agi: 3 } },
    recipe: {
      requiredItems: [{ itemId: "leather", count: 2 }],
      requiredTime: 1,
    },
  },
  silver_chainmail: {
    id: "silver_chainmail",
    name: "銀の鎖帷子",
    category: "gear_armor",
    sellPrice: 85,
    difficulty: 1.0,
    equipment: { slot: "armor", bonuses: { defense: 25, agi: 4, vit: 5 } },
    recipe: {
      requiredItems: [
        { itemId: "silver_ingot", count: 3 },
        { itemId: "leather", count: 2 },
      ],
      requiredTime: 5,
    },
  },
  mythril_robe: {
    id: "mythril_robe",
    name: "ミスリルの魔導衣",
    category: "gear_armor",
    sellPrice: 180,
    difficulty: 1.0,
    equipment: { slot: "armor", bonuses: { defense: 30, int: 15, dex: 5, vit: 10 } },
    recipe: {
      requiredItems: [
        { itemId: "mana_stone", count: 3 },
        { itemId: "leather", count: 3 },
        { itemId: "wood_plank", count: 1 },
      ],
      requiredTime: 6,
    },
  },
  dragon_scale_mail: {
    id: "dragon_scale_mail",
    name: "竜鱗の鎧",
    category: "gear_armor",
    sellPrice: 420,
    difficulty: 1.0,
    equipment: { slot: "armor", bonuses: { defense: 75, vit: 20, str: 10 } },
    recipe: {
      requiredItems: [
        { itemId: "iron_ingot", count: 3 },
        { itemId: "mana_stone", count: 3 },
        { itemId: "leather", count: 4 },
        { itemId: "bone", count: 2 },
      ],
      requiredTime: 8,
    },
  },
};

export const RECIPES: Record<string, CraftRecipe> = {
  wood_plank: {
    id: "wood_plank",
    resultItemId: "wood_plank",
    facilityId: "workshop",
    requiredFacilityLevel: 1,
    requiredItems: [{ itemId: "wood", count: 3 }],
    requiredTime: 1,
    outputCount: 1,
  },
  iron_ingot: {
    id: "iron_ingot",
    resultItemId: "iron_ingot",
    facilityId: "workshop",
    requiredFacilityLevel: 1,
    requiredItems: [{ itemId: "iron_ore", count: 3 }],
    requiredTime: 2,
    outputCount: 1,
  },
  potion: {
    id: "potion",
    resultItemId: "potion",
    facilityId: "alchemy",
    requiredFacilityLevel: 1,
    requiredItems: [
      { itemId: "herb", count: 2 },
      { itemId: "food", count: 1 },
    ],
    requiredTime: 2,
    outputCount: 1,
  },
  iron_sword: {
    id: "iron_sword",
    resultItemId: "iron_sword",
    facilityId: "blacksmith",
    requiredFacilityLevel: 1,
    requiredItems: [
      { itemId: "iron_ingot", count: 2 },
      { itemId: "wood_plank", count: 1 },
    ],
    requiredTime: 4,
    outputCount: 1,
  },
  iron_armor: {
    id: "iron_armor",
    resultItemId: "iron_armor",
    facilityId: "blacksmith",
    requiredFacilityLevel: 1,
    requiredItems: [
      { itemId: "iron_ingot", count: 3 },
      { itemId: "leather", count: 2 },
    ],
    requiredTime: 5,
    outputCount: 1,
  },
  silver_ingot: {
    id: "silver_ingot",
    resultItemId: "silver_ingot",
    facilityId: "workshop",
    requiredFacilityLevel: 2,
    requiredItems: [{ itemId: "silver_ore", count: 3 }],
    requiredTime: 2,
    outputCount: 1,
  },
  stamina_drink: {
    id: "stamina_drink",
    resultItemId: "stamina_drink",
    facilityId: "alchemy",
    requiredFacilityLevel: 1,
    requiredItems: [
      { itemId: "herb", count: 2 },
      { itemId: "food", count: 2 },
    ],
    requiredTime: 2,
    outputCount: 1,
  },
  elixir: {
    id: "elixir",
    resultItemId: "elixir",
    facilityId: "alchemy",
    requiredFacilityLevel: 3,
    requiredItems: [
      { itemId: "herb", count: 4 },
      { itemId: "mana_stone", count: 2 },
    ],
    requiredTime: 4,
    outputCount: 1,
  },
  wooden_staff: {
    id: "wooden_staff",
    resultItemId: "wooden_staff",
    facilityId: "workshop",
    requiredFacilityLevel: 1,
    requiredItems: [{ itemId: "wood", count: 2 }],
    requiredTime: 1,
    outputCount: 1,
  },
  silver_rapier: {
    id: "silver_rapier",
    resultItemId: "silver_rapier",
    facilityId: "blacksmith",
    requiredFacilityLevel: 2,
    requiredItems: [
      { itemId: "silver_ingot", count: 2 },
      { itemId: "wood_plank", count: 1 },
    ],
    requiredTime: 4,
    outputCount: 1,
  },
  mythril_staff: {
    id: "mythril_staff",
    resultItemId: "mythril_staff",
    facilityId: "alchemy",
    requiredFacilityLevel: 2,
    requiredItems: [
      { itemId: "mana_stone", count: 3 },
      { itemId: "wood_plank", count: 2 },
      { itemId: "silver_ingot", count: 1 },
    ],
    requiredTime: 6,
    outputCount: 1,
  },
  dragon_slayer: {
    id: "dragon_slayer",
    resultItemId: "dragon_slayer",
    facilityId: "blacksmith",
    requiredFacilityLevel: 4,
    requiredItems: [
      { itemId: "iron_ingot", count: 4 },
      { itemId: "mana_stone", count: 4 },
      { itemId: "bone", count: 3 },
    ],
    requiredTime: 8,
    outputCount: 1,
  },
  leather_cloak: {
    id: "leather_cloak",
    resultItemId: "leather_cloak",
    facilityId: "workshop",
    requiredFacilityLevel: 1,
    requiredItems: [{ itemId: "leather", count: 2 }],
    requiredTime: 1,
    outputCount: 1,
  },
  silver_chainmail: {
    id: "silver_chainmail",
    resultItemId: "silver_chainmail",
    facilityId: "blacksmith",
    requiredFacilityLevel: 2,
    requiredItems: [
      { itemId: "silver_ingot", count: 3 },
      { itemId: "leather", count: 2 },
    ],
    requiredTime: 5,
    outputCount: 1,
  },
  mythril_robe: {
    id: "mythril_robe",
    resultItemId: "mythril_robe",
    facilityId: "alchemy",
    requiredFacilityLevel: 2,
    requiredItems: [
      { itemId: "mana_stone", count: 3 },
      { itemId: "leather", count: 3 },
      { itemId: "wood_plank", count: 1 },
    ],
    requiredTime: 6,
    outputCount: 1,
  },
  dragon_scale_mail: {
    id: "dragon_scale_mail",
    resultItemId: "dragon_scale_mail",
    facilityId: "blacksmith",
    requiredFacilityLevel: 4,
    requiredItems: [
      { itemId: "iron_ingot", count: 3 },
      { itemId: "mana_stone", count: 3 },
      { itemId: "leather", count: 4 },
      { itemId: "bone", count: 2 },
    ],
    requiredTime: 8,
    outputCount: 1,
  },
};

export const getRecipeForItem = (itemId: string): CraftRecipe | undefined =>
  Object.values(RECIPES).find((recipe) => recipe.resultItemId === itemId);

export const getRecipesForFacility = (
  facilityId: FacilityType,
  facilityLevel: number,
): CraftRecipe[] =>
  Object.values(RECIPES).filter(
    (recipe) => recipe.facilityId === facilityId && facilityLevel >= recipe.requiredFacilityLevel,
  );

export const getCraftableItemsForFacility = (
  facilityId: FacilityType,
  facilityLevel: number,
): Item[] =>
  getRecipesForFacility(facilityId, facilityLevel)
    .map((recipe) => ITEMS[recipe.resultItemId])
    .filter((item): item is Item => Boolean(item));

export const MONSTERS: Record<string, Monster> = {
  goblin: {
    id: "goblin",
    name: "ゴブリン",
    level: 1,
    hp: 30,
    maxHp: 30,
    atk: 5,
    def: 2,
    mdef: 1,
    expReward: 10,
    drops: [
      { itemId: "food", chance: 0.5 },
      { itemId: "wood", chance: 0.3 },
    ],
    unlockedAtProgress: 0,
  },
  goblin_leader: {
    id: "goblin_leader",
    name: "ゴブリンロード",
    level: 5,
    hp: 200,
    maxHp: 200,
    atk: 15,
    def: 6,
    mdef: 5,
    expReward: 100,
    drops: [
      { itemId: "bone", chance: 1.0 },
      { itemId: "leather", chance: 0.5 },
    ],
    isBoss: true,
    unlockedAtProgress: 100,
  },

  bat: {
    id: "bat",
    name: "ジャイアントバット",
    level: 4,
    hp: 45,
    maxHp: 45,
    atk: 12,
    def: 3,
    mdef: 4,
    expReward: 18,
    drops: [{ itemId: "leather", chance: 0.6 }],
    unlockedAtProgress: 0,
  },
  slime: {
    id: "slime",
    name: "ストーンスライム",
    level: 6,
    hp: 80,
    maxHp: 80,
    atk: 9,
    def: 12,
    mdef: 2,
    expReward: 25,
    drops: [{ itemId: "stone", chance: 0.7 }],
    unlockedAtProgress: 40,
  },
  golem: {
    id: "golem",
    name: "アイアンゴーレム",
    level: 12,
    hp: 600,
    maxHp: 600,
    atk: 32,
    def: 25,
    mdef: 10,
    expReward: 300,
    drops: [
      { itemId: "iron_ore", chance: 1.0 },
      { itemId: "silver_ore", chance: 0.3 },
    ],
    isBoss: true,
    unlockedAtProgress: 100,
  },

  orc: {
    id: "orc",
    name: "オークソルジャー",
    level: 10,
    hp: 140,
    maxHp: 140,
    atk: 26,
    def: 11,
    mdef: 5,
    expReward: 45,
    drops: [
      { itemId: "food", chance: 0.6 },
      { itemId: "bone", chance: 0.4 },
    ],
    unlockedAtProgress: 0,
  },
  werewolf: {
    id: "werewolf",
    name: "ワーウルフ",
    level: 13,
    hp: 170,
    maxHp: 170,
    atk: 35,
    def: 9,
    mdef: 8,
    expReward: 60,
    drops: [
      { itemId: "leather", chance: 0.8 },
      { itemId: "silver_ore", chance: 0.4 },
    ],
    unlockedAtProgress: 50,
  },
  chimera: {
    id: "chimera",
    name: "キマイラ",
    level: 25,
    hp: 1500,
    maxHp: 1500,
    atk: 65,
    def: 35,
    mdef: 35,
    expReward: 1000,
    drops: [{ itemId: "mana_stone", chance: 1.0 }],
    isBoss: true,
    unlockedAtProgress: 100,
  },

  demon: {
    id: "demon",
    name: "レッサーデーモン",
    level: 20,
    hp: 250,
    maxHp: 250,
    atk: 55,
    def: 20,
    mdef: 30,
    expReward: 120,
    drops: [{ itemId: "mana_stone", chance: 0.7 }],
    unlockedAtProgress: 0,
  },
  gargoyle: {
    id: "gargoyle",
    name: "ガーゴイル",
    level: 22,
    hp: 300,
    maxHp: 300,
    atk: 60,
    def: 40,
    mdef: 15,
    expReward: 150,
    drops: [{ itemId: "stone", chance: 0.8 }],
    unlockedAtProgress: 40,
  },
  archdemon: {
    id: "archdemon",
    name: "アークデーモン",
    level: 40,
    hp: 3500,
    maxHp: 3500,
    atk: 120,
    def: 60,
    mdef: 60,
    expReward: 3000,
    drops: [
      { itemId: "mana_stone", chance: 1.0 },
      { itemId: "elixir", chance: 0.1 },
    ],
    isBoss: true,
    unlockedAtProgress: 100,
  },

  dragon_spawn: {
    id: "dragon_spawn",
    name: "ハーフドラゴン",
    level: 35,
    hp: 600,
    maxHp: 600,
    atk: 110,
    def: 50,
    mdef: 45,
    expReward: 400,
    drops: [{ itemId: "mana_stone", chance: 0.9 }],
    unlockedAtProgress: 0,
  },
  ancient_dragon: {
    id: "ancient_dragon",
    name: "終焉の竜",
    level: 60,
    hp: 10000,
    maxHp: 10000,
    atk: 250,
    def: 120,
    mdef: 120,
    expReward: 10000,
    drops: [],
    isBoss: true,
    unlockedAtProgress: 100,
  },
};

export const DUNGEONS: DungeonArea[] = [
  {
    id: "forest",
    name: "始まりの森",
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [
      { itemId: "food", difficulty: 1.0, unlockedAtProgress: 0 },
      { itemId: "wood", difficulty: 1.0, unlockedAtProgress: 0 },
      { itemId: "herb", difficulty: 1.5, unlockedAtProgress: 40 },
    ],
    monsters: [MONSTERS.goblin, MONSTERS.goblin_leader],
    explorationProgress: 0,
    difficulty: 1.0,
  },
  {
    id: "mine",
    name: "廃鉱山",
    distance: 2,
    recommendedLevel: 5,
    unlockedAtTier: 2,
    gathers: [
      { itemId: "stone", difficulty: 1.2, unlockedAtProgress: 0 },
      { itemId: "iron_ore", difficulty: 1.8, unlockedAtProgress: 40 },
      { itemId: "silver_ore", difficulty: 2.0, unlockedAtProgress: 70 },
    ],
    monsters: [MONSTERS.bat, MONSTERS.slime, MONSTERS.golem],
    explorationProgress: 0,
    difficulty: 2.0,
  },
  {
    id: "valley",
    name: "魔獣の谷",
    distance: 3,
    recommendedLevel: 12,
    unlockedAtTier: 3,
    gathers: [
      { itemId: "herb", difficulty: 2.0, unlockedAtProgress: 0 },
      { itemId: "silver_ore", difficulty: 1.8, unlockedAtProgress: 0 },
      { itemId: "mana_stone", difficulty: 3.0, unlockedAtProgress: 50 },
    ],
    monsters: [MONSTERS.orc, MONSTERS.werewolf, MONSTERS.chimera],
    explorationProgress: 0,
    difficulty: 3.5,
  },
  {
    id: "world_tree",
    name: "世界樹の根",
    distance: 4,
    recommendedLevel: 20,
    unlockedAtTier: 4,
    gathers: [
      { itemId: "wood", difficulty: 2.0, unlockedAtProgress: 0 },
      { itemId: "herb", difficulty: 2.5, unlockedAtProgress: 40 },
      { itemId: "mana_stone", difficulty: 3.5, unlockedAtProgress: 70 },
    ],
    monsters: [MONSTERS.demon, MONSTERS.gargoyle, MONSTERS.archdemon],
    explorationProgress: 0,
    difficulty: 5.0,
  },
  {
    id: "abyss",
    name: "深淵の奈落",
    distance: 5,
    recommendedLevel: 35,
    unlockedAtTier: 5,
    gathers: [{ itemId: "mana_stone", difficulty: 4.0, unlockedAtProgress: 0 }],
    monsters: [MONSTERS.dragon_spawn, MONSTERS.ancient_dragon],
    explorationProgress: 0,
    difficulty: 8.0,
  },
];

export const SOUL_UPGRADES: SoulUpgrade[] = [
  {
    id: "heritage",
    name: "先祖の遺産",
    description: "初期ゴールド +500",
    level: 0,
    maxLevel: 10,
    costPerLevel: 10,
    effectValue: 500,
  },
  {
    id: "storage",
    name: "豊かな備蓄",
    description: "初期食料 +100",
    level: 0,
    maxLevel: 10,
    costPerLevel: 5,
    effectValue: 100,
  },
  {
    id: "education",
    name: "英才教育",
    description: "村人の獲得経験値 +10%",
    level: 0,
    maxLevel: 5,
    costPerLevel: 20,
    effectValue: 0.1,
  },
  {
    id: "body",
    name: "頑強な肉体",
    description: "全村人の初期ステータス +2",
    level: 0,
    maxLevel: 5,
    costPerLevel: 15,
    effectValue: 2,
  },
  {
    id: "building",
    name: "効率的な建築",
    description: "施設アップグレードの素材必要量 -5%",
    level: 0,
    maxLevel: 5,
    costPerLevel: 25,
    effectValue: 0.05,
  },
  {
    id: "discount",
    name: "値切り上手",
    description: "転職に必要なゴールド -10%",
    level: 0,
    maxLevel: 5,
    costPerLevel: 15,
    effectValue: 0.1,
  },
];

export const JOBS: Record<
  JobType,
  {
    name: string;
    description: string;
    cost: number;
    statsMultiplier: {
      str: number;
      int: number;
      agi: number;
      dex: number;
      vit: number;
    };
    adaptability: Record<string, number>; // カテゴリ別採取適性
    requirements?: {
      level: number;
      jobs?: JobType[];
    };
  }
> = {
  無職: {
    name: "無職",
    description: "初期状態。特に目立った特徴はありません。",
    cost: 0,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 1.0, dex: 1.0, vit: 1.0 },
    adaptability: {},
  },
  農民: {
    name: "農民",
    description: "食料の採取効率が非常に高い。",
    cost: 100,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.1, dex: 1.0, vit: 1.0 },
    adaptability: { food: 2.0 },
    requirements: { level: 1 },
  },
  鉱夫: {
    name: "鉱夫",
    description: "鉱石・石材の採取効率が非常に高い。",
    cost: 150,
    statsMultiplier: { str: 1.3, int: 0.7, agi: 0.8, dex: 1.0, vit: 1.2 },
    adaptability: { ore: 2.0, material: 1.5 }, // 石材も多め
    requirements: { level: 1 },
  },
  薬師: {
    name: "薬師",
    description: "薬草の採取効率が非常に高い。魔法石の採取も得意。",
    cost: 150,
    statsMultiplier: { str: 0.8, int: 1.2, agi: 1.0, dex: 1.3, vit: 0.8 },
    adaptability: { herb: 2.0, mana_stone: 1.2 },
    requirements: { level: 1 },
  },
  猟師: {
    name: "猟師",
    description: "食料や討伐素材（毛皮・骨）の獲得量が多い。",
    cost: 200,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.2, dex: 1.2, vit: 0.9 },
    adaptability: { food: 1.5 }, // 討伐ドロップ率も後で考慮
    requirements: { level: 1 },
  },
  戦士: {
    name: "戦士",
    description: "物理戦闘のスペシャリスト。高い攻撃力と耐久力。",
    cost: 300,
    statsMultiplier: { str: 1.4, int: 0.5, agi: 1.1, dex: 1.0, vit: 1.3 },
    adaptability: {},
    requirements: { level: 5, jobs: ["猟師"] },
  },
  魔術師: {
    name: "魔術師",
    description: "魔法戦闘のスペシャリスト。魔法石の採取も得意。",
    cost: 350,
    statsMultiplier: { str: 0.5, int: 1.5, agi: 1.0, dex: 1.1, vit: 0.7 },
    adaptability: { mana_stone: 2.0 },
    requirements: { level: 5, jobs: ["薬師"] },
  },
  僧侶: {
    name: "僧侶",
    description: "回復スキルの使い手。戦闘中の生存力を高める。薬草採取も得意。",
    cost: 350,
    statsMultiplier: { str: 0.8, int: 1.3, agi: 0.9, dex: 1.1, vit: 1.1 },
    adaptability: { herb: 1.3 },
    requirements: { level: 5, jobs: ["薬師"] },
  },
  職人: {
    name: "職人",
    description: "施設でのクラフト大成功率が高い。鉱石などの加工が得意。",
    cost: 300,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 0.9, dex: 1.4, vit: 1.0 },
    adaptability: { ore: 1.2 },
    requirements: { level: 5, jobs: ["鉱夫"] },
  },
};

export const VILLAGER_NAMES = [
  "アルフ",
  "ベアトリス",
  "シリル",
  "ダイアナ",
  "エリック",
  "フィオナ",
  "ギルバート",
  "ヘレン",
  "イアン",
  "ジュリア",
];
