import { describe, it, expect } from "vitest";

import { isBankrupt, isTimeOver, buildGameOverLog } from "./gameOverHelper";

describe("gameOverHelper", () => {
  describe("isBankrupt", () => {
    it("連続マイナス日数が2の場合は破産ではないこと", () => {
      expect(isBankrupt(2)).toBe(false);
    });

    it("連続マイナス日数が3の場合は破産であること", () => {
      expect(isBankrupt(3)).toBe(true);
    });

    it("連続マイナス日数が5の場合は破産であること", () => {
      expect(isBankrupt(5)).toBe(true);
    });

    it("連続マイナス日数が0の場合は破産ではないこと", () => {
      expect(isBankrupt(0)).toBe(false);
    });
  });

  describe("isTimeOver", () => {
    it("制限日数と同じ日数の場合は期限切れではないこと", () => {
      expect(isTimeOver(30, 30, false)).toBe(false);
    });

    it("制限日数を超え、ボス未討伐の場合は期限切れであること", () => {
      expect(isTimeOver(31, 30, false)).toBe(true);
    });

    it("制限日数を超えていても、ボス討伐済みの場合は期限切れではないこと", () => {
      expect(isTimeOver(31, 30, true)).toBe(false);
    });
  });

  describe("buildGameOverLog", () => {
    it("破産ログのメッセージとタイプが正しいこと", () => {
      const log = buildGameOverLog("破産");
      expect(log.message).toContain("破産");
      expect(log.type).toBe("error");
    });

    it("期限切れログに制限日数が含まれること", () => {
      const log = buildGameOverLog("期限切れ", 30);
      expect(log.message).toContain("30");
      expect(log.message).toContain("ゲームオーバー");
      expect(log.type).toBe("error");
    });

    it("クリアログのメッセージとタイプが正しいこと", () => {
      const log = buildGameOverLog("クリア");
      expect(log.message).toContain("Tier");
      expect(log.type).toBe("system");
    });

    it("全滅ログのメッセージとタイプが正しいこと", () => {
      const log = buildGameOverLog("全滅");
      expect(log.message).toContain("村人");
      expect(log.type).toBe("error");
    });
  });
});
