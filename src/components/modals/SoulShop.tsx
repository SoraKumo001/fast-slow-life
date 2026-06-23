import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import React, { useState } from "react";

import { SOUL_UPGRADES } from "../../data/masterData";
import { usePlayerResources, useSoulUpgrades, useSoulActions } from "../../hooks";

export const SoulShop: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { soulPoints } = usePlayerResources();
  const soulUpgrades = useSoulUpgrades();
  const { buySoulUpgrade, downgradeSoulUpgrade, resetGame } = useSoulActions();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStartNewGame = () => {
    setShowConfirm(true);
  };

  const confirmReset = () => {
    resetGame(true);
    setShowConfirm(false);
    onClose?.();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 relative">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h2 className="text-md font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="w-5 h-5" />
          転生バフショップ
        </h2>
        <span className="bg-purple-950/60 border border-purple-800 px-3 py-1 rounded text-purple-400 font-mono font-bold text-xs">
          所持: {soulPoints} SP
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        獲得したソウルポイント (SP) を消費して、次回以降のプレイで永続適用されるバフを購入できます。
      </p>

      {/* バフカードリスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {SOUL_UPGRADES.map((u) => {
          const currentLvl = soulUpgrades[u.id] || 0;
          const isMax = currentLvl >= u.maxLevel;
          const isMin = currentLvl <= 0;
          const cost = u.costs[currentLvl];
          const refund = isMin ? 0 : u.costs[currentLvl - 1];
          const canAfford = soulPoints >= cost && !isMax;

          return (
            <div
              key={u.id}
              className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-slate-200">{u.name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Lv. {currentLvl} / {u.maxLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{u.description}</p>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-mono">
                  現在補正:{" "}
                  {u.id === "heritage" || u.id === "storage" || u.id === "body"
                    ? `+${currentLvl * u.effectValue}`
                    : `-${Math.round(currentLvl * u.effectValue * 100)}%`}
                </span>

                {isMax ? (
                  <span className="text-xs text-slate-500 font-bold">MAX</span>
                ) : (
                  <button
                    onClick={() => buySoulUpgrade(u.id)}
                    disabled={!canAfford}
                    className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] font-bold transition"
                  >
                    強化 ({cost} SP)
                  </button>
                )}

                {!isMin && (
                  <button
                    onClick={() => downgradeSoulUpgrade(u.id)}
                    className="px-2.5 py-1.5 ml-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition"
                    title={`${refund} SP を払い戻してレベルを戻す`}
                  >
                    戻す (+{refund} SP)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 新たな周回開始ボタン */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={handleStartNewGame}
          className="flex items-center gap-2 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-lg transition shadow-lg shadow-purple-950/50"
        >
          <RefreshCw className="w-4 h-4" />
          バフを適用して新しい周回を開始
        </button>
      </div>

      {/* 確認ダイアログ (オリジナルUI) */}
      {showConfirm && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs flex items-center justify-center p-6 rounded-xl z-20">
          <div className="bg-slate-900 border border-purple-500/30 rounded-lg p-5 max-w-sm w-full space-y-4 shadow-xl shadow-purple-950/30">
            <div className="flex items-center gap-2 text-purple-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <h3 className="font-bold text-sm tracking-wider uppercase">転生の確認</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              バフを引き継いで新しい周回を開始しますか？
              <br />
              <span className="text-[10px] text-slate-500 block mt-2">
                ※現在のゴールド、倉庫アイテム、雇用した村人はすべて初期状態にリセットされます。
              </span>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition duration-200"
              >
                キャンセル
              </button>
              <button
                onClick={confirmReset}
                className="px-3.5 py-2 rounded bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition duration-200"
              >
                転生する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
