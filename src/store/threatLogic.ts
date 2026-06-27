import {
  THREAT_BASE_RATE_PER_HOUR,
  THREAT_ACCELERATION_EXPONENT,
  THREAT_MAX,
  OFFERING_BASE_GOLD_BY_TIER,
  OFFERING_ESCALATION_FACTOR,
  HOURS_PER_DAY,
} from "../constants";
import type { DungeonArea } from "../types/game";
import type { LogPayload } from "./gameLoopTypes";

// ==========================================
// 脅威度計算
// ==========================================

/**
 * 累積脅威度の「理論値」を時間から計算する。
 * 内部的には毎時のデルタ計算 (`calculateThreatDelta`) で使う基礎関数。
 * 単体で state を直接書き換える用途には使わない。
 */
export function calculateThreatLevel(elapsedHours: number): number {
  if (elapsedHours <= 0) return 0;
  const raw = THREAT_BASE_RATE_PER_HOUR * Math.pow(elapsedHours, THREAT_ACCELERATION_EXPONENT);
  return Math.min(THREAT_MAX, raw);
}

/**
 * 前回からの 1 ティック分の脅威度デルタを計算する。
 * お布施で既存の threatLevel を下げても、次のティックで
 * この差分だけが加算されるため軽減効果が持続する。
 */
export function calculateThreatDelta(
  previousElapsedHours: number,
  currentElapsedHours: number,
): number {
  if (currentElapsedHours <= previousElapsedHours) return 0;
  const previous = calculateThreatLevel(previousElapsedHours);
  const current = calculateThreatLevel(currentElapsedHours);
  return Math.max(0, current - previous);
}

/**
 * ゲーム開始からの経過時間 (hours) を計算する。
 */
export function getTotalElapsedHours(currentDay: number, currentHour: number): number {
  return (currentDay - 1) * HOURS_PER_DAY + currentHour;
}

/**
 * このダンジョンが脅威度上昇対象か判定する。
 * unlockedAtTier === currentTier （現在のTierで解放された未攻略ダンジョン）のみ上昇。
 * 攻略済み (bossDefeated=true または unlockedAtTier < currentTier) は対象外。
 */
export function isThreatActive(
  dungeon: DungeonArea,
  currentTier: number,
  bossDefeated: boolean,
): boolean {
  if (dungeon.threatLevel >= THREAT_MAX) return false; // 既に100%なら上昇不要
  if (dungeon.unlockedAtTier < currentTier) return false; // 攻略済み
  if (dungeon.unlockedAtTier === currentTier && bossDefeated) return false; // ボス撃破済み
  return dungeon.unlockedAtTier === currentTier;
}

/**
 * すべての未攻略ダンジョンの脅威度を更新する。
 * 100% 到達時は gameOver フラグと理由を返す。
 */
export function updateAllThreatLevels(
  dungeons: DungeonArea[],
  currentTier: number,
  bossDefeated: boolean,
  currentDay: number,
  currentHour: number,
  tierStartDay: number,
): {
  dungeons: DungeonArea[];
  logs: LogPayload[];
  maxThreatReached: number;
  gameOver: boolean;
  gameOverReason: string | null;
} {
  const totalHours = getTotalElapsedHours(currentDay, currentHour);
  const logs: LogPayload[] = [];
  let maxThreat = 0;
  let gameOver = false;
  let gameOverReason: string | null = null;

  const nextDungeons = dungeons.map((d) => {
    if (!isThreatActive(d, currentTier, bossDefeated)) {
      if (d.threatLevel > maxThreat) maxThreat = d.threatLevel;
      return d;
    }

    // Tier開始からの経過時間（時間関数の絶対値を計算するための基準）
    const tierStartDayForDungeon = getTierStartDay(d.unlockedAtTier, tierStartDay);
    const tierElapsedHours = Math.max(0, totalHours - tierStartDayForDungeon * HOURS_PER_DAY);
    // 前回のティックからの経過時間差分（delta）
    const previousTierHours = Math.max(0, tierElapsedHours - 1);
    const delta = calculateThreatDelta(previousTierHours, tierElapsedHours);

    // 既存の threatLevel に delta を加算（最大 100%）。
    // お布施で既存の値を下げても、delta だけしか加算されないので軽減が持続する。
    const newThreat = Math.min(THREAT_MAX, d.threatLevel + delta);
    const capped = Math.max(0, newThreat);

    if (capped > maxThreat) maxThreat = capped;

    // 100% 到達でゲームオーバー
    if (capped >= THREAT_MAX && !gameOver) {
      gameOver = true;
      gameOverReason = "脅威度";
      logs.push({
        message: `【ゲームオーバー】${d.name} の脅威度が限界 (100%) に達しました。村は壊滅しました…`,
        type: "error",
      });
    }

    return { ...d, threatLevel: capped };
  });

  return {
    dungeons: nextDungeons,
    logs,
    maxThreatReached: maxThreat,
    gameOver,
    gameOverReason,
  };
}

/**
 * Tier開始日を簡易算出
 */
function getTierStartDay(tier: number, fallbackTierStartDay: number): number {
  // Tier 1 は常に 1日目。それ以外は state に保持された tierStartDay を使う。
  // （ボス撃破で Tier が進んだ瞬間のゲーム内日数）
  if (tier === 1) return 1;
  return fallbackTierStartDay;
}

// ==========================================
// お布施
// ==========================================

/**
 * お布施コストを計算する。
 * cost(X%) = BASE × (ESC^X − 1) / (ESC − 1)
 */
export function calculateOfferingCost(percentToReduce: number, currentTier: number): number {
  if (percentToReduce <= 0) return 0;
  const x = Math.min(percentToReduce, 100);
  const baseGold = OFFERING_BASE_GOLD_BY_TIER[currentTier] ?? 10;
  const cost =
    (baseGold * (Math.pow(OFFERING_ESCALATION_FACTOR, x) - 1)) / (OFFERING_ESCALATION_FACTOR - 1);
  return Math.ceil(cost);
}

/**
 * お布施が可能かチェックする。
 */
export function canOffer(
  dungeon: DungeonArea,
  percentToReduce: number,
  gold: number,
  currentTier: number,
): { ok: boolean; cost: number; reason?: string } {
  if (percentToReduce <= 0 || percentToReduce > 100) {
    return {
      ok: false,
      cost: 0,
      reason: "軽減率は 1〜100% の間で指定してください。",
    };
  }
  if (dungeon.threatLevel <= 0) {
    return { ok: false, cost: 0, reason: "脅威度は既に 0% です。" };
  }
  const cost = calculateOfferingCost(percentToReduce, currentTier);
  if (gold < cost) {
    return {
      ok: false,
      cost,
      reason: `ゴールドが不足しています。必要: ${cost} G / 所持: ${Math.floor(gold)} G`,
    };
  }
  return { ok: true, cost };
}

/**
 * お布施を実行する。
 */
export function executeOffering(
  dungeon: DungeonArea,
  percentToReduce: number,
): { dungeon: DungeonArea; actualReduction: number } {
  const actualReduction = Math.min(percentToReduce, dungeon.threatLevel);
  const newThreat = Math.max(0, dungeon.threatLevel - actualReduction);
  return {
    dungeon: {
      ...dungeon,
      threatLevel: newThreat,
    },
    actualReduction,
  };
}

/**
 * 全ダンジョンの脅威度をリセットする（ボス討伐時）。
 */
export function resetAllThreats(dungeons: DungeonArea[]): DungeonArea[] {
  return dungeons.map((d) => ({
    ...d,
    threatLevel: 0,
  }));
}
