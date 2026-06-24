import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Villager } from "../types/game";
import {
  getFoodBuffBonus,
  applySalaryDebuff,
  calculateHitRate,
  calculateCritRate,
  calculatePlayerDamage,
  calculateEnemyDamage,
  useBattlePotion,
  executePlayerAttack,
  executeEnemyAttack,
} from "./combatEngine";

function makeVillager(overrides: Partial<Villager> = {}): Villager {
  return {
    id: "v1",
    name: "テスト村人",
    level: 1,
    exp: 0,
    maxHp: 100,
    currentHp: 100,
    stamina: 100,
    maxStamina: 100,
    str: 10,
    int: 10,
    dex: 10,
    agi: 10,
    vit: 10,
    currentJob: "農民",
    jobHistory: ["農民"],
    weaponId: "none",
    armorId: "none",
    order: "gather",
    status: "active",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    potionCount: 0,
    staminaDrinkCount: 0,
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    activeFoodBuffId: null,
    gold: 0,
    pool: {},
    isStarving: false,
    ...overrides,
  };
}

describe("combatEngine", () => {
  describe("getFoodBuffBonus", () => {
    it("buffIdがnullの場合は0を返すこと", () => {
      expect(getFoodBuffBonus(null, "str")).toBe(0);
    });

    it("存在する料理buffの該当ステータスを返すこと", () => {
      expect(getFoodBuffBonus("food_dried_meat", "str")).toBe(3);
      expect(getFoodBuffBonus("food_herb_salad", "int")).toBe(3);
      expect(getFoodBuffBonus("food_sandwich", "dex")).toBe(3);
    });

    it("存在する料理buffだが未設定のステータスは0を返すこと", () => {
      expect(getFoodBuffBonus("food_dried_meat", "int")).toBe(0);
      expect(getFoodBuffBonus("food_herb_salad", "str")).toBe(0);
    });

    it("存在しないbuffIdは0を返すこと", () => {
      expect(getFoodBuffBonus("nonexistent_food", "str")).toBe(0);
    });

    it("maxHp・maxStaminaのbuffも正しく返すこと", () => {
      expect(getFoodBuffBonus("food_dragon_hotpot", "maxHp")).toBe(50);
      expect(getFoodBuffBonus("food_dragon_hotpot", "maxStamina")).toBe(30);
    });
  });

  describe("applySalaryDebuff", () => {
    it("未支給でない場合は値をそのまま返すこと", () => {
      expect(applySalaryDebuff(100, false)).toBe(100);
      expect(applySalaryDebuff(0, false)).toBe(0);
      expect(applySalaryDebuff(-10, false)).toBe(-10);
    });

    it("未支給の場合は80%に切り捨てて返すこと", () => {
      expect(applySalaryDebuff(100, true)).toBe(80);
      expect(applySalaryDebuff(10, true)).toBe(8);
      expect(applySalaryDebuff(0, true)).toBe(0);
    });

    it("未支給で負の値の場合も80%に切り捨てること", () => {
      expect(applySalaryDebuff(-10, true)).toBe(-8);
    });
  });

  describe("calculateHitRate", () => {
    it("DEXとAGIが同値の場合は基礎命中率を返すこと", () => {
      expect(calculateHitRate(10, 10)).toBe(85);
    });

    it("DEXが高いと命中率が上がること", () => {
      expect(calculateHitRate(20, 10)).toBe(100);
      expect(calculateHitRate(15, 10)).toBe(92.5);
    });

    it("AGIが高いと命中率が下がること", () => {
      expect(calculateHitRate(10, 20)).toBe(70);
      expect(calculateHitRate(10, 30)).toBe(55);
    });

    it("命中率は下限50%にクランプされること", () => {
      expect(calculateHitRate(0, 50)).toBe(50);
      expect(calculateHitRate(10, 100)).toBe(50);
    });

    it("命中率は上限100%にクランプされること", () => {
      expect(calculateHitRate(100, 0)).toBe(100);
      expect(calculateHitRate(20, 0)).toBe(100);
    });

    it("0対0の場合は基礎命中率を返すこと", () => {
      expect(calculateHitRate(0, 0)).toBe(85);
    });
  });

  describe("calculateCritRate", () => {
    it("DEXが0の場合は0%を返すこと", () => {
      expect(calculateCritRate(0)).toBe(0);
    });

    it("DEXに応じてクリティカル率が上がること", () => {
      expect(calculateCritRate(10)).toBe(1);
      expect(calculateCritRate(100)).toBe(10);
      expect(calculateCritRate(250)).toBe(25);
    });

    it("クリティカル率は上限30%にクランプされること", () => {
      expect(calculateCritRate(300)).toBe(30);
      expect(calculateCritRate(500)).toBe(30);
    });
  });

  describe("calculatePlayerDamage", () => {
    it("物理攻撃の基本ダメージを計算すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      // defenderDef = 2 + 2*0.5 = 3
      // baseDamage = 10*1.5 - 3 = 12
      expect(damage).toBe(12);
    });

    it("クリティカル時は防御を無視してダメージが増加すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: true,
        efficiency: 1.0,
        isMagicUser: false,
      });
      // defenderDef = (2 + 1) * 0.5 = 1.5
      // baseDamage = 15 - 1.5 = 13.5 -> floor = 13
      // crit -> floor(13 * 1.5) = 19
      expect(damage).toBe(19);
    });

    it("戦士の場合は職業ボーナスが乗ること", () => {
      const normal = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      const warrior = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "戦士", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      expect(warrior).toBeGreaterThan(normal);
      // baseDamage = 12 * 1.3 -> floor(15.6) = 15
      expect(warrior).toBe(15);
    });

    it("魔法攻撃の場合はINTとMDEFで計算すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ int: 10, currentJob: "魔術師", weaponId: "none" }),
        defender: { def: 2, mdef: 4, vit: 2, int: 6, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: true,
      });
      // defenderDef = 4 + 6*0.5 = 7
      // baseDamage = 10*1.8 - 7 = 11
      expect(damage).toBe(11);
    });

    it("魔法クリティカル時はダメージが増加すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ int: 10, currentJob: "魔術師", weaponId: "none" }),
        defender: { def: 2, mdef: 4, vit: 2, int: 6, agi: 10 },
        isCritical: true,
        efficiency: 1.0,
        isMagicUser: true,
      });
      // defenderDef = (4 + 3) * 0.5 = 3.5
      // baseDamage = 18 - 3.5 = 14.5 -> floor = 14
      // crit -> floor(14 * 1.5) = 21
      expect(damage).toBe(21);
    });

    it("武器の攻撃力・INTが加算されること", () => {
      const physical = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "iron_sword" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      // weaponAtk=30, baseDamage = 15 + 30 - 3 = 42
      expect(physical).toBe(42);

      const magical = calculatePlayerDamage({
        attacker: makeVillager({ int: 10, currentJob: "魔術師", weaponId: "wooden_staff" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: true,
      });
      // weaponInt=8, defenderDef = 1 + 0.5 = 1.5
      // baseDamage = 18 + 8 - 1.5 = 24.5 -> floor = 24
      expect(magical).toBe(24);
    });

    it("efficiencyが0.5の場合はダメージが半減すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 0.5,
        isMagicUser: false,
      });
      // baseDamage = 12 * 0.5 = 6 -> max(10, 6) = 10
      expect(damage).toBe(10);
    });

    it("給料未支給時はSTR/INTがデバフされてダメージが減少すること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ str: 10, currentJob: "農民", weaponId: "none" }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
        isSalaryUnpaid: true,
      });
      // effectiveStr = floor(10*0.8) = 8
      // baseDamage = 7*1.5 - 3 = 7.5 -> max(10, 7) = 10
      expect(damage).toBe(10);
    });

    it("計算結果がMIN_DAMAGEを下回る場合は下限ダメージを返すこと", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({ str: 1, currentJob: "農民", weaponId: "none" }),
        defender: { def: 50, mdef: 1, vit: 50, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      expect(damage).toBe(10);
    });

    it("食料buffのSTR/INTが加算されること", () => {
      const damage = calculatePlayerDamage({
        attacker: makeVillager({
          str: 10,
          currentJob: "農民",
          weaponId: "none",
          activeFoodBuffId: "food_dried_meat",
        }),
        defender: { def: 2, mdef: 1, vit: 2, int: 1, agi: 10 },
        isCritical: false,
        efficiency: 1.0,
        isMagicUser: false,
      });
      // buffStr=3, baseDamage = 13*1.5 - 3 = 16.5 -> floor = 16
      expect(damage).toBe(16);
    });
  });

  describe("calculateEnemyDamage", () => {
    it("防具なしの場合の基本ダメージを計算すること", () => {
      const damage = calculateEnemyDamage({
        attacker: { dex: 10, atk: 10 },
        defender: makeVillager({ vit: 10, armorId: "none" }),
        isCritical: false,
      });
      // defenderDef = 10, reduction = 100/(100+10) = 0.909...
      // baseDamage = 10 * 0.909... = 9.09... -> floor = 9, max(10, 9) = 10
      expect(damage).toBe(10);
    });

    it("防具ありの場合はダメージが減少すること", () => {
      const noArmor = calculateEnemyDamage({
        attacker: { dex: 10, atk: 100 },
        defender: makeVillager({ vit: 10, armorId: "none" }),
        isCritical: false,
      });
      const withArmor = calculateEnemyDamage({
        attacker: { dex: 10, atk: 100 },
        defender: makeVillager({ vit: 10, armorId: "iron_armor" }),
        isCritical: false,
      });
      expect(withArmor).toBeLessThan(noArmor);
      // noArmor: reduction=100/110, base=90.9 -> 90
      // withArmor: defenderDef=40, reduction=100/140=0.714, base=71.4 -> 71
      expect(noArmor).toBe(90);
      expect(withArmor).toBe(71);
    });

    it("クリティカル時はダメージが1.8倍になること", () => {
      const damage = calculateEnemyDamage({
        attacker: { dex: 10, atk: 10 },
        defender: makeVillager({ vit: 10, armorId: "none" }),
        isCritical: true,
      });
      // baseDamage = 10 (min clamp), crit -> floor(10*1.8) = 18
      expect(damage).toBe(18);
    });

    it("給料未支給時はVITがデバフされてダメージが増加すること", () => {
      const normal = calculateEnemyDamage({
        attacker: { dex: 10, atk: 100 },
        defender: makeVillager({ vit: 10, armorId: "none" }),
        isCritical: false,
      });
      const unpaid = calculateEnemyDamage({
        attacker: { dex: 10, atk: 100 },
        defender: makeVillager({ vit: 10, armorId: "none" }),
        isCritical: false,
        isSalaryUnpaid: true,
      });
      expect(unpaid).toBeGreaterThanOrEqual(normal);
      // effectiveVit = 8, reduction=100/108, base=92.59 -> 92
      expect(unpaid).toBe(92);
    });

    it("minDamageを指定できること", () => {
      const damage = calculateEnemyDamage({
        attacker: { dex: 10, atk: 1 },
        defender: makeVillager({ vit: 100, armorId: "none" }),
        isCritical: false,
        minDamage: 30,
      });
      expect(damage).toBe(30);
    });

    it("食料buffのVITが加算されること", () => {
      const damage = calculateEnemyDamage({
        attacker: { dex: 10, atk: 100 },
        defender: makeVillager({
          vit: 10,
          armorId: "none",
          activeFoodBuffId: "food_bread",
        }),
        isCritical: false,
      });
      // buffVit=2, defenderDef=12, reduction=100/112, base=89.28 -> 89
      expect(damage).toBe(89);
    });
  });

  describe("useBattlePotion", () => {
    it("HPが閾値を超えている場合は使用しないこと", () => {
      const v = makeVillager({ currentHp: 51, potionCount: 1 });
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(false);
      expect(result.healed).toBe(0);
      expect(result.updated.potionCount).toBe(1);
    });

    it("ポーションを持っていない場合は使用しないこと", () => {
      const v = makeVillager({ currentHp: 49, potionCount: 0 });
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(false);
      expect(result.healed).toBe(0);
    });

    it("HPが閾値以下でポーションを所持している場合は回復すること", () => {
      const v = makeVillager({ currentHp: 49, potionCount: 2 });
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(true);
      expect(result.healed).toBe(50);
      expect(result.updated.potionCount).toBe(1);
      expect(result.updated.currentHp).toBe(99);
    });

    it("最大HPを超えて回復しないこと", () => {
      const v = makeVillager({ currentHp: 50, potionCount: 1 });
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(true);
      expect(result.updated.currentHp).toBe(100);
    });

    it("mid_potionを所持している場合はその回復量を使うこと", () => {
      const v = makeVillager({
        currentHp: 1,
        potionCount: 1,
        potionItemId: "mid_potion",
      });
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(true);
      expect(result.healed).toBe(150);
      expect(result.updated.currentHp).toBe(100);
    });

    it("給料未支給時は最大HPがデバフされて閾値が下がること", () => {
      const v = makeVillager({ currentHp: 30, potionCount: 1 });
      // effectiveMaxHp = floor(100*0.8) = 80, threshold = 40
      // currentHp=30 <= 40 -> use potion
      const result = useBattlePotion(v, true);
      expect(result.used).toBe(true);
      // maxHP is capped at 80
      expect(result.updated.currentHp).toBe(80);
    });

    it("食料buffのmaxHpが閾値計算に反映されること", () => {
      const v = makeVillager({
        currentHp: 70,
        potionCount: 1,
        activeFoodBuffId: "food_dragon_hotpot",
      });
      // effectiveMaxHp = 100 + 50 = 150, threshold = 75
      // currentHp=70 <= 75 -> use potion
      const result = useBattlePotion(v, false);
      expect(result.used).toBe(true);
    });
  });

  describe("executePlayerAttack", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("命中した場合はダメージとクリティカル結果を返すこと", () => {
      const result = executePlayerAttack({
        attacker: makeVillager({ dex: 300 }),
        defender: { agi: 0, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.log.message).toContain("ダメージを与えた");
    });

    it("回避された場合はhit=falseでダメージ0を返すこと", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const result = executePlayerAttack({
        attacker: makeVillager({ dex: 0 }),
        defender: { agi: 100, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.log.message).toContain("回避");
    });

    it("クリティカル時はlogにクリティカル表記が含まれること", () => {
      // hitRate = 100, critRate = 30. random=0 -> hit & crit
      const result = executePlayerAttack({
        attacker: makeVillager({ dex: 300 }),
        defender: { agi: 0, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(result.isCritical).toBe(true);
      expect(result.log.message).toContain("クリティカル");
    });

    it("非クリティカル時はlogにクリティカル表記が含まれないこと", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0) // hit
        .mockReturnValueOnce(0.99); // non-crit
      const result = executePlayerAttack({
        attacker: makeVillager({ dex: 10 }),
        defender: { agi: 0, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(result.isCritical).toBe(false);
      expect(result.log.message).not.toContain("クリティカル");
    });

    it("statsが渡された場合は攻撃統計が更新されること", () => {
      const stats = {
        totalAttacksAttempted: 0,
        totalAttacksLanded: 0,
        totalCriticalHits: 0,
        totalDamageDealt: 0,
        totalGoldFromExports: 0,
        totalGoldSpentOnImports: 0,
        totalItemsGathered: 0,
        totalMonstersDefeated: 0,
        totalBossesDefeated: 0,
        totalItemsCrafted: 0,
        totalGoldFromPurchases: 0,
        totalItemsPurchased: 0,
        totalGoldFromTax: 0,
        totalDamageReceived: 0,
        totalPotionHealing: 0,
      };
      executePlayerAttack({
        attacker: makeVillager({ dex: 300 }),
        defender: { agi: 0, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        stats,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(stats.totalAttacksAttempted).toBe(1);
      expect(stats.totalAttacksLanded).toBe(1);
      expect(stats.totalCriticalHits).toBe(1);
      expect(stats.totalDamageDealt).toBeGreaterThan(0);
    });

    it("回避時はstatsの攻撃試行数のみ増加すること", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const stats = {
        totalAttacksAttempted: 0,
        totalAttacksLanded: 0,
        totalCriticalHits: 0,
        totalDamageDealt: 0,
        totalGoldFromExports: 0,
        totalGoldSpentOnImports: 0,
        totalItemsGathered: 0,
        totalMonstersDefeated: 0,
        totalBossesDefeated: 0,
        totalItemsCrafted: 0,
        totalGoldFromPurchases: 0,
        totalItemsPurchased: 0,
        totalGoldFromTax: 0,
        totalDamageReceived: 0,
        totalPotionHealing: 0,
      };
      executePlayerAttack({
        attacker: makeVillager({ dex: 0 }),
        defender: { agi: 100, def: 2, mdef: 1, vit: 2, int: 1 },
        efficiency: 1.0,
        isMagicUser: false,
        stats,
        logPrefix: "",
        attackerName: "アタッカー",
        defenderName: "ディフェンダー",
      });
      expect(stats.totalAttacksAttempted).toBe(1);
      expect(stats.totalAttacksLanded).toBe(0);
      expect(stats.totalDamageDealt).toBe(0);
    });
  });

  describe("executeEnemyAttack", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("命中した場合はダメージを返すこと", () => {
      const result = executeEnemyAttack({
        attacker: { dex: 300, atk: 10 },
        defender: makeVillager({ agi: 0 }),
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
      });
      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.log.message).toContain("ダメージを受けた");
    });

    it("回避された場合はhit=falseでダメージ0を返すこと", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const result = executeEnemyAttack({
        attacker: { dex: 0, atk: 10 },
        defender: makeVillager({ agi: 100 }),
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
      });
      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.log.message).toContain("回避");
    });

    it("クリティカル時はlogにクリティカル表記が含まれること", () => {
      const result = executeEnemyAttack({
        attacker: { dex: 300, atk: 10 },
        defender: makeVillager({ agi: 0 }),
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
      });
      expect(result.isCritical).toBe(true);
      expect(result.log.message).toContain("クリティカル");
    });

    it("非クリティカル時はlogにクリティカル表記が含まれないこと", () => {
      vi.spyOn(Math, "random")
        .mockReturnValueOnce(0) // hit
        .mockReturnValueOnce(0.99); // non-crit
      const result = executeEnemyAttack({
        attacker: { dex: 10, atk: 10 },
        defender: makeVillager({ agi: 0 }),
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
      });
      expect(result.isCritical).toBe(false);
      expect(result.log.message).not.toContain("クリティカル");
    });

    it("statsが渡された場合は受けたダメージ統計が更新されること", () => {
      const stats = {
        totalDamageReceived: 0,
        totalAttacksAttempted: 0,
        totalAttacksLanded: 0,
        totalCriticalHits: 0,
        totalDamageDealt: 0,
        totalGoldFromExports: 0,
        totalGoldSpentOnImports: 0,
        totalItemsGathered: 0,
        totalMonstersDefeated: 0,
        totalBossesDefeated: 0,
        totalItemsCrafted: 0,
        totalGoldFromPurchases: 0,
        totalItemsPurchased: 0,
        totalGoldFromTax: 0,
        totalPotionHealing: 0,
      };
      executeEnemyAttack({
        attacker: { dex: 300, atk: 10 },
        defender: makeVillager({ agi: 0 }),
        stats,
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
      });
      expect(stats.totalDamageReceived).toBeGreaterThan(0);
    });

    it("attackLabelを指定できること", () => {
      const result = executeEnemyAttack({
        attacker: { dex: 300, atk: 10 },
        defender: makeVillager({ agi: 0 }),
        logPrefix: "",
        attackerName: "エネミー",
        defenderName: "村人",
        attackLabel: "強撃",
      });
      expect(result.log.message).toContain("強撃");
    });
  });
});
