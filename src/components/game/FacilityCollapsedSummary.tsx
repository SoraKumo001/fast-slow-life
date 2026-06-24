import React from "react";

import {
  MAX_VILLAGERS_ABSOLUTE,
  BASE_MAX_VILLAGERS,
  VILLAGERS_PER_GUILD_LEVEL,
} from "../../constants";
import { ITEMS } from "../../data/masterData";
import type { Facility, Villager } from "../../types/game";
import { getResourceProductionInfo, isResourceFacility } from "../../utils/facilityHelpers";
import { UpgradeCostDisplay } from "./UpgradeCostDisplay";

interface FacilityCollapsedSummaryProps {
  fac: Facility;
  villagers: Villager[];
  inventory: Record<string, number>;
  gold: number;
  reducedCost: { gold: number; materials: { itemId: string; count: number }[] };
  isUnlocked: boolean;
}

export const FacilityCollapsedSummary: React.FC<FacilityCollapsedSummaryProps> = ({
  fac,
  villagers,
  inventory,
  gold,
  reducedCost,
  isUnlocked,
}) => {
  return (
    <div className="mt-2 text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-1.5">
      {isUnlocked ? (
        fac.id === "inn" ? (
          <span className="text-slate-500">休息機能利用可能</span>
        ) : fac.id === "guild" ? (
          <span className="text-slate-500">
            雇用上限:{" "}
            {Math.min(
              MAX_VILLAGERS_ABSOLUTE,
              BASE_MAX_VILLAGERS + fac.level * VILLAGERS_PER_GUILD_LEVEL,
            )}
            人 (現在: {villagers.length}人)
          </span>
        ) : fac.id === "training_ground" ? (
          fac.trainingQueue.length > 0 ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 font-bold">
                訓練中 ({fac.trainingQueue.length}/3)
              </span>
              <span className="text-slate-500 text-[10px] truncate max-w-37.5 sm:max-w-xs">
                • {fac.trainingQueue[0].timeLeft}時間残
              </span>
            </>
          ) : (
            <span className="text-slate-500">待機中の村人を訓練可能</span>
          )
        ) : isResourceFacility(fac.id) ? (
          <span className="text-emerald-500 font-semibold">
            自動生産中: {getResourceProductionInfo(fac).label}/12h
          </span>
        ) : fac.craftQueue.length > 0 ? (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sky-400 font-bold">加工中 ({fac.craftQueue.length}/3)</span>
            <span className="text-slate-500 text-[10px] truncate max-w-37.5 sm:max-w-xs">
              • {ITEMS[fac.craftQueue[0].itemId]?.name}等生産中 (残り {fac.craftQueue[0].timeLeft}h)
            </span>
          </>
        ) : (
          <span className="text-slate-500">生産停止中 (待機)</span>
        )
      ) : (
        <UpgradeCostDisplay cost={reducedCost} inventory={inventory} gold={gold} />
      )}
    </div>
  );
};
