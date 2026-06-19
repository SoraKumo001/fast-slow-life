import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  TIER_LIMIT_DAYS,
  STARTING_GOLD,
  STARTING_FOOD,
  HIRE_COST,
  BASE_MAX_VILLAGERS,
  MAX_VILLAGERS_ABSOLUTE,
  VILLAGERS_PER_GUILD_LEVEL,
  DISCOUNT_PER_SOUL_LEVEL,
  HERITAGE_GOLD_PER_LEVEL,
  STORAGE_FOOD_PER_LEVEL,
  BODY_STAT_PER_LEVEL,
  BUILDING_COST_REDUCTION,
  MAX_LOG_COUNT,
  MAX_POTIONS_PER_VILLAGER,
} from "../constants";
import {
  ITEMS,
  RECIPES,
  MONSTERS,
  DUNGEONS,
  SOUL_UPGRADES,
  JOBS,
  VILLAGER_NAMES,
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
import { calculateAdvanceHour } from "./gameLoopHelper";
import {
  getInitialVillagers,
  getInitialFacilities,
  getInitialDungeons,
  createInitialInventory,
  DEFAULT_INVENTORY,
} from "./initialState";
import { partialize, merge } from "./persistence";

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
        const { villagers, inventory, targetAmounts, dungeons, currentTier, bossDefeated } = state;
        let anyDispatched = false;
        const nextInventory = { ...inventory };

        const updatedVillagers = villagers.map((v) => {
          if (v.status === "idle" && v.order !== "rest") {
            let targetAreaId: string | null = null;
            let targetOrder: OrderType = "gather";
            let resolvedAutoTargetName: string | null = null;

            const missingItemIds = Object.keys(targetAmounts).filter((itemId) => {
              const count = inventory[itemId] || 0;
              const target = targetAmounts[itemId] || 0;
              return count < target;
            });

            if (missingItemIds.length > 0) {
              let preferredCategories: string[] = [];
              const job = v.currentJob;
              if (job === "農民") preferredCategories = ["food"];
              else if (job === "猟師") preferredCategories = ["food", "material"];
              else if (job === "鉱夫") preferredCategories = ["ore", "material"];
              else if (job === "薬師") preferredCategories = ["herb", "mana_stone"];
              else if (job === "魔術師") preferredCategories = ["mana_stone"];
              else if (job === "僧侶") preferredCategories = ["herb"];
              else if (job === "職人") preferredCategories = ["ore", "material"];
              else if (job === "戦士") preferredCategories = ["material"];

              const sortedMissingItemIds = [...missingItemIds].sort((a, b) => {
                const aCategory = ITEMS[a]?.category || "";
                const bCategory = ITEMS[b]?.category || "";
                const aPref = preferredCategories.includes(aCategory) ? 1 : 0;
                const bPref = preferredCategories.includes(bCategory) ? 1 : 0;

                if (aPref !== bPref) {
                  return bPref - aPref;
                }

                const aCount = inventory[a] || 0;
                const aTarget = targetAmounts[a] || 1;
                const aRatio = aCount / aTarget;

                const bCount = inventory[b] || 0;
                const bTarget = targetAmounts[b] || 1;
                const bRatio = bCount / bTarget;

                return aRatio - bRatio;
              });

              for (const missingId of sortedMissingItemIds) {
                const area = dungeons.find(
                  (d) =>
                    d.unlockedAtTier <= currentTier &&
                    d.gathers.some(
                      (g) =>
                        g.itemId === missingId &&
                        d.explorationProgress >= (g.unlockedAtProgress || 0) &&
                        !(g.respawnTimeLeft && g.respawnTimeLeft > 0),
                    ),
                );
                if (area) {
                  targetAreaId = area.id;
                  targetOrder = "gather";
                  resolvedAutoTargetName = ITEMS[missingId]?.name || null;
                  break;
                }

                const dropArea = dungeons.find(
                  (d) =>
                    d.unlockedAtTier <= currentTier &&
                    d.monsters.some(
                      (m) =>
                        d.explorationProgress >= (m.unlockedAtProgress || 0) &&
                        (!m.isBoss || bossDefeated) &&
                        !(m.respawnTimeLeft && m.respawnTimeLeft > 0) &&
                        m.drops.some((dr) => dr.itemId === missingId),
                    ),
                );
                if (dropArea) {
                  targetAreaId = dropArea.id;
                  targetOrder = "hunt";
                  const targetMonster = dropArea.monsters.find(
                    (m) =>
                      dropArea.explorationProgress >= (m.unlockedAtProgress || 0) &&
                      (!m.isBoss || bossDefeated) &&
                      !(m.respawnTimeLeft && m.respawnTimeLeft > 0) &&
                      m.drops.some((dr) => dr.itemId === missingId),
                  );
                  resolvedAutoTargetName = targetMonster ? targetMonster.name : null;
                  break;
                }
              }
            }

            if (targetAreaId) {
              anyDispatched = true;
              const area = dungeons.find((d) => d.id === targetAreaId)!;

              let assignedPotionCount = 0;
              const availablePotions = nextInventory.potion || 0;
              if (availablePotions > 0) {
                assignedPotionCount = Math.min(MAX_POTIONS_PER_VILLAGER, availablePotions);
                nextInventory.potion = availablePotions - assignedPotionCount;
              }

              state.addLog(
                `【自動派遣】${v.name} を ${area.name} へ派遣しました（目的: ${targetOrder === "gather" ? `採取 [${resolvedAutoTargetName}]` : `討伐 [${resolvedAutoTargetName}]`}${assignedPotionCount > 0 ? `、回復薬 x${assignedPotionCount}所持` : ""}）。`,
                "info",
              );
              return {
                ...v,
                status: "traveling_to",
                destinationAreaId: targetAreaId,
                order: targetOrder,
                autoTargetName: resolvedAutoTargetName,
                travelTimeLeft: area.distance,
                potionCount: assignedPotionCount,
              } as Villager;
            }
          }
          return v;
        });

        if (anyDispatched) {
          set({ villagers: updatedVillagers, inventory: nextInventory });
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
        if (state.facilities.market.level === 0) {
          state.addLog("交易所が建設されていないため売却できません。", "warning");
          return;
        }
        const currentCount = state.inventory[itemId] || 0;
        const toSell = Math.min(currentCount, count);
        if (toSell <= 0) return;

        const price = (ITEMS[itemId]?.sellPrice || 0) * toSell;
        set((state) => ({
          inventory: { ...state.inventory, [itemId]: currentCount - toSell },
          gold: state.gold + price,
        }));
        state.addLog(
          `${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。`,
          "info",
        );
      },

      setVillagerOrder: (id, order, areaId, targetGatherItemId = null, targetMonsterId = null) => {
        set((state) => {
          const nextInventory = { ...state.inventory };
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;

            let status = v.status;
            let travelTime = v.travelTimeLeft;
            let dest = v.destinationAreaId;
            let nextPotionCount = v.potionCount || 0;

            const sameArea = v.destinationAreaId === areaId;
            const nextGatherTarget =
              targetGatherItemId !== undefined
                ? targetGatherItemId
                : sameArea
                  ? v.targetGatherItemId
                  : null;
            const nextMonsterTarget =
              targetMonsterId !== undefined ? targetMonsterId : sameArea ? v.targetMonsterId : null;

            if (order === "rest" || !areaId) {
              if (nextPotionCount > 0) {
                nextInventory.potion = (nextInventory.potion || 0) + nextPotionCount;
                state.addLog(
                  `【返却】${v.name} は回復薬 ${nextPotionCount} 個を倉庫に戻しました。`,
                  "info",
                );
                nextPotionCount = 0;
              }
            }

            if (order === "rest") {
              status = "resting";
              dest = null;
              travelTime = 0;
            } else if (areaId) {
              const area = DUNGEONS.find((d) => d.id === areaId);
              if (v.destinationAreaId !== areaId || v.status === "idle" || v.status === "resting") {
                status = "traveling_to";
                travelTime = area ? area.distance : 1;

                if (nextPotionCount > 0) {
                  nextInventory.potion = (nextInventory.potion || 0) + nextPotionCount;
                  nextPotionCount = 0;
                }

                const availablePotions = nextInventory.potion || 0;
                if (availablePotions > 0) {
                  nextPotionCount = Math.min(MAX_POTIONS_PER_VILLAGER, availablePotions);
                  nextInventory.potion = availablePotions - nextPotionCount;
                  state.addLog(
                    `【準備】${v.name} は回復薬を ${nextPotionCount} 個所持しました。`,
                    "info",
                  );
                }
              }
              dest = areaId;
            } else {
              dest = null;
              status = "idle";
              travelTime = 0;
            }

            return {
              ...v,
              order,
              status,
              destinationAreaId: dest,
              travelTimeLeft: travelTime,
              targetGatherItemId: nextGatherTarget,
              targetMonsterId: nextMonsterTarget,
              autoTargetName: null,
              potionCount: nextPotionCount,
            };
          });
          return { villagers: updated, inventory: nextInventory };
        });
        const vName = get().villagers.find((v) => v.id === id)?.name;
        const areaName = DUNGEONS.find((d) => d.id === areaId)?.name || "村";
        const targetName = targetGatherItemId
          ? ITEMS[targetGatherItemId]?.name
          : targetMonsterId
            ? MONSTERS[targetMonsterId]?.name
            : null;
        const targetStr = targetName ? `、個別指示: ${targetName}` : "";
        get().addLog(
          `${vName} の方針を【${order === "rest" ? "休息" : order === "gather" ? "採取" : "討伐"}】（場所: ${areaName}${targetStr}）に変更しました。`,
          "info",
        );
      },

      changeVillagerJob: (id, job) => {
        const state = get();
        const villager = state.villagers.find((v) => v.id === id);
        if (!villager) return;

        const isFree = villager.jobHistory.includes(job);

        if (!isFree) {
          const req = JOBS[job].requirements;
          if (req) {
            if (villager.level < req.level) {
              state.addLog(`転職条件を達成していません (必要レベル: ${req.level})。`, "warning");
              return;
            }
            if (req.jobs && req.jobs.length > 0) {
              const hasPrevJob = req.jobs.some((reqJob) => villager.jobHistory.includes(reqJob));
              if (!hasPrevJob) {
                state.addLog(
                  `転職条件を達成していません (前提職業: ${req.jobs.join(" または ")} の習得が必要)。`,
                  "warning",
                );
                return;
              }
            }
          }
        }

        const discountLvl = state.soulUpgrades.discount || 0;
        const discountRate = 1 - discountLvl * DISCOUNT_PER_SOUL_LEVEL;
        const cost = isFree ? 0 : Math.floor(JOBS[job].cost * discountRate);

        if (state.gold < cost) {
          state.addLog("転職に必要なゴールドが不足しています。", "warning");
          return;
        }

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;
            const history = v.jobHistory.includes(job) ? v.jobHistory : [...v.jobHistory, job];

            const baseStr = 10 + (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
            const baseInt = 10 + (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
            const baseDex = 10 + (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
            const baseAgi = 10 + (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
            const baseVit = 10 + (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;

            const mult = JOBS[job].statsMultiplier;
            const lvlBonus = v.level - 1;

            return {
              ...v,
              currentJob: job,
              jobHistory: history,
              str: Math.floor((baseStr + lvlBonus * 1.5) * mult.str),
              int: Math.floor((baseInt + lvlBonus * 1.5) * mult.int),
              dex: Math.floor((baseDex + lvlBonus * 1.5) * mult.dex),
              agi: Math.floor((baseAgi + lvlBonus * 1.5) * mult.agi),
              vit: Math.floor((baseVit + lvlBonus * 1.5) * mult.vit),
              maxHp: Math.floor((100 + lvlBonus * 10) * mult.vit),
            };
          });

          return {
            villagers: updated,
            gold: state.gold - cost,
          };
        });

        state.addLog(`${villager.name} が ${job} に転職しました。`, "info");
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
        const isCrafter = assignedId
          ? state.villagers.find((v) => v.id === assignedId)?.currentJob === "職人"
          : false;
        const timeNeeded = isCrafter ? Math.max(1, Math.floor(baseTime * 0.8)) : baseTime;

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
        const guild = state.facilities.guild;
        if (!guild || guild.level === 0) {
          state.addLog("冒険者ギルドが建設されていないため雇用できません。", "warning");
          return;
        }
        const maxVillagers = BASE_MAX_VILLAGERS + guild.level * VILLAGERS_PER_GUILD_LEVEL;
        const actualMax = Math.min(MAX_VILLAGERS_ABSOLUTE, maxVillagers);

        if (state.gold < HIRE_COST) {
          state.addLog(`雇用に必要なゴールド (${HIRE_COST}G) が不足しています。`, "warning");
          return;
        }
        if (state.villagers.length >= actualMax) {
          if (actualMax >= MAX_VILLAGERS_ABSOLUTE) {
            state.addLog(
              `これ以上村人を雇用できません（上限${MAX_VILLAGERS_ABSOLUTE}人）。`,
              "warning",
            );
          } else {
            state.addLog(
              `ギルドレベル ${guild.level} の雇用上限に達しています（上限 ${actualMax} 人）。ギルドをアップグレードしてください。`,
              "warning",
            );
          }
          return;
        }

        const name = VILLAGER_NAMES[state.villagers.length % VILLAGER_NAMES.length] + " (新人)";
        const statBonus = (state.soulUpgrades.body || 0) * BODY_STAT_PER_LEVEL;
        const newVillager: Villager = {
          id: "v_" + Math.random().toString(36).substring(2),
          name,
          level: 1,
          exp: 0,
          currentJob: "無職",
          jobHistory: ["無職"],
          maxHp: 100 + statBonus * 10,
          currentHp: 100 + statBonus * 10,
          stamina: 100,
          str: 10 + statBonus,
          int: 10 + statBonus,
          dex: 10 + statBonus,
          agi: 10 + statBonus,
          vit: 10 + statBonus,
          weaponId: "none",
          armorId: "none",
          order: "gather",
          status: "idle",
          destinationAreaId: null,
          travelTimeLeft: 0,
          assignedCraftJobId: null,
          targetGatherItemId: null,
          targetMonsterId: null,
          autoTargetName: null,
          potionCount: 0,
        };

        set((state) => ({
          gold: state.gold - HIRE_COST,
          villagers: [...state.villagers, newVillager],
        }));
        get().dispatchIdleVillagers();

        state.addLog(`新しい村人 ${name} を雇用しました。`, "info");
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
        let earnedSp = 0;

        if (prestige) {
          const invValue = Object.entries(state.inventory).reduce((sum, [itemId, count]) => {
            return sum + (ITEMS[itemId]?.sellPrice || 0) * count;
          }, 0);
          const bossCount = state.currentTier - (state.bossDefeated ? 0 : 1);
          earnedSp =
            Math.floor(state.gold / 1000) +
            Math.floor(invValue / 100) +
            bossCount * 50 +
            state.currentDay * 2;
        }

        const heritageLvl = state.soulUpgrades.heritage || 0;
        const storageLvl = state.soulUpgrades.storage || 0;

        const startGold = STARTING_GOLD + heritageLvl * HERITAGE_GOLD_PER_LEVEL;
        const startFood = STARTING_FOOD + storageLvl * STORAGE_FOOD_PER_LEVEL;

        const bodyLvl = state.soulUpgrades.body || 0;

        set({
          currentDay: 1,
          currentHour: 0,
          gold: startGold,
          soulPoints: state.soulPoints + earnedSp,
          villagers: getInitialVillagers(bodyLvl),
          facilities: getInitialFacilities(),
          dungeons: getInitialDungeons(),
          inventory: createInitialInventory(startFood),
          targetAmounts: Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
          logs: [
            {
              id: "prestige_init",
              timestamp: "1日目 00:00",
              message: prestige
                ? `ソウルポイントを ${earnedSp} SP 獲得し、新たな周回を開始しました。`
                : "ゲームを初期状態からリスタートしました。",
              type: "system",
            },
          ],
          currentTier: 1,
          activeBoss: null,
          bossDefeated: false,
          gameLimitDays: TIER_LIMIT_DAYS[1],
          gameOver: false,
          isPaused: !prestige,
        });
      },

      advanceHour: () => {
        const state = get();
        if (state.gameOver) return;

        const result = calculateAdvanceHour(state);

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
