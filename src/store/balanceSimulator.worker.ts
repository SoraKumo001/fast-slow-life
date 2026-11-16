/// <reference types="node" />
import "./setupMockStorage";
import * as fs from "node:fs";
import * as path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import { CATEGORY_GEAR_ARMOR, CATEGORY_GEAR_WEAPON } from "../constants";
import {
  ITEMS,
  JOBS,
  SOUL_UPGRADES,
  getSoulUpgradeCost,
  getTrainingProgramsForFacility,
} from "../data/masterData";
import { FacilityType, JobType, Villager } from "../types/game";
import { formatGameTime } from "../utils/timeHelpers";
import { useGameStore } from "./gameStore";
import { seedRandom } from "./random";
import { setSimMode } from "./simMode";

/**
 * 倉庫にある武器から、現在の装備より attack が高い武器を選ぶ。
 * 自動アサイン専用ヘルパー (balanceSimulator 内で store action を呼ばないため)。
 */
function bestWeaponIdFor(v: Villager, inventoryItems: string[]): string {
  const weapons = inventoryItems.filter((id) => ITEMS[id]?.category === CATEGORY_GEAR_WEAPON);
  if (weapons.length === 0) return v.weaponId;

  let bestId = v.weaponId;
  let bestAtk = ITEMS[v.weaponId]?.equipment?.bonuses.attack || 0;
  for (const wId of weapons) {
    const atk = ITEMS[wId]?.equipment?.bonuses.attack || 0;
    if (atk > bestAtk) {
      bestAtk = atk;
      bestId = wId;
    }
  }
  return bestId;
}

/**
 * 倉庫にある防具から、現在の装備より defense が高い防具を選ぶ。
 */
function bestArmorIdFor(v: Villager, inventoryItems: string[]): string {
  const armors = inventoryItems.filter((id) => ITEMS[id]?.category === CATEGORY_GEAR_ARMOR);
  if (armors.length === 0) return v.armorId;

  let bestId = v.armorId;
  let bestDef = ITEMS[v.armorId]?.equipment?.bonuses.defense || 0;
  for (const aId of armors) {
    const def = ITEMS[aId]?.equipment?.bonuses.defense || 0;
    if (def > bestDef) {
      bestDef = def;
      bestId = aId;
    }
  }
  return bestId;
}

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
  /** Phase 5: そのランで襲撃イベントが1回でも発生したか (state.raid の観測) */
  raidOccurred: boolean;
  /** Phase 5: 転生サイクルごとの終了理由 (診断用) */
  cycleEnds: string[];
  /** Sim改善: このランの乱数シード (= ラン番号) */
  seed: number;
  /** Sim改善: 実行した総ティック数 (全サイクルの経過時間の合計) */
  ticks: number;
  /** Sim改善: このランの実時間 (ms) */
  wallMs: number;
  /** Sim改善: 1周目 (転生0回) でクリアしたか */
  cycle1Clear: boolean;
  /** Sim改善: 襲撃イベントの発生回数 (state.raid の立ち上がり回数) */
  raidCount: number;
  /** Sim改善: ボス戦を開始した回数 */
  bossAttempts: number;
  /**
   * Sim改善: ボス撃破に至らず交戦が終了した回数。
   * activeBoss が非null→null へ遷移し、かつ Tier が進まず bossDefeated でない場合に数える
   * (全滅による破棄と Phase 6 の離脱リセットの合算)。
   */
  bossDisengages: number;
}

// 指定されたシード列のシミュレーションを実行する本体。
// 各ランは seed = ラン番号 で乱数源を初期化するため、同一設定・同一シードでは
// ラン結果が完全に一致する (バランスシミュレーション改善・柱1)。
function runSimulationForSeeds(
  seeds: number[],
  initialSoulUpgrades?: Record<string, number>,
  onResult?: (result: SimulationResult) => void,
): SimulationResult[] {
  const MAX_HOURS = 900 * 24; // 最大900日間 (21600時間)
  const results: SimulationResult[] = [];
  setSimMode(true);

  for (const run of seeds) {
    const runStartedAt = performance.now();
    seedRandom(run);
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
    let raidOccurred = false;
    let raidCount = 0;
    let bossAttempts = 0;
    let bossDisengages = 0;
    let totalTicks = 0;
    let cycle1Clear = false;
    const cycleEnds: string[] = [];
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
              // Phase 6 の価格逓増と同一の実価格で判定する。素の価格で判定すると
              // buySoulUpgrade が SP 不足で無言で失敗し、無限ループになる。
              const cost = getSoulUpgradeCost(uDef.costs[currentLvl], state.prestigeCount ?? 0);
              if (state.soulPoints >= cost) {
                store.buySoulUpgrade(upId);
                // 購入が実際に行われた場合のみループを継続する (防御策)
                const afterLvl = useGameStore.getState().soulUpgrades[upId] || 0;
                if (afterLvl > currentLvl) {
                  boughtSomething = true;
                  break;
                }
              }
            }
          }
        }
      }

      useGameStore.setState({
        isPaused: false, // ループを自動で回すため一時停止を解除
      });

      let hoursElapsed = 0;
      let prevRaidPresent = false;
      let prevHasBoss = false;
      let tierAtBossStart = 1;
      let lastVillagersHp: Record<string, number> = {};
      let currentStoreState = useGameStore.getState();
      currentStoreState.villagers.forEach((v) => {
        lastVillagersHp[v.id] = v.currentHp;
      });
      let lastTier = currentStoreState.currentTier;

      while (hoursElapsed < MAX_HOURS) {
        const state = useGameStore.getState();

        // 襲撃イベントの発生観測 (Phase 5 バランス計測用)
        if (state.raid) raidOccurred = true;
        if (state.raid && !prevRaidPresent) raidCount++;
        prevRaidPresent = !!state.raid;

        // ボス交戦の終了 (撃破以外) の観測: Tier が進まず activeBoss が消えたら離脱/破棄
        const hasBossNow = !!state.activeBoss;
        if (hasBossNow && !prevHasBoss) tierAtBossStart = state.currentTier;
        if (
          prevHasBoss &&
          !hasBossNow &&
          state.currentTier === tierAtBossStart &&
          !state.bossDefeated
        ) {
          bossDisengages++;
        }
        prevHasBoss = hasBossNow;

        if (run === 1 && prestigeCount === 0 && hoursElapsed < 300) {
          // 最初の周回の最初の300時間だけトレース
          traceLog += `[${formatGameTime(state.currentDay, state.currentHour)}] `;
          traceLog += `Gold: ${state.gold}, Wheat: ${state.inventory.wheat || 0}, Meat: ${state.inventory.raw_meat || 0}, Wood: ${state.inventory.wood || 0}, MarketLvl: ${state.facilities.market?.level || 0}, TrainingLvl: ${state.facilities.training_ground?.level || 0}, TrainingQueue: ${state.facilities.training_ground?.trainingQueue?.length || 0}, Unpaid: ${state.isSalaryUnpaid}, `;
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

        const isMarketBuilt = state.facilities.market.level > 0;
        const goldReserve = isMarketBuilt ? Math.max(150, dailySalaryTotal * 3) : 500;

        const currentTier = state.currentTier;

        // 1. 目標アイテム設定 of update
        const newTargets: Record<string, number> = {
          wheat: 30,
          raw_meat: 10,
        }; // 食材は常にキープ
        if (currentTier >= 1) {
          newTargets.wood = 30;
          newTargets.wood_plank = isMarketBuilt ? 15 : 0; // 交易所やアップグレードに必要な中間素材（交易所が建つまではクラフトしない）
          newTargets.herb = 20;
          newTargets.potion = 5;
          newTargets.wooden_club = 2;
          newTargets.wooden_shield = 2;
        }
        if (currentTier >= 2) {
          newTargets.stone = 25;
          newTargets.iron_ore = 25;
          newTargets.silver_ore = 20;
          newTargets.iron_ingot = 10;
          newTargets.iron_sword = 3;
          newTargets.iron_armor = 3;
          newTargets.leather_armor = 2;
        }
        if (currentTier >= 3) {
          newTargets.silver_ingot = 10;
          newTargets.silver_rapier = 3;
          newTargets.silver_chainmail = 3;
          newTargets.crystal_fragment = 15;
          newTargets.high_potion = 3;
          newTargets.food_beast_roast = 3;
        }
        if (currentTier >= 4) {
          newTargets.mana_stone = 20;
          newTargets.elixir = 5;
          newTargets.mythril_robe = 2;
          newTargets.mythril_staff = 2;
        }
        if (currentTier >= 5) {
          newTargets.dragon_slayer = 3;
          newTargets.dragon_scale_mail = 3;
          newTargets.dark_crystal = 10;
          newTargets.dark_ingot = 6;
          newTargets.food_dragon_hotpot = 2;
        }

        // ボスが未撃破の間は、レベリングと探索のために主要採取アイテムの目標を適度に大きくする
        if (!state.bossDefeated) {
          if (currentTier === 1) {
            newTargets.wheat = 80;
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

        // 4. 自動装備アサイン (ヘルパー関数で直接 state を更新)
        const inventoryItems = Object.keys(state.inventory).filter(
          (id) => (state.inventory[id] || 0) > 0,
        );
        state.villagers = state.villagers.map((v) => {
          const newWeaponId = bestWeaponIdFor(v, inventoryItems);
          const newArmorId = bestArmorIdFor(v, inventoryItems);
          if (newWeaponId === v.weaponId && newArmorId === v.armorId) return v;
          return { ...v, weaponId: newWeaponId, armorId: newArmorId };
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
            // 高いレベルの訓練プログラムを優先するため降順ソート
            const programsByLevel = [...availablePrograms].sort(
              (a, b) => b.requiredFacilityLevel - a.requiredFacilityLevel,
            );
            for (const v of idleForTraining) {
              if (trainingGround.trainingQueue.length >= 3) break;
              // 最も低い基本ステータスを伸ばす訓練を選択
              const baseStats = {
                str: v.str,
                int: v.int,
                dex: v.dex,
                agi: v.agi,
                vit: v.vit,
              };
              const sortedStats = Object.entries(baseStats).sort(([, a], [, b]) => a - b);
              let chosenProgram = programsByLevel[0];
              for (const [stat] of sortedStats) {
                const prog = programsByLevel.find((p) => {
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
            bossAttempts++;
          }
        }

        // 8. 毎時間自動で idle 村人を派遣する
        store.dispatchIdleVillagers();

        // 9. 時間経過
        store.advanceHour();
        hoursElapsed++;
      }

      totalTicks += hoursElapsed;
      finalState = useGameStore.getState();
      isClear = finalState.bossDefeated && finalState.currentTier === 5;
      if (prestigeCount === 0) cycle1Clear = isClear;

      cycleEnds.push(
        isClear
          ? "Clear"
          : finalState.gameOver && finalState.gameOverReason
            ? finalState.gameOverReason
            : "TimeLimit",
      );

      // 診断用 (SIM_DEBUG_CYCLE=1 のときだけ): サイクル終了時点のスナップショット
      if (process.env.SIM_DEBUG_CYCLE) {
        const avgLvl =
          finalState.villagers.length > 0
            ? finalState.villagers.reduce((s, v) => s + v.level, 0) / finalState.villagers.length
            : 0;
        console.log(
          `[sim] run=${run} cycle=${prestigeCount} end=${cycleEnds[cycleEnds.length - 1]} ` +
            `day=${finalState.currentDay} tier=${finalState.currentTier} gold=${Math.round(finalState.gold)} ` +
            `avgLvl=${avgLvl.toFixed(1)} deaths=${deathsCount} soul=${JSON.stringify(finalState.soulUpgrades)} ` +
            `expl=${finalState.dungeons.map((d) => `${d.id}:${Math.round(d.explorationProgress)}`).join(",")}`,
        );
      }

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
      townsFinal: finalState.towns.map((t) => `${t.name}(投資Lv${t.investLevel})`).join(", "),
      unpaidVillagersCount: finalState.villagers.filter((v) => v.gold < 0).length,
      caravansActiveCount: finalState.caravans.filter((c) => c.status === "trading").length,
      totalDamageDealt: finalState.stats?.totalDamageDealt || 0,
      totalDamageReceived: finalState.stats?.totalDamageReceived || 0,
      raidOccurred,
      cycleEnds,
      seed: run,
      ticks: totalTicks,
      wallMs: Math.round(performance.now() - runStartedAt),
      cycle1Clear,
      raidCount,
      bossAttempts,
      bossDisengages,
    });
    if (onResult) onResult(results[results.length - 1]);

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

// 指定された回数分のシミュレーションを回すチャンク実行関数 (従来API互換)
function runSimulationChunk(
  runs: number,
  startIdx: number,
  initialSoulUpgrades?: Record<string, number>,
): SimulationResult[] {
  const seeds = Array.from({ length: runs }, (_, i) => startIdx + i);
  return runSimulationForSeeds(seeds, initialSoulUpgrades);
}

// ワーカースレッドのメイン処理
if (!isMainThread) {
  const data = workerData as {
    runs?: number;
    runStartIdx?: number;
    seeds?: number[];
    stream?: boolean;
    initialSoulUpgrades?: Record<string, number>;
  };
  const seeds =
    data.seeds ?? Array.from({ length: data.runs ?? 0 }, (_, i) => (data.runStartIdx ?? 1) + i);
  if (data.stream) {
    // CLI 用: ラン完了ごとに結果を逐次送信し、中断されても完了分は失われない
    runSimulationForSeeds(seeds, data.initialSoulUpgrades, (result) => {
      parentPort?.postMessage({ type: "result", result });
    });
    parentPort?.postMessage({ type: "done", count: seeds.length });
  } else {
    const results = runSimulationForSeeds(seeds, data.initialSoulUpgrades);
    parentPort?.postMessage(results);
  }
  process.exit(0);
}

export { runSimulationChunk, runSimulationForSeeds };
export type { SimulationResult };
