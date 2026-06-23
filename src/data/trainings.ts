import { TrainingProgram } from "../types/game";

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  // ===== 基本訓練 (Lv1) =====
  {
    id: "training_str_1",
    name: "筋力鍛錬",
    description: "基礎的な筋肉トレーニング。STRが永続的に上昇する。",
    requiredFacilityLevel: 1,
    requiredTime: 8,
    goldCost: 80,
    statBonus: { str: 1 },
  },
  {
    id: "training_int_1",
    name: "瞑想",
    description: "精神を集中する瞑想。INTが永続的に上昇する。",
    requiredFacilityLevel: 1,
    requiredTime: 8,
    goldCost: 80,
    statBonus: { int: 1 },
  },
  {
    id: "training_agi_1",
    name: "敏捷訓練",
    description: "素早さを高める反復訓練。AGIが永続的に上昇する。",
    requiredFacilityLevel: 1,
    requiredTime: 8,
    goldCost: 80,
    statBonus: { agi: 1 },
  },
  {
    id: "training_dex_1",
    name: "的当て訓練",
    description: "正確な射撃・投擲の訓練。DEXが永続的に上昇する。",
    requiredFacilityLevel: 1,
    requiredTime: 8,
    goldCost: 80,
    statBonus: { dex: 1 },
  },
  {
    id: "training_vit_1",
    name: "耐久訓練",
    description: "過酷な環境下での耐久訓練。VITが永続的に上昇する。",
    requiredFacilityLevel: 1,
    requiredTime: 8,
    goldCost: 80,
    statBonus: { vit: 1 },
  },

  // ===== 中級訓練 (Lv2) =====
  {
    id: "training_str_2",
    name: "ウェイトトレーニング",
    description: "重りを使った本格的な筋力トレーニング。STRが大幅に上昇する。",
    requiredFacilityLevel: 2,
    requiredTime: 12,
    goldCost: 240,
    statBonus: { str: 2 },
  },
  {
    id: "training_int_2",
    name: "魔力制御",
    description: "魔法の流れを制御する高度な訓練。INTが大幅に上昇する。",
    requiredFacilityLevel: 2,
    requiredTime: 12,
    goldCost: 240,
    statBonus: { int: 2 },
  },
  {
    id: "training_agi_2",
    name: "ダッシュ訓練",
    description: "全力疾走と間合いの詰め方を学ぶ。AGIが大幅に上昇する。",
    requiredFacilityLevel: 2,
    requiredTime: 12,
    goldCost: 240,
    statBonus: { agi: 2 },
  },
  {
    id: "training_dex_2",
    name: "細工訓練",
    description: "精密な道具操作の訓練。DEXが大幅に上昇する。",
    requiredFacilityLevel: 2,
    requiredTime: 12,
    goldCost: 240,
    statBonus: { dex: 2 },
  },
  {
    id: "training_vit_2",
    name: "肉体強化",
    description: "全身の筋力と持久力を高める訓練。VITが大幅に上昇する。",
    requiredFacilityLevel: 2,
    requiredTime: 12,
    goldCost: 240,
    statBonus: { vit: 2 },
  },

  // ===== 上級訓練 (Lv3) =====
  {
    id: "training_str_3",
    name: "限界突破・力",
    description: "肉体の限界に挑む過酷な筋力訓練。STRが大きく上昇する。",
    requiredFacilityLevel: 3,
    requiredTime: 20,
    goldCost: 600,
    statBonus: { str: 4 },
  },
  {
    id: "training_int_3",
    name: "限界突破・魔力",
    description: "魔力の限界に挑む訓練。INTが大きく上昇する。",
    requiredFacilityLevel: 3,
    requiredTime: 20,
    goldCost: 600,
    statBonus: { int: 4 },
  },
  {
    id: "training_agi_3",
    name: "限界突破・速",
    description: "速度の限界に挑む訓練。AGIが大きく上昇する。",
    requiredFacilityLevel: 3,
    requiredTime: 20,
    goldCost: 600,
    statBonus: { agi: 4 },
  },
  {
    id: "training_dex_3",
    name: "限界突破・技巧",
    description: "技巧の限界に挑む精密訓練。DEXが大きく上昇する。",
    requiredFacilityLevel: 3,
    requiredTime: 20,
    goldCost: 600,
    statBonus: { dex: 4 },
  },
  {
    id: "training_vit_3",
    name: "限界突破・体",
    description: "体力の限界に挑む耐久訓練。VITが大きく上昇する。",
    requiredFacilityLevel: 3,
    requiredTime: 20,
    goldCost: 600,
    statBonus: { vit: 4 },
  },

  // ===== 超上級訓練 (Lv4) =====
  {
    id: "training_all_1",
    name: "超越訓練",
    description: "全能力をバランス良く高める究極の訓練。全能力が上昇する。",
    requiredFacilityLevel: 4,
    requiredTime: 30,
    goldCost: 1500,
    statBonus: { str: 3, int: 3, dex: 3, agi: 3, vit: 3 },
  },

  // ===== 伝説級訓練 (Lv5) =====
  {
    id: "training_all_2",
    name: "覚醒の試練",
    description: "村人の潜在能力を完全に覚醒させる伝説の試練。全能力とHPが大きく上昇する。",
    requiredFacilityLevel: 5,
    requiredTime: 48,
    goldCost: 4000,
    statBonus: { str: 5, int: 5, dex: 5, agi: 5, vit: 5, maxHp: 50, maxStamina: 30 },
  },
];

export const getTrainingProgram = (programId: string): TrainingProgram | undefined =>
  TRAINING_PROGRAMS.find((p) => p.id === programId);

export const getTrainingProgramsForFacility = (facilityLevel: number): TrainingProgram[] =>
  TRAINING_PROGRAMS.filter((p) => facilityLevel >= p.requiredFacilityLevel);
