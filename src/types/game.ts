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
  lastTrainingDay: number;
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
  | "alchemy"
  | "market"
  | "guild"
  | "weapon_shop"
  | "farm"
  | "lumberyard"
  | "quarry"
  | "training_ground";

export interface TrainingProgram {
  id: string;
  name: string;
  description: string;
  requiredFacilityLevel: number;
  requiredTime: number; // 訓練時間（時間単位）
  goldCost: number; // 総訓練費用
  statBonus: Partial<
    Record<"str" | "int" | "dex" | "agi" | "vit" | "maxHp" | "maxStamina", number>
  >;
}

export interface TrainingJob {
  id: string;
  programId: string;
  timeLeft: number;
  totalTime: number;
  assignedVillagerId: string;
  goldPerHour: number;
}

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
  trainingQueue: TrainingJob[];
  upgradeAssignedVillagerId: string | null;
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
  // レベル i → i+1 の強化に必要なSP。配列長は maxLevel と一致。
  // index 0 が Lv0→1 のコスト。参考: costPerLevel は非線形版へ移行済み。
  costs: number[];
  effectValue: number; // レベルごとの倍率・加算値
}

export interface Town {
  id: string;
  name: string;
  distance: number; // 往復にかかる時間 (時間単位)
  description: string;
  specialties: string[]; // 特産品アイテムID
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
  isAuto: boolean; // 自動交易が有効か
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
  setVillagerOrder: (params: {
    id: string;
    order: OrderType;
    areaId: string | null;
    targetMonsterId?: string | null;
  }) => void;
  changeVillagerJob: (id: string, job: JobType) => void;
  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => void;
  unequipItem: (villagerId: string, slot: "weapon" | "armor") => void;
  autoEquipAll: () => void;
  startCraft: (facilityId: FacilityType, itemId: string, villagerId?: string) => void;
  startFacilityUpgrade: (facilityId: FacilityType, villagerId?: string) => void;
  startTraining: (programId: string, villagerId: string) => void;
  setTargetAmount: (itemId: string, count: number) => void;
  buySoulUpgrade: (upgradeId: string) => void;
  downgradeSoulUpgrade: (upgradeId: string) => void;
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

export interface RunStats {
  totalGoldFromExports: number;
  totalGoldSpentOnImports: number;
  totalItemsGathered: number;
  totalMonstersDefeated: number;
  totalBossesDefeated: number;
  totalItemsCrafted: number;
  totalGoldFromPurchases: number;
  totalItemsPurchased: number;
  totalGoldFromTax: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalCriticalHits: number;
  totalAttacksLanded: number;
  totalAttacksAttempted: number;
  totalPotionHealing: number;
}

export interface GameEconomy {
  gold: number;
  soulPoints: number;
  soulUpgrades: Record<string, number>;
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
  facilities: Record<FacilityType, Facility>;
}

export interface GameWorld {
  dungeons: DungeonArea[];
  towns: Town[];
  caravans: Caravan[];
  activeBoss: ActiveBossState | null;
}

export interface GameProgression {
  currentDay: number;
  currentHour: number;
  currentTier: number;
  gameLimitDays: number;
  bossDefeated: boolean;
  gameOver: boolean;
  gameOverReason: string;
  consecutiveNegativeGoldDays: number;
  lastSchedulerTick: number;
}

export interface GameUI {
  isPaused: boolean;
  playSpeed: "normal" | "fast" | "super";
}

export interface GamePeople {
  villagers: Villager[];
  stats: RunStats;
  tradeRules: TradeRule[];
  logs: GameLog[];
  isSalaryUnpaid: boolean;
}

/**
 * ルート状態。論理グループ（Economy/World/Progression/UI/People）の交差型で構成。
 * 各フィールドはフラットにアクセス可能（state.gold, state.dungeons 等）。
 */
export interface GameState extends GameEconomy, GameWorld, GameProgression, GameUI, GamePeople {}

export type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;

export type StoreGet = () => GameState & GameActions;
