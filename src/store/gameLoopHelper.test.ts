import { describe, it, expect } from "vitest";

import { DungeonArea, Villager, Facility, FacilityType } from "../types/game";
import {
  processStarvation,
  processExploration,
  processRespawns,
  processVillagerActivities,
  processCraftingAndUpgrades,
} from "./gameLoopHelper";

describe("gameLoopHelper", () => {
  describe("processStarvation", () => {
    it("十分な食料がある場合、食料が減少し、飢餓状態にならないこと", () => {
      const villagersCount = 3;
      const inventory = { food: 10 };
      const { inventory: resultInv, hasStarvation } = processStarvation(inventory, villagersCount);

      expect(hasStarvation).toBe(false);
      expect(resultInv.food).toBe(10 - villagersCount * (1.0 / 24.0));
    });

    it("食料が不足している場合、食料が0になり、飢餓状態になること", () => {
      const villagersCount = 24;
      const inventory = { food: 0.5 };
      const { inventory: resultInv, hasStarvation } = processStarvation(inventory, villagersCount);

      expect(hasStarvation).toBe(true);
      expect(resultInv.food).toBe(0);
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
          maxStamina: 100,
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
          potionCount: 0,
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
              str: 5,
              int: 5,
              dex: 10,
              agi: 5,
              vit: 5,
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
          maxStamina: 100,
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
          potionCount: 0,
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
          kitchen: {
            id: "kitchen",
            name: "調理場",
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
          weapon_shop: {
            id: "weapon_shop",
            name: "武器屋",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
          pharmacy: {
            id: "pharmacy",
            name: "薬屋",
            level: 1,
            maxLevel: 5,
            upgradeTimeLeft: 0,
            upgradeTotalTime: 0,
            upgradeCost: { gold: 0, materials: [] },
            craftQueue: [],
          },
        },
        {},
        { food: 100 },
        null,
        false,
        false,
        {},
        500,
      );

      expect(result.inventory["food"]).toBeGreaterThan(0);
      expect(result.dungeons[0].gathers[0].respawnTimeLeft).toBe(3);
      expect(result.dungeons[0].gathers[0].currentProgress).toBe(0);
    });
  });

  describe("processVillagerActivities - Potion Auto Use & Return", () => {
    const mockFacilities = {
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
      kitchen: {
        id: "kitchen",
        name: "調理場",
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
      weapon_shop: {
        id: "weapon_shop",
        name: "武器屋",
        level: 1,
        maxLevel: 5,
        upgradeTimeLeft: 0,
        upgradeTotalTime: 0,
        upgradeCost: { gold: 0, materials: [] },
        craftQueue: [],
      },
      pharmacy: {
        id: "pharmacy",
        name: "薬屋",
        level: 1,
        maxLevel: 5,
        upgradeTimeLeft: 0,
        upgradeTotalTime: 0,
        upgradeCost: { gold: 0, materials: [] },
        craftQueue: [],
      },
    } as Record<FacilityType, Facility>;

    it("帰還完了した村人のポーションが倉庫に返却されること", () => {
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
          maxStamina: 100,
          str: 10,
          int: 10,
          dex: 10,
          agi: 10,
          vit: 10,
          weaponId: "none",
          armorId: "none",
          order: "rest",
          status: "traveling_back",
          destinationAreaId: "forest",
          travelTimeLeft: 1,
          assignedCraftJobId: null,
          targetGatherItemId: null,
          targetMonsterId: null,
          potionCount: 2,
        },
      ];

      const inventory = { potion: 5 };
      const result = processVillagerActivities(
        villagers,
        [],
        mockFacilities,
        inventory,
        {},
        null,
        false,
        false,
        {},
        500,
      );

      expect(result.villagers[0].potionCount).toBe(0);
      expect(result.villagers[0].status).toBe("resting");
      expect(result.inventory["potion"]).toBe(7); // 5 + 2
    });

    it("探索中の村人がHP50%以下になった時にポーションを自動使用して回復すること", () => {
      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "農民",
          jobHistory: ["農民"],
          maxHp: 100,
          currentHp: 40, // 50%以下
          stamina: 100,
          maxStamina: 100,
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
          targetGatherItemId: "food",
          targetMonsterId: null,
          potionCount: 2,
        },
      ];

      const dungeons: DungeonArea[] = [
        {
          id: "forest",
          name: "始まりの森",
          distance: 1,
          recommendedLevel: 1,
          unlockedAtTier: 1,
          gathers: [{ itemId: "food", difficulty: 1.0, currentProgress: 0 }],
          monsters: [],
          explorationProgress: 100,
          difficulty: 1.0,
        },
      ];

      const result = processVillagerActivities(
        villagers,
        dungeons,
        mockFacilities,
        {},
        {},
        null,
        false,
        false,
        {},
        500,
      );

      expect(result.villagers[0].potionCount).toBe(1);
      expect(result.villagers[0].currentHp).toBe(90);
    });

    it("討伐で目標達成率が最も低いモンスターが優先してターゲットになること", () => {
      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "戦士",
          jobHistory: ["戦士"],
          maxHp: 100,
          currentHp: 100,
          stamina: 100,
          maxStamina: 100,
          str: 10,
          int: 10,
          dex: 10,
          agi: 100, // 高いAGIで一戦闘進捗を100%にする
          vit: 10,
          weaponId: "none",
          armorId: "none",
          order: "hunt",
          status: "active",
          destinationAreaId: "forest",
          travelTimeLeft: 0,
          assignedCraftJobId: null,
          targetGatherItemId: null,
          targetMonsterId: null,
          potionCount: 0,
        },
      ];

      const dungeons: DungeonArea[] = [
        {
          id: "forest",
          name: "始まりの森",
          distance: 1,
          recommendedLevel: 1,
          unlockedAtTier: 1,
          gathers: [],
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
              str: 5,
              int: 5,
              dex: 10,
              agi: 5,
              vit: 5,
              expReward: 10,
              drops: [{ itemId: "slime_jelly", chance: 1.0 }],
              respawnTimeLeft: 0,
              respawnTimeTotal: 4,
              currentProgress: 90, // 一瞬で戦闘に入るように
            },
            {
              id: "orc",
              name: "オーク",
              level: 1,
              hp: 30,
              maxHp: 30,
              atk: 5,
              def: 2,
              mdef: 1,
              str: 5,
              int: 5,
              dex: 10,
              agi: 5,
              vit: 5,
              expReward: 10,
              drops: [{ itemId: "meat", chance: 1.0 }],
              respawnTimeLeft: 0,
              respawnTimeTotal: 4,
              currentProgress: 90,
            },
          ],
          explorationProgress: 100,
          difficulty: 1.0,
        },
      ];

      // 目標設定: slime_jelly=10, meat=10
      // 所持数: slime_jelly=8 (80%), meat=2 (20%)
      // オーク（meatをドロップ）が優先されるはず
      const inventory = { slime_jelly: 8, meat: 2 };
      const targetAmounts = { slime_jelly: 10, meat: 10 };

      const result = processVillagerActivities(
        villagers,
        dungeons,
        mockFacilities,
        inventory,
        targetAmounts,
        null,
        false,
        false,
        {},
        500,
      );

      // オークが選ばれて、autoTargetNameが「オーク」になること
      expect(result.villagers[0].autoTargetName).toBe("オーク");
    });

    it("戦闘でHPが0になった村人が、ロストせず強制帰還状態になること", () => {
      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "戦士",
          jobHistory: ["戦士"],
          maxHp: 100,
          currentHp: 40,
          stamina: 100,
          maxStamina: 100,
          str: 10,
          int: 10,
          dex: 10,
          agi: 10, // 低いAGIで敵の命中率を100%にする（高いと命中率50%になり確率的に失敗する）
          vit: 1,
          weaponId: "none",
          armorId: "none",
          order: "hunt",
          status: "active",
          destinationAreaId: "forest",
          travelTimeLeft: 0,
          assignedCraftJobId: null,
          targetGatherItemId: null,
          targetMonsterId: "strong_monster",
          potionCount: 0,
        },
      ];

      const dungeons: DungeonArea[] = [
        {
          id: "forest",
          name: "始まりの森",
          distance: 3,
          recommendedLevel: 1,
          unlockedAtTier: 1,
          gathers: [],
          monsters: [
            {
              id: "strong_monster",
              name: "強敵",
              level: 10,
              hp: 1000,
              maxHp: 1000,
              atk: 100,
              def: 100,
              mdef: 100,
              str: 50,
              int: 50,
              dex: 50, // 高いDEXで命中率を確保
              agi: 5,
              vit: 50,
              expReward: 100,
              drops: [],
              respawnTimeLeft: 0,
              respawnTimeTotal: 4,
              currentProgress: 99,
            },
          ],
          explorationProgress: 100,
          difficulty: 1.0,
        },
      ];

      const result = processVillagerActivities(
        villagers,
        dungeons,
        mockFacilities,
        {},
        {},
        null,
        false,
        false,
        {},
        500,
      );

      // 村人が削除されていないこと
      expect(result.villagers.length).toBe(1);
      const alpha = result.villagers[0];
      // 状態が強制帰還（traveling_back）になっていること
      expect(alpha.status).toBe("traveling_back");
      // 帰還時間がダンジョンの距離（3）になっていること
      expect(alpha.travelTimeLeft).toBe(3);
      // 次の行動方針が「休息（rest）」になっていること
      expect(alpha.order).toBe("rest");
      // HPが0以下（0）になっていること
      expect(alpha.currentHp).toBe(0);
    });
  });

  describe("processCraftingAndUpgrades", () => {
    it("クラフトジョブの残り時間が減少し、0に達するとアイテムがインベントリに追加されること", () => {
      const facilities = {
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
          craftQueue: [
            {
              id: "job1",
              itemId: "wood",
              timeLeft: 2,
              totalTime: 2,
              assignedVillagerId: "v1",
            },
          ],
        },
        kitchen: {
          id: "kitchen",
          name: "調理場",
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
      } as Record<FacilityType, Facility>;

      const villagers: Villager[] = [
        {
          id: "v1",
          name: "アルフ",
          level: 1,
          exp: 0,
          currentJob: "職人",
          jobHistory: ["職人"],
          maxHp: 100,
          currentHp: 100,
          stamina: 100,
          maxStamina: 100,
          str: 10,
          int: 10,
          dex: 10,
          agi: 10,
          vit: 10,
          weaponId: "none",
          armorId: "none",
          order: "gather",
          status: "active",
          destinationAreaId: null,
          travelTimeLeft: 0,
          assignedCraftJobId: "job1",
          targetGatherItemId: null,
          targetMonsterId: null,
          potionCount: 0,
        },
      ];

      const inventory = {};

      // 1回目の呼び出し: 残り時間が 2 -> 1 に減少し、キューに残るはず
      const res1 = processCraftingAndUpgrades(facilities, villagers, inventory, {});
      expect(res1.facilities.workshop.craftQueue[0].timeLeft).toBe(1);
      expect(res1.inventory["wood"]).toBeUndefined();
      expect(res1.villagers[0].status).toBe("active");

      // 2回目の呼び出し: 残り時間が 1 -> 0 に減少し、キューから削除されてアイテムがインベントリに追加され、村人が解放されるはず
      const res2 = processCraftingAndUpgrades(res1.facilities, res1.villagers, res1.inventory, {});
      expect(res2.facilities.workshop.craftQueue.length).toBe(0);
      expect(res2.inventory["wood"]).toBeGreaterThan(0);
      expect(res2.villagers[0].status).toBe("idle");
      expect(res2.villagers[0].assignedCraftJobId).toBeNull();
    });
  });
});
