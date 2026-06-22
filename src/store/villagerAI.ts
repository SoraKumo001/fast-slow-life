import {
  STAMINA_COST_PER_HOUR,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  STARVATION_HP_LOSS_PERCENT,
  BASE_HP_RECOVERY,
  HP_RECOVERY_PER_INN_LEVEL,
  BASE_STAMINA_RECOVERY,
  STAMINA_RECOVERY_PER_INN_LEVEL,
  STAMINA_DRINK_THRESHOLD,
  BATTLE_POTION_HP_RATIO,
  RETREAT_HP_RATIO,
} from "../constants";
import { ITEMS } from "../data/masterData";
import { Villager, DungeonArea, Facility, FacilityType, ActiveBossState } from "../types/game";
import { LogPayload } from "./gameLoopTypes";
import { processVillagerGather } from "./gatherLogic";
import { processVillagerHunt } from "./huntLogic";

export function processVillagerActivities(
  villagers: Villager[],
  dungeons: DungeonArea[],
  facilities: Record<FacilityType, Facility>,
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
  activeBoss: ActiveBossState | null,
  _bossDefeated: boolean,
  _hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
  gold: number,
  isSalaryUnpaid: boolean = false,
) {
  let currentGold = gold;

  const logs: LogPayload[] = [];
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  const nextDungeons = dungeons.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({ ...g })),
    monsters: d.monsters.map((m) => ({ ...m })),
  }));
  let gameOver = false;
  let isPaused = false;

  for (let i = 0; i < nextVillagers.length; i++) {
    const v = { ...nextVillagers[i] };

    if (v.status === "resting") {
      const innLvl = facilities.inn.level;
      const hpRecovery = BASE_HP_RECOVERY + innLvl * HP_RECOVERY_PER_INN_LEVEL;
      const staminaRecovery = BASE_STAMINA_RECOVERY + innLvl * STAMINA_RECOVERY_PER_INN_LEVEL;

      const maxStamina = v.maxStamina || 100;
      v.currentHp = Math.min(v.maxHp, v.currentHp + hpRecovery);
      v.stamina = Math.min(maxStamina, v.stamina + staminaRecovery);

      // 宿代請求: 1時間あたり 1 + innLvl G を村人からプレイヤーへ
      const innCost = 1 + innLvl;
      v.gold -= innCost; // 不足時はツケ払い（マイナス）
      currentGold += innCost;
      if (innCost > 0) {
        logs.push({
          message: `${v.name} の宿代として ${innCost} G を引き落としました（現在の所持: ${v.gold} G）。`,
          type: "info",
        });
      } else {
        logs.push({
          message: `${v.name} は無職のため宿代が無料になりました（現在の所持: ${v.gold} G）。`,
          type: "info",
        });
      }

      if (v.currentHp === v.maxHp && v.stamina === maxStamina) {
        v.status = "idle";
        v.order = "gather";
        logs.push({
          message: `${v.name} は体力が全回復し、行動可能になりました。`,
          type: "info",
        });
      }
      nextVillagers[i] = v;
      continue;
    }

    if (v.isStarving) {
      v.currentHp = Math.max(1, v.currentHp - Math.floor(v.maxHp * STARVATION_HP_LOSS_PERCENT));
    }

    if (v.status === "traveling_to") {
      v.travelTimeLeft -= 1;
      if (v.travelTimeLeft <= 0) {
        v.status = "active";
        const areaName = nextDungeons.find((d) => d.id === v.destinationAreaId)?.name || "";
        logs.push({
          message: `${v.name} が ${areaName} に到着し、活動を開始しました。`,
          type: "info",
        });
      }
      nextVillagers[i] = v;
      continue;
    }

    if (v.status === "traveling_back") {
      v.travelTimeLeft -= 1;
      if (v.travelTimeLeft <= 0) {
        v.destinationAreaId = null;
        if (v.potionCount > 0) {
          const returnId = v.potionItemId || "potion";
          nextInventory[returnId] = (nextInventory[returnId] || 0) + v.potionCount;
          const pName = ITEMS[returnId]?.name || "回復薬";
          logs.push({
            message: `${v.name} が未使用の${pName} ${v.potionCount} 個を倉庫に返却しました。`,
            type: "info",
          });
          v.potionCount = 0;
        }
        if (v.staminaDrinkCount > 0) {
          const returnId = v.staminaDrinkItemId || "stamina_drink";
          nextInventory[returnId] = (nextInventory[returnId] || 0) + v.staminaDrinkCount;
          const sdName = ITEMS[returnId]?.name || "スタミナポーション";
          logs.push({
            message: `${v.name} が未使用の${sdName} ${v.staminaDrinkCount} 個を倉庫に返却しました。`,
            type: "info",
          });
          v.staminaDrinkCount = 0;
        }
        if (v.order === "rest") {
          v.status = "resting";
          logs.push({
            message: `${v.name} が村に帰還し、宿屋で休息を開始しました。`,
            type: "info",
          });
        } else {
          v.status = "idle";
          logs.push({
            message: `${v.name} が村に帰還しました。`,
            type: "info",
          });
        }
      }
      nextVillagers[i] = v;
      continue;
    }

    if (v.status === "active" && v.destinationAreaId) {
      const areaIdx = nextDungeons.findIndex((d) => d.id === v.destinationAreaId);
      if (areaIdx === -1) {
        nextVillagers[i] = v;
        continue;
      }
      const area = nextDungeons[areaIdx];

      if (activeBoss && activeBoss.attackerIds.includes(v.id)) {
        nextVillagers[i] = v;
        continue;
      }

      v.stamina = Math.max(0, v.stamina - STAMINA_COST_PER_HOUR);

      if (v.stamina <= STAMINA_DRINK_THRESHOLD && v.staminaDrinkCount > 0) {
        v.staminaDrinkCount -= 1;
        const sdId = v.staminaDrinkItemId || "stamina_drink";
        const staminaHealAmt = ITEMS[sdId]?.staminaHealAmount || 50;
        const maxStamina = v.maxStamina || 100;
        v.stamina = Math.min(maxStamina, v.stamina + staminaHealAmt);
        logs.push({
          message: `${v.name} が${ITEMS[sdId]?.name || "スタミナポーション"}を使用し、スタミナを ${staminaHealAmt} 回復しました。（残り ${v.staminaDrinkCount} 個）`,
          type: "info",
        });
      }

      const efficiency =
        (v.isStarving ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
        (v.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);

      if (v.currentHp <= v.maxHp * BATTLE_POTION_HP_RATIO && v.potionCount > 0) {
        v.potionCount -= 1;
        const pId = v.potionItemId || "potion";
        const healAmt = ITEMS[pId]?.healAmount || 50;
        v.currentHp = Math.min(v.maxHp, v.currentHp + healAmt);
        logs.push({
          message: `${v.name} が${ITEMS[pId]?.name || "回復薬"}を使用し、HPを ${healAmt} 回復しました。`,
          type: "info",
        });
      }

      if (v.currentHp < v.maxHp * RETREAT_HP_RATIO || v.stamina <= 0) {
        v.status = "traveling_back";
        v.travelTimeLeft = area.distance;
        v.order = "rest";
        v.autoTargetName = null;
        logs.push({
          message: `${v.name} は消耗が激しいため、村への帰還を開始しました（残り時間: ${area.distance}h）。`,
          type: "warning",
        });
        nextVillagers[i] = v;
        continue;
      }

      const isAutoGatherCompleted =
        v.order === "gather" &&
        !v.targetGatherItemId &&
        !area.gathers.some((g) => {
          const target = targetAmounts[g.itemId] || 0;
          return target > 0 && (nextInventory[g.itemId] || 0) < target;
        });

      const isAutoHuntCompleted =
        v.order === "hunt" &&
        !v.targetMonsterId &&
        !area.monsters.some((m) =>
          m.drops.some((dr) => {
            const target = targetAmounts[dr.itemId] || 0;
            return target > 0 && (nextInventory[dr.itemId] || 0) < target;
          }),
        );

      if (isAutoGatherCompleted || isAutoHuntCompleted) {
        v.status = "traveling_back";
        v.travelTimeLeft = area.distance;
        v.autoTargetName = null;
        logs.push({
          message: `${v.name} は ${area.name} での派遣目標を達成したため、帰還を開始しました（残り時間: ${area.distance}h）。`,
          type: "info",
        });
        nextVillagers[i] = v;
        continue;
      }

      if (v.order === "gather") {
        const gatherResult = processVillagerGather(
          v,
          i,
          area,
          nextVillagers,
          nextInventory,
          targetAmounts,
          efficiency,
          soulUpgrades,
          currentGold,
          isSalaryUnpaid,
        );
        currentGold = gatherResult.gold;
        logs.push(...gatherResult.logs);
      } else if (v.order === "hunt") {
        const huntResult = processVillagerHunt(
          v,
          i,
          area,
          nextVillagers,
          nextInventory,
          targetAmounts,
          efficiency,
          soulUpgrades,
          currentGold,
          isSalaryUnpaid,
        );
        currentGold = huntResult.gold;
        logs.push(...huntResult.logs);
        if (v.currentHp <= 0) {
          v.status = "traveling_back";
          v.travelTimeLeft = area.distance;
          v.order = "rest";
          v.autoTargetName = null;
        }
      }
    }
    nextVillagers[i] = v;
  }

  return {
    villagers: nextVillagers,
    inventory: nextInventory,
    dungeons: nextDungeons,
    gold: currentGold,
    logs,
    gameOver,
    isPaused,
  };
}
