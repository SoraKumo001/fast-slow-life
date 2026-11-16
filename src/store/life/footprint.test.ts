import { describe, it, expect, beforeEach } from "vitest";

import type { Villager } from "../../types/game";
import { createVillager } from "../../utils/villagerHelpers";
import {
  MAX_FOOTPRINT_PER_VILLAGER,
  describeTransition,
  useFootprintStore,
  type DestinationLike,
} from "./footprint";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return { ...createVillager({ id: "v1", name: "村人v1" }), ...overrides };
}

const CTX = { buildingName: "加工工房", dungeonName: "始まりの森" };
const dest = (buildingId: string, activity: string, lifeAction?: string): DestinationLike => ({
  buildingId,
  activity,
  lifeAction,
});

describe("describeTransition: 文面生成", () => {
  const v = makeVillager();

  it("work は建物ごとに文面が変わる", () => {
    expect(describeTransition(null, dest("workshop", "work"), v, CTX)).toEqual({
      text: "加工工房でクラフト",
      kind: "work",
    });
    expect(
      describeTransition(dest("plaza", "stroll"), dest("training_ground", "work"), v, {
        buildingName: "訓練所",
      }),
    ).toEqual({ text: "訓練所で訓練", kind: "work" });
    expect(
      describeTransition(null, dest("farm", "work"), v, { buildingName: "農場" }),
    ).toEqual({ text: "農場で農作業", kind: "work" });
  });

  it("ダンジョンへは「{ダンジョン名}へ出発」、帰りは「帰還」", () => {
    expect(describeTransition(dest("gate", "home"), dest("gate", "dungeon"), v, CTX)).toEqual(
      { text: "始まりの森へ出発", kind: "depart" },
    );
    expect(
      describeTransition(dest("gate", "dungeon"), dest("house_1", "home"), v, CTX),
    ).toEqual({ text: "帰還", kind: "arrive" });
  });

  it("就寝と起床", () => {
    expect(describeTransition(dest("house_1", "home"), dest("house_1", "sleep"), v, CTX)).toEqual(
      { text: "就寝", kind: "sleep" },
    );
    expect(
      describeTransition(dest("house_1", "sleep"), dest("kitchen", "meal"), v, {
        buildingName: "調理場",
      }),
    ).toEqual({ text: "起床", kind: "wake" });
  });

  it("食事の3分岐: 料理名あり / なし / 飢餓", () => {
    const withDish = makeVillager({ activeFoodBuffId: "food_bread" });
    expect(
      describeTransition(null, dest("kitchen", "meal"), withDish, { buildingName: "調理場" }),
    ).toEqual({ text: "調理場で食事（パン）", kind: "meal" });

    expect(
      describeTransition(null, dest("kitchen", "meal"), v, { buildingName: "調理場" }),
    ).toEqual({ text: "調理場で食事", kind: "meal" });

    const starving = makeVillager({ isStarving: true, activeFoodBuffId: "food_bread" });
    expect(
      describeTransition(null, dest("kitchen", "meal"), starving, { buildingName: "調理場" }),
    ).toEqual({ text: "食べるものがなかった", kind: "meal" });
  });

  it("rest / plaza / stroll / home の文面", () => {
    expect(describeTransition(null, dest("inn", "rest"), v, { buildingName: "宿屋" })).toEqual({
      text: "宿屋で休憩",
      kind: "rest",
    });
    expect(describeTransition(null, dest("plaza", "stroll", "plaza"), v, CTX)).toEqual({
      text: "広場で休憩",
      kind: "plaza",
    });
    expect(
      describeTransition(null, dest("market", "stroll", "shopping"), v, {
        buildingName: "交易所",
      }),
    ).toEqual({ text: "交易所で買い物", kind: "other" });
    expect(
      describeTransition(null, dest("farm", "stroll", "workplaceVisit"), v, {
        buildingName: "農場",
      }),
    ).toEqual({ text: "農場に立ち寄った", kind: "other" });
    expect(describeTransition(null, dest("house_1", "home"), v, CTX)).toEqual({
      text: "帰宅",
      kind: "arrive",
    });
  });

  it("同じ行き先が続く場合は null (記録しない)", () => {
    expect(describeTransition(dest("plaza", "stroll"), dest("plaza", "stroll"), v, CTX)).toBeNull();
    expect(describeTransition(dest("inn", "rest"), dest("inn", "rest"), v, CTX)).toBeNull();
  });
});

describe("useFootprintStore", () => {
  beforeEach(() => {
    useFootprintStore.setState({ entries: [] });
  });

  const entry = (villagerId: string, day: number, hour: number, text: string) => ({
    villagerId,
    day,
    hour,
    text,
    kind: "other" as const,
  });

  it("追加と entriesFor (村人・日で絞り込み、記録順)", () => {
    const { addEntry, entriesFor } = useFootprintStore.getState();
    addEntry(entry("v1", 1, 7, "起床"));
    addEntry(entry("v1", 1, 8, "加工工房でクラフト"));
    addEntry(entry("v2", 1, 8, "起床"));
    expect(entriesFor("v1", 1).map((e) => e.text)).toEqual(["起床", "加工工房でクラフト"]);
    expect(entriesFor("v2", 1)).toHaveLength(1);
    expect(entriesFor("v1", 2)).toHaveLength(0);
  });

  it("連続する同一エントリは追加されない", () => {
    const { addEntry, entriesFor } = useFootprintStore.getState();
    addEntry(entry("v1", 1, 7, "起床"));
    addEntry(entry("v1", 1, 7, "起床"));
    addEntry(entry("v1", 1, 7, "起床"));
    expect(entriesFor("v1", 1)).toHaveLength(1);
    // 間に別のエントリを挟めば同じ文面でも追加される
    addEntry(entry("v1", 1, 8, "広場で休憩"));
    addEntry(entry("v1", 1, 9, "起床"));
    expect(entriesFor("v1", 1)).toHaveLength(3);
  });

  it("翌日のエントリ追加で前日分が破棄される (日次ローテーション)", () => {
    const { addEntry, entriesFor } = useFootprintStore.getState();
    addEntry(entry("v1", 1, 7, "起床"));
    addEntry(entry("v1", 1, 22, "就寝"));
    addEntry(entry("v2", 1, 9, "起床"));
    addEntry(entry("v1", 2, 6, "起床"));
    expect(entriesFor("v1", 1)).toHaveLength(0);
    expect(entriesFor("v1", 2)).toHaveLength(1);
    // 他の村人の前日分も破棄される
    expect(useFootprintStore.getState().entries.filter((e) => e.day === 1)).toHaveLength(0);
  });

  it("村人あたり上限を超えたら古い順に捨てる", () => {
    const { addEntry, entriesFor } = useFootprintStore.getState();
    for (let i = 0; i < MAX_FOOTPRINT_PER_VILLAGER + 5; i++) {
      addEntry(entry("v1", 1, i % 24, `行動${i}`));
    }
    const mine = entriesFor("v1", 1);
    expect(mine).toHaveLength(MAX_FOOTPRINT_PER_VILLAGER);
    expect(mine[0].text).toBe("行動5");
    // 他の村人には影響しない
    addEntry(entry("v2", 1, 7, "起床"));
    expect(entriesFor("v2", 1)).toHaveLength(1);
    expect(entriesFor("v1", 1)).toHaveLength(MAX_FOOTPRINT_PER_VILLAGER);
  });
});
