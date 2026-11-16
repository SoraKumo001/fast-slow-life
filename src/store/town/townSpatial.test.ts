import { describe, it, expect } from "vitest";

import { TOWN_BUILDINGS, isWalkable } from "../../data/townLayout";
import type { ActiveBossState, Facility, FacilityType, Villager } from "../../types/game";
import { createVillager } from "../../utils/villagerHelpers";
import { getInitialFacilities } from "../initialState";
import {
  homeBuildingForVillager,
  offsetAnchor,
  resolveVillagerDestination,
  weatherForDay,
  type WeatherKind,
} from "./townSpatial";

function makeVillager(id: string, overrides: Partial<Villager> = {}): Villager {
  return { ...createVillager({ id, name: `村人${id}` }), ...overrides };
}

function makeFacilities(): Record<FacilityType, Facility> {
  return getInitialFacilities();
}

function withCraftJob(
  facilities: Record<FacilityType, Facility>,
  facilityId: FacilityType,
  jobId: string,
  villagerId: string,
): Record<FacilityType, Facility> {
  const fac = facilities[facilityId];
  facilities[facilityId] = {
    ...fac,
    craftQueue: [
      ...fac.craftQueue,
      { id: jobId, itemId: "wood_plank", timeLeft: 3, totalTime: 3, assignedVillagerId: villagerId },
    ],
  };
  return facilities;
}

function withTrainingJob(
  facilities: Record<FacilityType, Facility>,
  jobId: string,
  villagerId: string,
): Record<FacilityType, Facility> {
  const fac = facilities.training_ground;
  facilities.training_ground = {
    ...fac,
    trainingQueue: [
      ...fac.trainingQueue,
      {
        id: jobId,
        programId: "basic_training",
        timeLeft: 5,
        totalTime: 5,
        assignedVillagerId: villagerId,
        goldPerHour: 10,
      },
    ],
  };
  return facilities;
}

const BOSS: ActiveBossState = {
  monsterId: "goblin_leader",
  currentHp: 100,
  maxHp: 100,
  attackerIds: ["v1"],
};

describe("resolveVillagerDestination: 優先順位", () => {
  it("行1: ボス参加者はダンジョン状態・クラフト割当より優先して門へ", () => {
    const facilities = withCraftJob(makeFacilities(), "workshop", "job_craft_1", "v1");
    const v = makeVillager("v1", {
      status: "active",
      destinationAreaId: "forest",
      assignedCraftJobId: "job_craft_1",
    });
    const dest = resolveVillagerDestination(v, facilities, BOSS, 10, 0);
    expect(dest.buildingId).toBe("gate");
    expect(dest.activity).toBe("dungeon");
  });

  it("行2: traveling_to / traveling_back / active+destinationAreaId は門へ", () => {
    const facilities = makeFacilities();
    for (const v of [
      makeVillager("v1", { status: "traveling_to", destinationAreaId: "forest" }),
      makeVillager("v2", { status: "traveling_back", destinationAreaId: "forest" }),
      makeVillager("v3", { status: "active", destinationAreaId: "mine" }),
    ]) {
      const dest = resolveVillagerDestination(v, facilities, null, 10, 0);
      expect(dest.buildingId, v.id).toBe("gate");
      expect(dest.activity, v.id).toBe("dungeon");
    }
  });

  it("行3: craftQueue にある割当はその施設で work (実状態では status=active)", () => {
    const facilities = withCraftJob(makeFacilities(), "kitchen", "job_craft_9", "v2");
    const v = makeVillager("v2", {
      status: "active",
      destinationAreaId: null,
      assignedCraftJobId: "job_craft_9",
    });
    const dest = resolveVillagerDestination(v, facilities, null, 10, 1);
    expect(dest.buildingId).toBe("kitchen");
    expect(dest.activity).toBe("work");
  });

  it("行4: trainingQueue にある割当はクラフトではなく訓練所で work", () => {
    let facilities = makeFacilities();
    facilities = withTrainingJob(facilities, "job_train_1", "v3");
    // 別の施設の craftQueue には無関係なジョブだけが入っている状態
    facilities = withCraftJob(facilities, "workshop", "job_other", "v9");
    const v = makeVillager("v3", {
      status: "active",
      destinationAreaId: null,
      assignedCraftJobId: "job_train_1",
    });
    const dest = resolveVillagerDestination(v, facilities, null, 10, 2);
    expect(dest.buildingId).toBe("training_ground");
    expect(dest.activity).toBe("work");
  });

  it("行3/4判別: 同じ村人でもジョブが入っているキューの種類で行き先が変わる", () => {
    const jobId = "job_shared_id";
    const v = makeVillager("v4", {
      status: "active",
      destinationAreaId: null,
      assignedCraftJobId: jobId,
    });
    const asCraft = resolveVillagerDestination(
      v,
      withCraftJob(makeFacilities(), "workshop", jobId, "v4"),
      null,
      10,
      3,
    );
    expect(asCraft.buildingId).toBe("workshop");

    const asTraining = resolveVillagerDestination(
      v,
      withTrainingJob(makeFacilities(), jobId, "v4"),
      null,
      10,
      3,
    );
    expect(asTraining.buildingId).toBe("training_ground");
  });

  it("行5: upgradeAssignedVillagerId が一致する施設で work", () => {
    const facilities = makeFacilities();
    facilities.inn = { ...facilities.inn, upgradeAssignedVillagerId: "v5" };
    const v = makeVillager("v5", {
      status: "active",
      destinationAreaId: null,
      assignedCraftJobId: "upgrade_inn",
    });
    const dest = resolveVillagerDestination(v, facilities, null, 10, 4);
    expect(dest.buildingId).toBe("inn");
    expect(dest.activity).toBe("work");
  });

  it("行6: resting は宿屋Lv1なら宿屋、Lv0なら自宅", () => {
    const v = makeVillager("v1", { status: "resting" });
    const withInn = resolveVillagerDestination(v, makeFacilities(), null, 15, 0);
    expect(withInn.buildingId).toBe("inn");
    expect(withInn.activity).toBe("rest");

    const noInnFacilities = makeFacilities();
    noInnFacilities.inn = { ...noInnFacilities.inn, level: 0 };
    const withoutInn = resolveVillagerDestination(v, noInnFacilities, null, 15, 0);
    expect(withoutInn.buildingId).toBe("house_1");
    expect(withoutInn.activity).toBe("rest");
  });

  it("行7-9: idle は時刻帯で sleep / plaza / home に分かれる", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v2", { status: "idle" });
    const at = (hour: number) => resolveVillagerDestination(v, facilities, null, hour, 1);

    for (const h of [22, 23, 0, 3, 5]) {
      const d = at(h);
      expect(d.activity, `hour=${h}`).toBe("sleep");
      expect(d.buildingId, `hour=${h}`).toBe("house_2");
    }
    for (const h of [7, 12, 18]) {
      const d = at(h);
      expect(d.activity, `hour=${h}`).toBe("idle");
      expect(d.buildingId, `hour=${h}`).toBe("plaza");
    }
    for (const h of [6, 19, 20, 21]) {
      const d = at(h);
      expect(d.activity, `hour=${h}`).toBe("home");
      expect(d.buildingId, `hour=${h}`).toBe("house_2");
    }
  });
});

describe("homeBuildingForVillager", () => {
  it("並び順で民家に割り当て、6人目は1軒目に戻る (相部屋)", () => {
    const villagers = ["v1", "v2", "v3", "v4", "v5", "v6", "v7"].map((id) => makeVillager(id));
    expect(homeBuildingForVillager(villagers, "v1").id).toBe("house_1");
    expect(homeBuildingForVillager(villagers, "v5").id).toBe("house_5");
    expect(homeBuildingForVillager(villagers, "v6").id).toBe("house_1");
    expect(homeBuildingForVillager(villagers, "v7").id).toBe("house_2");
  });

  it("resolve の自宅系行き先と homeBuildingForVillager が一致する", () => {
    const villagers = ["v1", "v2", "v3", "v4", "v5", "v6"].map((id) => makeVillager(id));
    const facilities = makeFacilities();
    villagers.forEach((v, i) => {
      const dest = resolveVillagerDestination(v, facilities, null, 23, i);
      expect(dest.buildingId).toBe(homeBuildingForVillager(villagers, v.id).id);
    });
  });
});

describe("行き先の妥当性 (全状態 × 全時刻)", () => {
  it("どの村人・どの時刻でも歩行可能マスに決定論的に解決する", () => {
    let facilities = makeFacilities();
    facilities = withCraftJob(facilities, "workshop", "job_c1", "v3");
    facilities = withTrainingJob(facilities, "job_t1", "v4");
    facilities.inn = { ...facilities.inn, upgradeAssignedVillagerId: "v5" };

    const villagers: Villager[] = [
      makeVillager("v1", { status: "traveling_to", destinationAreaId: "forest" }),
      makeVillager("v2", { status: "resting" }),
      makeVillager("v3", { status: "active", assignedCraftJobId: "job_c1" }),
      makeVillager("v4", { status: "active", assignedCraftJobId: "job_t1" }),
      makeVillager("v5", { status: "active", assignedCraftJobId: "upgrade_inn" }),
      makeVillager("v6", { status: "idle" }),
      makeVillager("v7", { status: "idle" }),
    ];

    villagers.forEach((v, i) => {
      for (let hour = 0; hour < 24; hour++) {
        const dest = resolveVillagerDestination(v, facilities, null, hour, i);
        expect(dest.buildingId, `${v.id}@${hour}`).toBeTruthy();
        expect(
          isWalkable(dest.anchor.x, dest.anchor.z),
          `${v.id}@${hour} -> ${dest.buildingId} (${dest.anchor.x},${dest.anchor.z})`,
        ).toBe(true);
        // 決定論性: 同じ入力では同じ結果
        expect(resolveVillagerDestination(v, facilities, null, hour, i)).toEqual(dest);
      }
    });
  });

  it("offsetAnchor は全建物の workAnchor × index 0..13 で歩行可能マスを返す", () => {
    for (const def of TOWN_BUILDINGS) {
      for (let i = 0; i < 14; i++) {
        const a = offsetAnchor(def.workAnchor, i);
        expect(isWalkable(a.x, a.z), `${def.id} idx=${i}`).toBe(true);
      }
    }
  });
});

describe("weatherForDay", () => {
  it("同じ day では常に同じ天気", () => {
    for (let day = 1; day <= 60; day++) {
      expect(weatherForDay(day)).toBe(weatherForDay(day));
    }
  });

  it("分布が極端に偏らない (day 1..1000)", () => {
    const counts: Record<WeatherKind, number> = { sunny: 0, rain: 0, snow: 0 };
    for (let day = 1; day <= 1000; day++) counts[weatherForDay(day)]++;
    const sunny = counts.sunny / 1000;
    const rain = counts.rain / 1000;
    const snow = counts.snow / 1000;
    expect(sunny).toBeGreaterThan(0.58);
    expect(sunny).toBeLessThan(0.82);
    expect(rain).toBeGreaterThan(0.08);
    expect(rain).toBeLessThan(0.32);
    expect(snow).toBeGreaterThan(0.02);
    expect(snow).toBeLessThan(0.2);
  });
});
