import { AlertCircle, Sword } from "lucide-react";
import React, { useState } from "react";

import { useVillagers, useDungeons, useBossActions } from "../../hooks";
import { computeEffectiveAtk } from "../../store/combatEngine";
import { DungeonArea, Villager } from "../../types/game";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface BossBattleModalProps {
  area: DungeonArea;
  onClose: () => void;
}

export const BossBattleModal: React.FC<BossBattleModalProps> = ({ area, onClose }) => {
  const { dungeons } = useDungeons();
  const villagers = useVillagers();
  const { startBossBattle } = useBossActions();
  const [selectedAttackerIds, setSelectedAttackerIds] = useState<string[]>([]);

  const getSelectableVillagers = () => {
    return [...villagers].sort((a, b) => {
      const atkA = computeEffectiveAtk(a, 0, 0);
      const atkB = computeEffectiveAtk(b, 0, 0);
      return atkB - atkA;
    });
  };

  const getStatusLabel = (v: Villager) => {
    if (v.status === "idle") return "待機中";
    if (v.status === "resting") return "休息中";
    if (v.status === "traveling_to") {
      const dest = dungeons.find((d) => d.id === v.destinationAreaId);
      return `${dest ? dest.name : "ダンジョン"}へ移動中`;
    }
    if (v.status === "traveling_back") return "帰還中";
    if (v.status === "active") {
      if (v.assignedCraftJobId) return "クラフト中";
      const dest = dungeons.find((d) => d.id === v.destinationAreaId);
      return `${dest ? dest.name : "ダンジョン"}で活動中`;
    }
    return "不明";
  };

  const getStatusColor = (status: Villager["status"], isCrafting: boolean) => {
    if (status === "idle") {
      return "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60";
    }
    if (status === "resting") {
      return "bg-blue-950/60 text-blue-400 border border-blue-900/60";
    }
    if (status === "active") {
      if (isCrafting) {
        return "bg-purple-950/60 text-purple-400 border border-purple-900/60";
      }
      return "bg-amber-950/60 text-amber-400 border border-amber-900/60";
    }
    // traveling_to, traveling_back
    return "bg-slate-800 text-slate-300 border border-slate-700";
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
    <Modal onClose={onClose} size="md">
      <div className="space-y-6">
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
          {getSelectableVillagers().length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8 bg-slate-950 rounded-xl border border-dashed border-slate-800">
              村人がいません。
            </p>
          ) : (
            getSelectableVillagers().map((v: Villager) => {
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-base ${isSelected ? "text-amber-400" : "text-slate-200"}`}
                        >
                          {v.name}
                        </span>
                        <Badge
                          variant="custom"
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${getStatusColor(
                            v.status,
                            Boolean(v.assignedCraftJobId),
                          )}`}
                        >
                          {getStatusLabel(v)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Lv.{v.level} • {v.currentJob}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          HP: {v.currentHp}/{v.maxHp}
                        </span>
                      </div>
                      {!isLvOk && (
                        <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5 mt-1.5">
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
          <Button
            onClick={handleStartBossBattle}
            disabled={selectedAttackerIds.length === 0}
            variant="custom"
            size="lg"
            className="w-full py-4 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-900/20 disabled:shadow-none flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Sword className="w-5 h-5" />
            決戦を開始する ({selectedAttackerIds.length} / 4)
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            size="md"
            className="w-full py-3 text-xs font-bold"
          >
            今はやめておく
          </Button>
        </div>
      </div>
    </Modal>
  );
};
