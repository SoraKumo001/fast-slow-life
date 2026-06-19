import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  GameState,
  Villager,
  JobType,
  Item,
  CraftRecipe,
  Facility,
  DungeonArea,
  Monster,
  GameLog,
  FacilityType,
  OrderType,
  SoulUpgrade,
  VillagerStatus,
} from "../types/game";

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

import { calculateAdvanceHour } from "./gameLoopHelper";

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

// ==========================================
// 2. 初期化ヘルパー
// ==========================================

function getInitialVillagers(bodyLvl: number = 0): Villager[] {
  const statBonus = bodyLvl * 2;
  return [
    {
      id: "v1",
      name: "アルフ",
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
    },
    {
      id: "v2",
      name: "ベアトリス",
      level: 1,
      exp: 0,
      currentJob: "無職",
      jobHistory: ["無職"],
      maxHp: 100 + statBonus * 10,
      currentHp: 100 + statBonus * 10,
      stamina: 100,
      str: 8 + statBonus,
      int: 12 + statBonus,
      dex: 11 + statBonus,
      agi: 9 + statBonus,
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
    },
    {
      id: "v3",
      name: "シリル",
      level: 1,
      exp: 0,
      currentJob: "無職",
      jobHistory: ["無職"],
      maxHp: 100 + statBonus * 10,
      currentHp: 100 + statBonus * 10,
      stamina: 100,
      str: 12 + statBonus,
      int: 8 + statBonus,
      dex: 9 + statBonus,
      agi: 11 + statBonus,
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
    },
  ];
}

const TIER_LIMIT_DAYS = [0, 30, 70, 120, 180, 250];

function getInitialFacilities(): Record<FacilityType, Facility> {
  return {
    inn: {
      id: "inn",
      name: "宿屋",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: { gold: 200, materials: [{ itemId: "wood", count: 10 }] },
      craftQueue: [],
    },
    workshop: {
      id: "workshop",
      name: "加工工房",
      level: 1,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 300,
        materials: [
          { itemId: "wood", count: 15 },
          { itemId: "stone", count: 10 },
        ],
      },
      craftQueue: [],
    },
    blacksmith: {
      id: "blacksmith",
      name: "鍛冶屋",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 500,
        materials: [
          { itemId: "wood_plank", count: 5 },
          { itemId: "stone", count: 15 },
        ],
      },
      craftQueue: [],
    },
    alchemy: {
      id: "alchemy",
      name: "錬金工房",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 600,
        materials: [
          { itemId: "wood_plank", count: 8 },
          { itemId: "iron_ingot", count: 3 },
        ],
      },
      craftQueue: [],
    },
    market: {
      id: "market",
      name: "交易所",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 0,
        materials: [{ itemId: "wood_plank", count: 12 }],
      },
      craftQueue: [],
    },
    guild: {
      id: "guild",
      name: "冒険者ギルド",
      level: 0,
      maxLevel: 5,
      upgradeTimeLeft: 0,
      upgradeTotalTime: 0,
      upgradeCost: {
        gold: 300,
        materials: [
          { itemId: "wood", count: 10 },
          { itemId: "stone", count: 5 },
        ],
      },
      craftQueue: [],
    },
  };
}

// ==========================================
// 3. Zustand ストア実装
// ==========================================

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

const createInitialInventory = (foodOverride?: number): Record<string, number> => ({
  ...Object.fromEntries(Object.values(ITEMS).map((item) => [item.id, item.initialCount || 0])),
  ...(foodOverride === undefined ? {} : { food: foodOverride }),
});

const DEFAULT_INVENTORY: Record<string, number> = createInitialInventory();

export const useGameStore = create<GameState & GameActions>()(
  persist<GameState & GameActions, [], [], Partial<GameState & GameActions>>(
    (set, get) => ({
      // 初期状態
      currentDay: 1,
      currentHour: 0,
      gold: 500,
      food: 50,
      soulPoints: 0,
      villagers: getInitialVillagers(0),
      facilities: getInitialFacilities(),
      dungeons: DUNGEONS,
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

      // ログ追加
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
          logs: [newLog, ...state.logs].slice(0, 100), // 最大100件保持
        }));
      },

      // 一時停止切り替え
      togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

      // 1日スキップ
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

      // 待機村人の自動派遣
      dispatchIdleVillagers: () => {
        const state = get();
        const { villagers, inventory, targetAmounts, dungeons, currentTier, bossDefeated } = state;
        let anyDispatched = false;

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
                return bPref - aPref;
              });

              for (const missingId of sortedMissingItemIds) {
                const area = dungeons.find(
                  (d) =>
                    d.unlockedAtTier <= currentTier &&
                    d.gathers.some(
                      (g) =>
                        g.itemId === missingId &&
                        d.explorationProgress >= (g.unlockedAtProgress || 0),
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
              state.addLog(
                `【自動派遣】${v.name} を ${area.name} へ派遣しました（目的: ${targetOrder === "gather" ? `採取 [${resolvedAutoTargetName}]` : `討伐 [${resolvedAutoTargetName}]`}）。`,
                "info",
              );
              return {
                ...v,
                status: "traveling_to",
                destinationAreaId: targetAreaId,
                order: targetOrder,
                autoTargetName: resolvedAutoTargetName,
                travelTimeLeft: area.distance,
              } as Villager;
            }
          }
          return v;
        });

        if (anyDispatched) {
          set({ villagers: updatedVillagers });
        }
      },

      // ボス討伐開始
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
                assignedCraftJobId: null, // クラフトアサインを解除
              };
            }
            return v;
          });

          // 施設側のクラフトキューのアサイン解除
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

      // ボス討伐から撤退
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

      // 進行スピード設定
      setPlaySpeed: (speed) => set({ playSpeed: speed }),

      // 目標個数設定
      setTargetAmount: (itemId, count) => {
        set((state) => ({
          targetAmounts: {
            ...state.targetAmounts,
            [itemId]: Math.max(0, count),
          },
        }));
        get().dispatchIdleVillagers();
      },

      // アイテム売却 (交易所)
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
          food: itemId === "food" ? Math.max(0, state.food - toSell) : state.food,
        }));
        state.addLog(
          `${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。`,
          "info",
        );
      },

      // 村人の指示変更
      setVillagerOrder: (id, order, areaId, targetGatherItemId = null, targetMonsterId = null) => {
        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;

            let status = v.status;
            let travelTime = v.travelTimeLeft;
            let dest = v.destinationAreaId;

            const sameArea = v.destinationAreaId === areaId;
            const nextGatherTarget =
              targetGatherItemId !== undefined
                ? targetGatherItemId
                : sameArea
                  ? v.targetGatherItemId
                  : null;
            const nextMonsterTarget =
              targetMonsterId !== undefined ? targetMonsterId : sameArea ? v.targetMonsterId : null;

            if (order === "rest") {
              status = "resting";
              dest = null;
              travelTime = 0;
            } else if (areaId) {
              const area = DUNGEONS.find((d) => d.id === areaId);
              if (v.destinationAreaId !== areaId || v.status === "idle" || v.status === "resting") {
                status = "traveling_to";
                travelTime = area ? area.distance : 1;
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
            };
          });
          return { villagers: updated };
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

      // 転職
      changeVillagerJob: (id, job) => {
        const state = get();
        const villager = state.villagers.find((v) => v.id === id);
        if (!villager) return;

        const isFree = villager.jobHistory.includes(job);

        // 転職要件チェック (すでに就いたことがある職業への再転職時はチェックを免除)
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
        const discountRate = 1 - discountLvl * 0.1;
        const cost = isFree ? 0 : Math.floor(JOBS[job].cost * discountRate);

        if (state.gold < cost) {
          state.addLog("転職に必要なゴールドが不足しています。", "warning");
          return;
        }

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;
            const history = v.jobHistory.includes(job) ? v.jobHistory : [...v.jobHistory, job];

            // ステータス補正の適用
            const baseStr = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseInt = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseDex = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseAgi = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseVit = 10 + (state.soulUpgrades.body || 0) * 2;

            // 簡易的に職業別初期ステータス倍率をかける
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

      // 装備変更
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

            // 既存装備を倉庫に戻す
            const oldEquipId = slot === "weapon" ? v.weaponId : v.armorId;
            if (oldEquipId && oldEquipId !== "none") {
              inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
            }

            // 新しい装備をインベントリから減らす
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

      // 装備解除
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

      // クラフト開始
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

        // レシピ素材チェック
        const missing = recipe.requiredItems.filter(
          (req) => (state.inventory[req.itemId] || 0) < req.count,
        );
        if (missing.length > 0) {
          state.addLog("クラフトの必要素材が不足しています。", "warning");
          return;
        }

        // 村人のアサインチェック
        let assignedId: string | null = null;
        if (villagerId) {
          const v = state.villagers.find((v) => v.id === villagerId);
          if (v && v.status === "idle") {
            assignedId = villagerId;
          }
        } else {
          // 自動クラフト用：暇な職人(crafter)がいれば優先アサイン
          const idleCrafter = state.villagers.find(
            (v) => v.status === "idle" && v.currentJob === "職人",
          );
          const idleAny = state.villagers.find((v) => v.status === "idle");
          assignedId = (idleCrafter || idleAny)?.id || null;
        }

        const jobId = Math.random().toString(36).substring(2);
        const baseTime = recipe.requiredTime;
        // 職人がアサインされていたらクラフト時間短縮（例: 20%短縮）
        const isCrafter = assignedId
          ? state.villagers.find((v) => v.id === assignedId)?.currentJob === "職人"
          : false;
        const timeNeeded = isCrafter ? Math.max(1, Math.floor(baseTime * 0.8)) : baseTime;

        set((state) => {
          // 素材の消費
          const inv = { ...state.inventory };
          let nextFood = state.food;
          recipe.requiredItems.forEach((req) => {
            inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - req.count);
            if (req.itemId === "food") {
              nextFood = Math.max(0, nextFood - req.count);
            }
          });

          // キューに追加
          const updatedFacilities = { ...state.facilities };
          updatedFacilities[facilityId].craftQueue.push({
            id: jobId,
            itemId,
            timeLeft: timeNeeded,
            totalTime: timeNeeded,
            assignedVillagerId: assignedId,
          });

          // 村人のステータスを更新 (クラフト従事)
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
            food: nextFood,
          };
        });

        const vName = assignedId ? state.villagers.find((v) => v.id === assignedId)?.name : "なし";
        state.addLog(
          `${facility.name} で ${item.name} のクラフトを開始しました（担当: ${vName}）。`,
          "craft",
        );
      },

      // 施設アップグレード開始
      startFacilityUpgrade: (facilityId) => {
        const state = get();
        const facility = state.facilities[facilityId];
        if (!facility || facility.level >= facility.maxLevel) return;

        // コスト計算（周回バフ適用）
        const buildLvl = state.soulUpgrades.building || 0;
        const costReduction = 1 - buildLvl * 0.05;

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
          const time = 5 + facility.level * 5; // レベルに応じた所要時間 (5h, 10h, 15h...)
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

      // 新しい村人の雇用 (100G)
      hireVillager: () => {
        const state = get();
        const guild = state.facilities.guild;
        if (!guild || guild.level === 0) {
          state.addLog("冒険者ギルドが建設されていないため雇用できません。", "warning");
          return;
        }
        const maxVillagers = 3 + guild.level * 2;
        const actualMax = Math.min(10, maxVillagers);

        if (state.gold < 100) {
          state.addLog("雇用に必要なゴールド (100G) が不足しています。", "warning");
          return;
        }
        if (state.villagers.length >= actualMax) {
          if (actualMax >= 10) {
            state.addLog("これ以上村人を雇用できません（上限10人）。", "warning");
          } else {
            state.addLog(
              `ギルドレベル ${guild.level} の雇用上限に達しています（上限 ${actualMax} 人）。ギルドをアップグレードしてください。`,
              "warning",
            );
          }
          return;
        }

        const name = VILLAGER_NAMES[state.villagers.length % VILLAGER_NAMES.length] + " (新人)";
        const statBonus = (state.soulUpgrades.body || 0) * 2;
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
        };

        set((state) => ({
          gold: state.gold - 100,
          villagers: [...state.villagers, newVillager],
        }));
        get().dispatchIdleVillagers();

        state.addLog(`新しい村人 ${name} を雇用しました。`, "info");
      },

      // 周回アップグレード購入
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

      // リセット & 転生
      resetGame: (prestige = false) => {
        const state = get();
        let earnedSp = 0;

        if (prestige) {
          // 周回SPの計算
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

        const startGold = 500 + heritageLvl * 500;
        const startFood = 50 + storageLvl * 100;

        const bodyLvl = state.soulUpgrades.body || 0;

        set({
          currentDay: 1,
          currentHour: 0,
          gold: startGold,
          food: startFood,
          soulPoints: state.soulPoints + earnedSp,
          villagers: getInitialVillagers(bodyLvl),
          facilities: getInitialFacilities(),
          dungeons: DUNGEONS,
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
          bossDefeated: false,
          gameLimitDays: TIER_LIMIT_DAYS[1],
          gameOver: false,
          isPaused: true,
        });
      },

      // ==========================================
      // 4. コアロジック: 1時間の時間経過 (advanceHour)
      // ==========================================
      advanceHour: () => {
        const state = get();
        if (state.gameOver) return;

        const result = calculateAdvanceHour(state);

        // ログの追加
        result.logsToAppend.forEach((log) => {
          const timestamp = `${result.currentDay}日目 ${String(result.currentHour).padStart(2, "0")}:00`;
          const newLog: GameLog = {
            id: Math.random().toString(36).substring(2),
            timestamp,
            message: log.message,
            type: log.type,
          };
          set((s) => ({
            logs: [newLog, ...s.logs].slice(0, 100),
          }));
        });

        set({
          currentDay: result.currentDay,
          currentHour: result.currentHour,
          food: result.food,
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

        // 待機村人の自動派遣
        get().dispatchIdleVillagers();
      },
    }),
    {
      name: "fast-slow-life-save-state",
      partialize: (state) => ({
        currentDay: state.currentDay,
        currentHour: state.currentHour,
        gold: state.gold,
        food: state.food,
        soulPoints: state.soulPoints,
        villagers: state.villagers,
        facilities: state.facilities,
        dungeons: state.dungeons,
        inventory: state.inventory,
        targetAmounts: state.targetAmounts,
        logs: state.logs,
        currentTier: state.currentTier,
        activeBoss: state.activeBoss,
        bossDefeated: state.bossDefeated,
        gameLimitDays: state.gameLimitDays,
        gameOver: state.gameOver,
        soulUpgrades: state.soulUpgrades,
      }),
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState) return currentState;

        const merged = { ...currentState, ...persistedState };

        merged.inventory = {
          ...currentState.inventory,
          ...persistedState.inventory,
        };
        merged.targetAmounts = {
          ...currentState.targetAmounts,
          ...persistedState.targetAmounts,
        };

        // 1. ダンジョンのマスタ情報更新 (explorationProgress以外の固定値を最新コードから同期)
        if (persistedState.dungeons) {
          merged.dungeons = currentState.dungeons.map((curD: any) => {
            const persD = persistedState.dungeons.find((d: any) => d.id === curD.id);
            return {
              ...curD,
              explorationProgress: persD ? persD.explorationProgress : 0,
            };
          });
        }

        // 2. 施設の未建設（Lv0）時のアンロックコスト同期
        if (persistedState.facilities) {
          const initialFacs = currentState.facilities;
          merged.facilities = { ...persistedState.facilities };

          Object.keys(merged.facilities).forEach((key) => {
            const fac = merged.facilities[key as FacilityType];
            const initFac = initialFacs[key as FacilityType];
            if (fac && initFac && fac.level === 0) {
              // レベル0（未建設）の場合は、最新の初期コストを適用する
              fac.upgradeCost = { ...initFac.upgradeCost };
            }
          });
        }

        return merged;
      },
    },
  ),
);
