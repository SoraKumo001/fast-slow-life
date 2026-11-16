import {
  GameLog,
  Villager,
  DungeonArea,
  Facility,
  FacilityType,
  ActiveBossState,
  Town,
  Caravan,
  RunStats,
  DungeonVisualEvent,
  PricePolicy,
  DailySettlement,
  DailyFlows,
  RaidState,
} from "../types/game";

export interface LogPayload {
  message: string;
  type: GameLog["type"];
}

export interface AdvanceHourResult {
  currentDay: number;
  currentHour: number;
  gold: number;
  villagers: Villager[];
  facilities: Record<FacilityType, Facility>;
  dungeons: DungeonArea[];
  inventory: Record<string, number>;
  currentTier: number;
  marketPrices: Record<string, number>;
  pricePolicy: PricePolicy;
  lastSettlement: DailySettlement | null;
  dailyFlows: DailyFlows;
  activeBoss: ActiveBossState | null;
  bossDefeated: boolean;
  gameOver: boolean;
  gameOverReason: string;
  isPaused: boolean;
  logsToAppend: LogPayload[];
  towns: Town[];
  caravans: Caravan[];
  /** Phase 4a: ダンジョンごとの解放済みノードID（霧） */
  revealedNodes: Record<string, string[]>;
  /** Phase 4b: 襲撃イベント（4a では常に null） */
  raid: RaidState | null;
  /** Phase 6: 防衛戦の連敗数 */
  raidDefeatStreak?: number;
  isSalaryUnpaid: boolean;
  consecutiveNegativeGoldDays: number;
  lastSchedulerTick: number;
  stats: RunStats;
  maxThreatLevelReached: number;
  tierStartDay: number;
  dungeonEvents?: DungeonVisualEvent[];
}
