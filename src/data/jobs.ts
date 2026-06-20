import { JobType } from "../types/game";

export const JOBS: Record<
  JobType,
  {
    name: string;
    description: string;
    cost: number;
    statsMultiplier: {
      str: number;
      int: number;
      agi: number;
      dex: number;
      vit: number;
    };
    adaptability: Record<string, number>; // カテゴリ別採取適性
    requirements?: {
      level: number;
      jobs?: JobType[];
    };
  }
> = {
  無職: {
    name: "無職",
    description: "初期状態。特に目立った特徴はありません。",
    cost: 0,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 1.0, dex: 1.0, vit: 1.0 },
    adaptability: {},
  },
  農民: {
    name: "農民",
    description: "食料の採取効率が非常に高い。",
    cost: 100,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.1, dex: 1.0, vit: 1.0 },
    adaptability: { food: 2.0 },
    requirements: { level: 1 },
  },
  鉱夫: {
    name: "鉱夫",
    description: "鉱石・石材の採取効率が非常に高い。",
    cost: 150,
    statsMultiplier: { str: 1.3, int: 0.7, agi: 0.8, dex: 1.0, vit: 1.2 },
    adaptability: { ore: 2.0, material: 1.5 }, // 石材も多め
    requirements: { level: 1 },
  },
  薬師: {
    name: "薬師",
    description: "薬草の採取効率が非常に高い。魔法石の採取も得意。",
    cost: 150,
    statsMultiplier: { str: 0.8, int: 1.2, agi: 1.0, dex: 1.3, vit: 0.8 },
    adaptability: { herb: 2.0, mana_stone: 1.2 },
    requirements: { level: 1 },
  },
  猟師: {
    name: "猟師",
    description: "食料や討伐素材（毛皮・骨）の獲得量が多い。",
    cost: 200,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.2, dex: 1.2, vit: 0.9 },
    adaptability: { food: 1.5 }, // 討伐ドロップ率も後で考慮
    requirements: { level: 1 },
  },
  戦士: {
    name: "戦士",
    description: "物理戦闘のスペシャリスト。高い攻撃力と耐久力。",
    cost: 300,
    statsMultiplier: { str: 1.4, int: 0.5, agi: 1.1, dex: 1.0, vit: 1.3 },
    adaptability: {},
    requirements: { level: 5, jobs: ["猟師"] },
  },
  魔術師: {
    name: "魔術師",
    description: "魔法戦闘のスペシャリスト。魔法石の採取も得意。",
    cost: 350,
    statsMultiplier: { str: 0.5, int: 1.5, agi: 1.0, dex: 1.1, vit: 0.7 },
    adaptability: { mana_stone: 2.0 },
    requirements: { level: 5, jobs: ["薬師"] },
  },
  僧侶: {
    name: "僧侶",
    description: "回復スキルの使い手。戦闘中の生存力を高める。薬草採取も得意。",
    cost: 350,
    statsMultiplier: { str: 0.8, int: 1.3, agi: 0.9, dex: 1.1, vit: 1.1 },
    adaptability: { herb: 1.3 },
    requirements: { level: 5, jobs: ["薬師"] },
  },
  職人: {
    name: "職人",
    description: "施設でのクラフト大成功率が高い。鉱石などの加工が得意。",
    cost: 300,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 0.9, dex: 1.4, vit: 1.0 },
    adaptability: { ore: 1.2 },
    requirements: { level: 5, jobs: ["鉱夫"] },
  },
};
