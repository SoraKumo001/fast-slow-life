import { Sparkles, RefreshCw } from "lucide-react";
import React from "react";

import { useGameStore, SOUL_UPGRADES } from "../../store/gameStore";

export const SoulShop: React.FC = () => {
  const { soulPoints, soulUpgrades, buySoulUpgrade, resetGame } = useGameStore();

  const handleStartNewGame = () => {
    if (window.confirm("バフを引き継いで新しい周回を開始しますか？")) {
      resetGame(true);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
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
          const cost = u.costPerLevel * (currentLvl + 1);
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
                    : `-${currentLvl * u.effectValue * 100}%`}
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
              </div>
            </div>
          );
        })}
      </div>

      {/* 新たな周回開始ボタン */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={handleStartNewGame}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-lg transition shadow-lg shadow-purple-950/50"
        >
          <RefreshCw className="w-4 h-4" />
          バフを適用して新しい周回を開始
        </button>
      </div>
    </div>
  );
};
