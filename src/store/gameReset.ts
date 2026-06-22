import {
  STARTING_GOLD,
  STARTING_FOOD,
  HERITAGE_GOLD_PER_LEVEL,
  STORAGE_FOOD_PER_LEVEL,
  TIER_LIMIT_DAYS,
} from "../constants";
import { ITEMS } from "../data/masterData";
import {
  GameState,
  Villager,
  Facility,
  DungeonArea,
  GameLog,
  FacilityType,
  TradeRule,
  Town,
  Caravan,
  MarketTrend,
} from "../types/game";
import {
  getInitialVillagers,
  getInitialFacilities,
  getInitialDungeons,
  getDefaultTargetAmounts,
  createInitialInventory,
  getInitialTowns,
  getInitialCaravans,
} from "./initialState";

/** ゲーム終了時の獲得SPを計算する共通ヘルパー */
export const calculateEarnedSp = (
  state: Pick<GameState, "gold" | "inventory" | "currentTier" | "bossDefeated" | "currentDay">,
): number => {
  const invValue = Object.entries(state.inventory).reduce((sum, [itemId, count]) => {
    return sum + (ITEMS[itemId]?.basePrice || 0) * count;
  }, 0);
  const bossCount = state.currentTier - (state.bossDefeated ? 0 : 1);
  return (
    Math.floor(state.gold / 1000) +
    Math.floor(invValue / 100) +
    bossCount * 50 +
    state.currentDay * 2
  );
};

export interface ResetResult {
  currentDay: number;
  currentHour: number;
  gold: number;
  soulPoints: number;
  villagers: Villager[];
  facilities: Record<FacilityType, Facility>;
  dungeons: DungeonArea[];
  inventory: Record<string, number>;
  targetAmounts: Record<string, number>;
  tradeRules: TradeRule[];
  logs: GameLog[];
  currentTier: number;
  activeBoss: null;
  bossDefeated: boolean;
  gameLimitDays: number;
  gameOver: boolean;
  isPaused: boolean;
  towns: Town[];
  caravans: Caravan[];
  marketTrend: MarketTrend | null;
  isSalaryUnpaid: boolean;
  consecutiveNegativeGoldDays: number;
}

export function resetGameHelper(params: {
  prestige: boolean;
  state: {
    gameOver: boolean;
    gold: number;
    inventory: Record<string, number>;
    currentTier: number;
    bossDefeated: boolean;
    currentDay: number;
    soulPoints: number;
    soulUpgrades: Record<string, number>;
  };
}): ResetResult {
  const { prestige, state } = params;
  let earnedSp = 0;

  if (prestige) {
    if (state.gameOver) {
      // ゲームオーバーによる転生の場合、SPは advanceHour 時点で既に加算済みなので再計算しない
      earnedSp = 0;
    } else {
      // 任意転生の場合は通常通り計算して加算
      earnedSp = calculateEarnedSp(state);
    }
  }

  const heritageLvl = state.soulUpgrades.heritage || 0;
  const storageLvl = state.soulUpgrades.storage || 0;

  const startGold = STARTING_GOLD + heritageLvl * HERITAGE_GOLD_PER_LEVEL;
  const startFood = STARTING_FOOD + storageLvl * STORAGE_FOOD_PER_LEVEL;

  const bodyLvl = state.soulUpgrades.body || 0;

  const logs: GameLog[] = [
    {
      id: prestige ? "prestige_init" : "init",
      timestamp: "1日目 00:00",
      message: prestige
        ? `ソウルポイントを ${earnedSp} SP 獲得し、新たな周回を開始しました。`
        : "ゲームを初期状態からリスタートしました。",
      type: "system",
    },
  ];

  return {
    currentDay: 1,
    currentHour: 0,
    gold: startGold,
    soulPoints: state.soulPoints + earnedSp,
    villagers: getInitialVillagers(bodyLvl),
    facilities: getInitialFacilities(),
    dungeons: getInitialDungeons(),
    inventory: createInitialInventory(startFood),
    targetAmounts: getDefaultTargetAmounts(),
    tradeRules: [],
    logs,
    currentTier: 1,
    activeBoss: null,
    bossDefeated: false,
    gameLimitDays: TIER_LIMIT_DAYS[1],
    gameOver: false,
    isPaused: true,
    towns: getInitialTowns(),
    caravans: getInitialCaravans(),
    marketTrend: null,
    isSalaryUnpaid: false,
    consecutiveNegativeGoldDays: 0,
  };
}
