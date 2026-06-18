import React, { useState } from 'react';
import { useGameStore, ITEMS } from '../store/gameStore';
import { DungeonArea } from '../types/game';
import { Compass, ShieldAlert, Users, Footprints, AlertCircle } from 'lucide-react';

export const DungeonPanel: React.FC = () => {
  const { dungeons, villagers, currentTier, bossDefeated, setVillagerOrder } = useGameStore();
  const [selectedArea, setSelectedArea] = useState<DungeonArea | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const getActiveVillagersInArea = (areaId: string) => {
    return villagers.filter(v => v.destinationAreaId === areaId);
  };

  const getIdleVillagers = () => {
    return villagers.filter(v => v.status === 'idle');
  };

  const handleOpenAssign = (area: DungeonArea) => {
    setSelectedArea(area);
    setShowAssignModal(true);
  };

  const handleAssign = (vId: string, order: 'gather' | 'hunt') => {
    if (selectedArea) {
      setVillagerOrder(vId, order, selectedArea.id);
      setShowAssignModal(false);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Compass className="w-5 h-5 text-sky-400" />
        ダンジョン・探索派遣
      </h2>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {dungeons.map((area) => {
          const isUnlocked = area.unlockedAtTier <= currentTier;
          const activeInArea = getActiveVillagersInArea(area.id);
          const boss = area.monsters.find(m => m.isBoss);

          return (
            <div
              key={area.id}
              className={`border rounded-xl p-4 transition-all duration-200 ${
                isUnlocked
                  ? 'bg-slate-950/70 border-slate-800'
                  : 'bg-slate-950/10 border-dashed border-slate-900 opacity-50'
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
                  <button
                    onClick={() => handleOpenAssign(area)}
                    disabled={getIdleVillagers().length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-semibold text-white rounded-lg transition"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    派遣する
                  </button>
                )}
              </div>

              {isUnlocked && (
                <div className="space-y-2.5 mt-3 border-t border-slate-900 pt-3">
                  {/* 採取可能アイテム & 出現モンスター */}
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div>
                      <span className="font-bold text-slate-400 block mb-1">採れる素材:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono">
                        {area.gathers.map(g => (
                          <li key={g.itemId}>{ITEMS[g.itemId].name} (難度 {g.difficulty})</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block mb-1">主な魔物:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono">
                        {area.monsters.map(m => (
                          <li key={m.id} className={m.isBoss ? 'text-amber-400 font-bold' : ''}>
                            {m.name} {m.isBoss ? '(ボス)' : `(Lv.${m.level})`}
                          </li>
                        ))}
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
                      activeInArea.map(v => (
                        <span
                          key={v.id}
                          className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                            v.status === 'active'
                              ? 'bg-sky-950/40 border-sky-850 text-sky-400'
                              : 'bg-amber-955/20 border-amber-900 text-amber-400'
                          }`}
                          title={`現在方針: ${v.order === 'gather' ? '採取' : '討伐'}`}
                        >
                          {v.name} ({v.order === 'gather' ? '採' : '討'})
                        </span>
                      ))
                    )}
                  </div>

                  {/* エリアボス撃破状況 */}
                  {boss && (
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-slate-400">エリアボス:</span>
                      {bossDefeated && currentTier >= area.unlockedAtTier ? (
                        <span className="text-emerald-400 font-bold">撃破済</span>
                      ) : (
                        <span className="text-amber-500 font-bold flex items-center gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">村人を {selectedArea.name} へ派遣</h3>
              <p className="text-xs text-slate-400 font-mono">
                推奨レベル: {selectedArea.recommendedLevel} • 必要移動時間: {selectedArea.distance}時間
              </p>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {getIdleVillagers().length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">派遣できる待機中の村人がいません。</p>
              ) : (
                getIdleVillagers().map((v) => {
                  const isLvOk = v.level >= selectedArea.recommendedLevel;

                  return (
                    <div
                      key={v.id}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-sm text-slate-200 block">{v.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Lv.{v.level} • {v.currentJob} • HP:{v.currentHp}/{v.maxHp}
                        </span>
                        {!isLvOk && (
                          <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5 mt-1">
                            <AlertCircle className="w-3 h-3" /> レベル不足注意
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAssign(v.id, 'gather')}
                          className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] transition"
                        >
                          採取派遣
                        </button>
                        <button
                          onClick={() => handleAssign(v.id, 'hunt')}
                          className="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-medium text-[10px] transition"
                        >
                          討伐派遣
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
