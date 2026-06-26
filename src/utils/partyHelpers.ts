import type { Villager } from "../types/game";

/** 単騎（パーティ未所属）のセンチネル値 */
export const SOLO_PARTY_KEY = "__solo__";

/** パーティ色パレット (Tailwind クラス) — 6 色ローテーション */
export const PARTY_COLORS = [
  {
    id: "red",
    bg: "bg-red-500/20",
    border: "border-red-500/40",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  {
    id: "blue",
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  {
    id: "green",
    bg: "bg-green-500/20",
    border: "border-green-500/40",
    text: "text-green-300",
    dot: "bg-green-400",
  },
  {
    id: "yellow",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/40",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
  },
  {
    id: "purple",
    bg: "bg-purple-500/20",
    border: "border-purple-500/40",
    text: "text-purple-300",
    dot: "bg-purple-400",
  },
  {
    id: "orange",
    bg: "bg-orange-500/20",
    border: "border-orange-500/40",
    text: "text-orange-300",
    dot: "bg-orange-400",
  },
] as const;

export type PartyColor = (typeof PARTY_COLORS)[number];

/** 簡易ハッシュ (string → 0 以上) */
export function hashPartyKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** パーティキーを色インデックス (0-5) に変換。単騎は -1 */
export function getPartyColorIndex(partyKey: string): number {
  if (!partyKey || partyKey === SOLO_PARTY_KEY) return -1;
  return hashPartyKey(partyKey) % PARTY_COLORS.length;
}

/** パーティキーを色オブジェクトに変換 */
export function getPartyColor(partyKey: string): PartyColor | null {
  const idx = getPartyColorIndex(partyKey);
  if (idx < 0) return null;
  return PARTY_COLORS[idx];
}

/** パーティラベル (A, B, C... 27 番目以降は #N) を生成 */
export function getPartyLabel(partyKey: string, allPartyKeys: string[]): string {
  const sortedKeys = Array.from(new Set(allPartyKeys))
    .filter((k) => k && k !== SOLO_PARTY_KEY)
    .sort();
  const index = sortedKeys.indexOf(partyKey);
  if (index < 0) return "?";
  if (index < 26) return String.fromCharCode(65 + index); // A-Z
  return `#${index + 1}`;
}

/** パーティメンバーのサイズを取得 */
export function getPartySize(partyKey: string, villagers: Villager[]): number {
  if (!partyKey || partyKey === SOLO_PARTY_KEY) return 0;
  return villagers.filter((v) => v.autoTargetName === partyKey).length;
}

/** 単騎判定（autoTargetName が null/undefined/空文字） */
export function isSolo(villager: Villager): boolean {
  const key = villager.autoTargetName;
  return !key;
}

/** 村人リストから全パーティキーを抽出（重複なし、安定ソート） */
export function getAllPartyKeys(villagers: Villager[]): string[] {
  return Array.from(
    new Set(
      villagers
        .map((v) => v.autoTargetName ?? SOLO_PARTY_KEY)
        .filter((k) => k !== SOLO_PARTY_KEY && k !== ""),
    ),
  ).sort();
}
