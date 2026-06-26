import { Skull } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useBossDefeatStore } from "../../hooks/useBossDefeatStore";

/**
 * Banner shown when all attackers have been wiped out in a boss battle.
 * Twin of BossDefeatAnnouncement (which handles victory).
 *
 * 5-second auto-dismiss; click also closes.
 */
export const BossWipeoutAnnouncement: React.FC = () => {
  const result = useBossDefeatStore((s) => s.result);
  const clear = useBossDefeatStore((s) => s.clear);
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (result && result.type === "defeat") {
      setVisible(true);
      setAnimatingOut(false);
      const timer = setTimeout(() => {
        setAnimatingOut(true);
        setTimeout(() => {
          setVisible(false);
          clear();
        }, 500);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [result, clear]);

  if (!visible || !result || result.type !== "defeat") return null;

  const dismiss = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setVisible(false);
      clear();
    }, 500);
  };

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto cursor-pointer"
    >
      {/* 背景オーバーレイ (赤系で敗北感を演出) */}
      <div
        className={`absolute inset-0 bg-red-950/60 backdrop-blur-[2px] transition-opacity duration-500 ${
          animatingOut ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* バナー本体 */}
      <div
        className={`relative bg-slate-900 border-2 border-red-500/60 rounded-2xl px-10 py-8 shadow-[0_0_40px_rgba(239,68,68,0.2)] transition-all duration-300 ${
          animatingOut
            ? "scale-90 opacity-0"
            : "scale-100 opacity-100 animate-[bannerIn_0.4s_ease-out]"
        }`}
      >
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <Skull className="w-10 h-10 text-red-400" />
          </div>

          <div className="text-red-400 text-xs font-bold tracking-[0.3em] uppercase">全 滅</div>

          <h2 className="text-2xl font-extrabold text-white">
            エリアボス
            <span className="text-red-400 ml-2">【{result.bossName}】</span>
            に敗北
          </h2>

          <div className="w-24 h-0.5 bg-linear-to-r from-transparent via-red-500/60 to-transparent mx-auto" />

          {/* 対策ヒント */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-left space-y-1.5 max-w-md mx-auto">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              次の対策
            </p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
              <li>
                <span className="text-emerald-400 font-bold">宿屋</span> で HP を回復する
              </li>
              <li>
                <span className="text-amber-400 font-bold">装備</span> を強化してから再挑戦する
              </li>
              <li>
                <span className="text-sky-400 font-bold">訓練所</span> でLvを上げて挑む
              </li>
            </ul>
          </div>

          <p className="text-slate-500 text-[10px] mt-2">クリックで閉じる (5秒で自動消滅)</p>
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
