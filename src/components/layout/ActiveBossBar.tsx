import { Sword, Users, X } from "lucide-react";
import React from "react";

import { useBossActions, useDungeons, useVillagers } from "../../hooks";
import type { ActiveBossState, DungeonMonster, Villager } from "../../types/game";

/**
 * Fixed bar shown when an active boss battle is in progress.
 * Promoted from DungeonPanel inline display (P2-3) for better visibility.
 *
 * Layout: Boss HP (top) + Attacker total HP (bottom) in the main column.
 * Both bars share the same structure [bar flex-1] [value w-24] so the bar
 * tracks and the value columns align at the same x positions.
 */
export const ActiveBossBar: React.FC = () => {
  const { dungeons, activeBoss } = useDungeons();
  const villagers = useVillagers();
  const { withdrawFromBossBattle } = useBossActions();

  // 表示用の状態と、残存表示のためのタイマー制御
  const [cachedBoss, setCachedBoss] = React.useState<ActiveBossState | null>(null);
  const [cachedBossData, setCachedBossData] = React.useState<DungeonMonster | null>(null);
  const [cachedAttackers, setCachedAttackers] = React.useState<Villager[]>([]);
  const [shouldShow, setShouldShow] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (activeBoss) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCachedBoss(activeBoss);
      setShouldShow(true);

      const bossArea = dungeons.find((d) => d.monsters.some((m) => m.id === activeBoss.monsterId));
      const boss = bossArea?.monsters.find((m) => m.id === activeBoss.monsterId);
      if (boss) {
        setCachedBossData(boss);
      }
      const attackers = activeBoss.attackerIds
        .map((id) => villagers.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v));
      setCachedAttackers(attackers);
    }
  }, [activeBoss, dungeons, villagers]);

  // activeBoss が null になったら 2秒後にゲージを消す
  React.useEffect(() => {
    if (activeBoss) return;
    if (!cachedBoss) {
      setShouldShow(false);
      return;
    }
    // HP を 0 にして 2秒待つ
    setCachedBoss((prev: ActiveBossState | null) => (prev ? { ...prev, currentHp: 0 } : null));
    const timer = setTimeout(() => {
      setShouldShow(false);
      setCachedBoss(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeBoss]);

  if (!shouldShow || !cachedBoss) return null;

  const bossHpPct = (cachedBoss.currentHp / cachedBoss.maxHp) * 100;

  // アタッカー集計
  const totalCurrentHp = cachedAttackers.reduce((sum, v) => sum + Math.max(0, v.currentHp), 0);
  const totalMaxHp = cachedAttackers.reduce((sum, v) => sum + v.maxHp, 0);
  const attackerHpPct = totalMaxHp > 0 ? (totalCurrentHp / totalMaxHp) * 100 : 0;
  const deadCount = cachedAttackers.filter((v) => v.currentHp <= 0).length;

  return (
    <div className="bg-red-950/30 border-b border-red-900/50 shrink-0 animate-pulse-slow">
      <div className="px-6 py-2.5 flex items-center gap-4">
        <Sword className="w-5 h-5 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest shrink-0">
              BOSS BATTLE
            </span>
            <span className="text-sm font-black text-white italic truncate">
              VS {cachedBossData?.name || "Boss"}
            </span>
            <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider ml-auto shrink-0">
              ATK HP
            </span>
          </div>

          {/* Boss HP bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-950 rounded-full h-2 border border-red-900/30 overflow-hidden">
              <div
                className="bg-linear-to-r from-red-600 to-rose-500 h-full transition-all duration-500"
                style={{ width: `${bossHpPct}%` }}
              />
            </div>
            <span className="text-[11px] font-black text-red-400 font-mono shrink-0 w-24 text-right">
              {Math.ceil(cachedBoss.currentHp)} / {cachedBoss.maxHp}
            </span>
          </div>

          {/* Attacker total HP bar */}
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 bg-slate-950 rounded-full h-2 border border-sky-900/30 overflow-hidden">
              <div
                className="bg-linear-to-r from-sky-500 to-cyan-400 h-full transition-all duration-500"
                style={{ width: `${attackerHpPct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-sky-400 font-mono shrink-0 w-24 text-right">
              {Math.floor(totalCurrentHp)} / {totalMaxHp}
              {deadCount > 0 && <span className="text-red-400 ml-1">(瀕死 {deadCount})</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <div className="flex -space-x-2">
            {cachedAttackers.map((v) => {
              const isDead = v.currentHp <= 0;
              const isLow = !isDead && v.currentHp / v.maxHp < 0.3;
              return (
                <div
                  key={v.id}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    isDead
                      ? "bg-slate-900 border-slate-700 text-slate-600 line-through"
                      : isLow
                        ? "bg-red-950 border-red-700 text-red-300"
                        : "bg-slate-800 border-slate-950 text-sky-400"
                  }`}
                  title={
                    isDead
                      ? `${v.name}: 死亡`
                      : `${v.name}: ${Math.floor(v.currentHp)} / ${v.maxHp}`
                  }
                >
                  {v.name[0]}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={withdrawFromBossBattle}
          disabled={!activeBoss}
          className="px-3 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-white rounded text-[10px] font-bold transition flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-3 h-3" />
          撤退
        </button>
      </div>
    </div>
  );
};
