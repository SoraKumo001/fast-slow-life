import { MAX_POTIONS_PER_VILLAGER } from "../constants";
import { ITEMS, DUNGEONS, MONSTERS } from "../data/masterData";
import { Villager, OrderType } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export interface OrderChangeResult {
  villagers: Villager[];
  inventory: Record<string, number>;
  logs: LogPayload[];
}

export function setVillagerOrderHelper(params: {
  villagerId: string;
  order: OrderType;
  areaId: string | null;
  targetGatherItemId?: string | null;
  targetMonsterId?: string | null;
  villagers: Villager[];
  inventory: Record<string, number>;
}): OrderChangeResult {
  const {
    villagerId,
    order,
    areaId,
    targetGatherItemId = null,
    targetMonsterId = null,
    villagers,
    inventory,
  } = params;

  const nextInventory = { ...inventory };
  const logs: LogPayload[] = [];

  const updatedVillagers = villagers.map((v) => {
    if (v.id !== villagerId) return v;

    let status = v.status;
    let travelTime = v.travelTimeLeft;
    let dest = v.destinationAreaId;
    let nextPotionCount = v.potionCount || 0;
    let nextPotionItemId = v.potionItemId || "potion";
    let nextStaminaDrinkCount = v.staminaDrinkCount || 0;
    let nextStaminaDrinkItemId = v.staminaDrinkItemId || "stamina_drink";

    const sameArea = v.destinationAreaId === areaId;
    const nextGatherTarget =
      targetGatherItemId !== undefined
        ? targetGatherItemId
        : sameArea
          ? v.targetGatherItemId
          : null;
    const nextMonsterTarget =
      targetMonsterId !== undefined ? targetMonsterId : sameArea ? v.targetMonsterId : null;

    if (order === "rest" || !areaId) {
      if (nextPotionCount > 0) {
        const returnId = nextPotionItemId;
        nextInventory[returnId] = (nextInventory[returnId] || 0) + nextPotionCount;
        const pName = ITEMS[returnId]?.name || "回復薬";
        logs.push({
          message: `【返却】${v.name} は${pName} ${nextPotionCount} 個を倉庫に戻しました。`,
          type: "info",
        });
        nextPotionCount = 0;
      }
      if (nextStaminaDrinkCount > 0) {
        const returnId = nextStaminaDrinkItemId;
        nextInventory[returnId] = (nextInventory[returnId] || 0) + nextStaminaDrinkCount;
        const sdName = ITEMS[returnId]?.name || "スタミナポーション";
        logs.push({
          message: `【返却】${v.name} は${sdName} ${nextStaminaDrinkCount} 個を倉庫に戻しました。`,
          type: "info",
        });
        nextStaminaDrinkCount = 0;
      }
    }

    if (order === "rest") {
      status = "resting";
      dest = null;
      travelTime = 0;
    } else if (areaId) {
      const area = DUNGEONS.find((d) => d.id === areaId);
      if (v.destinationAreaId !== areaId || v.status === "idle" || v.status === "resting") {
        status = "traveling_to";
        travelTime = area ? area.distance : 1;

        if (nextPotionCount > 0) {
          const returnId = nextPotionItemId;
          nextInventory[returnId] = (nextInventory[returnId] || 0) + nextPotionCount;
          nextPotionCount = 0;
        }

        if (nextStaminaDrinkCount > 0) {
          const returnId = nextStaminaDrinkItemId;
          nextInventory[returnId] = (nextInventory[returnId] || 0) + nextStaminaDrinkCount;
          nextStaminaDrinkCount = 0;
        }

        // 強いポーションから優先してアサイン
        let assignedCount = 0;
        let assignedId = "potion";
        const potionPriority = ["elixir", "high_potion", "mid_potion", "potion"];
        for (const pId of potionPriority) {
          const countInInv = nextInventory[pId] || 0;
          if (countInInv > 0) {
            assignedId = pId;
            assignedCount = Math.min(MAX_POTIONS_PER_VILLAGER, countInInv);
            nextInventory[pId] = countInInv - assignedCount;
            break;
          }
        }

        if (assignedCount > 0) {
          nextPotionCount = assignedCount;
          nextPotionItemId = assignedId;
          const pName = ITEMS[assignedId]?.name || "回復薬";
          logs.push({
            message: `【準備】${v.name} は${pName}を ${assignedCount} 個所持しました。`,
            type: "info",
          });
        }

        // スタミナポーションをアサイン
        let assignedStaminaCount = 0;
        const staminaDrinkId = "stamina_drink";
        const staminaDrinkInInv = nextInventory[staminaDrinkId] || 0;
        if (staminaDrinkInInv > 0) {
          assignedStaminaCount = Math.min(2, staminaDrinkInInv);
          nextInventory[staminaDrinkId] = staminaDrinkInInv - assignedStaminaCount;
        }

        if (assignedStaminaCount > 0) {
          nextStaminaDrinkCount = assignedStaminaCount;
          nextStaminaDrinkItemId = staminaDrinkId;
          const staminaName = ITEMS[staminaDrinkId]?.name || "スタミナポーション";
          logs.push({
            message: `【準備】${v.name} は${staminaName}を ${assignedStaminaCount} 個所持しました。`,
            type: "info",
          });
        }
      }
      dest = areaId;
    } else {
      dest = null;
      status = "idle";
      travelTime = 0;
    }

    return {
      ...v,
      order,
      status,
      destinationAreaId: dest,
      travelTimeLeft: travelTime,
      targetGatherItemId: nextGatherTarget,
      targetMonsterId: nextMonsterTarget,
      autoTargetName: null,
      potionItemId: nextPotionItemId,
      potionCount: nextPotionCount,
      staminaDrinkItemId: nextStaminaDrinkItemId,
      staminaDrinkCount: nextStaminaDrinkCount,
    };
  });

  // 指針変更全体のログ
  const targetVillager = villagers.find((v) => v.id === villagerId);
  if (targetVillager) {
    const areaName = DUNGEONS.find((d) => d.id === areaId)?.name || "村";
    const targetName = targetGatherItemId
      ? ITEMS[targetGatherItemId]?.name
      : targetMonsterId
        ? MONSTERS[targetMonsterId]?.name
        : null;
    const targetStr = targetName ? `、個別指示: ${targetName}` : "";
    logs.push({
      message: `${targetVillager.name} の方針を【${order === "rest" ? "休息" : order === "gather" ? "採取" : "討伐"}】（場所: ${areaName}${targetStr}）に変更しました。`,
      type: "info",
    });
  }

  return {
    villagers: updatedVillagers,
    inventory: nextInventory,
    logs,
  };
}
