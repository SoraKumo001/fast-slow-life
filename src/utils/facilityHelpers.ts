import type { Facility, FacilityType } from "../types/game";

export interface ResourceProductionInfo {
  /** 表示用の生産アイテムラベル (例: "食料 +1") */
  label: string;
  /** 詳細な生産アイテムリスト */
  details: string[];
}

/**
 * 資源施設の12時間あたり生産情報を返す。
 * resourceFacilitiesHelper.ts の実際のゲームロジックと一致させる。
 */
export function getResourceProductionInfo(fac: Facility): ResourceProductionInfo {
  const lvl = fac.level;
  if (lvl <= 0) return { label: "なし", details: [] };

  if (fac.id === "farm") {
    const wheat = Math.floor((1 + lvl) / 2);
    const vegetable = Math.floor(lvl / 2);
    const rawMeat = Math.floor((lvl - 1) / 2);
    const parts: string[] = [];
    if (wheat > 0) parts.push(`小麦 +${wheat}`);
    if (vegetable > 0) parts.push(`野菜 +${vegetable}`);
    if (rawMeat > 0) parts.push(`生肉 +${rawMeat}`);
    if (lvl >= 3) parts.push(`薬草 (確率:${Math.round((lvl - 2) * 30)}%)`);
    return { label: parts.join("、"), details: parts };
  }

  if (fac.id === "lumberyard") {
    const wood = lvl;
    const parts: string[] = [`原木 +${wood}`];
    if (lvl >= 3) parts.push(`木板 (確率:${Math.round((lvl - 2) * 30)}%)`);
    return { label: `原木 +${wood}`, details: parts };
  }

  if (fac.id === "quarry") {
    const stone = lvl;
    const parts: string[] = [`石材 +${stone}`];
    if (lvl >= 3) parts.push(`鉄鉱石 (確率:${Math.round((lvl - 2) * 30)}%)`);
    if (lvl >= 4) parts.push(`鉄インゴット (確率:${Math.round((lvl - 3) * 20)}%)`);
    if (lvl >= 5) parts.push(`銀鉱石 (確率:25%)`);
    return { label: `石材 +${stone}`, details: parts };
  }

  return { label: "なし", details: [] };
}

/**
 * 資源施設の次レベルでの生産情報を返す。
 */
export function getNextLevelResourceProduction(fac: Facility): ResourceProductionInfo {
  const nextFac: Facility = { ...fac, level: Math.min(fac.level + 1, fac.maxLevel) };
  return getResourceProductionInfo(nextFac);
}

/** 資源生産施設タイプの判別 */
export function isResourceFacility(facilityType: FacilityType): boolean {
  return facilityType === "farm" || facilityType === "lumberyard" || facilityType === "quarry";
}
