import { ArrowUpCircle, Pickaxe } from "lucide-react";
import React from "react";

import { BUILDING_COST_REDUCTION } from "../../constants";
import { ITEMS, getCraftableItemsForFacility } from "../../data/masterData";
import { useInventory, usePlayerResources, useSoulUpgrades, useVillagers } from "../../hooks";
import { useGameStore } from "../../store/gameStore";
import type { Facility, FacilityType } from "../../types/game";
import { getResourceFacilityGValue } from "../../utils/economyHelpers";
import {
  getNextLevelResourceProduction,
  getResourceProductionInfo,
  isResourceFacility,
} from "../../utils/facilityHelpers";
import { ProgressBar } from "../ui/ProgressBar";
import { CraftQueueDisplay } from "./CraftQueueDisplay";
import { CraftRecipeGrid } from "./CraftRecipeGrid";
import { FacilityCollapsedSummary } from "./FacilityCollapsedSummary";
import { GuildPanel } from "./GuildPanel";
import { TradeRulePanel } from "./TradeRulePanel";
import { TrainingGroundPanel } from "./TrainingGroundPanel";
import { UpgradeCostDisplay } from "./UpgradeCostDisplay";

const FACILITY_DESCRIPTIONS: Record<string, string> = {
  inn: "休息中の村人のHP/スタミナ回復速度が上昇します。レベルアップで回復量がさらに増加します。",
  workshop:
    "採取した原木や鉄鉱石などの素材を、木板や鉄インゴットなどの中間素材へ加工できます。Lv3以上で強化木板・水晶の粉末・闇のインゴットが生産可能に。",
  kitchen:
    "集めた食料や魔獣の肉などから、村人のステータスを一時的に強化する様々な料理を調理できます。Lv4で薬草の宴、Lv5で竜の宴が解放。",
  alchemy:
    "薬草から回復薬を調合したり、魔法石からより強力なポーションやエリクサーを生産できます。Lv4で極上の万能薬、Lv5でフェニックスの涙が解放。",
  market:
    "レベルに応じて輸出売却額が+10%～+50%に上昇し、同時に出せる馬車数が1～5台に増加します。また、自動購入を設定できます。",
  guild:
    "新しい冒険者（村人）を雇用して開拓の効率を上げられます。レベルアップで最大14人まで雇用枠が広がります。",
  weapon_shop:
    "武器や防具などの装備品をクラフトできる工房です。レベルアップでより強力な装備が作れるようになります。Lv1〜2は木・革素材、Lv3は鉄、Lv4は銀、Lv5は竜素材の装備が解放されます。",
  training_ground:
    "村人が所持金を支払って能力を鍛える訓練施設です。上位の訓練プログラムほど高度な施設レベルと高額な費用が必要ですが、より大きな成長が見込めます。",
  farm: "毎時間自動的に食料を生産します。レベルアップで生産効率が向上します。",
  lumberyard: "毎時間自動的に原木を生産します。開拓に必要な木材を効率よく調達できます。",
  quarry:
    "毎時間自動的に石材を生産します。施設のアップグレードやクラフトに必要な石材の他、高レベルでは鉄鉱石や鉄インゴットなどの鉱物資源を調達できます。",
};

interface ResourceRule {
  itemId: string;
  requiredLevel: number;
  getAmountText: (lvl: number) => string;
}

const RESOURCE_RULES: Record<string, ResourceRule[]> = {
  farm: [
    {
      itemId: "wheat",
      requiredLevel: 1,
      getAmountText: (lvl) => `${Math.floor((1 + lvl) / 2)}個`,
    },
    {
      itemId: "vegetable",
      requiredLevel: 2,
      getAmountText: (lvl) => `${Math.floor(lvl / 2)}個`,
    },
    {
      itemId: "raw_meat",
      requiredLevel: 2,
      getAmountText: (lvl) => `${Math.floor((lvl - 1) / 2)}個`,
    },
    {
      itemId: "herb",
      requiredLevel: 3,
      getAmountText: (lvl) => `確率 ${Math.round((lvl - 2) * 30)}% で 1個`,
    },
  ],
  lumberyard: [
    { itemId: "wood", requiredLevel: 1, getAmountText: (lvl) => `${lvl}個` },
    {
      itemId: "wood_plank",
      requiredLevel: 3,
      getAmountText: (lvl) => `確率 ${Math.round((lvl - 2) * 30)}% で 1個`,
    },
  ],
  quarry: [
    { itemId: "stone", requiredLevel: 1, getAmountText: (lvl) => `${lvl}個` },
    {
      itemId: "iron_ore",
      requiredLevel: 3,
      getAmountText: (lvl) => `確率 ${Math.round((lvl - 2) * 30)}% で 1個`,
    },
    {
      itemId: "iron_ingot",
      requiredLevel: 4,
      getAmountText: (lvl) => `確率 ${Math.round((lvl - 3) * 20)}% で 1個`,
    },
    {
      itemId: "silver_ore",
      requiredLevel: 5,
      getAmountText: () => `確率 25% で 1個`,
    },
  ],
};

interface FacilityCardProps {
  fac: Facility;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onStartUpgrade: (facilityId: FacilityType) => void;
  onHireVillager: () => void;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({
  fac,
  expanded,
  onToggleExpand,
  onStartUpgrade,
  onHireVillager,
}) => {
  const setSelectedItem = useGameStore((s) => s.setSelectedItem);
  const { inventory, tradeRules } = useInventory();
  const { gold } = usePlayerResources();
  const villagers = useVillagers();
  const soulUpgrades = useSoulUpgrades();
  const buildLvl = soulUpgrades.building || 0;
  const costReduction = 1 - buildLvl * BUILDING_COST_REDUCTION;
  const isUnlocked = fac.level > 0;
  const canUpgrade = fac.level < fac.maxLevel;
  const goldCost = Math.floor(fac.upgradeCost.gold * costReduction);

  const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
    const reqCount = Math.floor(req.count * costReduction);
    return Math.floor(inventory[req.itemId] || 0) >= reqCount;
  });
  const canAffordUpgrade = gold >= goldCost && hasUpgradeMaterials && fac.upgradeTimeLeft === 0;

  const reducedCost = {
    gold: goldCost,
    materials: fac.upgradeCost.materials.map((m) => ({
      itemId: m.itemId,
      count: Math.floor(m.count * costReduction),
    })),
  };

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
          <FacilityCollapsedSummary
            fac={fac}
            villagers={villagers}
            inventory={inventory}
            gold={gold}
            reducedCost={reducedCost}
            isUnlocked={isUnlocked}
          />
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-900 space-y-3.5">
            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
              {FACILITY_DESCRIPTIONS[fac.id]}
            </p>

            {canUpgrade && fac.upgradeTimeLeft === 0 && (
              <UpgradeCostDisplay cost={reducedCost} inventory={inventory} gold={gold} isExpanded />
            )}

            <CraftRecipeGrid
              facilityId={fac.id}
              facilityLevel={fac.level > 0 ? fac.level : 1}
              inventory={inventory}
              gold={gold}
              villagers={villagers}
              craftableItems={craftableItems}
              isUnlocked={isUnlocked}
              onStartCraft={() => {}}
              onSelectItem={setSelectedItem}
            />

            <CraftQueueDisplay craftQueue={fac.craftQueue} />

            {fac.id === "inn" && (
              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                ※休息中の村人のHP/スタミナが 毎時間 HP +{10 + fac.level * 5}, スタミナ +
                {15 + fac.level * 5} 回復します。
              </p>
            )}

            {fac.id === "training_ground" && isUnlocked && <TrainingGroundPanel fac={fac} />}

            {isResourceFacility(fac.id) && (
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Pickaxe className="w-3 h-3 text-sky-400" />
                  {isUnlocked ? "自動生産アイテム (12時間ごと)" : "解放される自動生産アイテム"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESOURCE_RULES[fac.id]?.map((rule) => {
                    const item = ITEMS[rule.itemId];
                    if (!item) return null;
                    const isAvailable = fac.level >= rule.requiredLevel;
                    return (
                      <div
                        key={rule.itemId}
                        className={`p-2.5 rounded-lg border flex flex-col gap-1 ${
                          isAvailable
                            ? "bg-slate-950/80 border-slate-800"
                            : "bg-slate-950/20 border-slate-900/60 opacity-60"
                        }`}
                      >
                        <p
                          className={`text-xs font-bold ${
                            isAvailable
                              ? "text-sky-300 hover:text-sky-200 cursor-pointer"
                              : "text-slate-500"
                          }`}
                          onClick={(e) => {
                            if (!isAvailable) return;
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          生産量: {isAvailable ? rule.getAmountText(fac.level) : "未解放"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          必要施設レベル: Lv.{rule.requiredLevel}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 italic leading-relaxed pt-1">
                  ※この施設は12時間ごとに自動的に稼働し、倉庫に資源を追加します。現在の生産量:{" "}
                  <span className="text-emerald-400 font-bold font-mono">
                    {fac.level === 0 ? "なし" : getResourceProductionInfo(fac).label}
                  </span>
                  /12時間
                  {fac.level > 0 && (
                    <span className="text-amber-400 font-bold font-mono ml-1">
                      (約{getResourceFacilityGValue(fac.id, fac.level).gValue}
                      G相当)
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
              </div>
            )}

            {fac.id === "guild" && (
              <GuildPanel fac={fac} isUnlocked={isUnlocked} onHireVillager={onHireVillager} />
            )}

            {fac.id === "market" && isUnlocked && <TradeRulePanel tradeRules={tradeRules} />}
          </div>
        )}
      </div>
    </>
  );
};
