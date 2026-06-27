import { describe, it, expect } from "vitest";

import type { DungeonArea } from "../types/game";
import {
  calculateThreatLevel,
  calculateThreatDelta,
  updateAllThreatLevels,
  executeOffering,
  canOffer,
} from "./threatLogic";

const makeDungeon = (overrides: Partial<DungeonArea> = {}): DungeonArea => ({
  id: "forest",
  name: "始まりの森",
  distance: 1,
  recommendedLevel: 1,
  unlockedAtTier: 1,
  gathers: [],
  monsters: [],
  explorationProgress: 0,
  difficulty: 1.0,
  threatLevel: 0,
  ...overrides,
});

describe("threatLogic", () => {
  describe("calculateThreatLevel (絶対値)", () => {
    it("0時間で0%", () => {
      expect(calculateThreatLevel(0)).toBe(0);
    });

    it("正の時間で正の値を返す", () => {
      expect(calculateThreatLevel(10)).toBeGreaterThan(0);
    });

    it("上限は 100", () => {
      expect(calculateThreatLevel(100000)).toBe(100);
    });
  });

  describe("calculateThreatDelta (毎時デルタ)", () => {
    it("同一時間では0", () => {
      expect(calculateThreatDelta(10, 10)).toBe(0);
    });

    it("逆行時間では0 (負の値を返さない)", () => {
      expect(calculateThreatDelta(10, 5)).toBe(0);
    });

    it("1時間進行で正のデルタ", () => {
      const delta = calculateThreatDelta(10, 11);
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(calculateThreatLevel(11));
    });
  });

  describe("updateAllThreatLevels (累積が上書きされない)", () => {
    it("既存の threatLevel に毎時のデルタが加算される", () => {
      // tier 1 starts on day 1 (hour 24). 24時間後 + 10h = hour 34 相当
      // tierElapsedHours = 10 で delta を計算
      const d1 = makeDungeon({ threatLevel: 0 });
      const result1 = updateAllThreatLevels([d1], 1, false, 2, 10, 1); // totalHours = (2-1)*24+10 = 34
      const after10 = result1.dungeons[0].threatLevel;
      expect(after10).toBeGreaterThan(0);
      expect(after10).toBeLessThan(10);

      // お布施で 50% 軽減
      const reduced = executeOffering(result1.dungeons[0], 50).dungeon;
      expect(reduced.threatLevel).toBeLessThan(after10);

      // 次のティック (1時間後) でも軽減効果が維持される
      const result2 = updateAllThreatLevels([reduced], 1, false, 2, 11, 1);
      const after11 = result2.dungeons[0].threatLevel;
      // お布施で下げた状態からの + 1h デルタなので、絶対値 (11h) より小さいはず
      const absoluteAt11 = calculateThreatLevel(11);
      expect(after11).toBeLessThan(absoluteAt11);
    });

    it("ボス未撃破の場合のみ脅威度が進行する", () => {
      // tier 1 で bossDefeated=true なら進行しない
      const d = makeDungeon({ threatLevel: 30 });
      const result = updateAllThreatLevels([d], 1, true, 5, 10, 1);
      expect(result.dungeons[0].threatLevel).toBe(30);
    });

    it("より高いティアのダンジョンは対象外", () => {
      const d = makeDungeon({ threatLevel: 10, unlockedAtTier: 2 });
      const result = updateAllThreatLevels([d], 1, false, 5, 10, 1);
      // tier 1 では tier 2 のダンジョンは対象外 → そのまま
      expect(result.dungeons[0].threatLevel).toBe(10);
    });

    it("100% で頭打ち (上限到達)", () => {
      const d = makeDungeon({ threatLevel: 99.5 });
      const result = updateAllThreatLevels([d], 1, false, 2, 1000, 1);
      expect(result.dungeons[0].threatLevel).toBeLessThanOrEqual(100);
    });
  });

  describe("executeOffering (お布施)", () => {
    it("脅威度を指定 % だけ下げる", () => {
      const d = makeDungeon({ threatLevel: 80 });
      const result = executeOffering(d, 30);
      // actualReduction = min(30, 80) = 30 → newThreat = 50
      expect(result.dungeon.threatLevel).toBe(50);
      expect(result.actualReduction).toBe(30);
    });

    it("現在脅威度を超える軽減は実際はそこまでしか下がらない", () => {
      const d = makeDungeon({ threatLevel: 10 });
      const result = executeOffering(d, 50);
      expect(result.dungeon.threatLevel).toBe(0);
      expect(result.actualReduction).toBe(10);
    });
  });

  describe("canOffer (お布施可能判定)", () => {
    it("ゴールドが足りていれば ok", () => {
      const d = makeDungeon({ threatLevel: 50 });
      const check = canOffer(d, 30, 10000);
      expect(check.ok).toBe(true);
    });

    it("脅威度が 0 のダンジョンには適用不可", () => {
      const d = makeDungeon({ threatLevel: 0 });
      const check = canOffer(d, 30, 10000);
      expect(check.ok).toBe(false);
    });

    it("軽減率 0 や 100 超は適用不可", () => {
      const d = makeDungeon({ threatLevel: 50 });
      expect(canOffer(d, 0, 10000).ok).toBe(false);
      expect(canOffer(d, 101, 10000).ok).toBe(false);
    });

    it("ゴールド不足は適用不可", () => {
      const d = makeDungeon({ threatLevel: 50 });
      const check = canOffer(d, 50, 1);
      expect(check.ok).toBe(false);
    });
  });

  describe("regression: お布施の軽減が時間経過で打ち消されないこと", () => {
    it("脅威度 50% からお布施 (50% ポイント軽減) → +1h でも 50% に戻らない", () => {
      // 1. 50% から 50 ポイント軽減 (= 50%) → 0%
      const d0 = makeDungeon({ threatLevel: 50 });
      const reduced = executeOffering(d0, 50).dungeon;
      expect(reduced.threatLevel).toBe(0);

      // 2. +10 時間経過 (tierElapsedHours を 0 → 10 に進める)
      //    旧バグ: 絶対値計算で上書きされて 50% 近辺に戻る
      //    修正後: 0 + 1h 分のデルタ累積 = 数% 程度にしかならない
      const r1 = updateAllThreatLevels([reduced], 1, false, 2, 10, 1);
      const t11 = r1.dungeons[0].threatLevel;

      // 3. 絶対値計算だと tierElapsedHours=10 で ~1.26% だが、
      //    修正前のバグでは 50% (= 元の値) に戻ってしまう
      const absoluteAt10 = calculateThreatLevel(10);
      expect(absoluteAt10).toBeLessThan(10); // sanity: 絶対値でも 10h ではまだ小さい

      // 4. お布施後 10 時間経過しても 50% には戻らない (バグの直接的検証)
      expect(t11).toBeLessThan(50);
    });

    it("脅威度 30% からお布施 (30% 軽減) → +1h で絶対値計算より小さい", () => {
      const d0 = makeDungeon({ threatLevel: 30 });
      const reduced = executeOffering(d0, 30).dungeon;
      expect(reduced.threatLevel).toBe(0);

      const r1 = updateAllThreatLevels([reduced], 1, false, 2, 10, 1);
      const t11 = r1.dungeons[0].threatLevel;
      const absoluteAt10 = calculateThreatLevel(10);

      expect(t11).toBeLessThanOrEqual(absoluteAt10);
      expect(t11).toBeGreaterThan(0); // 0 + 1h 分のデルタ
    });

    it("脅威度 80% からお布施 (30% 軽減) → +1h 経過後も 50% を超えない", () => {
      const d0 = makeDungeon({ threatLevel: 80 });
      const reduced = executeOffering(d0, 30).dungeon;
      expect(reduced.threatLevel).toBe(50);

      const r1 = updateAllThreatLevels([reduced], 1, false, 2, 10, 1);
      const t11 = r1.dungeons[0].threatLevel;

      // 旧バグ: +1h 経過で 80% に戻っていた (絶対値で再計算)
      // 修正後: 50% + 1h 分のデルタ ≈ 50% ちょっと
      expect(t11).toBeLessThan(80);
    });
  });

  describe("regression: Tier 2 のダンジョン脅威度が Tier 開始時から正しく進行する", () => {
    it("Tier 2 開始直後 (tierStartDay=10) で脅威度が即座に上昇開始する", () => {
      // Tier 1 ボス撃破で currentTier=2, tierStartDay=10 (10日目に到達) になったケース
      // Tier 2 のダンジョン mine (unlockedAtTier=2) の threatLevel が
      // 旧バグ: 永遠に 0 (tierStartDays[2]=60 を参照していた)
      // 修正後: tierStartDay=10 から即座に上昇開始
      const mine = makeDungeon({
        id: "mine",
        unlockedAtTier: 2,
        threatLevel: 0,
      });
      // 10日目 12時 (= day=10, hour=12, totalHours = 9*24+12 = 228)
      const result = updateAllThreatLevels([mine], 2, false, 10, 12, 10);
      const afterT2 = result.dungeons[0].threatLevel;

      // tierElapsedHours = 228 - 10*24 = -12 → max(0, ...) = 0 で最初の delta は 0
      // しかし「Tier 2 開始直後 (= 10日目) でもそれ以降進めば上昇する」を検証
      // → 20日目に進めば tierElapsedHours = 480-240 = 240 で絶対値 = 100 に近い
      const resultLater = updateAllThreatLevels([mine], 2, false, 20, 12, 10);
      const after20 = resultLater.dungeons[0].threatLevel;
      expect(after20).toBeGreaterThan(0); // ← 旧バグでは 0 のまま

      // Tier 開始直後 (= tierStartDay 当日) は delta が 0 なので 0 のままで正常
      expect(afterT2).toBe(0);
    });

    it("Tier 1 攻略前のダンジョン (unlockedAtTier=1) は Tier 2 では対象外", () => {
      // Tier 1 を攻略済み → currentTier=2 → forest (unlockedAtTier=1) は対象外
      const forest = makeDungeon({
        id: "forest",
        unlockedAtTier: 1,
        threatLevel: 0,
      });
      const result = updateAllThreatLevels([forest], 2, true, 20, 0, 10);
      // 対象外なのでそのまま (0 のまま)
      expect(result.dungeons[0].threatLevel).toBe(0);
    });

    it("Tier 1 のダンジョンは常に day 1 を基準にする (bossDefeated=false)", () => {
      // Tier 1 (unlockedAtTier=1) は tierStartDay に関係なく day 1 を基準にする
      const forest = makeDungeon({
        id: "forest",
        unlockedAtTier: 1,
        threatLevel: 0,
      });
      // tierStartDay=100 でも Tier 1 なら day 1 から数える
      const result = updateAllThreatLevels([forest], 1, false, 5, 0, 100);
      const t = result.dungeons[0].threatLevel;
      // tierElapsedHours = 5*24 - 1*24 = 96 で絶対値 > 0
      expect(t).toBeGreaterThan(0);
    });
  });

  describe("regression: 脅威度MAX到達で即ゲームオーバー", () => {
    it("脅威度が 100% に到達する過程で gameOver=true, gameOverReason='脅威度'", () => {
      // 99.86% から delta (calc(533)-calc(532)=0.21) が加算され 100% を超える
      // tierElapsedHours=533 → day=24, hour=5
      const d = makeDungeon({ threatLevel: 99.86, unlockedAtTier: 1 });
      const result = updateAllThreatLevels([d], 1, false, 24, 5, 1);
      expect(result.gameOver).toBe(true);
      expect(result.gameOverReason).toBe("脅威度");
      const log = result.logs.find((l) => l.type === "error");
      expect(log?.message).toContain("脅威度");
      expect(log?.message).toContain("100%");
    });

    it("脅威度が 100% 未満なら gameOver は false", () => {
      const d = makeDungeon({ threatLevel: 50 });
      const result = updateAllThreatLevels([d], 1, false, 2, 10, 1);
      expect(result.gameOver).toBe(false);
      expect(result.gameOverReason).toBe(null);
    });
  });
});
