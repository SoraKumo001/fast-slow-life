import {
  WARRIOR_DAMAGE_BONUS,
  MIN_DAMAGE,
  HIT_RATE_BASE,
  HIT_RATE_DEX_FACTOR,
  CRIT_RATE_CAP,
  CRIT_RATE_DEX_FACTOR,
  BATTLE_POTION_HP_RATIO,
  DEF_EFFECT_FACTOR,
} from "../constants";
import { ITEMS } from "../data/masterData";
import {
  Villager,
  VillagerBaseStats,
  VillagerEquipment,
  VillagerJobInfo,
  RunStats,
} from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function getFoodBuffBonus(
  buffId: string | null,
  stat: "str" | "int" | "dex" | "agi" | "vit" | "maxHp" | "maxStamina",
): number {
  if (!buffId) return 0;
  const foodItem = ITEMS[buffId];
  return foodItem?.foodBuff?.[stat] || 0;
}

export function applySalaryDebuff(value: number, isUnpaid: boolean): number {
  if (!isUnpaid) return value;
  return Math.floor(value * 0.7);
}

export const computeEffectiveAtk = (v: Villager, buffStr: number, buffInt: number): number => {
  const isSalaryUnpaid = v.gold < 0;
  const weaponAtk = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0;
  const weaponInt = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0;
  const rawStr = v.str + buffStr;
  const rawInt = v.int + buffInt;
  const effectiveStr = applySalaryDebuff(rawStr, isSalaryUnpaid);
  const effectiveInt = applySalaryDebuff(rawInt, isSalaryUnpaid);
  const physical = Math.floor(effectiveStr * 1.5 + weaponAtk);
  const magical = Math.floor(effectiveInt * 1.8 + weaponInt);
  return Math.max(physical, magical);
};

export const computeEffectiveDef = (v: Villager, buffVit: number): number => {
  const isSalaryUnpaid = v.gold < 0;
  const armorDef = v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0;
  const rawVit = v.vit + buffVit;
  const effectiveVit = applySalaryDebuff(rawVit, isSalaryUnpaid);
  return Math.floor(effectiveVit + armorDef);
};

export function calculateHitRate(attackerDex: number, defenderAgi: number): number {
  return Math.max(
    50,
    Math.min(100, HIT_RATE_BASE + (attackerDex - defenderAgi) * HIT_RATE_DEX_FACTOR),
  );
}

export function calculateCritRate(attackerDex: number): number {
  return Math.min(CRIT_RATE_CAP, attackerDex * CRIT_RATE_DEX_FACTOR);
}

export interface PlayerAttackParams {
  attacker: VillagerBaseStats &
    Pick<VillagerJobInfo, "currentJob"> &
    Pick<VillagerEquipment, "weaponId"> & { activeFoodBuffId?: string | null };
  defender: { def: number; mdef: number; vit: number; int: number; agi: number };
  isCritical: boolean;
  efficiency: number;
  isMagicUser: boolean;
  isSalaryUnpaid?: boolean;
}

export function calculatePlayerDamage(params: PlayerAttackParams): number {
  const {
    attacker,
    defender,
    isCritical,
    efficiency,
    isMagicUser,
    isSalaryUnpaid = false,
  } = params;

  let damage: number;
  if (isMagicUser) {
    let defenderDef = defender.mdef + defender.int * 0.5;
    if (isCritical) defenderDef *= 0.5;
    const weaponInt = ITEMS[attacker.weaponId || ""]?.equipment?.bonuses.int || 0;
    const buffInt = getFoodBuffBonus(attacker.activeFoodBuffId || null, "int");
    const rawInt = attacker.int + buffInt;
    const effectiveInt = applySalaryDebuff(rawInt, isSalaryUnpaid);
    const baseDamage = effectiveInt * 1.8 + weaponInt - defenderDef;
    damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency));
  } else {
    let defenderDef = defender.def + defender.vit * 0.5;
    if (isCritical) defenderDef *= 0.5;
    const weaponAtk = ITEMS[attacker.weaponId || ""]?.equipment?.bonuses.attack || 0;
    const isWarrior = attacker.currentJob === "戦士";
    const jobBonus = isWarrior ? WARRIOR_DAMAGE_BONUS : 1.0;
    const buffStr = getFoodBuffBonus(attacker.activeFoodBuffId || null, "str");
    const rawStr = attacker.str + buffStr;
    const effectiveStr = applySalaryDebuff(rawStr, isSalaryUnpaid);
    const baseDamage = effectiveStr * 1.5 + weaponAtk - defenderDef;
    damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * efficiency * jobBonus));
  }

  if (isCritical) damage = Math.floor(damage * 1.5);
  return damage;
}

export interface EnemyAttackParams {
  attacker: { dex: number; atk: number };
  defender: Pick<VillagerBaseStats, "agi" | "vit"> &
    Pick<VillagerEquipment, "armorId"> & { activeFoodBuffId?: string | null };
  isCritical: boolean;
  minDamage?: number;
  isSalaryUnpaid?: boolean;
}

export function calculateEnemyDamage(params: EnemyAttackParams): number {
  const { attacker, defender, isCritical, minDamage = MIN_DAMAGE, isSalaryUnpaid = false } = params;

  const armorDef = ITEMS[defender.armorId || ""]?.equipment?.bonuses.defense || 0;
  const buffVit = getFoodBuffBonus(defender.activeFoodBuffId || null, "vit");
  const rawVit = defender.vit + buffVit;
  const effectiveVit = applySalaryDebuff(rawVit, isSalaryUnpaid);
  const defenderDef = effectiveVit + armorDef;

  // 乗算式: 防御が高いほど減衰率が上がるが、ゼロにはならない
  const reduction = DEF_EFFECT_FACTOR / (DEF_EFFECT_FACTOR + defenderDef);
  const baseDamage = attacker.atk * reduction;

  let damage = Math.max(minDamage, Math.floor(baseDamage));
  if (isCritical) damage = Math.floor(damage * 1.8);

  return damage;
}

export function useBattlePotion(
  villager: Villager,
  isSalaryUnpaid: boolean = false,
): {
  updated: Villager;
  healed: number;
  used: boolean;
} {
  const buffMaxHp = getFoodBuffBonus(villager.activeFoodBuffId || null, "maxHp");
  const rawMaxHp = villager.maxHp + buffMaxHp;
  const effectiveMaxHp = applySalaryDebuff(rawMaxHp, isSalaryUnpaid);
  if (villager.currentHp > effectiveMaxHp * BATTLE_POTION_HP_RATIO || villager.potionCount <= 0) {
    return { updated: villager, healed: 0, used: false };
  }

  const pId = villager.potionItemId || "potion";
  const healAmt = ITEMS[pId]?.healAmount || 50;
  return {
    updated: {
      ...villager,
      potionCount: villager.potionCount - 1,
      currentHp: Math.min(effectiveMaxHp, villager.currentHp + healAmt),
    },
    healed: healAmt,
    used: true,
  };
}

export interface ExecutePlayerAttackParams {
  attacker: Villager;
  defender: { agi: number; def?: number; mdef?: number; vit?: number; int?: number };
  efficiency: number;
  isMagicUser: boolean;
  isSalaryUnpaid?: boolean;
  stats?: RunStats;
  logPrefix: string;
  attackerName: string;
  defenderName: string;
}

export function executePlayerAttack(params: ExecutePlayerAttackParams): {
  hit: boolean;
  damage: number;
  isCritical: boolean;
  log: LogPayload;
} {
  const {
    attacker,
    defender,
    efficiency,
    isMagicUser,
    isSalaryUnpaid = false,
    stats,
    logPrefix,
    attackerName,
    defenderName,
  } = params;

  const buffDex = getFoodBuffBonus(attacker.activeFoodBuffId || null, "dex");
  const effectiveDex = applySalaryDebuff(attacker.dex + buffDex, isSalaryUnpaid);
  const hitRate = calculateHitRate(effectiveDex, defender.agi);
  const isHit = Math.random() * 100 < hitRate;

  if (stats) stats.totalAttacksAttempted += 1;

  if (!isHit) {
    return {
      hit: false,
      damage: 0,
      isCritical: false,
      log: {
        message: `${logPrefix}${attackerName} の攻撃！ しかし${defenderName}に回避された。`,
        type: "combat",
      },
    };
  }

  if (stats) stats.totalAttacksLanded += 1;
  const critRate = calculateCritRate(effectiveDex);
  const isCritical = Math.random() * 100 < critRate;

  const damage = calculatePlayerDamage({
    attacker,
    defender: defender as { def: number; mdef: number; vit: number; int: number; agi: number },
    isCritical,
    efficiency,
    isMagicUser,
    isSalaryUnpaid,
  });

  if (isCritical && stats) stats.totalCriticalHits += 1;
  if (stats) stats.totalDamageDealt += damage;

  return {
    hit: true,
    damage,
    isCritical,
    log: {
      message: `${logPrefix}${attackerName} の攻撃！${defenderName}に ${damage} ダメージを与えた。${isCritical ? " (クリティカル！)" : ""}`,
      type: "combat",
    },
  };
}

export interface ExecuteEnemyAttackParams {
  attacker: { dex: number; atk: number };
  defender: Villager;
  minDamage?: number;
  isSalaryUnpaid?: boolean;
  stats?: RunStats;
  logPrefix: string;
  attackerName: string;
  defenderName: string;
  attackLabel?: string;
}

export function executeEnemyAttack(params: ExecuteEnemyAttackParams): {
  hit: boolean;
  damage: number;
  isCritical: boolean;
  log: LogPayload;
} {
  const {
    attacker,
    defender,
    minDamage,
    isSalaryUnpaid = false,
    stats,
    logPrefix,
    attackerName,
    defenderName,
    attackLabel = "攻撃",
  } = params;

  const buffAgi = getFoodBuffBonus(defender.activeFoodBuffId || null, "agi");
  const effectiveAgi = applySalaryDebuff(defender.agi + buffAgi, isSalaryUnpaid);
  const hitRate = calculateHitRate(attacker.dex, effectiveAgi);
  const isHit = Math.random() * 100 < hitRate;

  if (!isHit) {
    return {
      hit: false,
      damage: 0,
      isCritical: false,
      log: {
        message: `${logPrefix}${attackerName}の${attackLabel}！ しかし ${defenderName} は回避した。`,
        type: "combat",
      },
    };
  }

  const critRate = calculateCritRate(attacker.dex);
  const isCritical = Math.random() * 100 < critRate;

  const damage = calculateEnemyDamage({
    attacker,
    defender,
    isCritical,
    minDamage,
    isSalaryUnpaid,
  });

  if (stats) stats.totalDamageReceived += damage;

  return {
    hit: true,
    damage,
    isCritical,
    log: {
      message: `${logPrefix}${attackerName}の${attackLabel}！ ${defenderName} は ${damage} ダメージを受けた。${isCritical ? " (クリティカル！)" : ""}`,
      type: "combat",
    },
  };
}
