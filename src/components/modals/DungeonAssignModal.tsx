import { AlertCircle } from "lucide-react";
import React from "react";

import { useGameStore } from "../../store/gameStore";
import { DungeonArea, Villager } from "../../types/game";

interface DungeonAssignModalProps {
  area: DungeonArea;
  onClose: () => void;
}

export const DungeonAssignModal: React.FC<DungeonAssignModalProps> = ({ area, onClose }) => {
  const { villagers, setVillagerOrder } = useGameStore();

  const getIdleVillagers = () => {
    return villagers.filter((v: Villager) => v.status === "idle");
  };

  const handleAssign = (vId: string, order: "gather" | "hunt") => {
    setVillagerOrder(vId, order, area.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">村人を {area.name} へ派遣</h3>
          <p className="text-xs text-slate-400 font-mono">
            推奨レベル: {area.recommendedLevel} • 必要移動時間: {area.distance}時間
          </p>
        </div>

        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {getIdleVillagers().length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              派遣できる待機中の村人がいません。
            </p>
          ) : (
            getIdleVillagers().map((v: Villager) => {
              const isLvOk = v.level >= area.recommendedLevel;

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
                      onClick={() => handleAssign(v.id, "gather")}
                      className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] transition"
                    >
                      採取派遣
                    </button>
                    <button
                      onClick={() => handleAssign(v.id, "hunt")}
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
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
