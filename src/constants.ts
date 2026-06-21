export const TIER_LIMIT_DAYS = [0, 30, 70, 120, 180, 250];

export const HOURS_PER_DAY = 24;
export const MAX_LOG_COUNT = 100;

export const BASE_STAT = 10;
export const BASE_HP = 100;
export const BASE_STAMINA = 100;
export const STAT_GROWTH_PER_LEVEL = 3;
export const HP_GROWTH_PER_LEVEL = 15;
export const STAMINA_GROWTH_PER_LEVEL = 10;
export const EXP_NEEDED_PER_LEVEL = 50;
export const STAMINA_COST_PER_HOUR = 5;

export const FOOD_CONSUMPTION_PER_VILLAGER = 1.0 / 24.0;

export const STARTING_GOLD = 500;
export const STARTING_FOOD = 50;
export const VILLAGER_STARTING_GOLD = 50;

export const HIRE_COST = 100;
export const BASE_MAX_VILLAGERS = 3;
export const MAX_VILLAGERS_ABSOLUTE = 10;
export const VILLAGERS_PER_GUILD_LEVEL = 2;

export const MAX_POTIONS_PER_VILLAGER = 2;
export const POTION_HEAL_AMOUNT = 50;

export const BASE_HP_RECOVERY = 10;
export const HP_RECOVERY_PER_INN_LEVEL = 5;
export const BASE_STAMINA_RECOVERY = 15;
export const STAMINA_RECOVERY_PER_INN_LEVEL = 5;

export const HUNT_MAX_TURNS = 10;
export const BOSS_BATTLE_ROUNDS = 5;
export const BOSS_REGEN_PERCENT = 0.002;
export const STARVATION_HP_LOSS_PERCENT = 0.004;
export const STARVATION_EFFICIENCY_PENALTY = 0.5;
export const ZERO_STAMINA_PENALTY = 0.3;
export const WARRIOR_DAMAGE_BONUS = 1.3;
export const MIN_DAMAGE = 2;
export const MIN_BOSS_DAMAGE = 5;

export const BATTLE_POTION_HP_RATIO = 0.5;
export const RETREAT_HP_RATIO = 0.3;
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

export const FOOD_GATHER_AMOUNT = 10;
export const BASE_GATHER_AMOUNT = 1;
export const STAT_GATHER_AMOUNT_FACTOR = 0.01;

export const CRAFTER_TIME_REDUCTION = 0.8;
export const CRAFT_QUEUE_MAX_LENGTH = 3;
export const BASE_GREAT_SUCCESS_RATE = 0.05;

export const BASE_UPGRADE_TIME = 5;
export const UPGRADE_TIME_PER_LEVEL = 5;

export const DISCOUNT_PER_SOUL_LEVEL = 0.1;

export const HERITAGE_GOLD_PER_LEVEL = 500;
export const STORAGE_FOOD_PER_LEVEL = 100;
export const BODY_STAT_PER_LEVEL = 2;
export const BUILDING_COST_REDUCTION = 0.05;
export const EDUCATION_EXP_BONUS = 0.1;

export const DEFAULT_GATHER_RESPAWN_HOURS = 3;
export const HARD_GATHER_RESPAWN_HOURS = 6;
export const RARE_GATHER_RESPAWN_HOURS = 12;
export const DEFAULT_MONSTER_RESPAWN_HOURS = 4;
export const HARD_MONSTER_RESPAWN_HOURS = 8;
export const BOSS_MONSTER_RESPAWN_HOURS = 16;

export const AUTO_GATHER_TARGET_PENALTY = 0.1;
export const AUTO_GATHER_EXCEED_PENALTY = 0.01;

export const SPAWN_DAYS_BONUS = 2;

export const UPGRADE_COST_GOLD_MULTIPLIER = 300;
export const UPGRADE_COST_MATERIAL_INCREMENT = 5;

export const CATEGORY_FOOD = "food";
export const CATEGORY_ORE = "ore";
export const CATEGORY_HERB = "herb";
export const CATEGORY_MANA_STONE = "mana_stone";
export const CATEGORY_MATERIAL = "material";
export const CATEGORY_GEAR_WEAPON = "gear_weapon";
export const CATEGORY_GEAR_ARMOR = "gear_armor";

export const POTION_PRIORITY = ["elixir", "high_potion", "mid_potion", "potion"];

export const STAT_LABEL_MAP: Record<string, string> = {
  attack: "攻撃",
  defense: "防御",
  str: "STR",
  int: "INT",
  dex: "DEX",
  agi: "AGI",
  vit: "VIT",
};
