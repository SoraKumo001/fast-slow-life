import React, { useState } from "react";
import { useGameStore, ITEMS } from "../../store/gameStore";
import { DungeonArea } from "../../types/game";
import { Compass, ShieldAlert, Users, Footprints, Sword, X } from "lucide-react";
import { DungeonAssignModal } from "../modals/DungeonAssignModal";
import { BossBattleModal } from "../modals/BossBattleModal";

export const DungeonPanel: React.FC = () => {
  const { dungeons, villagers, currentTier, bossDefeated, activeBoss, withdrawFromBossBattle } =
    useGameStore();
  const [selectedArea, setSelectedArea] = useState<DungeonArea | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBossModal, setShowBossModal] = useState(false);

  const getActiveVillagersInArea = (areaId: string) => {
    return villagers.filter((v) => v.destinationAreaId === areaId);
  };

  const getIdleVillagers = () => {
    return villagers.filter((v) => v.status === "idle");
  };

  const handleOpenAssign = (area: DungeonArea) => {
    setSelectedArea(area);
    setShowAssignModal(true);
  };

  const handleOpenBossBattle = (area: DungeonArea) => {
    setSelectedArea(area);
    setShowBossModal(true);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full relative">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Compass className="w-5 h-5 text-sky-400" />
        ダンジョン・探索派遣
      </h2>

      {/* アクティブなボス戦表示 */}
      {activeBoss && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl animate-pulse-slow">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                Decision Battle
              </span>
              <h3 className="text-lg font-black text-white italic">
                VS{" "}
                {useGameStore
                  .getState()
                  .dungeons.find((d) => d.monsters.some((m) => m.id === activeBoss.monsterId))
                  ?.monsters.find((m) => m.id === activeBoss.monsterId)?.name || "Boss"}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-mono">BOSS HP</span>
              <div className="text-sm font-black text-red-400 font-mono">
                {Math.ceil(activeBoss.currentHp)} / {activeBoss.maxHp}
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-3 border border-red-900/30 overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-500"
              style={{ width: `${(activeBoss.currentHp / activeBoss.maxHp) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex -space-x-2">
              {activeBoss.attackerIds.map((id) => {
                const v = villagers.find((vil) => vil.id === id);
                return (
                  <div
                    key={id}
                    className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-sky-400"
                    title={v?.name}
                  >
                    {v?.name[0]}
                  </div>
                );
              })}
            </div>
            <button
              onClick={withdrawFromBossBattle}
              className="px-3 py-1 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-white rounded text-[10px] font-bold transition flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              撤退する
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {dungeons.map((area) => {
          const isUnlocked = area.unlockedAtTier <= currentTier;
          const activeInArea = getActiveVillagersInArea(area.id);
          const boss = area.monsters.find((m) => m.isBoss);
          const isBossAvailable = area.explorationProgress >= 100;
          const isBossDefeatedInThisArea =
            currentTier > area.unlockedAtTier ||
            (currentTier === area.unlockedAtTier && bossDefeated);

          return (
            <div
              key={area.id}
              className={`border rounded-xl p-4 transition-all duration-200 ${
                isUnlocked
                  ? "bg-slate-950/70 border-slate-800"
                  : "bg-slate-950/10 border-dashed border-slate-900 opacity-50"
              }`}
            >
              {/* ダンジョン基本情報 */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                    {area.name}
                    {!isUnlocked && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950 border border-red-900 text-red-400 font-bold uppercase">
                        未解放
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    推奨Lv.{area.recommendedLevel} • 片道 {area.distance}時間
                  </p>
                </div>

                {isUnlocked && (
                  <div className="flex gap-2">
                    {isBossAvailable && !isBossDefeatedInThisArea && !activeBoss && (
                      <button
                        onClick={() => handleOpenBossBattle(area)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-[10px] font-black text-white rounded-lg transition animate-pulse-slow shadow-lg shadow-amber-900/20"
                      >
                        <Sword className="w-3.5 h-3.5" />
                        ボスと対決
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAssign(area)}
                      disabled={getIdleVillagers().length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-semibold text-white rounded-lg transition"
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      派遣する
                    </button>
                  </div>
                )}
              </div>

              {/* 探索度プログレスバー */}
              {isUnlocked && (
                <div className="mt-2 mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-400 font-medium">探索度</span>
                    <span className="text-sky-400 font-bold font-mono">
                      {Math.floor(area.explorationProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-900 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${area.explorationProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {isUnlocked && (
                <div className="space-y-2.5 mt-2 border-t border-slate-900 pt-3">
                  {/* 採取可能アイテム & 出現モンスター */}
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div>
                      <span className="font-bold text-slate-400 block mb-1">採れる素材:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono">
                        {area.gathers.map((g) => {
                          const isItemUnlocked =
                            area.explorationProgress >= (g.unlockedAtProgress || 0);
                          return (
                            <li
                              key={g.itemId}
                              className={isItemUnlocked ? "" : "text-slate-600 font-normal"}
                            >
                              {isItemUnlocked
                                ? `${ITEMS[g.itemId].name} (難度 ${g.difficulty})`
                                : `??? (${g.unlockedAtProgress}%で解放)`}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block mb-1">主な魔物:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono">
                        {area.monsters.map((m) => {
                          const isMonsUnlocked =
                            area.explorationProgress >= (m.unlockedAtProgress || 0);
                          return (
                            <li
                              key={m.id}
                              className={
                                isMonsUnlocked
                                  ? m.isBoss
                                    ? "text-amber-400 font-bold"
                                    : ""
                                  : "text-slate-600 font-normal"
                              }
                            >
                              {isMonsUnlocked
                                ? `${m.name} ${m.isBoss ? "(ボス)" : `(Lv.${m.level})`}`
                                : `??? (${m.unlockedAtProgress}%で解放)`}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* 現在派遣中の村人 */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-900/40 p-2 rounded border border-slate-900">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mr-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-sky-400" />
                      派遣中:
                    </span>
                    {activeInArea.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic">なし</span>
                    ) : (
                      activeInArea.map((v) => (
                        <span
                          key={v.id}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                            v.status === "active"
                              ? "bg-sky-950/40 border-sky-850 text-sky-400"
                              : "bg-amber-955/20 border-amber-900 text-amber-400"
                          }`}
                          title={`現在方針: ${v.order === "gather" ? "採取" : "討伐"}`}
                        >
                          {v.name} ({v.order === "gather" ? "採" : "討"})
                        </span>
                      ))
                    )}
                  </div>

                  {/* エリアボス撃破状況 */}
                  {boss && (
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-slate-400">エリアボス:</span>
                      {currentTier > area.unlockedAtTier ||
                      (currentTier === area.unlockedAtTier && bossDefeated) ? (
                        <span className="text-emerald-400 font-bold">撃破済</span>
                      ) : (
                        <span className="text-amber-505 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> 未撃破
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 派遣アサインモーダル */}
      {showAssignModal && selectedArea && (
        <DungeonAssignModal
          area={selectedArea}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedArea(null);
          }}
        />
      )}

      {/* ボス討伐編成モーダル */}
      {showBossModal && selectedArea && (
        <BossBattleModal
          area={selectedArea}
          onClose={() => {
            setShowBossModal(false);
            setSelectedArea(null);
          }}
        />
      )}
    </div>
  );
};
