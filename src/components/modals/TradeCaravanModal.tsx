import { Truck, TrendingUp, Coins, Shield } from "lucide-react";
import React, { useState } from "react";

import { ITEMS } from "../../data/masterData";
import { getTownShopItems } from "../../data/towns";
import { useGameStore } from "../../store/gameStore";
import { Town } from "../../types/game";
import { getMarketSellBonus } from "../../utils/marketHelpers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ProgressBar } from "../ui/ProgressBar";

interface TradeCaravanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeCaravanModal: React.FC<TradeCaravanModalProps> = ({ isOpen, onClose }) => {
  const state = useGameStore();
  const {
    gold,
    inventory,
    towns,
    caravans,
    marketTrend,
    facilities,
    sendExportCaravan,
    sendImportCaravan,
    collectCaravan,
    investInTown,
  } = state;

  const marketLvl = facilities.market?.level || 0;
  const maxCaravans = marketLvl === 1 ? 1 : marketLvl === 2 ? 2 : 3;

  const [activeTab, setActiveTab] = useState<"caravans" | "towns">("caravans");
  const [selectedCaravanId, setSelectedCaravanId] = useState<string | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<string>("komorebi");
  const [tradeMode, setTradeMode] = useState<"export" | "import">("export");

  // 輸出用カーゴの状態 { itemId: count }
  const [exportCargo, setExportCargo] = useState<Record<string, number>>({});
  // 輸入用カーゴの状態 { itemId: count }
  const [importCargo, setImportCargo] = useState<Record<string, number>>({});

  const activeTown = towns.find((t) => t.id === selectedTownId);

  // 積載上限
  const getCargoLimit = (town: Town) => {
    return 15 + (town.investLevel - 1) * 10;
  };

  // 仕入れ価格の計算 (売値の3倍がベース、友好度Lvとソウル割引で最大40%引き)
  const getImportPrice = (itemId: string, town: Town) => {
    const item = ITEMS[itemId];
    if (!item) return 0;
    const basePrice = item.basePrice * 3;
    const discountLvl = state.soulUpgrades.discount || 0;
    const rate = 1 - (town.level - 1) * 0.05 - discountLvl * 0.05;
    return Math.max(1, Math.floor(basePrice * rate));
  };

  // 輸出総額と友好度上昇量の推定
  const calculateExportEstimates = () => {
    if (!activeTown) return { gold: 0, friendship: 0, count: 0 };
    let totalGold = 0;
    let totalFriendship = 0;
    let totalCount = 0;

    const marketBonus = getMarketSellBonus(marketLvl);

    Object.entries(exportCargo).forEach(([itemId, count]) => {
      const item = ITEMS[itemId];
      if (!item || count <= 0) return;

      let price = item.basePrice;
      const isTrend =
        marketTrend && marketTrend.targetTownId === activeTown.id && marketTrend.itemId === itemId;

      if (isTrend && marketTrend?.type === "demand") {
        price = Math.floor(price * marketTrend.multiplier);
      }

      const friendshipBonus = (activeTown.level - 1) * 0.05;
      const finalPrice = Math.floor(price * (1 + marketBonus + friendshipBonus)) * count;

      totalGold += finalPrice;
      totalFriendship += count * (isTrend ? 2 : 1);
      totalCount += count;
    });

    return { gold: totalGold, friendship: totalFriendship, count: totalCount };
  };

  // 輸入の総額と積載量の推定
  const calculateImportEstimates = () => {
    if (!activeTown) return { gold: 0, count: 0 };
    let totalGold = 0;
    let totalCount = 0;

    Object.entries(importCargo).forEach(([itemId, count]) => {
      if (count <= 0) return;
      const price = getImportPrice(itemId, activeTown);
      totalGold += price * count;
      totalCount += count;
    });

    return { gold: totalGold, count: totalCount };
  };

  const exportEstimates = calculateExportEstimates();
  const importEstimates = calculateImportEstimates();

  const handleStartExport = () => {
    if (!selectedCaravanId || !activeTown) return;
    const cargoList = Object.entries(exportCargo)
      .filter(([_, count]) => count > 0)
      .map(([itemId, count]) => ({ itemId, count }));

    if (cargoList.length === 0) return;

    sendExportCaravan(selectedCaravanId, activeTown.id, cargoList);
    // 状態クリア
    setExportCargo({});
    setSelectedCaravanId(null);
  };

  const handleStartImport = () => {
    if (!selectedCaravanId || !activeTown) return;
    const cargoList = Object.entries(importCargo)
      .filter(([_, count]) => count > 0)
      .map(([itemId, count]) => ({ itemId, count }));

    if (cargoList.length === 0) return;

    sendImportCaravan(selectedCaravanId, activeTown.id, cargoList, importEstimates.gold);
    // 状態クリア
    setImportCargo({});
    setSelectedCaravanId(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      showCloseButton
      title={
        <div className="flex items-center gap-2 text-slate-100 font-bold">
          <Truck className="w-5 h-5 text-sky-400" />
          <span>外の町との交易管理（交易所 Lv.{marketLvl}）</span>
        </div>
      }
    >
      <div className="flex gap-4 border-b border-slate-800 pb-3 mb-4 text-sm font-semibold select-none">
        <button
          onClick={() => setActiveTab("caravans")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            activeTab === "caravans"
              ? "bg-sky-600 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          交易馬車
        </button>
        <button
          onClick={() => setActiveTab("towns")}
          className={`px-3 py-1 rounded-md transition cursor-pointer ${
            activeTab === "towns" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          交易先と投資
        </button>

        {/* トレンドの表示 */}
        {marketTrend && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-amber-950/40 border border-amber-900/60 rounded-lg text-xs text-amber-300 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              トレンド：
              {towns.find((t) => t.id === marketTrend.targetTownId)?.name}にて 「
              {ITEMS[marketTrend.itemId]?.name}」が {marketTrend.multiplier}倍 で取引中！
            </span>
          </div>
        )}
      </div>

      {activeTab === "caravans" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-120 min-h-0 overflow-hidden font-sans">
          {/* 馬車リスト */}
          <div className="lg:col-span-1 border border-slate-800 rounded-xl p-4 bg-slate-950/40 flex flex-col gap-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              交易馬車スロット
            </h3>
            {caravans.slice(0, maxCaravans).map((caravan, index) => {
              const townName = towns.find((t) => t.id === caravan.destinationTownId)?.name || "";
              const isSelected = selectedCaravanId === caravan.id;

              return (
                <div
                  key={caravan.id}
                  onClick={() => caravan.status === "idle" && setSelectedCaravanId(caravan.id)}
                  className={`border rounded-lg p-3 transition cursor-pointer ${
                    caravan.status === "idle"
                      ? isSelected
                        ? "border-sky-500 bg-sky-950/20"
                        : "border-slate-850 bg-slate-900/40 hover:border-slate-700"
                      : "border-slate-900 bg-slate-950/20 cursor-default"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-300">馬車 #{index + 1}</span>
                    {caravan.status === "idle" && (
                      <Badge variant="info" className="text-[10px]">
                        待機中
                      </Badge>
                    )}
                    {caravan.status === "trading" && (
                      <Badge variant="warning" className="text-[10px] animate-pulse">
                        交易中
                      </Badge>
                    )}
                    {caravan.status === "returned" && (
                      <Badge variant="success" className="text-[10px]">
                        帰還
                      </Badge>
                    )}
                  </div>

                  {caravan.status === "trading" && (
                    <div className="space-y-1 mt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{townName} 往復中</span>
                        <span>残り {caravan.timeLeft}時間</span>
                      </div>
                      <ProgressBar
                        value={caravan.totalTime - caravan.timeLeft}
                        max={caravan.totalTime}
                        height={1}
                        color="amber"
                      />
                    </div>
                  )}

                  {caravan.status === "returned" && (
                    <div className="mt-3">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          collectCaravan(caravan.id);
                        }}
                        variant="success"
                        size="sm"
                        className="w-full text-xs"
                      >
                        報告を受け取る
                      </Button>
                    </div>
                  )}

                  {caravan.status === "idle" && (
                    <div className="text-[10px] text-slate-500 mt-1 italic">
                      クリックして派遣を指示
                    </div>
                  )}

                  {/* 自動交易トグル */}
                  <div className="mt-3 pt-2.5 border-t border-slate-900/60 flex items-center justify-between select-none">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      自動交易
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={caravan.isAuto}
                        onChange={(e) => {
                          e.stopPropagation();
                          state.toggleCaravanAuto(caravan.id);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 派遣設定 */}
          <div className="lg:col-span-2 border border-slate-800 rounded-xl p-4 bg-slate-950/20 flex flex-col overflow-hidden">
            {selectedCaravanId ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900 select-none">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">
                      馬車 #{caravans.findIndex((c) => c.id === selectedCaravanId) + 1} の派遣計画
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      交易先と取引品目を選択してください
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedCaravanId(null);
                      setExportCargo({});
                      setImportCargo({});
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    キャンセル
                  </Button>
                </div>

                {/* 交易先とモード選択 */}
                <div className="grid grid-cols-2 gap-4 mb-4 select-none">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      交易先
                    </label>
                    <select
                      value={selectedTownId}
                      onChange={(e) => {
                        setSelectedTownId(e.target.value);
                        setExportCargo({});
                        setImportCargo({});
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      {towns.map((t) => (
                        <option key={t.id} value={t.id} disabled={!t.isUnlocked}>
                          {t.name} {!t.isUnlocked ? " (未解放)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      取引形態
                    </label>
                    <div className="flex border border-slate-800 rounded-lg p-0.5 bg-slate-900">
                      <button
                        onClick={() => setTradeMode("export")}
                        className={`flex-1 text-center py-1.5 text-xs rounded-md font-medium transition cursor-pointer ${
                          tradeMode === "export"
                            ? "bg-sky-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        輸出 (売却)
                      </button>
                      <button
                        onClick={() => setTradeMode("import")}
                        className={`flex-1 text-center py-1.5 text-xs rounded-md font-medium transition cursor-pointer ${
                          tradeMode === "import"
                            ? "bg-sky-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        輸入 (仕入れ)
                      </button>
                    </div>
                  </div>
                </div>

                {/* 派遣設定のメイン部分 */}
                {activeTown && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-850/60 mb-4 text-xs text-slate-300 flex justify-between items-center select-none">
                      <div>
                        <span className="font-semibold text-slate-200">{activeTown.name}</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          往復: {activeTown.distance}時間 (投資効果で短縮可能)
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <span>
                          友好度:{" "}
                          <span className="font-semibold text-sky-400">Lv.{activeTown.level}</span>
                        </span>
                        <span>
                          積載上限:{" "}
                          <span className="font-semibold text-amber-400">
                            {getCargoLimit(activeTown)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      {tradeMode === "export" ? (
                        /* 輸出アイテムの選択 */
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            倉庫から積み込む（輸出可能なアイテム）
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(inventory)
                              .filter(([_, count]) => count > 0)
                              .map(([itemId, count]) => {
                                const item = ITEMS[itemId];
                                if (!item) return null;
                                const loaded = exportCargo[itemId] || 0;
                                const isTrend =
                                  marketTrend &&
                                  marketTrend.targetTownId === activeTown.id &&
                                  marketTrend.itemId === itemId;

                                return (
                                  <div
                                    key={itemId}
                                    className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                        {item.name}
                                        {isTrend && (
                                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.2 rounded font-mono">
                                            特需!
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        倉庫: {count} / 積載: {loaded}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 select-none">
                                      <button
                                        onClick={() =>
                                          setExportCargo((prev) => ({
                                            ...prev,
                                            [itemId]: Math.max(0, loaded - 1),
                                          }))
                                        }
                                        className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-850 cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <button
                                        onClick={() => {
                                          const totalLoaded = Object.values(exportCargo).reduce(
                                            (a, b) => a + b,
                                            0,
                                          );
                                          if (
                                            totalLoaded < getCargoLimit(activeTown) &&
                                            loaded < count
                                          ) {
                                            setExportCargo((prev) => ({
                                              ...prev,
                                              [itemId]: loaded + 1,
                                            }));
                                          }
                                        }}
                                        className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-850 cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        /* 輸入アイテムの選択 */
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            友好度ショップ（仕入れ商品）
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {getTownShopItems(activeTown.id, activeTown.level).map((itemId) => {
                              const item = ITEMS[itemId];
                              if (!item) return null;
                              const loaded = importCargo[itemId] || 0;
                              const buyPrice = getImportPrice(itemId, activeTown);

                              return (
                                <div
                                  key={itemId}
                                  className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-200">{item.name}</p>
                                    <p className="text-[10px] text-amber-500 font-mono mt-0.5 flex items-center gap-0.5">
                                      <Coins className="w-3 h-3" />
                                      {buyPrice} G / 1個
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-mono">
                                      仕入れ注文数: {loaded}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 select-none">
                                    <button
                                      onClick={() =>
                                        setImportCargo((prev) => ({
                                          ...prev,
                                          [itemId]: Math.max(0, loaded - 1),
                                        }))
                                      }
                                      className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-850 cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => {
                                        const totalLoaded = Object.values(importCargo).reduce(
                                          (a, b) => a + b,
                                          0,
                                        );
                                        if (totalLoaded < getCargoLimit(activeTown)) {
                                          setImportCargo((prev) => ({
                                            ...prev,
                                            [itemId]: loaded + 1,
                                          }));
                                        }
                                      }}
                                      className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-850 cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 派遣実行フッター */}
                    <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center select-none bg-slate-950/30 p-3 rounded-lg">
                      {tradeMode === "export" ? (
                        <>
                          <div className="text-xs space-y-0.5 text-slate-400">
                            <div>
                              積み込み数:{" "}
                              <span className="font-semibold text-slate-200">
                                {exportEstimates.count} / {getCargoLimit(activeTown)}
                              </span>
                            </div>
                            <div>
                              推定売上:{" "}
                              <span className="font-semibold text-amber-500">
                                {exportEstimates.gold} G
                              </span>
                            </div>
                            <div>
                              獲得友好度:{" "}
                              <span className="font-semibold text-sky-400">
                                +{exportEstimates.friendship}
                              </span>
                            </div>
                          </div>
                          <Button
                            onClick={handleStartExport}
                            disabled={exportEstimates.count === 0}
                            variant="primary"
                            size="md"
                          >
                            輸出馬車を派遣する
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="text-xs space-y-0.5 text-slate-400">
                            <div>
                              注文数:{" "}
                              <span className="font-semibold text-slate-200">
                                {importEstimates.count} / {getCargoLimit(activeTown)}
                              </span>
                            </div>
                            <div>
                              合計仕入れ費用:{" "}
                              <span
                                className={`font-semibold ${gold >= importEstimates.gold ? "text-amber-500" : "text-red-500"}`}
                              >
                                {importEstimates.gold} G
                              </span>
                            </div>
                            <div className="text-[9px]">所持: {gold} G</div>
                          </div>
                          <Button
                            onClick={handleStartImport}
                            disabled={importEstimates.count === 0 || gold < importEstimates.gold}
                            variant="primary"
                            size="md"
                          >
                            仕入れ馬車を派遣する
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-slate-500 select-none">
                <Truck className="w-16 h-16 text-slate-800 mb-3" />
                <p className="text-sm font-semibold">
                  左側の「待機中」の交易馬車を選択してください
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  目的地を選択して、アイテムの売買が行えます
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "towns" && (
        <div className="h-120 overflow-y-auto pr-1 space-y-6 font-sans">
          {towns.map((town) => {
            const isKomorebi = town.id === "komorebi";

            return (
              <div
                key={town.id}
                className={`border rounded-xl p-5 ${
                  town.isUnlocked
                    ? "bg-slate-950/40 border-slate-800"
                    : "bg-slate-950/10 border-slate-900 opacity-60"
                }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 select-none">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      {town.name}
                      {town.isUnlocked ? (
                        <Badge variant="success" className="text-[10px]">
                          往路: {town.distance}h
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          未発見
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                      {town.description}
                    </p>
                  </div>

                  {town.isUnlocked && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          投資レベル {town.investLevel}
                        </div>
                        <div className="text-xs text-slate-300 font-mono mt-0.5">
                          次コスト: {town.investCost} G
                        </div>
                      </div>
                      <Button
                        onClick={() => investInTown(town.id)}
                        disabled={gold < town.investCost}
                        variant="primary"
                        size="sm"
                      >
                        投資する
                      </Button>
                    </div>
                  )}
                </div>

                {town.isUnlocked ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-900 select-none">
                    {/* 友好度ステータス */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">町との友好関係</span>
                        <span className="text-sky-400 font-bold">レベル {town.level}</span>
                      </div>

                      <div className="space-y-1">
                        <ProgressBar value={town.friendship} max={1000} height={1.5} color="sky" />
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>現在: {town.friendship} pt</span>
                          <span>MAX: 1000 pt</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/30 p-2.5 rounded-lg border border-slate-850/50">
                        ※友好レベルが上がると、仕入れショップに新しい品物が追加されます。
                        また、友好度に応じて輸出時の買取価格にボーナスがつきます（現在:{" "}
                        <span className="text-emerald-400">+{(town.level - 1) * 5}%</span>）。
                      </p>
                    </div>

                    {/* 特産品と仕入れ可能リスト */}
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-400">
                        友好度での仕入れ解放アイテム
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {town.specialties.map((itemId) => {
                          const item = ITEMS[itemId];
                          if (!item) return null;

                          // 解放レベルを簡易推測
                          let unlockLvl = 1;
                          if (town.id === "komorebi") {
                            if (itemId === "wood_plank") unlockLvl = 2;
                            else if (itemId === "leather_cloak") unlockLvl = 3;
                            else if (itemId === "ancient_bark") unlockLvl = 4;
                            else if (itemId === "elixir") unlockLvl = 5;
                          } else if (town.id === "ironport") {
                            if (itemId === "iron_ingot") unlockLvl = 2;
                            else if (["iron_sword", "iron_armor"].includes(itemId)) unlockLvl = 3;
                            else if (["silver_ore", "silver_ingot"].includes(itemId)) unlockLvl = 4;
                            else if (["silver_rapier", "silver_chainmail"].includes(itemId))
                              unlockLvl = 5;
                          } else if (town.id === "magica") {
                            if (["mana_stone", "stamina_drink"].includes(itemId)) unlockLvl = 2;
                            else if (["potion", "mid_potion"].includes(itemId)) unlockLvl = 3;
                            else if (["dark_crystal", "wooden_staff"].includes(itemId))
                              unlockLvl = 4;
                            else if (["mythril_staff", "mythril_robe"].includes(itemId))
                              unlockLvl = 5;
                          }

                          const isReleased = town.level >= unlockLvl;

                          return (
                            <span
                              key={itemId}
                              className={`text-[10px] font-medium px-2 py-1 rounded-md border font-sans ${
                                isReleased
                                  ? "bg-slate-900 border-slate-800 text-slate-300"
                                  : "bg-slate-950/80 border-dashed border-slate-900 text-slate-600"
                              }`}
                            >
                              {item.name} {!isReleased && `(Lv.${unlockLvl}解放)`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium py-3 border-t border-slate-900/60 select-none">
                    <Shield className="w-4 h-4 text-slate-600" />
                    <span>
                      この町を訪問するには、村の開拓 Tier を上げてください（解放Tier:{" "}
                      {isKomorebi ? 1 : town.id === "ironport" ? 2 : 3}）。
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
