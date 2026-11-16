import { create } from "zustand";

import { ITEMS } from "../../data/items";
import type { Villager } from "../../types/game";

/**
 * Phase 2 「今日のあしあと」。
 * 村人の行き先 (buildingId + activity) の変化を1件ずつ記録するランタイムストア。
 * 永続化しない (ページを離れたら消える)。保持は村人ごと・日ごとで、
 * 前日分は翌日のエントリ追加時に破棄する。
 */

export type FootprintKind =
  | "depart"
  | "arrive"
  | "work"
  | "meal"
  | "rest"
  | "sleep"
  | "wake"
  | "plaza"
  | "other";

export interface FootprintEntry {
  villagerId: string;
  day: number;
  hour: number;
  minute?: number;
  text: string;
  kind: FootprintKind;
}

/** 行き先の最小表現 (VillagerDestination と構造的に互換) */
export interface DestinationLike {
  buildingId: string;
  activity: string;
  lifeAction?: string;
}

export interface TransitionContext {
  /** next.buildingId に対応する建物名 */
  buildingName: string;
  /** ダンジョンへ出発する場合のダンジョン名 (あれば) */
  dungeonName?: string | null;
}

export const MAX_FOOTPRINT_PER_VILLAGER = 100;

/** 作業の文面サフィックス (建物ごとに「何をしているか」を変える) */
const WORK_TEXT: Record<string, string> = {
  workshop: "でクラフト",
  kitchen: "でクラフト",
  alchemy: "でクラフト",
  weapon_shop: "でクラフト",
  training_ground: "で訓練",
  farm: "で農作業",
  lumberyard: "で伐採",
  quarry: "で採掘",
};

/**
 * 行き先の変化からあしあと1件分の文面を作る純関数。
 * prev が null の場合は「初回記録」として現在の行き先をそのまま描写する。
 * prev と next が同一 (buildingId + activity) なら null を返す。
 */
export function describeTransition(
  prev: DestinationLike | null,
  next: DestinationLike,
  villager: Villager,
  ctx: TransitionContext,
): { text: string; kind: FootprintKind } | null {
  if (prev && prev.buildingId === next.buildingId && prev.activity === next.activity) {
    return null;
  }
  const name = ctx.buildingName;

  // 就寝 (行き先が sleep になった)
  if (next.activity === "sleep") {
    return { text: "就寝", kind: "sleep" };
  }
  // 起床 (sleep から他へ)
  if (prev && prev.activity === "sleep") {
    return { text: "起床", kind: "wake" };
  }
  // ダンジョンからの帰還
  if (prev && prev.activity === "dungeon" && next.activity !== "dungeon") {
    return { text: "帰還", kind: "arrive" };
  }
  // ダンジョンへ出発
  if (next.activity === "dungeon") {
    return { text: `${ctx.dungeonName ?? "ダンジョン"}へ出発`, kind: "depart" };
  }

  switch (next.activity) {
    case "work":
      return { text: `${name}${WORK_TEXT[next.buildingId] ?? "で作業"}`, kind: "work" };
    case "meal": {
      if (villager.isStarving) {
        return { text: "食べるものがなかった", kind: "meal" };
      }
      const dish = villager.activeFoodBuffId ? ITEMS[villager.activeFoodBuffId] : undefined;
      if (dish) {
        return { text: `${name}で食事（${dish.name}）`, kind: "meal" };
      }
      return { text: `${name}で食事`, kind: "meal" };
    }
    case "rest":
      return { text: `${name}で休憩`, kind: "rest" };
    case "stroll":
      if (next.lifeAction === "shopping") {
        return { text: `${name}で買い物`, kind: "other" };
      }
      if (next.lifeAction === "workplaceVisit") {
        return { text: `${name}に立ち寄った`, kind: "other" };
      }
      return { text: "広場で休憩", kind: "plaza" };
    case "idle":
      return { text: "広場で休憩", kind: "plaza" };
    case "home":
      return { text: "帰宅", kind: "arrive" };
    default:
      return { text: `${name}へ向かった`, kind: "other" };
  }
}

interface FootprintState {
  entries: FootprintEntry[];
  addEntry: (entry: FootprintEntry) => void;
  /** 指定した村人の指定日のエントリを記録順に返す */
  entriesFor: (villagerId: string, day: number) => FootprintEntry[];
}

export const useFootprintStore = create<FootprintState>((set, get) => ({
  entries: [],
  addEntry: (entry) =>
    set((s) => {
      // 連続する同一エントリ (同日・同時刻・同文面) は追加しない
      for (let i = s.entries.length - 1; i >= 0; i--) {
        const e = s.entries[i];
        if (e.villagerId !== entry.villagerId) continue;
        if (e.day === entry.day && e.hour === entry.hour && e.text === entry.text) {
          return s;
        }
        break;
      }
      // 前日分は破棄する (日次ローテーション)
      let next = s.entries.filter((e) => e.day >= entry.day);
      next = [...next, entry];
      // 村人あたりの上限を超えたら古い順に捨てる
      const mine = next.filter((e) => e.villagerId === entry.villagerId);
      if (mine.length > MAX_FOOTPRINT_PER_VILLAGER) {
        const drop = new Set(mine.slice(0, mine.length - MAX_FOOTPRINT_PER_VILLAGER));
        next = next.filter((e) => !drop.has(e));
      }
      return { entries: next };
    }),
  entriesFor: (villagerId, day) =>
    get().entries.filter((e) => e.villagerId === villagerId && e.day === day),
}));
