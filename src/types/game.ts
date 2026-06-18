export type JobType =
  | '無職'
  | '農民'
  | '鉱夫'
  | '薬師'
  | '猟師'
  | '戦士'
  | '魔術師'
  | '僧侶'
  | '職人';

export type ItemCategory =
  | 'food'
  | 'ore'
  | 'herb'
  | 'mana_stone'
  | 'material' // 加工中間素材 (木板、鉄インゴット等)
  | 'gear_weapon'
  | 'gear_armor'
  | 'consumable';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  sellPrice: number;
  difficulty: number; // 採取難易度（高いほどスコア低下に影響）
  description?: string;
  recipe?: {
    requiredItems: { itemId: string; count: number }[];
    requiredTime: number; // 時間単位
  };
}

export type OrderType = 'gather' | 'hunt' | 'rest';

export type VillagerStatus =
  | 'idle'           // 村にいる（待機中）
  | 'traveling_to'   // ダンジョンへ移動中
  | 'active'         // ダンジョンで活動中（採取または討伐）
  | 'traveling_back' // 村へ帰還中
  | 'resting';       // 宿屋で休息中

export interface Villager {
  id: string;
  name: string;
  level: number;
  exp: number;
  currentJob: JobType;
  jobHistory: JobType[];
  maxHp: number;
  currentHp: number;
  stamina: number; // 0 - 100
  str: number;
  int: number;
  dex: number;
  agi: number;
  vit: number;
  weaponId: string; // 'none' or itemId
  armorId: string;  // 'none' or itemId
  order: OrderType;
  status: VillagerStatus;
  destinationAreaId: string | null; // 派遣先のエリアID
  travelTimeLeft: number; // 移動の残り時間
  assignedCraftJobId: string | null; // 施設でのクラフト担当時のジョブID（自動クラフト等）
}

export interface CraftJob {
  id: string;
  itemId: string;
  timeLeft: number;
  totalTime: number;
  assignedVillagerId: string | null;
}

export type FacilityType = 'inn' | 'workshop' | 'blacksmith' | 'alchemy' | 'market';

export interface Facility {
  id: FacilityType;
  name: string;
  level: number;
  maxLevel: number;
  upgradeTimeLeft: number; // 0 ならアップグレード中でない
  upgradeTotalTime: number;
  upgradeCost: {
    gold: number;
    materials: { itemId: string; count: number }[];
  };
  craftQueue: CraftJob[];
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  mdef: number;
  expReward: number;
  drops: { itemId: string; chance: number }[]; // 0.0 - 1.0
  isBoss?: boolean;
}

export interface DungeonArea {
  id: string;
  name: string;
  distance: number; // 往路・復路に必要な時間（時間単位）
  recommendedLevel: number;
  unlockedAtTier: number;
  gathers: { itemId: string; difficulty: number }[];
  monsters: Monster[];
}

export interface GameLog {
  id: string;
  timestamp: string; // "1日目 12:00" のようなフォーマット
  message: string;
  type: 'info' | 'combat' | 'gather' | 'craft' | 'upgrade' | 'system' | 'warning' | 'error';
}

export interface SoulUpgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  costPerLevel: number;
  effectValue: number; // レベルごとの倍率・加算値
}

export interface GameState {
  currentDay: number;
  currentHour: number;
  gold: number;
  food: number;
  soulPoints: number;
  villagers: Villager[];
  facilities: Record<FacilityType, Facility>;
  dungeons: DungeonArea[];
  inventory: Record<string, number>; // itemId -> 所持数
  targetAmounts: Record<string, number>; // itemId -> 目標個数
  logs: GameLog[];
  currentTier: number; // 1 to 5
  bossDefeated: boolean;
  gameLimitDays: number; // 現在のTierの制限日数
  gameOver: boolean;
  isPaused: boolean;
  playSpeed: 'normal' | 'fast' | 'super'; // 自動進行のスピード
  soulUpgrades: Record<string, number>; // upgradeId -> 購入レベル
}
