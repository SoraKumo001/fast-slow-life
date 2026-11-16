import { AlertCircle, EyeOff } from "lucide-react";
import React, { useState } from "react";

import { ITEMS } from "../../data/masterData";
import { useVillagers, useVillagerActions } from "../../hooks";
import { getGatherDepth, getMonsterDepth } from "../../store/dungeonSpatialHelper";
import { useGameStore } from "../../store/gameStore";
import { DungeonArea, Villager } from "../../types/game";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface DungeonAssignModalProps {
  area: DungeonArea;
  onClose: () => void;
}

const MAX_PARTY_SIZE = 4;

/**
 * Phase 4a: パーティ派遣モーダル。
 * 待機中の村人を最大4人まで複数選択し、同一ターゲット（採取アイテム or 魔物）へ
 * 一括派遣する。未解放ノードのターゲットは名前を伏せて表示するが選択は可能。
 */
export const DungeonAssignModal: React.FC<DungeonAssignModalProps> = ({ area, onClose }) => {
  const villagers = useVillagers();
  const { dispatchParty } = useVillagerActions();
  const revealedNodeIds = useGameStore((s) => s.revealedNodes[area.id]);
  const revealed = new Set(revealedNodeIds ?? []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetKey, setTargetKey] = useState<string>("auto:gather");

  const idleVillagers = villagers.filter((v: Villager) => v.status === "idle");

  const toggleVillager = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PARTY_SIZE) return prev;
      return [...prev, id];
    });
  };

  const gatherTargets = area.gathers.filter(
    (g) => area.explorationProgress >= (g.unlockedAtProgress || 0),
  );
  const monsterTargets = area.monsters.filter(
    (m) => !m.isBoss && area.explorationProgress >= (m.unlockedAtProgress || 0),
  );

  const handleDispatch = () => {
    if (selectedIds.length === 0) return;
    if (targetKey.startsWith("gather:")) {
      dispatchParty({
        villagerIds: selectedIds,
        areaId: area.id,
        order: "gather",
        targetId: targetKey.slice("gather:".length),
      });
    } else if (targetKey.startsWith("monster:")) {
      dispatchParty({
        villagerIds: selectedIds,
        areaId: area.id,
        order: "hunt",
        targetId: targetKey.slice("monster:".length),
      });
    } else {
      dispatchParty({
        villagerIds: selectedIds,
        areaId: area.id,
        order: targetKey === "auto:hunt" ? "hunt" : "gather",
        targetId: null,
      });
    }
    onClose();
  };

  const targetOption = (
    key: string,
    label: React.ReactNode,
    sub: string,
  ) => (
    <label
      key={key}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded border cursor-pointer text-[11px] transition ${
        targetKey === key
          ? "bg-sky-950/60 border-sky-600 text-sky-200"
          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
      }`}
    >
      <input
        type="radio"
        name="party-target"
        checked={targetKey === key}
        onChange={() => setTargetKey(key)}
        className="accent-sky-500"
      />
      <span className="font-bold">{label}</span>
      <span className="text-[9px] font-mono text-slate-500 ml-auto">{sub}</span>
    </label>
  );

  return (
    <Modal onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            パーティを {area.name} へ派遣
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            推奨レベル: {area.recommendedLevel} • 必要移動時間: {area.distance}
            時間 • 最大{MAX_PARTY_SIZE}人まで選択可
          </p>
        </div>

        {/* 村人選択 */}
        <div>
          <p className="text-[11px] font-bold text-slate-300 mb-1.5">
            村人を選択（{selectedIds.length}/{MAX_PARTY_SIZE}）
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {idleVillagers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                派遣できる待機中の村人がいません。
              </p>
            ) : (
              idleVillagers.map((v: Villager) => {
                const isLvOk = v.level >= area.recommendedLevel;
                const checked = selectedIds.includes(v.id);
                const disabled = !checked && selectedIds.length >= MAX_PARTY_SIZE;
                return (
                  <label
                    key={v.id}
                    className={`bg-slate-950 border rounded-lg p-2.5 flex items-center gap-2.5 ${
                      disabled ? "opacity-40" : "cursor-pointer"
                    } ${checked ? "border-sky-600" : "border-slate-800"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleVillager(v.id)}
                      className="accent-sky-500"
                    />
                    <div>
                      <span className="font-bold text-sm text-slate-200 block">{v.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Lv.{v.level} • {v.currentJob} • HP:{v.currentHp}/{v.maxHp} • STR:
                        {v.str}
                      </span>
                      {!isLvOk && (
                        <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5 mt-0.5">
                          <AlertCircle className="w-3 h-3" /> レベル不足注意
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ターゲット選択 */}
        <div>
          <p className="text-[11px] font-bold text-slate-300 mb-1.5">ターゲット</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {targetOption("auto:gather", "おまかせ（採取）", "自動選択")}
            {targetOption("auto:hunt", "おまかせ（討伐）", "自動選択")}
            {gatherTargets.map((g) => {
              const depth = getGatherDepth(area, g);
              const isRevealed = revealed.has(g.itemId);
              return targetOption(
                `gather:${g.itemId}`,
                isRevealed ? (
                  `採取: ${ITEMS[g.itemId]?.name || g.itemId}`
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> 未知の採取ポイント
                  </span>
                ),
                `${depth}m`,
              );
            })}
            {monsterTargets.map((m) => {
              const depth = getMonsterDepth(area, m);
              const isRevealed = revealed.has(m.id);
              return targetOption(
                `monster:${m.id}`,
                isRevealed ? (
                  `討伐: ${m.name} (Lv.${m.level})`
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> 未知の魔物
                  </span>
                ),
                `${depth}m`,
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} variant="secondary" size="md">
            キャンセル
          </Button>
          <Button
            onClick={handleDispatch}
            variant="success"
            size="md"
            disabled={selectedIds.length === 0}
          >
            {selectedIds.length}人を派遣
          </Button>
        </div>
      </div>
    </Modal>
  );
};
