import "../src/store/setupMockStorage";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";

import { describe, it, expect } from "vitest";

import type { SimulationResult } from "../src/store/balanceSimulator.worker";

describe("Balance Simulator", () => {
  it("Run game balance simulation (30 times) in parallel", async () => {
    const TOTAL_RUNS = process.env.SIM_RUNS ? parseInt(process.env.SIM_RUNS, 10) : 30;
    const MIN_CLEAR_RATE = process.env.SIM_MIN_CLEAR_RATE
      ? parseFloat(process.env.SIM_MIN_CLEAR_RATE)
      : 0; // 閾値は環境変数で調整可能、デフォルトは無効
    const numCPUs = Math.min(os.cpus().length || 4, 16);
    const runsPerWorker = Math.ceil(TOTAL_RUNS / numCPUs);
    const promises: Promise<SimulationResult[]>[] = [];

    console.log(
      `Starting ${TOTAL_RUNS} runs of fast-slow-life simulation using ${numCPUs} worker threads...`,
    );

    for (let i = 0; i < numCPUs; i++) {
      const workerRuns = Math.min(runsPerWorker, TOTAL_RUNS - i * runsPerWorker);
      if (workerRuns <= 0) break;

      const runStartIdx = i * runsPerWorker + 1;

      const promise = new Promise<SimulationResult[]>((resolve, reject) => {
        // tsx ローダーを使用して balanceSimulator.worker.ts を Node.js ワーカースレッド上で起動
        const worker = new Worker(
          new URL("../src/store/balanceSimulator.worker.ts", import.meta.url),
          {
            execArgv: ["--import", "tsx"],
            workerData: { runs: workerRuns, runStartIdx },
          },
        );

        worker.on("message", (msg) => resolve(msg));
        worker.on("error", (err) => reject(err));
        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      promises.push(promise);
    }

    // すべてのワーカースレッドの完了を待ち、結果をマージ
    const chunkResults = await Promise.all(promises);
    const results = chunkResults.flat().sort((a, b) => a.run - b.run);

    // --- 統計レポートの作成とコンソール出力 ---
    const totalRuns = results.length;
    const clearRuns = results.filter((r) => r.isClear);
    const clearRate = (clearRuns.length / totalRuns) * 100;
    const gameOverRuns = results.filter((r) => !r.isClear);

    // ゲームオーバー理由の内訳（実際の gameOverReason をそのまま使う）
    const reasonCounts: Record<string, number> = {};
    gameOverRuns.forEach((r) => {
      reasonCounts[r.gameOverReason] = (reasonCounts[r.gameOverReason] || 0) + 1;
    });
    const reasonBreakdown = Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => `    - ${reason}: ${((count / totalRuns) * 100).toFixed(1)}%`)
      .join("\n");

    const clearDays = clearRuns.map((r) => r.days);
    const avgClearDays =
      clearDays.length > 0
        ? (clearDays.reduce((a, b) => a + b, 0) / clearDays.length).toFixed(1)
        : "N/A";
    const minClearDays = clearDays.length > 0 ? Math.min(...clearDays) : "N/A";
    const maxClearDays = clearDays.length > 0 ? Math.max(...clearDays) : "N/A";

    const deathsByRuns = results.map((r) => r.deathsCount);
    const totalDeaths = deathsByRuns.reduce((a, b) => a + b, 0);
    const avgDeaths = (totalDeaths / totalRuns).toFixed(1);
    const avgDeathsNum = totalDeaths / totalRuns;
    const maxDeaths = Math.max(...deathsByRuns);

    const prestigeCounts = results.map((r) => r.prestigeCount);
    const avgPrestige = (prestigeCounts.reduce((a, b) => a + b, 0) / totalRuns).toFixed(1);
    const maxPrestige = Math.max(...prestigeCounts);

    // 経済KPIの集計
    const avgGoldFromExports = (
      results.reduce((sum, r) => sum + r.totalGoldFromExports, 0) / totalRuns
    ).toFixed(1);
    const avgGoldFromImports = (
      results.reduce((sum, r) => sum + r.totalGoldFromImports, 0) / totalRuns
    ).toFixed(1);
    const avgGoldFromPurchases = (
      results.reduce((sum, r) => sum + r.totalGoldFromPurchases, 0) / totalRuns
    ).toFixed(1);
    const avgGoldFromTax = (
      results.reduce((sum, r) => sum + r.totalGoldFromTax, 0) / totalRuns
    ).toFixed(1);

    // 最終ゴールド分布
    const allGold = results.map((r) => r.gold);
    const avgFinalGold = (allGold.reduce((a, b) => a + b, 0) / totalRuns).toFixed(1);
    const minFinalGold = Math.min(...allGold);
    const maxFinalGold = Math.max(...allGold);

    // クリアRun vs 失敗Run のゴールド比較
    const clearGoldAvg =
      clearRuns.length > 0
        ? (clearRuns.reduce((sum, r) => sum + r.gold, 0) / clearRuns.length).toFixed(1)
        : "N/A";
    const failGoldAvg =
      gameOverRuns.length > 0
        ? (gameOverRuns.reduce((sum, r) => sum + r.gold, 0) / gameOverRuns.length).toFixed(1)
        : "N/A";

    // 破産によるGame Over
    const bankruptRuns = gameOverRuns.filter((r) => r.gameOverReason === "破産");
    const bankruptRate = ((bankruptRuns.length / totalRuns) * 100).toFixed(1);

    // ツケ発生率
    const unpaidRuns = results.filter((r) => r.unpaidVillagersCount > 0);
    const unpaidRate = ((unpaidRuns.length / totalRuns) * 100).toFixed(1);
    const avgUnpaidVillagers = (
      results.reduce((sum, r) => sum + r.unpaidVillagersCount, 0) / totalRuns
    ).toFixed(1);

    // 戦闘統計の集計
    const avgDamageDealt = (
      results.reduce((sum, r) => sum + r.totalDamageDealt, 0) / totalRuns
    ).toFixed(1);
    const avgDamageReceived = (
      results.reduce((sum, r) => sum + r.totalDamageReceived, 0) / totalRuns
    ).toFixed(1);
    const clearDamageDealtAvg =
      clearRuns.length > 0
        ? (clearRuns.reduce((sum, r) => sum + r.totalDamageDealt, 0) / clearRuns.length).toFixed(1)
        : "N/A";
    const failDamageDealtAvg =
      gameOverRuns.length > 0
        ? (
            gameOverRuns.reduce((sum, r) => sum + r.totalDamageDealt, 0) / gameOverRuns.length
          ).toFixed(1)
        : "N/A";

    // 訓練関連の統計
    const totalTrainingRuns = results.filter((r) => r.trainingCount > 0).length;
    const totalTrainingSessions = results.reduce((sum, r) => sum + r.trainingCount, 0);
    const avgTrainingCount = (totalTrainingSessions / totalRuns).toFixed(1);
    const maxTrainingCount = Math.max(...results.map((r) => r.trainingCount));
    const avgTrainingTrainingRuns =
      totalTrainingRuns > 0 ? (totalTrainingSessions / totalTrainingRuns).toFixed(1) : "N/A";
    const avgTrainingGold = (
      results.reduce((sum, r) => sum + r.totalTrainingGold, 0) / totalRuns
    ).toFixed(1);
    const maxTrainingLevel = Math.max(...results.map((r) => r.highestTrainingLevel));
    const avgBonusStatsAll = (
      results.reduce((sum, r) => sum + r.averageBonusStats, 0) / totalRuns
    ).toFixed(1);

    // 訓練回数の分布（0回/1回/2-5回/6-10回/11回以上）
    const trainingDist = { "0回": 0, "1回": 0, "2-5回": 0, "6-10回": 0, "11回以上": 0 };
    results.forEach((r) => {
      if (r.trainingCount === 0) trainingDist["0回"]++;
      else if (r.trainingCount === 1) trainingDist["1回"]++;
      else if (r.trainingCount <= 5) trainingDist["2-5回"]++;
      else if (r.trainingCount <= 10) trainingDist["6-10回"]++;
      else trainingDist["11回以上"]++;
    });

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

    // Tier突破率
    const tier1Defeated = results.filter((r) => r.bossDefeatDays[1]).length;
    const tier2Defeated = results.filter((r) => r.bossDefeatDays[2]).length;
    const tier3Defeated = results.filter((r) => r.bossDefeatDays[3]).length;
    const tier4Defeated = results.filter((r) => r.bossDefeatDays[4]).length;

    // 詳細データサマリー
    let detailedRunsText = "\n■ 各回の最終詳細情報（先頭10件）\n";
    results.slice(0, 10).forEach((r) => {
      detailedRunsText += `  #${String(r.run).padStart(2)}: ${r.gameOverReason.padEnd(16)} Day ${String(r.days).padStart(3)} | Gold: ${String(r.gold).padStart(7)}G | Villagers: ${r.villagersCount} | Lv: ${r.averageLevel.toFixed(1)} | Bonus: ${r.averageBonusStats.toFixed(1)} | Training: ${r.trainingCount}回 | Prestige: ${r.prestigeCount}\n`;
    });

    const reportText = `
==================================================
  FAST SLOW LIFE - BALANCE SIMULATION REPORT
  Total Runs: ${totalRuns}
  Date: ${new Date().toISOString()}
==================================================
■ クリア率
  - クリア (Clear): ${clearRate.toFixed(1)}% (${clearRuns.length}/${totalRuns})
  - ゲームオーバー (Game Over): ${(100 - clearRate).toFixed(1)}% (${gameOverRuns.length}/${totalRuns})
${reasonBreakdown}

■ 訓練所の活用状況
  - 訓練を実施したRun: ${totalTrainingRuns}/${totalRuns} (${((totalTrainingRuns / totalRuns) * 100).toFixed(1)}%)
  - 総訓練回数: ${totalTrainingSessions} 回 (全Run合計)
  - 平均訓練実施回数: ${avgTrainingCount} 回/Run (最大: ${maxTrainingCount} 回)
  - 訓練実施Runのみの平均: ${avgTrainingTrainingRuns} 回
  - 平均訓練総支出: ${avgTrainingGold} G/Run
  - 最大訓練プログラムLevel: ${maxTrainingLevel}
  - 平均BonusStats: ${avgBonusStatsAll}
  - 訓練回数分布: 0回=${trainingDist["0回"]}Run / 1回=${trainingDist["1回"]}Run / 2-5回=${trainingDist["2-5回"]}Run / 6-10回=${trainingDist["6-10回"]}Run / 11回以上=${trainingDist["11回以上"]}Run

■ クリア時の詳細統計 (Clear Runs: ${clearRuns.length}回)
  - 平均クリア日数 (Avg Days to Clear): ${avgClearDays} 日
  - 最速クリア日数 (Min Days to Clear): ${minClearDays} 日
  - 最遅クリア日数 (Max Days to Clear): ${maxClearDays} 日
  - 平均村人死亡回数 (Avg Villager Deaths): ${avgDeaths} 回 (最大: ${maxDeaths} 回)

■ 進行度（Tier）ごとの統計
  - Tier 1 (始まりの森)  突破率: ${((tier1Defeated / totalRuns) * 100).toFixed(1)}%  平均突破日: ${avgTierDays[1]}日
  - Tier 2 (廃鉱山)      突破率: ${((tier2Defeated / totalRuns) * 100).toFixed(1)}%  平均突破日: ${avgTierDays[2]}日
  - Tier 3 (魔獣の谷)    突破率: ${((tier3Defeated / totalRuns) * 100).toFixed(1)}%  平均突破日: ${avgTierDays[3]}日
  - Tier 4 (世界樹の根)  突破率: ${((tier4Defeated / totalRuns) * 100).toFixed(1)}%  平均突破日: ${avgTierDays[4]}日
  - Tier 5 (深淵の奈落)  突破率: ${clearRate.toFixed(1)}%  平均突破日: ${avgTierDays[5]}日

■ 転生統計
  - 平均転生回数: ${avgPrestige} 回 (最大: ${maxPrestige} 回)

■ 経済統計
  - 平均輸出獲得ゴールド: ${avgGoldFromExports} G/Run
  - 平均輸入支出ゴールド: ${avgGoldFromImports} G/Run
  - 平均買取支出ゴールド: ${avgGoldFromPurchases} G/Run
  - 平均食料代獲得ゴールド: ${avgGoldFromTax} G/Run
  - 最終ゴールド: 平均 ${avgFinalGold} G (min: ${minFinalGold}, max: ${maxFinalGold})
  - クリアRun平均ゴールド: ${clearGoldAvg} G / 失敗Run平均ゴールド: ${failGoldAvg} G
  - 破産によるGame Over: ${bankruptRuns.length}回 (${bankruptRate}%)
  - ツケ発生Run: ${unpaidRuns.length}/${totalRuns} (${unpaidRate}%), 平均ツケ村人数: ${avgUnpaidVillagers}

■ 戦闘統計
  - 平均総与ダメージ: ${avgDamageDealt} /Run (min: ${Math.min(...results.map((r) => r.totalDamageDealt))}, max: ${Math.max(...results.map((r) => r.totalDamageDealt))})
  - 平均総被ダメージ: ${avgDamageReceived} /Run (min: ${Math.min(...results.map((r) => r.totalDamageReceived))}, max: ${Math.max(...results.map((r) => r.totalDamageReceived))})
  - クリアRun平均与ダメージ: ${clearDamageDealtAvg} / 失敗Run平均与ダメージ: ${failDamageDealtAvg}
${detailedRunsText}
■ 失敗Runの内訳（Game Over Reason）
${Object.entries(reasonCounts)
  .sort(([, a], [, b]) => b - a)
  .map(
    ([reason, count]) => `  - ${reason}: ${count}回 (${((count / totalRuns) * 100).toFixed(1)}%)`,
  )
  .join("\n")}

■ 最終施設状況（先頭5件の施設レベル）
${results
  .slice(0, 5)
  .map((r) => `  Run #${r.run}: ${r.facilitiesFinal}`)
  .join("\n")}
==================================================
`;

    console.log(reportText);

    // ファイル出力
    try {
      const debugDir = path.join(process.cwd(), "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      // テキストレポート
      fs.writeFileSync(path.join(debugDir, "simulation_report.txt"), reportText, "utf-8");
      // JSONデータ（後続の分析に使えるように）
      const jsonData = results.map((r) => ({
        run: r.run,
        isClear: r.isClear,
        gameOverReason: r.gameOverReason,
        days: r.days,
        gold: r.gold,
        villagersCount: r.villagersCount,
        averageLevel: r.averageLevel,
        averageBonusStats: r.averageBonusStats,
        deathsCount: r.deathsCount,
        totalHired: r.totalHired,
        trainingCount: r.trainingCount,
        totalTrainingGold: r.totalTrainingGold,
        highestTrainingLevel: r.highestTrainingLevel,
        prestigeCount: r.prestigeCount,
        bossDefeatDays: r.bossDefeatDays,
        facilitiesFinal: r.facilitiesFinal,
        totalGoldFromExports: r.totalGoldFromExports,
        totalGoldFromImports: r.totalGoldFromImports,
        totalGoldFromPurchases: r.totalGoldFromPurchases,
        totalGoldFromTax: r.totalGoldFromTax,
        townsFinal: r.townsFinal,
        unpaidVillagersCount: r.unpaidVillagersCount,
        caravansActiveCount: r.caravansActiveCount,
        totalDamageDealt: r.totalDamageDealt,
        totalDamageReceived: r.totalDamageReceived,
      }));
      // 集計サマリーもJSONに含める
      const jsonSummary = {
        totalRuns,
        clearRate: `${clearRate.toFixed(1)}%`,
        totalTrainingSessions,
        trainingRuns: totalTrainingRuns,
        avgTrainingPerRun: `${avgTrainingCount} 回`,
        trainingDistribution: trainingDist,
        economy: {
          avgGoldFromExports: `${avgGoldFromExports} G`,
          avgGoldFromImports: `${avgGoldFromImports} G`,
          avgGoldFromPurchases: `${avgGoldFromPurchases} G`,
          avgGoldFromTax: `${avgGoldFromTax} G`,
          avgFinalGold: `${avgFinalGold} G`,
          bankruptRate: `${bankruptRate}%`,
          unpaidRate: `${unpaidRate}%`,
        },
        combat: {
          avgDamageDealt: `${avgDamageDealt}`,
          avgDamageReceived: `${avgDamageReceived}`,
        },
      };
      fs.writeFileSync(
        path.join(debugDir, "simulation_summary.json"),
        JSON.stringify(jsonSummary, null, 2),
        "utf-8",
      );
      fs.writeFileSync(
        path.join(debugDir, "simulation_data.json"),
        JSON.stringify(jsonData, null, 2),
        "utf-8",
      );
    } catch (e) {
      console.error("Failed to write simulation report to file", e);
    }

    // --- アサーション（健全性チェック） ---
    expect(totalRuns).toBe(TOTAL_RUNS);

    // 全てのRunに結果が正しく格納されている
    results.forEach((r, i) => {
      expect(r.run).toBe(i + 1);
      expect(r.days).toBeGreaterThan(0);
      expect(typeof r.isClear).toBe("boolean");
      expect(["Clear", "破産", "期限切れ", "VillagersDefeated", "TimeLimit", "脅威度"]).toContain(
        r.gameOverReason,
      );
      expect(r.prestigeCount).toBeGreaterThanOrEqual(0);
      expect(r.prestigeCount).toBeLessThanOrEqual(3);
    });

    // 訓練所のデータ整合性（訓練を実施したRunには必ず trainingCount > 0）
    results.forEach((r) => {
      if (r.trainingCount > 0) {
        expect(r.totalTrainingGold).toBeGreaterThan(0);
        expect(r.highestTrainingLevel).toBeGreaterThanOrEqual(1);
      }
    });

    // クリア率が閾値を超えているか（環境変数 SIM_MIN_CLEAR_RATE で設定）
    if (MIN_CLEAR_RATE > 0) {
      expect(clearRate).toBeGreaterThanOrEqual(MIN_CLEAR_RATE);
    }

    // 経済KPIのデータ整合性
    results.forEach((r) => {
      expect(r.totalGoldFromExports).toBeGreaterThanOrEqual(0);
      expect(r.totalGoldFromImports).toBeGreaterThanOrEqual(0);
      expect(r.totalGoldFromPurchases).toBeGreaterThanOrEqual(0);
      expect(r.totalGoldFromTax).toBeGreaterThanOrEqual(0);
      expect(r.unpaidVillagersCount).toBeGreaterThanOrEqual(0);
      expect(r.caravansActiveCount).toBeGreaterThanOrEqual(0);
      expect(r.totalDamageDealt).toBeGreaterThanOrEqual(0);
      expect(r.totalDamageReceived).toBeGreaterThanOrEqual(0);
    });

    // クリアRunは交易でゴールドを稼いでいること
    clearRuns.forEach((r) => {
      expect(r.totalGoldFromExports).toBeGreaterThan(0);
    });

    // 平均最終ゴールドが閾値以上であること（環境変数 SIM_MIN_AVG_GOLD で設定）
    const MIN_AVG_GOLD = process.env.SIM_MIN_AVG_GOLD
      ? parseFloat(process.env.SIM_MIN_AVG_GOLD)
      : 0;
    if (MIN_AVG_GOLD > 0) {
      expect(parseFloat(avgFinalGold)).toBeGreaterThanOrEqual(MIN_AVG_GOLD);
    }

    // 警告: クリア率が極端に低い場合、バランス崩壊の可能性
    if (clearRate < 10) {
      console.warn(
        `⚠️ 警告: クリア率が ${clearRate.toFixed(1)}% と非常に低いです。ゲームバランスに問題がある可能性があります。`,
      );
    }
    if (avgDeathsNum > 5) {
      console.warn(
        `⚠️ 警告: 平均村人死亡回数が ${avgDeaths} 回と高いです。難易度が高すぎる可能性があります。`,
      );
    }
    if (bankruptRuns.length > totalRuns * 0.3) {
      console.warn(
        `⚠️ 警告: 破産によるGame Overが ${bankruptRate}% と高いです。経済バランスに問題がある可能性があります。`,
      );
    }
  }, 300000);

  it("Run with all soul upgrades maxed out (30 times)", async () => {
    const TOTAL_RUNS = process.env.SIM_RUNS ? parseInt(process.env.SIM_RUNS, 10) : 30;
    const numCPUs = Math.min(os.cpus().length || 4, 16);
    const runsPerWorker = Math.ceil(TOTAL_RUNS / numCPUs);
    const promises: Promise<SimulationResult[]>[] = [];

    // 全バフ最大値
    const maxBuffs: Record<string, number> = {
      heritage: 10,
      storage: 10,
      education: 5,
      body: 5,
      building: 5,
      discount: 5,
    };

    console.log(
      `\nStarting ${TOTAL_RUNS} runs with ALL SOUL UPGRADES MAXED using ${numCPUs} workers...`,
    );

    for (let i = 0; i < numCPUs; i++) {
      const workerRuns = Math.min(runsPerWorker, TOTAL_RUNS - i * runsPerWorker);
      if (workerRuns <= 0) break;

      const runStartIdx = i * runsPerWorker + 1;

      const promise = new Promise<SimulationResult[]>((resolve, reject) => {
        const worker = new Worker(
          new URL("../src/store/balanceSimulator.worker.ts", import.meta.url),
          {
            execArgv: ["--import", "tsx"],
            workerData: { runs: workerRuns, runStartIdx, initialSoulUpgrades: maxBuffs },
          },
        );

        worker.on("message", (msg) => resolve(msg));
        worker.on("error", (err) => reject(err));
        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      promises.push(promise);
    }

    const chunkResults = await Promise.all(promises);
    const results = chunkResults.flat().sort((a, b) => a.run - b.run);

    const totalRuns = results.length;
    const clearRuns = results.filter((r) => r.isClear);
    const clearRate = (clearRuns.length / totalRuns) * 100;
    const gameOverRuns = results.filter((r) => !r.isClear);

    const clearDays = clearRuns.map((r) => r.days);
    const avgClearDays =
      clearDays.length > 0
        ? (clearDays.reduce((a, b) => a + b, 0) / clearDays.length).toFixed(1)
        : "N/A";

    const allGold = results.map((r) => r.gold);
    const avgFinalGold = (allGold.reduce((a, b) => a + b, 0) / totalRuns).toFixed(1);

    // ゲームオーバー理由の内訳
    const reasonCounts: Record<string, number> = {};
    gameOverRuns.forEach((r) => {
      reasonCounts[r.gameOverReason] = (reasonCounts[r.gameOverReason] || 0) + 1;
    });

    // ボス突破統計
    const tierDefeatDays: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    results.forEach((r) => {
      Object.entries(r.bossDefeatDays).forEach(([tier, day]) => {
        tierDefeatDays[Number(tier)].push(day);
      });
    });

    const reportText = `
==================================================
  FULL SOUL UPGRADE BENCHMARK REPORT
==================================================
■ クリア率: ${clearRate.toFixed(1)}% (${clearRuns.length}/${totalRuns})
■ 平均クリア日数: ${avgClearDays} 日
■ 平均最終ゴールド: ${avgFinalGold} G (min: ${Math.min(...allGold)}, max: ${Math.max(...allGold)})

■ 転生統計
  - 平均転生回数: ${(results.reduce((s, r) => s + r.prestigeCount, 0) / totalRuns).toFixed(1)} 回 (最大: ${Math.max(...results.map((r) => r.prestigeCount))} 回)

■ 戦闘統計
  - 平均総与ダメージ: ${(results.reduce((s, r) => s + r.totalDamageDealt, 0) / totalRuns).toFixed(1)} /Run
  - 平均総被ダメージ: ${(results.reduce((s, r) => s + r.totalDamageReceived, 0) / totalRuns).toFixed(1)} /Run

■ 進行度（Tier）ごとの平均突破日
  - Tier 1: ${tierDefeatDays[1].length > 0 ? (tierDefeatDays[1].reduce((a, b) => a + b, 0) / tierDefeatDays[1].length).toFixed(1) : "N/A"}日 (${((tierDefeatDays[1].length / totalRuns) * 100).toFixed(1)}%)
  - Tier 2: ${tierDefeatDays[2].length > 0 ? (tierDefeatDays[2].reduce((a, b) => a + b, 0) / tierDefeatDays[2].length).toFixed(1) : "N/A"}日 (${((tierDefeatDays[2].length / totalRuns) * 100).toFixed(1)}%)
  - Tier 3: ${tierDefeatDays[3].length > 0 ? (tierDefeatDays[3].reduce((a, b) => a + b, 0) / tierDefeatDays[3].length).toFixed(1) : "N/A"}日 (${((tierDefeatDays[3].length / totalRuns) * 100).toFixed(1)}%)
  - Tier 4: ${tierDefeatDays[4].length > 0 ? (tierDefeatDays[4].reduce((a, b) => a + b, 0) / tierDefeatDays[4].length).toFixed(1) : "N/A"}日 (${((tierDefeatDays[4].length / totalRuns) * 100).toFixed(1)}%)
  - Tier 5: ${tierDefeatDays[5].length > 0 ? (tierDefeatDays[5].reduce((a, b) => a + b, 0) / tierDefeatDays[5].length).toFixed(1) : "N/A"}日 (${clearRate.toFixed(1)}%)

■ 失敗Runの内訳
${Object.entries(reasonCounts)
  .sort(([, a], [, b]) => b - a)
  .map(
    ([reason, count]) => `  - ${reason}: ${count}回 (${((count / totalRuns) * 100).toFixed(1)}%)`,
  )
  .join("\n")}
==================================================
`;

    console.log(reportText);

    // ファイル出力
    try {
      const debugDir = path.join(process.cwd(), "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, "simulation_fullbuff_report.txt"), reportText, "utf-8");
      const jsonData = results.map((r) => ({
        run: r.run,
        isClear: r.isClear,
        gameOverReason: r.gameOverReason,
        days: r.days,
        gold: r.gold,
        villagersCount: r.villagersCount,
        averageLevel: r.averageLevel,
        averageBonusStats: r.averageBonusStats,
        deathsCount: r.deathsCount,
        totalHired: r.totalHired,
        trainingCount: r.trainingCount,
        totalTrainingGold: r.totalTrainingGold,
        highestTrainingLevel: r.highestTrainingLevel,
        prestigeCount: r.prestigeCount,
        bossDefeatDays: r.bossDefeatDays,
        facilitiesFinal: r.facilitiesFinal,
        totalGoldFromExports: r.totalGoldFromExports,
        totalGoldFromImports: r.totalGoldFromImports,
        totalGoldFromPurchases: r.totalGoldFromPurchases,
        totalGoldFromTax: r.totalGoldFromTax,
        townsFinal: r.townsFinal,
        unpaidVillagersCount: r.unpaidVillagersCount,
        caravansActiveCount: r.caravansActiveCount,
        totalDamageDealt: r.totalDamageDealt,
        totalDamageReceived: r.totalDamageReceived,
      }));
      fs.writeFileSync(
        path.join(debugDir, "simulation_fullbuff_data.json"),
        JSON.stringify(jsonData, null, 2),
        "utf-8",
      );
    } catch (e) {
      console.error("Failed to write fullbuff report to file", e);
    }

    expect(totalRuns).toBe(TOTAL_RUNS);
    // 全バフMAX時のクリア率を検証（環境変数 SIM_MIN_FULLBUFF_CLEAR_RATE で期待値を設定、デフォルト60%）
    const MIN_CLEAR_RATE = process.env.SIM_MIN_FULLBUFF_CLEAR_RATE
      ? parseFloat(process.env.SIM_MIN_FULLBUFF_CLEAR_RATE)
      : 60;
    if (MIN_CLEAR_RATE > 0) {
      expect(clearRate).toBeGreaterThanOrEqual(MIN_CLEAR_RATE);
    }

    if (clearRate < 10) {
      console.warn(
        `⚠️ 警告: 全バフMAXでもクリア率が ${clearRate.toFixed(1)}% です。ゲームバランスに問題がある可能性があります。`,
      );
    }
  }, 300000);
});
