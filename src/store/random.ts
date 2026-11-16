/**
 * 差し替え可能な乱数源 (バランスシミュレーション改善・柱1)。
 *
 * 通常プレイでは Math.random をそのまま使う (従来挙動と同一)。
 * バランスシミュレーションではワーカーがランごとに seedRandom(seed) を呼び、
 * シード付き PRNG に差し替えることで結果を完全に再現可能にする。
 *
 * ゲームロジック側は Math.random を直接呼ばず、必ず random() を経由すること。
 */

/** mulberry32: 32bit シードの決定的 PRNG。[0, 1) の一様乱数を返す。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 既定の乱数源は呼び出し時点の Math.random を参照する
// (関数参照を掴むと vi.spyOn(Math, "random") 等の差し替えが効かなくなるため)。
const defaultSource = (): number => Math.random();

let currentSource: () => number = defaultSource;

/** 現在の乱数源から [0, 1) の乱数を1つ引く。 */
export function random(): number {
  return currentSource();
}

/** 乱数源を差し替える。null を渡すと Math.random に戻る。 */
export function setRandomSource(source: (() => number) | null): void {
  currentSource = source ?? defaultSource;
}

/** シード付き PRNG を乱数源に設定する (シミュレーション専用)。 */
export function seedRandom(seed: number): void {
  currentSource = mulberry32(seed);
}

/** 乱数源を通常プレイ用 (Math.random) に戻す。 */
export function resetRandomSource(): void {
  currentSource = defaultSource;
}
