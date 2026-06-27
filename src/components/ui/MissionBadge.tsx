import React from "react";

import { PARTY_SIZE } from "../../store/schedulerConfig";
import type { Villager } from "../../types/game";
import { getPartyColor, isSolo } from "../../utils/partyHelpers";

interface MissionBadgeProps {
  villager: Villager;
  /** パーティラベル (A, B, C...) — 単騎時は空文字 */
  partyLabel: string;
  /** パーティサイズ（現在のメンバー数）— 単騎時は 0 */
  partySize: number;
  className?: string;
}

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  idle: {
    bg: "bg-slate-800",
    text: "text-slate-400",
    border: "border-slate-700",
    label: "待機",
  },
  resting: {
    bg: "bg-emerald-950/80",
    text: "text-emerald-400",
    border: "border-emerald-900",
    label: "休息中",
  },
  active: {
    bg: "bg-red-950/80",
    text: "text-red-400",
    border: "border-red-900",
    label: "活動中",
  },
  traveling_to: {
    bg: "bg-amber-950/80",
    text: "text-amber-400",
    border: "border-amber-900",
    label: "移動中",
  },
  traveling_back: {
    bg: "bg-amber-950/80",
    text: "text-amber-400",
    border: "border-amber-900",
    label: "帰還中",
  },
};

const DEFAULT_STATUS: StatusStyle = STATUS_STYLES.idle;

function getStatus(villager: Villager): StatusStyle {
  return STATUS_STYLES[villager.status] ?? DEFAULT_STATUS;
}

export const MissionBadge: React.FC<MissionBadgeProps> = ({
  villager,
  partyLabel,
  partySize,
  className = "",
}) => {
  const status = getStatus(villager);
  const timeLabel = `${villager.travelTimeLeft}h`;
  const solo = isSolo(villager);

  // 単騎 → 状態バッジのみ表示
  if (solo) {
    return (
      <span
        className={`inline-flex items-center text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${status.bg} ${status.border} ${status.text} ${className}`}
        title={`${status.label} (${timeLabel})`}
      >
        {status.label} {timeLabel}
      </span>
    );
  }

  // パーティ所属 → コンボバッジ
  const party = getPartyColor(villager.autoTargetName ?? "");
  if (!party) return null;

  return (
    <span
      className={`inline-flex items-stretch rounded overflow-hidden border ${party.border} ${className}`}
      title={`パーティ ${partyLabel} (${partySize}/${PARTY_SIZE}) - ${status.label} (${timeLabel})`}
    >
      {/* パーティセグメント */}
      <span
        className={`text-[9px] px-1.5 py-0.5 font-bold inline-flex items-center gap-1 ${party.bg} ${party.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${party.dot}`} />
        PT-{partyLabel}
        <span className="opacity-70">
          {partySize}/{PARTY_SIZE}
        </span>
      </span>
      {/* 区切り線 */}
      <span className="w-px bg-white/10" />
      {/* 状態セグメント */}
      <span
        className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-bold inline-flex items-center ${status.bg} ${status.text}`}
      >
        {status.label} {timeLabel}
      </span>
    </span>
  );
};
