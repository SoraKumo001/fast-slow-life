import {
  BASE_GREAT_SUCCESS_RATE,
  CRAFT_QUEUE_MAX_LENGTH,
  UPGRADE_COST_GOLD_MULTIPLIER,
  UPGRADE_COST_MATERIAL_INCREMENT,
  CRAFT_DEX_FACTOR,
  CRAFT_WAGE_BASE,
  CRAFT_WAGE_DEX_FACTOR,
  CRAFT_WAGE_CRAFTER_MULTIPLIER,
} from "../constants";
import {
  ITEMS,
  getRecipeForItem,
  getRecipesForFacility,
  getTrainingProgram,
  getTrainingProgramsForFacility,
} from "../data/masterData";
import { Villager, VillagerBonuses, Facility, FacilityType, RunStats } from "../types/game";
import { calculateCraftTime, generateId } from "../utils/craftHelpers";
import { LogPayload } from "./gameLoopTypes";

export function processCraftingAndUpgrades(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  _soulUpgrades: Record<string, number>,
  gold: number = 0,
  stats?: RunStats,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };
  let currentGold = gold;

  Object.keys(nextFacilities).forEach((facKey) => {
    const fac = { ...nextFacilities[facKey as FacilityType] };

    if (fac.upgradeTimeLeft > 0) {
      fac.upgradeTimeLeft -= 1;
      if (fac.upgradeTimeLeft === 0) {
        fac.level += 1;
        logs.push({
          message: `${fac.name} のアップグレードが完了し、Lv.${fac.level} になりました！`,
          type: "upgrade",
        });

        fac.upgradeCost = {
          gold: fac.level * UPGRADE_COST_GOLD_MULTIPLIER,
          materials: fac.upgradeCost.materials.map((m) => ({
            ...m,
            count: m.count + UPGRADE_COST_MATERIAL_INCREMENT,
          })),
        };
      }
    }

    const nextQueue: typeof fac.craftQueue = [];
    fac.craftQueue.forEach((job) => {
      const updatedJob = { ...job };
      updatedJob.timeLeft -= 1;
      if (updatedJob.timeLeft <= 0) {
        let successBonus = BASE_GREAT_SUCCESS_RATE;
        if (updatedJob.assignedVillagerId) {
          const v = nextVillagers.find((villager) => villager.id === updatedJob.assignedVillagerId);
          if (v) {
            if (v.currentJob === "職人") {
              successBonus = 0.12;
            } else {
              successBonus = 0.05 + (v.dex - 10) * CRAFT_DEX_FACTOR;
            }
          }
        }
        const isGreatSuccess = Math.random() < successBonus;
        const recipe = getRecipeForItem(updatedJob.itemId);
        const craftCount = (recipe?.outputCount || 1) * (isGreatSuccess ? 2 : 1);

        if (stats) stats.totalItemsCrafted += craftCount;
        nextInventory[updatedJob.itemId] = (nextInventory[updatedJob.itemId] || 0) + craftCount;

        logs.push({
          message: `${fac.name} で ${ITEMS[updatedJob.itemId]?.name || updatedJob.itemId} の加工が完了しました！${isGreatSuccess ? "【大成功！2倍獲得】" : ""}`,
          type: "craft",
        });

        if (updatedJob.assignedVillagerId) {
          const idx = nextVillagers.findIndex((v) => v.id === updatedJob.assignedVillagerId);
          if (idx !== -1) {
            const worker = nextVillagers[idx];
            // 工賃計算: (基本額 + Dex補正) × 職人ボーナス
            const jobMultiplier =
              worker.currentJob === "職人" ? CRAFT_WAGE_CRAFTER_MULTIPLIER : 1.0;
            const wage = Math.floor(
              (CRAFT_WAGE_BASE + worker.dex * CRAFT_WAGE_DEX_FACTOR) * jobMultiplier,
            );
            currentGold -= wage;
            worker.gold += wage;
            if (stats) stats.totalGoldFromPurchases += wage;

            logs.push({
              message: `${worker.name} に工賃 ${wage} G を支払いました。（Dex: ${worker.dex}${worker.currentJob === "職人" ? "、職人ボーナス×1.5" : ""}）`,
              type: "info",
            });

            nextVillagers[idx] = {
              ...worker,
              status: "idle",
              assignedCraftJobId: null,
            };
          }
        }
      } else {
        nextQueue.push(updatedJob);
      }
    });
    fac.craftQueue = nextQueue;

    // 訓練キュー処理（訓練場のみ）
    if (fac.id === "training_ground" && fac.trainingQueue.length > 0) {
      const nextTrainingQueue: typeof fac.trainingQueue = [];
      fac.trainingQueue.forEach((job) => {
        const updatedJob = { ...job };
        const vIdx = nextVillagers.findIndex((v) => v.id === updatedJob.assignedVillagerId);

        if (vIdx === -1) {
          // 村人が見つからない（削除された等）→訓練破棄
          return;
        }

        const v = { ...nextVillagers[vIdx] };

        // 訓練費の引き落とし（村人の所持金 → プレイヤー）
        const cost = updatedJob.goldPerHour;
        if (v.gold < cost) {
          // 所持金不足 → 訓練中断
          logs.push({
            message: `${v.name} は訓練費(${cost}G)を支払えなかったため、訓練を中断しました。（所持金: ${v.gold} G）`,
            type: "warning",
          });
          nextVillagers[vIdx] = {
            ...v,
            status: "idle",
            assignedCraftJobId: null,
          };
          return; // このジョブは破棄（nextTrainingQueueに追加しない）
        }

        v.gold -= cost;
        currentGold += cost;

        // 時間経過
        updatedJob.timeLeft -= 1;

        if (updatedJob.timeLeft <= 0) {
          // 訓練完了 → ステータス上昇
          const program = getTrainingProgram(updatedJob.programId);
          if (program) {
            const bonusMap: Record<string, keyof VillagerBonuses> = {
              str: "bonusStr",
              int: "bonusInt",
              dex: "bonusDex",
              agi: "bonusAgi",
              vit: "bonusVit",
            };
            const statNames = Object.keys(program.statBonus) as (keyof typeof program.statBonus)[];
            const statParts: string[] = [];
            const updatedV = { ...v } as Villager;

            statNames.forEach((stat) => {
              const bonus = program.statBonus[stat] || 0;
              if (stat === "maxHp") {
                updatedV.maxHp += bonus;
                updatedV.currentHp += bonus;
                statParts.push(`HP+${bonus}`);
              } else if (stat === "maxStamina") {
                updatedV.maxStamina += bonus;
                updatedV.stamina += bonus;
                statParts.push(`スタミナ+${bonus}`);
              } else if (
                stat === "str" ||
                stat === "int" ||
                stat === "dex" ||
                stat === "agi" ||
                stat === "vit"
              ) {
                const bonusKey = bonusMap[stat];
                updatedV[bonusKey] = (updatedV[bonusKey] || 0) + bonus;
                statParts.push(`${stat.toUpperCase()}+${bonus}`);
              }
            });

            // 大成功判定（職人ボーナス適用）
            let successBonus = BASE_GREAT_SUCCESS_RATE;
            if (v.currentJob === "職人") {
              successBonus = 0.12;
            }
            const isGreatSuccess = Math.random() < successBonus;
            if (isGreatSuccess) {
              // 大成功: 効果2倍 → もう一度加算
              statNames.forEach((stat) => {
                const bonus = program.statBonus[stat] || 0;
                if (stat === "maxHp") {
                  updatedV.maxHp += bonus;
                  updatedV.currentHp += bonus;
                } else if (stat === "maxStamina") {
                  updatedV.maxStamina += bonus;
                  updatedV.stamina += bonus;
                } else if (
                  stat === "str" ||
                  stat === "int" ||
                  stat === "dex" ||
                  stat === "agi" ||
                  stat === "vit"
                ) {
                  const bonusKey = bonusMap[stat];
                  updatedV[bonusKey] = (updatedV[bonusKey] || 0) + bonus;
                }
              });
            }

            updatedV.status = "idle";
            updatedV.assignedCraftJobId = null;
            nextVillagers[vIdx] = updatedV as Villager;

            logs.push({
              message: `${v.name} が訓練「${program.name}」を完了しました！${statParts.join("、")}${isGreatSuccess ? "【大成功！効果2倍】" : ""}`,
              type: "craft",
            });
          }
        } else {
          nextTrainingQueue.push(updatedJob);
          nextVillagers[vIdx] = v as Villager;
        }
      });
      fac.trainingQueue = nextTrainingQueue;
    }

    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
    gold: currentGold,
    logs,
  };
}

export function processAutoCraft(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
  inventory: Record<string, number>,
  targetAmounts: Record<string, number>,
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];
  const nextInventory = { ...inventory };

  Object.keys(nextFacilities).forEach((facKey) => {
    const fac = { ...nextFacilities[facKey as FacilityType] };
    if (fac.level > 0 && fac.craftQueue.length < CRAFT_QUEUE_MAX_LENGTH) {
      getRecipesForFacility(fac.id, fac.level).forEach((recipe) => {
        const itemId = recipe.resultItemId;
        const item = ITEMS[itemId];
        if (item) {
          const currentCount = nextInventory[itemId] || 0;
          const inQueueCount = fac.craftQueue.filter((j) => j.itemId === itemId).length;
          const target = targetAmounts[itemId] || 0;

          if (currentCount + inQueueCount < target) {
            const hasMaterials = recipe.requiredItems.every(
              (req) => (nextInventory[req.itemId] || 0) >= req.count,
            );
            if (hasMaterials) {
              recipe.requiredItems.forEach((req) => {
                nextInventory[req.itemId] = Math.max(
                  0,
                  (nextInventory[req.itemId] || 0) - req.count,
                );
              });

              const idleCrafter = nextVillagers.find(
                (v) => v.status === "idle" && v.currentJob === "職人",
              );
              const idleAny = nextVillagers.find((v) => v.status === "idle");
              const assignedId = (idleCrafter || idleAny)?.id || null;

              const jobId = generateId();
              const baseTime = recipe.requiredTime;
              const assignedVillager = assignedId
                ? nextVillagers.find((v) => v.id === assignedId)
                : null;
              const timeNeeded = calculateCraftTime(baseTime, assignedVillager);

              fac.craftQueue.push({
                id: jobId,
                itemId,
                timeLeft: timeNeeded,
                totalTime: timeNeeded,
                assignedVillagerId: assignedId,
              });

              if (assignedId) {
                const idx = nextVillagers.findIndex((v) => v.id === assignedId);
                nextVillagers[idx] = {
                  ...nextVillagers[idx],
                  status: "active",
                  assignedCraftJobId: jobId,
                };
              }

              logs.push({
                message: `【自動クラフト】${fac.name} で ${item.name} の生産を開始しました。`,
                type: "craft",
              });
            }
          }
        }
      });
    }
    nextFacilities[facKey as FacilityType] = fac;
  });

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    inventory: nextInventory,
    logs,
  };
}

const TRAINING_QUEUE_MAX_LENGTH = 3;
const TRAINING_GOLD_THRESHOLD = 300; // 訓練を開始するための最低所持金

// 村人の最も低い基本ステータス（bonus除く生値）を強化する訓練を選択
function getBestTrainingProgram(
  villager: Villager,
  availablePrograms: ReturnType<typeof getTrainingProgramsForFacility>,
) {
  const baseStats = {
    str: villager.str,
    int: villager.int,
    dex: villager.dex,
    agi: villager.agi,
    vit: villager.vit,
  };

  // 各ステータスの低い順にソート
  const sorted = Object.entries(baseStats).sort(([, a], [, b]) => a - b);

  // 最も低いステータスを強化するプログラムを探す
  for (const [stat] of sorted) {
    const program = availablePrograms.find((p) => {
      const bonus = p.statBonus[stat as keyof typeof p.statBonus];
      return bonus !== undefined && bonus > 0;
    });
    if (program) return program;
  }

  // どれも該当しなければ最初のプログラム
  return availablePrograms[0];
}

export function processAutoTraining(
  facilities: Record<FacilityType, Facility>,
  villagers: Villager[],
) {
  const logs: LogPayload[] = [];
  const nextFacilities = { ...facilities };
  const nextVillagers = [...villagers];

  const trainingGround = nextFacilities.training_ground;
  if (!trainingGround || trainingGround.level < 1) {
    return { facilities: nextFacilities, villagers: nextVillagers, logs };
  }

  const queue = trainingGround.trainingQueue;
  const activeCount = queue.length;
  const availablePrograms = getTrainingProgramsForFacility(trainingGround.level);

  if (activeCount >= TRAINING_QUEUE_MAX_LENGTH || availablePrograms.length === 0) {
    return { facilities: nextFacilities, villagers: nextVillagers, logs };
  }

  // 待機中の村人を走査
  for (const v of nextVillagers) {
    if (queue.length >= TRAINING_QUEUE_MAX_LENGTH) break;
    if (v.status !== "idle") continue;
    if (v.gold < TRAINING_GOLD_THRESHOLD) continue;

    const program = getBestTrainingProgram(v, availablePrograms);
    if (!program) continue;
    if (v.gold < program.goldCost) continue;

    // 自動訓練開始
    const jobId = generateId();
    const goldPerHour = Math.ceil(program.goldCost / program.requiredTime);

    queue.push({
      id: jobId,
      programId: program.id,
      timeLeft: program.requiredTime,
      totalTime: program.requiredTime,
      assignedVillagerId: v.id,
      goldPerHour,
    });

    const idx = nextVillagers.findIndex((villager) => villager.id === v.id);
    nextVillagers[idx] = {
      ...v,
      status: "active",
      assignedCraftJobId: jobId,
    } as Villager;

    logs.push({
      message: `【自動訓練】${v.name} が訓練「${program.name}」を開始しました。（所要: ${program.requiredTime}時間、総額: ${program.goldCost} G）`,
      type: "craft",
    });
  }

  trainingGround.trainingQueue = queue;
  nextFacilities.training_ground = trainingGround;

  return {
    facilities: nextFacilities,
    villagers: nextVillagers,
    logs,
  };
}
