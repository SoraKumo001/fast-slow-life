import {
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Terminal,
  BarChart3,
  HelpCircle,
  Settings,
} from "lucide-react";
import React, { useState } from "react";

import { SOUL_UPGRADES } from "../../data/masterData";
import {
  useBankruptcyWarning,
  useGameTime,
  usePlayerResources,
  useGameStatus,
  useGameControls,
  useDungeons,
  useSoulUpgrades,
} from "../../hooks";
import { SoulShop } from "../modals/SoulShop";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface HeaderProps {
  onOpenHelp?: () => void;
  onOpenLogHistory?: () => void;
  onOpenResult?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHelp,
  onOpenLogHistory,
  onOpenResult,
  onOpenSettings,
}) => {
  const { currentDay, currentHour } = useGameTime();
  const { gold, soulPoints } = usePlayerResources();
  const { isPaused, playSpeed, gameOver, gameLimitDays } = useGameStatus();
  const { currentTier, bossDefeated } = useDungeons();
  const soulUpgrades = useSoulUpgrades();
  const { togglePause, setPlaySpeed, advanceDay } = useGameControls();
  const { consecutiveNegativeGoldDays } = useBankruptcyWarning();

  const [showSoulShopModal, setShowSoulShopModal] = useState(false);

  return (
    <>
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 shrink-0">
        {/* Tier 1: アイデンティティ (ロゴ + 時間 + Tier + Soul バッジ) */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60">
          <div className="flex items-center gap-6 flex-wrap">
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
              <Badge variant="default" className="text-xs px-2 py-0.5">
                Tier {currentTier}
              </Badge>
            </div>

            {Object.values(soulUpgrades).some((lvl) => lvl > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                {SOUL_UPGRADES.filter((u) => (soulUpgrades[u.id] || 0) > 0).map((u) => {
                  const lvl = soulUpgrades[u.id] || 0;
                  return (
                    <Badge
                      key={u.id}
                      variant="purple"
                      className="text-[9px] px-1.5 py-0.5"
                      title={`${u.name} Lv.${lvl}: ${u.description}`}
                    >
                      {u.name} Lv.{lvl}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400">
            次の期限: <strong className="text-red-400">{gameLimitDays}日目</strong> までにボスを討伐
            {bossDefeated && (
              <span className="text-emerald-400 font-bold ml-2">(ボス討伐完了！現在猶予中)</span>
            )}
          </div>
        </div>

        {/* Tier 2: ステータス + 操作 (Gold/SP + コントロールボタン群) */}
        <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                ゴールド
              </span>
              <span className="text-amber-400 font-mono font-bold text-lg">
                {Math.floor(gold).toLocaleString()} G
              </span>
              {gold < 0 && (
                <span className="text-red-400 font-bold font-mono text-xs">
                  (破産まであと{3 - consecutiveNegativeGoldDays}日)
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

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={togglePause}
              disabled={gameOver}
              variant="custom"
              size="custom"
              className={`p-2 rounded-lg transition duration-200 border ${
                isPaused
                  ? "bg-sky-950 border-sky-800 text-sky-400 hover:bg-sky-900"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
              title={isPaused ? "再開 (Space)" : "一時停止 (Space)"}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>

            <Button
              onClick={advanceDay}
              disabled={!isPaused || gameOver}
              variant="secondary"
              size="custom"
              className="px-2.5 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-white"
              title="1日スキップ（一時停止中のみ・D キー）"
              aria-label="1日スキップ"
            >
              +24h
            </Button>

            <div className="bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 flex gap-1">
              {(["normal", "fast", "super"] as const).map((speed) => (
                <Button
                  key={speed}
                  onClick={() => setPlaySpeed(speed)}
                  variant="custom"
                  size="custom"
                  className={`px-3 py-1 rounded text-xs font-mono transition duration-200 ${
                    playSpeed === speed
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      : "text-slate-400 border border-transparent hover:text-slate-200"
                  }`}
                  aria-label={
                    speed === "normal"
                      ? "通常速度 (1 キー)"
                      : speed === "fast"
                        ? "3倍速 (2 キー)"
                        : "10倍速 (3 キー)"
                  }
                >
                  {speed === "normal" ? "1x" : speed === "fast" ? "3x" : "10x"}
                </Button>
              ))}
            </div>

            {onOpenLogHistory && (
              <Button
                onClick={onOpenLogHistory}
                variant="secondary"
                size="custom"
                className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg hover:border-slate-600"
                title="ログ履歴 (L キー)"
              >
                <Terminal className="w-4 h-4 text-sky-400" />
                ログ履歴
              </Button>
            )}

            <Button
              onClick={onOpenResult}
              variant="secondary"
              size="custom"
              className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg hover:border-slate-600"
              title="リザルト (R キー)"
            >
              <BarChart3 className="w-4 h-4 text-sky-400" />
              リザルト
            </Button>

            {onOpenHelp && (
              <Button
                onClick={onOpenHelp}
                variant="secondary"
                size="custom"
                aria-label="遊び方ヘルプ"
                className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg hover:border-slate-600"
                title="遊び方 (?)"
              >
                <HelpCircle className="w-4 h-4 text-sky-400" />
                ヘルプ
              </Button>
            )}

            {onOpenSettings && (
              <Button
                onClick={onOpenSettings}
                variant="secondary"
                size="custom"
                aria-label="設定"
                className="p-2 rounded-lg hover:border-slate-600"
                title="設定"
              >
                <Settings className="w-4 h-4 text-sky-400" />
              </Button>
            )}

            <Button
              onClick={() => setShowSoulShopModal(true)}
              variant="custom"
              size="custom"
              className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg border border-purple-500/20 bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold"
              title="転生ショップ"
            >
              <RefreshCw className="w-4 h-4" />
              転生
            </Button>
          </div>
        </div>
      </header>

      <Modal
        isOpen={showSoulShopModal}
        onClose={() => setShowSoulShopModal(false)}
        size="lg"
        showCloseButton
      >
        <SoulShop onClose={() => setShowSoulShopModal(false)} />
      </Modal>
    </>
  );
};
