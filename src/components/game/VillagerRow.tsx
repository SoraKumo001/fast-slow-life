import { Shield, Sword, Heart, Zap, CheckCircle } from "lucide-react";
import React from "react";

import { ITEMS, MONSTERS } from "../../data/masterData";
import { DungeonArea, Facility, FacilityType, OrderType, Villager } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";
import { VillagerActions } from "./VillagerActions";
import { VillagerStats } from "./VillagerStats";

interface VillagerRowProps {
  villager: Villager;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenJobModal: (v: Villager) => void;
  onOpenEquipModal: (v: Villager) => void;
  onSetOrder: (
    villagerId: string,
    order: OrderType,
    areaId: string | null,
    targetGatherItemId?: string | null,
    targetMonsterId?: string | null,
  ) => void;
  dungeons: DungeonArea[];
  facilities: Record<FacilityType, Facility>;
}

export const VillagerRow: React.FC<VillagerRowProps> = ({
  villager: v,
  isExpanded,
  onToggleExpand,
  onOpenJobModal,
  onOpenEquipModal,
  onSetOrder,
  dungeons,
  facilities,
}) => {
  const getVillagerPurpose = (villager: Villager) => {
    if (villager.status === "resting") return "宿屋で休息中";
    if (villager.assignedCraftJobId) {
      let craftItemName = "";
      Object.values(facilities).forEach((f) => {
        const job = f.craftQueue.find((j) => j.id === villager.assignedCraftJobId);
        if (job) {
          craftItemName = ITEMS[job.itemId]?.name || "";
        }
      });
      return `クラフト中: ${craftItemName || "加工"}`;
    }
    if (villager.destinationAreaId) {
      const area = dungeons.find((d) => d.id === villager.destinationAreaId);
      const areaName = area?.name || "ダンジョン";
      let actionStr = "";
      if (villager.order === "gather") {
        const targetName = villager.targetGatherItemId
          ? ITEMS[villager.targetGatherItemId]?.name
          : villager.autoTargetName;
        actionStr = targetName ? `採取 [${targetName}]` : "採取";
      } else if (villager.order === "hunt") {
        const targetName = villager.targetMonsterId
          ? MONSTERS[villager.targetMonsterId]?.name
          : villager.autoTargetName;
        actionStr = targetName ? `討伐 [${targetName}]` : "討伐";
      }
      return `${areaName} : ${actionStr}`;
    }
    return "待機中 (方針なし)";
  };

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
              <CheckCircle className="w-2.5 h-2.5 text-sky-400 inline" /> {v.exp}/{v.level * 100}
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
            🪙 {v.gold || 0} G
          </span>

          {v.pool && Object.keys(v.pool).length > 0 && (
            <span
              className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-900/60 px-1.5 py-0.5 rounded ml-2 font-mono inline-flex items-center gap-0.5"
              title="プレイヤーのゴールド不足により仮置きされているアイテム（ゴールドが出来次第自動買取）"
            >
              📦 {Object.values(v.pool).reduce((sum, count) => sum + count, 0)} 個プール
            </span>
          )}

          <div className="mt-1 flex gap-0.5 items-center">
            <div>
              <span
                className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                  v.status === "idle"
                    ? "bg-slate-800 text-slate-400"
                    : v.status === "resting"
                      ? "bg-emerald-950/80 border border-emerald-900 text-emerald-400"
                      : v.status === "active"
                        ? "bg-red-950/80 border border-red-900 text-red-400"
                        : "bg-amber-950/80 border border-amber-900 text-amber-400"
                }`}
              >
                {v.status === "idle"
                  ? "待機"
                  : v.status === "resting"
                    ? "休息中"
                    : v.status === "active"
                      ? "活動中"
                      : v.status === "traveling_to"
                        ? "移動中"
                        : "帰還中"}
                {v.travelTimeLeft}h
              </span>
            </div>
            <span className="text-[10px] text-slate-300 font-medium mt-0.5 block">
              {getVillagerPurpose(v)}
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
                  🧪 x{v.potionCount}
                </div>
              )}
              {v.staminaDrinkCount > 0 && (
                <div
                  title={
                    ITEMS[v.staminaDrinkItemId || "stamina_drink"]?.name || "スタミナポーション"
                  }
                  className="flex items-center gap-1 shrink-0 bg-amber-950/40 border border-amber-900/60 px-1.5 py-0.5 rounded text-[9px] text-amber-400 font-bold"
                >
                  ⚡️ x{v.staminaDrinkCount}
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
                📦 仮置き場（プール中アイテム）:
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
                        x{count} (計 {(item?.sellPrice || 0) * count}G)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipModal(v);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
            >
              <Sword className="w-3 h-3 text-amber-500" />
              {v.weaponId !== "none" ? ITEMS[v.weaponId].name : "武器なし"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenEquipModal(v);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
            >
              <Shield className="w-3 h-3 text-sky-400" />
              {v.armorId !== "none" ? ITEMS[v.armorId].name : "防具なし"}
            </button>
            {v.potionCount > 0 && (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-950/20 border border-indigo-900/40 text-[10px] text-indigo-400">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-[11px] leading-none shrink-0 font-sans">🧪</span>
                  {ITEMS[v.potionItemId || "potion"]?.name || "回復薬"} x{v.potionCount}
                </span>
              </div>
            )}
            {v.staminaDrinkCount > 0 && (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-amber-950/20 border border-amber-900/40 text-[10px] text-amber-400">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-[11.5px] leading-none shrink-0 font-sans">⚡️</span>
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
