import {
  WARRIOR_DAMAGE_BONUS,
  MIN_DAMAGE,
  HIT_RATE_BASE,
  HIT_RATE_DEX_FACTOR,
  CRIT_RATE_CAP,
  CRIT_RATE_DEX_FACTOR,
  BATTLE_POTION_HP_RATIO,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { Villager, VillagerBaseStats, VillagerEquipment, VillagerJobInfo } from "../types/game";

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
  let defenderDef = effectiveVit + armorDef;
  if (isCritical) defenderDef *= 0.5;

  const baseDamage = attacker.atk - defenderDef;
  let damage = Math.max(minDamage, Math.floor(baseDamage));
  if (isCritical) damage = Math.floor(damage * 1.5);

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
