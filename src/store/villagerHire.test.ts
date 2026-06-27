import { describe, it, expect } from "vitest";

import {
  BASE_MAX_VILLAGERS,
  HIRE_COST,
  MAX_VILLAGERS_ABSOLUTE,
  VILLAGERS_PER_GUILD_LEVEL,
} from "../constants";
import type { Facility, Villager } from "../types/game";
import { hireVillagerHelper } from "./villagerHire";

function makeVillager(id: string, name: string): Villager {
  return {
    id,
    name,
    currentJob: "農民",
    jobHistory: ["農民"],
    gold: 0,
    pool: {},
    activeFoodBuffId: null,
    lastTrainingDay: 0,
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
    bonusStr: 0,
    bonusInt: 0,
    bonusDex: 0,
    bonusAgi: 0,
    bonusVit: 0,
    bonusMaxHp: 0,
    bonusMaxStamina: 0,
    potionCount: 0,
    potionItemId: "potion",
    staminaDrinkCount: 0,
    staminaDrinkItemId: "stamina_drink",
    weaponId: "none",
    armorId: "none",
    status: "idle",
    order: "rest",
    destinationAreaId: null,
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    autoTargetName: null,
    isStarving: false,
  } as Villager;
}

function makeGuild(level: number): Facility {
  return {
    id: "guild",
    name: "冒険者ギルド",
    level,
    maxLevel: 5,
    upgradeTimeLeft: 0,
    upgradeTotalTime: 0,
    upgradeCost: { gold: 0, materials: [] },
    craftQueue: [],
    trainingQueue: [],
    upgradeAssignedVillagerId: null,
  } as Facility;
}

describe("villagerHire - hireVillagerHelper", () => {
  describe("前提条件", () => {
    it("guildFacility が undefined の場合は失敗すること", () => {
      const result = hireVillagerHelper({
        gold: 10000,
        villagers: [],
        guildFacility: undefined,
        soulUpgrades: {},
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain("冒険者ギルド");
    });

    it("ギルドLv0 の場合は失敗すること", () => {
      const result = hireVillagerHelper({
        gold: 10000,
        villagers: [],
        guildFacility: makeGuild(0),
        soulUpgrades: {},
      });
      expect(result.success).toBe(false);
    });

    it("ゴールド不足の場合は失敗すること", () => {
      const result = hireVillagerHelper({
        gold: 10,
        villagers: [],
        guildFacility: makeGuild(1),
        soulUpgrades: {},
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain("ゴールド");
    });
  });

  describe("雇用成功", () => {
    it("村人が 1 人追加され、ゴールドが HIRE_COST 分減少すること", () => {
      const result = hireVillagerHelper({
        gold: 1000,
        villagers: [],
        guildFacility: makeGuild(1),
        soulUpgrades: {},
      });
      expect(result.success).toBe(true);
      expect(result.villagers.length).toBe(1);
      expect(result.gold).toBe(1000 - HIRE_COST);
    });

    it("雇用成功時に info ログが出力されること", () => {
      const result = hireVillagerHelper({
        gold: 1000,
        villagers: [],
        guildFacility: makeGuild(1),
        soulUpgrades: {},
      });
      expect(result.logs[0].type).toBe("info");
      expect(result.logs[0].message).toContain("雇用");
    });

    it("既存の村人と重複しない名前が生成されること", () => {
      const existing = [makeVillager("v1", "既存村人A"), makeVillager("v2", "既存村人B")];
      const result = hireVillagerHelper({
        gold: 1000,
        villagers: existing,
        guildFacility: makeGuild(1),
        soulUpgrades: {},
      });
      expect(result.success).toBe(true);
      const newName = result.villagers[2].name;
      expect(newName).not.toBe("既存村人A");
      expect(newName).not.toBe("既存村人B");
    });

    it("body ソウルバフが新村人のステータスに反映されること", () => {
      const result = hireVillagerHelper({
        gold: 1000,
        villagers: [],
        guildFacility: makeGuild(1),
        soulUpgrades: { body: 5 }, // statBonus = 5*2 = 10
      });
      expect(result.success).toBe(true);
      // base 10 + statBonus 10 = 20
      const newV = result.villagers[0];
      expect(newV.str).toBe(20);
    });
  });

  describe("雇用上限", () => {
    it("BASE_MAX_VILLAGERS + guild.level * VILLAGERS_PER_GUILD_LEVEL を超えると失敗すること", () => {
      // Lv1 の場合 BASE + 1 * 2 = 7
      const guild = makeGuild(1);
      const maxVillagers = BASE_MAX_VILLAGERS + guild.level * VILLAGERS_PER_GUILD_LEVEL;
      const villagers = Array.from({ length: maxVillagers }, (_, i) =>
        makeVillager(`v${i}`, `村人${i}`),
      );
      const result = hireVillagerHelper({
        gold: 10000,
        villagers,
        guildFacility: guild,
        soulUpgrades: {},
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain("上限");
    });

    it("絶対上限 MAX_VILLAGERS_ABSOLUTE に達した場合のメッセージが適切であること", () => {
      // 絶対上限は 14 人、ギルド Lv5 → BASE + 5*2 = 15 (Math.min(14, 15) = 14)
      const guild = makeGuild(5);
      const villagers = Array.from({ length: MAX_VILLAGERS_ABSOLUTE }, (_, i) =>
        makeVillager(`v${i}`, `村人${i}`),
      );
      const result = hireVillagerHelper({
        gold: 10000,
        villagers,
        guildFacility: guild,
        soulUpgrades: {},
      });
      expect(result.success).toBe(false);
      expect(result.logs[0].message).toContain(`${MAX_VILLAGERS_ABSOLUTE}人`);
    });

    it("上限直前の人数なら雇用成功すること", () => {
      const guild = makeGuild(1);
      // Lv1 なら 7 人まで雇用可能、6 人から 7 人への追加は成功
      const villagers = Array.from(
        {
          length: BASE_MAX_VILLAGERS + guild.level * VILLAGERS_PER_GUILD_LEVEL - 1,
        },
        (_, i) => makeVillager(`v${i}`, `村人${i}`),
      );
      const result = hireVillagerHelper({
        gold: 10000,
        villagers,
        guildFacility: guild,
        soulUpgrades: {},
      });
      expect(result.success).toBe(true);
    });
  });
});
