import * as fs from "fs";
import * as path from "path";

import { describe, it } from "vitest";

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

describe("Balance Simulator", () => {
  it("Run game balance simulation (100 times)", () => {
    const RUNS = 100;
    const MAX_HOURS = 250 * 24; // 最大250日間 (6000時間)
    const results: SimulationResult[] = [];

    console.log(`Starting ${RUNS} runs of fast-slow-life simulation...`);

    for (let run = 1; run <= RUNS; run++) {
      const store = useGameStore.getState();
      store.resetGame(false);

      // 初期雇用上限 of 増加などのバフがないプレーンなテスト状態にするため、
      // リセット後に手動で initial 状態を再設定する
      useGameStore.setState({
        isPaused: false, // ループを自動で回すため一時停止を解除
      });

      let hoursElapsed = 0;
      let bossDefeatDays: Record<number, number> = {};
      let deathsCount = 0;
      let totalHired = 0;
      let lastVillagersCount = store.villagers.length;
      let traceLog = "";

      // 毎時間のアクションログやイベントを追跡
      while (hoursElapsed < MAX_HOURS) {
        const state = useGameStore.getState();

        if (run === 1 && hoursElapsed < 300) {
          // 最初の300時間だけトレース
          traceLog += `[Day ${state.currentDay} ${String(state.currentHour).padStart(2, "0")}:00] `;
          traceLog += `Gold: ${state.gold}, Food: ${state.inventory.food?.toFixed(2) || 0}, `;
          traceLog += `Villagers: ${state.villagers.map((v) => `${v.name}(Lv.${v.level}, ${v.status}, HP:${v.currentHp}/${v.maxHp}, ST:${v.stamina}, Job:${v.currentJob})`).join(" | ")}\n`;
          if (state.logs.length > 0) {
            // 最新の3件のログを出力
            traceLog += `  Logs: ${state.logs
              .slice(0, 3)
              .map((l) => l.message)
              .join(" / ")}\n`;
          }
        }

        if (state.gameOver) {
          break;
        }

        // ボス撃破状況の記録
        if (state.bossDefeated && !bossDefeatDays[state.currentTier]) {
          bossDefeatDays[state.currentTier] = state.currentDay;
          // ボスが倒されたら次のTierへ自動移行 (Tier 5が最終)
          if (state.currentTier < 5) {
            // ストアを次のTierに進める
            const nextTier = state.currentTier + 1;
            useGameStore.setState({
              currentTier: nextTier,
              bossDefeated: false,
              gameLimitDays: [0, 30, 70, 120, 180, 250][nextTier],
            });
            store.addLog(`【システム】Tier ${nextTier} に移行しました！`, "system");
          } else {
            // Tier 5 のボス (ancient_dragon) を倒した場合はゲームクリア
            break;
          }
        }

        // 村人の死亡検知
        if (state.villagers.length < lastVillagersCount) {
          deathsCount += lastVillagersCount - state.villagers.length;
        }
        lastVillagersCount = state.villagers.length;

        // --- 自動プレイAIの意思決定ポリシー ---
        const currentTier = state.currentTier;

        // 1. 目標アイテム設定の更新
        const newTargets: Record<string, number> = { food: 50 }; // 食料は常にキープ
        if (currentTier >= 1) {
          newTargets.wood = 30;
          newTargets.wood_plank = 15; // 交易所やアップグレードに必要な中間素材
          newTargets.herb = 15;
          newTargets.potion = 5;
        }
        if (currentTier >= 2) {
          newTargets.stone = 25;
          newTargets.iron_ore = 20;
          newTargets.iron_ingot = 10;
          newTargets.iron_sword = 3;
          newTargets.iron_armor = 3;
        }
        if (currentTier >= 3) {
          newTargets.silver_ore = 20;
          newTargets.silver_ingot = 10;
          newTargets.silver_rapier = 3;
          newTargets.silver_chainmail = 3;
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
        }

        // ボスが未撃破の間は、レベリングと探索のために主要採取アイテムの目標を極大にする
        if (!state.bossDefeated) {
          if (currentTier === 1) {
            newTargets.food = 999;
            newTargets.wood = 999;
            newTargets.herb = 999;
          } else if (currentTier === 2) {
            newTargets.stone = 999;
            newTargets.iron_ore = 999;
          } else if (currentTier === 3) {
            newTargets.silver_ore = 999;
            newTargets.mana_stone = 999;
            newTargets.herb = 999;
          } else if (currentTier === 4) {
            newTargets.mana_stone = 999;
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
        // インベントリから装備品を探して、より強い装備を適正な村人に装備させる
        const inventoryItems = Object.keys(state.inventory).filter(
          (id) => (state.inventory[id] || 0) > 0,
        );
        state.villagers.forEach((v) => {
          // 武器の自動アサイン
          const weapons = inventoryItems.filter((id) => ITEMS[id]?.category === "gear_weapon");
          if (weapons.length > 0) {
            // 一番攻撃力ボーナスが高い武器を選ぶ
            let bestWeaponId = "none";
            let maxAtk = -1;
            weapons.forEach((wId) => {
              const atk = ITEMS[wId]?.equipment?.bonuses.attack || 0;
              if (atk > maxAtk) {
                maxAtk = atk;
                bestWeaponId = wId;
              }
            });

            // 現在の装備より強ければ装備
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
        // 村人のインデックスごとに推奨職業を設定して転職させる
        state.villagers.forEach((v, index) => {
          let desiredJob: JobType = "無職";
          if (index === 0) desiredJob = "職人";
          else if (index === 1) desiredJob = "戦士";
          else if (index === 2) desiredJob = "魔術師";
          else if (index === 3) desiredJob = "農民";
          else if (index === 4) desiredJob = "鉱夫";
          else if (index === 5) desiredJob = "薬師";
          else desiredJob = "戦士"; // 以降は戦闘要員

          if (v.currentJob !== desiredJob) {
            // 転職可能条件をチェック (ゴールドとレベル)
            const isFree = v.jobHistory.includes(desiredJob);
            const cost = isFree ? 0 : Math.floor(JOBS[desiredJob].cost * 1.0); // ソウルポイントによる値引きは考慮しない
            const requirements = JOBS[desiredJob].requirements;
            let reqLevelMet = true;
            let reqPrevJobsMet = true;

            if (requirements) {
              if (v.level < requirements.level) reqLevelMet = false;
              if (requirements.jobs && requirements.jobs.length > 0) {
                reqPrevJobsMet = requirements.jobs.some((job) => v.jobHistory.includes(job));
              }
            }

            // どちらの転職でも、予備ゴールド50Gを残して実行する (転職を優先)
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
            // market と guild は最優先のため予備ゴールド不要、その他は予備ゴールド150Gを残して実行する
            const requiredReserve = facId === "market" || facId === "guild" ? 0 : 150;
            if (
              (goldCost === 0 || state.gold >= goldCost + requiredReserve) &&
              hasUpgradeMaterials
            ) {
              store.startFacilityUpgrade(facId);
              break; // 1時間に1施設のみアップグレード開始
            }
          }
        }

        // 7. エリアボス討伐派遣の判断
        // 現在のTierのボス情報を取得
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
          // 生存している村人全員の平均レベルを算出
          const livingVillagers = state.villagers;
          const avgLvl =
            livingVillagers.reduce((sum, v) => sum + v.level, 0) / livingVillagers.length;

          // 戦闘参加候補（HPが70%以上、またはスタミナが残っている村人）
          const readyVillagers = livingVillagers.filter(
            (v) => v.currentHp >= v.maxHp * 0.7 && v.stamina >= 20,
          );

          // 推奨レベル以上、かつ十分な人数（3人以上、または生存者全員）が準備できている場合に戦闘開始
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

      // 各Tierの制限日数を超えたら TimeLimit として判定する（誤判定を防ぐ）
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

    // --- 統計レポートの作成とコンソール出力 ---
    const totalRuns = results.length;
    const clearRuns = results.filter((r) => r.isClear);
    const clearRate = (clearRuns.length / totalRuns) * 100;
    const timeLimitDefeats = results.filter((r) => r.gameOverReason === "TimeLimit").length;
    const bankruptcyDefeats = results.filter(
      (r) => r.gameOverReason === "VillagersDefeated",
    ).length;

    const clearDays = clearRuns.map((r) => r.days);
    const avgClearDays =
      clearDays.length > 0
        ? (clearDays.reduce((a, b) => a + b, 0) / clearDays.length).toFixed(1)
        : "N/A";
    const minClearDays = clearDays.length > 0 ? Math.min(...clearDays) : "N/A";
    const maxClearDays = clearDays.length > 0 ? Math.max(...clearDays) : "N/A";

    const totalDeaths = results.reduce((sum, r) => sum + r.deathsCount, 0);
    const avgDeaths = (totalDeaths / totalRuns).toFixed(1);

    // 各Tierのボス平均突破日数
    const tierDefeatDays: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    results.forEach((r) => {
      Object.entries(r.bossDefeatDays).forEach(([tier, day]) => {
        tierDefeatDays[Number(tier)].push(day);
      });
    });

    const avgTierDays = Object.keys(tierDefeatDays).reduce(
      (acc, tierKey) => {
        const days = tierDefeatDays[Number(tierKey)];
        acc[Number(tierKey)] =
          days.length > 0 ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : "N/A";
        return acc;
      },
      {} as Record<number, string>,
    );

    // 最初の5回の詳細データをレポートに追加
    let detailedRunsText = "\n■ 各回（最初の5回）の最終詳細情報\n";
    results.slice(0, 5).forEach((r) => {
      detailedRunsText += `  - Run #${r.run}: ${r.gameOverReason} (Day ${r.days}, Gold: ${r.gold}G, Villagers: ${r.villagersCount}, AvgLvl: ${r.averageLevel.toFixed(1)}, Dungeons: ${r.dungeonsProgress})\n`;
    });

    const reportText = `
==================================================
  FAST SLOW LIFE - BALANCE SIMULATION REPORT
  Total Runs: ${totalRuns}
==================================================
■ 全体統計
  - クリア率 (Game Clear Rate): ${clearRate.toFixed(1)}%
  - ゲームオーバー率 (Game Over Rate): ${(100 - clearRate).toFixed(1)}%
    - 期限切れによる敗北 (Time Limit Defeats): ${((timeLimitDefeats / totalRuns) * 100).toFixed(1)}%
    - 全滅・破産による敗北 (Bankruptcy Defeats): ${((bankruptcyDefeats / totalRuns) * 100).toFixed(1)}%

■ クリア時の詳細統計 (Clear Runs)
  - 平均クリア日数 (Avg Days to Clear): ${avgClearDays} 日
  - 最速クリア日数 (Min Days to Clear): ${minClearDays} 日
  - 最遅クリア日数 (Max Days to Clear): ${maxClearDays} 日
  - 平均村人死亡回数 (Avg Villager Deaths): ${avgDeaths} 回

■ 進行度（Tier）ごとの平均ボス撃破達成日数
  - Tier 1 (始まりの森: ゴブリンロード)   平均: ${avgTierDays[1]} 日 (制限30日)
  - Tier 2 (廃鉱山: アイアンゴーレム)       平均: ${avgTierDays[2]} 日 (制限70日)
  - Tier 3 (魔獣の谷: キマイラ)            平均: ${avgTierDays[3]} 日 (制限120日)
  - Tier 4 (世界樹の根: アークデーモン)     平均: ${avgTierDays[4]} 日 (制限180日)
  - Tier 5 (深淵の奈落: 終焉の竜)          平均: ${avgTierDays[5]} 日 (制限250日)
${detailedRunsText}==================================================
`;

    console.log(reportText);

    try {
      const artifactDir =
        "C:\\Users\\oikawa\\.gemini\\antigravity-ide\\brain\\6f9999c6-7855-4599-9149-e3cdad4d46a6";
      fs.writeFileSync(path.join(artifactDir, "simulation_report.txt"), reportText, "utf-8");

      const debugDir = path.join(process.cwd(), "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, "simulation_report.txt"), reportText, "utf-8");
    } catch (e) {
      console.error("Failed to write simulation report to file", e);
    }

    expect(totalRuns).toBe(RUNS);
  });
});
