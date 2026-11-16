import {
  Compass,
  ShieldAlert,
  Users,
  Sword,
  ChevronDown,
  ChevronUp,
  Coins,
  Maximize2,
  Eye,
  Undo2,
  UserPlus,
} from "lucide-react";
import React, { useState } from "react";

import { ITEMS } from "../../data/masterData";
import { useBossActions, useDungeons, useVillagerActions, useVillagers } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { carryCapacity, carriedCount } from "../../store/carryCapacity";
import { buildDungeonMap, countContentRevealed } from "../../store/dungeonMap";
import { getVillagerPhaseLabel } from "../../store/dungeonSpatialHelper";
import { useGameStore } from "../../store/gameStore";
import { calculateOfferingCost } from "../../store/threatLogic";
import { DungeonArea } from "../../types/game";
import { getPartyColor, getPartyLabel } from "../../utils/partyHelpers";
import { BossBattleModal } from "../modals/BossBattleModal";
import { DungeonAssignModal } from "../modals/DungeonAssignModal";
import { DungeonFullViewModal } from "../modals/DungeonFullViewModal";
import { DungeonDepthMinimap } from "../three/DungeonDepthMinimap";
import { DungeonThreeViewport } from "../three/DungeonThreeViewport";
import { Panel } from "../ui/Panel";
import { ProgressBar } from "../ui/ProgressBar";
import { DungeonResourceItem } from "./DungeonResourceItem";
import { ThreatGauge } from "./ThreatGauge";

export const DungeonPanel: React.FC = () => {
  const { dungeons, currentTier, bossDefeated, revealedNodes } = useDungeons();
  const villagers = useVillagers();
  const { recallVillager } = useVillagerActions();
  const [assignArea, setAssignArea] = useState<DungeonArea | null>(null);
  const activeBoss = useGameStore((s) => s.activeBoss);
  const dungeonEvents = useGameStore((s) => s.dungeonEvents);
  const playerGold = useGameStore((s) => s.gold);
  const { offerToDungeon } = useBossActions();
  const [selectedArea, setSelectedArea] = useState<DungeonArea | null>(null);
  const [showBossModal, setShowBossModal] = useState(false);
  const [viewAreaId, setViewAreaId] = useState<string>("forest");
  const [cameraMode, setCameraMode] = useState<"auto" | "free">("auto");
  const [focusDepth, setFocusDepth] = useState<number | null>(null);
  const [showFullView, setShowFullView] = useState(false);
  const setSelectedItem = useGameStore((s) => s.setSelectedItem);
  const { isExpanded: isAreaExpanded, toggleExpand: toggleAreaExpand } = useExpandedState();

  const getActiveVillagersInArea = (areaId: string) => {
    return villagers.filter((v) => v.destinationAreaId === areaId);
  };

  const handleOpenBossBattle = (area: DungeonArea) => {
    setSelectedArea(area);
    setShowBossModal(true);
  };

  const handleOffer = (area: DungeonArea, percent: number) => {
    const err = offerToDungeon(area.id, percent);
    if (err) console.warn("[お布施]", err);
  };

  // P2-2: 解放済みエリア集計
  const unlockedAreas = dungeons.filter((area) => area.unlockedAtTier <= currentTier);
  const maxRecommendedLevel =
    unlockedAreas.length > 0 ? Math.max(...unlockedAreas.map((a) => a.recommendedLevel)) : 0;
  const avgExploration =
    unlockedAreas.length > 0
      ? Math.round(
          unlockedAreas.reduce((sum, a) => sum + a.explorationProgress, 0) / unlockedAreas.length,
        )
      : 0;
  const tierNames = ["", "始まりの森", "廃鉱山", "魔獣の谷", "世界樹の根", "深淵の奈落"];

  const activeViewArea =
    unlockedAreas.find((a) => a.id === viewAreaId) || unlockedAreas[unlockedAreas.length - 1];
  const activeViewVillagers = activeViewArea ? getActiveVillagersInArea(activeViewArea.id) : [];

  return (
    <Panel
      title="ダンジョン・探索派遣"
      icon={<Compass className="w-5 h-5 text-sky-400" />}
      actions={
        <div className="flex items-center gap-3 text-[10px] font-normal">
          <span className="text-slate-500">
            Tier{" "}
            <span className="text-indigo-400 font-bold">
              {tierNames[currentTier] || currentTier}
            </span>
          </span>
          <span className="text-slate-500">
            推奨Lv <span className="text-amber-400 font-bold">{maxRecommendedLevel}</span>
          </span>
          <span className="text-slate-500">
            全体 <span className="text-sky-400 font-bold">{avgExploration}%</span>
          </span>
        </div>
      }
    >
      {/* 常設 3D ダンジョンビューポート */}
      {activeViewArea && (
        <div className="mb-3 space-y-2 shrink-0">
          {/* エリア切替タブ & カメラ操作 */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {unlockedAreas.map((area) => {
                const count = getActiveVillagersInArea(area.id).length;
                const isSelected = area.id === activeViewArea.id;
                return (
                  <button
                    key={area.id}
                    onClick={() => {
                      setViewAreaId(area.id);
                      setFocusDepth(null);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap transition flex items-center gap-1 border ${
                      isSelected
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                        : "bg-slate-900/70 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span>{area.name}</span>
                    {count > 0 && (
                      <span className="px-1 rounded-full bg-sky-500/30 text-sky-200 text-[9px] font-mono">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCameraMode(cameraMode === "auto" ? "free" : "auto")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition ${
                  cameraMode === "auto"
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/60"
                    : "bg-amber-950/60 text-amber-300 border-amber-700/60"
                }`}
                title="カメラモード切替"
              >
                <Eye className="w-3 h-3" />
                {cameraMode === "auto" ? "追尾" : "自由"}
              </button>
              <button
                onClick={() => setShowFullView(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
                title="3Dビューを拡大表示"
              >
                <Maximize2 className="w-3 h-3" />
                拡大
              </button>
            </div>
          </div>

          <DungeonThreeViewport
            area={activeViewArea}
            villagers={activeViewVillagers}
            activeBoss={activeBoss}
            dungeonEvents={dungeonEvents}
            cameraMode={cameraMode}
            focusDepth={focusDepth}
            heightClass="h-52"
            revealedNodeIds={revealedNodes[activeViewArea.id]}
          />

          <DungeonDepthMinimap
            area={activeViewArea}
            villagers={activeViewVillagers}
            revealedNodeIds={revealedNodes[activeViewArea.id]}
            onSelectDepth={(depth) => {
              setCameraMode("free");
              setFocusDepth(depth);
            }}
          />
        </div>
      )}

      {/* アクティブなボス戦は ActiveBossBar (上部固定) で表示 (P2-3) */}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {dungeons
          .filter((area) => area.unlockedAtTier <= currentTier)
          .sort((a, b) => b.recommendedLevel - a.recommendedLevel)
          .map((area) => {
            const isUnlocked = true;
            const activeInArea = getActiveVillagersInArea(area.id);
            const boss = area.monsters.find((m) => m.isBoss);
            const isBossAvailable = area.explorationProgress >= 100;
            const isBossDefeatedInThisArea =
              currentTier > area.unlockedAtTier ||
              (currentTier === area.unlockedAtTier && bossDefeated);

            return (
              <div
                key={area.id}
                onClick={() => isUnlocked && toggleAreaExpand(area.id)}
                className={`border rounded-xl p-4 transition-all duration-200 ${
                  isUnlocked
                    ? "bg-slate-950/70 border-slate-800 hover:border-slate-700/80 cursor-pointer"
                    : "bg-slate-950/10 border-dashed border-slate-900 opacity-50"
                }`}
              >
                {/* ダンジョン基本情報 */}
                <div className="flex justify-between items-start mb-2 select-none">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                      {area.name}
                      {!isUnlocked && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950 border border-red-900 text-red-400 font-bold uppercase">
                          未解放
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      推奨Lv.{area.recommendedLevel} • 片道 {area.distance}時間
                    </p>
                  </div>

                  {isUnlocked && (
                    <div className="flex items-center gap-2">
                      {isBossAvailable && !isBossDefeatedInThisArea && !activeBoss && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBossBattle(area);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-[10px] font-black text-white rounded-lg transition animate-pulse-slow shadow-lg shadow-amber-900/20"
                        >
                          <Sword className="w-3.5 h-3.5" />
                          ボスと対決
                        </button>
                      )}
                      <div className="text-slate-400 hover:text-slate-200 p-1 transition ml-1 shrink-0">
                        {isAreaExpanded(area.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 探索度プログレスバー (1行: ラベル + ゲージ) */}
                {isUnlocked && (
                  <div className="flex items-center gap-2 mt-2 mb-1">
                    <span className="text-[10px] font-bold font-mono text-sky-400 shrink-0">
                      探索度 {Math.floor(area.explorationProgress)}%
                    </span>
                    <ProgressBar
                      value={area.explorationProgress}
                      height={1.5}
                      color="sky"
                      className="border border-slate-900 flex-1"
                    />
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {(() => {
                        const c = countContentRevealed(
                          buildDungeonMap(area),
                          revealedNodes[area.id] ?? [],
                        );
                        return `解放 ${c.revealed}/${c.total}`;
                      })()}
                    </span>
                  </div>
                )}

                {/* 脅威度ゲージ (攻略済みエリアは非表示) */}
                {isUnlocked && !isBossDefeatedInThisArea && (
                  <div className="mb-3">
                    <ThreatGauge threatLevel={area.threatLevel} />
                  </div>
                )}

                {isUnlocked && isAreaExpanded(area.id) && (
                  <div className="space-y-2.5 mt-2 border-t border-slate-900 pt-3">
                    {/* Phase 4a: パーティ派遣 */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">
                        パーティ派遣（最大4人・同一ターゲット）
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignArea(area);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-sky-600 hover:bg-sky-500 text-white transition"
                      >
                        <UserPlus className="w-3 h-3" />
                        パーティ派遣
                      </button>
                    </div>

                    {/* お布施セクション: 拡張表示の中でのみ表示 */}
                    {area.threatLevel > 0 && (
                      <div className="bg-yellow-950/20 border border-yellow-900/40 rounded p-2.5 space-y-2">
                        <p className="text-[10px] font-bold text-yellow-400 flex items-center gap-1.5">
                          <Coins className="w-3 h-3" />
                          お布施で脅威度を下げる
                          <span className="text-slate-500 font-mono font-normal ml-auto">
                            所持金: {Math.floor(playerGold).toLocaleString()} G
                          </span>
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOffer(area, 30)}
                            disabled={
                              area.threatLevel < 1 ||
                              playerGold < calculateOfferingCost(30, currentTier)
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-bold text-white rounded border border-yellow-600 disabled:border-slate-700 transition disabled:cursor-not-allowed"
                          >
                            <span>30% 軽減</span>
                            <span className="font-mono opacity-90">
                              ({calculateOfferingCost(30, currentTier).toLocaleString()} G)
                            </span>
                          </button>
                          <button
                            onClick={() => handleOffer(area, 50)}
                            disabled={
                              area.threatLevel < 1 ||
                              playerGold < calculateOfferingCost(50, currentTier)
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-bold text-white rounded border border-yellow-600 disabled:border-slate-700 transition disabled:cursor-not-allowed"
                          >
                            <span>50% 軽減</span>
                            <span className="font-mono opacity-90">
                              ({calculateOfferingCost(50, currentTier).toLocaleString()} G)
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 採取可能アイテム & 出現モンスター */}
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="font-bold text-slate-400 block mb-1">採れる素材:</span>
                        <ul className="space-y-1 text-slate-300 font-mono">
                          {area.gathers.map((g) => {
                            const unlocked =
                              area.explorationProgress >= (g.unlockedAtProgress || 0);
                            const gItem = ITEMS[g.itemId];
                            const priceLabel = gItem ? `(${gItem.basePrice}G)` : "";
                            return (
                              <DungeonResourceItem
                                key={g.itemId}
                                keyId={g.itemId}
                                isUnlocked={unlocked}
                                unlockedAtProgress={g.unlockedAtProgress || 0}
                                name={`${gItem?.name || g.itemId} ${priceLabel}`}
                                progress={g.currentProgress || 0}
                                respawnTimeLeft={g.respawnTimeLeft}
                                respawnTimeTotal={g.respawnTimeTotal}
                                gaugeColor="emerald"
                                onClick={() => gItem && setSelectedItem(gItem)}
                              />
                            );
                          })}
                        </ul>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block mb-1">主な魔物:</span>
                        <ul className="space-y-1 text-slate-300 font-mono">
                          {area.monsters.map((m) => {
                            const unlocked =
                              area.explorationProgress >= (m.unlockedAtProgress || 0);
                            const name = `${m.name} ${m.isBoss ? "(ボス)" : `(Lv.${m.level})`}`;
                            const tooltip = unlocked
                              ? `${m.name} ${m.isBoss ? "(ボス)" : `(Lv.${m.level})`}\n入手アイテム: ${m.drops.map((d) => `${ITEMS[d.itemId]?.name || d.itemId} (${Math.round(d.chance * 100)}%)`).join(", ")}`
                              : undefined;
                            const dropsLabel =
                              unlocked && m.drops.length > 0 ? (
                                <span className="z-10 text-[9px] text-slate-500 truncate shrink-0 max-w-20 ml-1">
                                  [
                                  {m.drops
                                    .map(
                                      (d) =>
                                        `${ITEMS[d.itemId]?.name || d.itemId}(${Math.round(d.chance * 100)}%)`,
                                    )
                                    .join("/")}
                                  ]
                                </span>
                              ) : null;
                            return (
                              <DungeonResourceItem
                                key={m.id}
                                keyId={m.id}
                                isUnlocked={unlocked}
                                unlockedAtProgress={m.unlockedAtProgress || 0}
                                name={name}
                                progress={m.currentProgress || 0}
                                respawnTimeLeft={m.respawnTimeLeft}
                                respawnTimeTotal={m.respawnTimeTotal}
                                gaugeColor="sky"
                                showProgress={!m.isBoss}
                                className={
                                  m.isBoss
                                    ? "text-amber-400 font-bold bg-amber-500/5 border border-amber-500/10"
                                    : ""
                                }
                                extraContent={dropsLabel}
                                tooltip={tooltip}
                              />
                            );
                          })}
                        </ul>
                      </div>
                    </div>

                    {/* 現在派遣中の村人（Phase 4a: パーティ行表示） */}
                    <div className="mt-2 bg-slate-900/40 p-2 rounded border border-slate-900 space-y-1.5">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                        <Users className="w-3 h-3 text-sky-400" />
                        派遣中:
                      </span>
                      {activeInArea.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">なし</span>
                      ) : (
                        (() => {
                          // Phase 4a: (targetNodeId ?? autoTargetName ?? 単独) でグルーピング
                          type PartyGroup = {
                            key: string;
                            targetName: string | null;
                            order: string;
                            members: typeof activeInArea;
                          };
                          const groups = new Map<string, PartyGroup>();
                          for (const v of activeInArea) {
                            const nodeId = v.dungeonState?.targetNodeId ?? null;
                            const key = nodeId
                              ? `node:${nodeId}`
                              : v.autoTargetName
                                ? `name:${v.autoTargetName}`
                                : `solo:${v.id}`;
                            const targetName =
                              v.autoTargetName ??
                              (nodeId
                                ? (ITEMS[nodeId]?.name ??
                                  area.monsters.find((m) => m.id === nodeId)?.name ??
                                  null)
                                : null);
                            const group = groups.get(key) ?? {
                              key,
                              targetName,
                              order: v.order,
                              members: [],
                            };
                            group.members.push(v);
                            groups.set(key, group);
                          }
                          const groupList = [...groups.values()];
                          const allPartyKeys = groupList
                            .map((g) => g.targetName)
                            .filter((k): k is string => Boolean(k))
                            .sort();

                          const canRecall = (status: string) =>
                            status === "active" || status === "traveling_to";

                          return groupList.map((group) => {
                            const leader = group.members[0];
                            const combinedCarried = group.members.reduce(
                              (sum, m) => sum + carriedCount(m),
                              0,
                            );
                            const color =
                              group.order === "hunt" && group.targetName
                                ? getPartyColor(group.targetName)
                                : null;
                            const label =
                              group.order === "hunt" && group.targetName
                                ? getPartyLabel(group.targetName, allPartyKeys)
                                : null;
                            return (
                              <div
                                key={group.key}
                                className="flex flex-wrap items-center gap-1.5 bg-slate-950/50 rounded px-1.5 py-1 border border-slate-900"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] font-bold text-slate-300">
                                  {group.order === "hunt" ? "⚔" : "⛏"}{" "}
                                  {label ? `PT-${label} ` : ""}
                                  {group.targetName ?? "おまかせ"}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  リーダー: {leader.name} • {group.members.length}人 •
                                  所持合計 {combinedCarried}個
                                </span>
                                {group.members.some((m) => canRecall(m.status)) && (
                                  <button
                                    onClick={() =>
                                      group.members
                                        .filter((m) => canRecall(m.status))
                                        .forEach((m) => recallVillager(m.id))
                                    }
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 transition"
                                    title="パーティ全員を帰還させる"
                                  >
                                    <Undo2 className="w-2.5 h-2.5" />
                                    全員帰還
                                  </button>
                                )}
                                <div className="flex flex-wrap items-center gap-1 w-full">
                                  {group.members.map((v) => (
                                    <span
                                      key={v.id}
                                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                        v.currentHp <= 0
                                          ? "bg-slate-900 border-slate-700 text-slate-500 line-through"
                                          : group.order === "hunt"
                                            ? color
                                              ? `${color.bg} ${color.border} ${color.text}`
                                              : "bg-red-950/40 border-red-800 text-red-300"
                                            : "bg-sky-950/40 border-sky-800 text-sky-400"
                                      }`}
                                      title={`Lv.${v.level} HP:${v.currentHp}/${v.maxHp} (${v.currentJob}) • ${getVillagerPhaseLabel(v)} • 所持 ${carriedCount(v)}/${carryCapacity(v)}`}
                                    >
                                      {v.name}
                                      {v.dungeonState && v.status === "active" && (
                                        <span className="opacity-75 text-[9px] font-mono">
                                          {Math.round(v.dungeonState.currentDepth)}m
                                        </span>
                                      )}
                                      <span className="opacity-90 text-[9px] font-mono">
                                        所持{carriedCount(v)}/{carryCapacity(v)}
                                      </span>
                                      {canRecall(v.status) && (
                                        <button
                                          onClick={() => recallVillager(v.id)}
                                          className="ml-0.5 px-1 rounded bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-800/60 text-[9px] font-bold"
                                          title={`${v.name} を帰還させる`}
                                        >
                                          帰還
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>

                    {/* エリアボス撃破状況 */}
                    {boss && (
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-slate-400">エリアボス:</span>
                        {currentTier > area.unlockedAtTier ||
                        (currentTier === area.unlockedAtTier && bossDefeated) ? (
                          <span className="text-emerald-400 font-bold">撃破済</span>
                        ) : (
                          <span className="text-amber-500 font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> 未撃破
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* ボス討伐編成モーダル */}
      {showBossModal && selectedArea && (
        <BossBattleModal
          area={selectedArea}
          onClose={() => {
            setShowBossModal(false);
            setSelectedArea(null);
          }}
        />
      )}

      {/* 3Dダンジョン拡大モーダル */}
      {showFullView && activeViewArea && (
        <DungeonFullViewModal
          area={activeViewArea}
          villagers={activeViewVillagers}
          activeBoss={activeBoss}
          dungeonEvents={dungeonEvents}
          onClose={() => setShowFullView(false)}
        />
      )}

      {/* Phase 4a: パーティ派遣モーダル */}
      {assignArea && (
        <DungeonAssignModal area={assignArea} onClose={() => setAssignArea(null)} />
      )}
    </Panel>
  );
};
