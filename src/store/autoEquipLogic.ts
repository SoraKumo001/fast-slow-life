import { ITEMS } from "../data/masterData";
import { Item, Villager, GameState } from "../types/game";
import { isMagicJob } from "../utils/villagerHelpers";

export interface AutoEquipResult {
  villagers: Villager[];
  inventory: Record<string, number>;
  gold: number;
  logs: string[];
}

export const getWeaponScore = (item: Item, v: Villager): number => {
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

export const getArmorScore = (item: Item, v: Villager): number => {
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

export const autoEquipAllHelper = (state: GameState): AutoEquipResult => {
  const villagers = [...state.villagers];
  const inventory = { ...state.inventory };

  const weaponPool: Record<string, number> = {};
  const armorPool: Record<string, number> = {};

  Object.entries(inventory).forEach(([itemId, count]) => {
    const item = ITEMS[itemId];
    if (!item || !item.equipment || count <= 0) return;
    if (item.equipment.slot === "weapon") {
      weaponPool[itemId] = (weaponPool[itemId] || 0) + count;
    } else if (item.equipment.slot === "armor") {
      armorPool[itemId] = (armorPool[itemId] || 0) + count;
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

  let playerGold = state.gold;
  sortedVillagerIndices.forEach(({ v, index }) => {
    const currentGold = villagers[index].gold;

    let bestWeaponId = "none";
    let bestWeaponScore = -1;
    let weaponCost = 0;
    let isSameWeapon = false;

    Object.entries(weaponPool).forEach(([itemId, count]) => {
      if (count <= 0) return;
      const item = ITEMS[itemId];
      const isSame = v.weaponId === itemId;
      const cost = isSame ? 0 : item.basePrice || 0;

      if (currentGold >= cost) {
        const score = getWeaponScore(item, v);
        if (score > bestWeaponScore) {
          bestWeaponScore = score;
          bestWeaponId = itemId;
          weaponCost = cost;
          isSameWeapon = isSame;
        }
      }
    });

    let remainingGold = currentGold;
    if (bestWeaponId !== "none") {
      if (isSameWeapon) {
        // Best choice is current equipment (free), keep it — no pool/gold change
      } else {
        // Bug 2: check availability before decrementing (another villager may have taken it)
        if (weaponPool[bestWeaponId] > 0) {
          weaponPool[bestWeaponId]--;
          remainingGold -= weaponCost;
          playerGold += weaponCost;
          // Bug 1: return old weapon to pool for reallocation
          if (v.weaponId && v.weaponId !== "none") {
            weaponPool[v.weaponId] = (weaponPool[v.weaponId] || 0) + 1;
          }
        } else {
          // Item already taken by another villager, keep current equipment
          bestWeaponId = v.weaponId || "none";
          weaponCost = 0;
        }
      }
    } else {
      // No better pool item, keep current equipment
      bestWeaponId = v.weaponId || "none";
      weaponCost = 0;
    }

    let bestArmorId = "none";
    let bestArmorScore = -1;
    let armorCost = 0;
    let isSameArmor = false;

    Object.entries(armorPool).forEach(([itemId, count]) => {
      if (count <= 0) return;
      const item = ITEMS[itemId];
      const isSame = v.armorId === itemId;
      const cost = isSame ? 0 : item.basePrice || 0;

      if (remainingGold >= cost) {
        const score = getArmorScore(item, v);
        if (score > bestArmorScore) {
          bestArmorScore = score;
          bestArmorId = itemId;
          armorCost = cost;
          isSameArmor = isSame;
        }
      }
    });

    if (bestArmorId !== "none") {
      if (isSameArmor) {
        // Best choice is current armor (free), keep it — no pool/gold change
      } else {
        if (armorPool[bestArmorId] > 0) {
          armorPool[bestArmorId]--;
          remainingGold -= armorCost;
          playerGold += armorCost;
          if (v.armorId && v.armorId !== "none") {
            armorPool[v.armorId] = (armorPool[v.armorId] || 0) + 1;
          }
        } else {
          bestArmorId = v.armorId || "none";
          armorCost = 0;
        }
      }
    } else {
      bestArmorId = v.armorId || "none";
      armorCost = 0;
    }

    const originalWeapon = v.weaponId;
    const originalArmor = v.armorId;

    villagers[index] = {
      ...villagers[index],
      gold: remainingGold,
      weaponId: bestWeaponId,
      armorId: bestArmorId,
    };

    if (originalWeapon !== bestWeaponId) {
      const oldName = originalWeapon !== "none" ? ITEMS[originalWeapon].name : "素手";
      const newName = bestWeaponId !== "none" ? ITEMS[bestWeaponId].name : "素手";
      logs.push(
        `${v.name} が ${newName} を購入して装備しました（${oldName} → ${newName}、購入額: ${weaponCost}G）。`,
      );
    }
    if (originalArmor !== bestArmorId) {
      const oldName = originalArmor !== "none" ? ITEMS[originalArmor].name : "防具なし";
      const newName = bestArmorId !== "none" ? ITEMS[bestArmorId].name : "防具なし";
      logs.push(
        `${v.name} が ${newName} を購入して装備しました（${oldName} → ${newName}、購入額: ${armorCost}G）。`,
      );
    }
  });

  const resultInventory = { ...inventory };
  Object.keys(resultInventory).forEach((itemId) => {
    const item = ITEMS[itemId];
    if (item && item.equipment) {
      resultInventory[itemId] = 0;
    }
  });

  Object.entries(weaponPool).forEach(([itemId, count]) => {
    if (count > 0) resultInventory[itemId] = count;
  });
  Object.entries(armorPool).forEach(([itemId, count]) => {
    if (count > 0) resultInventory[itemId] = count;
  });

  return { villagers, inventory: resultInventory, gold: playerGold, logs };
};
