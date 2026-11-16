import React, { useRef } from "react";

import {
  BOSS_GATE_NODE_ID,
  buildDungeonMap,
  cellKey,
  countContentRevealed,
  initialRevealedNodes,
  interpolateGridPosition,
} from "../../store/dungeonMap";
import { getExploredDepth } from "../../store/dungeonSpatialHelper";
import type { DungeonArea, Villager } from "../../types/game";

interface DungeonDepthMinimapProps {
  area: DungeonArea;
  villagers: Villager[];
  onSelectDepth: (depth: number) => void;
  /** Phase 4a: 解放済みノードID（未指定時は探索度から初期値を導出） */
  revealedNodeIds?: string[];
}

const CELL = 10;

/** セル種別ごとの塗り色（解放済み） */
const KIND_FILL: Record<string, string> = {
  entrance: "#38bdf8",
  gather: "#34d399",
  monster: "#f87171",
  boss_gate: "#fbbf24",
  passage: "#3f5468",
};

/** セル種別ごとの記号（解放済みコンテンツのみ） */
const KIND_GLYPH: Record<string, string> = {
  entrance: "入",
  gather: "採",
  monster: "魔",
  boss_gate: "門",
};

/**
 * Phase 7: ダンジョン迷路の SVG グリッドマップ。
 * セルを正方形で描き、解放済みは種別の色・記号、未解放は暗色にする。
 * 掘られた辺はセル間の接続として描く（片側だけ解放済みの場合は半分だけ）。
 * 入口が下、ボス門のある最深部が上になる向きで表示する。
 * クリックしたセルの経路距離を onSelectDepth で返す。
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
  const content = countContentRevealed(map, revealed);

  const viewW = map.cols * CELL;
  const viewH = map.rows * CELL;
  // グリッド座標 → SVG 座標（入口行が下になるよう gy を反転）
  const sx = (gx: number) => gx * CELL;
  const sy = (gy: number) => (map.rows - 1 - gy) * CELL;
  const cx = (gx: number) => (gx + 0.5) * CELL;
  const cy = (gy: number) => (map.rows - 0.5 - gy) * CELL;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    // preserveAspectRatio="xMidYMid meet" のレターボックスを考慮して換算
    const scale = Math.min(rect.width / viewW, rect.height / viewH);
    const offsetX = (rect.width - viewW * scale) / 2;
    const offsetY = (rect.height - viewH * scale) / 2;
    const px = (e.clientX - rect.left - offsetX) / scale;
    const py = (e.clientY - rect.top - offsetY) / scale;
    const gx = Math.floor(px / CELL);
    const gy = map.rows - 1 - Math.floor(py / CELL);
    if (gx < 0 || gx >= map.cols || gy < 0 || gy >= map.rows) return;
    const node = map.byCell.get(cellKey(gx, gy));
    if (node) onSelectDepth(node.depth);
  };

  return (
    <div className="space-y-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        onClick={handleClick}
        className="h-60 w-auto max-w-full mx-auto block rounded bg-slate-950 border border-slate-800 cursor-pointer"
        role="img"
        aria-label={`${area.name} 迷路マップ`}
      >
        {/* 通路の接続（セル間の掘られた辺） */}
        {map.edges.map(([aId, bId]) => {
          const a = map.byId.get(aId);
          const b = map.byId.get(bId);
          if (!a || !b) return null;
          const ra = revealed.has(aId);
          const rb = revealed.has(bId);
          if (!ra && !rb) return null;
          // 両端解放なら全長、片側だけなら解放側から中点まで
          const x1 = cx(a.gx);
          const y1 = cy(a.gy);
          const x2 = cx(b.gx);
          const y2 = cy(b.gy);
          const [fx, fy, tx, ty] =
            ra && rb
              ? [x1, y1, x2, y2]
              : ra
                ? [x1, y1, (x1 + x2) / 2, (y1 + y2) / 2]
                : [x2, y2, (x1 + x2) / 2, (y1 + y2) / 2];
          return (
            <line
              key={`${aId}-${bId}`}
              x1={fx}
              y1={fy}
              x2={tx}
              y2={ty}
              stroke={ra && rb ? "#5b7a94" : "#2c3e50"}
              strokeWidth={3.4}
            />
          );
        })}

        {/* セル */}
        {map.nodes.map((node) => {
          const x = sx(node.gx);
          const y = sy(node.gy);
          if (!revealed.has(node.id)) {
            return (
              <rect
                key={node.id}
                x={x + 0.5}
                y={y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill="#0b0e14"
                stroke="#1c2330"
                strokeWidth={0.4}
              />
            );
          }
          const isBossMonster = node.kind === "monster" && bossIds.has(node.id);
          const fill = isBossMonster ? "#f59e0b" : KIND_FILL[node.kind];
          const glyph = isBossMonster ? "ボ" : KIND_GLYPH[node.kind];
          return (
            <g key={node.id}>
              <title>
                {node.kind === "entrance"
                  ? "入口"
                  : node.kind === "gather"
                    ? `採取: ${node.itemId}`
                    : node.kind === "monster"
                      ? `魔物: ${node.monsterId}`
                      : node.kind === "boss_gate"
                        ? "ボス門"
                        : "通路"}{" "}
                ({node.depth}m)
              </title>
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={CELL - 1}
                height={CELL - 1}
                fill={fill}
                stroke="#0f172a"
                strokeWidth={0.4}
              />
              {glyph && (
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 1.9}
                  textAnchor="middle"
                  fontSize={5.2}
                  fontWeight="bold"
                  fill="#0f172a"
                >
                  {glyph}
                </text>
              )}
            </g>
          );
        })}

        {/* 村人ドット（経路補間後の二次元位置） */}
        {villagers.map((v) => {
          const ds = v.dungeonState;
          const depth =
            v.status === "traveling_to"
              ? 0
              : v.status === "traveling_back"
                ? (ds?.currentDepth ?? 0) * 0.3
                : (ds?.currentDepth ?? 0);
          const targetId = ds?.targetNodeId ?? (depth > 0 ? BOSS_GATE_NODE_ID : null);
          const pos = interpolateGridPosition(map, targetId, depth);
          const isFighting = ds?.phase === "fighting";
          return (
            <g key={v.id}>
              <title>
                {v.name} ({Math.round(ds?.currentDepth ?? 0)}m)
              </title>
              <circle
                cx={cx(pos.gx)}
                cy={cy(pos.gy)}
                r={1.9}
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
          開拓前線 {exploredDepth}m / {maxDepth}m • 解放 {content.revealed}/{content.total}
        </span>
        <span>最深部 {maxDepth}m</span>
      </div>
    </div>
  );
};
