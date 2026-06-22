/// <reference types="node" />
import "./setupMockStorage";
import * as fs from "node:fs";
import * as path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import { CATEGORY_GEAR_WEAPON, CATEGORY_GEAR_ARMOR } from "../constants";
import { ITEMS, JOBS, SOUL_UPGRADES } from "../data/masterData";
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
  forestExploration: number;
  dungeonsProgress: string;
  deathsCount: number;
  totalHired: number;
  bossDefeatDays: Record<number, number>;
  gameOverReason: string;
  prestigeCount: number;
}

// 指定された回数分のシミュレーションを回すチャンク実行関数
function runSimulationChunk(runs: number, startIdx: number): SimulationResult[] {
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
    let bossDefeatDays: Record<number, number> = {};
    let traceLog = "";
    let finalState = useGameStore.getState();

    // 最大3回転生を繰り返す
    while (!isClear && prestigeCount < 3) {
      store.resetGame(prestigeCount > 0); // 2回目以降は prestige: true で転生

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
              const cost = uDef.costPerLevel * (currentLvl + 1);
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
          traceLog += `Gold: ${state.gold}, Wheat: ${state.inventory.wheat || 0}, Veg: ${state.inventory.vegetable || 0}, Meat: ${state.inventory.raw_meat || 0}, Wood: ${state.inventory.wood || 0}, MarketLvl: ${state.facilities.market?.level || 0}, Unpaid: ${state.isSalaryUnpaid}, `;
          traceLog += `Villagers: ${state.villagers.map((v) => `${v.name}(Lv.${v.level}, ${v.status}, HP:${v.currentHp}/${v.maxHp}, ST:${v.stamina}, Job:${v.currentJob})`).join(" | ")}\n`;
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
        }
        if (currentTier >= 2) {
          newTargets.stone = 25;
          newTargets.copper_ore = 15;
          newTargets.iron_ore = 20;
          newTargets.silver_ore = 20;
          newTargets.iron_ingot = 10;
          newTargets.iron_sword = 3;
          newTargets.iron_armor = 3;
        }
        if (currentTier >= 3) {
          newTargets.silver_ingot = 10;
          newTargets.silver_rapier = 3;
          newTargets.silver_chainmail = 3;
          newTargets.crystal_fragment = 10;
          newTargets.feather = 5;
        }
        if (currentTier >= 4) {
          newTargets.mana_stone = 20;
          newTargets.ancient_bark = 5;
          newTargets.elixir = 5;
          newTargets.mythril_robe = 2;
          newTargets.mythril_staff = 2;
        }
        if (currentTier >= 5) {
          newTargets.dragon_slayer = 3;
          newTargets.dragon_scale_mail = 3;
          newTargets.dark_crystal = 5;
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
          "farm",
          "lumberyard",
          "quarry",
          "workshop",
          "kitchen",
          "inn",
          "blacksmith",
          "alchemy",
          "weapon_shop",
          "pharmacy",
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

    let actualReason = "Clear";
    if (!isClear) {
      if (finalState.gameOver && finalState.villagers.length === 0) {
        actualReason = "VillagersDefeated";
      } else {
        actualReason = "TimeLimit";
      }
    }

    results.push({
      run,
      isClear,
      days: finalState.currentDay,
      gold: finalState.gold,
      villagersCount: finalState.villagers.length,
      averageLevel: avgLvl,
      forestExploration: forestDungeon ? forestDungeon.explorationProgress : 0,
      dungeonsProgress: finalState.dungeons
        .map((d) => `${d.name}:${d.explorationProgress.toFixed(0)}%`)
        .join(", "),
      deathsCount,
      totalHired,
      bossDefeatDays,
      gameOverReason: actualReason,
      prestigeCount,
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
  const { runs, runStartIdx } = workerData;
  const results = runSimulationChunk(runs, runStartIdx);
  parentPort?.postMessage(results);
  process.exit(0);
}

export { runSimulationChunk };
export type { SimulationResult };
