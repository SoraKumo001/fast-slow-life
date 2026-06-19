import { describe, it, expect } from "vitest";
import {
  processStarvation,
  processExploration,
  processRespawns,
  processVillagerActivities,
} from "./gameLoopHelper";
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
      expect(dungeons[0].explorationProgress).toBeGreaterThan(50);
      expect(logs.length).toBe(0);
    });
  });

  describe("processRespawns", () => {
    it("リスポーン残り時間が減少すること、0未満にならないこと", () => {
      const dungeons: DungeonArea[] = [
        {
          id: "forest",
          name: "始まりの森",
          distance: 1,
          recommendedLevel: 1,
          unlockedAtTier: 1,
          gathers: [
            {
              itemId: "food",
              difficulty: 1.0,
              respawnTimeLeft: 2,
              respawnTimeTotal: 3,
              currentProgress: 0,
            },
            {
              itemId: "wood",
              difficulty: 1.0,
              respawnTimeLeft: 0,
              respawnTimeTotal: 3,
              currentProgress: 0,
            },
          ],
          monsters: [
            {
              id: "goblin",
              name: "ゴブリン",
              level: 1,
              hp: 30,
              maxHp: 30,
              atk: 5,
              def: 2,
              mdef: 1,
              expReward: 10,
              drops: [],
              respawnTimeLeft: 1,
              respawnTimeTotal: 4,
              currentProgress: 0,
            },
          ],
          explorationProgress: 100,
          difficulty: 1.0,
        },
      ];

      const updated = processRespawns(dungeons);
      expect(updated[0].gathers[0].respawnTimeLeft).toBe(1);
      expect(updated[0].gathers[1].respawnTimeLeft).toBe(0);
      expect(updated[0].monsters[0].respawnTimeLeft).toBe(0);
    });
  });

  describe("processVillagerActivities - Progress & Respawn", () => {
    it("採取ゲージが増加し、100%に達するとアイテムを獲得してリスポーンクールダウンに入ること", () => {
      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "農民",
          jobHistory: ["農民"],
          maxHp: 100,
          currentHp: 100,
          stamina: 100,
          str: 10,
          int: 10,
          dex: 100, // 高いDEXで一気に採取完了させる
          agi: 10,
          vit: 10,
          weaponId: "none",
          armorId: "none",
          order: "gather",
          status: "active",
          destinationAreaId: "forest",
          travelTimeLeft: 0,
          assignedCraftJobId: null,
          targetGatherItemId: "food",
          targetMonsterId: null,
        },
      ];

      const dungeons: DungeonArea[] = [
        {
          id: "forest",
          name: "始まりの森",
          distance: 1,
          recommendedLevel: 1,
          unlockedAtTier: 1,
          gathers: [
            {
              itemId: "food",
              difficulty: 1.0,
              currentProgress: 90,
              respawnTimeLeft: 0,
              respawnTimeTotal: 3,
            },
          ],
          monsters: [],
          explorationProgress: 100,
          difficulty: 1.0,
        },
      ];

      const result = processVillagerActivities(
        villagers,
        dungeons,
        {
          inn: {
            id: "inn",
            name: "宿屋",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          workshop: {
            id: "workshop",
            name: "加工工房",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          blacksmith: {
            id: "blacksmith",
            name: "鍛冶屋",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          alchemy: {
            id: "alchemy",
            name: "錬金工房",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          market: {
            id: "market",
            name: "交易所",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          guild: {
            id: "guild",
            name: "冒険者ギルド",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
        },
        {},
        10,
        { food: 100 },
        null,
        false,
        false,
        {},
        500,
      );

      // アイテムが獲得され、リスポーン中になり、進捗が0に戻る
      expect(result.inventory["food"]).toBeGreaterThan(0);
      expect(result.dungeons[0].gathers[0].respawnTimeLeft).toBe(3);
      expect(result.dungeons[0].gathers[0].currentProgress).toBe(0);
    });
  });
});
