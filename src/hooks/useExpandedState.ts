import { useState, useCallback } from "react";

export const useExpandedState = (options?: { single?: boolean }) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      if (options?.single) {
        return prev[id] ? {} : { [id]: true };
      }
      return { ...prev, [id]: !prev[id] };
    });
  };
  const isExpanded = (id: string) => !!expandedIds[id];
  const collapseAll = useCallback(() => {
    setExpandedIds({});
  }, []);
  return { isExpanded, toggleExpand, collapseAll };
};
