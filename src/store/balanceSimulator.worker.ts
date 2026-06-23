/// <reference types="node" />
import "./setupMockStorage";
import * as fs from "node:fs";
import * as path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import { CATEGORY_GEAR_WEAPON, CATEGORY_GEAR_ARMOR } from "../constants";
import { ITEMS, JOBS, SOUL_UPGRADES, getTrainingProgramsForFacility } from "../data/masterData";
import { FacilityType, JobType } from "../types/game";
import { formatGameTime } from "../utils/timeHelpers";
import { useGameStore } from "./gameStore";

interface SimulationResult {
  run: number;
  isClear: boolean;
  days: number;
  gold: number;
  villagersCount: number;
  averageLevel: number;
  averageBonusStats: number;
  forestExploration: number;
  dungeonsProgress: string;
  deathsCount: number;
  totalHired: number;
  trainingCount: number;
  totalTrainingGold: number;
  highestTrainingLevel: number;
  bossDefeatDays: Record<number, number>;
  gameOverReason: string;
  prestigeCount: number;
  facilitiesFinal: string;
  totalGoldFromExports: number;
  totalGoldFromImports: number;
  totalGoldFromPurchases: number;
  totalGoldFromTax: number;
  townsFinal: string;
  unpaidVillagersCount: number;
  caravansActiveCount: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
}

// 指定された回数分のシミュレーションを回すチャンク実行関数
function runSimulationChunk(
  runs: number,
  startIdx: number,
  initialSoulUpgrades?: Record<string, number>,
): SimulationResult[] {
  const MAX_HOURS = 900 * 24; // 最大900日間 (21600時間)
  const results: SimulationResult[] = [];

  for (let idx = 0; idx < runs; idx++) {
    const run = startIdx + idx;
    const store = useGameStore.getState();

    // プレイごとの転生バフとソウルポイントを完全に初期化
    useGameStore.setState({
      soulPoints: 0,
      soulUpgrades: {
        heritage: 0,
        storage: 0,
        education: 0,
        body: 0,
        building: 0,
        discount: 0,
      },
    });

    let isClear = false;
    let prestigeCount = 0;
    let totalHired = 0;
    let deathsCount = 0;
    let trainingCount = 0;
    let totalTrainingGold = 0;
    let highestTrainingLevel = 0;
    let bossDefeatDays: Record<number, number> = {};
    let traceLog = "";
    let finalState = useGameStore.getState();

    // 最大3回転生を繰り返す
    while (!isClear && prestigeCount < 3) {
      store.resetGame(prestigeCount > 0); // 2回目以降は prestige: true で転生

      // 初回のみ initialSoulUpgrades が指定されていれば全バフ適用
      if (prestigeCount === 0 && initialSoulUpgrades) {
        const current = useGameStore.getState();
        useGameStore.setState({
          soulUpgrades: { ...current.soulUpgrades, ...initialSoulUpgrades },
        });
      }

      // 転生直後、もしSPがあればソウルアップグレードを自動購入
      if (prestigeCount > 0) {
        let state = useGameStore.getState();
        // 購入優先順位: education (経験値) > body (初期ステータス) > building (建築) > discount (転職値引き) > heritage (初期ゴールド) > storage (初期食料)
        const buyPriority = ["education", "body", "building", "discount", "heritage", "storage"];
        let boughtSomething = true;
        while (boughtSomething) {
          boughtSomething = false;
          for (const upId of buyPriority) {
            state = useGameStore.getState();
            const currentLvl = state.soulUpgrades[upId] || 0;
            const uDef = SOUL_UPGRADES.find((u) => u.id === upId);
            if (uDef && currentLvl < uDef.maxLevel) {
              const cost = uDef.costs[currentLvl];
              if (state.soulPoints >= cost) {
                store.buySoulUpgrade(upId);
                boughtSomething = true;
                break;
              }
            }
          }
        }
      }

      useGameStore.setState({
        isPaused: false, // ループを自動で回すため一時停止を解除
      });

      let hoursElapsed = 0;
      let lastVillagersHp: Record<string, number> = {};
      let currentStoreState = useGameStore.getState();
      currentStoreState.villagers.forEach((v) => {
        lastVillagersHp[v.id] = v.currentHp;
      });
      let lastTier = currentStoreState.currentTier;

      while (hoursElapsed < MAX_HOURS) {
        const state = useGameStore.getState();

        if (run === 1 && prestigeCount === 0 && hoursElapsed < 300) {
          // 最初の周回の最初の300時間だけトレース
          traceLog += `[${formatGameTime(state.currentDay, state.currentHour)}] `;
          traceLog += `Gold: ${state.gold}, Wheat: ${state.inventory.wheat || 0}, Veg: ${state.inventory.vegetable || 0}, Meat: ${state.inventory.raw_meat || 0}, Wood: ${state.inventory.wood || 0}, MarketLvl: ${state.facilities.market?.level || 0}, TrainingLvl: ${state.facilities.training_ground?.level || 0}, TrainingQueue: ${state.facilities.training_ground?.trainingQueue?.length || 0}, Unpaid: ${state.isSalaryUnpaid}, `;
          traceLog += `Villagers: ${state.villagers.map((v) => `${v.name}(Lv.${v.level}, ${v.status}, HP:${v.currentHp}/${v.maxHp}, ST:${v.stamina}, Job:${v.currentJob}, Gold:${v.gold}, Bonus:${(v.bonusStr || 0) + (v.bonusInt || 0) + (v.bonusDex || 0) + (v.bonusAgi || 0) + (v.bonusVit || 0)})`).join(" | ")}\n`;
        }

        if (state.gameOver) {
          break;
        }

        // ボス撃破状況の記録 (Tier 1〜4)
        if (state.currentTier > lastTier) {
          bossDefeatDays[lastTier] = state.currentDay;
          lastTier = state.currentTier;
        }
        // Tier 5 のボス撃破検知 (クリア時)
        if (state.currentTier === 5 && state.bossDefeated) {
          if (!bossDefeatDays[5]) {
            bossDefeatDays[5] = state.currentDay;
          }
          break;
        }

        // 村人の戦闘不能検知
        state.villagers.forEach((v) => {
          const lastHp = lastVillagersHp[v.id];
          if (lastHp !== undefined && lastHp > 0 && v.currentHp <= 0) {
            deathsCount++;
          }
        });
        lastVillagersHp = {};
        state.villagers.forEach((v) => {
          lastVillagersHp[v.id] = v.currentHp;
        });

        // --- 自動プレイAIの意思決定ポリシー ---
        const dailySalaryTotal = state.villagers.reduce((sum, v) => {
          if (v.currentJob === "無職") return sum;
          const totalStat = v.str + v.int + v.dex + v.agi + v.vit;
          return sum + Math.floor(totalStat * 0.1);
        }, 0);

        if (state.isSalaryUnpaid) {
          if (state.gold >= dailySalaryTotal) {
            store.payVillagerDebts();
          }
        }

        const isMarketBuilt = state.facilities.market.level > 0;
        const goldReserve = isMarketBuilt ? Math.max(150, dailySalaryTotal * 3) : 500;

        const currentTier = state.currentTier;

        // 1. 目標アイテム設定 of update
        const newTargets: Record<string, number> = { wheat: 20, vegetable: 20, raw_meat: 10 }; // 食材は常にキープ
        if (currentTier >= 1) {
          newTargets.wood = 30;
          newTargets.wood_plank = isMarketBuilt ? 15 : 0; // 交易所やアップグレードに必要な中間素材（交易所が建つまではクラフトしない）
          newTargets.herb = 15;
          newTargets.mushroom = 10;
          newTargets.potion = 5;
          newTargets.wooden_club = 2;
          newTargets.wooden_shield = 2;
        }
        if (currentTier >= 2) {
          newTargets.stone = 25;
          newTargets.copper_ore = 15;
          newTargets.iron_ore = 20;
          newTargets.silver_ore = 20;
          newTargets.iron_ingot = 10;
          newTargets.iron_sword = 3;
          newTargets.iron_armor = 3;
          newTargets.wooden_bow = 2;
          newTargets.leather_armor = 2;
        }
        if (currentTier >= 3) {
          newTargets.silver_ingot = 10;
          newTargets.silver_rapier = 3;
          newTargets.silver_chainmail = 3;
          newTargets.crystal_fragment = 10;
          newTargets.feather = 5;
          newTargets.reinforced_plank = 6;
          newTargets.ultimate_potion = 3;
          newTargets.food_herb_banquet = 3;
        }
        if (currentTier >= 4) {
          newTargets.mana_stone = 20;
          newTargets.ancient_bark = 5;
          newTargets.elixir = 5;
          newTargets.mythril_robe = 2;
          newTargets.mythril_staff = 2;
          newTargets.crystal_powder = 8;
        }
        if (currentTier >= 5) {
          newTargets.dragon_slayer = 3;
          newTargets.dragon_scale_mail = 3;
          newTargets.dark_crystal = 10;
          newTargets.dark_ingot = 6;
          newTargets.food_dragon_feast = 2;
          newTargets.phoenix_tear = 2;
        }

        // ボスが未撃破の間は、レベリングと探索のために主要採取アイテムの目標を適度に大きくする
        if (!state.bossDefeated) {
          if (currentTier === 1) {
            newTargets.wheat = 50;
            newTargets.vegetable = 50;
            newTargets.raw_meat = 30;
            newTargets.wood = 100;
            newTargets.herb = 100;
          } else if (currentTier === 2) {
            newTargets.stone = 100;
            newTargets.iron_ore = 100;
            newTargets.silver_ore = 100;
          } else if (currentTier === 3) {
            newTargets.silver_ore = 100;
            newTargets.crystal_fragment = 100;
          } else if (currentTier === 4) {
            newTargets.mana_stone = 100;
          }
        }
        useGameStore.setState({ targetAmounts: newTargets });

        // 2. 余剰素材の自動交易ルールの設定 (交易所が建設済みの場合のみ)
        if (state.facilities.market.level > 0) {
          Object.entries(newTargets).forEach(([itemId, target]) => {
            const hasRule = state.tradeRules.some((r) => r.itemId === itemId && r.type === "sell");
            if (!hasRule && itemId !== "potion" && itemId !== "elixir") {
              store.addTradeRule(itemId, "sell", target);
            }
          });
        }

        // 3. 村人の自動雇用 (ゴールドに余裕があり、かつ交易所が建っている場合)
        const guild = state.facilities.guild;
        const maxVillagers = 3 + guild.level * 2;
        if (
          isMarketBuilt &&
          state.gold >= 150 + goldReserve &&
          state.villagers.length < Math.min(10, maxVillagers)
        ) {
          store.hireVillager();
          totalHired++;
        }

        // 4. 自動装備アサイン
        const inventoryItems = Object.keys(state.inventory).filter(
          (id) => (state.inventory[id] || 0) > 0,
        );
        state.villagers.forEach((v) => {
          // 武器の自動アサイン
          const weapons = inventoryItems.filter(
            (id) => ITEMS[id]?.category === CATEGORY_GEAR_WEAPON,
          );
          if (weapons.length > 0) {
            let bestWeaponId = "none";
            let maxAtk = -1;
            weapons.forEach((wId) => {
              const atk = ITEMS[wId]?.equipment?.bonuses.attack || 0;
              if (atk > maxAtk) {
                maxAtk = atk;
                bestWeaponId = wId;
              }
            });

            const currentAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
            if (maxAtk > currentAtk && bestWeaponId !== "none") {
              store.equipItem(v.id, bestWeaponId, "weapon");
            }
          }

          // 防具の自動アサイン
          const armors = inventoryItems.filter((id) => ITEMS[id]?.category === CATEGORY_GEAR_ARMOR);
          if (armors.length > 0) {
            let bestArmorId = "none";
            let maxDef = -1;
            armors.forEach((aId) => {
              const d = ITEMS[aId]?.equipment?.bonuses.defense || 0;
              if (d > maxDef) {
                maxDef = d;
                bestArmorId = aId;
              }
            });

            const currentDef = ITEMS[v.armorId]?.equipment?.bonuses.defense || 0;
            if (maxDef > currentDef && bestArmorId !== "none") {
              store.equipItem(v.id, bestArmorId, "armor");
            }
          }
        });

        // 5. 自動転職
        state.villagers.forEach((v, index) => {
          if (!isMarketBuilt) return; // 交易所が建つまでは転職を保留してゴールドを温存

          let desiredJob: JobType = "無職";
          if (index === 0) desiredJob = "職人";
          else if (index === 1) desiredJob = "戦士";
          else if (index === 2) desiredJob = "魔術師";
          else if (index === 3) desiredJob = "農民";
          else if (index === 4) desiredJob = "鉱夫";
          else if (index === 5) desiredJob = "薬師";
          else desiredJob = "戦士";

          if (v.currentJob !== desiredJob) {
            const isFree = v.jobHistory.includes(desiredJob);
            const cost = isFree ? 0 : Math.floor(JOBS[desiredJob].cost * 1.0);
            const requirements = JOBS[desiredJob].requirements;
            let reqLevelMet = true;
            let reqPrevJobsMet = true;

            if (requirements) {
              if (v.level < requirements.level) reqLevelMet = false;
              if (requirements.jobs && requirements.jobs.length > 0) {
                reqPrevJobsMet = requirements.jobs.some((job) => v.jobHistory.includes(job));
              }
            }

            if (reqLevelMet && reqPrevJobsMet && state.gold >= cost + goldReserve) {
              store.changeVillagerJob(v.id, desiredJob);
            } else if (!reqPrevJobsMet) {
              const parentJob = requirements!.jobs![0];
              const parentCost = v.jobHistory.includes(parentJob) ? 0 : JOBS[parentJob].cost;
              if (v.currentJob !== parentJob && state.gold >= parentCost + goldReserve) {
                store.changeVillagerJob(v.id, parentJob);
              }
            }
          }
        });

        // 6. 施設アップグレード自動実行
        const upgradeOrder: FacilityType[] = [
          "market",
          "guild",
          "weapon_shop",
          "training_ground",
          "farm",
          "lumberyard",
          "quarry",
          "workshop",
          "inn",
          "kitchen",
          "alchemy",
        ];
        for (const facId of upgradeOrder) {
          const fac = state.facilities[facId];
          if (fac && fac.level < fac.maxLevel && fac.upgradeTimeLeft === 0) {
            const goldCost = fac.upgradeCost.gold;
            const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
              return (state.inventory[req.itemId] || 0) >= req.count;
            });
            // 交易所が建っていない間は、他の施設（ゴールドが必要なもの）は一切アップグレードしない。
            if (!isMarketBuilt && facId !== "market") continue;

            const requiredReserve = facId === "market" || facId === "guild" ? 0 : 150;
            if (
              (goldCost === 0 || state.gold >= goldCost + requiredReserve + goldReserve) &&
              hasUpgradeMaterials
            ) {
              store.startFacilityUpgrade(facId);
              break;
            }
          }
        }

        // 6.5. 自動訓練（訓練場が利用可能で、待機中の村人に余剰ゴールドがある場合）
        const trainingGround = state.facilities.training_ground;
        if (
          trainingGround &&
          trainingGround.level >= 1 &&
          trainingGround.trainingQueue.length < 3
        ) {
          const availablePrograms = getTrainingProgramsForFacility(trainingGround.level);
          if (availablePrograms.length > 0) {
            const cheapestCost = Math.min(...availablePrograms.map((p) => p.goldCost));
            const idleForTraining = state.villagers.filter(
              (v) =>
                v.status === "idle" &&
                !v.assignedCraftJobId &&
                v.gold >= cheapestCost &&
                // 訓練後に即座に破産しないように最低限のゴールドを残す
                v.gold - cheapestCost >= 50,
            );
            for (const v of idleForTraining) {
              if (trainingGround.trainingQueue.length >= 3) break;
              // 最も低い基本ステータスを伸ばす訓練を選択
              const baseStats = { str: v.str, int: v.int, dex: v.dex, agi: v.agi, vit: v.vit };
              const sortedStats = Object.entries(baseStats).sort(([, a], [, b]) => a - b);
              let chosenProgram = availablePrograms[0];
              for (const [stat] of sortedStats) {
                const prog = availablePrograms.find((p) => {
                  const bonus = p.statBonus[stat as keyof typeof p.statBonus];
                  return bonus !== undefined && bonus > 0 && v.gold >= p.goldCost;
                });
                if (prog) {
                  chosenProgram = prog;
                  break;
                }
              }
              if (v.gold >= chosenProgram.goldCost) {
                store.startTraining(chosenProgram.id, v.id);
                trainingCount++;
                totalTrainingGold += chosenProgram.goldCost;
                if (chosenProgram.requiredFacilityLevel > highestTrainingLevel) {
                  highestTrainingLevel = chosenProgram.requiredFacilityLevel;
                }
              }
            }
          }
        }

        // 7. エリアボス討伐派遣の判断
        let bossId = "";
        let recLvl = 1;
        let dungeonId = "";

        if (currentTier === 1) {
          dungeonId = "forest";
          bossId = "goblin_leader";
          recLvl = 4;
        } else if (currentTier === 2) {
          dungeonId = "mine";
          bossId = "golem";
          recLvl = 10;
        } else if (currentTier === 3) {
          dungeonId = "valley";
          bossId = "chimera";
          recLvl = 20;
        } else if (currentTier === 4) {
          dungeonId = "world_tree";
          bossId = "archdemon";
          recLvl = 22;
        } else if (currentTier === 5) {
          dungeonId = "abyss";
          bossId = "ancient_dragon";
          recLvl = 30;
        }

        const dungeon = state.dungeons.find((d) => d.id === dungeonId);
        if (
          dungeon &&
          dungeon.explorationProgress >= 100 &&
          !state.activeBoss &&
          !state.bossDefeated
        ) {
          const livingVillagers = state.villagers;
          const readyVillagers = livingVillagers.filter(
            (v) => v.currentHp >= v.maxHp * 0.7 && v.stamina >= 20,
          );

          const avgLvl =
            readyVillagers.length > 0
              ? readyVillagers.reduce((sum, v) => sum + v.level, 0) / readyVillagers.length
              : 0;

          if (avgLvl >= recLvl && readyVillagers.length >= Math.min(3, livingVillagers.length)) {
            const vIds = readyVillagers.map((v) => v.id);
            store.startBossBattle(bossId, vIds);
          }
        }

        // 8. 毎時間自動で idle 村人を派遣する
        store.dispatchIdleVillagers();

        // 9. 時間経過
        store.advanceHour();
        hoursElapsed++;
      }

      finalState = useGameStore.getState();
      isClear = finalState.bossDefeated && finalState.currentTier === 5;

      if (isClear) {
        break;
      }

      prestigeCount++;
    }

    const forestDungeon = finalState.dungeons.find((d) => d.id === "forest");
    const avgLvl =
      finalState.villagers.length > 0
        ? finalState.villagers.reduce((sum, v) => sum + v.level, 0) / finalState.villagers.length
        : 0;

    // ゲームオーバー理由を実際の state.gameOverReason から正確に取得
    let actualReason = "Clear";
    if (!isClear) {
      if (finalState.gameOver && finalState.gameOverReason) {
        // ゲームエンジンが出力した理由をそのまま使う（"破産", "期限切れ", "クリア" 等）
        actualReason = finalState.gameOverReason;
      } else if (finalState.villagers.length === 0) {
        actualReason = "VillagersDefeated";
      } else {
        actualReason = "TimeLimit";
      }
    }

    // 平均ボーナスステータス（訓練による成長度合い）
    const avgBonusStats =
      finalState.villagers.length > 0
        ? finalState.villagers.reduce(
            (sum, v) =>
              sum +
              (v.bonusStr || 0) +
              (v.bonusInt || 0) +
              (v.bonusDex || 0) +
              (v.bonusAgi || 0) +
              (v.bonusVit || 0),
            0,
          ) / finalState.villagers.length
        : 0;

    results.push({
      run,
      isClear,
      days: finalState.currentDay,
      gold: finalState.gold,
      villagersCount: finalState.villagers.length,
      averageLevel: avgLvl,
      averageBonusStats: avgBonusStats,
      forestExploration: forestDungeon ? forestDungeon.explorationProgress : 0,
      dungeonsProgress: finalState.dungeons
        .map((d) => `${d.name}:${d.explorationProgress.toFixed(0)}%`)
        .join(", "),
      deathsCount,
      totalHired,
      trainingCount,
      totalTrainingGold,
      highestTrainingLevel,
      bossDefeatDays,
      gameOverReason: actualReason,
      prestigeCount,
      facilitiesFinal: Object.entries(finalState.facilities)
        .filter(([, f]) => f.level > 0)
        .map(([key, f]) => `${key}:Lv${f.level}`)
        .join(", "),
      totalGoldFromExports: finalState.stats?.totalGoldFromExports || 0,
      totalGoldFromImports: finalState.stats?.totalGoldSpentOnImports || 0,
      totalGoldFromPurchases: finalState.stats?.totalGoldFromPurchases || 0,
      totalGoldFromTax: finalState.stats?.totalGoldFromTax || 0,
      townsFinal: finalState.towns.map((t) => `${t.name}:Lv${t.level}(${t.friendship})`).join(", "),
      unpaidVillagersCount: finalState.villagers.filter((v) => v.gold < 0).length,
      caravansActiveCount: finalState.caravans.filter((c) => c.status === "trading").length,
      totalDamageDealt: finalState.stats?.totalDamageDealt || 0,
      totalDamageReceived: finalState.stats?.totalDamageReceived || 0,
    });

    if (run === 1) {
      try {
        const debugDir = path.join(process.cwd(), "debug");
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        fs.writeFileSync(path.join(debugDir, "simulation_trace.txt"), traceLog, "utf-8");
      } catch (e) {
        console.error("Failed to write simulation trace", e);
      }
    }
  }

  return results;
}

// ワーカースレッドのメイン処理
if (!isMainThread) {
  const { runs, runStartIdx, initialSoulUpgrades } = workerData as {
    runs: number;
    runStartIdx: number;
    initialSoulUpgrades?: Record<string, number>;
  };
  const results = runSimulationChunk(runs, runStartIdx, initialSoulUpgrades);
  parentPort?.postMessage(results);
  process.exit(0);
}

export { runSimulationChunk };
export type { SimulationResult };
