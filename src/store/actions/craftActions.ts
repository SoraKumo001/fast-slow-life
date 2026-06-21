import { BUILDING_COST_REDUCTION } from "../../constants";
import { ITEMS, getRecipeForItem } from "../../data/masterData";
import { GameState, GameActions, FacilityType, Villager } from "../../types/game";
import { calculateCraftTime, generateId } from "../../utils/craftHelpers";

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

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

  startFacilityUpgrade: (facilityId: FacilityType) => {
    const state = get();
    const facility = state.facilities[facilityId];
    if (!facility || facility.level >= facility.maxLevel) return;

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

    set((state) => {
      const inv = { ...state.inventory };
      facility.upgradeCost.materials.forEach((req) => {
        const reqCount = Math.floor(req.count * costReduction);
        inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - reqCount);
      });

      const updatedFacilities = { ...state.facilities };
      const time = 5 + facility.level * 5;
      updatedFacilities[facilityId] = {
        ...facility,
        upgradeTimeLeft: time,
        upgradeTotalTime: time,
      };

      return {
        gold: state.gold - goldCost,
        inventory: inv,
        facilities: updatedFacilities,
      };
    });

    state.addLog(
      `${facility.name} のアップグレードを開始しました。レベル ${facility.level + 1} まであと ${5 + facility.level * 5} 時間。`,
      "upgrade",
    );
  },
});
