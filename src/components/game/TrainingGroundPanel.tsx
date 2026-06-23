import { Sword, Clock, Users } from "lucide-react";
import React, { useState } from "react";

import { getTrainingProgramsForFacility } from "../../data/masterData";
import { useCraftActions } from "../../hooks";
import { Facility, Villager } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";
import { Tooltip } from "../ui/Tooltip";

interface TrainingGroundPanelProps {
  fac: Facility;
  villagers: Villager[];
}

interface TrainingProgramInfo {
  id: string;
  name: string;
  description: string;
  requiredFacilityLevel: number;
  requiredTime: number;
  goldCost: number;
  statBonus: Record<string, number>;
}

const StatBadge: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold font-mono text-sky-300 border border-slate-700">
    {label}+{value}
  </span>
);

export const TrainingGroundPanel: React.FC<TrainingGroundPanelProps> = ({ fac, villagers }) => {
  const { startTraining } = useCraftActions();
  const [selectedVillagerId, setSelectedVillagerId] = useState<string>("");
  const programs = getTrainingProgramsForFacility(fac.level);

  const idleVillagers = villagers.filter((v) => v.status === "idle" && !v.assignedCraftJobId);
  const activeJobs = fac.trainingQueue || [];

  const handleStartTraining = (programId: string) => {
    if (!selectedVillagerId) return;
    startTraining(programId, selectedVillagerId);
    setSelectedVillagerId("");
  };

  const formatStatBonus = (program: TrainingProgramInfo) => {
    const parts: React.ReactNode[] = [];
    const entries = Object.entries(program.statBonus).filter(([, v]) => v > 0);
    entries.forEach(([stat, value], i) => {
      if (i > 0) parts.push(null);
      if (stat === "maxHp") {
        parts.push(<StatBadge key="hp" label="HP" value={value} />);
      } else if (stat === "maxStamina") {
        parts.push(<StatBadge key="stam" label="スタミナ" value={value} />);
      } else {
        parts.push(<StatBadge key={stat} label={stat.toUpperCase()} value={value} />);
      }
    });
    return <span className="flex flex-wrap gap-1 mt-1">{parts}</span>;
  };

  return (
    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
      {/* 訓練進行中 */}
      {activeJobs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            訓練進行中 ({activeJobs.length}/3)
          </h4>
          {activeJobs.map((job) => {
            const v = villagers.find((vill) => vill.id === job.assignedVillagerId);
            return (
              <div key={job.id} className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono text-slate-300">
                  <span className="truncate max-w-37.5">{v?.name ?? "村人"} 訓練中</span>
                  <span className="text-slate-500 shrink-0 ml-2">残り {job.timeLeft}時間</span>
                </div>
                <ProgressBar
                  value={job.totalTime - job.timeLeft}
                  max={job.totalTime}
                  height={1.5}
                  color="amber"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 訓練プログラム一覧 */}
      {programs.length > 0 && (
        <>
          <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-3">
            <Sword className="w-3 h-3 text-amber-400" />
            訓練プログラム
          </h4>

          {/* 村人選択 */}
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedVillagerId}
              onChange={(e) => setSelectedVillagerId(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">訓練する村人を選択...</option>
              {idleVillagers.map((v) => (
                <option key={v.id} value={v.id} disabled={v.gold < programs[0]?.goldCost}>
                  {v.name}（所持金: {v.gold} G{v.gold < programs[0]?.goldCost ? " - 不足" : ""}）
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {programs.map((program) => {
              const canAfford =
                selectedVillagerId &&
                (villagers.find((v) => v.id === selectedVillagerId)?.gold ?? 0) >= program.goldCost;
              return (
                <div
                  key={program.id}
                  className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-bold text-amber-300">{program.name}</p>
                    <span className="text-[9px] font-mono text-slate-500 shrink-0 whitespace-nowrap">
                      Lv.{program.requiredFacilityLevel}~
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {program.description}
                  </p>
                  {formatStatBonus(program)}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      {program.goldCost} G
                    </span>
                    <Tooltip content={`所要時間: ${program.requiredTime}時間`}>
                      <span className="text-[10px] font-mono text-slate-500">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {program.requiredTime}h
                      </span>
                    </Tooltip>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartTraining(program.id);
                    }}
                    disabled={!selectedVillagerId || !canAfford}
                    className="w-full py-1.5 bg-amber-600/80 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed mt-1"
                  >
                    {!selectedVillagerId ? "村人を選択" : !canAfford ? "所持金不足" : "訓練開始"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 訓練場がLv0でプログラム未解放 */}
      {programs.length === 0 && fac.level > 0 && (
        <p className="text-[10px] text-slate-500 italic text-center py-2">
          訓練場レベル {fac.level} で利用可能な訓練プログラムはありません。施設を強化してください。
        </p>
      )}
    </div>
  );
};
