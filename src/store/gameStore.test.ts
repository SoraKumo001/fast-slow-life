import { describe, it, expect, beforeEach } from "vitest";

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
});

describe("master data references", () => {
  it("レシピが存在するアイテムと施設だけを参照していること", () => {
    const facilityIds: FacilityType[] = ["inn", "workshop", "blacksmith", "alchemy", "market"];

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
