import { Compass, ShieldAlert, Users, Sword, ChevronDown, ChevronUp, Coins } from "lucide-react";
import React, { useState } from "react";

import { ITEMS } from "../../data/masterData";
import { useBossActions, useDungeons, useVillagers } from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { useGameStore } from "../../store/gameStore";
import { calculateOfferingCost } from "../../store/threatLogic";
import { DungeonArea } from "../../types/game";
import { getPartyColor, getPartyLabel } from "../../utils/partyHelpers";
import { BossBattleModal } from "../modals/BossBattleModal";
import { Panel } from "../ui/Panel";
import { ProgressBar } from "../ui/ProgressBar";
import { DungeonResourceItem } from "./DungeonResourceItem";
import { ThreatGauge } from "./ThreatGauge";

export const DungeonPanel: React.FC = () => {
  const { dungeons, currentTier, bossDefeated } = useDungeons();
  const villagers = useVillagers();
  const activeBoss = useGameStore((s) => s.activeBoss);
  const playerGold = useGameStore((s) => s.gold);
  const { offerToDungeon } = useBossActions();
  const [selectedArea, setSelectedArea] = useState<DungeonArea | null>(null);
  const [showBossModal, setShowBossModal] = useState(false);
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

                {/* 探索度プログレスバー */}
                {isUnlocked && (
                  <div className="mt-2 mb-1">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400 font-medium">探索度</span>
                      <span className="text-sky-400 font-bold font-mono">
                        {Math.floor(area.explorationProgress)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={area.explorationProgress}
                      height={1.5}
                      color="sky"
                      className="border border-slate-900"
                    />
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
                              area.threatLevel < 1 || playerGold < calculateOfferingCost(30)
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-bold text-white rounded border border-yellow-600 disabled:border-slate-700 transition disabled:cursor-not-allowed"
                          >
                            <span>30% 軽減</span>
                            <span className="font-mono opacity-90">
                              ({calculateOfferingCost(30).toLocaleString()} G)
                            </span>
                          </button>
                          <button
                            onClick={() => handleOffer(area, 50)}
                            disabled={
                              area.threatLevel < 1 || playerGold < calculateOfferingCost(50)
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-bold text-white rounded border border-yellow-600 disabled:border-slate-700 transition disabled:cursor-not-allowed"
                          >
                            <span>50% 軽減</span>
                            <span className="font-mono opacity-90">
                              ({calculateOfferingCost(50).toLocaleString()} G)
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

                    {/* 現在派遣中の村人 */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-900/40 p-2 rounded border border-slate-900">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mr-1 flex items-center gap-1">
                        <Users className="w-3 h-3 text-sky-400" />
                        派遣中:
                      </span>
                      {activeInArea.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic">なし</span>
                      ) : (
                        (() => {
                          // AUTO-PARTY: 討伐隊を autoTargetName でグルーピング
                          const hunters = activeInArea.filter((v) => v.order === "hunt");
                          const gatherers = activeInArea.filter((v) => v.order !== "hunt");

                          const parties = new Map<string, typeof hunters>();
                          for (const v of hunters) {
                            const key = v.autoTargetName || `__solo_${v.id}`;
                            const list = parties.get(key) || [];
                            list.push(v);
                            parties.set(key, list);
                          }

                          // 全パーティキーを抽出（ラベル安定ソート用）
                          const allPartyKeys = Array.from(
                            new Set(
                              hunters
                                .map((v) => v.autoTargetName)
                                .filter((k): k is string => Boolean(k)),
                            ),
                          ).sort();

                          return (
                            <>
                              {Array.from(parties.entries()).map(([target, members]) =>
                                target.startsWith("__solo_")
                                  ? // ターゲット未設定の単独ハンター
                                    members.map((v) => (
                                      <span
                                        key={v.id}
                                        className="text-[10px] px-2 py-0.5 rounded font-medium border bg-red-950/40 border-red-800 text-red-300"
                                        title="待機中"
                                      >
                                        {v.name} (討)
                                      </span>
                                    ))
                                  : // パーティ表示 (色分け適用)
                                    (() => {
                                      const color = getPartyColor(target);
                                      const label = getPartyLabel(target, allPartyKeys);
                                      return (
                                        <div key={target} className="flex items-center gap-1">
                                          <Sword
                                            className={`w-3 h-3 shrink-0 ${color?.text ?? "text-red-400"}`}
                                          />
                                          <span className="text-[9px] text-slate-500">
                                            PT-{label} {target}:
                                          </span>
                                          {members.map((v) => (
                                            <span
                                              key={v.id}
                                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                                v.currentHp > 0
                                                  ? color
                                                    ? `${color.bg} ${color.border} ${color.text}`
                                                    : "bg-red-950/40 border-red-800 text-red-300"
                                                  : "bg-slate-900 border-slate-700 text-slate-500 line-through"
                                              }`}
                                              title={`Lv.${v.level} HP:${v.currentHp}/${v.maxHp} (${v.currentJob})`}
                                            >
                                              {v.name}
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    })(),
                              )}
                              {gatherers.map((v) => (
                                <span
                                  key={v.id}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                                    v.status === "active"
                                      ? "bg-sky-950/40 border-sky-800 text-sky-400"
                                      : "bg-amber-950/20 border-amber-900 text-amber-400"
                                  }`}
                                  title={`現在方針: 採取`}
                                >
                                  {v.name} (採)
                                </span>
                              ))}
                            </>
                          );
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
    </Panel>
  );
};
