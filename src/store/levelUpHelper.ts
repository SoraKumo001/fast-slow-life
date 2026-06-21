import {
  STAT_GROWTH_PER_LEVEL,
  HP_GROWTH_PER_LEVEL,
  STAMINA_GROWTH_PER_LEVEL,
  EXP_NEEDED_PER_LEVEL,
} from "../constants";
import { Villager } from "../types/game";

export function tryLevelUp(villager: Villager): { leveled: boolean; updated: Villager } {
  const expNeeded = villager.level * EXP_NEEDED_PER_LEVEL;
  if (villager.exp < expNeeded) {
    return { leveled: false, updated: villager };
  }

  return {
    leveled: true,
    updated: {
      ...villager,
      level: villager.level + 1,
      exp: villager.exp - expNeeded,
      str: villager.str + STAT_GROWTH_PER_LEVEL,
      int: villager.int + STAT_GROWTH_PER_LEVEL,
      dex: villager.dex + STAT_GROWTH_PER_LEVEL,
      agi: villager.agi + STAT_GROWTH_PER_LEVEL,
      vit: villager.vit + STAT_GROWTH_PER_LEVEL,
      maxHp: villager.maxHp + HP_GROWTH_PER_LEVEL,
      maxStamina: (villager.maxStamina || 100) + STAMINA_GROWTH_PER_LEVEL,
      currentHp: villager.maxHp + HP_GROWTH_PER_LEVEL,
    },
  };
}
