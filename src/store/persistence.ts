import { StateStorage, createJSONStorage } from "zustand/middleware";

import { DUNGEONS } from "../data/dungeons";
import {
  GameState,
  GameActions,
  FacilityType,
  Town,
  Caravan,
  DungeonArea,
} from "../types/game";
import { initialRevealedNodes, sanitizeRevealedNodes } from "./dungeonMap";
import { getInitialFacilities } from "./initialState";

// ==========================================
// セーブデータバージョン管理
// ==========================================
/** 現在のセーブデータバージョン。互換性のない変更があったら increment する */
export const SAVE_VERSION = 9;

type SaveMigration = (data: Record<string, unknown>) => void;

/**
 * バージョン別マイグレーション関数。
 * key = 適用元バージョン（そのバージョンの保存データを次のバージョンに上げる）
 * バージョン 0 は「バージョン管理が未導入の旧データ」を意味する
 */
const migrations: Record<number, SaveMigration> = {
  0: (data) => {
    // ── Villager: 後から追加されたフィールドのデフォルト補完 ──
    if (Array.isArray(data.villagers)) {
      data.villagers = data.villagers.map((v: Record<string, unknown>) => ({
        ...v,
        potionCount: v.potionCount ?? 0,
        staminaDrinkItemId: v.staminaDrinkItemId ?? "stamina_drink",
        staminaDrinkCount: v.staminaDrinkCount ?? 0,
        bonusStr: v.bonusStr ?? 0,
        bonusInt: v.bonusInt ?? 0,
        bonusDex: v.bonusDex ?? 0,
        bonusAgi: v.bonusAgi ?? 0,
        bonusVit: v.bonusVit ?? 0,
        bonusMaxHp: v.bonusMaxHp ?? 0,
        bonusMaxStamina: v.bonusMaxStamina ?? 0,
        activeFoodBuffId: v.activeFoodBuffId ?? null,
        isStarving: v.isStarving ?? false,
      }));
    }

    // ── Facility: 建設済み施設に trainingQueue を追加 ──
    if (data.facilities && typeof data.facilities === "object") {
      Object.values(data.facilities).forEach((fac: unknown) => {
        const f = fac as Record<string, unknown>;
        if (f && (f.level as number) > 0 && !Array.isArray(f.trainingQueue)) {
          f.trainingQueue = [];
        }
        if (f && f.upgradeAssignedVillagerId === undefined) {
          f.upgradeAssignedVillagerId = null;
        }
      });
    }

    // ── Top-level フィールドのデフォルト補完 ──
    data.tradeRules = data.tradeRules ?? [];
    data.isSalaryUnpaid = data.isSalaryUnpaid ?? false;
    data.consecutiveNegativeGoldDays = data.consecutiveNegativeGoldDays ?? 0;
    data.gameOverReason = data.gameOverReason ?? "";
    data.stats = data.stats ?? null;

    // ── Fields added after initial release ──
    data.towns = data.towns ?? null;
    data.caravans = data.caravans ?? null;
    data.soulUpgrades = data.soulUpgrades ?? null;
    data.lastSchedulerTick = data.lastSchedulerTick ?? -4;

    data.saveVersion = 1;
  },
  // v1 → v2: (予約)
  1: (data) => {
    data.saveVersion = 2;
  },
  // v2 → v3: 脅威度システムフィールド追加
  2: (data) => {
    data.raidFailureCount = 0;
    data.maxThreatLevelReached = 0;
    if (Array.isArray(data.dungeons)) {
      data.dungeons = data.dungeons.map((d: Record<string, unknown>) => ({
        ...d,
        threatLevel: d.threatLevel ?? 0,
        raid: d.raid ?? null,
      }));
    }
    data.saveVersion = 3;
  },
  // v3 → v4: tierStartDay 追加（Tier 開始をボス撃破時点にする）
  3: (data) => {
    data.tierStartDay = 1;
    data.saveVersion = 4;
  },
  // v4 → v5: 襲来システム廃止。raidFailureCount / raid 削除。脅威度MAXで即ゲームオーバー
  4: (data) => {
    delete data.raidFailureCount;
    if (Array.isArray(data.dungeons)) {
      data.dungeons = data.dungeons.map((d: Record<string, unknown>) => {
        const { raid: _raid, ...rest } = d;
        return rest;
      });
    }
    data.saveVersion = 5;
  },
  // v5 → v6: ダンジョン空間座標 (maxDepth, depth, lane, currentHp, dungeonState) 補完
  5: (data) => {
    const defaultMaxDepths: Record<string, number> = {
      forest: 100,
      mine: 150,
      valley: 200,
      world_tree: 250,
      abyss: 300,
    };
    if (Array.isArray(data.dungeons)) {
      data.dungeons = data.dungeons.map((d: Record<string, unknown>) => ({
        ...d,
        maxDepth: d.maxDepth ?? defaultMaxDepths[String(d.id)] ?? 100,
        monsters: Array.isArray(d.monsters)
          ? d.monsters.map((m: Record<string, unknown>) => ({
              ...m,
              currentHp: m.currentHp ?? m.hp,
            }))
          : d.monsters,
      }));
    }
    if (Array.isArray(data.villagers)) {
      data.villagers = data.villagers.map((v: Record<string, unknown>) => ({
        ...v,
        dungeonState: v.dungeonState ?? {
          currentDepth: 0,
          targetDepth: 0,
          lane: 0,
          phase: v.status === "active" ? "moving_to_target" : "idle",
          targetNodeId: null,
        },
      }));
    }
    data.saveVersion = 6;
  },
  // v6 → v7: アイテムスリム化に伴う廃止アイテムIDの統合・変換
  6: (data) => {
    const ITEM_REMAP: Record<string, string> = {
      vegetable: "wheat",
      mushroom: "herb",
      copper_ore: "iron_ore",
      feather: "crystal_fragment",
      ancient_bark: "mana_stone",
      bone: "leather",
      reinforced_plank: "wood_plank",
      crystal_powder: "crystal_fragment",
      mid_potion: "high_potion",
      ultimate_potion: "elixir",
      phoenix_tear: "elixir",
      food_sandwich: "food_bread",
      food_stamina_stew: "food_beast_roast",
      food_herb_banquet: "food_beast_roast",
      food_dragon_feast: "food_dragon_hotpot",
      wooden_bow: "wooden_club",
      leather_cloak: "wooden_shield",
    };

    const remapRecord = (rec: unknown) => {
      if (!rec || typeof rec !== "object") return;
      const obj = rec as Record<string, unknown>;
      for (const [oldId, newId] of Object.entries(ITEM_REMAP)) {
        const val = obj[oldId];
        if (typeof val === "number" && Number.isFinite(val) && val > 0) {
          const prev =
            typeof obj[newId] === "number" && Number.isFinite(obj[newId] as number)
              ? (obj[newId] as number)
              : 0;
          obj[newId] = prev + val;
        }
        delete obj[oldId];
      }
    };

    remapRecord(data.inventory);
    remapRecord(data.targetAmounts);

    if (Array.isArray(data.villagers)) {
      data.villagers = data.villagers.map((v: Record<string, unknown>) => {
        const next = { ...v };
        if (next.equipment && typeof next.equipment === "object") {
          const eq = { ...(next.equipment as Record<string, unknown>) };
          if (typeof eq.weapon === "string" && ITEM_REMAP[eq.weapon]) {
            eq.weapon = ITEM_REMAP[eq.weapon];
          }
          if (typeof eq.armor === "string" && ITEM_REMAP[eq.armor]) {
            eq.armor = ITEM_REMAP[eq.armor];
          }
          next.equipment = eq;
        }
        if (typeof next.potionItemId === "string" && ITEM_REMAP[next.potionItemId]) {
          next.potionItemId = ITEM_REMAP[next.potionItemId];
        }
        if (typeof next.activeFoodBuffId === "string" && ITEM_REMAP[next.activeFoodBuffId]) {
          next.activeFoodBuffId = ITEM_REMAP[next.activeFoodBuffId];
        }
        return next;
      });
    }

    if (Array.isArray(data.tradeRules)) {
      data.tradeRules = data.tradeRules.map((r: Record<string, unknown>) => ({
        ...r,
        itemId:
          typeof r.itemId === "string" && ITEM_REMAP[r.itemId] ? ITEM_REMAP[r.itemId] : r.itemId,
      }));
    }

    data.saveVersion = 7;
  },
  // v7 → v8: 経済v2（市場価格・価格方針・夕方精算）フィールド追加。
  // 既存の gold / pool / 村人 gold はそのまま引き継ぐ（リセットしない）。
  7: (data) => {
    data.marketPrices = {};
    data.pricePolicy = "standard";
    data.lastSettlement = null;
    data.saveVersion = 8;
  },
  // v8 → v9: Phase 4a（ノードマップの霧 revealedNodes）+ Phase 4b 用 raid フィールド追加。
  // revealedNodes は各ダンジョンの探索度から初期化する（到達済みの深さは解放済み扱い）。
  8: (data) => {
    const savedDungeons = Array.isArray(data.dungeons)
      ? (data.dungeons as DungeonArea[])
      : [];
    const revealed: Record<string, string[]> = {};
    for (const def of DUNGEONS) {
      const saved = savedDungeons.find((d) => d.id === def.id);
      // 旧セーブのダンジョンは gathers/monsters を欠く場合があるため、
      // 揃っている場合のみ保存側を使い、それ以外はマスタ定義 + 保存側の探索度で初期化する
      const source =
        saved && Array.isArray(saved.gathers) && Array.isArray(saved.monsters)
          ? saved
          : { ...def, explorationProgress: saved?.explorationProgress ?? def.explorationProgress };
      revealed[def.id] = initialRevealedNodes(source);
    }
    data.revealedNodes = revealed;
    data.raid = null;
    data.saveVersion = 9;
  },
};

// ==========================================
// partialize（永続化するフィールドを選別）
// ==========================================
export const partialize = (
  state: GameState & GameActions,
): Omit<GameState, "selectedItem" | "dungeonEvents" | "dailyFlows"> & { saveVersion: number } => ({
  currentDay: state.currentDay,
  currentHour: state.currentHour,
  gold: state.gold,
  soulPoints: state.soulPoints,
  villagers: state.villagers,
  facilities: state.facilities,
  dungeons: state.dungeons,
  inventory: state.inventory,
  marketPrices: state.marketPrices,
  pricePolicy: state.pricePolicy,
  lastSettlement: state.lastSettlement,
  targetAmounts: state.targetAmounts,
  logs: state.logs,
  currentTier: state.currentTier,
  activeBoss: state.activeBoss,
  bossDefeated: state.bossDefeated,
  gameOver: state.gameOver,
  gameOverReason: state.gameOverReason,
  isPaused: state.isPaused,
  playSpeed: state.playSpeed,
  soulUpgrades: state.soulUpgrades,
  prestigeCount: state.prestigeCount,
  tradeRules: state.tradeRules,
  towns: state.towns,
  caravans: state.caravans,
  revealedNodes: state.revealedNodes,
  raid: state.raid,
  raidDefeatStreak: state.raidDefeatStreak ?? 0,
  isSalaryUnpaid: state.isSalaryUnpaid,
  consecutiveNegativeGoldDays: state.consecutiveNegativeGoldDays,
  lastSchedulerTick: state.lastSchedulerTick,
  maxThreatLevelReached: state.maxThreatLevelReached,
  tierStartDay: state.tierStartDay,
  stats: state.stats,
  // B4 修正: selectedItem は UI の一時状態であり、永続化対象外。
  // 古い item id がマスタから消えた場合に復元時にクラッシュする可能性があるため。
  saveVersion: SAVE_VERSION,
});

// ==========================================
// merge（永続化データを復元＋マイグレーション）
// ==========================================
export const merge = <S extends GameState & GameActions>(
  persistedState: unknown,
  currentState: S,
): S => {
  if (!persistedState) return currentState;

  const persisted = persistedState as Record<string, unknown>;
  const saveVersion = (persisted.saveVersion as number) ?? 0;

  // マイグレーションを順次適用（saveVersion → 最新へ）
  if (saveVersion < SAVE_VERSION) {
    for (let v = saveVersion; v < SAVE_VERSION; v++) {
      if (migrations[v]) {
        migrations[v](persisted);
      }
    }
  }

  // currentState（初期値）とマージ
  const merged: S = { ...currentState, ...persisted } as S;

  // 永続化データに null/undefined が含まれていると currentState の初期値を上書きしてしまうため、
  // 重要なフィールドは null 合体演算子で保護する
  merged.towns = (persisted.towns as Town[]) ?? currentState.towns;
  merged.caravans = (persisted.caravans as Caravan[]) ?? currentState.caravans;
  merged.soulUpgrades =
    (persisted.soulUpgrades as Record<string, number>) ?? currentState.soulUpgrades;
  // Phase 6: 旧セーブには無いので初期値 0 にフォールバック
  merged.prestigeCount =
    (persisted.prestigeCount as number) ?? currentState.prestigeCount ?? 0;
  merged.lastSchedulerTick =
    (persisted.lastSchedulerTick as number) ?? currentState.lastSchedulerTick;
  merged.marketPrices =
    (persisted.marketPrices as Record<string, number>) ?? currentState.marketPrices;
  merged.pricePolicy =
    (persisted.pricePolicy as GameState["pricePolicy"]) ?? currentState.pricePolicy;
  // Phase 7: 迷路化に伴い、旧セーブの revealedNodes を新マップへ移行する
  // （存在しないIDを落とし、探索度からの初期解放と union。SAVE_VERSION は上げない）
  const persistedRevealed = persisted.revealedNodes as
    | Record<string, string[]>
    | undefined;
  if (persistedRevealed) {
    const savedDungeons = Array.isArray(merged.dungeons) ? merged.dungeons : [];
    const sanitized: Record<string, string[]> = {};
    for (const def of DUNGEONS) {
      const saved = savedDungeons.find((d) => d.id === def.id);
      const source =
        saved && Array.isArray(saved.gathers) && Array.isArray(saved.monsters)
          ? saved
          : {
              ...def,
              explorationProgress: saved?.explorationProgress ?? def.explorationProgress,
            };
      sanitized[def.id] = sanitizeRevealedNodes(source, persistedRevealed[def.id] ?? []);
    }
    merged.revealedNodes = sanitized;
  } else {
    merged.revealedNodes = currentState.revealedNodes;
  }
  merged.raid = (persisted.raid as GameState["raid"]) ?? null;
  // Phase 6: 旧セーブには無いので 0 にフォールバック
  merged.raidDefeatStreak =
    (persisted.raidDefeatStreak as number) ?? currentState.raidDefeatStreak ?? 0;

  // フラットな Record は shallow merge
  // B8 修正: 破損セーブで undefined / NaN / Infinity が混入しても
  // 算術演算で NaN 連鎖しないよう、有効な数値のみを採用する。
  merged.inventory = {
    ...currentState.inventory,
    ...filterFiniteNumbers(persisted.inventory as Record<string, unknown>),
  };
  merged.targetAmounts = {
    ...currentState.targetAmounts,
    ...filterFiniteNumbers(persisted.targetAmounts as Record<string, unknown>),
  };

  // Lv0 施設の建設コストを常に最新の初期値で上書き
  // （gold:0 変更などを既存セーブにも反映するため）
  if (merged.facilities) {
    const initialFacs = getInitialFacilities();
    Object.keys(merged.facilities).forEach((key) => {
      const fac = merged.facilities[key as FacilityType];
      const initFac = initialFacs[key as FacilityType];
      if (fac && initFac && fac.level === 0) {
        fac.upgradeCost = { ...initFac.upgradeCost };
      }
    });
  }

  return merged;
};

// ==========================================
// デバウンス付き永続化ストレージの実装
// ==========================================
/**
 * B8: persisted データに含まれる undefined / NaN / Infinity を除去する。
 * 破損セーブや手動編集で混入した無効値が、その後の算術演算で NaN 連鎖するのを防ぐ。
 */
function filterFiniteNumbers(source: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!source) return out;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const createDebouncedLocalStorage = (delayMs: number): StateStorage => {
  const storage = window.localStorage;
  const pendingWrites = new Map<string, string>();
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (name: string) => {
    if (pendingWrites.has(name)) {
      try {
        storage.setItem(name, pendingWrites.get(name)!);
      } catch (e) {
        console.error(e);
      }
      pendingWrites.delete(name);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
        timeouts.delete(name);
      }
    }
  };

  const flushAll = () => {
    Array.from(pendingWrites.keys()).forEach(flush);
  };

  // B15: debounce storage は module singleton として1度だけ初期化される。
  // 下記 addEventListener は同一インスタンスで1度だけバインドする意図的設計。
  // createDebouncedLocalStorage 自体は呼ばれない限り副作用がないが、
  // storageImpl の初期化（行300）で初めて実体化されるため、
  // window イベントリスナーも初回 import 時に1度だけ登録される。
  // テスト環境では isBrowser=false → createDummyStorage パスを通るため、
  // window.addEventListener は呼ばれない（window undefined でも安全）。
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushAll);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushAll();
      }
    });
  }

  return {
    getItem: (name) => {
      if (pendingWrites.has(name)) {
        return pendingWrites.get(name)!;
      }
      return storage.getItem(name);
    },
    setItem: (name, value) => {
      pendingWrites.set(name, value);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
      }
      timeouts.set(
        name,
        setTimeout(() => {
          flush(name);
        }, delayMs),
      );
    },
    removeItem: (name) => {
      pendingWrites.delete(name);
      if (timeouts.has(name)) {
        clearTimeout(timeouts.get(name));
        timeouts.delete(name);
      }
      storage.removeItem(name);
    },
  };
};

const createDummyStorage = (): StateStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) || null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
};

const storageImpl = isBrowser ? createDebouncedLocalStorage(1000) : createDummyStorage();

export const customStorage = createJSONStorage<GameState>(() => storageImpl);
