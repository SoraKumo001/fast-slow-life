import {
  CircleDollarSign,
  FlaskConical,
  Package,
  Heart,
  Shield,
  Sword,
  Zap,
  CheckCircle,
} from "lucide-react";
import React from "react";

import { EXP_NEEDED_PER_LEVEL } from "../../constants";
import { ITEMS } from "../../data/masterData";
import { DungeonArea, Facility, FacilityType, OrderType, Villager } from "../../types/game";
import { getPartyLabel } from "../../utils/partyHelpers";
import { getVillagerPurposeText } from "../../utils/villagerHelpers";
import { MissionBadge } from "../ui/MissionBadge";
import { ProgressBar } from "../ui/ProgressBar";
import { VillagerActions } from "./VillagerActions";
import { VillagerStats } from "./VillagerStats";

interface VillagerRowProps {
  villager: Villager;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenJobModal: (v: Villager) => void;
  onSetOrder: (params: {
    id: string;
    order: OrderType;
    areaId: string | null;
    targetMonsterId?: string | null;
  }) => void;
  dungeons: DungeonArea[];
  facilities: Record<FacilityType, Facility>;
  /** 全パーティキー一覧（ラベルの安定ソート用） */
  allPartyKeys: string[];
  /** パーティキーごとのサイズ Map */
  partySizeMap: Record<string, number>;
}

export const VillagerRow: React.FC<VillagerRowProps> = ({
  villager: v,
  isExpanded,
  onToggleExpand,
  onOpenJobModal,
  onSetOrder,
  dungeons,
  facilities,
  allPartyKeys,
  partySizeMap,
}) => {
  const poolTotalValue = Object.entries(v.pool || {}).reduce((sum, [itemId, count]) => {
    const price = (ITEMS[itemId]?.basePrice || 0) * 2;
    return sum + price * count;
  }, 0);

  // パーティバッジ用データ
  const partyKey = v.autoTargetName ?? "";
  const partyLabel = partyKey ? getPartyLabel(partyKey, allPartyKeys) : "";
  const partySize = partyKey ? (partySizeMap[partyKey] ?? 0) : 0;

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-lg p-3 transition duration-200">
      <div
        onClick={() => onToggleExpand(v.id)}
        className="flex justify-between items-center cursor-pointer select-none"
      >
        <div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onOpenJobModal(v);
            }}
            className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/50 text-sky-400 font-medium cursor-pointer transition-all duration-200"
            title="クリックして職業変更"
          >
            {v.currentJob}
          </span>
          <span className="font-bold text-slate-100 text-sm">{v.name}</span>
          <span className="text-xs text-slate-400 font-mono ml-2">
            Lv.{v.level}{" "}
            <span className="text-[10px] text-slate-500 font-normal">
              <CheckCircle className="w-2.5 h-2.5 text-sky-400 inline" /> {v.exp}/
              {v.level * EXP_NEEDED_PER_LEVEL}
            </span>
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ml-2.5 font-mono inline-flex items-center gap-0.5 ${
              v.gold < 0
                ? "text-red-400 bg-red-950/40 border border-red-900/60"
                : "text-amber-400 bg-amber-950/40 border border-amber-900/60"
            }`}
            title={
              v.gold < 0 ? `ツケ（未払い宿代・食料代）: ${-v.gold} G` : `所持ゴールド: ${v.gold} G`
            }
          >
            <CircleDollarSign className="w-2.5 h-2.5 inline" />{" "}
            {v.gold < 0 ? `0 G (ツケ: ${-v.gold} G)` : `${v.gold} G`}
          </span>

          {v.pool && Object.keys(v.pool).length > 0 && (
            <span
              className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-900/60 px-1.5 py-0.5 rounded ml-2 font-mono inline-flex items-center gap-0.5"
              title={`プレイヤーのゴールド不足により仮置きされているアイテム（見込み買取額: ${poolTotalValue} G）`}
            >
              <Package className="w-2.5 h-2.5 inline" />{" "}
              {Object.values(v.pool).reduce((sum, count) => sum + count, 0)} 個 (未払:{" "}
              {poolTotalValue} G)
            </span>
          )}

          <div className="mt-1 flex gap-1.5 items-center flex-wrap">
            <MissionBadge villager={v} partyLabel={partyLabel} partySize={partySize} />
            <span className="text-[10px] text-slate-300 font-medium mt-0.5 block">
              {getVillagerPurposeText(v, facilities, dungeons)}
            </span>
          </div>
          {!isExpanded && (
            <div className="mt-2 flex items-center gap-x-4 text-[10px] text-slate-400 font-mono whitespace-nowrap overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0">
                <Heart className="w-3 h-3 text-red-500 shrink-0" />
                <div className="w-10 shrink-0">
                  <ProgressBar value={v.currentHp} max={v.maxHp} height={1} color="red" />
                </div>
                <span className="text-slate-300 font-bold shrink-0">
                  {v.currentHp}/{v.maxHp}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                <div className="w-10 shrink-0">
                  <ProgressBar
                    value={v.stamina}
                    max={v.maxStamina || 100}
                    height={1}
                    color="amber"
                  />
                </div>
                <span className="text-slate-300 font-bold shrink-0">
                  {v.stamina}/{v.maxStamina || 100}
                </span>
              </div>
              {v.potionCount > 0 && (
                <div
                  title={ITEMS[v.potionItemId || "potion"]?.name || "回復薬"}
                  className="flex items-center gap-1 shrink-0 bg-indigo-950/40 border border-indigo-900/60 px-1.5 py-0.5 rounded text-[9px] text-indigo-400 font-bold"
                >
                  <FlaskConical className="w-2.5 h-2.5 inline" /> x{v.potionCount}
                </div>
              )}
              {v.staminaDrinkCount > 0 && (
                <div
                  title={
                    ITEMS[v.staminaDrinkItemId || "stamina_drink"]?.name || "スタミナポーション"
                  }
                  className="flex items-center gap-1 shrink-0 bg-amber-950/40 border border-amber-900/60 px-1.5 py-0.5 rounded text-[9px] text-amber-400 font-bold"
                >
                  <Zap className="w-2.5 h-2.5 inline" /> x{v.staminaDrinkCount}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-900 space-y-3">
          <VillagerStats villager={v} />

          {v.pool && Object.keys(v.pool).length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5 space-y-1">
              <p className="text-[10px] font-bold text-sky-400 flex items-center gap-1.5">
                <Package className="w-3 h-3" /> 仮置き場（プール中アイテム）:
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-slate-300">
                {Object.entries(v.pool).map(([itemId, count]) => {
                  const item = ITEMS[itemId];
                  return (
                    <div
                      key={itemId}
                      className="flex justify-between border-b border-slate-800/40 pb-0.5"
                    >
                      <span>{item?.name || itemId}</span>
                      <span className="text-slate-400">
                        x{count} (計 {(item?.basePrice || 0) * 2 * count}G)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 justify-center">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900/60 text-[10px] text-slate-300">
              <Sword className="w-3 h-3 text-amber-500 shrink-0" />
              {v.weaponId !== "none"
                ? `${ITEMS[v.weaponId].name} (ATK+${ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0})`
                : "武器なし"}
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900/60 text-[10px] text-slate-300">
              <Shield className="w-3 h-3 text-sky-400 shrink-0" />
              {v.armorId !== "none"
                ? `${ITEMS[v.armorId].name} (DEF+${ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0})`
                : "防具なし"}
            </div>
            {v.potionCount > 0 && (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-950/20 border border-indigo-900/40 text-[10px] text-indigo-400">
                <span className="flex items-center gap-1 text-[10px]">
                  <FlaskConical className="w-3 h-3 shrink-0" />
                  {ITEMS[v.potionItemId || "potion"]?.name || "回復薬"} x{v.potionCount}
                </span>
              </div>
            )}
            {v.staminaDrinkCount > 0 && (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-amber-950/20 border border-amber-900/40 text-[10px] text-amber-400">
                <span className="flex items-center gap-1 text-[10px]">
                  <Zap className="w-3 h-3 shrink-0" />
                  {ITEMS[v.staminaDrinkItemId || "stamina_drink"]?.name ||
                    "スタミナポーション"} x
                  {v.staminaDrinkCount}
                </span>
              </div>
            )}
          </div>

          <VillagerActions villager={v} dungeons={dungeons} onSetOrder={onSetOrder} />
        </div>
      )}
    </div>
  );
};
