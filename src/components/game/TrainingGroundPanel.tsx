import { Clock } from "lucide-react";
import React from "react";

import { useVillagers } from "../../hooks";
import { Facility } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";

interface TrainingGroundPanelProps {
  fac: Facility;
}

export const TrainingGroundPanel: React.FC<TrainingGroundPanelProps> = ({ fac }) => {
  const villagers = useVillagers();
  const activeJobs = fac.trainingQueue || [];

  return (
    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
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
    </div>
  );
};
