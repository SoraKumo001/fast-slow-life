import { StateStorage, createJSONStorage } from "zustand/middleware";

import { GameState, GameActions, FacilityType, Town, Caravan } from "../types/game";
import { getInitialFacilities } from "./initialState";

// ==========================================
// セーブデータバージョン管理
// ==========================================
/** 現在のセーブデータバージョン。互換性のない変更があったら increment する */
export const SAVE_VERSION = 5;

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
};

// ==========================================
// partialize（永続化するフィールドを選別）
// ==========================================
export const partialize = (
  state: GameState & GameActions,
): GameState & { saveVersion: number } => ({
  currentDay: state.currentDay,
  currentHour: state.currentHour,
  gold: state.gold,
  soulPoints: state.soulPoints,
  villagers: state.villagers,
  facilities: state.facilities,
  dungeons: state.dungeons,
  inventory: state.inventory,
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
  tradeRules: state.tradeRules,
  towns: state.towns,
  caravans: state.caravans,
  isSalaryUnpaid: state.isSalaryUnpaid,
  consecutiveNegativeGoldDays: state.consecutiveNegativeGoldDays,
  lastSchedulerTick: state.lastSchedulerTick,
  maxThreatLevelReached: state.maxThreatLevelReached,
  tierStartDay: state.tierStartDay,
  stats: state.stats,
  selectedItem: state.selectedItem,
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
  merged.lastSchedulerTick =
    (persisted.lastSchedulerTick as number) ?? currentState.lastSchedulerTick;

  // フラットな Record は shallow merge
  merged.inventory = {
    ...currentState.inventory,
    ...(persisted.inventory as Record<string, number>),
  };
  merged.targetAmounts = {
    ...currentState.targetAmounts,
    ...(persisted.targetAmounts as Record<string, number>),
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
