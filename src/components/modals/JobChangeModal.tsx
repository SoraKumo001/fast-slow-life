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
            const isCurrent = villager.currentJob === jobKey;

            const req = job.requirements;
            const isLevelMet = isHistory || !req || villager.level >= req.level;
            const isPrevJobMet =
              isHistory ||
              !req ||
              !req.jobs ||
              req.jobs.length === 0 ||
              req.jobs.some((j) => villager.jobHistory.includes(j));
            const isReqMet = isLevelMet && isPrevJobMet;

            const cost = isHistory ? 0 : Math.floor(job.cost * discountRate);
            const canAfford = gold >= cost;
            const canChange = isReqMet && canAfford && !isCurrent;

            return (
              <div
                key={jobKey}
                className={`border rounded-lg p-3 flex justify-between items-center transition duration-200 ${
                  isCurrent
                    ? "border-sky-500 bg-sky-950/20"
                    : !isReqMet
                      ? "border-slate-950 bg-slate-950/20 opacity-60"
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
                  
                  {/* 転職要件の表示 */}
                  {!isCurrent && req && (
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono leading-none">
                      <span className={isLevelMet ? "text-emerald-400/90" : "text-rose-400/90"}>
                        必要Lv.{req.level} {isHistory || villager.level >= req.level ? "✓" : `(現在:Lv.${villager.level})`}
                      </span>
                      {req.jobs && req.jobs.length > 0 && (
                        <span className={isPrevJobMet ? "text-emerald-400/90" : "text-rose-400/90"}>
                          必要前職: {req.jobs.join("/")} {isPrevJobMet ? "✓" : "(未習得)"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  {isCurrent ? (
                    <span className="text-xs text-sky-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 現在
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJobChange(jobKey)}
                      disabled={!canChange}
                      className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-850 disabled:text-slate-500 text-white font-semibold text-xs transition min-w-[70px] text-center"
                    >
                      {!isReqMet ? "条件未達" : cost === 0 ? "無料" : `${cost} G`}
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
