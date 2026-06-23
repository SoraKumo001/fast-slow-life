import { AlertCircle } from "lucide-react";
import React from "react";

import { useVillagers, useVillagerActions } from "../../hooks";
import { DungeonArea, Villager } from "../../types/game";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface DungeonAssignModalProps {
  area: DungeonArea;
  onClose: () => void;
}

export const DungeonAssignModal: React.FC<DungeonAssignModalProps> = ({ area, onClose }) => {
  const villagers = useVillagers();
  const { setVillagerOrder } = useVillagerActions();

  const getIdleVillagers = () => {
    return villagers.filter((v: Villager) => v.status === "idle");
  };

  const handleAssign = (vId: string, order: "gather" | "hunt") => {
    setVillagerOrder({ id: vId, order, areaId: area.id });
    onClose();
  };

  return (
    <Modal onClose={onClose} size="md">
      <div className="space-y-4">
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
                    <Button
                      onClick={() => handleAssign(v.id, "gather")}
                      variant="success"
                      size="sm"
                      className="px-2.5 py-1.5 text-[10px]"
                    >
                      採取派遣
                    </Button>
                    <Button
                      onClick={() => handleAssign(v.id, "hunt")}
                      variant="danger"
                      size="sm"
                      className="px-2.5 py-1.5 text-[10px]"
                    >
                      討伐派遣
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="secondary" size="md">
            キャンセル
          </Button>
        </div>
      </div>
    </Modal>
  );
};
