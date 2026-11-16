import { describe, it, expect } from "vitest";

import { findPath } from "../store/life/pathfinding";
import {
  TOWN_BUILDINGS,
  TOWN_GRID_SIZE,
  buildingCells,
  buildOccupancyGrid,
  getBuildingById,
  isOccupied,
  isWalkable,
} from "./townLayout";

describe("townLayout", () => {
  it("建物がグリッド範囲内に収まっていること", () => {
    for (const def of TOWN_BUILDINGS) {
      expect(def.x, def.id).toBeGreaterThanOrEqual(0);
      expect(def.z, def.id).toBeGreaterThanOrEqual(0);
      expect(def.x + def.w, def.id).toBeLessThanOrEqual(TOWN_GRID_SIZE);
      expect(def.z + def.d, def.id).toBeLessThanOrEqual(TOWN_GRID_SIZE);
    }
  });

  it("建物同士の占有マスが重なっていないこと", () => {
    const seen = new Map<string, string>();
    for (const def of TOWN_BUILDINGS) {
      for (const c of buildingCells(def)) {
        const key = `${c.x},${c.z}`;
        expect(seen.get(key), `${def.id} overlaps ${seen.get(key)} at ${key}`).toBeUndefined();
        seen.set(key, def.id);
      }
    }
  });

  it("仕様の建物がすべて揃っていること (門+施設11+倉庫+広場+民家5)", () => {
    expect(TOWN_BUILDINGS).toHaveLength(19);
    for (const id of [
      "gate",
      "farm",
      "lumberyard",
      "quarry",
      "inn",
      "workshop",
      "kitchen",
      "alchemy",
      "market",
      "guild",
      "weapon_shop",
      "training_ground",
      "warehouse",
      "plaza",
      "house_1",
      "house_2",
      "house_3",
      "house_4",
      "house_5",
    ]) {
      expect(getBuildingById(id), id).toBeDefined();
    }
  });

  it("入口と作業基準マスが歩行可能であること", () => {
    for (const def of TOWN_BUILDINGS) {
      expect(isWalkable(def.entrance.x, def.entrance.z), `${def.id}.entrance`).toBe(true);
      expect(isWalkable(def.workAnchor.x, def.workAnchor.z), `${def.id}.workAnchor`).toBe(true);
    }
  });

  it("占有グリッドが blocked 建物だけを塞いでいること", () => {
    const grid = buildOccupancyGrid();
    const inn = getBuildingById("inn")!;
    expect(grid[inn.z][inn.x]).toBe(true);
    expect(isOccupied(inn.x, inn.z)).toBe(true);
    const plaza = getBuildingById("plaza")!;
    expect(grid[plaza.z][plaza.x]).toBe(false);
    const farm = getBuildingById("farm")!;
    expect(grid[farm.z][farm.x]).toBe(false);
  });

  it("広場から全建物の入口へ到達できること", () => {
    const plaza = getBuildingById("plaza")!;
    const start = plaza.workAnchor;
    for (const def of TOWN_BUILDINGS) {
      const path = findPath(start, def.entrance);
      expect(path, `${def.id} entrance unreachable`).not.toBeNull();
      const anchorPath = findPath(start, def.workAnchor);
      expect(anchorPath, `${def.id} workAnchor unreachable`).not.toBeNull();
    }
  });

  it("民家から各職場 (プロトタイプの通勤経路) へ到達できること", () => {
    const pairs: Array<[string, string]> = [
      ["house_1", "farm"],
      ["house_2", "lumberyard"],
      ["house_3", "workshop"],
      ["house_4", "training_ground"],
      ["house_5", "alchemy"],
    ];
    for (const [homeId, workId] of pairs) {
      const home = getBuildingById(homeId)!;
      const work = getBuildingById(workId)!;
      expect(findPath(home.entrance, work.workAnchor), `${homeId}->${workId}`).not.toBeNull();
      expect(findPath(work.workAnchor, home.entrance), `${workId}->${homeId}`).not.toBeNull();
    }
  });
});
