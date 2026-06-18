import React, { useState } from 'react';
import { useGameStore, JOBS, ITEMS } from '../store/gameStore';
import { JobType, Villager } from '../types/game';
import { User, Shield, Sword, Heart, Zap, RefreshCw, CheckCircle } from 'lucide-react';

export const VillagerList: React.FC = () => {
  const { villagers, gold, inventory, changeVillagerJob, equipItem, unequipItem, setVillagerOrder, soulUpgrades } = useGameStore();
  const [selectedVillager, setSelectedVillager] = useState<Villager | null>(null);
  const [activeModal, setActiveModal] = useState<'job' | 'equip' | null>(null);

  const discountLvl = soulUpgrades.discount || 0;
  const discountRate = 1 - discountLvl * 0.1;

  const openJobModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal('job');
  };

  const openEquipModal = (v: Villager) => {
    setSelectedVillager(v);
    setActiveModal('equip');
  };

  const handleJobChange = (job: JobType) => {
    if (selectedVillager) {
      changeVillagerJob(selectedVillager.id, job);
      setActiveModal(null);
    }
  };

  const handleEquip = (itemId: string, slot: 'weapon' | 'armor') => {
    if (selectedVillager) {
      equipItem(selectedVillager.id, itemId, slot);
      setActiveModal(null);
    }
  };

  const handleUnequip = (slot: 'weapon' | 'armor') => {
    if (selectedVillager) {
      unequipItem(selectedVillager.id, slot);
      setActiveModal(null);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-sky-400" />
        村人・AI指示一覧 ({villagers.length}/10)
      </h2>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {villagers.map((v) => (
          <div
            key={v.id}
            className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-lg p-4 transition duration-200"
          >
            {/* 名前と職業 */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-bold text-slate-100">{v.name}</span>
                <span className="text-xs text-slate-400 font-mono ml-2">Lv.{v.level}</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 font-medium">
                    {v.currentJob}
                  </span>
                  <button
                    onClick={() => openJobModal(v)}
                    className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition"
                    title="転職する"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 現在の状態 */}
              <div className="text-right">
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                    v.status === 'idle'
                      ? 'bg-slate-800 text-slate-400'
                      : v.status === 'resting'
                      ? 'bg-emerald-950/80 border border-emerald-900 text-emerald-400'
                      : v.status === 'active'
                      ? 'bg-red-950/80 border border-red-900 text-red-400'
                      : 'bg-amber-950/80 border border-amber-900 text-amber-400'
                  }`}
                >
                  {v.status === 'idle'
                    ? '村・待機'
                    : v.status === 'resting'
                    ? '休息中'
                    : v.status === 'active'
                    ? '活動中'
                    : v.status === 'traveling_to'
                    ? '現地移動中'
                    : '帰還中'}
                </span>
                {v.status === 'traveling_to' && (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">到着まで {v.travelTimeLeft}h</p>
                )}
                {v.status === 'traveling_back' && (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">帰還まで {v.travelTimeLeft}h</p>
                )}
              </div>
            </div>

            {/* HP & スタミナ */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-red-500" /> HP
                </span>
                <span className="text-slate-200">
                  {v.currentHp} / {v.maxHp}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(v.currentHp / v.maxHp) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> スタミナ
                </span>
                <span className="text-slate-200">{v.stamina} / 100</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${v.stamina}%` }}
                />
              </div>
            </div>

            {/* ステータス & 装備 */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3 border-t border-slate-900 pt-2.5">
              <div className="space-y-0.5 text-[11px] font-mono text-slate-400">
                <p>STR (腕力): <span className="text-slate-200 font-bold">{v.str}</span></p>
                <p>INT (魔力): <span className="text-slate-200 font-bold">{v.int}</span></p>
                <p>DEX (器用): <span className="text-slate-200 font-bold">{v.dex}</span></p>
                <p>AGI (敏捷): <span className="text-slate-200 font-bold">{v.agi}</span></p>
              </div>

              {/* 装備ボタン */}
              <div className="flex flex-col gap-1.5 justify-center">
                <button
                  onClick={() => openEquipModal(v)}
                  className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                >
                  <span className="flex items-center gap-1 text-[10px]">
                    <Sword className="w-3 h-3 text-amber-500" />
                    {v.weaponId !== 'none' ? ITEMS[v.weaponId].name : '武器なし'}
                  </span>
                </button>
                <button
                  onClick={() => openEquipModal(v)}
                  className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition"
                >
                  <span className="flex items-center gap-1 text-[10px]">
                    <Shield className="w-3 h-3 text-sky-400" />
                    {v.armorId !== 'none' ? ITEMS[v.armorId].name : '防具なし'}
                  </span>
                </button>
              </div>
            </div>

            {/* 手動休息ボタン */}
            {v.status === 'idle' && (
              <button
                onClick={() => setVillagerOrder(v.id, 'rest', null)}
                className="w-full py-1 text-center rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                宿屋で休ませる
              </button>
            )}
            {v.status === 'resting' && (
              <button
                onClick={() => setVillagerOrder(v.id, 'gather', null)}
                className="w-full py-1 text-center rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                休息を切り上げて待機にする
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 転職モーダル */}
      {activeModal === 'job' && selectedVillager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">{selectedVillager.name} の転職先を選択</h3>
              <p className="text-xs text-slate-400">※すでに転職済みの職業への再変更コストは 0G になります。</p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(Object.keys(JOBS) as JobType[]).map((jobKey) => {
                const job = JOBS[jobKey];
                const isHistory = selectedVillager.jobHistory.includes(jobKey);
                const cost = isHistory ? 0 : Math.floor(job.cost * discountRate);
                const canAfford = gold >= cost;
                const isCurrent = selectedVillager.currentJob === jobKey;

                return (
                  <div
                    key={jobKey}
                    className={`border rounded-lg p-3 flex justify-between items-center ${
                      isCurrent
                        ? 'border-sky-500 bg-sky-950/20'
                        : 'border-slate-800 bg-slate-950/50 hover:bg-slate-950'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-200">{jobKey}</span>
                        {isHistory && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                            習得済
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{job.description}</p>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span className="text-xs text-sky-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 現在
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJobChange(jobKey)}
                          disabled={!canAfford}
                          className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs transition"
                        >
                          {cost === 0 ? '無料' : `${cost} G`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 装備モーダル */}
      {activeModal === 'equip' && selectedVillager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">{selectedVillager.name} の装備変更</h3>
              <p className="text-xs text-slate-400">現在装備: 武器({selectedVillager.weaponId !== 'none' ? ITEMS[selectedVillager.weaponId].name : 'なし'}), 防具({selectedVillager.armorId !== 'none' ? ITEMS[selectedVillager.armorId].name : 'なし'})</p>
            </div>

            <div className="space-y-4">
              {/* 武器一覧 */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">武器 (攻撃UP)</h4>
                <div className="space-y-2">
                  {/* 装備なし */}
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                    <span className="text-xs text-slate-400">装備なし</span>
                    {selectedVillager.weaponId !== 'none' ? (
                      <button
                        onClick={() => handleUnequip('weapon')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                      >
                        外す
                      </button>
                    ) : (
                      <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                    )}
                  </div>

                  {/* 倉庫内の武器 */}
                  {Object.entries(ITEMS)
                    .filter(([_, item]) => item.category === 'gear_weapon')
                    .map(([itemId, item]) => {
                      const count = inventory[itemId] || 0;
                      const isEquipped = selectedVillager.weaponId === itemId;

                      return (
                        <div
                          key={itemId}
                          className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-200">{item.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">倉庫在庫: {count}個</p>
                          </div>
                          {isEquipped ? (
                            <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                          ) : (
                            <button
                              onClick={() => handleEquip(itemId, 'weapon')}
                              disabled={count <= 0}
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                            >
                              装備
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 防具一覧 */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">防具 (防御UP)</h4>
                <div className="space-y-2">
                  {/* 装備なし */}
                  <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded">
                    <span className="text-xs text-slate-400">装備なし</span>
                    {selectedVillager.armorId !== 'none' ? (
                      <button
                        onClick={() => handleUnequip('armor')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                      >
                        外す
                      </button>
                    ) : (
                      <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                    )}
                  </div>

                  {/* 倉庫内の防具 */}
                  {Object.entries(ITEMS)
                    .filter(([_, item]) => item.category === 'gear_armor')
                    .map(([itemId, item]) => {
                      const count = inventory[itemId] || 0;
                      const isEquipped = selectedVillager.armorId === itemId;

                      return (
                        <div
                          key={itemId}
                          className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-800 rounded"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-200">{item.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">倉庫在庫: {count}個</p>
                          </div>
                          {isEquipped ? (
                            <span className="text-[10px] text-sky-400 font-bold">装備中</span>
                          ) : (
                            <button
                              onClick={() => handleEquip(itemId, 'armor')}
                              disabled={count <= 0}
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] text-white font-medium transition"
                            >
                              装備
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
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
