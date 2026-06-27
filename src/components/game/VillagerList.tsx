import { User } from "lucide-react";
import React, { useMemo, useState, useRef, useEffect } from "react";

import { useVillagers, useDungeons, useVillagerActions, useFacilities } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { JobType, Villager } from "../../types/game";
import { getAllPartyKeys } from "../../utils/partyHelpers";
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

type SortOption =
  | "added"
  | "added-reverse"
  | "level-desc"
  | "level-asc"
  | "wage-desc"
  | "wage-asc"
  | "id-asc"
  | "id-desc";

export const VillagerList: React.FC = () => {
  const dungeonsData = useDungeons();
  const villagers = useVillagers();
  const facilities = useFacilities();
  const { setVillagerOrder } = useVillagerActions();
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(null);
  const [activeModal, setActiveModal] = useState<"job" | null>(null);
  const {
    isExpanded: isExpandedFn,
    toggleExpand,
    collapseAll,
  } = useExpandedState({ single: true });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        collapseAll();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [collapseAll]);

  const [jobGroup, setJobGroup] = useState<JobGroup>("all");
  const [sortBy, setSortBy] = useState<SortOption>("added");

  // 採取 (order="gather") にはパーティという概念がないため、PT ラベル/サイズは hunter のみで計算する
  const hunterVillagers = useMemo(() => villagers.filter((v) => v.order === "hunt"), [villagers]);
  const allPartyKeys = useMemo(() => getAllPartyKeys(hunterVillagers), [hunterVillagers]);
  const partySizeMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of hunterVillagers) {
      const key = v.autoTargetName;
      if (key) map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [hunterVillagers]);

  const filteredVillagers = useMemo(() => {
    let result = [...villagers];

    if (jobGroup === "production") {
      result = result.filter((v) => PRODUCTION_JOBS.includes(v.currentJob));
    } else if (jobGroup === "combat") {
      result = result.filter((v) => COMBAT_JOBS.includes(v.currentJob));
    }

    if (sortBy === "added-reverse") {
      result = [...result].reverse();
    } else if (sortBy !== "added") {
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
    }

    return result;
  }, [villagers, jobGroup, sortBy]);

  const openJobModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal("job");
  };

  return (
    <div ref={containerRef} className="h-full">
      <Panel
        title={`村人・AI指示一覧 (${filteredVillagers.length}/${villagers.length})`}
        icon={<User className="w-5 h-5 text-sky-400 shrink-0" />}
      >
        <SortSelect
          value={sortBy}
          onChange={(val) => setSortBy(val as SortOption)}
          options={[
            { value: "added", label: "追加順" },
            { value: "added-reverse", label: "追加順 (降順)" },
            { value: "id-asc", label: "ID順" },
            { value: "id-desc", label: "ID順 (降順)" },
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
                onSetOrder={setVillagerOrder}
                dungeons={dungeonsData.dungeons}
                facilities={facilities}
                allPartyKeys={allPartyKeys}
                partySizeMap={partySizeMap}
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
      </Panel>
    </div>
  );
};
