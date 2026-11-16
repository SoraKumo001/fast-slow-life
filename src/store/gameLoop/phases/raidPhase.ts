/**
* Phase: Raid — 襲撃イベントの進行（Phase 4b）
*
* 到着までは何もしない。到着したティックから1時間に1ラウンド防衛戦を解決する。
* 襲撃の生成は threatPhase、戦闘の詳細は raidLogic が担う。
*/

import { getTotalElapsedHours, isRaidFighting, resolveRaidRound} from "../../raidLogic";
import type { GamePhaseAccumulator} from "../types";

export const raidPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
if (acc.gameOver) return acc;
const raid = acc.raid;
if (!raid) return acc;

const dungeon = acc.dungeons.find((d) => d.id === raid.dungeonId);
if (!dungeon) {
// 襲撃元ダンジョンが存在しない異常ケースでは襲撃を取り消す
acc.raid = null;
return acc;
}

const now = getTotalElapsedHours(acc.currentDay, acc.currentHour);
if (!isRaidFighting(raid, now)) return acc; // 進軍中

// 到着したティックに到着ログを出す（ロード等で過ぎていた場合は出さない）
if (now === raid.arrivesAtElapsedHour) {
acc.logsToAppend.push({
message: `${dungeon.name} の群れが町に到着しました！防衛戦開始！`,
type: "error",
});
}

const result = resolveRaidRound({
raid,
dungeon,
villagers: acc.villagers,
inventory: acc.inventory,
gold: acc.gold,
facilities: acc.facilities,
soulUpgrades: acc.soulUpgrades,
stats: acc.nextStats,
});

acc.villagers = result.villagers;
acc.raid = result.raid;
acc.inventory = result.inventory;
acc.gold = result.gold;
acc.facilities = result.facilities;
acc.dungeons = acc.dungeons.map((d) => (d.id === dungeon.id? result.dungeon: d));
acc.logsToAppend.push(...result.logs);

return acc;
};
