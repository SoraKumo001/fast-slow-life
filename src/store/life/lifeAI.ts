import { TOWN_BUILDINGS, type TownBuildingDef } from "../../data/townLayout";
import type { Facility, FacilityType, JobType, Villager } from "../../types/game";
import type { TownActivity } from "../town/townSpatial";
import { deriveNeeds, hash01, type Needs } from "./needs";

/**
 * Phase 2 生活AI (純関数・決定論的)。
 * 本体ロジックが拘束していない時間 (idle、および resting の詳細) に、
 * 村人が町のどこで何をして過ごすかを Utility スコアで選ぶ。
 * Math.random は使わない (個人差は id ハッシュの固定ノイズ)。
 */

export type LifeActionKind =
  | "meal"
  | "recuperate"
  | "plaza"
  | "shopping"
  | "workplaceVisit"
  | "home";

export interface LifeActivityChoice {
  kind: LifeActionKind;
  buildingId: string;
  building: TownBuildingDef;
  activity: TownActivity;
  score: number;
}

export interface LifeCandidate extends LifeActivityChoice {
  eligible: boolean;
}

type FacilitiesMap = Record<FacilityType, Facility>;

const PLAZA_DEF = TOWN_BUILDINGS.find((b) => b.id === "plaza")!;
const GATE_DEF = TOWN_BUILDINGS.find((b) => b.id === "gate")!;
const HOUSE_DEFS = TOWN_BUILDINGS.filter((b) => b.kind === "house");

function defForFacility(facilityId: FacilityType): TownBuildingDef | undefined {
  return TOWN_BUILDINGS.find((b) => b.facilityId === facilityId);
}

function facilityLevel(facilities: FacilitiesMap, facilityId: FacilityType): number {
  return facilities[facilityId]?.level ?? 0;
}

/** 職業嗜好: その職業が「様子見」に立ち寄りたくなる場所 (無職はなし) */
const JOB_WORKPLACE: Partial<Record<JobType, FacilityType | "gate">> = {
  農民: "farm",
  木こり: "lumberyard",
  鉱夫: "quarry",
  薬師: "alchemy",
  職人: "workshop",
  戦士: "training_ground",
  猟師: "gate",
  魔術師: "alchemy",
  僧侶: "inn",
};

const MEAL_HOURS = new Set([7, 12, 18]);

function normalizeHour(hour: number): number {
  return ((Math.floor(hour) % 24) + 24) % 24;
}

/**
 * 候補行動すべてにスコアを付けて返す (候補表の順序を保持する)。
 * 同点の場合は候補表の上位が優先されるため、chooseLifeActivity は
 * 「厳密に大きい場合だけ更新」する形で先頭から走査する。
 */
export function evaluateLifeCandidates(
  villager: Villager,
  facilities: FacilitiesMap,
  hour: number,
  home: TownBuildingDef,
  needs: Needs = deriveNeeds(villager, hour),
): LifeCandidate[] {
  const h = normalizeHour(hour);
  const noise = (kind: LifeActionKind) => hash01(`${villager.id}:${kind}`) * 10;
  const make = (
    kind: LifeActionKind,
    building: TownBuildingDef,
    activity: TownActivity,
    score: number,
    eligible: boolean,
  ): LifeCandidate => ({ kind, buildingId: building.id, building, activity, score, eligible });

  // 食事: 調理場 → 宿屋 → 広場
  const kitchenDef = defForFacility("kitchen");
  const innDef = defForFacility("inn");
  const mealDef =
    facilityLevel(facilities, "kitchen") >= 1 && kitchenDef
      ? kitchenDef
      : facilityLevel(facilities, "inn") >= 1 && innDef
        ? innDef
        : PLAZA_DEF;
  const meal = make(
    "meal",
    mealDef,
    "meal",
    needs.hunger * 1.2 + (MEAL_HOURS.has(h) ? 20 : 0) + noise("meal"),
    needs.hunger >= 40,
  );

  // 静養: 宿屋 → 自宅
  const recuperateDef =
    facilityLevel(facilities, "inn") >= 1 && innDef ? innDef : home;
  const recuperate = make(
    "recuperate",
    recuperateDef,
    "rest",
    needs.fatigue * 1.0 + needs.illHealth * 1.0 + noise("recuperate"),
    needs.fatigue >= 50 || needs.illHealth >= 50,
  );

  // 広場で過ごす
  const plaza = make(
    "plaza",
    PLAZA_DEF,
    "stroll",
    needs.social * 0.9 + (h >= 7 && h <= 18 ? 10 : 0) + noise("plaza"),
    true,
  );

  // 買い物ぶらぶら: 交易所が建っているときだけ
  const marketDef = defForFacility("market") ?? PLAZA_DEF;
  const shopping = make(
    "shopping",
    marketDef,
    "stroll",
    needs.wealthLack * 0.6 + noise("shopping"),
    facilityLevel(facilities, "market") >= 1 && needs.wealthLack >= 30,
  );

  // 職場の様子見: 職業嗜好の場所 (無職は候補なし → 自宅を仮置きし eligible=false)
  const workplaceTarget = JOB_WORKPLACE[villager.currentJob];
  const workplaceDef =
    workplaceTarget === "gate"
      ? GATE_DEF
      : workplaceTarget
        ? (defForFacility(workplaceTarget) ?? home)
        : home;
  const workplaceVisit = make(
    "workplaceVisit",
    workplaceDef,
    "stroll",
    15 + 5 + noise("workplaceVisit"),
    workplaceTarget !== undefined,
  );

  // 自宅で過ごす
  const homeStay = make(
    "home",
    home,
    "home",
    needs.fatigue * 0.4 + (h >= 19 ? 15 : 0) + noise("home"),
    true,
  );

  return [meal, recuperate, plaza, shopping, workplaceVisit, homeStay];
}

/**
 * 最もスコアの高い候補を選ぶ。同点は候補表の上位を優先する。
 * villagerIndex / home は townSpatial から渡される (home 未指定時は
 * villagerIndex による Phase 1 互換の民家にフォールバックする)。
 */
export function chooseLifeActivity(
  villager: Villager,
  facilities: FacilitiesMap,
  hour: number,
  villagerIndex?: number,
  home?: TownBuildingDef,
): LifeActivityChoice {
  const homeDef =
    home ??
    HOUSE_DEFS[
      (((villagerIndex ?? 0) % HOUSE_DEFS.length) + HOUSE_DEFS.length) % HOUSE_DEFS.length
    ];
  const candidates = evaluateLifeCandidates(villager, facilities, hour, homeDef);
  let best: LifeCandidate | null = null;
  for (const c of candidates) {
    if (!c.eligible) continue;
    if (!best || c.score > best.score) best = c;
  }
  // plaza と home は常時 eligible なので best は必ず存在する
  const chosen = best ?? candidates[2];
  return {
    kind: chosen.kind,
    buildingId: chosen.buildingId,
    building: chosen.building,
    activity: chosen.activity,
    score: chosen.score,
  };
}
