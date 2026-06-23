import { VILLAGER_STARTING_GOLD } from "../constants";
import { VILLAGER_NAMES } from "../data/masterData";
import { Villager } from "../types/game";

export function generateRandomName(existingNames: string[]): string {
  const available = VILLAGER_NAMES.filter((n) => !existingNames.includes(n));
  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }
  // 名前プールが枯渇した場合はインデックス付きでフォールバック
  const poolLen = VILLAGER_NAMES.length;
  const idx = (existingNames.length - poolLen) % poolLen;
  return `${VILLAGER_NAMES[idx]} ${existingNames.length - poolLen + 1}`;
}

export function createVillager(options: {
  id: string;
  name: string;
  level?: number;
  statBonus?: number;
  str?: number;
  int?: number;
  dex?: number;
  agi?: number;
  vit?: number;
}): Villager {
  const sb = options.statBonus || 0;
  return {
    id: options.id,
    name: options.name,
    level: options.level ?? 1,
    exp: 0,
    currentJob: "無職",
    jobHistory: ["無職"],
    maxHp: 100 + sb * 10,
    currentHp: 100 + sb * 10,
    stamina: 100,
    maxStamina: 100,
    str: (options.str ?? 10) + sb,
    int: (options.int ?? 10) + sb,
    dex: (options.dex ?? 10) + sb,
    agi: (options.agi ?? 10) + sb,
    vit: (options.vit ?? 10) + sb,
    weaponId: "none",
    armorId: "none",
    order: "gather",
    status: "idle",
    destinationAreaId: null,
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    potionItemId: "potion",
    potionCount: 0,
    staminaDrinkItemId: "stamina_drink",
    staminaDrinkCount: 0,
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    activeFoodBuffId: null,
    gold: VILLAGER_STARTING_GOLD,
    pool: {},
  };
}

export function isMagicJob(job: string): boolean {
  return ["魔術師", "僧侶", "薬師"].includes(job);
}
