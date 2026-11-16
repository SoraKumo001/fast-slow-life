/**
 * バランスシミュレーション CLI (バランスシミュレーション改善・柱2/4/5/6)。
 *
 * 使い方:
 *   pnpm sim -- --strategy default --seeds 1-30
 *   pnpm sim -- --mode screening                # シード 1-10, 両戦略
 *   pnpm sim -- --mode gate                     # シード 1-30, 両戦略
 *   pnpm sim -- --strategy buff --seeds 101-130 --check-bands
 *   pnpm sim -- --report-only                   # 実行せず集計のみ
 *
 * 結果は sim-results/<設定ハッシュ>/results.jsonl にラン完了ごとへ追記される。
 * 再実行時は (戦略, シード) が記録済みのランをスキップする (中断からの再開)。
 * ワーカー数: --workers > 環境変数 SIM_WORKERS > 既定値 (このVMでは 2 が実測最速)。
 */
import { execSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Worker } from "node:worker_threads";

import type { SimulationResult } from "../src/store/balanceSimulator.worker";

type Strategy = "default" | "buff";

const MAX_BUFFS: Record<string, number> = {
  heritage: 10,
  storage: 10,
  education: 5,
  body: 5,
  building: 5,
  discount: 5,
};

const DEFAULT_WORKERS = 2;

// ---------------------------------------------------------------- args ----
function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function parseSeeds(spec: string): number[] {
  const seeds = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)-(\d+)$/);
    if (m) {
      for (let s = parseInt(m[1], 10); s <= parseInt(m[2], 10); s++) seeds.add(s);
    } else if (/^\d+$/.test(part.trim())) {
      seeds.add(parseInt(part.trim(), 10));
    }
  }
  return [...seeds].sort((a, b) => a - b);
}

// ---------------------------------------------------------- config hash ----
/**
 * バランスに影響するソース (定数・データ・ゲームロジック) の内容ハッシュ。
 * ハーネス自体 (balanceSimulator.worker / random / simMode) とテストは除外する:
 * それらは「結果が同一であること」を別途検証する対象であり、設定の一部ではない。
 */
function computeConfigHash(repoRoot: string): { hash: string; files: string[] } {
  const files: string[] = ["src/constants.ts"];
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(rel);
    }
  };
  walk(path.join(repoRoot, "src/data"), "src/data");
  walk(path.join(repoRoot, "src/store"), "src/store");
  const excluded = new Set([
    "src/store/balanceSimulator.worker.ts",
    "src/store/random.ts",
    "src/store/simMode.ts",
    "src/store/setupMockStorage.ts",
  ]);
  const targets = files.filter((f) => !excluded.has(f)).sort();
  const h = crypto.createHash("sha256");
  for (const rel of targets) {
    h.update(rel);
    h.update("\0");
    h.update(fs.readFileSync(path.join(repoRoot, rel)));
    h.update("\0");
  }
  return { hash: h.digest("hex").slice(0, 12), files: targets };
}

// ---------------------------------------------------------------- record ----
interface SimRecord {
  strategy: Strategy;
  seed: number;
  clear: boolean;
  reason: string;
  days: number;
  gold: number;
  cycles: number;
  cycleEnds: string[];
  cycle1Clear: boolean;
  raidOccurred: boolean;
  raidCount: number;
  bossAttempts: number;
  bossDisengages: number;
  deaths: number;
  avgLevel: number;
  ticks: number;
  wallMs: number;
  recordedAt: string;
}

function toRecord(strategy: Strategy, r: SimulationResult): SimRecord {
  return {
    strategy,
    seed: r.seed,
    clear: r.isClear,
    reason: r.gameOverReason,
    days: r.days,
    gold: Math.round(r.gold),
    cycles: r.prestigeCount,
    cycleEnds: r.cycleEnds,
    cycle1Clear: r.cycle1Clear,
    raidOccurred: r.raidOccurred,
    raidCount: r.raidCount,
    bossAttempts: r.bossAttempts,
    bossDisengages: r.bossDisengages,
    deaths: r.deathsCount,
    avgLevel: Math.round(r.averageLevel * 10) / 10,
    ticks: r.ticks,
    wallMs: r.wallMs,
    recordedAt: new Date().toISOString(),
  };
}

function loadRecords(file: string): SimRecord[] {
  if (!fs.existsSync(file)) return [];
  const records: SimRecord[] = [];
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as SimRecord);
    } catch {
      // 書き込み途中で中断された最終行は無視する (再開時に再実行される)
    }
  }
  return records;
}

// ------------------------------------------------------------- aggregate ----
function wilson(clears: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = clears / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, (center - margin) * 100), Math.min(100, (center + margin) * 100)];
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

interface Aggregate {
  n: number;
  clears: number;
  clearRate: number;
  ci: [number, number];
  bankruptRate: number;
  raidRate: number;
  cycle1ClearRate: number;
  avgClearDays: number | null;
  medianWallMs: number;
  p90WallMs: number;
}

function aggregate(records: SimRecord[]): Aggregate {
  const n = records.length;
  const clears = records.filter((r) => r.clear);
  const walls = records.map((r) => r.wallMs).sort((a, b) => a - b);
  return {
    n,
    clears: clears.length,
    clearRate: n > 0 ? (clears.length / n) * 100 : 0,
    ci: wilson(clears.length, n),
    bankruptRate: n > 0 ? (records.filter((r) => r.reason === "破産").length / n) * 100 : 0,
    raidRate: n > 0 ? (records.filter((r) => r.raidOccurred).length / n) * 100 : 0,
    cycle1ClearRate: n > 0 ? (records.filter((r) => r.cycle1Clear).length / n) * 100 : 0,
    avgClearDays:
      clears.length > 0 ? clears.reduce((s, r) => s + r.days, 0) / clears.length : null,
    medianWallMs: percentile(walls, 0.5),
    p90WallMs: percentile(walls, 0.9),
  };
}

/** Phase 5 仕様 §3.1 の目標帯チェック。戻り値: 全て合格なら true。 */
function checkBands(strategy: Strategy, agg: Aggregate): boolean {
  const lines: string[] = [];
  let ok = true;
  const mark = (pass: boolean) => (pass ? "PASS" : "FAIL");
  if (strategy === "default") {
    const checks: [string, boolean, string][] = [
      ["クリア率 30〜60%", agg.clearRate >= 30 && agg.clearRate <= 60, `${agg.clearRate.toFixed(1)}% (${agg.clears}/${agg.n})`],
      ["破産率 20%以下", agg.bankruptRate <= 20, `${agg.bankruptRate.toFixed(1)}%`],
      ["襲撃発生 30%以上", agg.raidRate >= 30, `${agg.raidRate.toFixed(1)}%`],
      ["平均クリア日数 15日以上", agg.avgClearDays !== null && agg.avgClearDays >= 15, agg.avgClearDays === null ? "N/A" : `${agg.avgClearDays.toFixed(1)}日`],
    ];
    for (const [name, pass, value] of checks) {
      lines.push(`  [${mark(pass)}] ${name}: ${value}`);
      if (!pass) ok = false;
    }
  } else {
    const pass = agg.clearRate >= 70 && agg.clearRate <= 90;
    lines.push(`  [${mark(pass)}] クリア率 70〜90%: ${agg.clearRate.toFixed(1)}% (${agg.clears}/${agg.n})`);
    ok = pass;
  }
  console.log(lines.join("\n"));
  return ok;
}

function printAggregate(strategy: Strategy, agg: Aggregate) {
  console.log(
    `[${strategy}] n=${agg.n} clear=${agg.clears} (${agg.clearRate.toFixed(1)}%, 95%CI ${agg.ci[0].toFixed(1)}-${agg.ci[1].toFixed(1)}) ` +
      `bankrupt=${agg.bankruptRate.toFixed(1)}% raid=${agg.raidRate.toFixed(1)}% cycle1Clear=${agg.cycle1ClearRate.toFixed(1)}% ` +
      `avgClearDays=${agg.avgClearDays === null ? "N/A" : agg.avgClearDays.toFixed(1)} ` +
      `wall median=${(agg.medianWallMs / 1000).toFixed(1)}s p90=${(agg.p90WallMs / 1000).toFixed(1)}s`,
  );
}

// ----------------------------------------------------------------- run ----
function runStrategy(
  strategy: Strategy,
  pendingSeeds: number[],
  workers: number,
  resultsFile: string,
): Promise<{ completed: number; failed: boolean }> {
  if (pendingSeeds.length === 0) return Promise.resolve({ completed: 0, failed: false });
  const initialSoulUpgrades = strategy === "buff" ? MAX_BUFFS : undefined;
  let completed = 0;
  let failed = false;

  const chunks: number[][] = Array.from({ length: workers }, () => []);
  pendingSeeds.forEach((seed, i) => chunks[i % workers].push(seed));

  const jobs = chunks
    .filter((c) => c.length > 0)
    .map(
      (chunk) =>
        new Promise<void>((resolve) => {
          const worker = new Worker(
            new URL("../src/store/balanceSimulator.worker.ts", import.meta.url),
            {
              execArgv: ["--import", "tsx"],
              workerData: { seeds: chunk, stream: true, initialSoulUpgrades },
            },
          );
          worker.on("message", (msg: { type: string; result?: SimulationResult }) => {
            if (msg.type === "result" && msg.result) {
              const rec = toRecord(strategy, msg.result);
              fs.appendFileSync(resultsFile, JSON.stringify(rec) + "\n", "utf-8");
              completed++;
              console.log(
                `[${strategy}] seed ${rec.seed}: ${rec.clear ? "Clear" : rec.reason} ` +
                  `${rec.days}d gold=${rec.gold} cycles=${rec.cycles} raids=${rec.raidCount} ` +
                  `bossTry=${rec.bossAttempts} bossDisengage=${rec.bossDisengages} ` +
                  `(${(rec.wallMs / 1000).toFixed(1)}s) [${completed}/${pendingSeeds.length}]`,
              );
            }
          });
          worker.on("error", (err) => {
            failed = true;
            console.error(`[${strategy}] worker error:`, err);
            resolve();
          });
          worker.on("exit", (code) => {
            if (code !== 0) {
              failed = true;
              console.error(`[${strategy}] worker exited with code ${code}`);
            }
            resolve();
          });
        }),
    );

  return Promise.all(jobs).then(() => ({ completed, failed }));
}

// ---------------------------------------------------------------- main ----
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

  const mode = args.mode ?? "gate";
  const seedSpec = args.seeds ?? (mode === "screening" ? "1-10" : "1-30");
  const seeds = parseSeeds(seedSpec);
  const strategies: Strategy[] =
    args.strategy === "default" || args.strategy === "buff"
      ? [args.strategy]
      : ["default", "buff"];
  const workers = Math.max(
    1,
    parseInt(args.workers ?? process.env.SIM_WORKERS ?? String(DEFAULT_WORKERS), 10) ||
      DEFAULT_WORKERS,
  );
  const reportOnly = args["report-only"] === "true";
  const doCheckBands = args["check-bands"] === "true";

  const { hash, files } = computeConfigHash(repoRoot);
  const configDir = path.join(
    args.dir ?? path.join(repoRoot, "sim-results"),
    args.label ? `${hash}-${args.label}` : hash,
  );
  fs.mkdirSync(configDir, { recursive: true });
  const configJson = path.join(configDir, "config.json");
  if (!fs.existsSync(configJson)) {
    let gitHead = "unknown";
    try {
      gitHead = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf-8" }).trim();
    } catch {
      /* git が無い環境では unknown のまま */
    }
    fs.writeFileSync(
      configJson,
      JSON.stringify(
        { configHash: hash, gitHead, createdAt: new Date().toISOString(), hashedFiles: files },
        null,
        2,
      ),
      "utf-8",
    );
  }
  const resultsFile = path.join(configDir, "results.jsonl");
  console.log(`config: ${configDir} (workers=${workers}, seeds=${seeds[0]}..${seeds[seeds.length - 1]}, n=${seeds.length})`);

  let allOk = true;
  for (const strategy of strategies) {
    const existing = loadRecords(resultsFile).filter((r) => r.strategy === strategy);
    const doneSeeds = new Set(existing.map((r) => r.seed));
    const pending = seeds.filter((s) => !doneSeeds.has(s));
    if (!reportOnly && pending.length > 0) {
      console.log(`[${strategy}] running ${pending.length} seeds (${doneSeeds.size} already recorded)...`);
      const { failed } = await runStrategy(strategy, pending, workers, resultsFile);
      if (failed) allOk = false;
    }
    const records = loadRecords(resultsFile).filter(
      (r) => r.strategy === strategy && seeds.includes(r.seed),
    );
    const agg = aggregate(records);
    printAggregate(strategy, agg);
    if (records.length < seeds.length) {
      console.log(`  [warn] ${seeds.length - records.length} seeds missing (再実行で再開できます)`);
      allOk = false;
    }
    if (doCheckBands) {
      if (!checkBands(strategy, agg)) allOk = false;
    }
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
