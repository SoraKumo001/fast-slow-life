import { BUILDING_COST_REDUCTION } from "../../constants";
import { ITEMS, getRecipeForItem, getTrainingProgram } from "../../data/masterData";
import { FacilityType, Villager, StoreSet, StoreGet } from "../../types/game";
import { calculateCraftTime, generateId } from "../../utils/craftHelpers";
import { calculateUpgradeTime, selectBestUpgradeVillager } from "../../utils/upgradeHelpers";

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
      updatedFacilities[facilityId].craftQueue.push({
        id: jobId,
        itemId,
        timeLeft: timeNeeded,
        totalTime: timeNeeded,
        assignedVillagerId: assignedId,
      });

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
    const facility = state.facilities[facilityId];
    if (!facility || facility.level >= facility.maxLevel) return;

    // すでにアップグレード中または予約済み
    if (facility.upgradeTimeLeft > 0 || facility.upgradeAssignedVillagerId) {
      state.addLog(`${facility.name} はすでにアップグレードが進行中です。`, "warning");
      return;
    }

    const buildLvl = state.soulUpgrades.building || 0;
    const costReduction = 1 - buildLvl * BUILDING_COST_REDUCTION;

    const goldCost = Math.floor(facility.upgradeCost.gold * costReduction);
    if (state.gold < goldCost) {
      state.addLog("ゴールドが不足しています。", "warning");
      return;
    }

    const missing = facility.upgradeCost.materials.filter((req) => {
      const reqCount = Math.floor(req.count * costReduction);
      return (state.inventory[req.itemId] || 0) < reqCount;
    });

    if (missing.length > 0) {
      state.addLog("アップグレードの必要素材が不足しています。", "warning");
      return;
    }

    // 担当村人の選択
    let selectedVillager: Villager | null = null;
    if (villagerId) {
      selectedVillager = state.villagers.find((v) => v.id === villagerId) || null;
    }
    if (!selectedVillager) {
      selectedVillager = selectBestUpgradeVillager(state.villagers);
    }

    if (!selectedVillager) {
      state.addLog("アップグレードを担当できる村人がいません。", "warning");
      return;
    }

    const baseTime = 5 + facility.level * 5;
    const actualTime = calculateUpgradeTime(baseTime, selectedVillager);
    const jobName = selectedVillager.currentJob;

    // ダンジョン活動中の村人は帰還を待つ（予約状態）
    if (selectedVillager.status === "active" || selectedVillager.status === "traveling_to") {
      const area = state.dungeons.find((d) => d.id === selectedVillager.destinationAreaId);
      set((state) => {
        const updatedVillagers = state.villagers.map((v) => {
          if (v.id !== selectedVillager!.id) return v;
          return {
            ...v,
            status: "traveling_back",
            travelTimeLeft: area ? area.distance : 1,
            order: "rest",
            destinationAreaId: null,
            potionCount: 0,
            staminaDrinkCount: 0,
          } as Villager;
        });
        const updatedFacilities = { ...state.facilities };
        updatedFacilities[facilityId] = {
          ...facility,
          upgradeTimeLeft: actualTime,
          upgradeTotalTime: actualTime,
          upgradeAssignedVillagerId: selectedVillager!.id,
        };
        return {
          villagers: updatedVillagers,
          facilities: updatedFacilities,
        };
      });
      state.addLog(
        `${facility.name} のアップグレード予約: ${selectedVillager.name}(${jobName}) を担当に割り当てました（ダンジョンから帰還後に開始、所要 ${actualTime} 時間）。`,
        "upgrade",
      );
      return;
    }

    // 村にいる村人の場合、ゴールドを支給して即座に開始
    set((state) => {
      const inv = { ...state.inventory };
      facility.upgradeCost.materials.forEach((req) => {
        const reqCount = Math.floor(req.count * costReduction);
        inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - reqCount);
      });

      const updatedVillagers = state.villagers.map((v) => {
        if (v.id !== selectedVillager!.id) return v;
        return {
          ...v,
          gold: v.gold + goldCost,
          status: "active",
          assignedCraftJobId: `upgrade_${facilityId}`,
        } as Villager;
      });

      const updatedFacilities = { ...state.facilities };
      updatedFacilities[facilityId] = {
        ...facility,
        upgradeTimeLeft: actualTime,
        upgradeTotalTime: actualTime,
        upgradeAssignedVillagerId: selectedVillager!.id,
      };

      return {
        gold: state.gold - goldCost,
        inventory: inv,
        villagers: updatedVillagers,
        facilities: updatedFacilities,
      };
    });

    state.addLog(
      `${facility.name} のアップグレードを開始しました。担当: ${selectedVillager.name}(${jobName})（レベル ${facility.level + 1} まであと ${actualTime} 時間、支給 ${goldCost} G）。`,
      "upgrade",
    );
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
      updatedFacilities.training_ground.trainingQueue.push({
        id: jobId,
        programId,
        timeLeft: program.requiredTime,
        totalTime: program.requiredTime,
        assignedVillagerId: villagerId,
        goldPerHour,
      });

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
