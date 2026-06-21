import { User } from "lucide-react";
import React, { useState } from "react";

import { useVillagers, useDungeons, useVillagerActions, useFacilities } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { useGameStore } from "../../store/gameStore";
import { Villager } from "../../types/game";
import { EquipmentModal } from "../modals/EquipmentModal";
import { JobChangeModal } from "../modals/JobChangeModal";
import { Panel } from "../ui/Panel";
import { VillagerRow } from "./VillagerRow";

export const VillagerList: React.FC = () => {
  const dungeonsData = useDungeons();
  const villagers = useVillagers();
  const facilities = useFacilities();
  const { setVillagerOrder } = useVillagerActions();
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(null);
  const [activeModal, setActiveModal] = useState<"job" | "equip" | null>(null);
  const { isExpanded: isExpandedFn, toggleExpand } = useExpandedState();

  const isSalaryUnpaid = useGameStore((state) => state.isSalaryUnpaid);
  const paySalaryDebt = useGameStore((state) => state.paySalaryDebt);
  const gold = useGameStore((state) => state.gold);

  const dailySalaryTotal = villagers.reduce((sum, v) => {
    const totalStat = v.str + v.int + v.dex + v.agi + v.vit;
    return sum + Math.floor(totalStat * 0.1);
  }, 0);

  const openJobModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("job");
  };

  const openEquipModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("equip");
  };

  return (
    <Panel
      title={`村人・AI指示一覧 (${villagers.length}/10)`}
      icon={<User className="w-5 h-5 text-sky-400" />}
    >
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {isSalaryUnpaid && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                給与未払いデバフ発生中！
              </p>
              <p className="text-[10px] text-slate-400">
                村人全員の全能力値が 30% 低下しています。
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                paySalaryDebt();
              }}
              disabled={gold < dailySalaryTotal}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed text-center whitespace-nowrap"
            >
              給与を支払う ({dailySalaryTotal} G)
            </button>
          </div>
        )}

        {villagers.map((v) => (
          <VillagerRow
            key={v.id}
            villager={v}
            isExpanded={isExpandedFn(v.id)}
            onToggleExpand={toggleExpand}
            onOpenJobModal={openJobModal}
            onOpenEquipModal={openEquipModal}
            onSetOrder={setVillagerOrder}
            dungeons={dungeonsData.dungeons}
            facilities={facilities}
          />
        ))}
      </div>

      {activeModal === "job" && selectedVillager && (
        <JobChangeModal
          villager={selectedVillager}
          onClose={() => {
            setActiveModal(null);
            setSelectedVillager(null);
          }}
        />
      )}

      {activeModal === "equip" && selectedVillager && (
        <EquipmentModal
          villager={selectedVillager}
          onClose={() => {
            setActiveModal(null);
            setSelectedVillager(null);
          }}
        />
      )}
    </Panel>
  );
};
