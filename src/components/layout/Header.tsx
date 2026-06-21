import { Play, Pause, RefreshCw, AlertTriangle, X, Sparkles, Terminal } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import { SOUL_UPGRADES } from "../../data/masterData";
import {
  useGameTime,
  usePlayerResources,
  useGameStatus,
  useGameControls,
  useVillagers,
  useInventory,
  useDungeons,
  useSoulUpgrades,
  useLogs,
} from "../../hooks";
import { GameLog } from "../../types/game";
import { SoulShop } from "../modals/SoulShop";

export const Header: React.FC = () => {
  const { currentDay, currentHour } = useGameTime();
  const { gold, soulPoints } = usePlayerResources();
  const inventory = useInventory().inventory;
  const { isPaused, playSpeed, gameOver, gameLimitDays } = useGameStatus();
  const { currentTier, bossDefeated } = useDungeons();
  const villagers = useVillagers();
  const soulUpgrades = useSoulUpgrades();
  const { togglePause, setPlaySpeed, advanceDay } = useGameControls();

  const [showSoulShopModal, setShowSoulShopModal] = useState(false);

  const logs = useLogs();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [filter, setFilter] = useState<GameLog["type"] | "all">("all");

  // 可動式ウィンドウ用の位置・ドラッグ制御
  const [windowPos, setWindowPos] = useState({ x: 100, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (showHistoryModal) {
      const initialX = Math.max(20, window.innerWidth / 2 - 288);
      const initialY = 120;
      setWindowPos({ x: initialX, y: initialY });
    }
  }, [showHistoryModal]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setWindowPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    };
  };

  const getLogColorClass = (type: GameLog["type"]) => {
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

  const filteredHistoryLogs = filter === "all" ? logs : logs.filter((log) => log.type === filter);

  const dailyFoodConsumption = villagers.length;
  const foodAmount = inventory.food || 0;
  const foodDaysLeft = dailyFoodConsumption > 0 ? Math.floor(foodAmount / dailyFoodConsumption) : 0;

  return (
    <>
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* タイトルと時間 */}
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-extrabold bg-linear-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent tracking-wider">
              FAST SLOW LIFE
            </h1>
            <p className="text-xs text-slate-400 font-mono">Web Edition</p>
          </div>

          <div className="bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-800/80 flex items-center gap-3">
            <span className="text-slate-400 font-medium text-sm">時間:</span>
            <span className="text-sky-400 font-mono font-bold text-lg">
              {currentDay}日目 {String(currentHour).padStart(2, "0")}:00
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Tier {currentTier}
            </span>
          </div>
        </div>

        {/* リソース情報 */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              ゴールド
            </span>
            <span className="text-amber-400 font-mono font-bold text-lg">
              {gold.toLocaleString()} G
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              食料在庫
            </span>
            <span
              className={`font-mono font-bold text-lg ${foodAmount < 10 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}
            >
              {Math.floor(foodAmount)}
              <span className="text-[10px] text-slate-400 font-normal ml-1">
                (-{dailyFoodConsumption}/日, あと{foodDaysLeft}日分)
              </span>
            </span>
            {foodAmount === 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3 h-3" /> 飢餓
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              ソウル (SP)
            </span>
            <span className="text-purple-400 font-mono font-bold text-lg">{soulPoints} SP</span>
          </div>
        </div>

        {/* アクティブバフ (SoulUpgrades) */}
        {Object.values(soulUpgrades).some((lvl) => lvl > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
            {SOUL_UPGRADES.filter((u) => (soulUpgrades[u.id] || 0) > 0).map((u) => {
              const lvl = soulUpgrades[u.id] || 0;
              return (
                <span
                  key={u.id}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300 font-medium"
                  title={`${u.name} Lv.${lvl}: ${u.description}`}
                >
                  {u.name} Lv.{lvl}
                </span>
              );
            })}
          </div>
        )}

        {/* コントロール */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 再生/一時停止 */}
          <button
            onClick={togglePause}
            disabled={gameOver}
            className={`p-2 rounded-lg transition duration-200 border ${
              isPaused
                ? "bg-sky-950 border-sky-800 text-sky-400 hover:bg-sky-900"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title={isPaused ? "再開" : "一時停止"}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          {/* 1日スキップ (+24h) */}
          <button
            onClick={advanceDay}
            disabled={!isPaused || gameOver}
            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 disabled:border-transparent text-xs font-mono font-bold text-slate-300 hover:text-white transition"
            title="1日スキップ（一時停止中のみ）"
          >
            +24h
          </button>

          {/* スピード */}
          <div className="bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 flex gap-1">
            {(["normal", "fast", "super"] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-3 py-1 rounded text-xs font-mono transition duration-200 ${
                  playSpeed === speed
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    : "text-slate-400 border border-transparent hover:text-slate-200"
                }`}
              >
                {speed === "normal" ? "1x" : speed === "fast" ? "3x" : "10x"}
              </button>
            ))}
          </div>

          {/* ログ履歴 */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs px-3.5 py-2 rounded-lg transition duration-200 border border-slate-700 hover:border-slate-650 cursor-pointer"
            title="過去のログ履歴を表示"
          >
            <Terminal className="w-4 h-4 text-sky-400" />
            ログ履歴
          </button>

          {/* 転生 */}
          <button
            onClick={() => setShowSoulShopModal(true)}
            className="flex items-center gap-2 bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition duration-200 border border-purple-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            転生
          </button>
        </div>

        {/* 制限期限のアラート */}
        <div className="w-full text-center mt-2 md:mt-0 md:w-auto">
          <span className="text-xs text-slate-400">
            次の期限: <strong className="text-red-400">{gameLimitDays}日目</strong> までにボスを討伐
            {bossDefeated && (
              <span className="text-emerald-400 font-bold ml-2">(ボス討伐完了！現在猶予中)</span>
            )}
          </span>
        </div>
      </header>

      {/* 転生バフショップ モーダル */}
      {showSoulShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 relative">
            <button
              onClick={() => setShowSoulShopModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <SoulShop onClose={() => setShowSoulShopModal(false)} />
          </div>
        </div>
      )}

      {/* ログ履歴可動式ウィンドウ */}
      {showHistoryModal && (
        <div
          style={{
            left: `${windowPos.x}px`,
            top: `${windowPos.y}px`,
          }}
          className="fixed z-50 bg-slate-900 border border-slate-800 rounded-xl w-[90vw] md:w-[576px] p-5 space-y-4 flex flex-col max-h-[75vh] shadow-2xl select-none"
        >
          {/* ドラッグ可能なヘッダー */}
          <div
            onMouseDown={handleHeaderMouseDown}
            className="flex justify-between items-center border-b border-slate-800 pb-3 cursor-move active:cursor-grabbing"
          >
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider pointer-events-none select-none">
              <Terminal className="w-4 h-4 text-sky-400" />
              過去のログ履歴 (ドラッグ移動可能)
            </h3>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* カテゴリフィルター */}
          <div className="flex flex-wrap gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 self-start">
            {(["all", "combat", "gather", "craft", "upgrade", "system"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                  filter === type
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    : "text-slate-400 border border-transparent hover:text-slate-200"
                }`}
              >
                {type === "all"
                  ? "すべて"
                  : type === "combat"
                    ? "戦闘"
                    : type === "gather"
                      ? "採取"
                      : type === "craft"
                        ? "加工"
                        : type === "upgrade"
                          ? "施設"
                          : "システム"}
              </button>
            ))}
          </div>

          {/* スクロール可能な履歴 */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed min-h-[300px] max-h-[45vh] select-text">
            {filteredHistoryLogs.length === 0 ? (
              <p className="text-slate-500 text-center py-10 italic">該当するログはありません</p>
            ) : (
              filteredHistoryLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 hover:bg-slate-950/40 py-0.5 rounded px-1"
                >
                  <span className="text-slate-500 font-bold shrink-0">{log.timestamp}</span>
                  <span className={`wrap-break-word ${getLogColorClass(log.type)}`}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition font-semibold cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
};
