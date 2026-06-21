import { Home, Hammer, ArrowUpCircle } from "lucide-react";
import React, { useState } from "react";

import { MAX_VILLAGERS_ABSOLUTE } from "../../constants";
import { ITEMS, getCraftableItemsForFacility, getRecipeForItem } from "../../data/masterData";
import {
  useFacilities,
  usePlayerResources,
  useSoulUpgrades,
  useVillagers,
  useCraftActions,
  useVillagerActions,
  useInventory,
  useInventoryActions,
} from "../../hooks";
import { useExpandedState } from "../../hooks/useExpandedState";
import { Panel } from "../ui/Panel";
import { ProgressBar } from "../ui/ProgressBar";

const FACILITY_DESCRIPTIONS: Record<string, string> = {
  inn: "休息中の村人のHP/スタミナ回復速度が上昇します。レベルアップで回復量がさらに増加します。",
  workshop: "採取した原木や鉄鉱石などの素材を、木板や鉄インゴットなどの中間素材へ加工できます。",
  blacksmith:
    "武器や防具などの装備品をクラフトできます。強力な装備を作って村人のステータスを強化しましょう。",
  alchemy: "薬草から回復薬を調合したり、魔法石からより強力なポーションやエリクサーを生産できます。",
  market:
    "倉庫内のアイテム詳細画面から、素材や不要になった装備を売却してゴールドを入手できるようになります。また、自動購入を設定できます。",
  guild:
    "新しい冒険者（村人）を雇用して開拓の効率を上げられます。レベルアップで最大10人まで雇用枠が広がります。",
  weapon_shop:
    "武器・防具の専門店です。建設すると武器・防具の売却が可能になり、レベルに応じて買取価格にボーナスが適用されます。また、装備の自動売却を設定できます。",
  pharmacy:
    "ポーションなどの消耗品専門店です。建設するとポーション等の売却が可能になり、レベルに応じて買取価格にボーナスが適用されます。また、消耗品の自動売却を設定できます。",
};

export const FacilityList: React.FC = () => {
  const facilities = useFacilities();
  const { inventory, tradeRules } = useInventory();
  const { gold } = usePlayerResources();
  const soulUpgrades = useSoulUpgrades();
  const villagers = useVillagers();
  const { startFacilityUpgrade } = useCraftActions();
  const { hireVillager } = useVillagerActions();
  const { addTradeRule, deleteTradeRule, toggleTradeRule } = useInventoryActions();
  const { isExpanded: isExpandedFn, toggleExpand } = useExpandedState();

  // 自動取引入力用State
  const [tradeItemId, setTradeItemId] = useState("");
  const [tradeThreshold, setTradeThreshold] = useState<number>(10);
  const [tradeAmount, setTradeAmount] = useState<number>(5);

  const buildLvl = soulUpgrades.building || 0;
  const costReduction = 1 - buildLvl * 0.05;

  return (
    <Panel title="村の施設・クラフト" icon={<Home className="w-5 h-5 text-sky-400" />}>
      {/* 施設一覧 */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {(
          [
            "inn",
            "market",
            "workshop",
            "blacksmith",
            "alchemy",
            "guild",
            "weapon_shop",
            "pharmacy",
          ] as const
        )
          .map((id) => facilities[id])
          .filter(Boolean)
          .map((fac) => {
            const isUnlocked = fac.level > 0;
            const canUpgrade = fac.level < fac.maxLevel;
            const goldCost = Math.floor(fac.upgradeCost.gold * costReduction);

            const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
              const reqCount = Math.floor(req.count * costReduction);
              return Math.floor(inventory[req.itemId] || 0) >= reqCount;
            });
            const canAffordUpgrade =
              gold >= goldCost && hasUpgradeMaterials && fac.upgradeTimeLeft === 0;

            // この施設でクラフト可能なアイテム (未建設の場合はLv.1で解放されるアイテムを表示)
            const craftableItems = getCraftableItemsForFacility(
              fac.id,
              fac.level > 0 ? fac.level : 1,
            );
            const expanded = isExpandedFn(fac.id);

            return (
              <div
                key={fac.id}
                onClick={() => toggleExpand(fac.id)}
                className={`border rounded-xl p-4 transition-all duration-200 ${
                  isUnlocked
                    ? "bg-slate-950/70 border-slate-800 hover:border-slate-700/80 cursor-pointer"
                    : "bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700/60 cursor-pointer"
                }`}
              >
                {/* 施設タイトル */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm sm:text-base">
                      {fac.name}
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                        {isUnlocked ? `Lv.${fac.level}` : "未建設"}
                      </span>
                    </h3>
                  </div>

                  {/* 操作・展開インジケーター */}
                  <div className="flex items-center gap-2">
                    {canUpgrade && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startFacilityUpgrade(fac.id);
                        }}
                        disabled={!canAffordUpgrade}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600/90 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] font-semibold transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        {fac.upgradeTimeLeft > 0 ? "工事中" : isUnlocked ? "強化" : "建設"}
                      </button>
                    )}
                    <span className="text-xs text-slate-500 font-mono ml-1">
                      {expanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* 工事中のプログレスバー (常に表示) */}
                {fac.upgradeTimeLeft > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>アップグレード進行中...</span>
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

                {/* 通常表示（折りたたみ時）の簡易ステータス表示 */}
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
                      ) : fac.craftQueue.length > 0 ? (
                        <>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          <span className="text-sky-400 font-bold">
                            加工中 ({fac.craftQueue.length}/3)
                          </span>
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

                {/* 拡張表示 (展開された時の詳細コンテンツ) */}
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-slate-900 space-y-3.5">
                    {/* 施設の概要説明 */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
                      {FACILITY_DESCRIPTIONS[fac.id]}
                    </p>

                    {/* 建設/強化コスト情報 */}
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

                    {/* クラフトレシピ一覧 */}
                    {craftableItems.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Hammer className="w-3 h-3 text-sky-400" />
                          {isUnlocked ? "生産レシピ (最大3枠)" : "解放される生産レシピ"}
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {craftableItems.map((item) => {
                            const recipe = getRecipeForItem(item.id)!;

                            return (
                              <div
                                key={item.id}
                                className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 flex flex-col gap-1"
                              >
                                <p className="text-xs font-bold text-slate-200">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  必要:{" "}
                                  {recipe.requiredItems
                                    .map((r) => `${ITEMS[r.itemId].name}x${r.count}`)
                                    .join(", ")}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  所要時間: {recipe.requiredTime}時間
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* クラフトキュー詳細進捗 */}
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

                    {/* 宿屋の機能説明 */}
                    {fac.id === "inn" && (
                      <p className="text-[10px] text-slate-400 italic leading-relaxed">
                        ※休息中の村人のHP/スタミナが 毎時間 HP +{10 + fac.level * 5}, スタミナ +
                        {15 + fac.level * 5} 回復します。
                      </p>
                    )}

                    {/* 冒険者ギルドの機能説明と雇用UI */}
                    {fac.id === "guild" && (
                      <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800 leading-relaxed">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-300 font-medium">
                            現在人数: <strong className="text-sky-400">{villagers.length}</strong> /{" "}
                            {Math.min(MAX_VILLAGERS_ABSOLUTE, 3 + fac.level * 2)} 人{" "}
                            {!isUnlocked && <span className="text-slate-400">(建設後: 5人)</span>}
                          </span>
                          {isUnlocked && <span className="text-slate-400">雇用コスト: 100 G</span>}
                        </div>

                        <p className="text-[10px] text-slate-400 leading-normal">
                          ギルドレベルに応じて雇用できる村人の上限が緩和されます。
                          <br />
                          ・Lv1: 最大5人 / ・Lv2: 最大7人 / ・Lv3: 最大9人 / ・Lv4以上: 最大10人
                        </p>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            hireVillager();
                          }}
                          disabled={
                            !isUnlocked ||
                            gold < 100 ||
                            villagers.length >= Math.min(MAX_VILLAGERS_ABSOLUTE, 3 + fac.level * 2)
                          }
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                          {!isUnlocked
                            ? "冒険者ギルドを建設すると雇用できます"
                            : villagers.length >=
                                Math.min(MAX_VILLAGERS_ABSOLUTE, 3 + fac.level * 2)
                              ? "雇用上限に達しています"
                              : "新しい冒険者を雇用する (100G)"}
                        </button>
                      </div>
                    )}

                    {/* 自動取引（交易所・武器屋・薬屋）設定UI */}
                    {(fac.id === "market" || fac.id === "weapon_shop" || fac.id === "pharmacy") &&
                      (() => {
                        const maxSlots =
                          fac.level === 1 ? 2 : fac.level === 2 ? 4 : fac.level >= 3 ? 8 : 0;

                        // 施設ごとの対象ルールをフィルタリング
                        const filteredRules = (tradeRules || []).filter((rule) => {
                          const item = ITEMS[rule.itemId];
                          if (!item) return false;
                          if (fac.id === "market") {
                            return rule.type === "buy";
                          }
                          if (fac.id === "weapon_shop") {
                            return (
                              rule.type === "sell" &&
                              (item.category === "gear_weapon" || item.category === "gear_armor")
                            );
                          }
                          if (fac.id === "pharmacy") {
                            return rule.type === "sell" && item.category === "consumable";
                          }
                          return false;
                        });

                        const usedSlots = filteredRules.length;
                        const shopName =
                          fac.id === "market"
                            ? "交易所"
                            : fac.id === "weapon_shop"
                              ? "武器屋"
                              : "薬屋";

                        return (
                          <div className="space-y-4 bg-slate-900/40 p-4 rounded-lg border border-slate-800">
                            {/* スロット情報 */}
                            <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                              <span className="font-semibold text-slate-200">
                                自動取引スロット ({shopName})
                              </span>
                              <span
                                className={`${usedSlots >= maxSlots ? "text-amber-500 font-bold" : "text-slate-400"}`}
                              >
                                {usedSlots} / {maxSlots} スロット使用中
                              </span>
                            </div>

                            {/* ルール一覧 */}
                            {filteredRules.length > 0 ? (
                              <div className="space-y-2">
                                {filteredRules.map((rule) => {
                                  const item = ITEMS[rule.itemId];
                                  if (!item) return null;
                                  return (
                                    <div
                                      key={rule.id}
                                      className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-lg border border-slate-850/80 hover:border-slate-800 transition-all text-xs"
                                    >
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-slate-200">
                                          {item.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {rule.type === "sell"
                                            ? `所持数 ${rule.threshold} 個超過時、最大 ${rule.amount} 個売却`
                                            : `所持数 ${rule.threshold} 個未満時、${rule.amount} 個購入`}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleTradeRule(rule.id);
                                          }}
                                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                                            rule.isEnabled
                                              ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/50"
                                              : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700"
                                          }`}
                                        >
                                          {rule.isEnabled ? "有効" : "無効"}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTradeRule(rule.id);
                                          }}
                                          className="px-2 py-1 rounded text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/40 hover:text-red-300 transition cursor-pointer"
                                        >
                                          削除
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic">
                                自動取引ルールが設定されていません。
                              </p>
                            )}

                            {/* ルール追加フォーム */}
                            {usedSlots < maxSlots ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="space-y-3 pt-3 border-t border-slate-800/60"
                              >
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  ルールの新規追加
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {/* アイテム選択 */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400 font-medium">
                                      アイテム
                                    </label>
                                    <select
                                      value={tradeItemId}
                                      onChange={(e) => setTradeItemId(e.target.value)}
                                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/80 cursor-pointer"
                                    >
                                      <option value="">アイテムを選択</option>
                                      {Object.values(ITEMS)
                                        .filter((item) => {
                                          if (fac.id === "market") {
                                            return (
                                              item.category !== "gear_weapon" &&
                                              item.category !== "gear_armor"
                                            );
                                          }
                                          if (fac.id === "weapon_shop") {
                                            return (
                                              item.category === "gear_weapon" ||
                                              item.category === "gear_armor"
                                            );
                                          }
                                          if (fac.id === "pharmacy") {
                                            return item.category === "consumable";
                                          }
                                          return false;
                                        })
                                        .map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  {/* 取引タイプ */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400 font-medium">
                                      取引タイプ
                                    </label>
                                    <select
                                      disabled
                                      value={fac.id === "market" ? "buy" : "sell"}
                                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none cursor-not-allowed opacity-80"
                                    >
                                      {fac.id === "market" ? (
                                        <option value="buy">購入 (不足分を買う)</option>
                                      ) : (
                                        <option value="sell">売却 (超過分を売る)</option>
                                      )}
                                    </select>
                                  </div>

                                  {/* 閾値 */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400 font-medium">
                                      {fac.id === "market"
                                        ? "閾値 (この個数未満時)"
                                        : "閾値 (この個数を超過時)"}
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={tradeThreshold}
                                      onChange={(e) =>
                                        setTradeThreshold(
                                          Math.max(0, parseInt(e.target.value) || 0),
                                        )
                                      }
                                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500/80 font-mono"
                                    />
                                  </div>

                                  {/* 取引量 */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400 font-medium">
                                      {fac.id === "market" ? "購入個数" : "売却制限数 (0で無制限)"}
                                    </label>
                                    <input
                                      type="number"
                                      min={fac.id === "market" ? "1" : "0"}
                                      value={tradeAmount}
                                      onChange={(e) =>
                                        setTradeAmount(
                                          Math.max(
                                            fac.id === "market" ? 1 : 0,
                                            parseInt(e.target.value) || 0,
                                          ),
                                        )
                                      }
                                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500/80 font-mono"
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!tradeItemId) return;
                                    const typeToUse = fac.id === "market" ? "buy" : "sell";
                                    addTradeRule(
                                      tradeItemId,
                                      typeToUse,
                                      tradeThreshold,
                                      tradeAmount,
                                    );
                                    // 追加後にリセット
                                    setTradeItemId("");
                                  }}
                                  disabled={!tradeItemId}
                                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                                >
                                  ルールを追加
                                </button>
                              </div>
                            ) : (
                              <div className="bg-amber-950/20 border border-amber-900/40 rounded p-2 text-[10px] text-amber-400">
                                ※スロットが満杯です。新しいルールを追加するには、既存のルールを削除してください。
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Panel>
  );
};
