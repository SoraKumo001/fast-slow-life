/**
 * ゲームオーバー判定ヘルパー
 */

export function isBankrupt(consecutiveNegativeGoldDays: number): boolean {
  return consecutiveNegativeGoldDays >= 3;
}

/**
 * 旧: 日数制限によるゲームオーバー判定。脅威度システムへの移行により常に false。
 * 後方互換性のためにシグネチャは維持する。
 */
export function isTimeOver(
  _currentDay: number,
  _gameLimitDays: number,
  _bossDefeated: boolean,
): boolean {
  return false;
}

/**
 * ゲームオーバーログを構築する。
 * reason: "破産" | "期限切れ" | "クリア" | "脅威度"
 */
export function buildGameOverLog(
  reason: "破産" | "期限切れ" | "クリア" | "脅威度",
  gameLimitDays?: number,
): { message: string; type: "error" | "system" } {
  switch (reason) {
    case "破産":
      return {
        message: "【ゲームオーバー】所持金マイナス状態が3日間続いたため、破産しました！",
        type: "error",
      };
    case "期限切れ":
      return {
        message: `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。ゲームオーバー！`,
        type: "error",
      };
    case "脅威度":
      return {
        message: `【ゲームオーバー】ダンジョンの脅威度が 100% に達しました。村は壊滅しました…`,
        type: "error",
      };
    case "クリア":
      return { message: "ボスを討伐し、Tierをクリアしました！", type: "system" };
  }
}
