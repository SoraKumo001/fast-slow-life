/**
 * Phase: Survival
 * Handles: respawns, starvation, daily food cost, food buff log.
 *
 * Note: Game-over checks (bankruptcy, time-over) and daily bankruptcy warnings
 * are handled in the pre-pipeline phase in index.ts.
 */
import { ITEMS } from "../../../data/masterData";
import type { Villager } from "../../../types/game";
import { processRespawns } from "../../respawns";
import { processStarvation } from "../../starvation";
import type { GamePhaseAccumulator } from "../types";

export const survivalPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
  // ---- Respawns ----
  acc.dungeons = processRespawns(acc.dungeons);

  // ---- Starvation ----
  const {
    inventory: starvedInventory,
    villagers: starvedVillagers,
    hasStarvation,
    logs: starvationLogs,
  } = processStarvation(acc.inventory, acc.villagers);
  acc.inventory = starvedInventory;
  acc.villagers = starvedVillagers as Villager[];
  acc.hasStarvation = hasStarvation;
  starvationLogs.forEach((msg) => {
    acc.logsToAppend.push({ message: msg, type: "warning" });
  });

  // ---- Daily food cost ----
  if (acc.isNewDay) {
    let totalFoodCost = 0;
    acc.villagers = acc.villagers.map((v) => {
      let foodCost = 0;
      if (v.isStarving) {
        foodCost = 0;
      } else if (v.activeFoodBuffId) {
        foodCost = ITEMS[v.activeFoodBuffId]?.basePrice || 2;
      } else {
        foodCost = 2;
      }

      const nextV = { ...v };
      nextV.gold -= foodCost;
      totalFoodCost += foodCost;
      return nextV;
    });

    acc.gold += totalFoodCost;
    acc.nextStats.totalGoldFromTax += totalFoodCost;
    acc.logsToAppend.push({
      message: `【経済】村人全員の食料代（計 ${totalFoodCost} G）が引き落とされ、プレイヤーに支払われました。`,
      type: "info",
    });

    // ---- Food buff log ----
    const fedVillagers = acc.villagers.filter((v) => v.activeFoodBuffId);
    if (fedVillagers.length > 0) {
      const foodNames = Array.from(
        new Set(fedVillagers.map((v) => ITEMS[v.activeFoodBuffId!]?.name || v.activeFoodBuffId)),
      ).join("、");
      acc.logsToAppend.push({
        message: `【配給】村人たちは食料（${foodNames}）を食べ、ステータスが強化されました！`,
        type: "info",
      });
    }
  }

  return acc;
};
