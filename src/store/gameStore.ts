import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  STARTING_GOLD,
  BUILDING_COST_REDUCTION,
  MAX_LOG_COUNT,
  TIER_LIMIT_DAYS,
} from "../constants";
import {
  ITEMS,
  RECIPES,
  MONSTERS,
  DUNGEONS,
  SOUL_UPGRADES,
  JOBS,
  getRecipeForItem,
  getRecipesForFacility,
  getCraftableItemsForFacility,
} from "../data/masterData";
import {
  GameState,
  Villager,
  JobType,
  GameLog,
  FacilityType,
  OrderType,
  VillagerStatus,
} from "../types/game";
import { calculateCraftTime } from "./crafting";
import { calculateAdvanceHour } from "./gameLoopHelper";
import { resetGameHelper, calculateEarnedSp } from "./gameReset";
import {
  getInitialVillagers,
  getInitialFacilities,
  getInitialDungeons,
  DEFAULT_INVENTORY,
} from "./initialState";
import { partialize, merge } from "./persistence";
import { dispatchIdleVillagersHelper } from "./villagerDispatch";
import { hireVillagerHelper } from "./villagerHire";
import { changeVillagerJobHelper } from "./villagerJob";
import { setVillagerOrderHelper } from "./villagerOrder";

declare global {
  var IS_TEST_ENVIRONMENT: boolean | undefined;
}

export const getMarketSellBonus = (level: number): number => {
  if (level <= 1) return 0.0;
  if (level === 2) return 0.1;
  return 0.2; // Lv3以上
};

export {
  ITEMS,
  RECIPES,
  MONSTERS,
  DUNGEONS,
  SOUL_UPGRADES,
  JOBS,
  getRecipeForItem,
  getRecipesForFacility,
  getCraftableItemsForFacility,
  calculateEarnedSp,
};

interface GameActions {
  advanceHour: () => void;
  setVillagerOrder: (
    id: string,
    order: OrderType,
    areaId: string | null,
    targetGatherItemId?: string | null,
    targetMonsterId?: string | null,
  ) => void;
  changeVillagerJob: (id: string, job: JobType) => void;
  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => void;
  unequipItem: (villagerId: string, slot: "weapon" | "armor") => void;
  startCraft: (facilityId: FacilityType, itemId: string, villagerId?: string) => void;
  startFacilityUpgrade: (facilityId: FacilityType) => void;
  setTargetAmount: (itemId: string, count: number) => void;
  buySoulUpgrade: (upgradeId: string) => void;
  hireVillager: () => void;
  resetGame: (prestige?: boolean) => void;
  togglePause: () => void;
  setPlaySpeed: (speed: "normal" | "fast" | "super") => void;
  addLog: (message: string, type: GameLog["type"]) => void;
  sellItem: (itemId: string, count: number) => void;
  advanceDay: () => void;
  dispatchIdleVillagers: () => void;
  startBossBattle: (monsterId: string, villagerIds: string[]) => void;
  withdrawFromBossBattle: () => void;
}

export const useGameStore = create<GameState & GameActions>()(
  persist<GameState & GameActions, [], [], Partial<GameState & GameActions>>(
    (set, get) => ({
      currentDay: 1,
      currentHour: 0,
      gold: STARTING_GOLD,
      soulPoints: 0,
      villagers: getInitialVillagers(0),
      facilities: getInitialFacilities(),
      dungeons: getInitialDungeons(),
      inventory: { ...DEFAULT_INVENTORY },
      targetAmounts: Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
      logs: [
        {
          id: "init",
          timestamp: "1日目 00:00",
          message: "ゲームが開始されました。村を発展させましょう！",
          type: "system",
        },
      ],
      currentTier: 1,
      activeBoss: null,
      bossDefeated: false,
      gameLimitDays: TIER_LIMIT_DAYS[1],
      gameOver: false,
      isPaused: true,
      playSpeed: "normal",
      soulUpgrades: {
        heritage: 0,
        storage: 0,
        education: 0,
        body: 0,
        building: 0,
        discount: 0,
      },

      addLog: (message: string, type: GameLog["type"]) => {
        if (globalThis.IS_TEST_ENVIRONMENT) return; // テスト環境ではログ蓄積をスキップして高速化
        const { currentDay, currentHour } = get();
        const timestamp = `${currentDay}日目 ${String(currentHour).padStart(2, "0")}:00`;
        const newLog: GameLog = {
          id: Math.random().toString(36).substring(2),
          timestamp,
          message,
          type,
        };
        set((state) => ({
          logs: [newLog, ...state.logs].slice(0, MAX_LOG_COUNT),
        }));
      },

      togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

      advanceDay: () => {
        const state = get();
        if (state.gameOver || !state.isPaused) return;
        state.addLog("【システム】1日（24時間）スキップを開始します。", "system");
        for (let i = 0; i < 24; i++) {
          if (get().gameOver) break;
          get().advanceHour();
        }
        state.addLog("【システム】1日スキップが完了しました。", "system");
      },

      dispatchIdleVillagers: () => {
        const state = get();
        const { villagers } = state;
        const hasIdleVillagers = villagers.some((v) => v.status === "idle" && v.order !== "rest");
        if (!hasIdleVillagers) return;

        const result = dispatchIdleVillagersHelper({
          villagers: state.villagers,
          inventory: state.inventory,
          targetAmounts: state.targetAmounts,
          dungeons: state.dungeons,
          currentTier: state.currentTier,
          bossDefeated: state.bossDefeated,
        });

        if (result.anyDispatched) {
          result.logs.forEach((log) => state.addLog(log.message, log.type));
          set({
            villagers: result.villagers,
            inventory: result.inventory,
          });
        }
      },

      startBossBattle: (monsterId, villagerIds) => {
        const monster = MONSTERS[monsterId];
        if (!monster) return;

        set((state) => {
          const updatedVillagers = state.villagers.map((v) => {
            if (villagerIds.includes(v.id)) {
              const area = state.dungeons.find((d) => d.monsters.some((m) => m.id === monsterId));
              return {
                ...v,
                status: "active" as VillagerStatus,
                destinationAreaId: area?.id || null,
                travelTimeLeft: 0,
                order: "hunt" as OrderType,
                targetMonsterId: monsterId,
                assignedCraftJobId: null,
              };
            }
            return v;
          });

          const updatedFacilities = { ...state.facilities };
          Object.keys(updatedFacilities).forEach((key) => {
            const fac = updatedFacilities[key as FacilityType];
            fac.craftQueue = fac.craftQueue.map((job) => {
              if (job.assignedVillagerId && villagerIds.includes(job.assignedVillagerId)) {
                return { ...job, assignedVillagerId: null };
              }
              return job;
            });
          });

          return {
            activeBoss: {
              monsterId,
              currentHp: monster.hp,
              maxHp: monster.maxHp,
              attackerIds: villagerIds,
            },
            villagers: updatedVillagers,
            facilities: updatedFacilities,
            isPaused: false,
          };
        });

        get().addLog(`エリアボス【${monster.name}】との決戦を開始しました！`, "system");
      },

      withdrawFromBossBattle: () => {
        set((state) => {
          if (!state.activeBoss) return state;

          const updatedVillagers = state.villagers.map((v) => {
            if (state.activeBoss?.attackerIds.includes(v.id)) {
              return {
                ...v,
                status: "idle" as VillagerStatus,
                destinationAreaId: null,
                travelTimeLeft: 0,
              };
            }
            return v;
          });

          return {
            activeBoss: null,
            villagers: updatedVillagers,
          };
        });

        get().addLog("ボス戦から撤退しました。", "info");
      },

      setPlaySpeed: (speed) => set({ playSpeed: speed }),

      setTargetAmount: (itemId, count) => {
        set((state) => ({
          targetAmounts: {
            ...state.targetAmounts,
            [itemId]: Math.max(0, count),
          },
        }));
        get().dispatchIdleVillagers();
      },

      sellItem: (itemId, count) => {
        const state = get();
        const marketLvl = state.facilities.market.level;
        if (marketLvl === 0) {
          state.addLog("交易所が建設されていないため売却できません。", "warning");
          return;
        }
        const currentCount = state.inventory[itemId] || 0;
        const toSell = Math.min(currentCount, count);
        if (toSell <= 0) return;

        const bonusRate = getMarketSellBonus(marketLvl);
        const basePrice = (ITEMS[itemId]?.sellPrice || 0) * toSell;
        const price = Math.floor(basePrice * (1 + bonusRate));

        set((state) => ({
          inventory: { ...state.inventory, [itemId]: currentCount - toSell },
          gold: state.gold + price,
        }));

        const bonusText = bonusRate > 0 ? ` (ボーナス +${Math.round(bonusRate * 100)}% 適用)` : "";
        state.addLog(
          `${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。${bonusText}`,
          "info",
        );
      },

      setVillagerOrder: (id, order, areaId, targetGatherItemId = null, targetMonsterId = null) => {
        const state = get();
        const result = setVillagerOrderHelper({
          villagerId: id,
          order,
          areaId,
          targetGatherItemId,
          targetMonsterId,
          villagers: state.villagers,
          inventory: state.inventory,
        });

        result.logs.forEach((log) => state.addLog(log.message, log.type));
        set({
          villagers: result.villagers,
          inventory: result.inventory,
        });
      },

      changeVillagerJob: (id, job) => {
        const state = get();
        const result = changeVillagerJobHelper({
          villagerId: id,
          job,
          villagers: state.villagers,
          gold: state.gold,
          soulUpgrades: state.soulUpgrades,
        });

        result.logs.forEach((log) => state.addLog(log.message, log.type));
        if (result.success) {
          set({
            villagers: result.villagers,
            gold: result.gold,
          });
        }
      },

      equipItem: (villagerId, itemId, slot) => {
        const state = get();
        const item = ITEMS[itemId];
        if (!item?.equipment || item.equipment.slot !== slot) return;

        const currentCount = state.inventory[itemId] || 0;
        if (currentCount <= 0) return;

        set((state) => {
          const inv = { ...state.inventory };
          const updated = state.villagers.map((v) => {
            if (v.id !== villagerId) return v;

            const oldEquipId = slot === "weapon" ? v.weaponId : v.armorId;
            if (oldEquipId && oldEquipId !== "none") {
              inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
            }

            inv[itemId] = Math.max(0, currentCount - 1);

            return {
              ...v,
              [slot === "weapon" ? "weaponId" : "armorId"]: itemId,
            };
          });

          return { villagers: updated, inventory: inv };
        });

        const vName = get().villagers.find((v) => v.id === villagerId)?.name;
        state.addLog(`${vName} に ${ITEMS[itemId].name} を装備しました。`, "info");
      },

      unequipItem: (villagerId, slot) => {
        const state = get();
        const villager = state.villagers.find((v) => v.id === villagerId);
        if (!villager) return;

        const itemId = slot === "weapon" ? villager.weaponId : villager.armorId;
        if (!itemId || itemId === "none") return;

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== villagerId) return v;
            return {
              ...v,
              [slot === "weapon" ? "weaponId" : "armorId"]: "none",
            };
          });
          const inv = { ...state.inventory };
          inv[itemId] = (inv[itemId] || 0) + 1;

          return { villagers: updated, inventory: inv };
        });

        state.addLog(`${villager.name} の装備を外しました。`, "info");
      },

      startCraft: (facilityId, itemId, villagerId) => {
        const state = get();
        const facility = state.facilities[facilityId];
        const item = ITEMS[itemId];
        const recipe = getRecipeForItem(itemId);
        if (
          !facility ||
          !item ||
          !recipe ||
          recipe.facilityId !== facilityId ||
          facility.level < recipe.requiredFacilityLevel
        )
          return;

        const missing = recipe.requiredItems.filter(
          (req) => (state.inventory[req.itemId] || 0) < req.count,
        );
        if (missing.length > 0) {
          state.addLog("クラフトの必要素材が不足しています。", "warning");
          return;
        }

        let assignedId: string | null = null;
        if (villagerId) {
          const v = state.villagers.find((v) => v.id === villagerId);
          if (v && v.status === "idle") {
            assignedId = villagerId;
          }
        } else {
          const idleCrafter = state.villagers.find(
            (v) => v.status === "idle" && v.currentJob === "職人",
          );
          const idleAny = state.villagers.find((v) => v.status === "idle");
          assignedId = (idleCrafter || idleAny)?.id || null;
        }

        const jobId = Math.random().toString(36).substring(2);
        const baseTime = recipe.requiredTime;
        const assignedVillager = assignedId
          ? state.villagers.find((v) => v.id === assignedId)
          : null;
        const timeNeeded = calculateCraftTime(baseTime, assignedVillager);

        set((state) => {
          const inv = { ...state.inventory };
          recipe.requiredItems.forEach((req) => {
            inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - req.count);
          });

          const updatedFacilities = { ...state.facilities };
          updatedFacilities[facilityId].craftQueue.push({
            id: jobId,
            itemId,
            timeLeft: timeNeeded,
            totalTime: timeNeeded,
            assignedVillagerId: assignedId,
          });

          const updatedVillagers = state.villagers.map((v) => {
            if (v.id === assignedId) {
              return {
                ...v,
                status: "active",
                assignedCraftJobId: jobId,
              } as Villager;
            }
            return v;
          });

          return {
            inventory: inv,
            facilities: updatedFacilities,
            villagers: updatedVillagers,
          };
        });

        const vName = assignedId ? state.villagers.find((v) => v.id === assignedId)?.name : "なし";
        state.addLog(
          `${facility.name} で ${item.name} のクラフトを開始しました（担当: ${vName}）。`,
          "craft",
        );
      },

      startFacilityUpgrade: (facilityId) => {
        const state = get();
        const facility = state.facilities[facilityId];
        if (!facility || facility.level >= facility.maxLevel) return;

        const buildLvl = state.soulUpgrades.building || 0;
        const costReduction = 1 - buildLvl * BUILDING_COST_REDUCTION;

        const goldCost = Math.floor(facility.upgradeCost.gold * costReduction);
        if (state.gold < goldCost) {
          state.addLog("ゴールドが不足しています。", "warning");
          return;
        }

        const missing = facility.upgradeCost.materials.filter((req) => {
          const reqCount = Math.floor(req.count * costReduction);
          return (state.inventory[req.itemId] || 0) < reqCount;
        });

        if (missing.length > 0) {
          state.addLog("アップグレードの必要素材が不足しています。", "warning");
          return;
        }

        set((state) => {
          const inv = { ...state.inventory };
          facility.upgradeCost.materials.forEach((req) => {
            const reqCount = Math.floor(req.count * costReduction);
            inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - reqCount);
          });

          const updatedFacilities = { ...state.facilities };
          const time = 5 + facility.level * 5;
          updatedFacilities[facilityId] = {
            ...facility,
            upgradeTimeLeft: time,
            upgradeTotalTime: time,
          };

          return {
            gold: state.gold - goldCost,
            inventory: inv,
            facilities: updatedFacilities,
          };
        });

        state.addLog(
          `${facility.name} のアップグレードを開始しました。レベル ${facility.level + 1} まであと ${5 + facility.level * 5} 時間。`,
          "upgrade",
        );
      },

      hireVillager: () => {
        const state = get();
        const result = hireVillagerHelper({
          gold: state.gold,
          villagers: state.villagers,
          guildFacility: state.facilities.guild,
          soulUpgrades: state.soulUpgrades,
        });

        result.logs.forEach((log) => state.addLog(log.message, log.type));
        if (result.success) {
          set({
            gold: result.gold,
            villagers: result.villagers,
          });
          get().dispatchIdleVillagers();
        }
      },

      buySoulUpgrade: (upgradeId) => {
        const state = get();
        const currentLvl = state.soulUpgrades[upgradeId] || 0;
        const uDef = SOUL_UPGRADES.find((u) => u.id === upgradeId);
        if (!uDef || currentLvl >= uDef.maxLevel) return;

        const cost = uDef.costPerLevel * (currentLvl + 1);
        if (state.soulPoints < cost) {
          state.addLog("ソウルポイントが不足しています。", "warning");
          return;
        }

        set((state) => ({
          soulPoints: state.soulPoints - cost,
          soulUpgrades: {
            ...state.soulUpgrades,
            [upgradeId]: currentLvl + 1,
          },
        }));

        state.addLog(
          `転生バフ【${uDef.name}】のレベルを ${currentLvl + 1} に強化しました。`,
          "system",
        );
      },

      resetGame: (prestige = false) => {
        const state = get();
        const result = resetGameHelper({
          prestige,
          state: {
            gameOver: state.gameOver,
            gold: state.gold,
            inventory: state.inventory,
            currentTier: state.currentTier,
            bossDefeated: state.bossDefeated,
            currentDay: state.currentDay,
            soulPoints: state.soulPoints,
            soulUpgrades: state.soulUpgrades,
          },
        });

        set({
          currentDay: result.currentDay,
          currentHour: result.currentHour,
          gold: result.gold,
          soulPoints: result.soulPoints,
          villagers: result.villagers,
          facilities: result.facilities,
          dungeons: result.dungeons,
          inventory: result.inventory,
          targetAmounts: result.targetAmounts,
          logs: result.logs,
          currentTier: result.currentTier,
          activeBoss: result.activeBoss,
          bossDefeated: result.bossDefeated,
          gameLimitDays: result.gameLimitDays,
          gameOver: result.gameOver,
          isPaused: result.isPaused,
        });
      },

      advanceHour: () => {
        const state = get();
        if (state.gameOver) return;

        const result = calculateAdvanceHour(state);

        if (!globalThis.IS_TEST_ENVIRONMENT) {
          result.logsToAppend.forEach((log) => {
            const timestamp = `${result.currentDay}日目 ${String(result.currentHour).padStart(2, "0")}:00`;
            const newLog: GameLog = {
              id: Math.random().toString(36).substring(2),
              timestamp,
              message: log.message,
              type: log.type,
            };
            set((s) => ({
              logs: [newLog, ...s.logs].slice(0, MAX_LOG_COUNT),
            }));
          });
        }

        set({
          currentDay: result.currentDay,
          currentHour: result.currentHour,
          villagers: result.villagers,
          facilities: result.facilities,
          dungeons: result.dungeons,
          inventory: result.inventory,
          currentTier: result.currentTier,
          activeBoss: result.activeBoss,
          bossDefeated: result.bossDefeated,
          gameLimitDays: result.gameLimitDays,
          gameOver: result.gameOver,
          isPaused: result.isPaused,
          // ゲームオーバー時にその場でSPを加算する（ダイアログ表示時点で既に反映させる）
          ...(result.gameOver && !state.gameOver
            ? {
                soulPoints:
                  state.soulPoints +
                  calculateEarnedSp({
                    gold: state.gold,
                    inventory: result.inventory,
                    currentTier: result.currentTier,
                    bossDefeated: result.bossDefeated,
                    currentDay: result.currentDay,
                  }),
              }
            : {}),
        });

        get().dispatchIdleVillagers();
      },
    }),
    {
      name: "fast-slow-life-save-state",
      partialize,
      merge,
    },
  ),
);
