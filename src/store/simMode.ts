/**
 * シミュレーションモードフラグ (バランスシミュレーション改善・柱3)。
 *
 * バランスシミュレーションのワーカーだけが setSimMode(true) する。
 * ゲームロジックはこのフラグを見て「表示専用の生成物」(ダンジョン視覚イベント等)
 * の生成を省略できる。判断に効く処理はフラグで変えてはならない
 * (高速化前後でラン結果が完全一致することが受け入れ条件)。
 */
let simMode = false;

export function setSimMode(value: boolean): void {
  simMode = value;
}

export function isSimMode(): boolean {
  return simMode;
}
