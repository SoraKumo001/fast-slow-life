import React, { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { DungeonArea, Villager } from "../../types/game";
import { AlertCircle, Sword } from "lucide-react";

interface BossBattleModalProps {
  area: DungeonArea;
  onClose: () => void;
}

export const BossBattleModal: React.FC<BossBattleModalProps> = ({ area, onClose }) => {
  const { villagers, startBossBattle } = useGameStore();
  const [selectedAttackerIds, setSelectedAttackerIds] = useState<string[]>([]);

  const getIdleVillagers = () => {
    return villagers.filter((v: Villager) => v.status === "idle");
  };

  const toggleAttacker = (vId: string) => {
    if (selectedAttackerIds.includes(vId)) {
      setSelectedAttackerIds(selectedAttackerIds.filter((id) => id !== vId));
    } else if (selectedAttackerIds.length < 4) {
      setSelectedAttackerIds([...selectedAttackerIds, vId]);
    }
  };

  const handleStartBossBattle = () => {
    if (selectedAttackerIds.length > 0) {
      const boss = area.monsters.find((m) => m.isBoss);
      if (boss) {
        startBossBattle(boss.id, selectedAttackerIds);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-8 space-y-6 shadow-2xl">
        <div className="text-center">
          <span className="text-amber-500 font-black tracking-widest text-xs uppercase mb-1 block">
            Boss Decisive Battle
          </span>
          <h3 className="text-2xl font-black text-white italic">
            {area.monsters.find((m) => m.isBoss)?.name} との決戦
          </h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            最大4名まで選択可能です。ボスのHPは継続し、自然回復します。
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {getIdleVillagers().length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8 bg-slate-950 rounded-xl border border-dashed border-slate-800">
              現在、派遣可能な待機中の村人がいません。
            </p>
          ) : (
            getIdleVillagers().map((v: Villager) => {
              const isSelected = selectedAttackerIds.includes(v.id);
              const isLvOk = v.level >= area.recommendedLevel;

              return (
                <div
                  key={v.id}
                  onClick={() => toggleAttacker(v.id)}
                  className={`cursor-pointer border-2 rounded-xl p-4 flex items-center justify-between transition-all duration-200 ${
                    isSelected
                      ? "bg-amber-950/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                      : "bg-slate-950 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                        isSelected
                          ? "bg-amber-500 border-amber-400 text-amber-950"
                          : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                    >
                      {v.name[0]}
                    </div>
                    <div>
                      <span
                        className={`font-bold text-base block ${isSelected ? "text-amber-400" : "text-slate-200"}`}
                      >
                        {v.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Lv.{v.level} • {v.currentJob}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          HP: {v.currentHp}/{v.maxHp}
                        </span>
                      </div>
                      {!isLvOk && (
                        <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5 mt-1">
                          <AlertCircle className="w-3 h-3" /> 非推奨レベル
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Sword className="w-5 h-5 text-amber-500" />}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartBossBattle}
            disabled={selectedAttackerIds.length === 0}
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-900/20 disabled:shadow-none flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Sword className="w-5 h-5" />
            決戦を開始する ({selectedAttackerIds.length} / 4)
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition"
          >
            今はやめておく
          </button>
        </div>
      </div>
    </div>
  );
};
