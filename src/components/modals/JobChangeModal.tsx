import { CheckCircle, ArrowRight, ShieldAlert, Award, Star } from "lucide-react";
import React from "react";
import { shallow } from "zustand/shallow";

import { JOBS } from "../../data/masterData";
import { useGameStore } from "../../store/gameStore";
import { JobType, Villager } from "../../types/game";

interface JobChangeModalProps {
  villager: Villager;
  onClose: () => void;
}

export const JobChangeModal: React.FC<JobChangeModalProps> = ({ villager, onClose }) => {
  const { gold, soulUpgrades } = useGameStore(
    (s) => ({ gold: s.gold, soulUpgrades: s.soulUpgrades }),
    shallow,
  );
  const changeVillagerJob = useGameStore((s) => s.changeVillagerJob);

  const discountLvl = soulUpgrades.discount || 0;
  const discountRate = 1 - discountLvl * 0.1;

  const handleJobChange = (job: JobType) => {
    changeVillagerJob(villager.id, job);
    onClose();
  };

  const getJobStatus = (jobKey: JobType) => {
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

    return {
      job,
      isHistory,
      isCurrent,
      req,
      isLevelMet,
      isPrevJobMet,
      isReqMet,
      cost,
      canAfford,
      canChange,
    };
  };

  const renderJobCard = (jobKey: JobType) => {
    const { job, isHistory, isCurrent, req, isLevelMet, isPrevJobMet, isReqMet, cost, canChange } =
      getJobStatus(jobKey);

    // 1.1倍以上のステータス補正をバッジ表示
    const statsHighlights = Object.entries(job.statsMultiplier)
      .filter(([_, val]) => val > 1.0)
      .map(([stat, val]) => `${stat.toUpperCase()} x${val}`);

    return (
      <div
        className={`relative border rounded-xl p-3 flex flex-col justify-between transition-all duration-200 h-full ${
          isCurrent
            ? "border-sky-500 bg-sky-950/40 shadow-[0_0_12px_rgba(14,165,233,0.15)]"
            : !isReqMet
              ? "border-slate-800/40 bg-slate-950/20 opacity-50"
              : "border-slate-800 bg-slate-950/60 hover:bg-slate-950/90 hover:border-slate-700/85"
        }`}
      >
        <div>
          {/* カードヘッダー */}
          <div className="flex justify-between items-start gap-1.5">
            <div className="min-w-0">
              <span className="font-bold text-slate-100 text-sm truncate block">{jobKey}</span>
              {isHistory && (
                <span className="inline-block mt-0.5 text-[8.5px] px-1 py-0.2 rounded bg-slate-850 text-slate-400 font-mono">
                  習得済
                </span>
              )}
            </div>
            {isCurrent && (
              <span className="shrink-0 text-[9px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-0.5">
                <CheckCircle className="w-3 h-3" /> 現在
              </span>
            )}
          </div>

          {/* 説明 */}
          <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">{job.description}</p>

          {/* ステータス補正バッジ */}
          {statsHighlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {statsHighlights.map((hl) => (
                <span
                  key={hl}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold"
                >
                  {hl}
                </span>
              ))}
            </div>
          )}

          {/* 転職要件 */}
          {!isCurrent && req && (
            <div className="mt-2.5 p-1.5 rounded bg-slate-900/50 border border-slate-800/50 space-y-0.5 text-[9px] font-mono leading-tight">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">必要レベル:</span>
                <span className={isLevelMet ? "text-emerald-400" : "text-rose-400"}>
                  Lv.{req.level} (現在:{villager.level})
                </span>
              </div>
              {req.jobs && req.jobs.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">前提職業:</span>
                  <span className={isPrevJobMet ? "text-emerald-400" : "text-rose-400"}>
                    {req.jobs.join("/")} {isPrevJobMet ? "✓" : "未習得"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ボタン */}
        <div className="mt-3.5 pt-2 border-t border-slate-900/80">
          {isCurrent ? (
            <div className="w-full py-1.5 text-center text-[11px] text-sky-400/80 font-bold bg-sky-950/20 rounded-lg border border-sky-950">
              現在の職業
            </div>
          ) : (
            <button
              onClick={() => handleJobChange(jobKey)}
              disabled={!canChange}
              className={`w-full py-1.5 rounded-lg font-bold text-xs transition-all flex justify-center items-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
                !isReqMet
                  ? "bg-slate-800 text-slate-500 border border-slate-850"
                  : cost === 0
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/50"
                    : "bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-950/50"
              }`}
            >
              {!isReqMet ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" /> 条件未達
                </>
              ) : cost === 0 ? (
                "無料転職"
              ) : (
                `${cost} G`
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 flex flex-col h-[90vh] md:h-auto max-h-[90vh] cursor-default"
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-sky-400" />
              {villager.name} の転職系統図
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              現在の職業: <strong className="text-sky-400">{villager.currentJob}</strong> (Lv.
              {villager.level})<span className="mx-2 text-slate-700">|</span>
              所持ゴールド: <strong className="text-amber-400">{gold} G</strong>
            </p>
          </div>
          <div className="text-[10px] text-slate-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80 text-right sm:self-center space-y-1">
            <div>
              ※習得済みの職業への転職コストは{" "}
              <span className="text-emerald-400 font-bold">0 G</span> になります。
            </div>
            <div className="text-amber-400 font-bold">
              ★転職時、前職のレベルに応じたステータスボーナスが永続加算され、レベルは 1 に戻ります。
            </div>
          </div>
        </div>

        {/* 系統図ツリーエリア */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {/* 初期基本職 (無職) */}
          <div className="flex justify-center mb-1">
            <div className="w-64 max-w-full">{renderJobCard("無職")}</div>
          </div>

          {/* 系列別の転職フロー */}
          <div className="space-y-4">
            {/* 1. 農林系列 */}
            <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 text-emerald-400" />
                農林系列
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                <div className="md:col-span-1 flex flex-col gap-3">
                  {renderJobCard("農民")}
                  {renderJobCard("木こり")}
                </div>
                <div className="hidden md:flex justify-center text-slate-700">
                  <ArrowRight className="w-6 h-6 animate-pulse" />
                </div>
                <div className="md:col-span-1 bg-slate-900/20 border border-dashed border-slate-800/40 rounded-xl p-5 text-center text-xs text-slate-500 italic">
                  (将来の上位職アップデートをお楽しみに)
                </div>
              </div>
            </div>

            {/* 2. 戦闘系 */}
            <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 text-rose-400" />
                武芸系列
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                <div className="md:col-span-1">{renderJobCard("猟師")}</div>
                <div className="flex justify-center text-slate-700">
                  <ArrowRight className="w-6 h-6 rotate-90 md:rotate-0" />
                </div>
                <div className="md:col-span-1">{renderJobCard("戦士")}</div>
              </div>
            </div>

            {/* 3. 工芸系 */}
            <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                工芸系列
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                <div className="md:col-span-1">{renderJobCard("鉱夫")}</div>
                <div className="flex justify-center text-slate-700">
                  <ArrowRight className="w-6 h-6 rotate-90 md:rotate-0" />
                </div>
                <div className="md:col-span-1">{renderJobCard("職人")}</div>
              </div>
            </div>

            {/* 4. 学術・回復系 */}
            <div className="bg-slate-950/20 border border-slate-800/60 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 text-purple-400" />
                学術・医療系列
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                {/* 起点 (薬師) */}
                <div className="md:col-span-1">{renderJobCard("薬師")}</div>

                {/* 矢印 (分岐派生表示) */}
                <div className="flex flex-col items-center justify-center text-slate-700 gap-1.5">
                  <span className="text-[9px] font-mono text-slate-500">分岐派生</span>
                  <div className="flex md:flex-col gap-8 md:gap-2">
                    <ArrowRight className="w-5 h-5 rotate-90 md:rotate-[-20deg]" />
                    <ArrowRight className="w-5 h-5 rotate-90 md:rotate-20" />
                  </div>
                </div>

                {/* 分岐先 (魔術師 & 僧侶) */}
                <div className="md:col-span-1 flex flex-col gap-4">
                  {renderJobCard("魔術師")}
                  {renderJobCard("僧侶")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター閉じるボタン */}
        <div className="flex justify-end pt-4 border-t border-slate-805/80 mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
