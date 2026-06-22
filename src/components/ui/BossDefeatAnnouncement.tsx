import { Crown, Sword } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useBossDefeatStore } from "../../hooks/useBossDefeatStore";

export const BossDefeatAnnouncement: React.FC = () => {
  const info = useBossDefeatStore((s) => s.info);
  const clear = useBossDefeatStore((s) => s.clear);
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (info) {
      setVisible(true);
      setAnimatingOut(false);
      const timer = setTimeout(() => {
        setAnimatingOut(true);
        setTimeout(() => {
          setVisible(false);
          clear();
        }, 500);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [info, clear]);

  if (!visible || !info) return null;

  return (
    <div
      onClick={() => {
        setAnimatingOut(true);
        setTimeout(() => {
          setVisible(false);
          clear();
        }, 500);
      }}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto cursor-pointer"
    >
      {/* 背景オーバーレイ */}
      <div
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-500 ${
          animatingOut ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* バナー本体 */}
      <div
        className={`relative bg-slate-900 border-2 border-amber-400/50 rounded-2xl px-10 py-8 shadow-[0_0_40px_rgba(251,191,36,0.15)] transition-all duration-300 ${
          animatingOut
            ? "scale-90 opacity-0"
            : "scale-100 opacity-100 animate-[bannerIn_0.4s_ease-out]"
        }`}
      >
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-8 h-8 text-amber-400" />
            <Sword className="w-8 h-8 text-amber-400" />
          </div>

          <div className="text-amber-400 text-xs font-bold tracking-[0.2em] uppercase">
            討伐成功
          </div>

          <h2 className="text-2xl font-extrabold text-white">
            エリアボス
            <span className="text-amber-400 ml-2">【{info.bossName}】</span>
            を撃破！
          </h2>

          <div className="w-24 h-0.5 bg-linear-to-r from-transparent via-amber-400/60 to-transparent mx-auto" />

          <div className="text-slate-300 text-sm space-y-1">
            <p>
              Tier <span className="text-amber-400 font-bold">{info.tier}</span> に進行しました！
            </p>
            <p className="text-slate-500 text-xs">次の期限: {info.gameLimitDays}日目 まで</p>
          </div>

          <p className="text-slate-500 text-[10px] mt-2">クリックで閉じる</p>
        </div>
      </div>

      <style>{`
        @keyframes bannerIn {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
