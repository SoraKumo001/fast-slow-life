import { DungeonArea } from "../types/game";

export function processRespawns(dungeons: DungeonArea[]): DungeonArea[] {
  return dungeons.map((d) => ({
    ...d,
    gathers: d.gathers.map((g) => ({
      ...g,
      respawnTimeLeft: g.respawnTimeLeft ? Math.max(0, g.respawnTimeLeft - 1) : 0,
    })),
    monsters: d.monsters.map((m) => ({
      ...m,
      respawnTimeLeft: m.respawnTimeLeft ? Math.max(0, m.respawnTimeLeft - 1) : 0,
    })),
  }));
}
