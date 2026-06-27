import React from "react";

import { DungeonArea, OrderType, Villager } from "../../types/game";

interface VillagerActionsProps {
  villager: Villager;
  dungeons: DungeonArea[];
  onSetOrder: (params: {
    id: string;
    order: OrderType;
    areaId: string | null;
    targetMonsterId?: string | null;
  }) => void;
}

export const VillagerActions: React.FC<VillagerActionsProps> = ({
  villager: v,
  dungeons,
  onSetOrder,
}) => {
  return (
    <>
      {v.status === "idle" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetOrder({ id: v.id, order: "rest", areaId: null });
          }}
          className="w-full py-1 text-center rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          宿屋で休ませる
        </button>
      )}
      {v.status === "resting" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetOrder({ id: v.id, order: "gather", areaId: null });
          }}
          className="w-full py-1 text-center rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          休息を切り上げて待機にする
        </button>
      )}

      {(v.status === "active" || v.status === "traveling_to") && v.destinationAreaId && (
        <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-2">
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetOrder({
                  id: v.id,
                  order: "gather",
                  areaId: v.destinationAreaId,
                });
              }}
              disabled={v.order === "gather"}
              className="py-1 text-center rounded bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-900 text-[9px] font-bold text-emerald-400 hover:text-emerald-200 transition disabled:opacity-40"
            >
              採取に変更
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetOrder({
                  id: v.id,
                  order: "hunt",
                  areaId: v.destinationAreaId,
                });
              }}
              disabled={v.order === "hunt"}
              className="py-1 text-center rounded bg-red-950/40 hover:bg-red-900 border border-red-900 text-[9px] font-bold text-red-400 hover:text-red-200 transition disabled:opacity-40"
            >
              討伐に変更
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetOrder({
                  id: v.id,
                  order: "rest",
                  areaId: v.destinationAreaId,
                });
              }}
              className="py-1 text-center rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition"
            >
              帰還させる
            </button>
          </div>

          {v.order === "hunt" && (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-slate-400">個別討伐ターゲット:</span>
              <select
                value={v.targetMonsterId || ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : e.target.value;
                  onSetOrder({
                    id: v.id,
                    order: v.order,
                    areaId: v.destinationAreaId,
                    targetMonsterId: val,
                  });
                }}
                className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-mono w-28"
              >
                <option value="">自動選択 (AI)</option>
                {dungeons
                  .find((d) => d.id === v.destinationAreaId)
                  ?.monsters.filter(
                    (m) =>
                      (dungeons.find((d) => d.id === v.destinationAreaId)?.explorationProgress ||
                        0) >= (m.unlockedAtProgress || 0),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isBoss ? "(ボス)" : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  );
};
