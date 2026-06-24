import { Truck } from "lucide-react";
import React, { useState } from "react";
import { shallow } from "zustand/shallow";

import { useGameStore } from "../../store/gameStore";
import {
  calculateExportEstimates,
  calculateImportEstimates,
  getCargoLimit,
} from "../../utils/tradeHelpers";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CaravanSlotList } from "./CaravanSlotList";
import { ExportCargoSelector } from "./ExportCargoSelector";
import { ImportCargoSelector } from "./ImportCargoSelector";
import { TownInfoPanel } from "./TownInfoPanel";

interface TradeCaravanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TradeCaravanModal: React.FC<TradeCaravanModalProps> = ({ isOpen, onClose }) => {
  const gold = useGameStore((s) => s.gold);
  const inventory = useGameStore((s) => s.inventory);
  const towns = useGameStore((s) => s.towns);
  const caravans = useGameStore((s) => s.caravans);
  const facilities = useGameStore((s) => s.facilities);

  const { sendExportCaravan, sendImportCaravan, collectCaravan, investInTown, toggleCaravanAuto } =
    useGameStore(
      (s) => ({
        sendExportCaravan: s.sendExportCaravan,
        sendImportCaravan: s.sendImportCaravan,
        collectCaravan: s.collectCaravan,
        investInTown: s.investInTown,
        toggleCaravanAuto: s.toggleCaravanAuto,
      }),
      shallow,
    );

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

  const soulUpgrades = useGameStore((s) => s.soulUpgrades);
  const discountLvl = soulUpgrades.discount || 0;

  const exportEstimates = activeTown
    ? calculateExportEstimates(activeTown, exportCargo, marketLvl)
    : { gold: 0, count: 0 };
  const importEstimates = activeTown
    ? calculateImportEstimates(activeTown, importCargo, discountLvl)
    : { gold: 0, count: 0 };

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
      </div>

      {activeTab === "caravans" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-120 min-h-0 overflow-hidden font-sans">
          {/* 馬車リスト */}
          <CaravanSlotList
            caravans={caravans.slice(0, maxCaravans)}
            towns={towns}
            selectedCaravanId={selectedCaravanId}
            onSelectCaravan={setSelectedCaravanId}
            onCollect={collectCaravan}
            onToggleAuto={toggleCaravanAuto}
          />

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
                          積載上限:{" "}
                          <span className="font-semibold text-amber-400">
                            {getCargoLimit(activeTown)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      {tradeMode === "export" ? (
                        <ExportCargoSelector
                          inventory={inventory}
                          exportCargo={exportCargo}
                          activeTown={activeTown}
                          marketLvl={marketLvl}
                          discountLvl={discountLvl}
                          onAdd={(itemId) =>
                            setExportCargo((prev) => ({
                              ...prev,
                              [itemId]: (prev[itemId] || 0) + 1,
                            }))
                          }
                          onRemove={(itemId) =>
                            setExportCargo((prev) => ({
                              ...prev,
                              [itemId]: Math.max(0, (prev[itemId] || 0) - 1),
                            }))
                          }
                          onSetQuantity={(itemId, count) =>
                            setExportCargo((prev) => ({ ...prev, [itemId]: count }))
                          }
                        />
                      ) : (
                        <ImportCargoSelector
                          importCargo={importCargo}
                          activeTown={activeTown}
                          marketLvl={marketLvl}
                          discountLvl={discountLvl}
                          onAdd={(itemId) =>
                            setImportCargo((prev) => ({
                              ...prev,
                              [itemId]: (prev[itemId] || 0) + 1,
                            }))
                          }
                          onRemove={(itemId) =>
                            setImportCargo((prev) => ({
                              ...prev,
                              [itemId]: Math.max(0, (prev[itemId] || 0) - 1),
                            }))
                          }
                          onSetQuantity={(itemId, count) =>
                            setImportCargo((prev) => ({ ...prev, [itemId]: count }))
                          }
                        />
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

      {activeTab === "towns" && <TownInfoPanel towns={towns} gold={gold} onInvest={investInTown} />}
    </Modal>
  );
};
