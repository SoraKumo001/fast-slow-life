import { User } from "lucide-react";
import React, { useMemo, useState } from "react";

import { useVillagers, useDungeons, useVillagerActions, useFacilities } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { useGameStore } from "../../store/gameStore";
import { JobType, Villager } from "../../types/game";
import { EquipmentModal } from "../modals/EquipmentModal";
import { JobChangeModal } from "../modals/JobChangeModal";
import { FilterTabs } from "../ui/FilterTabs";
import { Panel } from "../ui/Panel";
import { SortSelect } from "../ui/SortSelect";
import { VillagerRow } from "./VillagerRow";

const PRODUCTION_JOBS: JobType[] = ["農民", "木こり", "鉱夫", "薬師", "職人"];
const COMBAT_JOBS: JobType[] = ["猟師", "戦士", "魔術師", "僧侶"];
type JobGroup = "all" | "production" | "combat";

const getSalary = (v: Villager) =>
  v.currentJob === "無職" ? 0 : Math.floor((v.str + v.int + v.dex + v.agi + v.vit) * 0.1);

type SortOption = "level-desc" | "level-asc" | "wage-desc" | "wage-asc" | "id-asc" | "id-desc";

export const VillagerList: React.FC = () => {
  const dungeonsData = useDungeons();
  const villagers = useVillagers();
  const facilities = useFacilities();
  const { setVillagerOrder } = useVillagerActions();
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(null);
  const [activeModal, setActiveModal] = useState<"job" | "equip" | null>(null);
  const { isExpanded: isExpandedFn, toggleExpand } = useExpandedState();

  const payVillagerDebts = useGameStore((state) => state.payVillagerDebts);
  const gold = useGameStore((state) => state.gold);

  const [jobGroup, setJobGroup] = useState<JobGroup>("all");
  const [sortBy, setSortBy] = useState<SortOption>("id-asc");

  const totalDebts = useMemo(
    () => villagers.reduce((sum, v) => sum + (v.gold < 0 ? -v.gold : 0), 0),
    [villagers],
  );

  const filteredVillagers = useMemo(() => {
    let result = [...villagers];

    if (jobGroup === "production") {
      result = result.filter((v) => PRODUCTION_JOBS.includes(v.currentJob));
    } else if (jobGroup === "combat") {
      result = result.filter((v) => COMBAT_JOBS.includes(v.currentJob));
    }

    result.sort((a, b) => {
      if (sortBy === "id-asc" || sortBy === "id-desc") {
        const numA = parseInt(a.id.replace(/^v_?/, ""), 10);
        const numB = parseInt(b.id.replace(/^v_?/, ""), 10);
        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB)) cmp = numA - numB;
        else if (!isNaN(numA)) cmp = -1;
        else if (!isNaN(numB)) cmp = 1;
        else cmp = a.id.localeCompare(b.id);
        return sortBy === "id-asc" ? cmp : -cmp;
      }
      const [field, dir] = sortBy.split("-") as ["level" | "wage", "asc" | "desc"];
      let cmp = 0;
      if (field === "level") {
        cmp = a.level - b.level;
      } else {
        cmp = getSalary(a) - getSalary(b);
      }
      return dir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [villagers, jobGroup, sortBy]);

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
      title={`村人・AI指示一覧 (${filteredVillagers.length}/${villagers.length})`}
      icon={<User className="w-5 h-5 text-sky-400 shrink-0" />}
    >
      <SortSelect
        value={sortBy}
        onChange={(val) => setSortBy(val as SortOption)}
        options={[
          { value: "id-asc", label: "登録順 (昇順)" },
          { value: "id-desc", label: "登録順 (降順)" },
          { value: "level-desc", label: "Lv順 (降順)" },
          { value: "level-asc", label: "Lv順 (昇順)" },
          { value: "wage-desc", label: "賃金順 (降順)" },
          { value: "wage-asc", label: "賃金順 (昇順)" },
        ]}
      />

      <FilterTabs
        activeTab={jobGroup}
        onChange={setJobGroup}
        tabs={[
          { id: "all", label: "すべて" },
          { id: "production", label: "生産職" },
          { id: "combat", label: "戦闘職" },
        ]}
      />

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {totalDebts > 0 && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ツケ（未払い）のある村人がいます！
              </p>
              <p className="text-[10px] text-slate-400">
                ツケを抱える村人は全能力値が 30% 低下しています。
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                payVillagerDebts();
              }}
              disabled={gold <= 0}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-semibold transition cursor-pointer disabled:cursor-not-allowed text-center whitespace-nowrap"
            >
              ツケを肩代わりする (計 {totalDebts} G)
            </button>
          </div>
        )}

        {filteredVillagers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">条件に一致する村人がいません</p>
        ) : (
          filteredVillagers.map((v) => (
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
          ))
        )}
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
