import React from "react";

import { useGameStore } from "../../store/gameStore";
import type { PricePolicy } from "../../types/game";

const POLICY_OPTIONS: { value: PricePolicy; label: string; description: string }[] = [
  { value: "cheap", label: "安売り", description: "価格 ×0.8" },
  { value: "standard", label: "標準", description: "価格 ×1.0" },
  { value: "premium", label: "高級", description: "価格 ×1.25" },
];

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded)}`;
}

/**
 * 交易所カード内: 価格方針（条例）の3ボタンと「昨日の精算」表示。
 * 方針の切替は即時保存され、翌日の価格再計算から反映される。
 */
export const MarketPolicyPanel: React.FC = () => {
  const pricePolicy = useGameStore((s) => s.pricePolicy);
  const setPricePolicy = useGameStore((s) => s.setPricePolicy);
  const lastSettlement = useGameStore((s) => s.lastSettlement);

  return (
    <div className="space-y-3 bg-slate-900/40 p-4 rounded-lg border border-slate-800">
      <div className="flex justify-between items-center text-xs font-mono text-slate-300">
        <span className="font-semibold text-slate-200">価格方針（条例）</span>
        <span className="text-slate-400">翌日の価格から反映</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {POLICY_OPTIONS.map((opt) => {
          const selected = pricePolicy === opt.value;
          return (
            <button
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation();
                setPricePolicy(opt.value);
              }}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                selected
                  ? "bg-amber-600/20 border-amber-500/50 text-amber-300"
                  : "bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-[10px] font-mono font-medium opacity-80">
                {opt.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-800/80">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          昨日の精算
        </p>
        {lastSettlement ? (
          <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
            {lastSettlement.day}日目: 買取{" "}
            <span className="text-rose-300">-{lastSettlement.poolPurchase} G</span> / 食料代{" "}
            <span className="text-emerald-300">+{lastSettlement.foodIncome} G</span> / 賃金{" "}
            <span className="text-rose-300">-{lastSettlement.craftWages} G</span> / キャラバン{" "}
            <span
              className={lastSettlement.caravanNet >= 0 ? "text-emerald-300" : "text-rose-300"}
            >
              {formatSigned(lastSettlement.caravanNet)} G
            </span>
          </p>
        ) : (
          <p className="text-[10px] text-slate-500 italic">
            精算データはまだありません（日付が変わると表示されます）。
          </p>
        )}
      </div>
    </div>
  );
};
