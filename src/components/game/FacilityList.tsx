import React from "react";
import {
  useGameStore,
  ITEMS,
  getCraftableItemsForFacility,
  getRecipeForItem,
} from "../../store/gameStore";
import { Home, Hammer, Plus, ArrowUpCircle } from "lucide-react";

export const FacilityList: React.FC = () => {
  const { facilities, inventory, gold, soulUpgrades, startCraft, startFacilityUpgrade } =
    useGameStore();

  const buildLvl = soulUpgrades.building || 0;
  const costReduction = 1 - buildLvl * 0.05;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Home className="w-5 h-5 text-sky-400" />
        村の施設・クラフト
      </h2>

      {/* 施設一覧 */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {Object.values(facilities).map((fac) => {
          const isUnlocked = fac.level > 0;
          const canUpgrade = fac.level < fac.maxLevel;
          const goldCost = Math.floor(fac.upgradeCost.gold * costReduction);

          // 必要素材が足りているかチェック
          const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
            const reqCount = Math.floor(req.count * costReduction);
            return (inventory[req.itemId] || 0) >= reqCount;
          });
          const canAffordUpgrade =
            gold >= goldCost && hasUpgradeMaterials && fac.upgradeTimeLeft === 0;

          // この施設でクラフト可能なアイテム
          const craftableItems = getCraftableItemsForFacility(fac.id, fac.level);

          return (
            <div
              key={fac.id}
              className={`border rounded-xl p-4 transition-all duration-200 ${
                isUnlocked
                  ? "bg-slate-950/70 border-slate-800"
                  : "bg-slate-950/20 border-dashed border-slate-800 text-slate-500 opacity-60"
              }`}
            >
              {/* 施設タイトル */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm sm:text-base">
                    {fac.name}
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                      {isUnlocked ? `Lv.${fac.level}` : "未建設"}
                    </span>
                  </h3>
                  {!isUnlocked && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Tier {fac.id === "blacksmith" ? "1" : fac.id === "alchemy" ? "2" : "3"}{" "}
                      でアンロック可能
                    </p>
                  )}
                </div>

                {/* アップグレードボタン */}
                {canUpgrade && (
                  <button
                    onClick={() => startFacilityUpgrade(fac.id)}
                    disabled={!canAffordUpgrade}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600/90 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] font-semibold transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    {fac.upgradeTimeLeft > 0 ? "工事中" : isUnlocked ? "強化" : "建設"}
                  </button>
                )}
              </div>

              {/* 工事中のプログレスバー */}
              {fac.upgradeTimeLeft > 0 && (
                <div className="mb-3.5 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>アップグレード進行中...</span>
                    <span>残り {fac.upgradeTimeLeft}時間</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${((fac.upgradeTotalTime - fac.upgradeTimeLeft) / fac.upgradeTotalTime) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 建設/強化コスト情報 */}
              {canUpgrade && fac.upgradeTimeLeft === 0 && (
                <div className="mb-3 text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/50 leading-relaxed">
                  <span className="font-semibold text-slate-300">必要: </span>
                  <span className={gold >= goldCost ? "text-amber-400" : "text-red-400"}>
                    {goldCost} G
                  </span>
                  {fac.upgradeCost.materials.map((m) => {
                    const reqCount = Math.floor(m.count * costReduction);
                    const current = inventory[m.itemId] || 0;
                    return (
                      <span
                        key={m.itemId}
                        className={`ml-2 whitespace-nowrap ${current >= reqCount ? "text-slate-300" : "text-red-400"}`}
                      >
                        {ITEMS[m.itemId].name}({current}/{reqCount})
                      </span>
                    );
                  })}
                </div>
              )}

              {/* クラフト欄（アンロック済み、かつクラフト可能アイテムがある場合） */}
              {isUnlocked && craftableItems.length > 0 && (
                <div className="mt-3.5 space-y-2.5 border-t border-slate-900 pt-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Hammer className="w-3 h-3 text-sky-400" />
                    生産レシピ (最大3枠)
                  </h4>

                  {/* レシピ一覧 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {craftableItems.map((item) => {
                      const recipe = getRecipeForItem(item.id)!;
                      // 素材チェック
                      const hasMaterials = recipe.requiredItems.every(
                        (req) => (inventory[req.itemId] || 0) >= req.count,
                      );
                      const canStart = hasMaterials && fac.craftQueue.length < 3;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col justify-between"
                        >
                          <div className="mb-1.5">
                            <p className="text-xs font-bold text-slate-200">{item.name}</p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              必要:{" "}
                              {recipe.requiredItems
                                .map((r) => `${ITEMS[r.itemId].name}x${r.count}`)
                                .join(", ")}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              時間: {recipe.requiredTime}h
                            </p>
                          </div>

                          <button
                            onClick={() => startCraft(fac.id, item.id)}
                            disabled={!canStart}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-sky-600/90 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-medium text-white transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            加工開始 {fac.craftQueue.length >= 3 ? "(満杯)" : ""}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* クラフトキュー進捗 */}
                  {fac.craftQueue.length > 0 && (
                    <div className="mt-3 space-y-2 bg-slate-900/40 p-2 rounded border border-slate-900">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        進行中のキュー
                      </p>
                      {fac.craftQueue.map((job) => (
                        <div key={job.id} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono text-slate-300">
                            <span>{ITEMS[job.itemId].name}</span>
                            <span>残り {job.timeLeft}時間</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1 rounded-full">
                            <div
                              className="bg-sky-400 h-1 rounded-full transition-all duration-300"
                              style={{
                                width: `${((job.totalTime - job.timeLeft) / job.totalTime) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 宿屋の機能説明 */}
              {isUnlocked && fac.id === "inn" && (
                <p className="text-[10px] text-slate-400 mt-2 italic leading-relaxed">
                  ※休息中の村人のHP/スタミナが 毎時間 HP +{10 + fac.level * 5}, スタミナ +
                  {15 + fac.level * 5} 回復します。
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
