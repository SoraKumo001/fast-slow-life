import {
  TOWN_BUILDINGS,
  isWalkable,
  type GridPoint,
  type TownBuildingDef,
} from "../../data/townLayout";
import type { ActiveBossState, Facility, FacilityType, Villager } from "../../types/game";
import { homeBuildingForVillager as assignHomeBuilding } from "../life/homeAssignment";
import { chooseLifeActivity, type LifeActionKind } from "../life/lifeAI";

/**
 * 空間レイヤー (純関数・Three 非依存)。
 * 本体ゲームの既存状態 (村人・施設・ボス) から「村人が町のどこにいるべきか」を導出する。
 * ストアの状態形状は一切変えない (セーブ互換を壊さないため)。
 *
 * Phase 2: idle の過ごし方は生活AI (lifeAI) が欲求ベースで決める。
 * 自宅割り当ては life/homeAssignment (サイドストレージ永続化) に委譲する。
 */

export type TownActivity =
  | "work"
  | "rest"
  | "idle"
  | "home"
  | "sleep"
  | "dungeon"
  | "meal"
  | "stroll";

export interface VillagerDestination {
  buildingId: string;
  activity: TownActivity;
  anchor: GridPoint;
  /** 生活AI が選んだ行動の詳細 (idle / resting のときのみ) */
  lifeAction?: LifeActionKind;
}

export type WeatherKind = "sunny" | "rain" | "snow";

type FacilitiesMap = Record<FacilityType, Facility>;

const GATE_DEF = TOWN_BUILDINGS.find((b) => b.id === "gate")!;
const HOUSE_DEFS = TOWN_BUILDINGS.filter((b) => b.kind === "house");
const BUILDING_BY_FACILITY = new Map<FacilityType, TownBuildingDef>();
for (const def of TOWN_BUILDINGS) {
  if (def.facilityId) BUILDING_BY_FACILITY.set(def.facilityId, def);
}

export function buildingForFacility(facilityId: FacilityType): TownBuildingDef | undefined {
  return BUILDING_BY_FACILITY.get(facilityId);
}

/**
 * 村人の自宅割り当て (Phase 2: life/homeAssignment に委譲)。
 * 初回は最も入居人数の少ない民家に割り当て、サイドストレージに保存される。
 * 並び順に割り当てる自然なケースでは Phase 1 の index 割当と等価に振る舞う。
 */
export function homeBuildingForVillager(
  villagers: readonly Villager[],
  villagerId: string,
): TownBuildingDef {
  return assignHomeBuilding(villagers, villagerId);
}

/** villagerIndex が渡されない場合の決定論的フォールバック (id のハッシュ) */
function indexFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const ANCHOR_OFFSETS: GridPoint[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
  { x: 1, z: -1 },
  { x: -1, z: -1 },
  { x: 2, z: 0 },
  { x: -2, z: 0 },
  { x: 0, z: 2 },
  { x: 0, z: -2 },
];

/**
 * workAnchor を基本に index でずらした到着マスを返す。
 * ずらした先が歩行不能なら候補を順に試し、最後は workAnchor 自体 (歩行可能が保証される) に戻る。
 */
export function offsetAnchor(base: GridPoint, index: number): GridPoint {
  const len = ANCHOR_OFFSETS.length;
  const start = ((Math.floor(index) % len) + len) % len;
  for (let i = 0; i < len; i++) {
    const o = ANCHOR_OFFSETS[(start + i) % len];
    const candidate = { x: base.x + o.x, z: base.z + o.z };
    if (isWalkable(candidate.x, candidate.z)) return candidate;
  }
  return { ...base };
}

/**
 * 村人の行き先解決 (Phase 1 仕様 §3.1 の優先順位)。
 *
 * 注意 (実ストアの状態表現について): クラフト・訓練・アップグレードの担当村人は
 * いずれも status === "active" になる。そのため素朴に「active ⇒ ダンジョン」とすると
 * 作業中の村人が全員門に行ってしまう。ダンジョン活動中の active は destinationAreaId を
 * 必ず持ち、施設作業の active は持たないので、行2はその判別を含めて適用する。
 * 優先順位そのもの (ボス > 移動中 > クラフト > 訓練 > アップグレード > 休息 > idle) は仕様どおり。
 * idle は Phase 2 で生活AIに委譲した (夜間帯の就寝のみ本関数で維持)。
 */
export function resolveVillagerDestination(
  villager: Villager,
  facilities: FacilitiesMap,
  activeBoss: ActiveBossState | null,
  hour: number,
  villagerIndex?: number,
  villagers?: readonly Villager[],
): VillagerDestination {
  const idx = villagerIndex ?? indexFromId(villager.id);
  const dest = (
    def: TownBuildingDef,
    activity: TownActivity,
    lifeAction?: LifeActionKind,
  ): VillagerDestination => ({
    buildingId: def.id,
    activity,
    anchor: offsetAnchor(def.workAnchor, idx),
    ...(lifeAction ? { lifeAction } : {}),
  });
  // 自宅は homeBuildingForVillager と同じ規則。
  // 村人リストが渡された場合は永続化された割り当てを使い、
  // 渡されない場合は Phase 1 の index 割当にフォールバックする。
  const homeDef = villagers
    ? assignHomeBuilding(villagers, villager.id)
    : HOUSE_DEFS[((idx % HOUSE_DEFS.length) + HOUSE_DEFS.length) % HOUSE_DEFS.length];

  // 1. ボス戦参加中は最優先で町外
  if (activeBoss && activeBoss.attackerIds.includes(villager.id)) {
    return dest(GATE_DEF, "dungeon");
  }

  // 2. ダンジョンへ移動中・活動中・帰還中
  if (
    villager.status === "traveling_to" ||
    villager.status === "traveling_back" ||
    (villager.status === "active" && villager.destinationAreaId != null)
  ) {
    return dest(GATE_DEF, "dungeon");
  }

  // 3/4/5. 施設作業の割り当て (assignedCraftJobId が指すキューの種類で判別)
  const jobId = villager.assignedCraftJobId;
  if (jobId) {
    // 3. いずれかの施設の craftQueue にある → クラフト作業
    for (const fac of Object.values(facilities)) {
      if (fac.craftQueue.some((j) => j.id === jobId)) {
        const def = BUILDING_BY_FACILITY.get(fac.id);
        if (def) return dest(def, "work");
      }
    }
    // 4. 訓練所の trainingQueue にある → 訓練
    const training = facilities.training_ground;
    if (training && training.trainingQueue.some((j) => j.id === jobId)) {
      const def = BUILDING_BY_FACILITY.get("training_ground");
      if (def) return dest(def, "work");
    }
  }
  // 5. アップグレード担当
  for (const fac of Object.values(facilities)) {
    if (fac.upgradeAssignedVillagerId === villager.id) {
      const def = BUILDING_BY_FACILITY.get(fac.id);
      if (def) return dest(def, "work");
    }
  }

  // 行2で拾えなかった active (割当も行き先もない) はダンジョン活動中とみなす
  if (villager.status === "active") {
    return dest(GATE_DEF, "dungeon");
  }

  // 6. 休息中: 宿屋が建っていれば宿屋、未建設 (Lv0) なら自宅。
  //    行き先は固定だが、過ごし方の詳細として lifeAction="recuperate" (静養) を添える。
  if (villager.status === "resting") {
    const inn = facilities.inn;
    if (inn && inn.level >= 1) {
      const def = BUILDING_BY_FACILITY.get("inn");
      if (def) return dest(def, "rest", "recuperate");
    }
    return dest(homeDef, "rest", "recuperate");
  }

  // 7. idle の夜間帯 (22〜6時) は就寝を維持する
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 22 || h < 6) {
    return dest(homeDef, "sleep");
  }

  // 8. idle の日中は生活AIが欲求ベースで過ごし方を選ぶ (Phase 2)
  const choice = chooseLifeActivity(villager, facilities, h, idx, homeDef);
  return {
    buildingId: choice.buildingId,
    activity: choice.activity,
    anchor: offsetAnchor(choice.building.workAnchor, idx),
    lifeAction: choice.kind,
  };
}

/**
 * その日の天気。day のハッシュで決定論的に決める (セーブには持たない)。
 * 目安: 晴 70% / 雨 20% / 雪 10%。
 */
export function weatherForDay(day: number): WeatherKind {
  let x = Math.imul(Math.floor(day) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  const r = (x >>> 0) / 4294967296;
  if (r < 0.7) return "sunny";
  if (r < 0.9) return "rain";
  return "snow";
}
