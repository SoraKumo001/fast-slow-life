import { SoulUpgrade } from "../types/game";

// costs[i] = Lv i → i+1 への強化に必要SP（前半は線形ベース、後半を急騰）
export const SOUL_UPGRADES: SoulUpgrade[] = [
  {
    id: "heritage",
    name: "先祖の遺産",
    description: "初期ゴールド +800",
    level: 0,
    maxLevel: 10,
    costs: [8, 16, 24, 32, 40, 60, 90, 140, 210, 320],
    effectValue: 800,
  },
  {
    id: "storage",
    name: "豊かな備蓄",
    description: "初期食料 +150",
    level: 0,
    maxLevel: 10,
    costs: [4, 8, 12, 16, 20, 30, 45, 70, 105, 160],
    effectValue: 150,
  },
  {
    id: "education",
    name: "英才教育",
    description: "村人の獲得経験値 +15%",
    level: 0,
    maxLevel: 5,
    costs: [15, 30, 45, 80, 140],
    effectValue: 0.15,
  },
  {
    id: "body",
    name: "頑強な肉体",
    description: "全村人の初期ステータス +3",
    level: 0,
    maxLevel: 5,
    costs: [12, 24, 36, 65, 110],
    effectValue: 3,
  },
  {
    id: "building",
    name: "効率的な建築",
    description: "施設アップグレードの素材必要量 -8%",
    level: 0,
    maxLevel: 5,
    costs: [20, 40, 60, 110, 180],
    effectValue: 0.08,
  },
  {
    id: "discount",
    name: "値切り上手",
    description: "転職に必要なゴールド -10%",
    level: 0,
    maxLevel: 5,
    costs: [12, 24, 36, 65, 110],
    effectValue: 0.1,
  },
];
