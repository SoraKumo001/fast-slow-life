import React, { useState } from "react";
import { useGameStore, JOBS, ITEMS, MONSTERS } from "../store/gameStore";
import { JobType, Villager } from "../types/game";
import {
  User,
  Shield,
  Sword,
  Heart,
  Zap,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

export const VillagerList: React.FC = () => {
  const {
    dungeons,
    villagers,
    gold,
    inventory,
    facilities,
    changeVillagerJob,
    equipItem,
    unequipItem,
    setVillagerOrder,
    soulUpgrades,
  } = useGameStore();
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(
    null,
  );
  const [activeModal, setActiveModal] = useState<"job" | "equip" | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getVillagerPurpose = (v: Villager) => {
    if (v.status === "resting") return "宿屋で休息中";
    if (v.assignedCraftJobId) {
      let craftItemName = "";
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
        const targetName = v.targetMonsterId
          ? MONSTERS[v.targetMonsterId]?.name
          : v.autoTargetName;
        actionStr = targetName ? `討伐 [${targetName}]` : "討伐";
      }

      let statusStr = "";
      if (v.status === "traveling_to") statusStr = "へ移動中";
      else if (v.status === "traveling_back") statusStr = "から帰還中";
      else statusStr = "で活動中";

      return `${areaName} : ${actionStr}${statusStr}`;
    }
    return "待機中 (方針なし)";
  };

  const discountLvl = soulUpgrades.discount || 0;
  const discountRate = 1 - discountLvl * 0.1;

  const openJobModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("job");
  };

  const openEquipModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("equip");
  };

  const handleJobChange = (job: JobType) => {
    if (selectedVillager) {
      changeVillagerJob(selectedVillager.id, job);
      setActiveModal(null);
    }
  };

  const handleEquip = (itemId: string, slot: "weapon" | "armor") => {
    if (selectedVillager) {
      equipItem(selectedVillager.id, itemId, slot);
      setActiveModal(null);
    }
  };

  const handleUnequip = (slot: "weapon" | "armor") => {
    if (selectedVillager) {
      unequipItem(selectedVillager.id, slot);
      setActiveModal(null);
    }
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
                  <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 font-medium">
                    {v.currentJob}
                  </span>
                  <span className="font-bold text-slate-100 text-sm">
                    {v.name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono ml-2">
                    Lv.{v.level}{" "}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({v.exp}/{v.level * 100})
                    </span>
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-300 font-medium mt-0.5 block">
                      {getVillagerPurpose(v)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
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
                    </span>
                    {v.status === "traveling_to" && (
                      <p className="text-[8px] text-slate-500 font-mono">
                        到着まで {v.travelTimeLeft}h
                      </p>
                    )}
                    {v.status === "traveling_back" && (
                      <p className="text-[8px] text-slate-500 font-mono">
                        帰還まで {v.travelTimeLeft}h
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* 展開された詳細ステータス */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-900 space-y-3">
                  {/* HP & スタミナ */}
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
                      <span className="text-slate-200">{v.stamina} / 100</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1">
                      <div
                        className="bg-amber-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${v.stamina}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-sky-400" /> EXP
                      </span>
                      <span className="text-slate-200">
                        {v.exp} / {v.level * 100}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1">
                      <div
                        className="bg-sky-400 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${(v.exp / (v.level * 100)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* ステータス & 転職 & 装備 */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="space-y-1 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>職業変更:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openJobModal(v);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition"
                          title="転職する"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                      <p>
                        STR (腕力):{" "}
                        <span className="text-slate-200 font-bold">
                          {v.str}
                        </span>
                      </p>
                      <p>
                        INT (魔力):{" "}
                        <span className="text-slate-200 font-bold">
                          {v.int}
                        </span>
                      </p>
                      <p>
                        DEX (器用):{" "}
                        <span className="text-slate-200 font-bold">
                          {v.dex}
                        </span>
                      </p>
                      <p>
                        AGI (敏捷):{" "}
                        <span className="text-slate-200 font-bold">
                          {v.agi}
                        </span>
                      </p>
                    </div>

                    {/* 装備ボタン */}
                    <div className="flex flex-col gap-1.5 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEquipModal(v);
                        }}
                        className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                      >
                        <span className="flex items-center gap-1 text-[10px]">
                          <Sword className="w-3 h-3 text-amber-500" />
                          {v.weaponId !== "none"
                            ? ITEMS[v.weaponId].name
                            : "武器なし"}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEquipModal(v);
                        }}
                        className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                      >
                        <span className="flex items-center gap-1 text-[10px]">
                          <Shield className="w-3 h-3 text-sky-400" />
                          {v.armorId !== "none"
                            ? ITEMS[v.armorId].name
                            : "防具なし"}
                        </span>
                      </button>
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
                              setVillagerOrder(
                                v.id,
                                "gather",
                                v.destinationAreaId,
                                null,
                                null,
                              );
                            }}
                            disabled={v.order === "gather"}
                            className="py-1 text-center rounded bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-900 text-[9px] font-bold text-emerald-400 hover:text-emerald-200 transition disabled:opacity-40"
                          >
                            採取に変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVillagerOrder(
                                v.id,
                                "hunt",
                                v.destinationAreaId,
                                null,
                                null,
                              );
                            }}
                            disabled={v.order === "hunt"}
                            className="py-1 text-center rounded bg-red-950/40 hover:bg-red-900 border border-red-900 text-[9px] font-bold text-red-400 hover:text-red-200 transition disabled:opacity-40"
                          >
                            討伐に変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVillagerOrder(
                                v.id,
                                "rest",
                                v.destinationAreaId,
                              );
                            }}
                            className="py-1 text-center rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition"
                          >
                            帰還させる
                          </button>
                        </div>

                        {v.order === "gather" && (
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-slate-400">
                              個別採取ターゲット:
                            </span>
                            <select
                              value={v.targetGatherItemId || ""}
                              onChange={(e) => {
                                const val =
                                  e.target.value === "" ? null : e.target.value;
                                setVillagerOrder(
                                  v.id,
                                  v.order,
                                  v.destinationAreaId,
                                  val,
                                  null,
                                );
                              }}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-mono w-28"
                            >
                              <option value="">自動選択 (AI)</option>
                              {dungeons
                                .find((d) => d.id === v.destinationAreaId)
                                ?.gathers.filter(
                                  (g) =>
                                    (dungeons.find(
                                      (d) => d.id === v.destinationAreaId,
                                    )?.explorationProgress || 0) >=
                                    (g.unlockedAtProgress || 0),
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
                            <span className="text-slate-400">
                              個別討伐ターゲット:
                            </span>
                            <select
                              value={v.targetMonsterId || ""}
                              onChange={(e) => {
                                const val =
                                  e.target.value === "" ? null : e.target.value;
                                setVillagerOrder(
                                  v.id,
                                  v.order,
                                  v.destinationAreaId,
                                  null,
                                  val,
                                );
                              }}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 font-mono w-28"
                            >
                              <option value="">自動選択 (AI)</option>
                              {dungeons
                                .find((d) => d.id === v.destinationAreaId)
                                ?.monsters.filter(
                                  (m) =>
                                    (dungeons.find(
                                      (d) => d.id === v.destinationAreaId,
                                    )?.explorationProgress || 0) >=
                                    (m.unlockedAtProgress || 0),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {selectedVillager.name} の転職先を選択
              </h3>
              <p className="text-xs text-slate-400">
                ※すでに転職済みの職業への再変更コストは 0G になります。
              </p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(Object.keys(JOBS) as JobType[]).map((jobKey) => {
                const job = JOBS[jobKey];
                const isHistory = selectedVillager.jobHistory.includes(jobKey);
                const cost = isHistory
                  ? 0
                  : Math.floor(job.cost * discountRate);
                const canAfford = gold >= cost;
                const isCurrent = selectedVillager.currentJob === jobKey;

                return (
                  <div
                    key={jobKey}
                    className={`border rounded-lg p-3 flex justify-between items-center ${
                      isCurrent
                        ? "border-sky-500 bg-sky-950/20"
                        : "border-slate-800 bg-slate-950/50 hover:bg-slate-950"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-200">
                          {jobKey}
                        </span>
                        {isHistory && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                            習得済
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {job.description}
                      </p>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span className="text-xs text-sky-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 現在
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJobChange(jobKey)}
                          disabled={!canAfford}
                          className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs transition"
                        >
                          {cost === 0 ? "無料" : `${cost} G`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 装備モーダル */}
      {activeModal === "equip" && selectedVillager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {selectedVillager.name} の装備変更
              </h3>
              <p className="text-xs text-slate-400">
                現在装備: 武器(
                {selectedVillager.weaponId !== "none"
                  ? ITEMS[selectedVillager.weaponId].name
                  : "なし"}
                ), 防具(
                {selectedVillager.armorId !== "none"
                  ? ITEMS[selectedVillager.armorId].name
                  : "なし"}
                )
              </p>
            </div>

            <div className="space-y-4">
              {/* 武器一覧 */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  武器 (攻撃UP)
                </h4>
                <div className="space-y-2">
                  {/* 装備なし */}
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                    <span className="text-xs text-slate-400">装備なし</span>
                    {selectedVillager.weaponId !== "none" ? (
                      <button
                        onClick={() => handleUnequip("weapon")}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                      >
                        外す
                      </button>
                    ) : (
                      <span className="text-[10px] text-sky-400 font-bold">
                        装備中
                      </span>
                    )}
                  </div>

                  {/* 倉庫内の武器 */}
                  {Object.entries(ITEMS)
                    .filter(([_, item]) => item.category === "gear_weapon")
                    .map(([itemId, item]) => {
                      const count = inventory[itemId] || 0;
                      const isEquipped = selectedVillager.weaponId === itemId;

                      return (
                        <div
                          key={itemId}
                          className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-200">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              倉庫在庫: {count}個
                            </p>
                          </div>
                          {isEquipped ? (
                            <span className="text-[10px] text-sky-400 font-bold">
                              装備中
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEquip(itemId, "weapon")}
                              disabled={count <= 0}
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                            >
                              装備
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 防具一覧 */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  防具 (防御UP)
                </h4>
                <div className="space-y-2">
                  {/* 装備なし */}
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                    <span className="text-xs text-slate-400">装備なし</span>
                    {selectedVillager.armorId !== "none" ? (
                      <button
                        onClick={() => handleUnequip("armor")}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                      >
                        外す
                      </button>
                    ) : (
                      <span className="text-[10px] text-sky-400 font-bold">
                        装備中
                      </span>
                    )}
                  </div>

                  {/* 倉庫内の防具 */}
                  {Object.entries(ITEMS)
                    .filter(([_, item]) => item.category === "gear_armor")
                    .map(([itemId, item]) => {
                      const count = inventory[itemId] || 0;
                      const isEquipped = selectedVillager.armorId === itemId;

                      return (
                        <div
                          key={itemId}
                          className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-200">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              倉庫在庫: {count}個
                            </p>
                          </div>
                          {isEquipped ? (
                            <span className="text-[10px] text-sky-400 font-bold">
                              装備中
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEquip(itemId, "armor")}
                              disabled={count <= 0}
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                            >
                              装備
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
