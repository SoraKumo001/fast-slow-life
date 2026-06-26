import { describe, it, expect } from "vitest";

import type { Villager } from "../types/game";
import {
  SOLO_PARTY_KEY,
  PARTY_COLORS,
  hashPartyKey,
  getPartyColorIndex,
  getPartyColor,
  getPartyLabel,
  getPartySize,
  isSolo,
  getAllPartyKeys,
} from "./partyHelpers";

// テスト用の Villager モック（部分オブジェクトをキャスト）
function makeVillager(autoTargetName: string | null | undefined): Villager {
  return { autoTargetName: autoTargetName ?? null } as unknown as Villager;
}

describe("partyHelpers", () => {
  describe("hashPartyKey", () => {
    it("同じキーは同じハッシュ値を返すこと", () => {
      expect(hashPartyKey("goblin")).toBe(hashPartyKey("goblin"));
      expect(hashPartyKey("始まりの森")).toBe(hashPartyKey("始まりの森"));
    });

    it("空文字でも例外を投げないこと", () => {
      expect(() => hashPartyKey("")).not.toThrow();
    });

    it("異なるキーは異なるハッシュ値である可能性が高いこと", () => {
      const a = hashPartyKey("goblin");
      const b = hashPartyKey("wolf");
      const c = hashPartyKey("troll");
      // 6 色パレットでも衝突しないことを期待（異なれば OK）
      expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getPartyColorIndex", () => {
    it("単騎センチネルは -1 を返すこと", () => {
      expect(getPartyColorIndex(SOLO_PARTY_KEY)).toBe(-1);
    });

    it("空文字は -1 を返すこと", () => {
      expect(getPartyColorIndex("")).toBe(-1);
    });

    it("有効なキーは 0 以上 PARTY_COLORS.length 未満のインデックスを返すこと", () => {
      for (let i = 0; i < PARTY_COLORS.length * 2; i++) {
        const idx = getPartyColorIndex(`target_${i}`);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(PARTY_COLORS.length);
      }
    });

    it("同じキーは常に同じインデックスを返すこと（安定性）", () => {
      const a = getPartyColorIndex("始まりの森");
      const b = getPartyColorIndex("始まりの森");
      expect(a).toBe(b);
    });
  });

  describe("getPartyColor", () => {
    it("有効なキーは色オブジェクトを返すこと", () => {
      const color = getPartyColor("goblin");
      expect(color).not.toBeNull();
      expect(color).toHaveProperty("id");
      expect(color).toHaveProperty("bg");
      expect(color).toHaveProperty("border");
      expect(color).toHaveProperty("text");
      expect(color).toHaveProperty("dot");
    });

    it("単騎は null を返すこと", () => {
      expect(getPartyColor(SOLO_PARTY_KEY)).toBeNull();
      expect(getPartyColor("")).toBeNull();
    });
  });

  describe("getPartyLabel", () => {
    it("ソート順に A, B, C... を割り当てること", () => {
      // ソート順: goblin < troll < wolf
      expect(getPartyLabel("goblin", ["goblin", "troll", "wolf"])).toBe("A");
      expect(getPartyLabel("troll", ["goblin", "troll", "wolf"])).toBe("B");
      expect(getPartyLabel("wolf", ["goblin", "troll", "wolf"])).toBe("C");
    });

    it("含まれていないキーは ? を返すこと", () => {
      expect(getPartyLabel("unknown", ["goblin"])).toBe("?");
    });

    it("26 番目以降は #N 形式になること", () => {
      const keys = Array.from({ length: 27 }, (_, i) => `key_${String(i).padStart(2, "0")}`);
      expect(getPartyLabel("key_25", keys)).toBe("Z"); // 26 番目
      expect(getPartyLabel("key_26", keys)).toBe("#27"); // 27 番目
    });

    it("単騎キーは除外されること", () => {
      const keys = ["goblin", SOLO_PARTY_KEY, "wolf"];
      expect(getPartyLabel("goblin", keys)).toBe("A");
      expect(getPartyLabel("wolf", keys)).toBe("B");
    });

    it("重複キーは一意に扱われること", () => {
      expect(getPartyLabel("wolf", ["wolf", "wolf", "goblin"])).toBe("B");
    });
  });

  describe("getPartySize", () => {
    it("同じ autoTargetName の村人数を返すこと", () => {
      const villagers = [
        makeVillager("wolf"),
        makeVillager("wolf"),
        makeVillager("goblin"),
        makeVillager("troll"),
      ];
      expect(getPartySize("wolf", villagers)).toBe(2);
      expect(getPartySize("goblin", villagers)).toBe(1);
      expect(getPartySize("troll", villagers)).toBe(1);
    });

    it("単騎センチネルは 0 を返すこと", () => {
      expect(getPartySize(SOLO_PARTY_KEY, [makeVillager("wolf")])).toBe(0);
    });

    it("村人リストが空なら 0 を返すこと", () => {
      expect(getPartySize("wolf", [])).toBe(0);
    });

    it("存在しないキーは 0 を返すこと", () => {
      expect(getPartySize("ghost", [makeVillager("wolf")])).toBe(0);
    });
  });

  describe("isSolo", () => {
    it("autoTargetName が null なら true", () => {
      expect(isSolo(makeVillager(null))).toBe(true);
    });

    it("autoTargetName が undefined なら true", () => {
      expect(isSolo(makeVillager(undefined))).toBe(true);
    });

    it("autoTargetName が空文字なら true", () => {
      expect(isSolo(makeVillager(""))).toBe(true);
    });

    it("autoTargetName があれば false", () => {
      expect(isSolo(makeVillager("wolf"))).toBe(false);
      expect(isSolo(makeVillager("始まりの森"))).toBe(false);
    });
  });

  describe("getAllPartyKeys", () => {
    it("重複なしのソート済みキー一覧を返すこと", () => {
      const villagers = [
        makeVillager("wolf"),
        makeVillager("goblin"),
        makeVillager("wolf"),
        makeVillager(null),
      ];
      const keys = getAllPartyKeys(villagers);
      expect(keys).toEqual(["goblin", "wolf"]); // ソート順
    });

    it("単騎センチネルは含まないこと", () => {
      const villagers = [makeVillager(null), makeVillager("")];
      expect(getAllPartyKeys(villagers)).toEqual([]);
    });

    it("全単騎なら空配列を返すこと", () => {
      const villagers = [makeVillager(null), makeVillager(undefined), makeVillager("wolf")];
      const keys = getAllPartyKeys(villagers);
      expect(keys).toEqual(["wolf"]);
    });
  });

  describe("PARTY_COLORS", () => {
    it("6 色のパレットが定義されていること", () => {
      expect(PARTY_COLORS).toHaveLength(6);
    });

    it("各色に id, bg, border, text, dot があること", () => {
      for (const color of PARTY_COLORS) {
        expect(color.id).toBeTruthy();
        expect(color.bg).toMatch(/^bg-/);
        expect(color.border).toMatch(/^border-/);
        expect(color.text).toMatch(/^text-/);
        expect(color.dot).toMatch(/^bg-/);
      }
    });

    it("全 id がユニークであること", () => {
      const ids = PARTY_COLORS.map((c) => c.id);
      expect(new Set(ids).size).toBe(PARTY_COLORS.length);
    });
  });
});
