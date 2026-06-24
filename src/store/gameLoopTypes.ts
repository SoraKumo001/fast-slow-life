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
  activeBoss: ActiveBossState | null;
  bossDefeated: boolean;
  gameLimitDays: number;
  gameOver: boolean;
  gameOverReason: string;
  isPaused: boolean;
  logsToAppend: LogPayload[];
  towns: Town[];
  caravans: Caravan[];
  isSalaryUnpaid: boolean;
  consecutiveNegativeGoldDays: number;
  stats: RunStats;
}
