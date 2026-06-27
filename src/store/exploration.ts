import {
  EXPLORATION_UNLOCK_1,
  EXPLORATION_UNLOCK_2,
  EXPLORATION_UNLOCK_3,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { DungeonArea, Villager } from "../types/game";
import { applySalaryDebuff, getFoodBuffBonus } from "./combatEngine";
import { LogPayload } from "./gameLoopTypes";

export function processExploration(
  dungeons: DungeonArea[],
  villagers: Villager[],
  currentTier: number,
) {
  const logs: LogPayload[] = [];
  const nextDungeons = dungeons.map((d) => {
    if (d.unlockedAtTier > currentTier || d.explorationProgress >= 100) return d;

    const activeVillagers = villagers.filter(
      (v) => v.status === "active" && v.destinationAreaId === d.id && v.order !== "rest",
    );

    if (activeVillagers.length === 0) return d;

    let totalProgressGained = 0;
    activeVillagers.forEach((v) => {
      // B3 修正: gatherLogic と同じく、料理バフ・負債デバフ・飢餓/スタミナペナルティを反映する。
      // v.gold ?? 0 で undefined 安全に。
      const buffDex = getFoodBuffBonus(v.activeFoodBuffId || null, "dex");
      const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
      const effectiveDex = applySalaryDebuff(v.dex + buffDex, (v.gold ?? 0) < 0);
      const effectiveAgi = applySalaryDebuff(v.agi + buffAgi, (v.gold ?? 0) < 0);
      const efficiency =
        (v.isStarving ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
        (v.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);
      const baseProgress = (effectiveDex * 0.2 + effectiveAgi * 0.2) / d.difficulty / 24.0;
      totalProgressGained += baseProgress * efficiency;
    });

    const prevProgress = d.explorationProgress;
    const nextProgress = Math.min(100, prevProgress + totalProgressGained);

    if (nextProgress >= 100 && prevProgress < 100) {
      logs.push({
        message: `【探索完了】${d.name} の探索度が 100% に達しました！ボスに挑戦可能になりました。`,
        type: "system",
      });
    } else {
      const thresholds = [EXPLORATION_UNLOCK_1, EXPLORATION_UNLOCK_2, EXPLORATION_UNLOCK_3];
      thresholds.forEach((th) => {
        if (prevProgress < th && nextProgress >= th) {
          const unlockedItems = d.gathers
            .filter((g) => g.unlockedAtProgress === th)
            .map((g) => ITEMS[g.itemId]?.name);
          const unlockedMons = d.monsters
            .filter((m) => m.unlockedAtProgress === th)
            .map((m) => m.name);
          const itemsStr = unlockedItems.length > 0 ? ` [素材: ${unlockedItems.join(", ")}]` : "";
          const monsStr = unlockedMons.length > 0 ? ` [魔物: ${unlockedMons.join(", ")}]` : "";
          logs.push({
            message: `【探索進行】${d.name} の探索度が ${th}% に達しました！新たな要素が解放されました：${itemsStr}${monsStr}`,
            type: "system",
          });
        }
      });
    }

    return {
      ...d,
      explorationProgress: nextProgress,
    };
  });

  return { dungeons: nextDungeons, logs };
}
