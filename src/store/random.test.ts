import { describe, it, expect, afterEach } from "vitest";

import { mulberry32, random, seedRandom, setRandomSource, resetRandomSource } from "./random";

describe("random (seeded RNG)", () => {
  afterEach(() => {
    resetRandomSource();
  });

  it("mulberry32 は同一シードで同一系列を返す", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("mulberry32 の値は [0, 1) の範囲にある", () => {
    const gen = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = gen();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("異なるシードでは異なる系列になる", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("seedRandom で差し替えると random() が決定的になる", () => {
    seedRandom(123);
    const first = Array.from({ length: 10 }, () => random());
    seedRandom(123);
    const second = Array.from({ length: 10 }, () => random());
    expect(first).toEqual(second);

    const direct = mulberry32(123);
    expect(first).toEqual(Array.from({ length: 10 }, () => direct()));
  });

  it("setRandomSource(null) / resetRandomSource で Math.random に戻る", () => {
    setRandomSource(() => 0.5);
    expect(random()).toBe(0.5);
    setRandomSource(null);
    const v = random();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
