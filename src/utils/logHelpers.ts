import type { GameLog } from "../types/game";

/**
 * Returns Tailwind color classes for a given log type.
 * Shared between StatusBar inline display and LogHistoryWindow.
 */
export const getLogColorClass = (type: GameLog["type"]): string => {
  switch (type) {
    case "combat":
      return "text-red-400";
    case "gather":
      return "text-emerald-400";
    case "craft":
      return "text-sky-400";
    case "upgrade":
      return "text-amber-400";
    case "system":
      return "text-purple-400 font-bold";
    case "warning":
      return "text-yellow-400 font-semibold";
    case "error":
      return "text-red-500 font-bold";
    default:
      return "text-slate-300";
  }
};
