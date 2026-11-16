import { describe, it, expect } from "vitest";

import { getBuildingById, isRoad, isWalkable } from "../../data/townLayout";
import { computePathCost, findPath } from "./pathfinding";

describe("pathfinding (grid A*)", () => {
  it("開始=ゴールの場合は1マスの経路を返すこと", () => {
    const path = findPath({ x: 16, z: 16 }, { x: 16, z: 16 });
    expect(path).toEqual([{ x: 16, z: 16 }]);
  });

  it("ゴールが建物の中の場合は null を返すこと", () => {
    const inn = getBuildingById("inn")!;
    expect(findPath({ x: 16, z: 16 }, { x: inn.x, z: inn.z })).toBeNull();
  });

  it("囲まれたゴールには到達できないこと", () => {
    // (5,5) の四方を塞いだカスタム歩行判定
    const blocked = new Set(["4,5", "6,5", "5,4", "5,6"]);
    const path = findPath({ x: 0, z: 0 }, { x: 5, z: 5 }, {
      isWalkable: (x, z) =>
        x >= 0 && z >= 0 && x < 10 && z < 10 && !blocked.has(`${x},${z}`),
      cost: () => 1,
    });
    expect(path).toBeNull();
  });

  it("経路が建物占有マスを一切通らないこと", () => {
    const start = { x: 5, z: 29 };
    const goal = { x: 26, z: 5 };
    const path = findPath(start, goal);
    expect(path).not.toBeNull();
    for (const cell of path!) {
      expect(isWalkable(cell.x, cell.z), `${cell.x},${cell.z}`).toBe(true);
    }
    // 経路は隣接マスの連続であること
    for (let i = 1; i < path!.length; i++) {
      const d =
        Math.abs(path![i].x - path![i - 1].x) + Math.abs(path![i].z - path![i - 1].z);
      expect(d).toBe(1);
    }
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(goal);
  });

  it("道を優先し、草地の直行より総コストが安くなること", () => {
    // 民家1入口 (5,29) → 農場入口 (5,6): x=6 の縦道がある
    const start = { x: 5, z: 29 };
    const goal = { x: 5, z: 6 };
    const path = findPath(start, goal);
    expect(path).not.toBeNull();
    const roadCells = path!.filter((c) => isRoad(c.x, c.z)).length;
    expect(roadCells).toBeGreaterThan(path!.length / 2);
    // 草地を真っ直ぐ進む経路 (全マス草コスト) より安いこと
    const straightCost = (29 - 6) * 3;
    expect(computePathCost(path!)).toBeLessThan(straightCost);
  });

  it("カスタムコストでも最短経路が返ること", () => {
    const path = findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, {
      isWalkable: (x, z) => x >= 0 && z >= 0 && x < 5 && z < 5,
      cost: () => 1,
    });
    expect(path).toHaveLength(3);
  });
});
