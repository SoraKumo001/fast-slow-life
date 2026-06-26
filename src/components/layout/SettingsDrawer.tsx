import { Settings, X } from "lucide-react";
import React, { useState } from "react";

import { usePreferencesStore } from "../../store/preferencesStore";
import { Button } from "../ui/Button";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Right-slide drawer for user preferences.
 * Reads / writes the persisted preferences store.
 */
export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose }) => {
  const {
    toastEnabled,
    toastDensity,
    animationSpeed,
    denseMode,
    maxLogHistory,
    showOnboarding,
    setToastEnabled,
    setToastDensity,
    setAnimationSpeed,
    setDenseMode,
    setMaxLogHistory,
    setShowOnboarding,
    reset,
  } = usePreferencesStore();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-xs cursor-pointer"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="設定"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border-l border-slate-800 w-[20rem] max-w-full h-full overflow-y-auto shadow-2xl cursor-default flex flex-col"
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-400" />
            設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 rounded transition cursor-pointer"
            aria-label="設定を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 設定項目 */}
        <div className="flex-1 px-5 py-4 space-y-5 text-xs text-slate-300">
          {/* トースト通知 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">通知</h3>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>トースト通知</span>
              <input
                type="checkbox"
                checked={toastEnabled}
                onChange={(e) => setToastEnabled(e.target.checked)}
                className="accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>表示密度</span>
              <select
                value={toastDensity}
                onChange={(e) => setToastDensity(e.target.value as typeof toastDensity)}
                disabled={!toastEnabled}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] disabled:opacity-50"
              >
                <option value="comfortable">標準</option>
                <option value="compact">コンパクト</option>
              </select>
            </label>
          </section>

          {/* アニメーション */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">
              アニメーション
            </h3>
            <label className="block space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span>速度</span>
                <span className="font-mono text-sky-400">{animationSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="4"
                step="0.25"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                className="w-full accent-sky-500"
              />
            </label>
          </section>

          {/* 表示 */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">表示</h3>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>高密度モード</span>
              <input
                type="checkbox"
                checked={denseMode}
                onChange={(e) => setDenseMode(e.target.checked)}
                className="accent-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>初回チュートリアル</span>
              <input
                type="checkbox"
                checked={showOnboarding}
                onChange={(e) => setShowOnboarding(e.target.checked)}
                className="accent-sky-500"
              />
            </label>
          </section>

          {/* ログ */}
          <section className="space-y-2">
            <h3 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">ログ</h3>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span>履歴保持件数</span>
              <input
                type="number"
                min={10}
                max={500}
                step={10}
                value={maxLogHistory}
                onChange={(e) => setMaxLogHistory(parseInt(e.target.value, 10) || 100)}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 w-20 text-right font-mono text-[11px]"
              />
            </label>
          </section>
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-between shrink-0">
          <Button onClick={reset} variant="ghost" size="sm">
            初期化
          </Button>
          <Button onClick={onClose} variant="primary" size="sm">
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};

// Hook for managing drawer open/close
export const useSettingsDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };
};
