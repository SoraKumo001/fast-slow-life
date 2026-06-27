import { describe, it, expect } from "vitest";

import { VILLAGER_NAMES } from "../data/masterData";
import type { Villager, Facility, FacilityType, DungeonArea } from "../types/game";
import {
  createVillager,
  generateRandomName,
  isMagicJob,
  getVillagerPurposeText,
} from "./villagerHelpers";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト",
    currentJob: "農民",
    jobHistory: ["農民"],
    gold: 0,
    pool: {},
    activeFoodBuffId: null,
    lastTrainingDay: 0,
    level: 1,
    exp: 0,
    maxHp: 100,
    currentHp: 100,
    stamina: 100,
    maxStamina: 100,
    str: 10,
    int: 10,
    dex: 10,
    agi: 10,
    vit: 10,
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    potionCount: 0,
    potionItemId: "potion",
    staminaDrinkCount: 0,
    staminaDrinkItemId: "stamina_drink",
    weaponId: "none",
    armorId: "none",
    status: "idle",
    order: "rest",
    destinationAreaId: null,
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    isStarving: false,
    ...overrides,
  } as Villager;
}

describe("villagerHelpers - generateRandomName", () => {
  it("既存名前に含まれない名前を返すこと", () => {
    const name = generateRandomName([]);
    expect(VILLAGER_NAMES).toContain(name);
  });

  it("既存名前と重複しない名前を返すこと", () => {
    const existing = [VILLAGER_NAMES[0], VILLAGER_NAMES[1]];
    const name = generateRandomName(existing);
    expect(existing).not.toContain(name);
  });

  it("既存名前が空配列でも例外を投げないこと", () => {
    expect(() => generateRandomName([])).not.toThrow();
  });

  it("名前プールが枯渇した場合はインデックス付きでフォールバックすること", () => {
    // 全ての名前を既存とする
    const allNames = [...VILLAGER_NAMES];
    const name = generateRandomName(allNames);
    // "名前番号" 形式になる
    expect(name).toMatch(/^\S+ \d+$/);
  });
});

describe("villagerHelpers - createVillager", () => {
  it("必須パラメータのみ渡した場合、デフォルト値で作成されること", () => {
    const v = createVillager({ id: "v1", name: "新規" });
    expect(v.id).toBe("v1");
    expect(v.name).toBe("新規");
    expect(v.level).toBe(1);
    expect(v.currentJob).toBe("無職");
    expect(v.jobHistory).toEqual(["無職"]);
    expect(v.str).toBe(10);
    expect(v.int).toBe(10);
    expect(v.dex).toBe(10);
    expect(v.agi).toBe(10);
    expect(v.vit).toBe(10);
    expect(v.maxHp).toBe(100);
    expect(v.currentHp).toBe(100);
    expect(v.weaponId).toBe("none");
    expect(v.armorId).toBe("none");
    expect(v.status).toBe("idle");
  });

  it("statBonus で全ステータスと HP が増加すること", () => {
    const v = createVillager({ id: "v1", name: "新規", statBonus: 3 });
    // 全ステータス 10 + 3 = 13
    expect(v.str).toBe(13);
    expect(v.int).toBe(13);
    expect(v.dex).toBe(13);
    expect(v.agi).toBe(13);
    expect(v.vit).toBe(13);
    // HP: 100 + 3*10 = 130
    expect(v.maxHp).toBe(130);
    expect(v.currentHp).toBe(130);
  });

  it("個別ステータスを上書きできること", () => {
    const v = createVillager({
      id: "v1",
      name: "新規",
      str: 20,
      int: 25,
      statBonus: 5,
    });
    expect(v.str).toBe(25); // 20 + 5
    expect(v.int).toBe(30); // 25 + 5
    expect(v.dex).toBe(15); // 10 (default) + 5
  });

  it("level パラメータで初期レベルを設定できること", () => {
    const v = createVillager({ id: "v1", name: "新規", level: 5 });
    expect(v.level).toBe(5);
  });

  it("初期値がゴールド・potion 等の装備を正しく持つこと", () => {
    const v = createVillager({ id: "v1", name: "新規" });
    expect(v.gold).toBeGreaterThan(0); // VILLAGER_STARTING_GOLD
    expect(v.potionItemId).toBe("potion");
    expect(v.staminaDrinkItemId).toBe("stamina_drink");
    expect(v.potionCount).toBe(0);
    expect(v.staminaDrinkCount).toBe(0);
  });

  it("作成された村人は active なパーティに参加していないこと", () => {
    const v = createVillager({ id: "v1", name: "新規" });
    expect(v.status).toBe("idle");
    expect(v.order).toBe("gather");
    expect(v.destinationAreaId).toBeNull();
    expect(v.assignedCraftJobId).toBeNull();
  });
});

describe("villagerHelpers - isMagicJob", () => {
  it("魔術師・僧侶・薬師は魔法職として true を返すこと", () => {
    expect(isMagicJob("魔術師")).toBe(true);
    expect(isMagicJob("僧侶")).toBe(true);
    expect(isMagicJob("薬師")).toBe(true);
  });

  it("その他の職業は false を返すこと", () => {
    expect(isMagicJob("農民")).toBe(false);
    expect(isMagicJob("戦士")).toBe(false);
    expect(isMagicJob("木こり")).toBe(false);
    expect(isMagicJob("無職")).toBe(false);
  });

  it("空文字や未知の職業は false を返すこと", () => {
    expect(isMagicJob("")).toBe(false);
    expect(isMagicJob("unknown")).toBe(false);
  });
});

describe("villagerHelpers - getVillagerPurposeText", () => {
  const emptyFacilities = {} as Record<FacilityType, Facility>;
  const emptyDungeons: DungeonArea[] = [];

  it("resting ステータスの場合は「宿屋で休息中」を返すこと", () => {
    const v = makeVillager({ status: "resting" });
    expect(getVillagerPurposeText(v, emptyFacilities, emptyDungeons)).toBe("宿屋で休息中");
  });

  it("assignedCraftJobId がある場合は「クラフト中」を返すこと", () => {
    const v = makeVillager({ assignedCraftJobId: "job_1" });
    const text = getVillagerPurposeText(v, emptyFacilities, emptyDungeons);
    expect(text).toContain("クラフト中");
  });

  it("destinationAreaId + order=gather で「採取」を返すこと", () => {
    const v = makeVillager({
      destinationAreaId: "forest",
      order: "gather",
      autoTargetName: "原木",
    });
    const dungeons: DungeonArea[] = [{ id: "forest", name: "始まりの森" } as DungeonArea];
    const text = getVillagerPurposeText(v, emptyFacilities, dungeons);
    expect(text).toContain("始まりの森");
    expect(text).toContain("採取");
    expect(text).toContain("原木");
  });

  it("destinationAreaId + order=hunt で「討伐」を返すこと", () => {
    const v = makeVillager({
      destinationAreaId: "forest",
      order: "hunt",
      targetMonsterId: "goblin",
    });
    const dungeons: DungeonArea[] = [{ id: "forest", name: "始まりの森" } as DungeonArea];
    const text = getVillagerPurposeText(v, emptyFacilities, dungeons);
    expect(text).toContain("討伐");
  });

  it("destinationAreaId なしの場合は「待機中」を返すこと", () => {
    const v = makeVillager({ destinationAreaId: null });
    const text = getVillagerPurposeText(v, emptyFacilities, emptyDungeons);
    expect(text).toContain("待機中");
  });
});
