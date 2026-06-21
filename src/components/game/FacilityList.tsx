import { Home } from "lucide-react";
import React from "react";

import {
  useFacilities,
  usePlayerResources,
  useSoulUpgrades,
  useVillagers,
  useCraftActions,
  useVillagerActions,
  useInventory,
} from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { Panel } from "../ui/Panel";
import { FacilityCard } from "./FacilityCard";

const FACILITY_IDS = [
  "inn",
  "market",
  "workshop",
  "blacksmith",
  "alchemy",
  "guild",
  "weapon_shop",
  "pharmacy",
  "farm",
  "lumberyard",
  "quarry",
] as const;

interface FacilityListProps {
  onOpenTradeCaravan?: () => void;
}

export const FacilityList: React.FC<FacilityListProps> = ({ onOpenTradeCaravan }) => {
  const facilities = useFacilities();
  const { inventory, tradeRules } = useInventory();
  const { gold } = usePlayerResources();
  const soulUpgrades = useSoulUpgrades();
  const villagers = useVillagers();
  const { startFacilityUpgrade } = useCraftActions();
  const { hireVillager } = useVillagerActions();
  const { isExpanded: isExpandedFn, toggleExpand } = useExpandedState();

  const buildLvl = soulUpgrades.building || 0;
  const costReduction = 1 - buildLvl * 0.05;

  return (
    <Panel title="村の施設・クラフト" icon={<Home className="w-5 h-5 text-sky-400" />}>
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {FACILITY_IDS.map((id) => facilities[id])
          .filter(Boolean)
          .map((fac) => (
            <FacilityCard
              key={fac.id}
              fac={fac}
              inventory={inventory}
              gold={gold}
              villagers={villagers}
              tradeRules={tradeRules}
              costReduction={costReduction}
              expanded={isExpandedFn(fac.id)}
              onToggleExpand={toggleExpand}
              onStartUpgrade={startFacilityUpgrade}
              onHireVillager={hireVillager}
              onOpenTradeCaravan={onOpenTradeCaravan}
            />
          ))}
      </div>
    </Panel>
  );
};
