import { TOWN_BUILDINGS, type TownBuildingDef } from "../../data/townLayout";
import type { Villager } from "../../types/game";

/**
 * Phase 2 自宅割り当ての永続化。
 * 本体セーブの外のサイドストレージ (localStorage["fsl-life-v1"]) に
 * { villagerId: houseBuildingId } を保存する。
 * localStorage が使えない環境ではメモリ内 Map にフォールバックし、
 * Phase 1 の index 割当と等価に振る舞う。
 */

export const LIFE_STORAGE_KEY = "fsl-life-v1";

const HOUSE_DEFS = TOWN_BUILDINGS.filter((b) => b.kind === "house");
const HOUSE_BY_ID = new Map(HOUSE_DEFS.map((d) => [d.id, d]));

let cache: Map<string, string> | null = null;

function readStorage(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LIFE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function loadCache(): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  const raw = readStorage();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { homes?: Record<string, string> };
      if (parsed && typeof parsed.homes === "object" && parsed.homes !== null) {
        for (const [villagerId, houseId] of Object.entries(parsed.homes)) {
          if (typeof houseId === "string" && HOUSE_BY_ID.has(houseId)) {
            cache.set(villagerId, houseId);
          }
        }
      }
    } catch {
      // 壊れたデータは無視して新規割当から始める
    }
  }
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      LIFE_STORAGE_KEY,
      JSON.stringify({ homes: Object.fromEntries(cache) }),
    );
  } catch {
    // 保存できなくてもメモリ上の割当で継続する
  }
}

/**
 * 村人の自宅を返す。未登録なら「リスト順にシミュレーションしたときの
 * 最も入居人数の少ない民家」を割り当てて保存する。
 *
 * リスト順シミュレーション: 対象より前に並ぶ村人は、保存済みの割当があればそれを、
 * なければ仮の割当 (その時点の最少人数の民家) を置いて人数を数える。
 * これにより「全員を並び順に割り当てる」自然なケースでは Phase 1 の
 * index 割当と完全に一致し、保存済みの割当は並びが変わっても維持される。
 */
export function homeBuildingForVillager(
  villagers: readonly Villager[],
  villagerId: string,
): TownBuildingDef {
  const homes = loadCache();
  const stored = homes.get(villagerId);
  if (stored) {
    const def = HOUSE_BY_ID.get(stored);
    if (def) return def;
  }

  const idx = villagers.findIndex((v) => v.id === villagerId);
  const upto = idx >= 0 ? villagers.slice(0, idx + 1) : [...villagers, { id: villagerId }];

  const counts = new Map<string, number>(HOUSE_DEFS.map((d) => [d.id, 0]));
  let chosen: TownBuildingDef = HOUSE_DEFS[0];
  for (const member of upto) {
    const isTarget = member.id === villagerId;
    const memberStored = homes.get(member.id);
    let houseId: string;
    if (memberStored && HOUSE_BY_ID.has(memberStored)) {
      houseId = memberStored;
    } else {
      // その時点の最少人数の民家 (同数は並び順で先の民家)
      let best = HOUSE_DEFS[0];
      for (const def of HOUSE_DEFS) {
        if ((counts.get(def.id) ?? 0) < (counts.get(best.id) ?? 0)) best = def;
      }
      houseId = best.id;
    }
    counts.set(houseId, (counts.get(houseId) ?? 0) + 1);
    if (isTarget) chosen = HOUSE_BY_ID.get(houseId) ?? HOUSE_DEFS[0];
  }

  homes.set(villagerId, chosen.id);
  persist();
  return chosen;
}

/** テスト用: メモリキャッシュだけを破棄する (ストレージの内容は残る = 再読み込みの模擬) */
export function __clearHomeAssignmentCacheForTest(): void {
  cache = null;
}

/** テスト用: メモリキャッシュとストレージの両方を破棄する */
export function __resetHomeAssignmentsForTest(): void {
  cache = new Map();
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LIFE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
