import React, { useState } from 'react';
import { useGameStore, ITEMS } from '../store/gameStore';
import { Item } from '../types/game';
import { ShoppingBag, Target } from 'lucide-react';

export const InventoryPanel: React.FC = () => {
  const {
    inventory,
    targetAmounts,
    facilities,
    setTargetAmount,
    sellItem,
    currentTier,
    dungeons
  } = useGameStore();

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const getCategoryBadgeColor = (cat: Item['category']) => {
    switch (cat) {
      case 'food': return 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60';
      case 'ore': return 'bg-amber-950/60 text-amber-400 border border-amber-900/60';
      case 'herb': return 'bg-teal-950/60 text-teal-400 border border-teal-900/60';
      case 'mana_stone': return 'bg-purple-950/60 text-purple-400 border border-purple-900/60';
      case 'material': return 'bg-slate-800 text-slate-300 border border-slate-700';
      case 'gear_weapon': return 'bg-red-950/60 text-red-400 border border-red-900/60';
      case 'gear_armor': return 'bg-sky-950/60 text-sky-400 border border-sky-900/60';
      case 'consumable': return 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/60';
      default: return 'bg-slate-900 text-slate-400';
    }
  };

  const getCategoryLabel = (cat: Item['category']) => {
    switch (cat) {
      case 'food': return '食料';
      case 'ore': return '鉱石';
      case 'herb': return '薬草';
      case 'mana_stone': return '魔法石';
      case 'material': return '素材';
      case 'gear_weapon': return '武器';
      case 'gear_armor': return '防具';
      case 'consumable': return '消耗品';
    }
  };

  const isMarketUnlocked = facilities.market.level > 0;

  // このアイテムが使われるレシピを逆引き
  const getUsageRecipes = (itemId: string) => {
    return Object.values(ITEMS).filter(
      (item) => item.recipe?.requiredItems.some(req => req.itemId === itemId)
    );
  };

  // 製造または入手が可能か（現在所持しているか、解放エリアで採取・ドロップできるか、施設でクラフトできるか）
  const isItemAvailable = (item: Item) => {
    if ((inventory[item.id] || 0) > 0) return true;

    const isGatherable = dungeons.some((d) => {
      if (d.unlockedAtTier > currentTier) return false;
      return d.gathers.some((g) => {
        if (g.itemId !== item.id) return false;
        return d.explorationProgress >= (g.unlockedAtProgress || 0);
      });
    });
    if (isGatherable) return true;

    const isDroppable = dungeons.some((d) => {
      if (d.unlockedAtTier > currentTier) return false;
      return d.monsters.some((m) => {
        const isMonsUnlocked = d.explorationProgress >= (m.unlockedAtProgress || 0);
        if (!isMonsUnlocked) return false;
        return m.drops.some((drop) => drop.itemId === item.id);
      });
    });
    if (isDroppable) return true;

    if (item.recipe) {
      if (item.id === "wood_plank") {
        return (facilities.workshop?.level || 0) > 0;
      }
      if (item.id === "iron_ingot") {
        const isIronOreAvailable = (inventory["iron_ore"] || 0) > 0 || dungeons.some((d) => {
          if (d.unlockedAtTier > currentTier) return false;
          const canGather = d.gathers.some((g) => g.itemId === "iron_ore" && d.explorationProgress >= (g.unlockedAtProgress || 0));
          const canDrop = d.monsters.some((m) => 
            d.explorationProgress >= (m.unlockedAtProgress || 0) &&
            m.drops.some((dr) => dr.itemId === "iron_ore")
          );
          return canGather || canDrop;
        });
        return (facilities.workshop?.level || 0) > 0 && isIronOreAvailable;
      }
      if (item.id === "potion") {
        return (facilities.alchemy?.level || 0) > 0;
      }
      if (item.id === "iron_sword" || item.id === "iron_armor") {
        return (facilities.blacksmith?.level || 0) > 0;
      }
    }

    return false;
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-sky-400" />
        素材・倉庫アイテム
      </h2>

      {/* 倉庫一覧リスト */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {Object.values(ITEMS)
          .filter(isItemAvailable)
          .map((item) => {
            const currentCount = inventory[item.id] || 0;
            const target = targetAmounts[item.id] || 0;

          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-slate-950/80 border border-slate-850 hover:border-slate-750 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition cursor-pointer"
            >
              {/* 名前 & カテゴリ */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-sm truncate">{item.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${getCategoryBadgeColor(item.category)}`}>
                    {getCategoryLabel(item.category)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  所持数: <span className="text-slate-300 font-bold">{currentCount}</span>
                  {target > 0 && (
                    <span className="ml-2 text-sky-400">
                      (目標: {target}) {currentCount >= target ? '✓' : '不足'}
                    </span>
                  )}
                </div>
              </div>

              {/* 目標値 & 売却コントロール（イベントの伝播を防ぐ） */}
              <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                {/* 目標入力 */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5" title="自動生産の目標数">
                  <span className="text-[9px] text-slate-500 font-semibold select-none"><Target className="w-3 h-3" /></span>
                  <input
                    type="number"
                    value={target === 0 ? '' : target}
                    onChange={(e) => setTargetAmount(item.id, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-10 bg-transparent text-xs font-mono text-center text-sky-400 font-bold focus:outline-none"
                  />
                </div>

                {/* クイック売却（交易所解放時のみ） */}
                {isMarketUnlocked && (
                  <button
                    onClick={() => sellItem(item.id, 1)}
                    disabled={currentCount < 1}
                    className="px-2 py-1 bg-amber-600/10 hover:bg-amber-600/20 disabled:bg-transparent border border-amber-500/20 disabled:border-transparent text-amber-400 disabled:text-slate-600 font-medium rounded text-[10px] transition cursor-pointer"
                  >
                    売1
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 詳細モーダル */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedItem(null)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-100">{selectedItem.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getCategoryBadgeColor(selectedItem.category)}`}>
                  {getCategoryLabel(selectedItem.category)}
                </span>
              </div>
              {selectedItem.description && (
                <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-slate-950 p-2.5 rounded border border-slate-850">
                  {selectedItem.description}
                </p>
              )}
            </div>

             {/* 所持数 & 目標設定セクション */}
             <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 space-y-2.5">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-400">現在の所持数:</span>
                 <span className="text-slate-100 font-bold font-mono text-sm">
                   {inventory[selectedItem.id] || 0} 個
                 </span>
               </div>
               <div className="flex flex-col gap-2 border-t border-slate-900 pt-2.5">
                 <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-400 flex items-center gap-1">
                     <Target className="w-3.5 h-3.5 text-sky-400" /> 自動生産目標数:
                   </span>
                   <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-1">
                     <input
                       type="number"
                       value={targetAmounts[selectedItem.id] === 0 ? '' : targetAmounts[selectedItem.id]}
                       onChange={(e) => setTargetAmount(selectedItem.id, parseInt(e.target.value) || 0)}
                       placeholder="0"
                       className="w-16 bg-transparent text-xs font-mono text-right text-sky-400 font-bold focus:outline-none"
                     />
                     <span className="text-[10px] text-slate-500 font-mono">個</span>
                   </div>
                 </div>
                 {/* 目標数調整ボタン */}
                 <div className="flex gap-1.5 justify-end">
                   <button
                     onClick={() => setTargetAmount(selectedItem.id, 0)}
                     className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-[10px] font-medium transition cursor-pointer"
                   >
                     リセット
                   </button>
                   <button
                     onClick={() => {
                       const cur = targetAmounts[selectedItem.id] || 0;
                       setTargetAmount(selectedItem.id, cur + 1);
                     }}
                     className="px-2 py-1 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 rounded text-[10px] font-bold transition cursor-pointer"
                   >
                     +1
                   </button>
                   <button
                     onClick={() => {
                       const cur = targetAmounts[selectedItem.id] || 0;
                       setTargetAmount(selectedItem.id, cur + 10);
                     }}
                     className="px-2 py-1 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 rounded text-[10px] font-bold transition cursor-pointer"
                   >
                     +10
                   </button>
                   <button
                     onClick={() => {
                       const cur = targetAmounts[selectedItem.id] || 0;
                       setTargetAmount(selectedItem.id, cur + 100);
                     }}
                     className="px-2 py-1 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 text-sky-400 rounded text-[10px] font-bold transition cursor-pointer"
                   >
                     +100
                   </button>
                 </div>
               </div>
             </div>

            {/* 価格・用途情報 */}
            <div className="space-y-2.5 text-xs border-t border-slate-800 pt-3.5">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">売却価格 (交易所):</span>
                <span className="text-amber-400 font-bold">{selectedItem.sellPrice} G</span>
              </div>

              {selectedItem.recipe && (
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-1">
                  <span className="font-semibold text-slate-400 block mb-1">クラフトレシピ:</span>
                  <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
                    {selectedItem.recipe.requiredItems.map(req => (
                      <p key={req.itemId}>• {ITEMS[req.itemId]?.name} x {req.count}</p>
                    ))}
                    <p className="text-slate-500 mt-1">所要時間: {selectedItem.recipe.requiredTime}時間</p>
                  </div>
                </div>
              )}

              {/* 用途（逆引きレシピ） */}
              {getUsageRecipes(selectedItem.id).length > 0 && (
                <div>
                  <span className="font-semibold text-slate-500 block mb-1">主な使い道 (クラフト材料):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {getUsageRecipes(selectedItem.id).map(r => (
                      <span key={r.id} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 交易所取引セクション */}
            {isMarketUnlocked && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">取引 (交易所)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => sellItem(selectedItem.id, 1)}
                    disabled={(inventory[selectedItem.id] || 0) < 1}
                    className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-semibold text-xs rounded transition cursor-pointer"
                  >
                    1個売る
                  </button>
                  <button
                    onClick={() => sellItem(selectedItem.id, 10)}
                    disabled={(inventory[selectedItem.id] || 0) < 10}
                    className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-semibold text-xs rounded transition cursor-pointer"
                  >
                    10個売る
                  </button>
                  <button
                    onClick={() => sellItem(selectedItem.id, inventory[selectedItem.id] || 0)}
                    disabled={!(inventory[selectedItem.id] > 0)}
                    className="flex-1 py-1.5 bg-amber-650 hover:bg-amber-500 disabled:bg-slate-850 disabled:text-slate-600 text-white font-semibold text-xs rounded transition cursor-pointer"
                  >
                    全部売る
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
