import React from "react";

import { ITEMS } from "../../data/masterData";
import { Facility } from "../../types/game";
import { getSlotsForLevel } from "../../utils/marketHelpers";

interface TradeRule {
  id: string;
  itemId: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
}

interface TradeRulePanelProps {
  fac: Facility;
  tradeRules: TradeRule[];
}

export const TradeRulePanel: React.FC<TradeRulePanelProps> = ({ fac, tradeRules }) => {
  const maxSlots = getSlotsForLevel(fac.level);

  const filteredRules = (tradeRules || []).filter((rule) => {
    const item = ITEMS[rule.itemId];
    if (!item) return false;
    if (fac.id === "weapon_shop") {
      return (
        rule.type === "sell" && (item.category === "gear_weapon" || item.category === "gear_armor")
      );
    }
    if (fac.id === "pharmacy") {
      return rule.type === "sell" && item.category === "consumable";
    }
    return false;
  });

  const usedSlots = filteredRules.length;
  const shopName = fac.id === "weapon_shop" ? "武器屋" : "薬屋";

  return (
    <div className="space-y-4 bg-slate-900/40 p-4 rounded-lg border border-slate-800">
      <div className="flex justify-between items-center text-xs font-mono text-slate-300">
        <span className="font-semibold text-slate-200">自動取引スロット ({shopName})</span>
        <span
          className={`${usedSlots >= maxSlots ? "text-amber-500 font-bold" : "text-slate-400"}`}
        >
          {usedSlots} / {maxSlots} スロット使用中
        </span>
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
                    {`所持数 ${rule.threshold} 個超過時、1個自動売却`}
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
        <p className="text-[10px] text-slate-500 italic">自動取引ルールが設定されていません。</p>
      )}
    </div>
  );
};
