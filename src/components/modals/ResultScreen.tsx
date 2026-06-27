import { BarChart3 } from "lucide-react";
import React from "react";

import { useGameStats, usePlayerResources, useGameTime, useDungeons } from "../../hooks";
import { calculateEarnedSp } from "../../store/gameReset";
import { useGameStore } from "../../store/gameStore";

export const ResultScreen: React.FC = () => {
  const stats = useGameStats();
  const { gold } = usePlayerResources();
  const { currentDay } = useGameTime();
  const { currentTier, bossDefeated } = useDungeons();
  const store = useGameStore.getState();

  const sp = calculateEarnedSp({
    gold,
    inventory: store.inventory,
    currentTier,
    bossDefeated,
    currentDay,
    maxThreatLevelReached: store.maxThreatLevelReached,
  });

  const rows: { label: string; value: string }[] = [
    { label: "生存日数", value: `${currentDay} 日` },
    { label: "討伐モンスター", value: `${stats.totalMonstersDefeated} 体` },
    { label: "ボス討伐数", value: `${stats.totalBossesDefeated} 体` },
    { label: "採取アイテム総数", value: `${stats.totalItemsGathered.toLocaleString()} 個` },
    { label: "交易輸出総額", value: `${stats.totalGoldFromExports.toLocaleString()} G` },
    { label: "交易輸入総額", value: `${stats.totalGoldSpentOnImports.toLocaleString()} G` },
    { label: "アイテム買取数", value: `${stats.totalItemsPurchased.toLocaleString()} 個` },
    { label: "買取支出", value: `${stats.totalGoldFromPurchases.toLocaleString()} G` },
    { label: "クラフト完了数", value: `${stats.totalItemsCrafted.toLocaleString()} 回` },
    { label: "村人からの税収", value: `${stats.totalGoldFromTax.toLocaleString()} G` },
    { label: "最終ゴールド", value: `${Math.floor(gold).toLocaleString()} G` },
    { label: "獲得SP見込み", value: `${sp} SP` },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <BarChart3 className="w-5 h-5 text-sky-400" />
        <h2 className="text-md font-bold text-slate-100 uppercase tracking-wider">リザルト</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-center py-1.5 border-b border-slate-800/50 text-sm"
          >
            <span className="text-slate-400">{row.label}</span>
            <span className="text-slate-100 font-mono font-bold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
