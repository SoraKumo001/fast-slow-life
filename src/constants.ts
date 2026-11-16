/** 訓練完了後、同じ村人が再度訓練可能になるまでの日数 */
export const TRAINING_COOLDOWN_DAYS = 5;

export const HOURS_PER_DAY = 24;
export const MAX_LOG_COUNT = 100;

export const BASE_STAT = 10;
export const BASE_HP = 100;
export const BASE_STAMINA = 100;
export const STAT_GROWTH_PER_LEVEL = 5;
export const HP_GROWTH_PER_LEVEL = 20;
export const STAMINA_GROWTH_PER_LEVEL = 15;
export const EXP_NEEDED_PER_LEVEL = 40;
/** Phase 6: 高レベル帯の必要XP逓増（2次項）。必要XP = Lv×40 + (Lv-1)² × この値 */
export const EXP_NEEDED_QUADRATIC_PER_LEVEL = 8;
/** Phase 6: ソウルアップグレード価格の周回逓増率（転生するたびに価格がこの倍率で上がる） */
export const SOUL_UPGRADE_COST_GROWTH_PER_CYCLE = 2;
export const STAMINA_COST_PER_HOUR = 5;

export const FOOD_CONSUMPTION_PER_VILLAGER = 1.0 / 24.0;
/** 配給の価格 (G/日・人): Buff 料理を食べていない村人が払う食料代。
 *  Phase 5 バランス再調整 (レバー3) で 2 → 10 に引き上げ (旧: survival.ts のリテラル) */
export const DAILY_RATION_COST_GOLD = 10;

// Phase 5 バランス再調整 (レバー4): 1500 → 500（序盤の投資判断を重くする）
export const STARTING_GOLD = 500;
export const STARTING_FOOD = 80;
export const VILLAGER_STARTING_GOLD = 200;

export const HIRE_COST = 80;
export const BASE_MAX_VILLAGERS = 5;
export const MAX_VILLAGERS_ABSOLUTE = 14;
export const VILLAGERS_PER_GUILD_LEVEL = 2;

export const MAX_POTIONS_PER_VILLAGER = 2;
export const POTION_HEAL_AMOUNT = 50;

export const BASE_HP_RECOVERY = 10;
export const HP_RECOVERY_PER_INN_LEVEL = 5;
export const BASE_STAMINA_RECOVERY = 15;
export const STAMINA_RECOVERY_PER_INN_LEVEL = 5;
export const INN_COST_PER_HOUR = 2;

export const HUNT_MAX_TURNS = 10;
export const BOSS_BATTLE_ROUNDS = 5;
export const BOSS_REGEN_PERCENT = 0.002;
/** Phase 6: 交戦可能なアタッカーが不在のまま経過したらボスが離脱（全回復）するまでの猶予時間 */
export const BOSS_DISENGAGE_GRACE_HOURS = 24;
export const STARVATION_HP_LOSS_PERCENT = 0.004;
export const STARVATION_EFFICIENCY_PENALTY = 0.5;
export const ZERO_STAMINA_PENALTY = 0.3;
export const POTION_REFUND_RATE = 0.5;
export const WARRIOR_DAMAGE_BONUS = 1.3;
export const MIN_DAMAGE = 10;
export const MIN_BOSS_DAMAGE = 30;
export const DEF_EFFECT_FACTOR = 100;

export const BATTLE_POTION_HP_RATIO = 0.5;
export const RETREAT_HP_RATIO = 0.2;
export const STAMINA_DRINK_THRESHOLD = 30;

export const GATHER_STAT_WEIGHT_PRIMARY = 0.7;
export const GATHER_STAT_WEIGHT_SECONDARY = 0.3;
export const GATHER_PROGRESS_DEX_FACTOR = 0.8;
export const GATHER_PROGRESS_BASE = 10;
export const MONSTER_PROGRESS_AGI_FACTOR = 0.8;
export const MONSTER_PROGRESS_LEVEL_DIVISOR = 0.4;
export const MONSTER_PROGRESS_BASE = 2;

export const EXPLORATION_UNLOCK_1 = 40;
export const EXPLORATION_UNLOCK_2 = 50;
export const EXPLORATION_UNLOCK_3 = 70;

export const CRAFT_DEX_FACTOR = 0.005;

export const HIT_RATE_BASE = 85;
export const HIT_RATE_DEX_FACTOR = 1.5;
export const CRIT_RATE_CAP = 30;
export const CRIT_RATE_DEX_FACTOR = 0.1;

export const FOOD_GATHER_AMOUNT = 15;
export const BASE_GATHER_AMOUNT = 2;
export const STAT_GATHER_AMOUNT_FACTOR = 0.015;

export const CRAFTER_TIME_REDUCTION = 0.75;
export const CRAFT_QUEUE_MAX_LENGTH = 4;
export const BASE_GREAT_SUCCESS_RATE = 0.1;

export const BASE_UPGRADE_TIME = 5;
export const UPGRADE_TIME_PER_LEVEL = 5;

export const UPGRADE_DEX_FACTOR = 0.003;
export const UPGRADE_TIME_REDUCTION_CRAFTER = 0.75;
export const UPGRADE_TIME_REDUCTION_MINER = 0.85;

export const DISCOUNT_PER_SOUL_LEVEL = 0.2;

export const HERITAGE_GOLD_PER_LEVEL = 5000;
export const STORAGE_FOOD_PER_LEVEL = 800;
export const BODY_STAT_PER_LEVEL = 25;
export const BUILDING_COST_REDUCTION = 0.2;
export const EDUCATION_EXP_BONUS = 1.5;

export const DEFAULT_GATHER_RESPAWN_HOURS = 3;
export const HARD_GATHER_RESPAWN_HOURS = 6;
export const RARE_GATHER_RESPAWN_HOURS = 12;
export const DEFAULT_MONSTER_RESPAWN_HOURS = 4;
export const HARD_MONSTER_RESPAWN_HOURS = 8;
export const BOSS_MONSTER_RESPAWN_HOURS = 16;

export const AUTO_GATHER_TARGET_PENALTY = 0.001;
export const AUTO_GATHER_EXCEED_PENALTY = 0.01;

export const SPAWN_DAYS_BONUS = 2;

// Phase 5 バランス再調整 (レバー4): 300 → 900（施設強化の進行を緩やかにする）
export const UPGRADE_COST_GOLD_MULTIPLIER = 900;
export const UPGRADE_COST_MATERIAL_INCREMENT = 5;

// クラフト工賃
export const CRAFT_WAGE_BASE = 4;
export const CRAFT_WAGE_DEX_FACTOR = 0.1;
export const CRAFT_WAGE_CRAFTER_MULTIPLIER = 1.2;
export const CRAFT_EXP_PER_HOUR = 2;

export const CATEGORY_FOOD = "food";
export const CATEGORY_ORE = "ore";
export const CATEGORY_HERB = "herb";
export const CATEGORY_MANA_STONE = "mana_stone";
export const CATEGORY_MATERIAL = "material";
export const CATEGORY_GEAR_WEAPON = "gear_weapon";
export const CATEGORY_GEAR_ARMOR = "gear_armor";

export const POTION_PRIORITY = ["elixir", "high_potion", "potion"];

// ── ダンジョン脅威度システム ──
// Phase 5 バランス再調整: 0.1/1.1 → 0.3/1.3（脅威度100%到達が約22日→約3.6日/Tierに短縮し、
// 襲撃の圧を常態化させる）
export const THREAT_BASE_RATE_PER_HOUR = 0.3;
export const THREAT_ACCELERATION_EXPONENT = 1.3;
export const THREAT_MAX = 100;

/** お布施: Tierごとの基本コスト (G/%)。インデックスがTierに対応 */
export const OFFERING_BASE_GOLD_BY_TIER = [0, 2, 10, 50, 250, 1000];
/** お布施: 逓増係数 */
export const OFFERING_ESCALATION_FACTOR = 1.08;

export const STAT_LABEL_MAP: Record<string, string> = {
  attack: "攻撃",
  defense: "防御",
  str: "STR",
  int: "INT",
  dex: "DEX",
  agi: "AGI",
  vit: "VIT",
};
