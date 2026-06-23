import { Hammer, ArrowUpCircle } from "lucide-react";
import React, { useState } from "react";

import { MAX_VILLAGERS_ABSOLUTE } from "../../constants";
import { ITEMS, getCraftableItemsForFacility, getRecipeForItem } from "../../data/masterData";
import type { Facility, FacilityType, Item, Villager } from "../../types/game";
import { getRecipeValueInfo, getResourceFacilityGValue } from "../../utils/economyHelpers";
import {
  getNextLevelResourceProduction,
  getResourceProductionInfo,
  isResourceFacility,
} from "../../utils/facilityHelpers";
import { ItemDetailModal } from "../modals/ItemDetailModal";
import { ProgressBar } from "../ui/ProgressBar";
import { GuildPanel } from "./GuildPanel";
import { TradeRulePanel } from "./TradeRulePanel";
import { TrainingGroundPanel } from "./TrainingGroundPanel";

const FACILITY_DESCRIPTIONS: Record<string, string> = {
  inn: "休息中の村人のHP/スタミナ回復速度が上昇します。レベルアップで回復量がさらに増加します。",
  workshop: "採取した原木や鉄鉱石などの素材を、木板や鉄インゴットなどの中間素材へ加工できます。",
  kitchen:
    "集めた食料や魔獣の肉などから、村人のステータスを一時的に強化する様々な料理を調理できます。",
  alchemy: "薬草から回復薬を調合したり、魔法石からより強力なポーションやエリクサーを生産できます。",
  market:
    "倉庫内のアイテム詳細画面から、素材や不要になった装備を売却してゴールドを入手できるようになります。また、自動購入を設定できます。",
  guild:
    "新しい冒険者（村人）を雇用して開拓の効率を上げられます。レベルアップで最大10人まで雇用枠が広がります。",
  weapon_shop:
    "武器や防具などの装備品をクラフトできる工房です。強力な装備を作って村人のステータスを強化しましょう。また、武器・防具の売却が可能になり、レベルに応じて買取価格にボーナスが適用されます。",
  training_ground:
    "村人が所持金を支払って能力を鍛える訓練施設です。上位の訓練プログラムほど高度な施設レベルと高額な費用が必要ですが、より大きな成長が見込めます。",
  farm: "毎時間自動的に食料を生産します。レベルアップで生産効率が向上します。",
  lumberyard: "毎時間自動的に原木を生産します。開拓に必要な木材を効率よく調達できます。",
  quarry:
    "毎時間自動的に石材を生産します。施設のアップグレードやクラフトに必要な石材を調達できます。",
};

interface FacilityCardProps {
  fac: Facility;
  inventory: Record<string, number>;
  gold: number;
  villagers: Villager[];
  tradeRules: { id: string; itemId: string; type: string; threshold: number; isEnabled: boolean }[];
  costReduction: number;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onStartUpgrade: (facilityId: FacilityType) => void;
  onHireVillager: () => void;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({
  fac,
  inventory,
  gold,
  villagers,
  tradeRules,
  costReduction,
  expanded,
  onToggleExpand,
  onStartUpgrade,
  onHireVillager,
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const isUnlocked = fac.level > 0;
  const canUpgrade = fac.level < fac.maxLevel;
  const goldCost = Math.floor(fac.upgradeCost.gold * costReduction);

  const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
    const reqCount = Math.floor(req.count * costReduction);
    return Math.floor(inventory[req.itemId] || 0) >= reqCount;
  });
  const canAffordUpgrade = gold >= goldCost && hasUpgradeMaterials && fac.upgradeTimeLeft === 0;

  const craftableItems = getCraftableItemsForFacility(fac.id, fac.level > 0 ? fac.level : 1);

  return (
    <>
      <div
        onClick={() => onToggleExpand(fac.id)}
        className={`border rounded-xl p-4 transition-all duration-200 ${
          isUnlocked
            ? "bg-slate-950/70 border-slate-800 hover:border-slate-700/80 cursor-pointer"
            : "bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700/60 cursor-pointer"
        }`}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm sm:text-base">
              {fac.name}
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                {isUnlocked ? `Lv.${fac.level}` : "未建設"}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {canUpgrade && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartUpgrade(fac.id);
                }}
                disabled={!canAffordUpgrade}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600/90 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] font-semibold transition cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                {fac.upgradeTimeLeft > 0 ? "工事中" : isUnlocked ? "強化" : "建設"}
              </button>
            )}
            <span className="text-xs text-slate-500 font-mono ml-1">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {fac.upgradeTimeLeft > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>
                アップグレード進行中
                {fac.upgradeAssignedVillagerId
                  ? ` (担当: ${villagers.find((v) => v.id === fac.upgradeAssignedVillagerId)?.name || "村人"})`
                  : ""}
                ...
              </span>
              <span>残り {fac.upgradeTimeLeft}時間</span>
            </div>
            <ProgressBar
              value={fac.upgradeTotalTime - fac.upgradeTimeLeft}
              max={fac.upgradeTotalTime}
              height={1.5}
              color="amber"
            />
          </div>
        )}

        {!expanded && (
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-1.5">
            {isUnlocked ? (
              fac.id === "inn" ? (
                <span className="text-slate-500">休息機能利用可能</span>
              ) : fac.id === "guild" ? (
                <span className="text-slate-500">
                  雇用上限: {Math.min(MAX_VILLAGERS_ABSOLUTE, 3 + fac.level * 2)}人 (現在:{" "}
                  {villagers.length}人)
                </span>
              ) : fac.id === "training_ground" ? (
                fac.trainingQueue.length > 0 ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-400 font-bold">
                      訓練中 ({fac.trainingQueue.length}/3)
                    </span>
                    <span className="text-slate-500 text-[10px] truncate max-w-37.5 sm:max-w-xs">
                      • {fac.trainingQueue[0].timeLeft}時間残
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">待機中の村人を訓練可能</span>
                )
              ) : isResourceFacility(fac.id) ? (
                <span className="text-emerald-500 font-semibold">
                  自動生産中: {getResourceProductionInfo(fac).label}/12h
                </span>
              ) : fac.craftQueue.length > 0 ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-sky-400 font-bold">加工中 ({fac.craftQueue.length}/3)</span>
                  <span className="text-slate-500 text-[10px] truncate max-w-37.5 sm:max-w-xs">
                    • {ITEMS[fac.craftQueue[0].itemId]?.name}等生産中 (残り{" "}
                    {fac.craftQueue[0].timeLeft}h)
                  </span>
                </>
              ) : (
                <span className="text-slate-500">生産停止中 (待機)</span>
              )
            ) : (
              <>
                <span className="text-slate-500 font-semibold">建設条件: </span>
                <span className={gold >= goldCost ? "text-amber-400" : "text-red-400"}>
                  {goldCost}G
                </span>
                {fac.upgradeCost.materials.map((m) => {
                  const reqCount = Math.floor(m.count * costReduction);
                  const current = Math.floor(inventory[m.itemId] || 0);
                  return (
                    <span
                      key={m.itemId}
                      className={current >= reqCount ? "text-slate-400" : "text-red-400"}
                    >
                      {ITEMS[m.itemId].name}({current}/{reqCount})
                    </span>
                  );
                })}
              </>
            )}
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-900 space-y-3.5">
            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
              {FACILITY_DESCRIPTIONS[fac.id]}
            </p>

            {canUpgrade && fac.upgradeTimeLeft === 0 && (
              <div className="text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/50 leading-relaxed">
                <span className="font-semibold text-slate-300">必要: </span>
                <span className={gold >= goldCost ? "text-amber-400" : "text-red-400"}>
                  {goldCost} G
                </span>
                {fac.upgradeCost.materials.map((m) => {
                  const reqCount = Math.floor(m.count * costReduction);
                  const current = Math.floor(inventory[m.itemId] || 0);
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

            {craftableItems.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Hammer className="w-3 h-3 text-sky-400" />
                  {isUnlocked ? "生産レシピ (最大3枠)" : "解放される生産レシピ"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {craftableItems.map((item) => {
                    const recipe = getRecipeForItem(item.id)!;
                    const valueInfo = getRecipeValueInfo(recipe);
                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 flex flex-col gap-1"
                      >
                        <p
                          className="text-xs font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          必要:{" "}
                          {recipe.requiredItems.map((r, i) => (
                            <React.Fragment key={r.itemId}>
                              {i > 0 && <span>, </span>}
                              <span
                                className="text-sky-300 hover:text-sky-200 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const reqItem = ITEMS[r.itemId];
                                  if (reqItem) setSelectedItem(reqItem);
                                }}
                              >
                                {ITEMS[r.itemId]?.name}x{r.count}
                              </span>
                            </React.Fragment>
                          ))}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          所要時間: {recipe.requiredTime}時間
                          {valueInfo.valueAdd !== 0 && (
                            <span
                              className={`ml-1.5 font-bold ${valueInfo.valueAdd > 0 ? "text-emerald-400" : "text-red-400"}`}
                            >
                              {valueInfo.valueAdd > 0 ? "+" : ""}
                              {valueInfo.valueAdd}G ({valueInfo.valuePerHour >= 0 ? "+" : ""}
                              {valueInfo.valuePerHour}G/h)
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {fac.craftQueue.length > 0 && (
              <div className="space-y-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  進行中のキュー ({fac.craftQueue.length}/3)
                </p>
                {fac.craftQueue.map((job) => (
                  <div key={job.id} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-300">
                      <span>{ITEMS[job.itemId].name}</span>
                      <span>残り {job.timeLeft}時間</span>
                    </div>
                    <ProgressBar
                      value={job.totalTime - job.timeLeft}
                      max={job.totalTime}
                      height={1}
                      color="sky"
                    />
                  </div>
                ))}
              </div>
            )}

            {fac.id === "inn" && (
              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                ※休息中の村人のHP/スタミナが 毎時間 HP +{10 + fac.level * 5}, スタミナ +
                {15 + fac.level * 5} 回復します。
              </p>
            )}

            {fac.id === "training_ground" && isUnlocked && (
              <TrainingGroundPanel fac={fac} villagers={villagers} />
            )}

            {isResourceFacility(fac.id) && (
              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                ※この施設は12時間ごとに自動的に稼働し、倉庫に資源を追加します。現在の生産量:{" "}
                <span className="text-emerald-400 font-bold font-mono">
                  {fac.level === 0 ? "なし" : getResourceProductionInfo(fac).label}
                </span>
                /12時間
                {fac.level > 0 && (
                  <span className="text-amber-400 font-bold font-mono ml-1">
                    (約{getResourceFacilityGValue(fac.id, fac.level).gValue}G相当)
                  </span>
                )}
                {fac.level > 0 && fac.level < fac.maxLevel && (
                  <>
                    {" "}
                    （建設・強化後:{" "}
                    <span className="text-sky-400 font-bold font-mono">
                      {getNextLevelResourceProduction(fac).label}
                    </span>
                    <span className="text-amber-400 font-bold font-mono ml-1">
                      (約
                      {
                        getResourceFacilityGValue(fac.id, Math.min(fac.level + 1, fac.maxLevel))
                          .gValue
                      }
                      G相当)
                    </span>
                    /12時間）
                  </>
                )}
              </p>
            )}

            {fac.id === "guild" && (
              <GuildPanel
                fac={fac}
                villagers={villagers}
                gold={gold}
                isUnlocked={isUnlocked}
                onHireVillager={onHireVillager}
              />
            )}

            {fac.id === "market" && isUnlocked && <TradeRulePanel tradeRules={tradeRules} />}
          </div>
        )}
      </div>
      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
};
