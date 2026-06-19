import { describe, it, expect } from "vitest";
import { processStarvation, processExploration } from "./gameLoopHelper";
import { DungeonArea, Villager } from "../types/game";

describe("gameLoopHelper", () => {
  describe("processStarvation", () => {
    it("十分な食料がある場合、食料が減少し、飢餓状態にならないこと", () => {
      const villagersCount = 3;
      const initialFood = 10;
      const { nextFood, hasStarvation } = processStarvation(initialFood, villagersCount);

      expect(hasStarvation).toBe(false);
      expect(nextFood).toBe(initialFood - villagersCount * (1.0 / 24.0));
    });

    it("食料が不足している場合、食料が0になり、飢餓状態になること", () => {
      const villagersCount = 24; // 1時間あたり 1 消費
      const initialFood = 0.5; // 1未満
      const { nextFood, hasStarvation } = processStarvation(initialFood, villagersCount);

      expect(hasStarvation).toBe(true);
      expect(nextFood).toBe(0);
    });
  });

  describe("processExploration", () => {
    const mockDungeons: DungeonArea[] = [
      {
        id: "forest",
        name: "始まりの森",
        distance: 1,
        recommendedLevel: 1,
        unlockedAtTier: 1,
        gathers: [],
        monsters: [],
        explorationProgress: 50,
        difficulty: 1.0,
      },
    ];

    it("派遣されている村人がいない場合、探索度が増加しないこと", () => {
      const villagers: Villager[] = [];
      const { dungeons, logs } = processExploration(mockDungeons, villagers, 1);

      expect(dungeons[0].explorationProgress).toBe(50);
      expect(logs.length).toBe(0);
    });

    it("派遣されている村人がいる場合、探索度が増加すること", () => {
      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "無職",
          jobHistory: ["無職"],
          maxHp: 100,
          currentHp: 100,
          stamina: 100,
          str: 10,
          int: 10,
          dex: 10,
          agi: 10,
          vit: 10,
          weaponId: "none",
          armorId: "none",
          order: "gather",
          status: "active",
          destinationAreaId: "forest",
          travelTimeLeft: 0,
          assignedCraftJobId: null,
          targetGatherItemId: null,
          targetMonsterId: null,
        },
      ];

      const { dungeons, logs } = processExploration(mockDungeons, villagers, 1);
      // dex 10, agi 10 -> hourlyGain = (10 * 0.2 + 10 * 0.2) / 1.0 / 24.0 = 4.0 / 24.0 = 0.1666...
      expect(dungeons[0].explorationProgress).toBeGreaterThan(50);
      expect(logs.length).toBe(0);
    });
  });
});
