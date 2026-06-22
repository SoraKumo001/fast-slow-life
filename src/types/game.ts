export type JobType =
  | "無職"
  | "農民"
  | "木こり"
  | "鉱夫"
  | "薬師"
  | "猟師"
  | "戦士"
  | "魔術師"
  | "僧侶"
  | "職人";

export type ItemCategory =
  | "food"
  | "ore"
  | "herb"
  | "mana_stone"
  | "material" // 加工中間素材 (木板、鉄インゴット等)
  | "gear_weapon"
  | "gear_armor"
  | "consumable";

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  basePrice: number;
  difficulty: number; // 採取難易度（高いほどスコア低下に影響）
  description?: string;
  initialCount?: number;
  healAmount?: number; // 回復薬の回復量
  staminaHealAmount?: number; // スタミナ回復薬の回復量
  equipment?: {
    slot: "weapon" | "armor";
    bonuses: Partial<Record<"attack" | "defense" | "str" | "int" | "dex" | "agi" | "vit", number>>;
  };
  foodBuff?: Partial<
    Record<"str" | "int" | "dex" | "agi" | "vit" | "maxHp" | "maxStamina", number>
  >;
}

export interface CraftRecipe {
  id: string;
  resultItemId: string;
  facilityId: FacilityType;
  requiredFacilityLevel: number;
  requiredItems: { itemId: string; count: number }[];
  requiredTime: number; // 時間単位
  outputCount: number;
}

export type OrderType = "gather" | "hunt" | "rest";

export type VillagerStatus =
  | "idle" // 村にいる（待機中）
  | "traveling_to" // ダンジョンへ移動中
  | "active" // ダンジョンで活動中（採取または討伐）
  | "traveling_back" // 村へ帰還中
  | "resting"; // 宿屋で休息中

export interface VillagerBaseStats {
  level: number;
  exp: number;
  maxHp: number;
  currentHp: number;
  stamina: number;
  maxStamina: number;
  str: number;
  int: number;
  dex: number;
  agi: number;
  vit: number;
}

export interface VillagerJobInfo {
  currentJob: JobType;
  jobHistory: JobType[];
}

export interface VillagerEquipment {
  weaponId: string;
  armorId: string;
}

export interface VillagerStatusInfo {
  order: OrderType;
  status: VillagerStatus;
  destinationAreaId: string | null;
  travelTimeLeft: number;
  assignedCraftJobId: string | null;
  targetGatherItemId: string | null;
  targetMonsterId: string | null;
  autoTargetName?: string | null;
}

export interface VillagerInventory {
  potionItemId?: string;
  potionCount: number;
  staminaDrinkItemId?: string;
  staminaDrinkCount: number;
}

export interface VillagerBonuses {
  bonusStr: number;
  bonusInt: number;
  bonusDex: number;
  bonusAgi: number;
  bonusVit: number;
  bonusMaxHp: number;
  bonusMaxStamina: number;
}

export interface Villager
  extends
    VillagerBaseStats,
    VillagerJobInfo,
    VillagerEquipment,
    VillagerStatusInfo,
    VillagerInventory,
    VillagerBonuses {
  id: string;
  name: string;
  activeFoodBuffId: string | null;
  gold: number;
  pool: Record<string, number>;
  isStarving?: boolean;
}

export interface CraftJob {
  id: string;
  itemId: string;
  timeLeft: number;
  totalTime: number;
  assignedVillagerId: string | null;
}

export type FacilityType =
  | "inn"
  | "workshop"
  | "kitchen"
  | "blacksmith"
  | "alchemy"
  | "market"
  | "guild"
  | "weapon_shop"
  | "pharmacy"
  | "farm"
  | "lumberyard"
  | "quarry";

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
  str: number;
  int: number;
  dex: number;
  agi: number;
  vit: number;
  expReward: number;
  drops: { itemId: string; chance: number }[]; // 0.0 - 1.0
  isBoss?: boolean;
  unlockedAtProgress?: number; // 追加：解放に必要な探索度
}

export interface DungeonGather {
  itemId: string;
  difficulty: number;
  unlockedAtProgress?: number;
  currentProgress?: number; // 採取進捗 (0 - 100)
  respawnTimeLeft?: number; // リスポーン残り時間 (時間)
  respawnTimeTotal?: number; // リスポーン所要時間 (時間)
}

export interface DungeonMonster extends Monster {
  currentProgress?: number; // 遭遇/戦闘進捗 (0 - 100)
  respawnTimeLeft?: number; // リスポーン残り時間 (時間)
  respawnTimeTotal?: number; // リスポーン所要時間 (時間)
}

export interface DungeonArea {
  id: string;
  name: string;
  distance: number; // 往路・復路に必要な時間（時間単位）
  recommendedLevel: number;
  unlockedAtTier: number;
  gathers: DungeonGather[];
  monsters: DungeonMonster[];
  explorationProgress: number; // 追加：現在の探索度 (0 - 100)
  difficulty: number; // 追加：探索難易度
}

export interface GameLog {
  id: string;
  timestamp: string; // "1日目 12:00" のようなフォーマット
  message: string;
  type: "info" | "combat" | "gather" | "craft" | "upgrade" | "system" | "warning" | "error";
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

export interface Town {
  id: string;
  name: string;
  distance: number; // 往復にかかる時間 (時間単位)
  friendship: number; // 0 - 1000 などの友好度
  level: number; // 友好度レベル 1 - 5
  description: string;
  specialties: string[]; // 特産品アイテムID
  demands: { itemId: string; multiplier: number }[]; // 需要アイテム
  investCost: number; // 投資費用
  investLevel: number; // 投資レベル
  isUnlocked: boolean; // 解放されているか
}

export interface Caravan {
  id: string; // "caravan_1", "caravan_2", ...
  status: "idle" | "trading" | "returned";
  destinationTownId: string | null;
  type: "export" | "import" | null;
  timeLeft: number; // 戻るまでの残り時間 (時間)
  totalTime: number; // 総時間
  cargo: { itemId: string; count: number }[]; // 輸出アイテムまたは購入したアイテム
  goldCost: number; // 輸入の際に支払ったゴールド
  goldEarned: number; // 輸出の際に得たゴールド
  friendshipEarned: number; // 獲得した友好度
  isAuto: boolean; // 自動交易が有効か
}

export interface MarketTrend {
  targetTownId: string;
  itemId: string;
  type: "demand" | "surplus";
  multiplier: number;
}

export interface ActiveBossState {
  monsterId: string;
  currentHp: number;
  maxHp: number;
  attackerIds: string[]; // 参加中の村人IDリスト
}

export interface TradeRule {
  id: string;
  itemId: string;
  type: "sell";
  threshold: number;
  isEnabled: boolean;
}

export interface GameActions {
  advanceHour: () => void;
  setVillagerOrder: (
    id: string,
    order: OrderType,
    areaId: string | null,
    targetGatherItemId?: string | null,
    targetMonsterId?: string | null,
  ) => void;
  changeVillagerJob: (id: string, job: JobType) => void;
  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => void;
  unequipItem: (villagerId: string, slot: "weapon" | "armor") => void;
  autoEquipAll: () => void;
  startCraft: (facilityId: FacilityType, itemId: string, villagerId?: string) => void;
  startFacilityUpgrade: (facilityId: FacilityType) => void;
  setTargetAmount: (itemId: string, count: number) => void;
  buySoulUpgrade: (upgradeId: string) => void;
  hireVillager: () => void;
  resetGame: (prestige?: boolean) => void;
  togglePause: () => void;
  setPlaySpeed: (speed: "normal" | "fast" | "super") => void;
  addLog: (message: string, type: GameLog["type"]) => void;
  advanceDay: () => void;
  dispatchIdleVillagers: () => void;
  startBossBattle: (monsterId: string, villagerIds: string[]) => void;
  withdrawFromBossBattle: () => void;
  addTradeRule: (itemId: string, type: "sell", threshold: number) => void;
  updateTradeRule: (ruleId: string, updates: Partial<Omit<TradeRule, "id" | "itemId">>) => void;
  deleteTradeRule: (ruleId: string) => void;
  toggleTradeRule: (ruleId: string) => void;
  sendExportCaravan: (
    caravanId: string,
    townId: string,
    cargo: { itemId: string; count: number }[],
  ) => void;
  sendImportCaravan: (
    caravanId: string,
    townId: string,
    cargo: { itemId: string; count: number }[],
    goldCost: number,
  ) => void;
  collectCaravan: (caravanId: string) => void;
  investInTown: (townId: string) => void;
  toggleCaravanAuto: (caravanId: string) => void;
  payVillagerDebts: () => void;
}

export interface GameState {
  currentDay: number;
  currentHour: number;
  gold: number;
  soulPoints: number;
  villagers: Villager[];
  facilities: Record<FacilityType, Facility>;
  dungeons: DungeonArea[];
  inventory: Record<string, number>; // itemId -> 所持数
  targetAmounts: Record<string, number>; // itemId -> 目標個数
  tradeRules: TradeRule[];
  logs: GameLog[];
  currentTier: number; // 1 to 5
  activeBoss: ActiveBossState | null; // 現在対峙中のボス。nullなら不在
  bossDefeated: boolean;
  gameLimitDays: number; // 現在のTierの制限日数
  gameOver: boolean;
  isPaused: boolean;
  playSpeed: "normal" | "fast" | "super"; // 自動進行のスピード
  soulUpgrades: Record<string, number>; // upgradeId -> 購入レベル
  towns: Town[];
  caravans: Caravan[];
  marketTrend: MarketTrend | null;
  isSalaryUnpaid: boolean;
}

export type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;

export type StoreGet = () => GameState & GameActions;
