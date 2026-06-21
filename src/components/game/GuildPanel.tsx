import React from "react";

import { MAX_VILLAGERS_ABSOLUTE } from "../../constants";
import { Facility, Villager } from "../../types/game";

interface GuildPanelProps {
  fac: Facility;
  villagers: Villager[];
  gold: number;
  isUnlocked: boolean;
  onHireVillager: () => void;
}

export const GuildPanel: React.FC<GuildPanelProps> = ({
  fac,
  villagers,
  gold,
  isUnlocked,
  onHireVillager,
}) => {
  const maxVillagers = Math.min(MAX_VILLAGERS_ABSOLUTE, 3 + fac.level * 2);
  const canHire = isUnlocked && gold >= 100 && villagers.length < maxVillagers;

  return (
    <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800 leading-relaxed">
      <div className="flex justify-between items-center text-[10px] font-mono">
        <span className="text-slate-300 font-medium">
          現在人数: <strong className="text-sky-400">{villagers.length}</strong> / {maxVillagers} 人{" "}
          {!isUnlocked && <span className="text-slate-400">(建設後: 5人)</span>}
        </span>
        {isUnlocked && <span className="text-slate-400">雇用コスト: 100 G</span>}
      </div>

      <p className="text-[10px] text-slate-400 leading-normal">
        ギルドレベルに応じて雇用できる村人の上限が緩和されます。
        <br />
        ・Lv1: 最大5人 / ・Lv2: 最大7人 / ・Lv3: 最大9人 / ・Lv4以上: 最大10人
      </p>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onHireVillager();
        }}
        disabled={!canHire}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        {!isUnlocked
          ? "冒険者ギルドを建設すると雇用できます"
          : villagers.length >= maxVillagers
            ? "雇用上限に達しています"
            : "新しい冒険者を雇用する (100G)"}
      </button>
    </div>
  );
};
