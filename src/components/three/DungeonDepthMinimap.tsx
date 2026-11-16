import React, { useRef } from "react";

import { buildDungeonMap, initialRevealedNodes } from "../../store/dungeonMap";
import { getExploredDepth } from "../../store/dungeonSpatialHelper";
import type { DungeonArea, Villager } from "../../types/game";

interface DungeonDepthMinimapProps {
  area: DungeonArea;
  villagers: Villager[];
  onSelectDepth: (depth: number) => void;
  /** Phase 4a: 解放済みノードID（未指定時は探索度から初期値を導出） */
  revealedNodeIds?: string[];
}

const VIEW_W = 100;
const VIEW_H = 150;
const mx = (lane: number) => 50 + lane * 26;
const my = (depth: number, maxDepth: number) => 8 + (depth / maxDepth) * (VIEW_H - 16);

/**
 * Phase 4a: ダンジョンのノードグラフを SVG で表示するミニマップ。
 * 解放済みノードは種別色、未解放は「?」、村人はドットで表示する。
 * クリックした高さの深度へカメラを移動する。
 */
export const DungeonDepthMinimap: React.FC<DungeonDepthMinimapProps> = ({
  area,
  villagers,
  onSelectDepth,
  revealedNodeIds,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const maxDepth = area.maxDepth || 100;
  const exploredDepth = getExploredDepth(area);
  const map = buildDungeonMap(area);
  const revealed = new Set(revealedNodeIds ?? initialRevealedNodes(area));
  const bossIds = new Set(area.monsters.filter((m) => m.isBoss).map((m) => m.id));

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    // my() の余白 (8px / VIEW_H) を差し引いて深度に換算
    const depthRatio = Math.max(
      0,
      Math.min(1, (ratio * VIEW_H - 8) / (VIEW_H - 16)),
    );
    onSelectDepth(Math.round(depthRatio * maxDepth));
  };

  return (
    <div className="space-y-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        onClick={handleClick}
        className="w-full h-36 rounded bg-slate-950 border border-slate-800 cursor-pointer"
        role="img"
        aria-label={`${area.name} ノードマップ`}
      >
        {/* エッジ */}
        {map.edges.map(([aId, bId]) => {
          const a = map.byId.get(aId);
          const b = map.byId.get(bId);
          if (!a || !b) return null;
          const bothRevealed = revealed.has(aId) && revealed.has(bId);
          return (
            <line
              key={`${aId}-${bId}`}
              x1={mx(a.lane)}
              y1={my(a.depth, maxDepth)}
              x2={mx(b.lane)}
              y2={my(b.depth, maxDepth)}
              stroke={bothRevealed ? "#475569" : "#1e293b"}
              strokeWidth={bothRevealed ? 0.7 : 0.5}
              opacity={bothRevealed ? 0.9 : 0.55}
            />
          );
        })}

        {/* ノード */}
        {map.nodes.map((node) => {
          const x = mx(node.lane);
          const y = my(node.depth, maxDepth);
          if (!revealed.has(node.id)) {
            return (
              <g key={node.id}>
                <circle cx={x} cy={y} r={3} fill="#11151d" stroke="#334155" strokeWidth={0.6} />
                <text x={x} y={y + 1.6} textAnchor="middle" fontSize={4.5} fill="#64748b">
                  ?
                </text>
              </g>
            );
          }
          if (node.kind === "boss_gate" || (node.kind === "monster" && bossIds.has(node.id))) {
            // ボス門・ボスは金色の菱形
            return (
              <g key={node.id}>
                <title>{node.kind === "boss_gate" ? "ボス門" : "ボス"} ({node.depth}m)</title>
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={6}
                  height={6}
                  transform={`rotate(45 ${x} ${y})`}
                  fill={node.kind === "boss_gate" ? "none" : "#fbbf24"}
                  stroke="#fbbf24"
                  strokeWidth={0.8}
                />
              </g>
            );
          }
          const fill =
            node.kind === "entrance"
              ? "#38bdf8"
              : node.kind === "gather"
                ? "#34d399"
                : "#f87171";
          return (
            <g key={node.id}>
              <title>
                {node.kind === "entrance"
                  ? "入口"
                  : node.kind === "gather"
                    ? `採取: ${node.itemId}`
                    : `魔物: ${node.monsterId}`}{" "}
                ({node.depth}m)
              </title>
              <circle cx={x} cy={y} r={2.6} fill={fill} stroke="#0f172a" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* 村人ドット */}
        {villagers.map((v) => {
          const depth = v.dungeonState?.currentDepth ?? 0;
          const lane = v.dungeonState?.lane ?? 0;
          const isFighting = v.dungeonState?.phase === "fighting";
          return (
            <g key={v.id}>
              <title>
                {v.name} ({Math.round(depth)}m)
              </title>
              <circle
                cx={mx(lane)}
                cy={my(depth, maxDepth)}
                r={2.1}
                fill={isFighting ? "#f59e0b" : "#7dd3fc"}
                stroke="#ffffff"
                strokeWidth={0.6}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
        <span>入口 0m</span>
        <span className="text-sky-400/90">
          開拓前線 {exploredDepth}m / {maxDepth}m • 解放 {revealed.size}/{map.nodes.length}
        </span>
        <span>最深部 {maxDepth}m</span>
      </div>
    </div>
  );
};
