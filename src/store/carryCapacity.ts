import type { Villager } from "../types/game";

/**
 * Phase 4a: 運搬容量。
 * 採取・討伐で得たアイテムは村人の pool（所持品）に入り、
 * 容量 = 10 + floor(STR / 2)。満杯になると採取を止めて帰還する。
 * 買取（pool → 町の在庫）は町にいる村人に対してのみ行われる。
 */

/** 村人の運搬容量 */
export function carryCapacity(v: Villager): number {
  return 10 + Math.floor(v.str / 2);
}

/** 現在の所持数（pool の合計） */
export function carriedCount(v: Villager): number {
  return Object.values(v.pool ?? {}).reduce((sum, n) => sum + (n || 0), 0);
}

/** 容量いっぱいかどうか */
export function isAtCapacity(v: Villager): boolean {
  return carriedCount(v) >= carryCapacity(v);
}
