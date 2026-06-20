/// <reference types="node" />
import "./setupMockStorage";
import * as fs from "node:fs";
import * as path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import { FacilityType, JobType } from "../types/game";
import { ITEMS, JOBS, useGameStore } from "./gameStore";

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
}

// 指定された回数分のシミュレーションを回すチャンク実行関数
function runSimulationChunk(runs: number, startIdx: number): SimulationResult[] {
  const MAX_HOURS = 900 * 24; // 最大900日間 (21600時間)
  const results: SimulationResult[] = [];

  for (let idx = 0; idx < runs; idx++) {
    const run = startIdx + idx;
    const store = useGameStore.getState();
    store.resetGame(false);

    useGameStore.setState({
      isPaused: false, // ループを自動で回すため一時停止を解除
    });

    let hoursElapsed = 0;
    let bossDefeatDays: Record<number, number> = {};
    let deathsCount = 0;
    let totalHired = 0;
    let lastVillagersHp: Record<string, number> = {};
    store.villagers.forEach((v) => {
      lastVillagersHp[v.id] = v.currentHp;
    });
    let lastTier = store.currentTier;
    let traceLog = "";

    // 毎時間のアクションログやイベントを追跡
    while (hoursElapsed < MAX_HOURS) {
      const state = useGameStore.getState();

      if (run === 1 && hoursElapsed < 300) {
        // 最初の300時間だけトレース
        traceLog += `[Day ${state.currentDay} ${String(state.currentHour).padStart(2, "0")}:00] `;
        traceLog += `Gold: ${state.gold}, Food: ${state.inventory.food?.toFixed(2) || 0}, `;
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
      const currentTier = state.currentTier;

      // 1. 目標アイテム設定の更新
      const newTargets: Record<string, number> = { food: 50 }; // 食料は常にキープ
      if (currentTier >= 1) {
        newTargets.wood = 30;
        newTargets.wood_plank = 15; // 交易所やアップグレードに必要な中間素材
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
          newTargets.food = 120;
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

      // 2. 余剰素材の自動売却 (ゴールド調達、交易所が建設済みの場合のみ)
      if (state.facilities.market.level > 0) {
        Object.entries(state.inventory).forEach(([itemId, count]) => {
          const target = newTargets[itemId] || 0;
          const excess = count - target;
          if (excess > 0 && itemId !== "potion" && itemId !== "elixir") {
            // 余剰分のうち半分を売却して、安定したゴールド源とする
            const toSell = Math.ceil(excess / 2);
            if (toSell > 0) {
              store.sellItem(itemId, toSell);
            }
          }
        });
      }

      // 3. 村人の自動雇用 (ゴールドに余裕があれば)
      const guild = state.facilities.guild;
      const maxVillagers = 3 + guild.level * 2;
      if (state.gold >= 150 && state.villagers.length < Math.min(10, maxVillagers)) {
        store.hireVillager();
        totalHired++;
      }

      // 4. 自動装備アサイン
      const inventoryItems = Object.keys(state.inventory).filter(
        (id) => (state.inventory[id] || 0) > 0,
      );
      state.villagers.forEach((v) => {
        // 武器の自動アサイン
        const weapons = inventoryItems.filter((id) => ITEMS[id]?.category === "gear_weapon");
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
        const armors = inventoryItems.filter((id) => ITEMS[id]?.category === "gear_armor");
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

          const reserve = 50;
          if (reqLevelMet && reqPrevJobsMet && state.gold >= cost + reserve) {
            store.changeVillagerJob(v.id, desiredJob);
          } else if (!reqPrevJobsMet) {
            const parentJob = requirements!.jobs![0];
            const parentCost = v.jobHistory.includes(parentJob) ? 0 : JOBS[parentJob].cost;
            if (v.currentJob !== parentJob && state.gold >= parentCost + reserve) {
              store.changeVillagerJob(v.id, parentJob);
            }
          }
        }
      });

      // 6. 施設アップグレード自動実行
      const upgradeOrder: FacilityType[] = [
        "market",
        "guild",
        "workshop",
        "inn",
        "blacksmith",
        "alchemy",
      ];
      for (const facId of upgradeOrder) {
        const fac = state.facilities[facId];
        if (fac && fac.level < fac.maxLevel && fac.upgradeTimeLeft === 0) {
          const goldCost = fac.upgradeCost.gold;
          const hasUpgradeMaterials = fac.upgradeCost.materials.every((req) => {
            return (state.inventory[req.itemId] || 0) >= req.count;
          });
          const requiredReserve = facId === "market" || facId === "guild" ? 0 : 150;
          if ((goldCost === 0 || state.gold >= goldCost + requiredReserve) && hasUpgradeMaterials) {
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
        recLvl = 32;
      } else if (currentTier === 5) {
        dungeonId = "abyss";
        bossId = "ancient_dragon";
        recLvl = 48;
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

    const finalState = useGameStore.getState();
    const isClear = finalState.bossDefeated && finalState.currentTier === 5;
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
    });

    if (run === 1) {
      try {
        const artifactDir =
          "C:\\Users\\oikawa\\.gemini\\antigravity-ide\\brain\\6f9999c6-7855-4599-9149-e3cdad4d46a6";
        fs.writeFileSync(path.join(artifactDir, "simulation_trace.txt"), traceLog, "utf-8");

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
