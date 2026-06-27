import type { StoreSet, StoreGet } from "../../types/game";
import { canOffer, executeOffering } from "../threatLogic";

export const createOfferingActions = (set: StoreSet, get: StoreGet) => ({
  /**
   * 指定したダンジョンの脅威度をお布施で軽減する。
   * @param dungeonId - 対象ダンジョンID
   * @param percentToReduce - 軽減率 (1-100)
   */
  offerToDungeon: (dungeonId: string, percentToReduce: number): string | null => {
    const state = get();
    const dungeon = state.dungeons.find((d) => d.id === dungeonId);
    if (!dungeon) return "ダンジョンが見つかりません。";

    const check = canOffer(dungeon, percentToReduce, state.gold, state.currentTier);
    if (!check.ok) return check.reason ?? "お布施できません。";

    const { dungeon: updatedDungeon, actualReduction } = executeOffering(dungeon, percentToReduce);
    const newGold = state.gold - check.cost;

    set({
      dungeons: state.dungeons.map((d) => (d.id === dungeonId ? updatedDungeon : d)),
      gold: newGold,
    });

    get().addLog(
      `【お布施】${dungeon.name} に ${check.cost} G を奉納し、脅威度を ${actualReduction}% 低下させました。（${Math.floor(dungeon.threatLevel)}% → ${Math.floor(updatedDungeon.threatLevel)}%）`,
      "info",
    );

    return null; // 成功
  },
});
