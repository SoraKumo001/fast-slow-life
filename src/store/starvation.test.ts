import { describe, it, expect } from "vitest";

import { FOOD_CONSUMPTION_PER_VILLAGER } from "../constants";
import type { Villager } from "../types/game";
import { processStarvation } from "./starvation";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
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
    order: "gather",
    status: "active",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    potionCount: 0,
    gold: 0,
    pool: {},
    isStarving: false,
    activeFoodBuffId: null,
    ...overrides,
  } as Villager;
}

describe("starvation", () => {
  describe("processStarvation (Villager[] 版)", () => {
    it("貧困村人(gold=199)は安価な食料を優先して消費すること", () => {
      // isPoor=true (currentJob="農民", gold=199 < 200)
      // 貧困優先順位: wheat → vegetable → raw_meat → food_bread → ...
      // food_dragon_hotpot と food_bread が両方ある場合、food_bread が先に消費される
      const v = makeVillager({ gold: 199 });
      const result = processStarvation({ food_dragon_hotpot: 10, food_bread: 10 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_bread");
    });

    it("非貧困村人(gold=200)は高級料理を優先して消費すること", () => {
      // isPoor=false (gold=200 >= 200)
      // 非貧困優先順位: food_dragon_hotpot → ...
      // food_dragon_hotpot price=120, gold=200 >= 120 → canAfford=true
      const v = makeVillager({ gold: 200 });
      const result = processStarvation({ food_dragon_hotpot: 10, food_bread: 10 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_dragon_hotpot");
    });

    it("非貧困だが所持金不足(gold=50)はcanAfford判定で高級料理を回避すること", () => {
      // isPoor=false, food_dragon_hotpot price=120, gold=50 < 120 → canAfford=false
      // food_bread price=3 <= 4 → canAfford=true
      const v = makeVillager({ gold: 50 });
      const result = processStarvation({ food_dragon_hotpot: 10, food_bread: 10 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_bread");
    });

    it("canAfford境界値: 貧困村人でprice>4の料理はgold>=priceで消費可、gold<priceで不可であること", () => {
      // food_dried_meat basePrice=8, price=8 > 4
      // food_bread がない状態で food_dried_meat のみ
      // 貧困優先順位: wheat → vegetable → raw_meat → food_bread → food_dried_meat → ...
      // wheat, vegetable, raw_meat, food_bread はない → food_dried_meat に到達
      const inventory = { food_dried_meat: 10 };

      // gold=8 → canAfford=true
      const v8 = makeVillager({ id: "v8", gold: 8 });
      const r8 = processStarvation({ ...inventory }, [v8]);
      expect((r8.villagers as Villager[])[0].activeFoodBuffId).toBe("food_dried_meat");
      expect((r8.villagers as Villager[])[0].isStarving).toBe(false);

      // gold=7 → canAfford=false → 飢餓
      const v7 = makeVillager({ id: "v7", gold: 7 });
      const r7 = processStarvation({ ...inventory }, [v7]);
      expect((r7.villagers as Villager[])[0].isStarving).toBe(true);
    });

    it("price<=4の食料は所持金0でも消費可能であること", () => {
      // food_bread basePrice=3, price=3 <= 4 → canAfford=true
      const v = makeVillager({ gold: 0, currentJob: "農民" });
      const result = processStarvation({ food_bread: 10 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_bread");
    });

    it("複数の生食材を組み合わせて消費できること", () => {
      // 単一の生食材では足りないが、組み合わせれば足りる場合
      // raw_meat(0.02) + vegetable(0.02) + wheat(0.02) = 0.06 >= 1/24 ≈ 0.0417
      const v = makeVillager({ gold: 0 });
      const result = processStarvation({ raw_meat: 0.02, vegetable: 0.02, wheat: 0.02 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].isStarving).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBeNull();
    });

    it("生食材が完全に不足している場合は飢餓状態になること", () => {
      const v = makeVillager({ gold: 0 });
      const result = processStarvation({ wheat: 0.01 }, [v]);

      expect(result.hasStarvation).toBe(true);
      expect((result.villagers as Villager[])[0].isStarving).toBe(true);
    });

    it("消費可能な食料が一切ない場合は飢餓状態になること", () => {
      const v = makeVillager({ gold: 0 });
      const result = processStarvation({}, [v]);

      expect(result.hasStarvation).toBe(true);
      expect((result.villagers as Villager[])[0].isStarving).toBe(true);
    });

    it("生食材を消費した場合はactiveFoodBuffIdがnullになること", () => {
      const v = makeVillager({ gold: 0 });
      const result = processStarvation({ wheat: 10 }, [v]);

      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBeNull();
    });

    it("料理を消費した場合はactiveFoodBuffIdがその料理IDになること", () => {
      // food_beast_roast basePrice=35, gold=200 >= 35 → canAfford=true
      const v = makeVillager({ gold: 200 });
      const result = processStarvation({ food_beast_roast: 10 }, [v]);

      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_beast_roast");
    });

    it("無職村人はisPoor=falseになるが所持金不足なら高級料理は消費できないこと", () => {
      // 無職は isPoor=false → 非貧困と同じ優先順位
      // food_dragon_hotpot price=120, gold=0 < 120 → canAfford=false
      // food_bread price=3 <= 4 → canAfford=true
      const v = makeVillager({ gold: 0, currentJob: "無職" });
      const result = processStarvation({ food_dragon_hotpot: 10, food_bread: 10 }, [v]);

      expect(result.hasStarvation).toBe(false);
      expect((result.villagers as Villager[])[0].activeFoodBuffId).toBe("food_bread");
    });

    it("複数村人がいて一部が飢餓の場合、hasStarvationがtrueになること", () => {
      const v1 = makeVillager({ id: "v1", gold: 200 });
      const v2 = makeVillager({ id: "v2", gold: 0 });
      // v1 は非貧困で food_dragon_hotpot を消費
      // v2 は貧困で food_dragon_hotpot の canAfford=false、他の食料なし → 飢餓
      const result = processStarvation({ food_dragon_hotpot: 10 }, [v1, v2]);

      expect(result.hasStarvation).toBe(true);
      const villagers = result.villagers as Villager[];
      expect(villagers[0].isStarving).toBe(false);
      expect(villagers[1].isStarving).toBe(true);
    });
  });

  describe("processStarvation (number 版)", () => {
    it("高級料理が十分にある場合、優先的に消費されること", () => {
      // food_dragon_hotpot が 10 個、村人3人
      // foodConsumed = 3 * (1/24) = 0.125
      // 10 >= 0.125 なので消費される
      const result = processStarvation({ food_dragon_hotpot: 10 }, 3);

      expect(result.hasStarvation).toBe(false);
      expect(result.activeFoodBuffId).toBe("food_dragon_hotpot");
      expect(result.inventory.food_dragon_hotpot).toBeCloseTo(
        10 - 3 * FOOD_CONSUMPTION_PER_VILLAGER,
        5,
      );
    });

    it("食料が一切ない場合は飢餓状態になること", () => {
      const result = processStarvation({}, 3);

      expect(result.hasStarvation).toBe(true);
      expect(result.activeFoodBuffId).toBeNull();
    });
  });
});
