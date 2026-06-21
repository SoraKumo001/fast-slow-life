import { User } from "lucide-react";
import React, { useState } from "react";

import { useVillagers, useDungeons, useVillagerActions, useFacilities } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
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
            dungeonsData={dungeonsData}
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
