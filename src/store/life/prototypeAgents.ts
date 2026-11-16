import {
  getBuildingById,
  isWalkable,
  type GridPoint,
  type TownBuildingDef,
} from "../../data/townLayout";
import type { JobType } from "../../types/game";
import { findPath } from "./pathfinding";

/**
 * Phase 0 プロトタイプ用エージェントシミュレーション (Three 非依存の純粋 TS)。
 * プロトタイプ時計: 1 ゲーム日 = 実時間 60 秒 (1x)、つまり 1 ゲーム時間 = 2.5 秒。
 * tick(dtSeconds) の dtSeconds はプロトタイプ時計の秒 (速度倍率は呼び出し側が掛ける)。
 */

export const PROTOTYPE_DAY_SECONDS = 60;
export const GAME_HOURS_PER_DAY = 24;
export const SECONDS_PER_GAME_HOUR = PROTOTYPE_DAY_SECONDS / GAME_HOURS_PER_DAY; // 2.5

/** 歩行速度 (セル / ゲーム時間)。タイムラプス前提の速さ */
export const WALK_CELLS_PER_GAME_HOUR = 24;

/** 到着直後に最低限その場に留まる時間 (行き先の取り違え防止) */
const MIN_DWELL_HOURS = 0.25;
/** 作業・広場での小移動の間隔 */
const WANDER_INTERVAL_HOURS = 0.6;

export type PrototypeAgentState =
  | "home"
  | "toWork"
  | "work"
  | "toPlaza"
  | "plaza"
  | "toHome"
  | "sleep";

export type ScheduleActivity = "home" | "work" | "plaza" | "sleep";

/** 時刻 (0-24) → その時間帯にすべき活動 */
export function scheduleActivityAt(hour: number): ScheduleActivity {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 7 && h < 12) return "work";
  if (h >= 12 && h < 13) return "plaza";
  if (h >= 13 && h < 18) return "work";
  if (h >= 18 && h < 20) return "plaza";
  if (h >= 20 && h < 22) return "home";
  if (h >= 22 || h < 6) return "sleep";
  return "home"; // 06-07 起床
}

const STATIONARY_STATE: Record<ScheduleActivity, PrototypeAgentState> = {
  home: "home",
  work: "work",
  plaza: "plaza",
  sleep: "sleep",
};

const TRANSIT_STATE: Record<ScheduleActivity, PrototypeAgentState> = {
  home: "toHome",
  work: "toWork",
  plaza: "toPlaza",
  sleep: "toHome",
};

function activityOfState(state: PrototypeAgentState): ScheduleActivity | null {
  switch (state) {
    case "home":
      return "home";
    case "work":
      return "work";
    case "plaza":
      return "plaza";
    case "sleep":
      return "sleep";
    default:
      return null;
  }
}

export interface PrototypeAgentDef {
  id: string;
  name: string;
  job: JobType;
  homeId: string;
  workplaceId: string;
}

export const PROTOTYPE_AGENT_DEFS: PrototypeAgentDef[] = [
  { id: "alice", name: "アリス", job: "農民", homeId: "house_1", workplaceId: "farm" },
  { id: "bob", name: "ボブ", job: "木こり", homeId: "house_2", workplaceId: "lumberyard" },
  { id: "kana", name: "カナ", job: "職人", homeId: "house_3", workplaceId: "workshop" },
  { id: "leon", name: "レオン", job: "戦士", homeId: "house_4", workplaceId: "training_ground" },
  { id: "mia", name: "ミア", job: "薬師", homeId: "house_5", workplaceId: "alchemy" },
];

const PLAZA_SPOTS: GridPoint[] = [
  { x: 15, z: 15 },
  { x: 17, z: 15 },
  { x: 15, z: 17 },
  { x: 17, z: 17 },
  { x: 16, z: 14 },
];

const SPEED_FACTORS = [1.0, 0.92, 1.08, 0.97, 1.03];

export interface PrototypeAgent {
  id: string;
  name: string;
  job: JobType;
  homeId: string;
  workplaceId: string;
  state: PrototypeAgentState;
  /** グリッド座標 (小数、セル間を補間移動する) */
  pos: { x: number; z: number };
  /** 現在セル (pos の丸め) */
  cell: GridPoint;
  /** 移動中かどうか (描画側の歩行判定用) */
  isMoving: boolean;
  /** 就寝中は家の中で非表示 */
  isVisible: boolean;
  /** 現在の経路 (移動中のみ) */
  path: GridPoint[];
}

interface AgentRuntime {
  agent: PrototypeAgent;
  pathIndex: number;
  /** 移動の行き先活動。null なら作業中の小移動 (wander) */
  transitDestination: ScheduleActivity | null;
  dwellHours: number;
  wanderHours: number;
  wanderSeed: number;
  speedFactor: number;
  plazaSpot: GridPoint;
}

function buildingOrThrow(id: string): TownBuildingDef {
  const def = getBuildingById(id);
  if (!def) throw new Error(`unknown building: ${id}`);
  return def;
}

export class PrototypeSimulation {
  day = 1;
  /** 0-24 の小数時刻 */
  hour: number;
  agents: PrototypeAgent[] = [];
  private runtimes: AgentRuntime[] = [];

  constructor(startHour = 6) {
    this.hour = startHour;
    this.agents = PROTOTYPE_AGENT_DEFS.map((def, i) => {
      const home = buildingOrThrow(def.homeId);
      const agent: PrototypeAgent = {
        id: def.id,
        name: def.name,
        job: def.job,
        homeId: def.homeId,
        workplaceId: def.workplaceId,
        state: "home",
        pos: { x: home.entrance.x, z: home.entrance.z },
        cell: { ...home.entrance },
        isMoving: false,
        isVisible: true,
        path: [],
      };
      this.runtimes.push({
        agent,
        pathIndex: 0,
        transitDestination: null,
        dwellHours: 0,
        wanderHours: 0,
        wanderSeed: i * 13 + 7,
        speedFactor: SPEED_FACTORS[i % SPEED_FACTORS.length],
        plazaSpot: PLAZA_SPOTS[i % PLAZA_SPOTS.length],
      });
      return agent;
    });
  }

  /** プロトタイプ時計の秒数だけ進める */
  tick(dtSeconds: number): void {
    if (dtSeconds <= 0) return;
    let remainingHours = dtSeconds / SECONDS_PER_GAME_HOUR;
    // 大きな dt でもスケジュール判定が破綻しないよう小刻みに進める
    while (remainingHours > 0) {
      const step = Math.min(0.05, remainingHours);
      remainingHours -= step;
      for (const rt of this.runtimes) this.tickAgent(rt, step);
      this.hour += step;
      if (this.hour >= GAME_HOURS_PER_DAY) {
        this.hour -= GAME_HOURS_PER_DAY;
        this.day += 1;
      }
    }
  }

  private destinationCell(rt: AgentRuntime, activity: ScheduleActivity): GridPoint {
    const agent = rt.agent;
    if (activity === "work") return buildingOrThrow(agent.workplaceId).workAnchor;
    if (activity === "plaza") return rt.plazaSpot;
    return buildingOrThrow(agent.homeId).entrance;
  }

  private startTransit(rt: AgentRuntime, activity: ScheduleActivity): void {
    const agent = rt.agent;
    const dest = this.destinationCell(rt, activity);
    const start = { x: Math.round(agent.pos.x), z: Math.round(agent.pos.z) };
    if (start.x === dest.x && start.z === dest.z) {
      agent.path = [];
      agent.state = STATIONARY_STATE[activity];
      agent.isVisible = activity !== "sleep";
      rt.transitDestination = null;
      rt.dwellHours = 0;
      return;
    }
    const path = findPath(start, dest);
    if (!path || path.length <= 1) {
      // 到達不能時はその場で活動扱いにする (プロトタイプの安全策)
      agent.path = [];
      agent.state = STATIONARY_STATE[activity];
      agent.isVisible = activity !== "sleep";
      rt.transitDestination = null;
      rt.dwellHours = 0;
      return;
    }
    agent.path = path;
    rt.pathIndex = 1;
    rt.transitDestination = activity;
    agent.state = TRANSIT_STATE[activity];
    agent.isVisible = true;
  }

  private arrive(rt: AgentRuntime): void {
    const agent = rt.agent;
    const dest = rt.transitDestination;
    agent.path = [];
    rt.pathIndex = 0;
    rt.dwellHours = 0;
    rt.wanderHours = 0;
    if (dest) {
      agent.state = STATIONARY_STATE[dest];
      agent.isVisible = dest !== "sleep";
      rt.transitDestination = null;
    }
    agent.isMoving = false;
  }

  /** 経路に沿って dtHours 分移動する。到着したら true */
  private moveAlongPath(rt: AgentRuntime, dtHours: number): boolean {
    const agent = rt.agent;
    let distance = WALK_CELLS_PER_GAME_HOUR * rt.speedFactor * dtHours;
    agent.isMoving = distance > 0;
    while (distance > 0 && rt.pathIndex < agent.path.length) {
      const target = agent.path[rt.pathIndex];
      const dx = target.x - agent.pos.x;
      const dz = target.z - agent.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= distance) {
        agent.pos.x = target.x;
        agent.pos.z = target.z;
        distance -= dist;
        rt.pathIndex += 1;
      } else {
        agent.pos.x += (dx / dist) * distance;
        agent.pos.z += (dz / dist) * distance;
        distance = 0;
      }
    }
    agent.cell = { x: Math.round(agent.pos.x), z: Math.round(agent.pos.z) };
    return rt.pathIndex >= agent.path.length;
  }

  private startWander(rt: AgentRuntime): void {
    const agent = rt.agent;
    const activity = activityOfState(agent.state);
    if (activity !== "work" && activity !== "plaza") return;
    const anchor =
      activity === "work"
        ? buildingOrThrow(agent.workplaceId).workAnchor
        : rt.plazaSpot;
    const candidates: GridPoint[] = [];
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = anchor.x + dx;
        const cz = anchor.z + dz;
        if (cx === agent.cell.x && cz === agent.cell.z) continue;
        if (isWalkable(cx, cz)) candidates.push({ x: cx, z: cz });
      }
    }
    if (candidates.length === 0) return;
    rt.wanderSeed = rt.wanderSeed * 31 + 17;
    const target = candidates[Math.abs(rt.wanderSeed) % candidates.length];
    const path = findPath(agent.cell, target);
    if (!path || path.length <= 1) return;
    agent.path = path;
    rt.pathIndex = 1;
    rt.transitDestination = null;
  }

  private tickAgent(rt: AgentRuntime, dtHours: number): void {
    const agent = rt.agent;

    // 移動中 (行き先への移動 or 小移動)
    if (agent.path.length > 0) {
      const arrived = this.moveAlongPath(rt, dtHours);
      if (arrived) {
        if (rt.transitDestination) {
          this.arrive(rt);
        } else {
          // 小移動の完了: 元の定位置状態に戻る
          agent.path = [];
          rt.pathIndex = 0;
          agent.isMoving = false;
        }
      }
      return;
    }

    // 定位置: スケジュールとの差分を見て次の移動を決める
    rt.dwellHours += dtHours;
    const currentActivity = activityOfState(agent.state);
    const desired = scheduleActivityAt(this.hour);
    if (currentActivity !== null && desired !== currentActivity && rt.dwellHours >= MIN_DWELL_HOURS) {
      this.startTransit(rt, desired);
      return;
    }

    // 作業・広場では小さく動き回る
    if (agent.state === "work" || agent.state === "plaza") {
      rt.wanderHours += dtHours;
      if (rt.wanderHours >= WANDER_INTERVAL_HOURS) {
        rt.wanderHours = 0;
        this.startWander(rt);
      }
    }
    agent.isMoving = false;
  }
}

export function createPrototypeSimulation(startHour = 6): PrototypeSimulation {
  return new PrototypeSimulation(startHour);
}
