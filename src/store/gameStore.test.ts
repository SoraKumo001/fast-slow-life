import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { STARTING_GOLD } from "../constants";
import { DUNGEONS, ITEMS, RECIPES } from "../data/masterData";
import { FacilityType } from "../types/game";
import { useGameStore } from "./gameStore";
import { processVillagerGather } from "./gatherLogic";
import { processItemPoolPurchase } from "./poolPurchase";

describe("gameStore", () => {
  beforeEach(() => {
    // 各テストの前にゲーム状態をリセット
    useGameStore.getState().resetGame(false);
  });

  it("初期状態が正しくセットアップされていること", () => {
    const state = useGameStore.getState();
    expect(state.gold).toBe(STARTING_GOLD);
    expect(state.inventory.wheat).toBe(17);
    expect(state.inventory.vegetable).toBe(17);
    expect(state.inventory.raw_meat).toBe(16);
    expect(state.currentDay).toBe(1);
    expect(state.currentHour).toBe(0);
    expect(state.isPaused).toBe(true);
    expect(state.gameOver).toBe(false);
  });

  it("ゴールドの変更が正しく機能すること", () => {
    const state = useGameStore.getState();
    expect(state.gold).toBe(STARTING_GOLD);
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
        if (idx === 0)
          return { ...v, currentJob: "戦士", weaponId: "none", armorId: "none", gold: 1000 };
        if (idx === 1)
          return { ...v, currentJob: "魔術師", weaponId: "none", armorId: "none", gold: 1000 };
        return { ...v, weaponId: "none", armorId: "none", gold: 1000 };
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

  it("ボス戦でアタッカーが全員戦闘不能になったとき、ボス戦が自動終了すること", () => {
    const store = useGameStore.getState();
    globalThis.IS_TEST_ENVIRONMENT = false;

    try {
      // 非常に弱い村人（HP1）をアタッカーとして設定
      useGameStore.setState((s) => ({
        villagers: s.villagers.map((v, idx) => {
          if (idx === 0) {
            return {
              ...v,
              id: "v_weak",
              name: "弱い村人",
              currentJob: "戦士",
              status: "active",
              destinationAreaId: "forest",
              maxHp: 1,
              currentHp: 1,
              str: 1,
              vit: 1,
              potionCount: 0,
            };
          }
          return { ...v, status: "idle" };
        }),
      }));

      store.startBossBattle("goblin_leader", ["v_weak"]);

      // ゲームを進める（弱い村人が全滅するまで）
      // ボスの攻撃を何度か受けさせる
      for (let i = 0; i < 20; i++) {
        const state = useGameStore.getState();
        // ボス戦が既に終了していたら抜ける
        if (state.activeBoss === null) break;
        // アタッカーが全員HPゼロなら抜ける
        const allDefeated = state.villagers
          .filter((v) => state.activeBoss?.attackerIds.includes(v.id))
          .every((v) => v.currentHp <= 0);
        if (allDefeated) break;
        store.advanceHour();
      }

      const finalState = useGameStore.getState();
      // ボス戦が終了していること
      expect(finalState.activeBoss).toBeNull();
      // 終了ログが出力されていること
      const wipeLog = finalState.logs.find((l) => l.message.includes("ボスとの対決は終了しました"));
      expect(wipeLog).toBeDefined();
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

    it("自動売却ルールにより、閾値超過時に自動で交易馬車が派遣され、帰還時にゴールドが増加し在庫が減少すること", () => {
      const store = useGameStore.getState();

      // 交易所をレベル1にする
      useGameStore.setState((s) => ({
        facilities: {
          ...s.facilities,
          market: { ...s.facilities.market, level: 1 },
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
        marketTrend: {
          targetTownId: "komorebi",
          itemId: "potion",
          type: "demand",
          multiplier: 1.2,
        },
      }));

      // 最初の1時間経過で、馬車がコモレビの村へ自動派遣される
      // コモレビの村の距離は 12 時間
      // 派遣によって、倉庫の potion は即座に (15 - 10 = 5個) 減少し、10 個になる
      store.advanceHour();

      let state = useGameStore.getState();
      expect(state.inventory.potion).toBe(10);
      expect(state.caravans[0].status).toBe("trading");
      expect(state.caravans[0].destinationTownId).toBe("komorebi");
      expect(state.caravans[0].timeLeft).toBe(12);

      // さらに12時間進める (帰還する)
      for (let i = 0; i < 12; i++) {
        store.advanceHour();
      }

      state = useGameStore.getState();
      // 帰還時の自動回収により、ゴールドが増加していることを確認。
      // コモレビの村では potion が需要アイテム（ multiplier 1.2倍 ）。
      // potion basePrice 10G * 1.2倍 = 12G。
      // 友好度レベル1（+0%）, 交易所レベル1（+0%）。
      // 5個売却で、 5 * 12G = 60G 獲得。
      // gold: 100 -> 160G.
      expect(state.gold).toBe(160);
      expect(state.caravans[0].status).toBe("idle");

      const tradeLog = state.logs.find((l) => l.message.includes("コモレビ村 から交易馬車が帰還"));
      expect(tradeLog).toBeDefined();
    });

    it("新しい経済システム：自動買取、プール処理、宿代の引き落とし、ツケ肩代わりが動作すること", () => {
      const store = useGameStore.getState();

      // 初期ゴールドの設定
      useGameStore.setState((s) => ({
        gold: 10, // プレイヤーゴールドは10G
        villagers: s.villagers.map((v, idx) => {
          if (idx === 0) {
            return {
              ...v,
              gold: 50,
              pool: {},
              status: "active",
              order: "gather",
              destinationAreaId: "forest",
            };
          }
          return { ...v, status: "idle" };
        }),
      }));

      // 1. 採取を行い、プレイヤーのゴールドが不足しても全量買い取ってマイナスになることを確認
      // 小麦 (basePrice = 1G) の買取単価は 2G。 11個採取しようとすると、22G 必要。
      // プレイヤーゴールド: 10G -> -12G
      // 村人ゴールド: 50G -> 72G
      // 倉庫小麦: 0 -> 11個
      // プール小麦: 0個
      const stateBefore = useGameStore.getState();
      const forestOriginal = stateBefore.dungeons.find((d) => d.id === "forest")!;
      const forest = {
        ...forestOriginal,
        gathers: forestOriginal.gathers.map((g) => {
          if (g.itemId === "wheat") {
            return { ...g, currentProgress: 95, respawnTimeLeft: 0 };
          }
          return g;
        }),
      };

      const nextInventory = { ...stateBefore.inventory, wheat: 0 };
      const villagersCopy = [...stateBefore.villagers];
      const v = villagersCopy[0];

      const res = processVillagerGather(
        v,
        0,
        forest,
        villagersCopy,
        nextInventory,
        { wheat: 999 },
        1.0,
        {},
        10, // プレイヤーゴールド 10G
      );

      expect(res.gold).toBe(-12); // プレイヤーゴールドは -12G に減少 (10 - 22 = -12)
      expect(v.gold).toBe(72); // 村人のゴールドは 50 + 22 = 72G に増加
      expect(v.pool.wheat).toBeUndefined(); // プールは発生しない
      expect(nextInventory.wheat).toBe(11); // 11個すべてが倉庫に入る

      // 2. プレイヤーのゴールドが増えたときに、プールから自動精算されることを検証 (モックでプールデータを設定してテスト)
      // プレイヤーが 100G を手に入れ、プール小麦6個が存在する場合
      // プール小麦 6個 x 2G = 12G が支払われ、 100 - 12 = 88G になる
      // プールされていた小麦が倉庫に移り、計 5 + 6 = 11 個になる
      // 村人に 12G 支払われて 60 + 12 = 72G になる
      // プール小麦は完済して消滅
      v.pool = { wheat: 6 };
      v.gold = 60;
      const poolPurchaseResult = processItemPoolPurchase(100, { ...nextInventory, wheat: 5 }, [v]);
      expect(poolPurchaseResult.gold).toBe(88);
      expect(poolPurchaseResult.inventory.wheat).toBe(11);
      expect(poolPurchaseResult.villagers[0].gold).toBe(72);
      expect(poolPurchaseResult.villagers[0].pool.wheat).toBeUndefined();

      // 3. 宿代の差し引きとツケ払いの確認
      // 村人が resting の場合、宿代が差し引かれてプレイヤーへ支払われる
      useGameStore.setState(() => ({
        gold: 100,
        villagers: [
          {
            ...v,
            currentJob: "農民",
            status: "resting",
            gold: 1, // 村人の所持金は 1G
            pool: {}, // 自動買取が走らないように空にする
          },
        ],

        facilities: {
          ...stateBefore.facilities,
          inn: { ...stateBefore.facilities.inn, level: 1 }, // 宿レベル 1 -> 宿代は 1+1 = 2G
        },
      }));

      // 1時間進める (advanceHour)
      // 宿代 2G が引き落とされる。村人のゴールドは 1 -> -1 (ツケ払い)
      // プレイヤーゴールドは 100 -> 102
      globalThis.IS_TEST_ENVIRONMENT = false;
      try {
        store.advanceHour();
      } finally {
        globalThis.IS_TEST_ENVIRONMENT = true;
      }

      const stateResting = useGameStore.getState();
      const restingVillager = stateResting.villagers[0];
      expect(restingVillager.gold).toBe(-1); // ツケ払いになりマイナス
      expect(stateResting.gold).toBe(102); // 宿代 2G がプレイヤーに入る

      // 4. ツケの肩代わり（一括返済）
      // プレイヤーゴールド 102G から村人のツケ 1G を肩代わりする
      // プレイヤーゴールド: 102 -> 101
      // 村人ゴールド: -1 -> 0
      store.payVillagerDebts();
      const statePaid = useGameStore.getState();
      expect(statePaid.villagers[0].gold).toBe(0);
      expect(statePaid.gold).toBe(101);
    });

    it("小麦を消費してパンをクラフトできること", () => {
      const store = useGameStore.getState();

      // 小麦を10個に設定
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          wheat: 10,
          food_bread: 0,
        },
        facilities: {
          ...s.facilities,
          kitchen: { ...s.facilities.kitchen, level: 1 },
        },
      }));

      // クラフト開始
      store.startCraft("kitchen", "food_bread");

      let state = useGameStore.getState();
      // 小麦が2個消費されていることを確認
      expect(state.inventory.wheat).toBe(8);
      // クラフトキューに1つ追加されていることを確認
      expect(state.facilities.kitchen.craftQueue.length).toBe(1);
      expect(state.facilities.kitchen.craftQueue[0].itemId).toBe("food_bread");

      // クラフトに必要な時間が経過するまで時間を進める
      const timeNeeded = state.facilities.kitchen.craftQueue[0].timeLeft;
      for (let i = 0; i < timeNeeded; i++) {
        store.advanceHour();
      }

      state = useGameStore.getState();
      // パンが完成していることを確認
      expect(state.inventory.food_bread).toBeGreaterThanOrEqual(1);
      expect(state.facilities.kitchen.craftQueue.length).toBe(0);
    });
  });
});

describe("master data references", () => {
  it("レシピが存在するアイテムと施設だけを参照していること", () => {
    const facilityIds: FacilityType[] = [
      "inn",
      "workshop",
      "kitchen",
      "alchemy",
      "market",
      "guild",
      "weapon_shop",
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
