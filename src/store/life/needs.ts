import type { Villager } from "../../types/game";

/**
 * Phase 2 欲求モデル (純関数・決定論的)。
 * 欲求は既存ステータスからの導出値であり、保存フィールドは作らない。
 * 各 0〜100 で、高いほど「欠乏」している (行動の駆動力になる)。
 */
export interface Needs {
  /** 空腹: 食事に行きたい */
  hunger: number;
  /** 疲労: 休みたい */
  fatigue: number;
  /** 健康欠乏: 宿屋・自宅で静養したい */
  illHealth: number;
  /** 社交: 広場で人と過ごしたい */
  social: number;
  /** 満足欠乏: 買い物・良い食事への渇き */
  wealthLack: number;
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * 文字列の決定論的ハッシュを 0〜1 未満で返す (FNV-1a)。
 * 個人差や固定ノイズの生成に使う。Math.random は使わない。
 */
export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function normalizeHour(hour: number): number {
  return ((Math.floor(hour) % 24) + 24) % 24;
}

/** 空腹: 飢餓 90 / 食事バフあり 20 / それ以外は朝から夕方へ単調に 40→70 */
function deriveHunger(villager: Villager, hour: number): number {
  if (villager.isStarving) return 90;
  if (villager.activeFoodBuffId) return 20;
  // 6時で 40、18時で 70 に達し、それ以降は 70 で頭打ち (単調非減少)
  return clamp100(40 + Math.min(30, Math.max(0, hour - 6) * 2.5));
}

/** 社交: 朝 30 から夕方 75 へ上がり、夜は 30 へ下がる。id ハッシュで ±15 の個人差 */
function deriveSocial(villager: Villager, hour: number): number {
  let base: number;
  if (hour >= 6 && hour <= 18) {
    base = 30 + (hour - 6) * 3.75; // 6時: 30 → 18時: 75
  } else if (hour > 18) {
    base = 75 - (hour - 18) * 7.5; // 24時: 30
  } else {
    base = 30;
  }
  const personal = (hash01(villager.id) * 2 - 1) * 15;
  return clamp100(base + personal);
}

/** 満足欠乏: 0G→80、200G→40、1000G以上→10 の折れ線。ツケ (マイナス) は 95 */
function deriveWealthLack(gold: number): number {
  if (gold < 0) return 95;
  if (gold >= 1000) return 10;
  if (gold <= 200) return 80 - gold * 0.2; // 0→80, 200→40
  return 40 - (gold - 200) * 0.0375; // 200→40, 1000→10
}

export function deriveNeeds(villager: Villager, hour: number): Needs {
  const h = normalizeHour(hour);
  const fatigue =
    villager.maxStamina > 0
      ? clamp100(100 - (villager.stamina / villager.maxStamina) * 100)
      : 100;
  const illHealth =
    villager.maxHp > 0 ? clamp100(100 - (villager.currentHp / villager.maxHp) * 100) : 100;
  return {
    hunger: deriveHunger(villager, h),
    fatigue,
    illHealth,
    social: deriveSocial(villager, h),
    wealthLack: deriveWealthLack(villager.gold),
  };
}
