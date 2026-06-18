import React from "react";
import { useGameStore } from "../store/gameStore";
import { Play, Pause, UserPlus, RefreshCw, AlertTriangle } from "lucide-react";

export const Header: React.FC = () => {
  const {
    currentDay,
    currentHour,
    gold,
    food,
    soulPoints,
    isPaused,
    playSpeed,
    gameOver,
    currentTier,
    gameLimitDays,
    bossDefeated,
    togglePause,
    setPlaySpeed,
    hireVillager,
    resetGame,
    villagers,
    advanceDay,
  } = useGameStore();

  const dailyFoodConsumption = villagers.length;
  const foodDaysLeft = dailyFoodConsumption > 0 ? Math.floor(food / dailyFoodConsumption) : 0;

  const handlePrestige = () => {
    if (
      window.confirm(
        "現在の周回を諦め、ソウルポイントを獲得して転生しますか？\n（村人Lv、施設Lv、インベントリはリセットされます）",
      )
    ) {
      resetGame(true);
    }
  };

  return (
    <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      {/* タイトルと時間 */}
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent tracking-wider">
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
            className={`font-mono font-bold text-lg ${food < 10 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}
          >
            {Math.floor(food)}
            <span className="text-[10px] text-slate-400 font-normal ml-1">
              (-{dailyFoodConsumption}/日, あと{foodDaysLeft}日分)
            </span>
          </span>
          {food === 0 && (
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

        {/* 村人雇用 */}
        <button
          onClick={hireVillager}
          disabled={gold < 100 || villagers.length >= 10 || gameOver}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition duration-200"
        >
          <UserPlus className="w-4 h-4" />
          雇用 (100G)
        </button>

        {/* 転生 */}
        <button
          onClick={handlePrestige}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition duration-200 border border-purple-500/20"
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
  );
};
