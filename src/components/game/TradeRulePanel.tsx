import React from "react";

import { ITEMS } from "../../data/masterData";

interface TradeRule {
  id: string;
  itemId: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
}

interface TradeRulePanelProps {
  tradeRules: TradeRule[];
}

export const TradeRulePanel: React.FC<TradeRulePanelProps> = ({ tradeRules }) => {
  const filteredRules = (tradeRules || []).filter((rule) => {
    const item = ITEMS[rule.itemId];
    return rule.type === "sell" && item !== undefined;
  });

  return (
    <div className="space-y-4 bg-slate-900/40 p-4 rounded-lg border border-slate-800">
      <div className="flex justify-between items-center text-xs font-mono text-slate-300">
        <span className="font-semibold text-slate-200">自動交易（売却）設定ルール一覧</span>
        <span className="text-slate-400">設定数: {filteredRules.length} 件</span>
      </div>

      {filteredRules.length > 0 ? (
        <div className="space-y-2">
          {filteredRules.map((rule) => {
            const item = ITEMS[rule.itemId];
            if (!item) return null;
            return (
              <div
                key={rule.id}
                className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-lg border border-slate-850/80 text-xs"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-200">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {`所持数 ${rule.threshold} 個超過時、自動で交易馬車に積載`}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    rule.isEnabled
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {rule.isEnabled ? "有効" : "無効"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-slate-500 italic">自動交易ルールが設定されていません。</p>
      )}
    </div>
  );
};
