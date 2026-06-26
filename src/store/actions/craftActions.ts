import { CRAFT_QUEUE_MAX_LENGTH, TRAINING_COOLDOWN_DAYS } from "../../constants";
import { ITEMS, getRecipeForItem, getTrainingProgram } from "../../data/masterData";
import { FacilityType, Villager, StoreSet, StoreGet } from "../../types/game";
import { calculateCraftTime, generateId } from "../../utils/craftHelpers";
import { startFacilityUpgradeHelper } from "../upgradeLogic";

export const createCraftActions = (set: StoreSet, get: StoreGet) => ({
  startCraft: (facilityId: FacilityType, itemId: string, villagerId?: string) => {
    const state = get();
    const facility = state.facilities[facilityId];
    const item = ITEMS[itemId];
    const recipe = getRecipeForItem(itemId);
    if (
      !facility ||
      !item ||
      !recipe ||
      recipe.facilityId !== facilityId ||
      facility.level < recipe.requiredFacilityLevel
    )
      return;

    if (facility.craftQueue.length >= CRAFT_QUEUE_MAX_LENGTH) {
      state.addLog("クラフトキューの上限に達しています。", "warning");
      return;
    }

    const missing = recipe.requiredItems.filter(
      (req) => (state.inventory[req.itemId] || 0) < req.count,
    );
    if (missing.length > 0) {
      state.addLog("クラフトの必要素材が不足しています。", "warning");
      return;
    }

    let assignedId: string | null = null;
    if (villagerId) {
      const v = state.villagers.find((v) => v.id === villagerId);
      if (v && v.status === "idle") {
        assignedId = villagerId;
      }
    } else {
      const idleCrafter = state.villagers.find(
        (v) => v.status === "idle" && v.currentJob === "職人",
      );
      const idleAny = state.villagers.find((v) => v.status === "idle");
      assignedId = (idleCrafter || idleAny)?.id || null;
    }

    const jobId = generateId();
    const baseTime = recipe.requiredTime;
    const assignedVillager = assignedId ? state.villagers.find((v) => v.id === assignedId) : null;
    const timeNeeded = calculateCraftTime(baseTime, assignedVillager);

    set((state) => {
      const inv = { ...state.inventory };
      recipe.requiredItems.forEach((req) => {
        inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - req.count);
      });

      const updatedFacilities = { ...state.facilities };
      updatedFacilities[facilityId] = {
        ...updatedFacilities[facilityId],
        craftQueue: [
          ...updatedFacilities[facilityId].craftQueue,
          {
            id: jobId,
            itemId,
            timeLeft: timeNeeded,
            totalTime: timeNeeded,
            assignedVillagerId: assignedId,
          },
        ],
      };

      const updatedVillagers = state.villagers.map((v) => {
        if (v.id === assignedId) {
          return {
            ...v,
            status: "active",
            assignedCraftJobId: jobId,
          } as Villager;
        }
        return v;
      });

      return {
        inventory: inv,
        facilities: updatedFacilities,
        villagers: updatedVillagers,
      };
    });

    const vName = assignedId ? get().villagers.find((v) => v.id === assignedId)?.name : "なし";
    state.addLog(
      `${facility.name} で ${item.name} のクラフトを開始しました（担当: ${vName}）。`,
      "craft",
    );
  },

  startFacilityUpgrade: (facilityId: FacilityType, villagerId?: string) => {
    const state = get();
    const result = startFacilityUpgradeHelper(state, facilityId, villagerId);
    if (!result) return;
    state.addLog(result.logMessage, result.logType);
    if (result.logType === "warning") return;
    set({
      gold: result.gold,
      inventory: result.inventory,
      villagers: result.villagers,
      facilities: result.facilities,
    });
  },

  startTraining: (programId: string, villagerId: string) => {
    const state = get();
    const facility = state.facilities.training_ground;
    const program = getTrainingProgram(programId);

    if (!facility || facility.level < 1) {
      state.addLog("訓練場が利用できません。", "warning");
      return;
    }
    if (!program) {
      state.addLog("訓練プログラムが見つかりません。", "warning");
      return;
    }
    if (facility.level < program.requiredFacilityLevel) {
      state.addLog("訓練場のレベルが不足しています。", "warning");
      return;
    }

    const villager = state.villagers.find((v) => v.id === villagerId);
    if (!villager || villager.status !== "idle") {
      state.addLog("訓練には待機中の村人を割り当ててください。", "warning");
      return;
    }

    // クールダウンチェック: 前回訓練から TRAINING_COOLDOWN_DAYS 日以内なら開始不可
    // lastTrainingDay === 0 は「未訓練」として扱う (初期値センティネル)
    if (villager.lastTrainingDay) {
      const daysSinceLastTraining = state.currentDay - villager.lastTrainingDay;
      if (daysSinceLastTraining < TRAINING_COOLDOWN_DAYS) {
        const daysRemaining = TRAINING_COOLDOWN_DAYS - daysSinceLastTraining;
        state.addLog(
          `${villager.name} は前回の訓練から ${daysRemaining} 日経過していないため、訓練を開始できません（最低 ${TRAINING_COOLDOWN_DAYS} 日間隔が必要）。`,
          "warning",
        );
        return;
      }
    }

    if (villager.gold < program.goldCost) {
      state.addLog(
        `${villager.name} の所持金が不足しています（必要: ${program.goldCost} G、現在: ${villager.gold} G）。`,
        "warning",
      );
      return;
    }

    const jobId = generateId();
    const goldPerHour = Math.ceil(program.goldCost / program.requiredTime);

    set((state) => {
      const updatedFacilities = { ...state.facilities };
      updatedFacilities.training_ground = {
        ...updatedFacilities.training_ground,
        trainingQueue: [
          ...updatedFacilities.training_ground.trainingQueue,
          {
            id: jobId,
            programId,
            timeLeft: program.requiredTime,
            totalTime: program.requiredTime,
            assignedVillagerId: villagerId,
            goldPerHour,
          },
        ],
      };

      const updatedVillagers = state.villagers.map((v) => {
        if (v.id === villagerId) {
          return {
            ...v,
            status: "active",
            assignedCraftJobId: jobId,
          } as Villager;
        }
        return v;
      });

      return {
        facilities: updatedFacilities,
        villagers: updatedVillagers,
      };
    });

    state.addLog(
      `${villager.name} が訓練「${program.name}」を開始しました（所要: ${program.requiredTime}時間、総額: ${program.goldCost} G）。`,
      "craft",
    );
  },
});
