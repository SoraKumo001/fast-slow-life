import React from "react";

import { ITEMS } from "../../data/masterData";
import type { CraftJob } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";

interface CraftQueueDisplayProps {
  craftQueue: CraftJob[];
}

export const CraftQueueDisplay: React.FC<CraftQueueDisplayProps> = ({ craftQueue }) => {
  if (craftQueue.length === 0) return null;

  return (
    <div className="space-y-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
        進行中のキュー ({craftQueue.length}/3)
      </p>
      {craftQueue.map((job) => (
        <div key={job.id} className="space-y-0.5">
          <div className="flex justify-between text-[10px] font-mono text-slate-300">
            <span>{ITEMS[job.itemId].name}</span>
            <span>残り {job.timeLeft}時間</span>
          </div>
          <ProgressBar
            value={job.totalTime - job.timeLeft}
            max={job.totalTime}
            height={1}
            color="sky"
          />
        </div>
      ))}
    </div>
  );
};
