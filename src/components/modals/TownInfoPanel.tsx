import { Shield } from "lucide-react";
import React from "react";

import { ITEMS } from "../../data/masterData";
import { getTownUnlockTier } from "../../data/towns";
import type { Town } from "../../types/game";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface TownInfoPanelProps {
  towns: Town[];
  gold: number;
  onInvest: (townId: string) => void;
}

export const TownInfoPanel: React.FC<TownInfoPanelProps> = ({ towns, gold, onInvest }) => {
  return (
    <div className="h-120 overflow-y-auto pr-1 space-y-6 font-sans">
      {towns.map((town) => {
        return (
          <div
            key={town.id}
            className={`border rounded-xl p-5 ${
              town.isUnlocked
                ? "bg-slate-950/40 border-slate-800"
                : "bg-slate-950/10 border-slate-900 opacity-60"
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 select-none">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  {town.name}
                  {town.isUnlocked ? (
                    <Badge variant="success" className="text-[10px]">
                      往路: {town.distance}h
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px]">
                      未発見
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                  {town.description}
                </p>
              </div>

              {town.isUnlocked && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      投資レベル {town.investLevel}
                    </div>
                    <div className="text-xs text-slate-300 font-mono mt-0.5">
                      次コスト: {town.investCost} G
                    </div>
                  </div>
                  <Button
                    onClick={() => onInvest(town.id)}
                    disabled={gold < town.investCost}
                    variant="primary"
                    size="sm"
                  >
                    投資する
                  </Button>
                </div>
              )}
            </div>

            {town.isUnlocked ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-900 select-none">
                {/* 特産品と仕入れ可能リスト */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-400">仕入れ可能アイテム</div>
                  <div className="flex flex-wrap gap-2">
                    {town.specialties.map((itemId) => {
                      const item = ITEMS[itemId];
                      if (!item) return null;

                      return (
                        <span
                          key={itemId}
                          className="text-[10px] font-medium px-2 py-1 rounded-md border font-sans bg-slate-900 border-slate-800 text-slate-300"
                        >
                          {item.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium py-3 border-t border-slate-900/60 select-none">
                <Shield className="w-4 h-4 text-slate-600" />
                <span>
                  この町を訪問するには、村の開拓 Tier を上げてください（解放Tier:{" "}
                  {getTownUnlockTier(town.id)}）。
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
