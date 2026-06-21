import { useState } from "react";

export const useExpandedState = () => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const isExpanded = (id: string) => !!expandedIds[id];
  return { isExpanded, toggleExpand };
};
