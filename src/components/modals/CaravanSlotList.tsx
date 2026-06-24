import React from "react";

import type { Caravan, Town } from "../../types/game";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";

interface CaravanSlotListProps {
  caravans: Caravan[];
  towns: Town[];
  selectedCaravanId: string | null;
  onSelectCaravan: (id: string) => void;
  onCollect: (id: string) => void;
  onToggleAuto: (id: string) => void;
}

export const CaravanSlotList: React.FC<CaravanSlotListProps> = ({
  caravans,
  towns,
  selectedCaravanId,
  onSelectCaravan,
  onCollect,
  onToggleAuto,
}) => {
  return (
    <div className="lg:col-span-1 border border-slate-800 rounded-xl p-4 bg-slate-950/40 flex flex-col gap-4 overflow-y-auto">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        交易馬車スロット
      </h3>
      {caravans.map((caravan, index) => {
        const townName = towns.find((t) => t.id === caravan.destinationTownId)?.name || "";
        const isSelected = selectedCaravanId === caravan.id;

        return (
          <div
            key={caravan.id}
            onClick={() => caravan.status === "idle" && onSelectCaravan(caravan.id)}
            className={`border rounded-lg p-3 transition cursor-pointer ${
              caravan.status === "idle"
                ? isSelected
                  ? "border-sky-500 bg-sky-950/20"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                : "border-slate-900 bg-slate-950/20 cursor-default"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-300">馬車 #{index + 1}</span>
              {caravan.status === "idle" && (
                <Badge variant="info" className="text-[10px]">
                  待機中
                </Badge>
              )}
              {caravan.status === "trading" && (
                <Badge variant="warning" className="text-[10px] animate-pulse">
                  交易中
                </Badge>
              )}
              {caravan.status === "returned" && (
                <Badge variant="success" className="text-[10px]">
                  帰還
                </Badge>
              )}
            </div>

            {caravan.status === "trading" && (
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{townName} 往復中</span>
                  <span>残り {caravan.timeLeft}時間</span>
                </div>
                <ProgressBar
                  value={caravan.totalTime - caravan.timeLeft}
                  max={caravan.totalTime}
                  height={1}
                  color="amber"
                />
              </div>
            )}

            {caravan.status === "returned" && (
              <div className="mt-3">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollect(caravan.id);
                  }}
                  variant="success"
                  size="sm"
                  className="w-full text-xs"
                >
                  報告を受け取る
                </Button>
              </div>
            )}

            {caravan.status === "idle" && (
              <div className="text-[10px] text-slate-500 mt-1 italic">クリックして派遣を指示</div>
            )}

            {/* 自動交易トグル */}
            <div className="mt-3 pt-2.5 border-t border-slate-900/60 flex items-center justify-between select-none">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                自動交易
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={caravan.isAuto}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleAuto(caravan.id);
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-white"></div>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
};
