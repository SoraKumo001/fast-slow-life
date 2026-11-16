import { describe, it, expect } from "vitest";

import { getBuildingById, isWalkable } from "../../data/townLayout";
import {
  PROTOTYPE_AGENT_DEFS,
  createPrototypeSimulation,
  scheduleActivityAt,
  type PrototypeAgentState,
} from "./prototypeAgents";

describe("scheduleActivityAt", () => {
  it("時刻帯ごとに活動が切り替わること", () => {
    expect(scheduleActivityAt(6)).toBe("home");
    expect(scheduleActivityAt(7)).toBe("work");
    expect(scheduleActivityAt(11.9)).toBe("work");
    expect(scheduleActivityAt(12)).toBe("plaza");
    expect(scheduleActivityAt(13)).toBe("work");
    expect(scheduleActivityAt(18)).toBe("plaza");
    expect(scheduleActivityAt(20)).toBe("home");
    expect(scheduleActivityAt(22)).toBe("sleep");
    expect(scheduleActivityAt(0)).toBe("sleep");
    expect(scheduleActivityAt(5.9)).toBe("sleep");
  });
});

describe("prototypeAgents", () => {
  it("5人が仕様の職業・家・職場で生成されること", () => {
    const sim = createPrototypeSimulation();
    expect(sim.agents).toHaveLength(5);
    expect(sim.day).toBe(1);
    expect(sim.hour).toBe(6);
    for (const def of PROTOTYPE_AGENT_DEFS) {
      const agent = sim.agents.find((a) => a.id === def.id)!;
      expect(agent.name).toBe(def.name);
      expect(agent.job).toBe(def.job);
      const home = getBuildingById(def.homeId)!;
      expect(agent.cell).toEqual(home.entrance);
      expect(agent.state).toBe("home");
    }
  });

  it("1日ループを完走し、全員が職場・広場・家 (就寝) を訪れること", () => {
    const sim = createPrototypeSimulation();
    const visited = new Map<string, Set<PrototypeAgentState>>();
    const wasAtWorkplace = new Set<string>();
    const wasAtPlaza = new Set<string>();
    sim.agents.forEach((a) => visited.set(a.id, new Set()));

    // Day1 06:00 から Day2 06:00 まで、実時間 60 秒分を 0.1 秒刻みで進める
    for (let t = 0; t < 60; t += 0.1) {
      sim.tick(0.1);
      for (const agent of sim.agents) {
        visited.get(agent.id)!.add(agent.state);
        // 移動中も含め、現在セルは常に歩行可能であること (建物を突き抜けない)
        expect(
          isWalkable(agent.cell.x, agent.cell.z),
          `${agent.id} in blocked cell ${agent.cell.x},${agent.cell.z} at day${sim.day} ${sim.hour.toFixed(2)}`,
        ).toBe(true);
        const work = getBuildingById(agent.workplaceId)!;
        if (agent.cell.x === work.workAnchor.x && agent.cell.z === work.workAnchor.z) {
          wasAtWorkplace.add(agent.id);
        }
        const plaza = getBuildingById("plaza")!;
        if (
          agent.cell.x >= plaza.x &&
          agent.cell.x < plaza.x + plaza.w &&
          agent.cell.z >= plaza.z &&
          agent.cell.z < plaza.z + plaza.d
        ) {
          wasAtPlaza.add(agent.id);
        }
      }
    }

    expect(sim.day).toBe(2);
    for (const agent of sim.agents) {
      const states = visited.get(agent.id)!;
      expect(states.has("work"), `${agent.id} never worked: ${[...states]}`).toBe(true);
      expect(states.has("plaza"), `${agent.id} never visited plaza: ${[...states]}`).toBe(true);
      expect(states.has("sleep"), `${agent.id} never slept: ${[...states]}`).toBe(true);
      expect(states.has("toWork"), `${agent.id} never commuted`).toBe(true);
      expect(states.has("toHome"), `${agent.id} never went home`).toBe(true);
      expect(wasAtWorkplace.has(agent.id), `${agent.id} never reached workplace`).toBe(true);
      expect(wasAtPlaza.has(agent.id), `${agent.id} never reached plaza cells`).toBe(true);
      // 1日終わりは家で就寝していること
      const home = getBuildingById(agent.homeId)!;
      expect(agent.cell).toEqual(home.entrance);
      expect(agent.state).toBe("sleep");
      expect(agent.isVisible).toBe(false);
    }
  });

  it("経路の全マスが歩行可能であること (移動中の経路を検証)", () => {
    const sim = createPrototypeSimulation();
    let sawPath = false;
    for (let t = 0; t < 30; t += 0.1) {
      sim.tick(0.1);
      for (const agent of sim.agents) {
        if (agent.path.length > 0) {
          sawPath = true;
          for (const cell of agent.path) {
            expect(isWalkable(cell.x, cell.z)).toBe(true);
          }
        }
      }
    }
    expect(sawPath).toBe(true);
  });

  it("朝の通勤で全員が職場に到着すること", () => {
    const sim = createPrototypeSimulation();
    // 06:00 → 11:00 まで進める (実時間 12.5 秒)
    for (let t = 0; t < 12.5; t += 0.1) sim.tick(0.1);
    expect(sim.hour).toBeCloseTo(11, 0);
    for (const agent of sim.agents) {
      expect(agent.state, `${agent.id} state`).toBe("work");
    }
  });
});
