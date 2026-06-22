import { Play, Pause, RefreshCw, Sparkles, Terminal } from "lucide-react";
import React, { useState } from "react";

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
import { SoulShop } from "../modals/SoulShop";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { LogHistoryWindow } from "./LogHistoryWindow";

export const Header: React.FC = () => {
  const { currentDay, currentHour } = useGameTime();
  const { gold, soulPoints } = usePlayerResources();
  const inventory = useInventory().inventory;
  const { isPaused, playSpeed, gameOver, gameLimitDays } = useGameStatus();
  const { currentTier, bossDefeated } = useDungeons();
  const villagers = useVillagers();
  const soulUpgrades = useSoulUpgrades();
  const { togglePause, setPlaySpeed, advanceDay } = useGameControls();
  const logs = useLogs();

  const [showSoulShopModal, setShowSoulShopModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const dailyFoodConsumption = villagers.length;
  // 食料在庫の合計を計算: foodカテゴリ品 + 生の食材（飢餓判定で消費される）
  const foodItems = [
    "food_bread",
    "food_dried_meat",
    "food_herb_salad",
    "food_sandwich",
    "food_stamina_stew",
    "food_beast_roast",
    "food_dragon_hotpot",
  ];
  const rawItems = ["wheat", "vegetable", "raw_meat"];
  const foodAmount =
    foodItems.reduce((sum, id) => sum + (inventory[id] || 0), 0) +
    rawItems.reduce((sum, id) => sum + (inventory[id] || 0), 0);
  const foodDaysLeft = dailyFoodConsumption > 0 ? Math.floor(foodAmount / dailyFoodConsumption) : 0;

  return (
    <>
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
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
            <Badge variant="default" className="text-xs px-2 py-0.5">
              Tier {currentTier}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              ゴールド
            </span>
            <span className="text-amber-400 font-mono font-bold text-lg">
              {Math.floor(gold).toLocaleString()} G
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
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              ソウル (SP)
            </span>
            <span className="text-purple-400 font-mono font-bold text-lg">{soulPoints} SP</span>
          </div>
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
            title={isPaused ? "再開" : "一時停止"}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>

          <Button
            onClick={advanceDay}
            disabled={!isPaused || gameOver}
            variant="secondary"
            size="custom"
            className="px-2.5 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-white"
            title="1日スキップ（一時停止中のみ）"
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
              >
                {speed === "normal" ? "1x" : speed === "fast" ? "3x" : "10x"}
              </Button>
            ))}
          </div>

          <Button
            onClick={() => setShowHistoryModal(true)}
            variant="secondary"
            size="custom"
            className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg hover:border-slate-650"
            title="過去のログ履歴を表示"
          >
            <Terminal className="w-4 h-4 text-sky-400" />
            ログ履歴
          </Button>

          <Button
            onClick={() => setShowSoulShopModal(true)}
            variant="custom"
            size="custom"
            className="flex items-center gap-2 font-medium text-xs px-3.5 py-2 rounded-lg border border-purple-500/20 bg-linear-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            転生
          </Button>
        </div>

        <div className="w-full text-center mt-2 md:mt-0 md:w-auto">
          <span className="text-xs text-slate-400">
            次の期限: <strong className="text-red-400">{gameLimitDays}日目</strong> までにボスを討伐
            {bossDefeated && (
              <span className="text-emerald-400 font-bold ml-2">(ボス討伐完了！現在猶予中)</span>
            )}
          </span>
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

      {showHistoryModal && (
        <LogHistoryWindow logs={logs} onClose={() => setShowHistoryModal(false)} />
      )}
    </>
  );
};
