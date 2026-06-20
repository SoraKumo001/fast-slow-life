import {
  TIER_LIMIT_DAYS,
  BOSS_BATTLE_ROUNDS,
  BOSS_REGEN_PERCENT,
  STARVATION_EFFICIENCY_PENALTY,
  ZERO_STAMINA_PENALTY,
  WARRIOR_DAMAGE_BONUS,
  MIN_DAMAGE,
  MIN_BOSS_DAMAGE,
  EDUCATION_EXP_BONUS,
  STAT_GROWTH_PER_LEVEL,
  HP_GROWTH_PER_LEVEL,
  EXP_NEEDED_PER_LEVEL,
} from "../constants";
import { ITEMS, MONSTERS } from "../data/masterData";
import { Villager, DungeonArea, ActiveBossState } from "../types/game";
import { LogPayload } from "./gameLoopTypes";

export function processBossBattle(
  activeBoss: ActiveBossState | null,
  villagers: Villager[],
  _dungeons: DungeonArea[],
  currentTier: number,
  bossDefeated: boolean,
  gameLimitDays: number,
  hasStarvation: boolean,
  soulUpgrades: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  let nextActiveBoss = activeBoss ? { ...activeBoss } : null;
  let nextVillagers = [...villagers];
  let nextBossDefeated = bossDefeated;
  let nextCurrentTier = currentTier;
  let nextGameLimitDays = gameLimitDays;

  if (nextActiveBoss) {
    const monster = MONSTERS[nextActiveBoss.monsterId];
    const attackers = nextVillagers.filter(
      (v) => nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active",
    );

    if (attackers.length > 0) {
      const regen = Math.floor(nextActiveBoss.maxHp * BOSS_REGEN_PERCENT);
      nextActiveBoss.currentHp = Math.min(nextActiveBoss.maxHp, nextActiveBoss.currentHp + regen);

      for (let t = 0; t < BOSS_BATTLE_ROUNDS; t++) {
        if (nextActiveBoss.currentHp <= 0) break;
        attackers.forEach((v) => {
          if (v.currentHp <= 0 || nextActiveBoss!.currentHp <= 0) return;
          const weaponAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
          const efficiency =
            (hasStarvation ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
            (v.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);
          const vAtk = Math.floor(
            (v.str * 1.5 + weaponAtk) *
              (v.currentJob === "戦士" ? WARRIOR_DAMAGE_BONUS : 1.0) *
              efficiency,
          );
          const damage = Math.max(MIN_DAMAGE, vAtk - monster.def);
          nextActiveBoss!.currentHp -= damage;
        });

        if (nextActiveBoss.currentHp > 0) {
          const target = attackers[Math.floor(Math.random() * attackers.length)];
          if (target && target.currentHp > 0) {
            const vIdx = nextVillagers.findIndex((v) => v.id === target.id);
            if (vIdx !== -1) {
              const villager = { ...nextVillagers[vIdx] };
              const armorDef = ITEMS[villager.armorId]?.equipment?.bonuses.defense || 0;
              const efficiency =
                (hasStarvation ? STARVATION_EFFICIENCY_PENALTY : 1.0) *
                (villager.stamina === 0 ? ZERO_STAMINA_PENALTY : 1.0);
              const vDef = Math.floor((villager.vit + armorDef) * efficiency);
              const damage = Math.max(MIN_BOSS_DAMAGE, monster.atk - vDef);
              villager.currentHp = Math.max(0, villager.currentHp - damage);
              nextVillagers[vIdx] = villager;
            }
          }
        }
      }

      // 戦闘不能（HP0）になったアタッカーを強制帰還させ、アタッカーリストから除外
      nextVillagers = nextVillagers.map((v) => {
        if (
          nextActiveBoss?.attackerIds.includes(v.id) &&
          v.status === "active" &&
          v.currentHp <= 0
        ) {
          const area = _dungeons.find((d) => d.id === v.destinationAreaId);
          const distance = area ? area.distance : 2;
          logs.push({
            message: `${v.name} がボス戦で戦闘不能になりました。村への帰還を開始します（残り時間: ${distance}h）。`,
            type: "warning",
          });
          return {
            ...v,
            status: "traveling_back",
            travelTimeLeft: distance,
            order: "rest",
            autoTargetName: null,
          };
        }
        return v;
      });

      if (nextActiveBoss) {
        nextActiveBoss.attackerIds = nextActiveBoss.attackerIds.filter((id) => {
          const v = nextVillagers.find((villager) => villager.id === id);
          return v && v.currentHp > 0;
        });
      }

      if (nextActiveBoss && nextActiveBoss.currentHp <= 0) {
        logs.push({
          message: `エリアボス【${monster.name}】を撃破しました！`,
          type: "system",
        });
        nextBossDefeated = true;

        nextVillagers = nextVillagers.map((v) => {
          if (nextActiveBoss?.attackerIds.includes(v.id) && v.status === "active") {
            const updatedV = { ...v };
            if (updatedV.currentHp > 0) {
              const eduBonus = 1.0 + (soulUpgrades.education || 0) * EDUCATION_EXP_BONUS;
              const expGained = Math.floor(monster.expReward * eduBonus);
              updatedV.exp += expGained;
              const expNeeded = updatedV.level * EXP_NEEDED_PER_LEVEL;
              if (updatedV.exp >= expNeeded) {
                updatedV.level += 1;
                updatedV.exp -= expNeeded;
                updatedV.str += STAT_GROWTH_PER_LEVEL;
                updatedV.int += STAT_GROWTH_PER_LEVEL;
                updatedV.dex += STAT_GROWTH_PER_LEVEL;
                updatedV.agi += STAT_GROWTH_PER_LEVEL;
                updatedV.vit += STAT_GROWTH_PER_LEVEL;
                updatedV.maxHp += HP_GROWTH_PER_LEVEL;
                updatedV.currentHp = updatedV.maxHp;
                logs.push({
                  message: `${updatedV.name} が レベル ${updatedV.level} に上がりました！`,
                  type: "info",
                });
              }
            }
            updatedV.status = "idle";
            return updatedV;
          }
          return v;
        });

        if (nextCurrentTier < 5) {
          nextCurrentTier += 1;
          nextGameLimitDays = TIER_LIMIT_DAYS[nextCurrentTier];
          nextBossDefeated = false;
          logs.push({
            message: `新しいエリアと施設が解放されました！ 次のボス期限は ${nextGameLimitDays} 日目まで。`,
            type: "system",
          });
        }
        nextActiveBoss = null;
      }
    } else {
      const regen = Math.floor(nextActiveBoss.maxHp * BOSS_REGEN_PERCENT);
      nextActiveBoss.currentHp = Math.min(nextActiveBoss.maxHp, nextActiveBoss.currentHp + regen);
    }
  }

  return {
    activeBoss: nextActiveBoss,
    villagers: nextVillagers,
    bossDefeated: nextBossDefeated,
    currentTier: nextCurrentTier,
    gameLimitDays: nextGameLimitDays,
    logs,
  };
}
