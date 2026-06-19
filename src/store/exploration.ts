import { DungeonArea, Villager } from "../types/game";
import { ITEMS } from "../data/masterData";
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
      const hourlyGain = (v.dex * 0.2 + v.agi * 0.2) / d.difficulty / 24.0;
      totalProgressGained += hourlyGain;
    });

    const prevProgress = d.explorationProgress;
    const nextProgress = Math.min(100, prevProgress + totalProgressGained);

    if (nextProgress >= 100 && prevProgress < 100) {
      logs.push({
        message: `【探索完了】${d.name} の探索度が 100% に達しました！ボスに挑戦可能になりました。`,
        type: "system",
      });
    } else {
      const thresholds = [40, 50, 70];
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
