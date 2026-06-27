import { Hammer, Home, TreePine } from "lucide-react";
import React from "react";

import { useFacilities, useCraftActions, useVillagerActions } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { FacilityType } from "../../types/game";
import { Panel } from "../ui/Panel";
import { FacilityCard } from "./FacilityCard";

const FACILITY_CATEGORIES: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ids: FacilityType[];
}[] = [
  {
    label: "宿泊・雇用・訓練",
    icon: Home,
    ids: ["inn", "guild", "training_ground", "market"],
  },
  {
    label: "加工・クラフト",
    icon: Hammer,
    ids: ["workshop", "kitchen", "alchemy", "weapon_shop"],
  },
  { label: "資源生産", icon: TreePine, ids: ["farm", "lumberyard", "quarry"] },
];

interface FacilityListProps {}

export const FacilityList: React.FC<FacilityListProps> = () => {
  const facilities = useFacilities();
  const { startFacilityUpgrade } = useCraftActions();
  const { hireVillager } = useVillagerActions();
  const { isExpanded: isExpandedFn, toggleExpand } = useExpandedState();

  return (
    <Panel title="村の施設・クラフト" icon={<Home className="w-5 h-5 text-sky-400" />}>
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {FACILITY_CATEGORIES.map((cat) => (
          <div key={cat.label} className="space-y-2">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-1">
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </h3>
            {cat.ids.map((id) => {
              const fac = facilities[id];
              if (!fac) return null;
              return (
                <FacilityCard
                  key={fac.id}
                  fac={fac}
                  expanded={isExpandedFn(fac.id)}
                  onToggleExpand={toggleExpand}
                  onStartUpgrade={startFacilityUpgrade}
                  onHireVillager={hireVillager}
                />
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
};
