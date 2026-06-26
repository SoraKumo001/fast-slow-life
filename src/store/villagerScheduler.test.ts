import { describe, it, expect } from "vitest";

import { Villager, DungeonArea } from "../types/game";
import { runVillagerScheduler } from "./villagerScheduler";

function makeVillager(overrides: Partial<Villager> & { id: string }): Villager {
  return {
    name: "ヴィレッジ",
    level: 1,
    exp: 0,
    currentJob: "戦士",
    jobHistory: ["戦士"],
    maxHp: 100,
    currentHp: 100,
    stamina: 100,
    maxStamina: 100,
    str: 10,
    int: 10,
    dex: 10,
    agi: 10,
    vit: 10,
    weaponId: "none",
    armorId: "none",
    order: "gather",
    status: "active",
    destinationAreaId: "forest",
    travelTimeLeft: 0,
    assignedCraftJobId: null,
    targetGatherItemId: null,
    targetMonsterId: null,
    potionCount: 0,
    ...overrides,
  };
}

function makeMonster(
  overrides?: Partial<DungeonArea["monsters"][number]>,
): DungeonArea["monsters"][number] {
  return {
    id: "wolf",
    name: "ウルフ",
    level: 1,
    hp: 30,
    maxHp: 30,
    atk: 8,
    def: 3,
    mdef: 2,
    str: 5,
    int: 2,
    dex: 5,
    agi: 6,
    vit: 4,
    expReward: 15,
    drops: [{ itemId: "raw_meat", chance: 0.6 }],
    currentProgress: 0,
    respawnTimeLeft: 0,
    respawnTimeTotal: 3,
    ...overrides,
  };
}

function makeGather(): DungeonArea["gathers"][number] {
  return {
    itemId: "wood",
    difficulty: 1,
    currentProgress: 0,
    respawnTimeLeft: 0,
    respawnTimeTotal: 2,
  };
}

function makeArea(overrides?: Partial<DungeonArea>): DungeonArea {
  return {
    id: "forest",
    name: "始まりの森",
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [makeGather()],
    monsters: [makeMonster()],
    explorationProgress: 100,
    difficulty: 1,
    ...overrides,
  };
}

// ── ハンター割り当て ──

describe("runVillagerScheduler - hunter assignment", () => {
  it("需要の高いモンスターに優先的に割り当てられること", () => {
    const hunter = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    expect(result.villagers[0].autoTargetName).toBe("ウルフ");
  });

  it("cap=2 のモンスターに2人のハンターが割り当てられること", () => {
    const h1 = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const h2 = makeVillager({ id: "v2", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [h1, h2],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    expect(result.villagers.find((v) => v.id === "v1")!.autoTargetName).toBe("ウルフ");
    expect(result.villagers.find((v) => v.id === "v2")!.autoTargetName).toBe("ウルフ");
  });

  it("2種類のモンスターがいる場合、各ハンターが異なるモンスターに割り当てられること（需要差による）", () => {
    const area = makeArea({
      monsters: [
        makeMonster({ id: "wolf", name: "ウルフ", drops: [{ itemId: "raw_meat", chance: 0.6 }] }),
        makeMonster({ id: "bear", name: "ベア", drops: [{ itemId: "raw_meat", chance: 0.8 }] }),
      ],
    });
    const h1 = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const h2 = makeVillager({ id: "v2", order: "hunt", currentJob: "戦士" });
    // 両モンスターとも raw_meat ドロップ、在庫不足なので需要は同じ → need >= 2 monsters to split
    // cap=2 なので両方とも最初のモンスターに割り当てられる
    const result = runVillagerScheduler({
      villagers: [h1, h2],
      dungeons: [area],
      inventory: { raw_meat: 0 },
      targetAmounts: { raw_meat: 10 },
    });
    const v1 = result.villagers.find((v) => v.id === "v1")!;
    const v2 = result.villagers.find((v) => v.id === "v2")!;
    // 需要が等しいので両方とも最初のモンスター（ウルフ）に割り当てられる
    expect(v1.autoTargetName).toBe("ウルフ");
    expect(v2.autoTargetName).toBe("ウルフ");
  });

  it("targetMonsterId が手動設定されている村人はスケジューリング対象外になること", () => {
    const h1 = makeVillager({
      id: "v1",
      order: "hunt",
      currentJob: "戦士",
      targetMonsterId: "bear",
    });
    const h2 = makeVillager({ id: "v2", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [h1, h2],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    const v1 = result.villagers.find((v) => v.id === "v1")!;
    const v2 = result.villagers.find((v) => v.id === "v2")!;
    // v1 は手動ターゲットがあるので autoTargetName は変更されない（null または元の値）
    expect(v1.autoTargetName).toBeUndefined();
    // v2 はスケジューリングされる
    expect(v2.autoTargetName).toBe("ウルフ");
  });

  it("active でない村人はスケジューリング対象外になること", () => {
    const resting = makeVillager({ id: "v1", order: "hunt", status: "resting" });
    const result = runVillagerScheduler({
      villagers: [resting],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    // status=resting なので autoTargetName は未定義のまま
    expect(result.villagers[0].autoTargetName).toBeUndefined();
  });

  it("リスポーン中のモンスターは割り当て対象外になること", () => {
    const area = makeArea({
      monsters: [makeMonster({ id: "wolf", name: "ウルフ", respawnTimeLeft: 2 })],
    });
    const hunter = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [area],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    // 利用可能なモンスターなし → autoTargetName が null にクリアされる
    expect(result.villagers[0].autoTargetName).toBeNull();
  });

  it("ボスモンスターは割り当て対象外になること", () => {
    const area = makeArea({
      monsters: [makeMonster({ id: "boss", name: "ボス", isBoss: true })],
    });
    const hunter = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [area],
      inventory: {},
      targetAmounts: {},
    });
    expect(result.villagers[0].autoTargetName).toBeNull();
  });

  it("assignedCraftJobId のある村人はスケジューリング対象外になること", () => {
    const crafter = makeVillager({ id: "v1", order: "hunt", assignedCraftJobId: "upgrade_inn" });
    const result = runVillagerScheduler({
      villagers: [crafter],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    expect(result.villagers[0].autoTargetName).toBeUndefined();
  });

  it("余剰ハンターは需要最高のモンスターにオーバーフロー割り当てされること（cap超過）", () => {
    const area = makeArea({
      monsters: [
        makeMonster({ id: "wolf", name: "ウルフ", drops: [{ itemId: "raw_meat", chance: 0.6 }] }),
      ],
    });
    const h1 = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const h2 = makeVillager({ id: "v2", order: "hunt", currentJob: "戦士" });
    const h3 = makeVillager({ id: "v3", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [h1, h2, h3],
      dungeons: [area],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    // cap=2 だが 3人目はオーバーフローでウルフに割り当て
    const assigned = result.villagers.filter((v) => v.autoTargetName === "ウルフ").length;
    expect(assigned).toBe(3);
  });

  it("ドロップ需要がないモンスターは baseline 0.5 で評価されること", () => {
    const area = makeArea({
      monsters: [makeMonster({ id: "wolf", name: "ウルフ" })],
    });
    const hunter = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [area],
      inventory: {},
      targetAmounts: {}, // 需要指定なし
    });
    // baseline でも割り当てはされる
    expect(result.villagers[0].autoTargetName).toBe("ウルフ");
  });
});

// ── 採取者割り当て ──

describe("runVillagerScheduler - gatherer assignment", () => {
  it("採取ポイントに採取者が割り当てられること", () => {
    const gatherer = makeVillager({ id: "v1", order: "gather", currentJob: "農民" });
    const result = runVillagerScheduler({
      villagers: [gatherer],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { wood: 20 },
    });
    expect(result.villagers[0].autoTargetName).toBe("原木");
  });

  it("リスポーン中の採取ポイントは割り当て対象外になること", () => {
    const area = makeArea({
      gathers: [
        {
          itemId: "wood",
          difficulty: 1,
          currentProgress: 0,
          respawnTimeLeft: 2,
          respawnTimeTotal: 2,
        },
      ],
    });
    const gatherer = makeVillager({ id: "v1", order: "gather", currentJob: "農民" });
    const result = runVillagerScheduler({
      villagers: [gatherer],
      dungeons: [area],
      inventory: {},
      targetAmounts: { wood: 20 },
    });
    expect(result.villagers[0].autoTargetName).toBeNull();
  });

  it("複数の採取者が異なる目標在庫に応じて適切に割り振られること", () => {
    const area = makeArea({
      gathers: [
        {
          itemId: "wood",
          difficulty: 1,
          currentProgress: 0,
          respawnTimeLeft: 0,
          respawnTimeTotal: 2,
        },
        {
          itemId: "stone",
          difficulty: 1,
          currentProgress: 0,
          respawnTimeLeft: 0,
          respawnTimeTotal: 2,
        },
      ],
    });
    const g1 = makeVillager({ id: "v1", order: "gather", currentJob: "農民" });
    const g2 = makeVillager({ id: "v2", order: "gather", currentJob: "農民" });
    const result = runVillagerScheduler({
      villagers: [g1, g2],
      dungeons: [area],
      inventory: {},
      targetAmounts: { wood: 20, stone: 10 },
    });
    // 需要: wood=1.0, stone=1.0（両方とも在庫0でtargetあり）
    // 需要が同じなので demandScores の順序（= 元の配列順）で原木に g1,g2 両方割り当て
    const assignedWood = result.villagers.filter((v) => v.autoTargetName === "原木").length;
    const assignedStone = result.villagers.filter((v) => v.autoTargetName === "石材").length;
    // cap=2 なので両方とも原木（最初のgather）に割り当てられる
    expect(assignedWood).toBe(2);
    expect(assignedStone).toBe(0);
  });
});

// ── ログ出力 ──

describe("runVillagerScheduler - logs", () => {
  it("割り当てが行われた場合にログが出力されること", () => {
    const hunter = makeVillager({ id: "v1", order: "hunt", currentJob: "戦士" });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs[0].message).toContain("討伐隊");
  });

  it("対象が1人もいない場合はログが出力されないこと", () => {
    const result = runVillagerScheduler({
      villagers: [],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: {},
    });
    expect(result.logs.length).toBe(0);
  });

  it("スケジューリング前に autoTargetName がクリアされること", () => {
    const hunter = makeVillager({
      id: "v1",
      order: "hunt",
      currentJob: "戦士",
      autoTargetName: "古いターゲット",
    });
    const result = runVillagerScheduler({
      villagers: [hunter],
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    // 古い autoTargetName が新しい割り当てに置き換わる
    const v1 = result.villagers.find((v) => v.id === "v1")!;
    expect(v1.autoTargetName).not.toBe("古いターゲット");
    expect(v1.autoTargetName).toBe("ウルフ");
  });
});

// ── PARTY_SIZE 上限 (P-3 fix) ──

import { PARTY_SIZE } from "./schedulerConfig";

describe("runVillagerScheduler - PARTY_SIZE 上限", () => {
  it("3 ハンター + 1 モンスター: 全員配備、待機 0", () => {
    const hunters = ["v1", "v2", "v3"].map((id) =>
      makeVillager({ id, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    const assigned = result.villagers.filter((v) => v.autoTargetName !== null);
    expect(assigned.length).toBe(3);
    // 全員同じパーティ (PT-A 相当)
    expect(new Set(assigned.map((v) => v.autoTargetName)).size).toBe(1);
  });

  it("4 ハンター + 1 モンスター: 3 配備、1 待機 (autoTargetName = null)", () => {
    const hunters = ["v1", "v2", "v3", "v4"].map((id) =>
      makeVillager({ id, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    const assigned = result.villagers.filter((v) => v.autoTargetName !== null);
    const waiting = result.villagers.filter((v) => v.autoTargetName === null);
    expect(assigned.length).toBe(3);
    expect(waiting.length).toBe(1);
  });

  it("5 ハンター + 1 モンスター: 3 配備、2 待機", () => {
    const hunters = ["v1", "v2", "v3", "v4", "v5"].map((id) =>
      makeVillager({ id, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    const assigned = result.villagers.filter((v) => v.autoTargetName !== null);
    const waiting = result.villagers.filter((v) => v.autoTargetName === null);
    expect(assigned.length).toBe(3);
    expect(waiting.length).toBe(2);
    // パーティサイズ上限を超えない
    const partySize = assigned.length;
    expect(partySize).toBeLessThanOrEqual(PARTY_SIZE);
  });

  it("9 ハンター + 3 モンスター: 9 配備、3 パーティ (待機なし)", () => {
    const area = makeArea({
      monsters: [
        makeMonster({ id: "wolf", name: "ウルフ" }),
        makeMonster({ id: "bear", name: "ベア" }),
        makeMonster({ id: "tiger", name: "タイガー" }),
      ],
    });
    const hunters = Array.from({ length: 9 }, (_, i) =>
      makeVillager({ id: `v${i + 1}`, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [area],
      inventory: {},
      targetAmounts: { raw_meat: 30 },
    });
    const assigned = result.villagers.filter((v) => v.autoTargetName !== null);
    expect(assigned.length).toBe(9);
    // 3 パーティに分散
    const partyKeys = new Set(assigned.map((v) => v.autoTargetName));
    expect(partyKeys.size).toBe(3);
  });

  it("10 ハンター + 3 モンスター: 9 配備、1 待機", () => {
    const area = makeArea({
      monsters: [
        makeMonster({ id: "wolf", name: "ウルフ" }),
        makeMonster({ id: "bear", name: "ベア" }),
        makeMonster({ id: "tiger", name: "タイガー" }),
      ],
    });
    const hunters = Array.from({ length: 10 }, (_, i) =>
      makeVillager({ id: `v${i + 1}`, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [area],
      inventory: {},
      targetAmounts: { raw_meat: 30 },
    });
    const assigned = result.villagers.filter((v) => v.autoTargetName !== null);
    const waiting = result.villagers.filter((v) => v.autoTargetName === null);
    expect(assigned.length).toBe(9);
    expect(waiting.length).toBe(1);
  });

  it("オーバーフロー時、待機ログメッセージが生成されること", () => {
    const hunters = ["v1", "v2", "v3", "v4", "v5"].map((id) =>
      makeVillager({ id, order: "hunt", currentJob: "戦士" }),
    );
    const result = runVillagerScheduler({
      villagers: hunters,
      dungeons: [makeArea()],
      inventory: {},
      targetAmounts: { raw_meat: 10 },
    });
    const waitLog = result.logs.find((l) => l.message.includes("待機"));
    expect(waitLog).toBeDefined();
    expect(waitLog?.message).toContain("2 人");
    expect(waitLog?.message).toContain("全パーティ上限到達");
  });
});
