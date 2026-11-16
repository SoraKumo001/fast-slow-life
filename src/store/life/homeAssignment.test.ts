import { describe, it, expect, beforeEach, afterEach } from "vitest";

import type { Villager } from "../../types/game";
import { createVillager } from "../../utils/villagerHelpers";
import {
  LIFE_STORAGE_KEY,
  __clearHomeAssignmentCacheForTest,
  __resetHomeAssignmentsForTest,
  homeBuildingForVillager,
} from "./homeAssignment";

function makeVillager(id: string): Villager {
  return createVillager({ id, name: `村人${id}` });
}

function makeVillagers(ids: string[]): Villager[] {
  return ids.map(makeVillager);
}

/** Node 環境向けの最小 localStorage スタブ */
function installLocalStorageStub() {
  const data = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      data.set(k, String(v));
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
  return data;
}

function removeLocalStorageStub() {
  // @ts-expect-error テスト用に削除する
  delete globalThis.localStorage;
}

describe("homeBuildingForVillager (メモリフォールバック)", () => {
  beforeEach(() => {
    removeLocalStorageStub();
    __resetHomeAssignmentsForTest();
  });

  it("並び順に割り当てると Phase 1 の index 割当と一致する (新鮮なケース)", () => {
    const villagers = makeVillagers(["v1", "v2", "v3", "v4", "v5", "v6", "v7"]);
    const assigned = villagers.map((v) => homeBuildingForVillager(villagers, v.id).id);
    expect(assigned).toEqual([
      "house_1",
      "house_2",
      "house_3",
      "house_4",
      "house_5",
      "house_1",
      "house_2",
    ]);
  });

  it("同じ村人は常に同じ家を返す", () => {
    const villagers = makeVillagers(["v1", "v2", "v3"]);
    const first = homeBuildingForVillager(villagers, "v2").id;
    expect(homeBuildingForVillager(villagers, "v2").id).toBe(first);
    expect(homeBuildingForVillager(villagers, "v2").id).toBe(first);
  });

  it("新規の村人は最も入居人数の少ない民家に入る", () => {
    const base = makeVillagers(["v1", "v2", "v3"]);
    base.forEach((v) => homeBuildingForVillager(base, v.id)); // house_1..3
    const withNew = makeVillagers(["v1", "v2", "v3", "v9"]);
    expect(homeBuildingForVillager(withNew, "v9").id).toBe("house_4");
    const withTwoNew = makeVillagers(["v1", "v2", "v3", "v9", "v10"]);
    expect(homeBuildingForVillager(withTwoNew, "v10").id).toBe("house_5");
  });

  it("保存済みの割当はリストの並びが変わっても維持される", () => {
    const villagers = makeVillagers(["v1", "v2", "v3"]);
    villagers.forEach((v) => homeBuildingForVillager(villagers, v.id));
    const reordered = makeVillagers(["v3", "v1", "v2"]);
    expect(homeBuildingForVillager(reordered, "v1").id).toBe("house_1");
    expect(homeBuildingForVillager(reordered, "v2").id).toBe("house_2");
    expect(homeBuildingForVillager(reordered, "v3").id).toBe("house_3");
  });
});

describe("homeBuildingForVillager (localStorage 永続化)", () => {
  let data: Map<string, string>;

  beforeEach(() => {
    data = installLocalStorageStub();
    __resetHomeAssignmentsForTest();
  });

  afterEach(() => {
    removeLocalStorageStub();
    __resetHomeAssignmentsForTest();
  });

  it("割当が fsl-life-v1 に保存され、キャッシュを捨てても復元される", () => {
    const villagers = makeVillagers(["v1", "v2", "v3"]);
    expect(homeBuildingForVillager(villagers, "v1").id).toBe("house_1");
    expect(homeBuildingForVillager(villagers, "v2").id).toBe("house_2");

    const raw = data.get(LIFE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { homes: Record<string, string> };
    expect(parsed.homes).toEqual({ v1: "house_1", v2: "house_2" });

    // 再読み込みの模擬: メモリキャッシュだけを捨てる
    __clearHomeAssignmentCacheForTest();
    expect(homeBuildingForVillager(villagers, "v1").id).toBe("house_1");
    expect(homeBuildingForVillager(villagers, "v2").id).toBe("house_2");
    // 未登録の v3 は復元された人数 (house_1, house_2 に各1人) を見て house_3 に入る
    expect(homeBuildingForVillager(villagers, "v3").id).toBe("house_3");
  });

  it("壊れた保存データは無視して新規割当から始める", () => {
    data.set(LIFE_STORAGE_KEY, "{not json");
    __clearHomeAssignmentCacheForTest();
    const villagers = makeVillagers(["v1"]);
    expect(homeBuildingForVillager(villagers, "v1").id).toBe("house_1");
  });
});
