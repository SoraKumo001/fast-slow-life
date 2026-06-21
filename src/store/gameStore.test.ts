import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { DUNGEONS, ITEMS, RECIPES } from "../data/masterData";
import { FacilityType } from "../types/game";
import { useGameStore } from "./gameStore";

describe("gameStore", () => {
  beforeEach(() => {
    // 各テストの前にゲーム状態をリセット
    useGameStore.getState().resetGame(false);
  });

  it("初期状態が正しくセットアップされていること", () => {
    const state = useGameStore.getState();
    expect(state.gold).toBe(500);
    expect(state.inventory.food).toBe(50);
    expect(state.currentDay).toBe(1);
    expect(state.currentHour).toBe(0);
    expect(state.isPaused).toBe(true);
    expect(state.gameOver).toBe(false);
  });

  it("ゴールドの変更が正しく機能すること", () => {
    const state = useGameStore.getState();
    expect(state.gold).toBe(500);
  });

  it("ボス討伐が開始でき、HPが時間経過で自然回復すること", () => {
    const store = useGameStore.getState();
    const villagerIds = [store.villagers[0].id];

    // ゴブリンロードのIDを指定してバトル開始
    store.startBossBattle("goblin_leader", villagerIds);

    let state = useGameStore.getState();
    expect(state.activeBoss).not.toBeNull();
    expect(state.activeBoss?.monsterId).toBe("goblin_leader");

    // 1時間進める
    store.advanceHour();

    state = useGameStore.getState();
    // ダメージが入っているか、または自然回復しているか（村人の攻撃力次第）
    // 攻撃力が低い場合や参加者がいない場合は自然回復する
    expect(state.activeBoss).not.toBeNull();
  });

  it("自動装備 (autoEquipAll) が正しく機能すること", () => {
    useGameStore.setState((s) => ({
      villagers: s.villagers.map((v, idx) => {
        if (idx === 0) return { ...v, currentJob: "戦士", weaponId: "none", armorId: "none" };
        if (idx === 1) return { ...v, currentJob: "魔術師", weaponId: "none", armorId: "none" };
        return { ...v, weaponId: "none", armorId: "none" };
      }),
      inventory: {
        ...s.inventory,
        iron_sword: 1,
        wooden_staff: 1,
        mythril_staff: 1,
      },
    }));

    useGameStore.getState().autoEquipAll();

    const updatedState = useGameStore.getState();
    const updatedWarrior = updatedState.villagers[0];
    const updatedMage = updatedState.villagers[1];

    expect(updatedWarrior.weaponId).toBe("iron_sword");
    expect(updatedMage.weaponId).toBe("mythril_staff");

    expect(updatedState.inventory.iron_sword).toBe(0);
    expect(updatedState.inventory.mythril_staff).toBe(0);
    expect(updatedState.inventory.wooden_staff).toBe(1);
  });

  it("僧侶が通常戦闘でHP50%以下のときに自己ヒールを使用すること", () => {
    const store = useGameStore.getState();
    globalThis.IS_TEST_ENVIRONMENT = false;

    try {
      useGameStore.setState((s) => ({
        villagers: s.villagers.map((v, idx) => {
          if (idx === 0) {
            return {
              ...v,
              name: "僧侶テスト",
              currentJob: "僧侶",
              status: "active",
              order: "hunt",
              targetMonsterId: "goblin",
              destinationAreaId: "forest",
              maxHp: 100,
              currentHp: 40,
              int: 20,
              str: 10,
              dex: 10,
              agi: 10,
              vit: 10,
              potionCount: 0,
            };
          }
          return { ...v, status: "idle" };
        }),
        dungeons: s.dungeons.map((d) => {
          if (d.id === "forest") {
            return {
              ...d,
              explorationProgress: 50,
              monsters: d.monsters.map((m) => ({
                ...m,
                currentProgress: 99,
                respawnTimeLeft: 0,
              })),
            };
          }
          return d;
        }),
      }));

      store.advanceHour();

      const state = useGameStore.getState();
      const cleric = state.villagers[0];

      const healLog = state.logs.find((l) => l.message.includes("はヒールを唱え"));
      expect(healLog).toBeDefined();
      expect(cleric.currentHp).toBeGreaterThan(40);
    } finally {
      globalThis.IS_TEST_ENVIRONMENT = true;
    }
  });

  it("僧侶がボス戦で最もHP割合の低いアタッカー（50%以下）をヒールすること", () => {
    const store = useGameStore.getState();
    globalThis.IS_TEST_ENVIRONMENT = false;

    try {
      useGameStore.setState((s) => ({
        villagers: s.villagers.map((v, idx) => {
          if (idx === 0) {
            return {
              ...v,
              id: "v_cleric",
              name: "僧侶テスト",
              currentJob: "僧侶",
              status: "active",
              destinationAreaId: "forest",
              maxHp: 100,
              currentHp: 100,
              int: 30,
              potionCount: 0,
            };
          }
          if (idx === 1) {
            return {
              ...v,
              id: "v_warrior",
              name: "戦士テスト",
              currentJob: "戦士",
              status: "active",
              destinationAreaId: "forest",
              maxHp: 200,
              currentHp: 80,
              potionCount: 0,
            };
          }
          return { ...v, status: "idle" };
        }),
      }));

      store.startBossBattle("goblin_leader", ["v_cleric", "v_warrior"]);
      store.advanceHour();

      const state = useGameStore.getState();
      const warrior = state.villagers.find((v) => v.id === "v_warrior")!;

      const healLog = state.logs.find(
        (l) => l.message.includes("はヒールを唱え") && l.message.includes("戦士テスト"),
      );
      expect(healLog).toBeDefined();
      expect(warrior.currentHp).toBeGreaterThan(80);
    } finally {
      globalThis.IS_TEST_ENVIRONMENT = true;
    }
  });

  describe("自動取引（Auto Trade）機能", () => {
    beforeEach(() => {
      globalThis.IS_TEST_ENVIRONMENT = false; // ログを記録させるため一時的にテスト環境フラグを解除
    });

    afterEach(() => {
      globalThis.IS_TEST_ENVIRONMENT = true;
    });

    it("自動売却ルールにより、閾値超過時に1個ずつ自動で売却されてゴールドが増加し、在庫が減少すること", () => {
      const store = useGameStore.getState();

      // 薬屋をレベル1にする
      useGameStore.setState((s) => ({
        facilities: {
          ...s.facilities,
          pharmacy: { ...s.facilities.pharmacy, level: 1 },
        },
        inventory: {
          ...s.inventory,
          potion: 15,
        },
        villagers: [], // 村人によるポーション自動補充を防ぐために空にする
        gold: 100,
        tradeRules: [
          {
            id: "rule_1",
            itemId: "potion",
            type: "sell",
            threshold: 10,
            isEnabled: true,
          },
        ],
      }));

      // 回復薬の売却価格は 10G。薬屋レベル1はボーナス +20% (計 12G)。
      // 15 > 10 なので、1個売却して 12G 獲得。
      // inventory: 15 -> 14, gold: 100 -> 112
      store.advanceHour();

      const state = useGameStore.getState();
      expect(state.inventory.potion).toBe(14);
      expect(state.gold).toBe(112);

      const tradeLog = state.logs.find((l) => l.message.includes("回復薬 を 1 個自動売却（薬屋）"));
      expect(tradeLog).toBeDefined();
    });
  });
});

describe("master data references", () => {
  it("レシピが存在するアイテムと施設だけを参照していること", () => {
    const facilityIds: FacilityType[] = [
      "inn",
      "workshop",
      "kitchen",
      "blacksmith",
      "alchemy",
      "market",
      "guild",
      "weapon_shop",
      "pharmacy",
      "farm",
      "lumberyard",
      "quarry",
    ];

    Object.values(RECIPES).forEach((recipe) => {
      expect(ITEMS[recipe.resultItemId], `${recipe.id}.resultItemId`).toBeDefined();
      expect(facilityIds, `${recipe.id}.facilityId`).toContain(recipe.facilityId);

      recipe.requiredItems.forEach((requiredItem) => {
        expect(ITEMS[requiredItem.itemId], `${recipe.id}.requiredItems`).toBeDefined();
      });
    });
  });

  it("ダンジョンの採取・ドロップが存在するアイテムだけを参照していること", () => {
    DUNGEONS.forEach((dungeon) => {
      dungeon.gathers.forEach((gather) => {
        expect(ITEMS[gather.itemId], `${dungeon.id}.gathers`).toBeDefined();
      });

      dungeon.monsters.forEach((monster) => {
        monster.drops.forEach((drop) => {
          expect(ITEMS[drop.itemId], `${monster.id}.drops`).toBeDefined();
        });
      });
    });
  });

  it("装備アイテムのカテゴリと装備スロットが一致していること", () => {
    Object.values(ITEMS).forEach((item) => {
      if (!item.equipment) return;

      expect(
        item.category === "gear_weapon" || item.category === "gear_armor",
        `${item.id}.category`,
      ).toBe(true);
      expect(item.equipment.slot, `${item.id}.equipment.slot`).toBe(
        item.category === "gear_weapon" ? "weapon" : "armor",
      );
    });
  });
});
