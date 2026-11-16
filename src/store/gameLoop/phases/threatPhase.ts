/**
* Phase: Threat — ダンジョン脅威度の進行と襲撃イベントの発生
*
* Phase 4b: 脅威度 100% 到達はゲームオーバーではなく襲撃イベントになる。
* 進軍中はそのダンジョンの脅威度を 100% に留める。
*/

import { THREAT_MAX} from "../../../constants";
import { buildRaidState, getTotalElapsedHours, RAID_MARCH_HOURS} from "../../raidLogic";
import { updateAllThreatLevels} from "../../threatLogic";
import type { GamePhaseAccumulator} from "../types";

export const threatPhase = (acc: GamePhaseAccumulator): GamePhaseAccumulator => {
if (acc.gameOver) return acc;

// 1. 全未攻略ダンジョンの脅威度を更新
const threatResult = updateAllThreatLevels(
acc.dungeons,
acc.currentTier,
acc.bossDefeated,
acc.currentDay,
acc.currentHour,
acc.tierStartDay,
);
acc.dungeons = threatResult.dungeons;
acc.logsToAppend.push(...threatResult.logs);

// 2. 最大到達脅威度を追跡
if (threatResult.maxThreatReached > acc.maxThreatLevelReached) {
acc.maxThreatLevelReached = threatResult.maxThreatReached;
}

// 3. 襲撃イベントの生成（同時に進行できる襲撃は1件のみ）
if (acc.raid) {
// 進軍・防衛戦の間、そのダンジョンの脅威度は 100% に留まる
// （お布施等で一時的に下がっても、群れが引くわけではない）。
const raidDungeon = acc.dungeons.find((d) => d.id === acc.raid!.dungeonId);
if (
raidDungeon &&
raidDungeon.threatLevel < THREAT_MAX &&
raidDungeon.unlockedAtTier === acc.currentTier &&
!acc.bossDefeated
) {
acc.dungeons = acc.dungeons.map((d) =>
d.id === raidDungeon.id? {...d, threatLevel: THREAT_MAX}: d,
);
}
} else if (threatResult.raidDungeonId) {
const dungeon = acc.dungeons.find((d) => d.id === threatResult.raidDungeonId);
if (dungeon) {
const now = getTotalElapsedHours(acc.currentDay, acc.currentHour);
const raid = buildRaidState(dungeon, now);
if (raid) {
acc.raid = raid;
acc.logsToAppend.push({
message: `${dungeon.name} の魔物 ${raid.monsterIds.length} 体が町へ進軍中です（到着まで ${RAID_MARCH_HOURS} 時間）。`,
type: "warning",
});
} else {
// 編成できる魔物がいないダンジョンでは襲撃が発生しない（防御的フォールバック）
acc.dungeons = acc.dungeons.map((d) =>
d.id === dungeon.id? {...d, threatLevel: THREAT_MAX - 50}: d,
);
}
}
}

return acc;
};
