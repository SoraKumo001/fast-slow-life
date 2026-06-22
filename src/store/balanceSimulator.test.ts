import "./setupMockStorage";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";

import { describe, it, expect } from "vitest";

import type { SimulationResult } from "./balanceSimulator.worker";

describe("Balance Simulator", () => {
  it("Run game balance simulation (30 times) in parallel", async () => {
    const TOTAL_RUNS = process.env.SIM_RUNS ? parseInt(process.env.SIM_RUNS, 10) : 30;
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
        const worker = new Worker(new URL("./balanceSimulator.worker.ts", import.meta.url), {
          execArgv: ["--import", "tsx"],
          workerData: { runs: workerRuns, runStartIdx },
        });

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

    const prestigeCounts = results.map((r) => r.prestigeCount);
    const avgPrestige = (prestigeCounts.reduce((a, b) => a + b, 0) / totalRuns).toFixed(1);
    const maxPrestige = Math.max(...prestigeCounts);

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
      detailedRunsText += `  - Run #${r.run}: ${r.gameOverReason} (Prestige: ${r.prestigeCount}, Day ${r.days}, Gold: ${r.gold}G, Villagers: ${r.villagersCount}, AvgLvl: ${r.averageLevel.toFixed(1)}, Dungeons: ${r.dungeonsProgress})\n`;
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
  - 平均転生回数 (Avg Prestige Count): ${avgPrestige} 回 (最大: ${maxPrestige} 回)

■ クリア時の詳細統計 (Clear Runs)
  - 平均クリア日数 (Avg Days to Clear): ${avgClearDays} 日
  - 最速クリア日数 (Min Days to Clear): ${minClearDays} 日
  - 最遅クリア日数 (Max Days to Clear): ${maxClearDays} 日
  - 平均村人死亡回数 (Avg Villager Deaths): ${avgDeaths} 回

■ 進行度（Tier）ごとの平均ボス撃破達成日数
  - Tier 1 (始まりの森: ゴブリンロード)   平均: ${avgTierDays[1]} 日 (制限25日)
  - Tier 2 (廃鉱山: アイアンゴーレム)       平均: ${avgTierDays[2]} 日 (制限55日)
  - Tier 3 (魔獣の谷: キマイラ)            平均: ${avgTierDays[3]} 日 (制限100日)
  - Tier 4 (世界樹の根: アークデーモン)     平均: ${avgTierDays[4]} 日 (制限150日)
  - Tier 5 (深淵の奈落: 終焉の竜)          平均: ${avgTierDays[5]} 日 (制限210日)
${detailedRunsText}==================================================
`;

    console.log(reportText);

    try {
      const debugDir = path.join(process.cwd(), "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, "simulation_report.txt"), reportText, "utf-8");
    } catch (e) {
      console.error("Failed to write simulation report to file", e);
    }

    expect(totalRuns).toBe(TOTAL_RUNS);
  }, 300000);
});
