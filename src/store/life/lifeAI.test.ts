import { describe, it, expect } from "vitest";

import { getBuildingById, isWalkable } from "../../data/townLayout";
import type { Facility, FacilityType, JobType, Villager } from "../../types/game";
import { createVillager } from "../../utils/villagerHelpers";
import { getInitialFacilities } from "../initialState";
import { chooseLifeActivity, evaluateLifeCandidates } from "./lifeAI";

function makeVillager(id: string, overrides: Partial<Villager> = {}): Villager {
  return { ...createVillager({ id, name: `村人${id}` }), ...overrides };
}

function makeFacilities(): Record<FacilityType, Facility> {
  return getInitialFacilities();
}

function withLevel(
  facilities: Record<FacilityType, Facility>,
  facilityId: FacilityType,
  level: number,
): Record<FacilityType, Facility> {
  facilities[facilityId] = { ...facilities[facilityId], level };
  return facilities;
}

const HOME = getBuildingById("house_2")!;

describe("chooseLifeActivity: 食事", () => {
  it("飢餓の村人は食事どき (7・12・18時) に調理場で meal を選ぶ", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v1", { isStarving: true });
    for (const hour of [7, 12, 18]) {
      const choice = chooseLifeActivity(v, facilities, hour, 0, HOME);
      expect(choice.kind, `hour=${hour}`).toBe("meal");
      expect(choice.buildingId).toBe("kitchen");
      expect(choice.activity).toBe("meal");
    }
  });

  it("食事の行き先は 調理場 → 宿屋 → 広場 の順にフォールバックする", () => {
    const v = makeVillager("v1", { isStarving: true });
    const noKitchen = withLevel(makeFacilities(), "kitchen", 0);
    expect(chooseLifeActivity(v, noKitchen, 12, 0, HOME).buildingId).toBe("inn");

    const neither = withLevel(withLevel(makeFacilities(), "kitchen", 0), "inn", 0);
    expect(chooseLifeActivity(v, neither, 12, 0, HOME).buildingId).toBe("plaza");
  });

  it("食事バフがある村人は空腹が下がり meal を選ばない", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v1", { activeFoodBuffId: "food_bread" });
    const meal = evaluateLifeCandidates(v, facilities, 12, HOME).find((c) => c.kind === "meal");
    expect(meal?.eligible).toBe(false);
    expect(chooseLifeActivity(v, facilities, 12, 0, HOME).kind).not.toBe("meal");
  });
});

describe("chooseLifeActivity: 静養", () => {
  it("疲労した村人は宿屋で静養を選ぶ", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v1", { stamina: 0, activeFoodBuffId: "food_bread" });
    const choice = chooseLifeActivity(v, facilities, 10, 0, HOME);
    expect(choice.kind).toBe("recuperate");
    expect(choice.buildingId).toBe("inn");
    expect(choice.activity).toBe("rest");
  });

  it("健康欠乏が大きい村人も静養を選ぶ", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v1", { currentHp: 20, activeFoodBuffId: "food_bread" });
    const choice = chooseLifeActivity(v, facilities, 10, 0, HOME);
    expect(choice.kind).toBe("recuperate");
  });

  it("宿屋が未建設なら静養は自宅になる", () => {
    const facilities = withLevel(makeFacilities(), "inn", 0);
    const v = makeVillager("v1", { stamina: 0, activeFoodBuffId: "food_bread" });
    const choice = chooseLifeActivity(v, facilities, 10, 0, HOME);
    expect(choice.kind).toBe("recuperate");
    expect(choice.buildingId).toBe(HOME.id);
  });
});

describe("chooseLifeActivity: 広場・買い物・職場・自宅", () => {
  it("満ち足りた無職の村人は昼に広場を選ぶ", () => {
    const facilities = makeFacilities();
    const v = makeVillager("v1", { activeFoodBuffId: "food_bread", gold: 1000 });
    const choice = chooseLifeActivity(v, facilities, 12, 0, HOME);
    expect(choice.kind).toBe("plaza");
    expect(choice.buildingId).toBe("plaza");
    expect(choice.activity).toBe("stroll");
  });

  it("ツケを抱えた村人は交易所があれば買い物を選ぶ", () => {
    const facilities = withLevel(makeFacilities(), "market", 1);
    const v = makeVillager("v1", { activeFoodBuffId: "food_bread", gold: -10 });
    const choice = chooseLifeActivity(v, facilities, 6, 0, HOME);
    expect(choice.kind).toBe("shopping");
    expect(choice.buildingId).toBe("market");
    expect(choice.activity).toBe("stroll");
  });

  it("交易所が未建設なら買い物は候補から外れる", () => {
    const facilities = makeFacilities(); // market Lv0
    const v = makeVillager("v1", { gold: -10 });
    const shopping = evaluateLifeCandidates(v, facilities, 12, HOME).find(
      (c) => c.kind === "shopping",
    );
    expect(shopping?.eligible).toBe(false);
  });

  it("職業嗜好の様子見先が職業ごとに正しい", () => {
    const facilities = makeFacilities();
    const expected: Partial<Record<JobType, string>> = {
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
    for (const [job, buildingId] of Object.entries(expected)) {
      const v = makeVillager("v1", { currentJob: job as JobType });
      const visit = evaluateLifeCandidates(v, facilities, 12, HOME).find(
        (c) => c.kind === "workplaceVisit",
      );
      expect(visit?.eligible, job).toBe(true);
      expect(visit?.buildingId, job).toBe(buildingId);
    }
    const unemployed = evaluateLifeCandidates(
      makeVillager("v1", { currentJob: "無職" }),
      facilities,
      12,
      HOME,
    ).find((c) => c.kind === "workplaceVisit");
    expect(unemployed?.eligible).toBe(false);
  });

  it("候補は表の順序で返り、全候補の行き先が歩行可能マスを持つ", () => {
    const facilities = withLevel(makeFacilities(), "market", 3);
    const v = makeVillager("v1", { currentJob: "職人" });
    const candidates = evaluateLifeCandidates(v, facilities, 12, HOME);
    expect(candidates.map((c) => c.kind)).toEqual([
      "meal",
      "recuperate",
      "plaza",
      "shopping",
      "workplaceVisit",
      "home",
    ]);
    for (const c of candidates) {
      expect(isWalkable(c.building.workAnchor.x, c.building.workAnchor.z), c.kind).toBe(true);
    }
  });
});

describe("chooseLifeActivity: 決定性", () => {
  it("同じ入力では常に同じ選択", () => {
    const facilities = withLevel(makeFacilities(), "market", 2);
    const v = makeVillager("v7", { currentJob: "薬師", stamina: 63, gold: 120 });
    for (let h = 0; h < 24; h++) {
      expect(chooseLifeActivity(v, facilities, h, 2, HOME)).toEqual(
        chooseLifeActivity(v, facilities, h, 2, HOME),
      );
    }
  });
});
