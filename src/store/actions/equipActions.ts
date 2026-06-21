import { ITEMS } from "../../data/masterData";
import { Item, Villager, StoreSet, StoreGet } from "../../types/game";
import { isMagicJob } from "../../utils/villagerHelpers";

const getWeaponScore = (item: Item, v: Villager): number => {
  if (!item.equipment || item.equipment.slot !== "weapon") return -1;
  const bonuses = item.equipment.bonuses || {};

  const isMagic = isMagicJob(v.currentJob);
  const hasIntVal = (bonuses.int || 0) > 0;

  if (isMagic) {
    const penalty = hasIntVal ? 0 : -1000;
    const intVal = bonuses.int || 0;
    const atkVal = bonuses.attack || 0;
    return intVal * 100 + atkVal + penalty;
  } else {
    const penalty = hasIntVal ? -1000 : 0;
    const atkVal = bonuses.attack || 0;
    const strVal = bonuses.str || 0;
    const agiVal = bonuses.agi || 0;
    const dexVal = bonuses.dex || 0;
    return atkVal * 100 + strVal * 10 + agiVal * 5 + dexVal + penalty;
  }
};

const getArmorScore = (item: Item, v: Villager): number => {
  if (!item.equipment || item.equipment.slot !== "armor") return -1;
  const bonuses = item.equipment.bonuses || {};

  const defVal = bonuses.defense || 0;
  const isMagic = isMagicJob(v.currentJob);
  const hasIntVal = (bonuses.int || 0) > 0;

  if (isMagic) {
    const penalty = hasIntVal ? 0 : -100;
    const intVal = bonuses.int || 0;
    const vitVal = bonuses.vit || 0;
    return defVal * 10 + intVal * 5 + vitVal * 2 + penalty;
  } else {
    const penalty = hasIntVal ? -500 : 0;
    const vitVal = bonuses.vit || 0;
    const strVal = bonuses.str || 0;
    const agiVal = bonuses.agi || 0;
    return defVal * 10 + vitVal * 5 + strVal * 2 + agiVal + penalty;
  }
};

export const createEquipActions = (set: StoreSet, get: StoreGet) => ({
  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item?.equipment || item.equipment.slot !== slot) return;

    const currentCount = state.inventory[itemId] || 0;
    if (currentCount <= 0) return;

    set((state) => {
      const inv = { ...state.inventory };
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;

        const oldEquipId = slot === "weapon" ? v.weaponId : v.armorId;
        if (oldEquipId && oldEquipId !== "none") {
          inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
        }

        inv[itemId] = Math.max(0, currentCount - 1);

        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: itemId,
        };
      });

      return { villagers: updated, inventory: inv };
    });

    const vName = get().villagers.find((v) => v.id === villagerId)?.name;
    state.addLog(`${vName} に ${ITEMS[itemId].name} を装備しました。`, "info");
  },

  unequipItem: (villagerId: string, slot: "weapon" | "armor") => {
    const state = get();
    const villager = state.villagers.find((v) => v.id === villagerId);
    if (!villager) return;

    const itemId = slot === "weapon" ? villager.weaponId : villager.armorId;
    if (!itemId || itemId === "none") return;

    set((state) => {
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;
        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: "none",
        };
      });
      const inv = { ...state.inventory };
      inv[itemId] = (inv[itemId] || 0) + 1;

      return { villagers: updated, inventory: inv };
    });

    state.addLog(`${villager.name} の装備を外しました。`, "info");
  },

  autoEquipAll: () => {
    const state = get();
    const villagers = [...state.villagers];
    const inventory = { ...state.inventory };

    const weaponPool: { [itemId: string]: number } = {};
    const armorPool: { [itemId: string]: number } = {};

    Object.entries(inventory).forEach(([itemId, count]) => {
      const item = ITEMS[itemId];
      if (!item || !item.equipment || count <= 0) return;
      if (item.equipment.slot === "weapon") {
        weaponPool[itemId] = (weaponPool[itemId] || 0) + count;
      } else if (item.equipment.slot === "armor") {
        armorPool[itemId] = (armorPool[itemId] || 0) + count;
      }
    });

    villagers.forEach((v) => {
      if (v.weaponId && v.weaponId !== "none") {
        weaponPool[v.weaponId] = (weaponPool[v.weaponId] || 0) + 1;
      }
      if (v.armorId && v.armorId !== "none") {
        armorPool[v.armorId] = (armorPool[v.armorId] || 0) + 1;
      }
    });

    const getJobPriority = (job: string) => {
      if (["戦士", "魔術師", "僧侶"].includes(job)) return 3;
      if (["猟師"].includes(job)) return 2;
      if (job !== "無職") return 1;
      return 0;
    };

    const getStatusPriority = (status: string, order: string) => {
      if (status === "active" && order !== "rest") return 2;
      if (status === "idle") return 1;
      return 0;
    };

    const sortedVillagerIndices = villagers
      .map((v, index) => ({ v, index }))
      .sort((a, b) => {
        const statusDiff =
          getStatusPriority(b.v.status, b.v.order) - getStatusPriority(a.v.status, a.v.order);
        if (statusDiff !== 0) return statusDiff;

        const jobDiff = getJobPriority(b.v.currentJob) - getJobPriority(a.v.currentJob);
        if (jobDiff !== 0) return jobDiff;

        return b.v.level - a.v.level;
      });

    const logs: string[] = [];

    sortedVillagerIndices.forEach(({ v, index }) => {
      let bestWeaponId = "none";
      let bestWeaponScore = -1;

      Object.entries(weaponPool).forEach(([itemId, count]) => {
        if (count <= 0) return;
        const item = ITEMS[itemId];
        const score = getWeaponScore(item, v);
        if (score > bestWeaponScore) {
          bestWeaponScore = score;
          bestWeaponId = itemId;
        }
      });

      if (bestWeaponId !== "none") {
        weaponPool[bestWeaponId]--;
      }

      let bestArmorId = "none";
      let bestArmorScore = -1;

      Object.entries(armorPool).forEach(([itemId, count]) => {
        if (count <= 0) return;
        const item = ITEMS[itemId];
        const score = getArmorScore(item, v);
        if (score > bestArmorScore) {
          bestArmorScore = score;
          bestArmorId = itemId;
        }
      });

      if (bestArmorId !== "none") {
        armorPool[bestArmorId]--;
      }

      const originalWeapon = v.weaponId;
      const originalArmor = v.armorId;

      villagers[index] = {
        ...v,
        weaponId: bestWeaponId,
        armorId: bestArmorId,
      };

      if (originalWeapon !== bestWeaponId) {
        const oldName = originalWeapon !== "none" ? ITEMS[originalWeapon].name : "素手";
        const newName = bestWeaponId !== "none" ? ITEMS[bestWeaponId].name : "素手";
        logs.push(`${v.name} の武器を ${oldName} → ${newName} に自動変更しました。`);
      }
      if (originalArmor !== bestArmorId) {
        const oldName = originalArmor !== "none" ? ITEMS[originalArmor].name : "防具なし";
        const newName = bestArmorId !== "none" ? ITEMS[bestArmorId].name : "防具なし";
        logs.push(`${v.name} の防具を ${oldName} → ${newName} に自動変更しました。`);
      }
    });

    Object.keys(inventory).forEach((itemId) => {
      const item = ITEMS[itemId];
      if (item && item.equipment) {
        inventory[itemId] = 0;
      }
    });

    Object.entries(weaponPool).forEach(([itemId, count]) => {
      if (count > 0) inventory[itemId] = count;
    });
    Object.entries(armorPool).forEach(([itemId, count]) => {
      if (count > 0) inventory[itemId] = count;
    });

    set({
      villagers,
      inventory,
    });

    logs.forEach((log) => state.addLog(log, "info"));
  },
});
