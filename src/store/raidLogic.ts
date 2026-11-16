/**
* Phase 4b: 襲撃イベント（脅威度100%の置き換え）。
*
* - 脅威度が 100% に達したダンジョンから魔物の群れが町へ進軍する（到着まで6時間）
* - 到着後は1時間に1ラウンドの防衛戦を解決する（戦闘式は combatEngine をそのまま使う）
* - 勝利: 脅威度 30% リセット＋戦利品 / 敗北: 略奪（金庫20%・在庫・施設Lv）＋脅威度 50%
* - 脅威度でゲームオーバーになることは二度とない
*/

import { EDUCATION_EXP_BONUS} from "../constants";
import { ITEMS} from "../data/masterData";
import type {
DungeonArea,
DungeonMonster,
Facility,
FacilityType,
RaidState,
RunStats,
Villager,
} from "../types/game";
import { isMagicJob} from "../utils/villagerHelpers";
import {
applySalaryDebuff,
executeEnemyAttack,
executePlayerAttack,
getFoodBuffBonus,
useBattlePotion,
} from "./combatEngine";
import type { LogPayload} from "./gameLoopTypes";
import { tryLevelUp} from "./levelUpHelper";
import { getTotalElapsedHours} from "./threatLogic";

export { getTotalElapsedHours};

/** 進軍にかかる時間（時間） */
export const RAID_MARCH_HOURS = 6;
/** 襲撃グループの最小・最大体数 */
export const RAID_MIN_MONSTERS = 3;
export const RAID_MAX_MONSTERS = 5;
/** 勝利時の脅威度リセット値 */
export const RAID_VICTORY_THREAT = 30;
/** 敗北時の脅威度リセット値 */
export const RAID_DEFEAT_THREAT = 50;
/** 敗北時に略奪される金庫の割合 */
export const RAID_PILLAGE_GOLD_RATE = 0.2;

// ==========================================
// 襲撃グループの編成
// ==========================================

/** 強さ順ソートキー: レベル降順 → 攻撃降順 → HP降順 → ID昇順（決定的） */
function compareMonsterStrength(a: DungeonMonster, b: DungeonMonster): number {
if (b.level!== a.level) return b.level - a.level;
if (b.atk!== a.atk) return b.atk - a.atk;
if (b.maxHp!== a.maxHp) return b.maxHp - a.maxHp;
return a.id < b.id? -1: a.id > b.id? 1: 0;
}

/**
* 襲撃グループの素となるモンスターを決定論的に選ぶ。
* そのダンジョンの非ボス魔物を強さ順に並べ、3〜5体になるよう先頭から取る。
* 種類が足りない場合は先頭から循環して補う（インスタンスIDで区別される）。
*/
export function selectRaidMonsterBases(dungeon: DungeonArea): DungeonMonster[] {
const roster = dungeon.monsters.filter((m) =>!m.isBoss).sort(compareMonsterStrength);
if (roster.length === 0) return [];
const count = Math.max(
RAID_MIN_MONSTERS,
Math.min(RAID_MAX_MONSTERS, roster.length),
);
return Array.from({ length: count}, (_, i) => roster[i % roster.length]);
}

/** インスタンスID（同種の複数個体を区別する） */
export function raidInstanceId(baseMonsterId: string, index: number): string {
return `${baseMonsterId}@${index + 1}`;
}

/** インスタンスIDから素のモンスターIDを取り出す */
export function raidBaseMonsterId(instanceId: string): string {
const at = instanceId.lastIndexOf("@");
return at >= 0? instanceId.slice(0, at): instanceId;
}

/** 脅威度100%到達時に襲撃状態を生成する。編成できる魔物がいなければ null。 */
export function buildRaidState(
dungeon: DungeonArea,
nowElapsedHour: number,
): RaidState | null {
const bases = selectRaidMonsterBases(dungeon);
if (bases.length === 0) return null;
const monsterIds = bases.map((m, i) => raidInstanceId(m.id, i));
const monsterHps: Record<string, number> = {};
monsterIds.forEach((id, i) => {
monsterHps[id] = bases[i].maxHp;
});
return {
dungeonId: dungeon.id,
arrivesAtElapsedHour: nowElapsedHour + RAID_MARCH_HOURS,
monsterIds,
monsterHps,
};
}

// ==========================================
// 状態参照
// ==========================================

/** 襲撃側モンスターの現在HP（保存値が無い旧データでは満タンとして扱う） */
export function getRaidMonsterHp(
raid: RaidState,
dungeon: DungeonArea,
instanceId: string,
): number {
const stored = raid.monsterHps?.[instanceId];
if (typeof stored === "number") return stored;
const base = dungeon.monsters.find((m) => m.id === raidBaseMonsterId(instanceId));
return base? base.maxHp: 0;
}

/** 生存している襲撃モンスター数 */
export function countAliveRaidMonsters(raid: RaidState, dungeon: DungeonArea): number {
return raid.monsterIds.filter((id) => getRaidMonsterHp(raid, dungeon, id) > 0).length;
}

/** 防衛戦が始まっているか（到着時刻を過ぎているか） */
export function isRaidFighting(raid: RaidState | null, nowElapsedHour: number): boolean {
return raid!= null && nowElapsedHour >= raid.arrivesAtElapsedHour;
}

/** 村人が「町にいる」か（移動中・ダンジョン活動中は町外） */
export function isVillagerInTown(v: Villager): boolean {
if (v.status === "traveling_to" || v.status === "traveling_back") return false;
if (v.status === "active" && v.destinationAreaId!= null) return false;
return true;
}

/** 防衛側 = 町にいて HP が残っている村人全員（休息中も含む） */
export function getRaidDefenders(villagers: Villager[]): Villager[] {
return villagers.filter((v) => isVillagerInTown(v) && v.currentHp > 0);
}

// ==========================================
// 防衛戦ラウンド
// ==========================================

export interface RaidRoundParams {
raid: RaidState;
dungeon: DungeonArea;
villagers: Villager[];
inventory: Record<string, number>;
gold: number;
facilities: Record<FacilityType, Facility>;
soulUpgrades?: Record<string, number>;
stats?: RunStats;
}

export interface RaidRoundResult {
villagers: Villager[];
raid: RaidState | null;
dungeon: DungeonArea;
inventory: Record<string, number>;
gold: number;
facilities: Record<FacilityType, Facility>;
logs: LogPayload[];
outcome: "ongoing" | "victory" | "defeat";
}

interface RaidCombatant {
instanceId: string;
base: DungeonMonster;
hp: number;
}

/**
* 防衛戦を1ラウンド（1時間分）解決する。
* 流れは processPartyHunt のパーティ戦闘に倣う:
* ポーション → 僧侶ヒール → 防衛側全員の攻撃（AGI降順、先頭の敵へ集中）
* → 生存モンスター全員の攻撃（最低HPの防衛者を狙う）。
* 襲撃側のHPは RaidState.monsterHps に書き戻され、ラウンドをまたいで保持される。
*/
export function resolveRaidRound(params: RaidRoundParams): RaidRoundResult {
const { raid, dungeon, soulUpgrades = {}, stats} = params;
const logs: LogPayload[] = [];
let nextInventory = {...params.inventory};
let nextGold = params.gold;
let nextFacilities = params.facilities;
const nextVillagers = params.villagers.map((v) => ({...v}));

// 襲撃側の戦闘状態を復元
const combatants: RaidCombatant[] = [];
for (const instanceId of raid.monsterIds) {
const base = dungeon.monsters.find((m) => m.id === raidBaseMonsterId(instanceId));
if (!base) continue;
combatants.push({ instanceId, base, hp: getRaidMonsterHp(raid, dungeon, instanceId)});
}

const defenders = getRaidDefenders(nextVillagers);
const aliveMonsters = () => combatants.filter((c) => c.hp > 0);
const aliveDefenders = () => defenders.filter((v) => v.currentHp > 0);

const writeBackMonsterHps = (): Record<string, number> => {
const hps: Record<string, number> = {...(raid.monsterHps?? {})};
for (const c of combatants) hps[c.instanceId] = Math.max(0, c.hp);
return hps;
};

// 戦闘不能になった防衛者を休息へ回す（死亡はしない）
const settleDownedDefenders = () => {
for (const v of defenders) {
if (v.currentHp <= 0 && v.status!== "resting") {
v.currentHp = 0;
v.status = "resting";
v.order = "rest";
v.autoTargetName = null;
logs.push({
message: `${v.name} は戦闘不能になった…（宿屋で休息します）`,
type: "warning",
});
} else if (v.currentHp <= 0) {
v.currentHp = 0;
}
}
};

// ── 戦闘（防衛者がいる場合のみ） ──
if (defenders.length > 0 && aliveMonsters().length > 0) {
// ① ポーション使用（processPartyHunt と同じ作法）
for (const v of defenders) {
if (v.currentHp <= 0) continue;
const potionResult = useBattlePotion(v, v.gold < 0);
if (potionResult.used) {
v.potionCount = potionResult.updated.potionCount;
v.currentHp = potionResult.updated.currentHp;
if (stats) stats.totalPotionHealing += potionResult.healed;
logs.push({
message: `${v.name} は${ITEMS[v.potionItemId || "potion"]?.name || "回復薬"}を使用し、HPを ${potionResult.healed} 回復した。 (残り ${v.potionCount} 個)`,
type: "combat",
});
}
}

// ② 僧侶ヒール（自身、HP 50% 以下で発動。processPartyHunt と同じ）
for (const v of defenders) {
if (v.currentHp <= 0 || v.currentJob!== "僧侶") continue;
const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
const effectiveInt = applySalaryDebuff(v.int + buffInt, v.gold < 0);
const buffMaxHp = getFoodBuffBonus(v.activeFoodBuffId || null, "maxHp");
const effectiveMaxHp = applySalaryDebuff(v.maxHp + buffMaxHp, v.gold < 0);
if (v.currentHp <= effectiveMaxHp * 0.5) {
const healAmount = Math.max(10, Math.floor(effectiveInt * 1.5 + 10));
const actualHeal = Math.min(effectiveMaxHp - v.currentHp, healAmount);
if (actualHeal > 0) {
v.currentHp += actualHeal;
logs.push({
message: `僧侶 ${v.name} はヒールを唱え、自身のHPを ${actualHeal} 回復した。`,
type: "combat",
});
}
}
}

// ③ 防衛側全員の攻撃（AGI降順、先頭の生存モンスターへ集中）
const attackers = [...defenders]
.filter((v) => v.currentHp > 0)
.sort((a, b) => b.agi - a.agi);
for (const v of attackers) {
const target = aliveMonsters()[0];
if (!target) break;
const result = executePlayerAttack({
attacker: v,
defender: target.base,
efficiency: 1.0,
isMagicUser: isMagicJob(v.currentJob),
isSalaryUnpaid: v.gold < 0,
stats,
logPrefix: "",
attackerName: v.name,
defenderName: ` ${target.base.name} `,
});
logs.push(result.log);
if (result.hit) {
target.hp -= result.damage;
if (target.hp <= 0) {
if (stats) stats.totalMonstersDefeated += 1;
logs.push({
message: `${target.base.name} を倒した！`,
type: "combat",
});
}
}
}

// ④ 生存モンスター全員の攻撃（その時点で最低HPの防衛者を狙う）
for (const c of aliveMonsters()) {
const target = aliveDefenders().sort((a, b) => a.currentHp - b.currentHp)[0];
if (!target) break;
const result = executeEnemyAttack({
attacker: c.base,
defender: target,
isSalaryUnpaid: target.gold < 0,
stats,
logPrefix: "",
attackerName: ` ${c.base.name} `,
defenderName: target.name,
});
logs.push(result.log);
if (result.hit) {
target.currentHp = Math.max(0, target.currentHp - result.damage);
}
}
}

settleDownedDefenders();

// ── 勝敗判定 ──
if (aliveMonsters().length === 0) {
// 勝利: 脅威度 30% + 戦利品 + 経験値
const loot = new Map<string, number>();
const gatherIds = dungeon.gathers.map((g) => g.itemId);
if (gatherIds.length > 0) {
for (const itemId of [...new Set(gatherIds)].slice(0, 3)) {
loot.set(itemId, 2);
}
} else {
for (const c of combatants) {
const dropId = c.base.drops[0]?.itemId;
if (dropId &&!loot.has(dropId) && loot.size < 3) loot.set(dropId, 1);
}
}
for (const [itemId, count] of loot) {
nextInventory[itemId] = (nextInventory[itemId] || 0) + count;
}
const lootText =
loot.size > 0
? [...loot.entries()]
.map(([itemId, count]) => `${ITEMS[itemId]?.name || itemId} x${count}`)
.join("、")
: "なし";

// 経験値（processPartyHunt と同じく生存者全員へ、教育ボーナス込み）
const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
const totalExp = combatants.reduce((sum, c) => sum + c.base.expReward, 0);
if (totalExp > 0) {
for (const v of aliveDefenders()) {
v.exp += Math.floor(totalExp * eduBonus);
const { leveled, updated} = tryLevelUp(v);
if (leveled) {
v.level = updated.level;
v.exp = updated.exp;
v.str = updated.str;
v.int = updated.int;
v.dex = updated.dex;
v.agi = updated.agi;
v.vit = updated.vit;
v.maxHp = updated.maxHp;
v.maxStamina = updated.maxStamina;
v.currentHp = updated.currentHp;
logs.push({
message: `${v.name} が レベル ${v.level} に上がりました！`,
type: "info",
});
}
}
}

logs.push({
message: `勝利！ ${dungeon.name} の群れを退けました。脅威度は ${RAID_VICTORY_THREAT}% に低下。戦利品: ${lootText}。`,
type: "info",
});

return {
villagers: nextVillagers,
raid: null,
dungeon: {...dungeon, threatLevel: RAID_VICTORY_THREAT},
inventory: nextInventory,
gold: nextGold,
facilities: nextFacilities,
logs,
outcome: "victory",
};
}

if (aliveDefenders().length === 0) {
// 敗北: 略奪（金庫20%・在庫の一部・施設Lv-1）+ 脅威度 50%。ゲームオーバーにはしない。
const goldLoss = nextGold > 0? Math.floor(nextGold * RAID_PILLAGE_GOLD_RATE): 0;
nextGold -= goldLoss;

const pillaged: string[] = [];
const stockedIds = Object.keys(nextInventory)
.filter((itemId) => (nextInventory[itemId] || 0) > 0)
.sort();
for (const itemId of stockedIds.slice(0, 3)) {
const count = nextInventory[itemId];
const taken = Math.min(count, 5, Math.max(1, Math.floor(count / 4)));
nextInventory[itemId] = count - taken;
pillaged.push(`${ITEMS[itemId]?.name || itemId} x${taken}`);
}

let facilityText = "なし";
const droppable = Object.values(nextFacilities)
.filter((f) => f.level >= 2)
.sort((a, b) => b.level - a.level || (a.id < b.id? -1: a.id > b.id? 1: 0));
if (droppable.length > 0) {
const target = droppable[0];
nextFacilities = {
...nextFacilities,
[target.id]: {...target, level: target.level - 1},
};
facilityText = `${target.name} が Lv.${target.level - 1} に低下`;
}

logs.push({
message: `敗北… ${dungeon.name} の群れに町を荒らされました。略奪: 金庫 ${goldLoss} G / 在庫 ${pillaged.length > 0? pillaged.join("、"): "なし"} / 施設被害 ${facilityText}。脅威度は ${RAID_DEFEAT_THREAT}% に低下。`,
type: "error",
});

return {
villagers: nextVillagers,
raid: null,
dungeon: {...dungeon, threatLevel: RAID_DEFEAT_THREAT},
inventory: nextInventory,
gold: nextGold,
facilities: nextFacilities,
logs,
outcome: "defeat",
};
}

// 継続: 襲撃側HPを書き戻す
return {
villagers: nextVillagers,
raid: {...raid, monsterHps: writeBackMonsterHps()},
dungeon,
inventory: nextInventory,
gold: nextGold,
facilities: nextFacilities,
logs,
outcome: "ongoing",
};
}
