import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { getBuildingById } from "../../../data/townLayout";
import {
  createPrototypeSimulation,
  type PrototypeAgentState,
  type PrototypeSimulation,
} from "../../../store/life/prototypeAgents";
import { TownViewport } from "./TownViewport";

const STATE_LABELS: Record<PrototypeAgentState, string> = {
  home: "家でのんびり",
  toWork: "通勤中",
  work: "仕事中",
  toPlaza: "広場へ移動中",
  plaza: "広場で休憩",
  toHome: "帰宅中",
  sleep: "就寝中",
};

interface AgentSnapshot {
  id: string;
  name: string;
  job: string;
  state: PrototypeAgentState;
  place: string;
  isVisible: boolean;
}

interface UiSnapshot {
  day: number;
  hour: number;
  agents: AgentSnapshot[];
}

function placeNameFor(agent: PrototypeSimulation["agents"][number]): string {
  switch (agent.state) {
    case "work":
    case "toWork":
      return getBuildingById(agent.workplaceId)?.name ?? agent.workplaceId;
    case "plaza":
    case "toPlaza":
      return "広場";
    default:
      return getBuildingById(agent.homeId)?.name ?? agent.homeId;
  }
}

function snapshotOf(sim: PrototypeSimulation): UiSnapshot {
  return {
    day: sim.day,
    hour: sim.hour,
    agents: sim.agents.map((a) => ({
      id: a.id,
      name: a.name,
      job: a.job,
      state: a.state,
      place: placeNameFor(a),
      isVisible: a.isVisible,
    })),
  };
}

function formatClock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const TownPrototypePage: React.FC = () => {
  const simRef = useRef<PrototypeSimulation | null>(null);
  if (simRef.current === null) {
    simRef.current = createPrototypeSimulation();
  }
  const sim = simRef.current;

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [azimuthDeg, setAzimuthDeg] = useState(0);
  const [ui, setUi] = useState<UiSnapshot>(() => snapshotOf(sim));

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // シミュレーション進行ループ (プロトタイプ時計: 1日 = 実時間60秒 @1x)
  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    let lastUiSync = 0;
    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        sim.tick(dt * speedRef.current);
      }
      if (now - lastUiSync > 120) {
        lastUiSync = now;
        setUi(snapshotOf(sim));
      }
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [sim]);

  // Q / E でカメラ回転
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "q" || e.key === "Q") setAzimuthDeg((v) => v - 90);
      if (e.key === "e" || e.key === "E") setAzimuthDeg((v) => v + 90);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const buttonClass =
    "flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition";
  const activeButtonClass =
    "flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 border border-sky-500 text-xs font-bold text-white transition";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 flex-wrap">
        <h1 className="text-sm font-black tracking-wide">
          FAST SLOW LIFE <span className="text-sky-400">― ポリゴンの町 Phase 0</span>
        </h1>
        <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-sm text-amber-300">
          Day {ui.day} {formatClock(ui.hour)}
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <button className={buttonClass} onClick={() => setPaused((v) => !v)}>
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? "再生" : "一時停止"}
          </button>
          <button
            className={speed === 1 ? activeButtonClass : buttonClass}
            onClick={() => setSpeed(1)}
          >
            1x
          </button>
          <button
            className={speed === 4 ? activeButtonClass : buttonClass}
            onClick={() => setSpeed(4)}
          >
            4x
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button className={buttonClass} onClick={() => setAzimuthDeg((v) => v - 90)}>
            <RotateCcw className="w-3.5 h-3.5" /> 左回転 (Q)
          </button>
          <button className={buttonClass} onClick={() => setAzimuthDeg((v) => v + 90)}>
            <RotateCw className="w-3.5 h-3.5" /> 右回転 (E)
          </button>
        </div>

        <a
          href={window.location.pathname}
          className="ml-auto text-xs text-slate-400 hover:text-slate-200 underline"
        >
          通常ゲームに戻る
        </a>
      </header>

      <main className="flex-1 flex gap-3 p-3 min-h-0">
        <div className="flex-1 min-w-0">
          <TownViewport simulation={sim} azimuthDeg={azimuthDeg} heightClass="h-full" />
        </div>

        <aside className="w-60 shrink-0 rounded-lg border border-slate-800 bg-slate-900/60 p-3 overflow-y-auto">
          <h2 className="text-xs font-bold text-slate-300 mb-2">村人の生活</h2>
          <ul className="space-y-2">
            {ui.agents.map((a) => (
              <li
                key={a.id}
                className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold">{a.name}</span>
                  <span className="text-[10px] text-slate-400">{a.job}</span>
                </div>
                <div className="text-[11px] text-sky-300 mt-0.5">
                  {STATE_LABELS[a.state]}
                  <span className="text-slate-400"> @ {a.place}</span>
                </div>
                {!a.isVisible && (
                  <div className="text-[10px] text-slate-500">💤 家の中で就寝中</div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500 leading-relaxed mt-3">
            プロトタイプ時計: 1日 = 実時間60秒 (1x)。06時起床 → 07–12時 仕事 → 12時 広場 →
            13–18時 仕事 → 18時 広場 → 22時 就寝、の1日ループを判定するための試作です。
          </p>
        </aside>
      </main>
    </div>
  );
};
