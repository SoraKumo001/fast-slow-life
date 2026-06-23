import { LogPayload } from "./gameLoopTypes";

export function isBankrupt(consecutiveNegativeGoldDays: number): boolean {
  return consecutiveNegativeGoldDays >= 3;
}

export function isTimeOver(
  currentDay: number,
  gameLimitDays: number,
  bossDefeated: boolean,
): boolean {
  return currentDay > gameLimitDays && !bossDefeated;
}

export function buildGameOverLog(
  reason: "破産" | "期限切れ" | "クリア" | "全滅",
  gameLimitDays?: number,
): LogPayload {
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
    case "クリア":
      return { message: "ボスを討伐し、Tierをクリアしました！", type: "system" };
    case "全滅":
      return { message: "すべての村人が戦闘不能になりました。ゲームオーバー！", type: "error" };
  }
}
