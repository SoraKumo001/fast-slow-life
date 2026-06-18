import React from "react";
import { useGameStore, JOBS } from "../../store/gameStore";
import { JobType, Villager } from "../../types/game";
import { CheckCircle } from "lucide-react";

interface JobChangeModalProps {
  villager: Villager;
  onClose: () => void;
}

export const JobChangeModal: React.FC<JobChangeModalProps> = ({ villager, onClose }) => {
  const { gold, changeVillagerJob, soulUpgrades } = useGameStore();

  const discountLvl = soulUpgrades.discount || 0;
  const discountRate = 1 - discountLvl * 0.1;

  const handleJobChange = (job: JobType) => {
    changeVillagerJob(villager.id, job);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{villager.name} の転職先を選択</h3>
          <p className="text-xs text-slate-400">
            ※すでに転職済みの職業への再変更コストは 0G になります。
          </p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {(Object.keys(JOBS) as JobType[]).map((jobKey) => {
            const job = JOBS[jobKey];
            const isHistory = villager.jobHistory.includes(jobKey);
            const cost = isHistory ? 0 : Math.floor(job.cost * discountRate);
            const canAfford = gold >= cost;
            const isCurrent = villager.currentJob === jobKey;

            return (
              <div
                key={jobKey}
                className={`border rounded-lg p-3 flex justify-between items-center ${
                  isCurrent
                    ? "border-sky-500 bg-sky-950/20"
                    : "border-slate-800 bg-slate-950/50 hover:bg-slate-950"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-200">{jobKey}</span>
                    {isHistory && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                        習得済
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{job.description}</p>
                </div>

                <div>
                  {isCurrent ? (
                    <span className="text-xs text-sky-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 現在
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJobChange(jobKey)}
                      disabled={!canAfford}
                      className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs transition"
                    >
                      {cost === 0 ? "無料" : `${cost} G`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
