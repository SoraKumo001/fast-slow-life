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
  isSalaryUnpaid: boolean;
  consecutiveNegativeGoldDays: number;
  lastSchedulerTick: number;
  stats: RunStats;
  maxThreatLevelReached: number;
  tierStartDay: number;
  dungeonEvents?: DungeonVisualEvent[];
}
