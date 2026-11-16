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

export type DungeonActivityPhase =
  | "idle" // 村で待機・休息中
  | "traveling_to" // 村 → ダンジョン入口へ移動中
  | "moving_to_target" // ダンジョン内を目標深度へ歩行中
  | "gathering" // 採取ノードの前で採取作業中
  | "fighting" // モンスター（またはボス）と現地で交戦中
  | "returning"; // ダンジョンから村へ帰還中

export interface VillagerDungeonState {
  currentDepth: number; // 現在の奥行き位置 (0 〜 maxDepth)
  targetDepth: number; // 目標ノード/モンスターの奥行き位置
  lane: number; // 横方向レーン (-1.5 〜 +1.5)
  phase: DungeonActivityPhase;
  targetNodeId: string | null; // 採取中の itemId または交戦中の monsterId
}

export type DungeonVisualEventType =
  | "move"
  | "gather"
  | "attack"
  | "crit"
  | "miss"
  | "enemy_attack"
  | "heal"
  | "defeat"
  | "wipeout";

export interface DungeonVisualEvent {
  id: string;
  areaId: string;
  type: DungeonVisualEventType;
  actorId: string;
  targetId?: string;
  depth: number;
  lane: number;
  value?: number;
  label?: string;
  isCrit?: boolean;
}

export interface VillagerStatusInfo {
  order: OrderType;
  status: VillagerStatus;
  destinationAreaId: string | null;
  travelTimeLeft: number;
  assignedCraftJobId: string | null;
  targetMonsterId: string | null;
  autoTargetName?: string | null;
  /** 自動パーティーのステッガーオフセット (0〜SCHEDULER_INTERVAL_HOURS-1) */
  partyEngagementOffset?: number;
  /** ダンジョン内の空間位置・行動フェーズ */
  dungeonState?: VillagerDungeonState;
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
  depth?: number; // ダンジョン内配置深度 (m)
  lane?: number; // 横方向レーン (-1.5 〜 +1.5)
}

export interface DungeonMonster extends Monster {
  currentProgress?: number; // 遭遇/戦闘進捗 (0 - 100)
  currentHp?: number; // 現地交戦中の現在HP
  respawnTimeLeft?: number; // リスポーン残り時間 (時間)
  respawnTimeTotal?: number; // リスポーン所要時間 (時間)
  depth?: number; // ダンジョン内配置深度 (m)
  lane?: number; // 横方向レーン (-1.5 〜 +1.5)
}

export interface DungeonArea {
  id: string;
  name: string;
  distance: number; // 往路・復路に必要な時間（時間単位）
  maxDepth: number; // ダンジョンの奥行き (m)
  recommendedLevel: number;
  unlockedAtTier: number;
  gathers: DungeonGather[];
  monsters: DungeonMonster[];
  explorationProgress: number; // 追加：現在の探索度 (0 - 100)
  difficulty: number; // 追加：探索難易度
  threatLevel: number; // 脅威度 (0-100) — 100% 到達で即ゲームオーバー
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
  /** Phase 4a: 探索中の村人を帰還させる（自然帰還と同じ遷移） */
  recallVillager: (villagerId: string) => void;
  /** Phase 4a: 最大4人の村人を同一ターゲットへ一括派遣する */
  dispatchParty: (params: {
    villagerIds: string[];
    areaId: string;
    order: "gather" | "hunt";
    targetId?: string | null;
  }) => void;
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
  offerToDungeon: (dungeonId: string, percentToReduce: number) => string | null;
  payVillagerReward: (villagerId: string, amount: number) => void;
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
  setPricePolicy: (policy: PricePolicy) => void;
  setSelectedItem: (item: Item | null) => void;
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

/** 価格方針（条例）: 市場価格の水準を決める */
export type PricePolicy = "cheap" | "standard" | "premium";

/** 夕方の精算: 1日分の内部フロー集計（最新分のみ保持する） */
export interface DailySettlement {
  day: number;
  /** プール買取で金庫から出た額 */
  poolPurchase: number;
  /** 食料代として金庫に入った額 */
  foodIncome: number;
  /** クラフト賃金で金庫から出た額 */
  craftWages: number;
  /** キャラバンの日次ネット（economy フェーズのキャラバン関連処理の gold 差分で近似） */
  caravanNet: number;
}

/** 日次フローの進行中アキュムレータ（日境界で精算されリセットされる。永続化しない） */
export interface DailyFlows {
  poolPurchase: number;
  foodIncome: number;
  craftWages: number;
  caravanNet: number;
  /** 買取不足の要約ログをその日に既に出したか（1日1回まで） */
  poolShortageLogged: boolean;
}

export interface GameEconomy {
  gold: number;
  soulPoints: number;
  soulUpgrades: Record<string, number>;
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
  facilities: Record<FacilityType, Facility>;
  /** アイテムID → 現在の市場価格（日境界で再計算される） */
  marketPrices: Record<string, number>;
  /** 価格方針（翌日の価格再計算から反映される） */
  pricePolicy: PricePolicy;
  /** 直近の夕方精算（最新分のみ） */
  lastSettlement: DailySettlement | null;
  /** 当日分の内部フロー集計（進行中） */
  dailyFlows: DailyFlows;
}

/** 襲撃イベントの状態（Phase 4b で使用。Phase 4a では型と初期値のみ用意） */
export interface RaidState {
  /** 襲撃元ダンジョンのID */
  dungeonId: string;
  /** 到着時刻（累計時間 = (day-1)*24 + hour） */
  arrivesAtElapsedHour: number;
  /** 襲撃してくる魔物のID一覧 */
  monsterIds: string[];
}

export interface GameWorld {
  dungeons: DungeonArea[];
  towns: Town[];
  caravans: Caravan[];
  activeBoss: ActiveBossState | null;
  /** Phase 4a: ダンジョンごとの解放済みノードID（霧） */
  revealedNodes: Record<string, string[]>;
  /** Phase 4b: 襲撃イベント（4a では常に null） */
  raid: RaidState | null;
}

export interface GameProgression {
  currentDay: number;
  currentHour: number;
  currentTier: number;
  bossDefeated: boolean;
  gameOver: boolean;
  gameOverReason: string;
  consecutiveNegativeGoldDays: number;
  lastSchedulerTick: number;
  /** この周回で到達した最大脅威度 (SP計算用) */
  maxThreatLevelReached: number;
  /** 現在の Tier が開始されたゲーム内日数（脅威度進行の基準） */
  tierStartDay: number;
}

export interface GameUI {
  isPaused: boolean;
  playSpeed: "normal" | "fast" | "super";
  selectedItem: Item | null;
  dungeonEvents: DungeonVisualEvent[];
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
