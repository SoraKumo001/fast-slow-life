import { Facility, FacilityType } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export interface ResourceProductionResult {
  inventory: Record<string, number>;
  logs: LogPayload[];
}

/**
 * 資源生産施設（農場・伐採所・採石場）による供給処理。
 * 12時間ごとに呼び出される前提。
 */
export function processResourceFacilities(
  facilities: Record<FacilityType, Facility>,
  inventory: Record<string, number>,
): ResourceProductionResult {
  const nextInventory = { ...inventory };
  const logs: LogPayload[] = [];

  let producedWheat = 0;
  let producedVegetable = 0;
  let producedRawMeat = 0;
  let producedWood = 0;
  let producedStone = 0;
  let producedIronOre = 0;
  let producedSilverOre = 0;
  let producedWoodPlank = 0;

  if (facilities.farm && facilities.farm.level > 0) {
    const lvl = facilities.farm.level;
    producedWheat = Math.floor((1 + lvl) / 2);
    producedVegetable = Math.floor(lvl / 2);
    producedRawMeat = Math.floor((lvl - 1) / 2);

    if (producedWheat > 0) nextInventory.wheat = (nextInventory.wheat || 0) + producedWheat;
    if (producedVegetable > 0)
      nextInventory.vegetable = (nextInventory.vegetable || 0) + producedVegetable;
    if (producedRawMeat > 0)
      nextInventory.raw_meat = (nextInventory.raw_meat || 0) + producedRawMeat;
  }
  if (facilities.lumberyard && facilities.lumberyard.level > 0) {
    const lvl = facilities.lumberyard.level;
    producedWood = lvl; // Lv1=1, Lv2=2, ... Lv5=5
    nextInventory.wood = (nextInventory.wood || 0) + producedWood;

    // Lv3+: 木板を確率生産 (Lv3:30%, Lv4:60%, Lv5:90%)
    if (lvl >= 3 && Math.random() < (lvl - 2) * 0.3) {
      producedWoodPlank = 1;
      nextInventory.wood_plank = (nextInventory.wood_plank || 0) + 1;
    }
  }
  if (facilities.quarry && facilities.quarry.level > 0) {
    const lvl = facilities.quarry.level;
    producedStone = lvl; // Lv1=1, Lv2=2, ... Lv5=5
    nextInventory.stone = (nextInventory.stone || 0) + producedStone;

    // Lv3+: 鉄鉱石を確率生産 (Lv3:30%, Lv4:60%, Lv5:90%)
    if (lvl >= 3 && Math.random() < (lvl - 2) * 0.3) {
      producedIronOre = 1;
      nextInventory.iron_ore = (nextInventory.iron_ore || 0) + 1;
    }
    // Lv5+: 銀鉱石を確率生産 (25%)
    if (lvl >= 5 && Math.random() < 0.25) {
      producedSilverOre = 1;
      nextInventory.silver_ore = (nextInventory.silver_ore || 0) + 1;
    }
  }

  const hasFarmProd = producedWheat > 0 || producedVegetable > 0 || producedRawMeat > 0;
  if (
    hasFarmProd ||
    producedWood > 0 ||
    producedStone > 0 ||
    producedIronOre > 0 ||
    producedSilverOre > 0 ||
    producedWoodPlank > 0
  ) {
    const prodLogs: string[] = [];
    if (hasFarmProd) {
      const farmLogs: string[] = [];
      if (producedWheat > 0) farmLogs.push(`小麦+${producedWheat}`);
      if (producedVegetable > 0) farmLogs.push(`野菜+${producedVegetable}`);
      if (producedRawMeat > 0) farmLogs.push(`生肉+${producedRawMeat}`);
      prodLogs.push(farmLogs.join("、"));
    }
    if (producedWood > 0) prodLogs.push(`原木+${producedWood}`);
    if (producedWoodPlank > 0) prodLogs.push(`木板+${producedWoodPlank}`);
    if (producedStone > 0) prodLogs.push(`石材+${producedStone}`);
    if (producedIronOre > 0) prodLogs.push(`鉄鉱石+${producedIronOre}`);
    if (producedSilverOre > 0) prodLogs.push(`銀鉱石+${producedSilverOre}`);
    logs.push({
      message: `【生産】資源施設が稼働しました（${prodLogs.join("、")}）。`,
      type: "info",
    });
  }

  return { inventory: nextInventory, logs };
}
