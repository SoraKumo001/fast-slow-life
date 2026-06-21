import { User, Shield, Sword, Heart, Zap, CheckCircle } from "lucide-react";
import React, { useState } from "react";
import { shallow } from "zustand/shallow";

import { ITEMS, MONSTERS } from "../../data/masterData";
import { useGameStore } from "../../store/gameStore";
import { Villager } from "../../types/game";
import { EquipmentModal } from "../modals/EquipmentModal";
import { JobChangeModal } from "../modals/JobChangeModal";

export const VillagerList: React.FC = () => {
  const { dungeons, villagers } = useGameStore(
    (s) => ({ dungeons: s.dungeons, villagers: s.villagers }),
    shallow,
  );
  const setVillagerOrder = useGameStore((s) => s.setVillagerOrder);
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(null);
  const [activeModal, setActiveModal] = useState<"job" | "equip" | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getVillagerPurpose = (v: Villager) => {
    if (v.status === "resting") return "宿屋で休息中";
    if (v.assignedCraftJobId) {
      let craftItemName = "";
      const { facilities } = useGameStore.getState();
      Object.values(facilities).forEach((f) => {
        const job = f.craftQueue.find((j) => j.id === v.assignedCraftJobId);
        if (job) {
          craftItemName = ITEMS[job.itemId]?.name || "";
        }
      });
      return `クラフト中: ${craftItemName || "加工"}`;
    }
    if (v.destinationAreaId) {
      const area = dungeons.find((d) => d.id === v.destinationAreaId);
      const areaName = area?.name || "ダンジョン";

      let actionStr = "";
      if (v.order === "gather") {
        const targetName = v.targetGatherItemId
          ? ITEMS[v.targetGatherItemId]?.name
          : v.autoTargetName;
        actionStr = targetName ? `採取 [${targetName}]` : "採取";
      } else if (v.order === "hunt") {
        const targetName = v.targetMonsterId ? MONSTERS[v.targetMonsterId]?.name : v.autoTargetName;
        actionStr = targetName ? `討伐 [${targetName}]` : "討伐";
      }

      return `${areaName} : ${actionStr}`;
    }
    return "待機中 (方針なし)";
  };

  const openJobModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("job");
  };

  const openEquipModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("equip");
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-sky-400" />
        村人・AI指示一覧 ({villagers.length}/10)
      </h2>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {villagers.map((v) => {
          const isExpanded = !!expandedIds[v.id];
          return (
            <div
              key={v.id}
              className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-lg p-3 transition duration-200"
            >
              {/* 名前、職業、レベル、状態（クリックで開閉） */}
              <div
                onClick={() => toggleExpand(v.id)}
                className="flex justify-between items-center cursor-pointer select-none"
              >
                <div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openJobModal(v);
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
                      {v.level * 100}
                    </span>
                  </span>
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
                  {/* 縮小時（折りたたみ時）の一行表示 */}
                  {!isExpanded && (
                    <div className="mt-2 flex items-center gap-x-4 text-[10px] text-slate-400 font-mono whitespace-nowrap overflow-x-auto no-scrollbar">
                      {/* HP */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Heart className="w-3 h-3 text-red-500 shrink-0" />
                        <div className="w-10 bg-slate-900 rounded-full h-1 overflow-hidden shrink-0">
                          <div
                            className="bg-red-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(v.currentHp / v.maxHp) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-300 font-bold shrink-0">
                          {v.currentHp}/{v.maxHp}
                        </span>
                      </div>

                      {/* ST */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                        <div className="w-10 bg-slate-900 rounded-full h-1 overflow-hidden shrink-0">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(v.stamina / (v.maxStamina || 100)) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-300 font-bold shrink-0">
                          {v.stamina}/{v.maxStamina || 100}
                        </span>
                      </div>

                      {/* 回復薬 */}
                      {v.potionCount > 0 && (
                        <div
                          title={ITEMS[v.potionItemId || "potion"]?.name || "回復薬"}
                          className="flex items-center gap-1 shrink-0 bg-indigo-950/40 border border-indigo-900/60 px-1.5 py-0.5 rounded text-[9px] text-indigo-400 font-bold"
                        >
                          🧪 x{v.potionCount}
                        </div>
                      )}

                      {/* スタミナポーション */}
                      {v.staminaDrinkCount > 0 && (
                        <div
                          title={
                            ITEMS[v.staminaDrinkItemId || "stamina_drink"]?.name ||
                            "スタミナポーション"
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

              {/* 展開された詳細ステータス */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-900 space-y-3">
                  {/* HP & スタミナ & EXP（展開時の複数行表示） */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-red-500" /> HP
                      </span>
                      <span className="text-slate-200">
                        {v.currentHp} / {v.maxHp}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1">
                      <div
                        className="bg-red-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(v.currentHp / v.maxHp) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> スタミナ
                      </span>
                      <span className="text-slate-200">
                        {v.stamina} / {v.maxStamina || 100}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1">
                      <div
                        className="bg-amber-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(v.stamina / (v.maxStamina || 100)) * 100}%` }}
                      />
                    </div>
                  </div>
                  {/* ステータス & 転職 & 装備 */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="space-y-1 text-[11px] font-mono text-slate-400">
                      <p>
                        STR (腕力): <span className="text-slate-200 font-bold">{v.str}</span>
                        {(v.bonusStr || 0) > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusStr}</span>
                        )}
                      </p>
                      <p>
                        INT (魔力): <span className="text-slate-200 font-bold">{v.int}</span>
                        {(v.bonusInt || 0) > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusInt}</span>
                        )}
                      </p>
                      <p>
                        DEX (器用): <span className="text-slate-200 font-bold">{v.dex}</span>
                        {(v.bonusDex || 0) > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusDex}</span>
                        )}
                      </p>
                      <p>
                        AGI (敏捷): <span className="text-slate-200 font-bold">{v.agi}</span>
                        {(v.bonusAgi || 0) > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusAgi}</span>
                        )}
                      </p>
                      <p>
                        VIT (耐久): <span className="text-slate-200 font-bold">{v.vit}</span>
                        {(v.bonusVit || 0) > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusVit}</span>
                        )}
                      </p>
                    </div>

                    {/* 装備ボタン */}
                    <div className="flex flex-col gap-1.5 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEquipModal(v);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                      >
                        <Sword className="w-3 h-3 text-amber-500" />
                        {v.weaponId !== "none" ? ITEMS[v.weaponId].name : "武器なし"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEquipModal(v);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                      >
                        <Shield className="w-3 h-3 text-sky-400" />
                        {v.armorId !== "none" ? ITEMS[v.armorId].name : "防具なし"}
                      </button>

                      {/* 回復薬 */}
                      {v.potionCount > 0 && (
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-indigo-950/20 border border-indigo-900/40 text-[10px] text-indigo-400">
                          <span className="flex items-center gap-1 text-[10px]">
                            <span className="text-[11px] leading-none shrink-0 font-sans">🧪</span>
                            {ITEMS[v.potionItemId || "potion"]?.name || "回復薬"} x{v.potionCount}
                          </span>
                        </div>
                      )}

                      {/* スタミナポーション */}
                      {v.staminaDrinkCount > 0 && (
                        <div className="flex items-center justify-between px-2 py-1 rounded bg-amber-950/20 border border-amber-900/40 text-[10px] text-amber-400">
                          <span className="flex items-center gap-1 text-[10px]">
                            <span className="text-[11.5px] leading-none shrink-0 font-sans">
                              ⚡️
                            </span>
                            {ITEMS[v.staminaDrinkItemId || "stamina_drink"]?.name ||
                              "スタミナポーション"}{" "}
                            x{v.staminaDrinkCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 手動休息ボタン */}
                  {v.status === "idle" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setVillagerOrder(v.id, "rest", null);
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
                        setVillagerOrder(v.id, "gather", null);
                      }}
                      className="w-full py-1 text-center rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
                    >
                      休息を切り上げて待機にする
                    </button>
                  )}

                  {/* 活動中/移動中の行動変更・個別ターゲット指示 */}
                  {(v.status === "active" || v.status === "traveling_to") &&
                    v.destinationAreaId && (
                      <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-2">
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVillagerOrder(v.id, "gather", v.destinationAreaId, null, null);
                            }}
                            disabled={v.order === "gather"}
                            className="py-1 text-center rounded bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-900 text-[9px] font-bold text-emerald-400 hover:text-emerald-200 transition disabled:opacity-40"
                          >
                            採取に変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVillagerOrder(v.id, "hunt", v.destinationAreaId, null, null);
                            }}
                            disabled={v.order === "hunt"}
                            className="py-1 text-center rounded bg-red-950/40 hover:bg-red-900 border border-red-900 text-[9px] font-bold text-red-400 hover:text-red-200 transition disabled:opacity-40"
                          >
                            討伐に変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVillagerOrder(v.id, "rest", v.destinationAreaId);
                            }}
                            className="py-1 text-center rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition"
                          >
                            帰還させる
                          </button>
                        </div>

                        {v.order === "gather" && (
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-slate-400">個別採取ターゲット:</span>
                            <select
                              value={v.targetGatherItemId || ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : e.target.value;
                                setVillagerOrder(v.id, v.order, v.destinationAreaId, val, null);
                              }}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-mono w-28"
                            >
                              <option value="">自動選択 (AI)</option>
                              {dungeons
                                .find((d) => d.id === v.destinationAreaId)
                                ?.gathers.filter(
                                  (g) =>
                                    (dungeons.find((d) => d.id === v.destinationAreaId)
                                      ?.explorationProgress || 0) >= (g.unlockedAtProgress || 0),
                                )
                                .map((g) => (
                                  <option key={g.itemId} value={g.itemId}>
                                    {ITEMS[g.itemId].name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        {v.order === "hunt" && (
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-slate-400">個別討伐ターゲット:</span>
                            <select
                              value={v.targetMonsterId || ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : e.target.value;
                                setVillagerOrder(v.id, v.order, v.destinationAreaId, null, val);
                              }}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-mono w-28"
                            >
                              <option value="">自動選択 (AI)</option>
                              {dungeons
                                .find((d) => d.id === v.destinationAreaId)
                                ?.monsters.filter(
                                  (m) =>
                                    (dungeons.find((d) => d.id === v.destinationAreaId)
                                      ?.explorationProgress || 0) >= (m.unlockedAtProgress || 0),
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 転職モーダル */}
      {activeModal === "job" && selectedVillager && (
        <JobChangeModal
          villager={selectedVillager}
          onClose={() => {
            setActiveModal(null);
            setSelectedVillager(null);
          }}
        />
      )}

      {/* 装備モーダル */}
      {activeModal === "equip" && selectedVillager && (
        <EquipmentModal
          villager={selectedVillager}
          onClose={() => {
            setActiveModal(null);
            setSelectedVillager(null);
          }}
        />
      )}
    </div>
  );
};
