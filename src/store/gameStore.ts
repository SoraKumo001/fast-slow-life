import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState, Villager, JobType, Item, Facility, DungeonArea, Monster, GameLog, FacilityType, OrderType, SoulUpgrade } from '../types/game';

// ==========================================
// 1. マスタデータ定義
// ==========================================

export const ITEMS: Record<string, Item> = {
  food: { id: 'food', name: '食料', category: 'food', sellPrice: 1, difficulty: 1.0, description: '生きるために必要な食料。毎時間村人が消費する。' },
  wood: { id: 'wood', name: '原木', category: 'material', sellPrice: 1, difficulty: 1.0, description: '基本的な木材。加工やアップグレードに使用する。' },
  stone: { id: 'stone', name: '石材', category: 'material', sellPrice: 1, difficulty: 1.2, description: '建築や加工に使用する石。' },
  iron_ore: { id: 'iron_ore', name: '鉄鉱石', category: 'ore', sellPrice: 2, difficulty: 1.8, description: '鍛冶屋で精錬してインゴットにする。' },
  herb: { id: 'herb', name: '薬草', category: 'herb', sellPrice: 2, difficulty: 1.5, description: '回復薬の原料となる草。' },
  mana_stone: { id: 'mana_stone', name: '魔法石', category: 'mana_stone', sellPrice: 5, difficulty: 2.5, description: '魔力の込められた結晶。' },
  leather: { id: 'leather', name: '獣の毛皮', category: 'material', sellPrice: 3, difficulty: 1.5, description: '討伐で手に入る皮。防具のクラフトに使う。' },
  bone: { id: 'bone', name: '動物の骨', category: 'material', sellPrice: 2, difficulty: 1.2, description: '討伐で手に入る骨。' },
  
  // 中間素材
  wood_plank: {
    id: 'wood_plank', name: '木板', category: 'material', sellPrice: 4, difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: 'wood', count: 3 }], requiredTime: 1 }
  },
  iron_ingot: {
    id: 'iron_ingot', name: '鉄インゴット', category: 'material', sellPrice: 10, difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: 'iron_ore', count: 3 }], requiredTime: 2 }
  },
  
  // 消費アイテム
  potion: {
    id: 'potion', name: '回復薬', category: 'consumable', sellPrice: 8, difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: 'herb', count: 2 }, { itemId: 'food', count: 1 }], requiredTime: 2 }
  },
  
  // 装備品
  iron_sword: {
    id: 'iron_sword', name: '鉄の剣', category: 'gear_weapon', sellPrice: 30, difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: 'iron_ingot', count: 2 }, { itemId: 'wood_plank', count: 1 }], requiredTime: 4 }
  },
  iron_armor: {
    id: 'iron_armor', name: '鉄の鎧', category: 'gear_armor', sellPrice: 45, difficulty: 1.0,
    recipe: { requiredItems: [{ itemId: 'iron_ingot', count: 3 }, { itemId: 'leather', count: 2 }], requiredTime: 5 }
  }
};

export const MONSTERS: Record<string, Monster> = {
  goblin: { id: 'goblin', name: 'ゴブリン', level: 1, hp: 30, maxHp: 30, atk: 5, def: 2, mdef: 1, expReward: 10, drops: [{ itemId: 'food', chance: 0.5 }, { itemId: 'wood', chance: 0.3 }] },
  goblin_leader: { id: 'goblin_leader', name: 'ゴブリンロード', level: 5, hp: 200, maxHp: 200, atk: 15, def: 6, mdef: 5, expReward: 100, drops: [{ itemId: 'bone', chance: 1.0 }, { itemId: 'leather', chance: 0.5 }], isBoss: true },
  
  bat: { id: 'bat', name: 'ジャイアントバット', level: 4, hp: 45, maxHp: 45, atk: 12, def: 3, mdef: 4, expReward: 18, drops: [{ itemId: 'leather', chance: 0.6 }] },
  slime: { id: 'slime', name: 'ストーンスライム', level: 6, hp: 80, maxHp: 80, atk: 9, def: 12, mdef: 2, expReward: 25, drops: [{ itemId: 'stone', chance: 0.7 }] },
  golem: { id: 'golem', name: 'アイアンゴーレム', level: 12, hp: 600, maxHp: 600, atk: 32, def: 25, mdef: 10, expReward: 300, drops: [{ itemId: 'iron_ore', chance: 1.0 }], isBoss: true },
  
  orc: { id: 'orc', name: 'オークソルジャー', level: 10, hp: 140, maxHp: 140, atk: 26, def: 11, mdef: 5, expReward: 45, drops: [{ itemId: 'food', chance: 0.6 }, { itemId: 'bone', chance: 0.4 }] },
  werewolf: { id: 'werewolf', name: 'ワーウルフ', level: 13, hp: 170, maxHp: 170, atk: 35, def: 9, mdef: 8, expReward: 60, drops: [{ itemId: 'leather', chance: 0.8 }] },
  chimera: { id: 'chimera', name: 'キマイラ', level: 25, hp: 1500, maxHp: 1500, atk: 65, def: 35, mdef: 35, expReward: 1000, drops: [{ itemId: 'mana_stone', chance: 1.0 }], isBoss: true },
  
  demon: { id: 'demon', name: 'レッサーデーモン', level: 20, hp: 250, maxHp: 250, atk: 55, def: 20, mdef: 30, expReward: 120, drops: [{ itemId: 'mana_stone', chance: 0.7 }] },
  gargoyle: { id: 'gargoyle', name: 'ガーゴイル', level: 22, hp: 300, maxHp: 300, atk: 60, def: 40, mdef: 15, expReward: 150, drops: [{ itemId: 'stone', chance: 0.8 }] },
  archdemon: { id: 'archdemon', name: 'アークデーモン', level: 40, hp: 3500, maxHp: 3500, atk: 120, def: 60, mdef: 60, expReward: 3000, drops: [{ itemId: 'mana_stone', chance: 1.0 }], isBoss: true },
  
  dragon_spawn: { id: 'dragon_spawn', name: 'ハーフドラゴン', level: 35, hp: 600, maxHp: 600, atk: 110, def: 50, mdef: 45, expReward: 400, drops: [{ itemId: 'mana_stone', chance: 0.9 }] },
  ancient_dragon: { id: 'ancient_dragon', name: '終焉の竜', level: 60, hp: 10000, maxHp: 10000, atk: 250, def: 120, mdef: 120, expReward: 10000, drops: [], isBoss: true }
};

export const DUNGEONS: DungeonArea[] = [
  {
    id: 'forest',
    name: '始まりの森',
    distance: 1,
    recommendedLevel: 1,
    unlockedAtTier: 1,
    gathers: [
      { itemId: 'food', difficulty: 1.0 },
      { itemId: 'wood', difficulty: 1.0 },
      { itemId: 'herb', difficulty: 1.5 }
    ],
    monsters: [MONSTERS.goblin, MONSTERS.goblin_leader]
  },
  {
    id: 'mine',
    name: '廃鉱山',
    distance: 2,
    recommendedLevel: 5,
    unlockedAtTier: 2,
    gathers: [
      { itemId: 'stone', difficulty: 1.2 },
      { itemId: 'iron_ore', difficulty: 1.8 }
    ],
    monsters: [MONSTERS.bat, MONSTERS.slime, MONSTERS.golem]
  },
  {
    id: 'valley',
    name: '魔獣の谷',
    distance: 3,
    recommendedLevel: 12,
    unlockedAtTier: 3,
    gathers: [
      { itemId: 'herb', difficulty: 2.0 },
      { itemId: 'mana_stone', difficulty: 3.0 }
    ],
    monsters: [MONSTERS.orc, MONSTERS.werewolf, MONSTERS.chimera]
  },
  {
    id: 'world_tree',
    name: '世界樹の根',
    distance: 4,
    recommendedLevel: 20,
    unlockedAtTier: 4,
    gathers: [
      { itemId: 'wood', difficulty: 2.0 },
      { itemId: 'herb', difficulty: 2.5 },
      { itemId: 'mana_stone', difficulty: 3.5 }
    ],
    monsters: [MONSTERS.demon, MONSTERS.gargoyle, MONSTERS.archdemon]
  },
  {
    id: 'abyss',
    name: '深淵の奈落',
    distance: 5,
    recommendedLevel: 35,
    unlockedAtTier: 5,
    gathers: [
      { itemId: 'mana_stone', difficulty: 4.0 }
    ],
    monsters: [MONSTERS.dragon_spawn, MONSTERS.ancient_dragon]
  }
];

export const SOUL_UPGRADES: SoulUpgrade[] = [
  { id: 'heritage', name: '先祖の遺産', description: '初期ゴールド +500', level: 0, maxLevel: 10, costPerLevel: 10, effectValue: 500 },
  { id: 'storage', name: '豊かな備蓄', description: '初期食料 +100', level: 0, maxLevel: 10, costPerLevel: 5, effectValue: 100 },
  { id: 'education', name: '英才教育', description: '村人の獲得経験値 +10%', level: 0, maxLevel: 5, costPerLevel: 20, effectValue: 0.1 },
  { id: 'body', name: '頑強な肉体', description: '全村人の初期ステータス +2', level: 0, maxLevel: 5, costPerLevel: 15, effectValue: 2 },
  { id: 'building', name: '効率的な建築', description: '施設アップグレードの素材必要量 -5%', level: 0, maxLevel: 5, costPerLevel: 25, effectValue: 0.05 },
  { id: 'discount', name: '値切り上手', description: '転職に必要なゴールド -10%', level: 0, maxLevel: 5, costPerLevel: 15, effectValue: 0.1 }
];

export const JOBS: Record<JobType, {
  name: string;
  description: string;
  cost: number;
  statsMultiplier: { str: number; int: number; agi: number; dex: number; vit: number };
  adaptability: Record<string, number>; // カテゴリ別採取適性
}> = {
  '無職': {
    name: '無職', description: '初期状態。特に目立った特徴はありません。', cost: 0,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 1.0, dex: 1.0, vit: 1.0 },
    adaptability: {}
  },
  '農民': {
    name: '農民', description: '食料の採取効率が非常に高い。', cost: 100,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.1, dex: 1.0, vit: 1.0 },
    adaptability: { food: 2.0 }
  },
  '鉱夫': {
    name: '鉱夫', description: '鉱石・石材の採取効率が非常に高い。', cost: 150,
    statsMultiplier: { str: 1.3, int: 0.7, agi: 0.8, dex: 1.0, vit: 1.2 },
    adaptability: { ore: 2.0, material: 1.5 } // 石材も多め
  },
  '薬師': {
    name: '薬師', description: '薬草の採取効率が非常に高い。魔法石の採取も得意。', cost: 150,
    statsMultiplier: { str: 0.8, int: 1.2, agi: 1.0, dex: 1.3, vit: 0.8 },
    adaptability: { herb: 2.0, mana_stone: 1.2 }
  },
  '猟師': {
    name: '猟師', description: '食料や討伐素材（毛皮・骨）の獲得量が多い。', cost: 200,
    statsMultiplier: { str: 1.1, int: 0.9, agi: 1.2, dex: 1.2, vit: 0.9 },
    adaptability: { food: 1.5 } // 討伐ドロップ率も後で考慮
  },
  '戦士': {
    name: '戦士', description: '物理戦闘のスペシャリスト。高い攻撃力と耐久力。', cost: 300,
    statsMultiplier: { str: 1.4, int: 0.5, agi: 1.1, dex: 1.0, vit: 1.3 },
    adaptability: {}
  },
  '魔術師': {
    name: '魔術師', description: '魔法戦闘のスペシャリスト。魔法石の採取も得意。', cost: 350,
    statsMultiplier: { str: 0.5, int: 1.5, agi: 1.0, dex: 1.1, vit: 0.7 },
    adaptability: { mana_stone: 2.0 }
  },
  '僧侶': {
    name: '僧侶', description: '回復スキルの使い手。戦闘中の生存力を高める。薬草採取も得意。', cost: 350,
    statsMultiplier: { str: 0.8, int: 1.3, agi: 0.9, dex: 1.1, vit: 1.1 },
    adaptability: { herb: 1.3 }
  },
  '職人': {
    name: '職人', description: '施設でのクラフト大成功率が高い。鉱石などの加工が得意。', cost: 300,
    statsMultiplier: { str: 1.0, int: 1.0, agi: 0.9, dex: 1.4, vit: 1.0 },
    adaptability: { ore: 1.2 }
  }
};

const VILLAGER_NAMES = ['アルフ', 'ベアトリス', 'シリル', 'ダイアナ', 'エリック', 'フィオナ', 'ギルバート', 'ヘレン', 'イアン', 'ジュリア'];

// ==========================================
// 2. 初期化ヘルパー
// ==========================================

function getInitialVillagers(bodyLvl: number = 0): Villager[] {
  const statBonus = bodyLvl * 2;
  return [
    {
      id: 'v1', name: 'アルフ', level: 1, exp: 0, currentJob: '無職', jobHistory: ['無職'],
      maxHp: 100 + statBonus * 10, currentHp: 100 + statBonus * 10, stamina: 100,
      str: 10 + statBonus, int: 10 + statBonus, dex: 10 + statBonus, agi: 10 + statBonus, vit: 10 + statBonus,
      weaponId: 'none', armorId: 'none', order: 'rest', status: 'idle', destinationAreaId: null, travelTimeLeft: 0, assignedCraftJobId: null
    },
    {
      id: 'v2', name: 'ベアトリス', level: 1, exp: 0, currentJob: '無職', jobHistory: ['無職'],
      maxHp: 100 + statBonus * 10, currentHp: 100 + statBonus * 10, stamina: 100,
      str: 8 + statBonus, int: 12 + statBonus, dex: 11 + statBonus, agi: 9 + statBonus, vit: 10 + statBonus,
      weaponId: 'none', armorId: 'none', order: 'rest', status: 'idle', destinationAreaId: null, travelTimeLeft: 0, assignedCraftJobId: null
    },
    {
      id: 'v3', name: 'シリル', level: 1, exp: 0, currentJob: '無職', jobHistory: ['無職'],
      maxHp: 100 + statBonus * 10, currentHp: 100 + statBonus * 10, stamina: 100,
      str: 12 + statBonus, int: 8 + statBonus, dex: 9 + statBonus, agi: 11 + statBonus, vit: 10 + statBonus,
      weaponId: 'none', armorId: 'none', order: 'rest', status: 'idle', destinationAreaId: null, travelTimeLeft: 0, assignedCraftJobId: null
    }
  ];
}

const TIER_LIMIT_DAYS = [0, 30, 70, 120, 180, 250];

function getInitialFacilities(): Record<FacilityType, Facility> {
  return {
    inn: {
      id: 'inn', name: '宿屋', level: 1, maxLevel: 5, upgradeTimeLeft: 0, upgradeTotalTime: 0,
      upgradeCost: { gold: 200, materials: [{ itemId: 'wood', count: 10 }, { itemId: 'stone', count: 5 }] },
      craftQueue: []
    },
    workshop: {
      id: 'workshop', name: '加工工房', level: 1, maxLevel: 5, upgradeTimeLeft: 0, upgradeTotalTime: 0,
      upgradeCost: { gold: 300, materials: [{ itemId: 'wood', count: 15 }, { itemId: 'stone', count: 10 }] },
      craftQueue: []
    },
    blacksmith: {
      id: 'blacksmith', name: '鍛冶屋', level: 0, maxLevel: 5, upgradeTimeLeft: 0, upgradeTotalTime: 0,
      upgradeCost: { gold: 500, materials: [{ itemId: 'wood_plank', count: 5 }, { itemId: 'stone', count: 15 }] },
      craftQueue: []
    },
    alchemy: {
      id: 'alchemy', name: '錬金工房', level: 0, maxLevel: 5, upgradeTimeLeft: 0, upgradeTotalTime: 0,
      upgradeCost: { gold: 600, materials: [{ itemId: 'wood_plank', count: 8 }, { itemId: 'iron_ingot', count: 3 }] },
      craftQueue: []
    },
    market: {
      id: 'market', name: '交易所', level: 0, maxLevel: 5, upgradeTimeLeft: 0, upgradeTotalTime: 0,
      upgradeCost: { gold: 800, materials: [{ itemId: 'wood_plank', count: 12 }, { itemId: 'iron_ingot', count: 5 }] },
      craftQueue: []
    }
  };
}

// ==========================================
// 3. Zustand ストア実装
// ==========================================

interface GameActions {
  advanceHour: () => void;
  setVillagerOrder: (id: string, order: OrderType, areaId: string | null) => void;
  changeVillagerJob: (id: string, job: JobType) => void;
  equipItem: (villagerId: string, itemId: string, slot: 'weapon' | 'armor') => void;
  unequipItem: (villagerId: string, slot: 'weapon' | 'armor') => void;
  startCraft: (facilityId: FacilityType, itemId: string, villagerId?: string) => void;
  startFacilityUpgrade: (facilityId: FacilityType) => void;
  setTargetAmount: (itemId: string, count: number) => void;
  buySoulUpgrade: (upgradeId: string) => void;
  hireVillager: () => void;
  resetGame: (prestige?: boolean) => void;
  togglePause: () => void;
  setPlaySpeed: (speed: 'normal' | 'fast' | 'super') => void;
  addLog: (message: string, type: GameLog['type']) => void;
  sellItem: (itemId: string, count: number) => void;
  advanceDay: () => void;
}

const DEFAULT_INVENTORY: Record<string, number> = {
  food: 50,
  wood: 5,
  stone: 0,
  iron_ore: 0,
  herb: 2,
  mana_stone: 0,
  leather: 0,
  bone: 0,
  wood_plank: 0,
  iron_ingot: 0,
  potion: 0,
  iron_sword: 0,
  iron_armor: 0
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      // 初期状態
      currentDay: 1,
      currentHour: 0,
      gold: 500,
      food: 50,
      soulPoints: 0,
      villagers: getInitialVillagers(0),
      facilities: getInitialFacilities(),
      dungeons: DUNGEONS,
      inventory: { ...DEFAULT_INVENTORY },
      targetAmounts: Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
      logs: [{ id: 'init', timestamp: '1日目 00:00', message: 'ゲームが開始されました。村を発展させましょう！', type: 'system' }],
      currentTier: 1,
      bossDefeated: false,
      gameLimitDays: TIER_LIMIT_DAYS[1],
      gameOver: false,
      isPaused: true,
      playSpeed: 'normal',
      soulUpgrades: { heritage: 0, storage: 0, education: 0, body: 0, building: 0, discount: 0 },

      // ログ追加
      addLog: (message: string, type: GameLog['type']) => {
        const { currentDay, currentHour } = get();
        const timestamp = `${currentDay}日目 ${String(currentHour).padStart(2, '0')}:00`;
        const newLog: GameLog = {
          id: Math.random().toString(36).substring(2),
          timestamp,
          message,
          type
        };
        set((state) => ({
          logs: [newLog, ...state.logs].slice(0, 100) // 最大100件保持
        }));
      },

      // 一時停止切り替え
      togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

      // 1日スキップ
      advanceDay: () => {
        const state = get();
        if (state.gameOver || !state.isPaused) return;
        state.addLog('【システム】1日（24時間）スキップを開始します。', 'system');
        for (let i = 0; i < 24; i++) {
          if (get().gameOver) break;
          get().advanceHour();
        }
        state.addLog('【システム】1日スキップが完了しました。', 'system');
      },

      // 進行スピード設定
      setPlaySpeed: (speed) => set({ playSpeed: speed }),

      // 目標個数設定
      setTargetAmount: (itemId, count) => set((state) => ({
        targetAmounts: { ...state.targetAmounts, [itemId]: Math.max(0, count) }
      })),

      // アイテム売却 (交易所)
      sellItem: (itemId, count) => {
        const state = get();
        if (state.facilities.market.level === 0) {
          state.addLog('交易所が建設されていないため売却できません。', 'warning');
          return;
        }
        const currentCount = state.inventory[itemId] || 0;
        const toSell = Math.min(currentCount, count);
        if (toSell <= 0) return;

        const price = (ITEMS[itemId]?.sellPrice || 0) * toSell;
        set((state) => ({
          inventory: { ...state.inventory, [itemId]: currentCount - toSell },
          gold: state.gold + price
        }));
        state.addLog(`${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。`, 'info');
      },

      // 村人の指示変更
      setVillagerOrder: (id, order, areaId) => {
        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;
            
            // 指示が rest の場合、status を resting に。
            // それ以外で、派遣先がある場合は traveling_to、なければ idle に。
            let status = v.status;
            let travelTime = v.travelTimeLeft;
            let dest = v.destinationAreaId;

            if (order === 'rest') {
              status = 'resting';
              dest = null;
              travelTime = 0;
            } else if (areaId) {
              const area = DUNGEONS.find(d => d.id === areaId);
              dest = areaId;
              status = 'traveling_to';
              travelTime = area ? area.distance : 1;
            } else {
              dest = null;
              status = 'idle';
              travelTime = 0;
            }

            return {
              ...v,
              order,
              status,
              destinationAreaId: dest,
              travelTimeLeft: travelTime
            };
          });
          return { villagers: updated };
        });
        const vName = get().villagers.find(v => v.id === id)?.name;
        const areaName = DUNGEONS.find(d => d.id === areaId)?.name || '村';
        get().addLog(`${vName} の方針を【${order === 'rest' ? '休息' : order === 'gather' ? '採取' : '討伐'}】（場所: ${areaName}）に変更しました。`, 'info');
      },

      // 転職
      changeVillagerJob: (id, job) => {
        const state = get();
        const villager = state.villagers.find(v => v.id === id);
        if (!villager) return;

        const isFree = villager.jobHistory.includes(job);
        const discountLvl = state.soulUpgrades.discount || 0;
        const discountRate = 1 - discountLvl * 0.1;
        const cost = isFree ? 0 : Math.floor(JOBS[job].cost * discountRate);

        if (state.gold < cost) {
          state.addLog('転職に必要なゴールドが不足しています。', 'warning');
          return;
        }

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== id) return v;
            const history = v.jobHistory.includes(job) ? v.jobHistory : [...v.jobHistory, job];
            
            // ステータス補正の適用
            const baseStr = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseInt = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseDex = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseAgi = 10 + (state.soulUpgrades.body || 0) * 2;
            const baseVit = 10 + (state.soulUpgrades.body || 0) * 2;

            // 簡易的に職業別初期ステータス倍率をかける
            const mult = JOBS[job].statsMultiplier;
            const lvlBonus = v.level - 1;

            return {
              ...v,
              currentJob: job,
              jobHistory: history,
              str: Math.floor((baseStr + lvlBonus * 1.5) * mult.str),
              int: Math.floor((baseInt + lvlBonus * 1.5) * mult.int),
              dex: Math.floor((baseDex + lvlBonus * 1.5) * mult.dex),
              agi: Math.floor((baseAgi + lvlBonus * 1.5) * mult.agi),
              vit: Math.floor((baseVit + lvlBonus * 1.5) * mult.vit),
              maxHp: Math.floor((100 + lvlBonus * 10) * mult.vit)
            };
          });

          return {
            villagers: updated,
            gold: state.gold - cost
          };
        });

        state.addLog(`${villager.name} が ${job} に転職しました。`, 'info');
      },

      // 装備変更
      equipItem: (villagerId, itemId, slot) => {
        const state = get();
        const currentCount = state.inventory[itemId] || 0;
        if (currentCount <= 0) return;

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== villagerId) return v;
            
            // 既存装備を倉庫に戻す
            const oldEquipId = slot === 'weapon' ? v.weaponId : v.armorId;
            const inv = { ...state.inventory };
            if (oldEquipId && oldEquipId !== 'none') {
              inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
            }
            
            // 新しい装備をインベントリから減らす
            inv[itemId] = Math.max(0, currentCount - 1);

            return {
              ...v,
              [slot === 'weapon' ? 'weaponId' : 'armorId']: itemId
            };
          });

          return { villagers: updated, inventory: state.inventory };
        });

        const vName = get().villagers.find(v => v.id === villagerId)?.name;
        state.addLog(`${vName} に ${ITEMS[itemId].name} を装備しました。`, 'info');
      },

      // 装備解除
      unequipItem: (villagerId, slot) => {
        const state = get();
        const villager = state.villagers.find(v => v.id === villagerId);
        if (!villager) return;

        const itemId = slot === 'weapon' ? villager.weaponId : villager.armorId;
        if (!itemId || itemId === 'none') return;

        set((state) => {
          const updated = state.villagers.map((v) => {
            if (v.id !== villagerId) return v;
            return {
              ...v,
              [slot === 'weapon' ? 'weaponId' : 'armorId']: 'none'
            };
          });
          const inv = { ...state.inventory };
          inv[itemId] = (inv[itemId] || 0) + 1;

          return { villagers: updated, inventory: inv };
        });

        state.addLog(`${villager.name} の装備を外しました。`, 'info');
      },

      // クラフト開始
      startCraft: (facilityId, itemId, villagerId) => {
        const state = get();
        const facility = state.facilities[facilityId];
        const item = ITEMS[itemId];
        if (!facility || !item || !item.recipe) return;

        // レシピ素材チェック
        const missing = item.recipe.requiredItems.filter(
          (req) => (state.inventory[req.itemId] || 0) < req.count
        );
        if (missing.length > 0) {
          state.addLog('クラフトの必要素材が不足しています。', 'warning');
          return;
        }

        // 村人のアサインチェック
        let assignedId: string | null = null;
        if (villagerId) {
          const v = state.villagers.find(v => v.id === villagerId);
          if (v && v.status === 'idle') {
            assignedId = villagerId;
          }
        } else {
          // 自動クラフト用：暇な職人(crafter)がいれば優先アサイン
          const idleCrafter = state.villagers.find(v => v.status === 'idle' && v.currentJob === '職人');
          const idleAny = state.villagers.find(v => v.status === 'idle');
          assignedId = (idleCrafter || idleAny)?.id || null;
        }

        const jobId = Math.random().toString(36).substring(2);
        const baseTime = item.recipe.requiredTime;
        // 職人がアサインされていたらクラフト時間短縮（例: 20%短縮）
        const isCrafter = assignedId ? state.villagers.find(v => v.id === assignedId)?.currentJob === '職人' : false;
        const timeNeeded = isCrafter ? Math.max(1, Math.floor(baseTime * 0.8)) : baseTime;

        set((state) => {
          // 素材の消費
          const inv = { ...state.inventory };
          item.recipe!.requiredItems.forEach((req) => {
            inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - req.count);
          });

          // キューに追加
          const updatedFacilities = { ...state.facilities };
          updatedFacilities[facilityId].craftQueue.push({
            id: jobId,
            itemId,
            timeLeft: timeNeeded,
            totalTime: timeNeeded,
            assignedVillagerId: assignedId
          });

          // 村人のステータスを更新 (クラフト従事)
          const updatedVillagers = state.villagers.map((v) => {
            if (v.id === assignedId) {
              return { ...v, status: 'active', assignedCraftJobId: jobId } as Villager;
            }
            return v;
          });

          return {
            inventory: inv,
            facilities: updatedFacilities,
            villagers: updatedVillagers
          };
        });

        const vName = assignedId ? state.villagers.find(v => v.id === assignedId)?.name : 'なし';
        state.addLog(`${facility.name} で ${item.name} のクラフトを開始しました（担当: ${vName}）。`, 'craft');
      },

      // 施設アップグレード開始
      startFacilityUpgrade: (facilityId) => {
        const state = get();
        const facility = state.facilities[facilityId];
        if (!facility || facility.level >= facility.maxLevel) return;

        // コスト計算（周回バフ適用）
        const buildLvl = state.soulUpgrades.building || 0;
        const costReduction = 1 - buildLvl * 0.05;

        const goldCost = Math.floor(facility.upgradeCost.gold * costReduction);
        if (state.gold < goldCost) {
          state.addLog('ゴールドが不足しています。', 'warning');
          return;
        }

        const missing = facility.upgradeCost.materials.filter((req) => {
          const reqCount = Math.floor(req.count * costReduction);
          return (state.inventory[req.itemId] || 0) < reqCount;
        });

        if (missing.length > 0) {
          state.addLog('アップグレードの必要素材が不足しています。', 'warning');
          return;
        }

        set((state) => {
          const inv = { ...state.inventory };
          facility.upgradeCost.materials.forEach((req) => {
            const reqCount = Math.floor(req.count * costReduction);
            inv[req.itemId] = Math.max(0, (inv[req.itemId] || 0) - reqCount);
          });

          const updatedFacilities = { ...state.facilities };
          const time = 5 + facility.level * 5; // レベルに応じた所要時間 (5h, 10h, 15h...)
          updatedFacilities[facilityId] = {
            ...facility,
            upgradeTimeLeft: time,
            upgradeTotalTime: time
          };

          return {
            gold: state.gold - goldCost,
            inventory: inv,
            facilities: updatedFacilities
          };
        });

        state.addLog(`${facility.name} のアップグレードを開始しました。レベル ${facility.level + 1} まであと ${5 + facility.level * 5} 時間。`, 'upgrade');
      },

      // 新しい村人の雇用 (100G)
      hireVillager: () => {
        const state = get();
        if (state.gold < 100) {
          state.addLog('雇用に必要なゴールド (100G) が不足しています。', 'warning');
          return;
        }
        if (state.villagers.length >= 10) {
          state.addLog('これ以上村人を雇用できません（上限10人）。', 'warning');
          return;
        }

        const name = VILLAGER_NAMES[state.villagers.length % VILLAGER_NAMES.length] + ' (新人)';
        const statBonus = (state.soulUpgrades.body || 0) * 2;
        const newVillager: Villager = {
          id: 'v_' + Math.random().toString(36).substring(2),
          name,
          level: 1,
          exp: 0,
          currentJob: '無職',
          jobHistory: ['無職'],
          maxHp: 100 + statBonus * 10,
          currentHp: 100 + statBonus * 10,
          stamina: 100,
          str: 10 + statBonus,
          int: 10 + statBonus,
          dex: 10 + statBonus,
          agi: 10 + statBonus,
          vit: 10 + statBonus,
          weaponId: 'none',
          armorId: 'none',
          order: 'rest',
          status: 'idle',
          destinationAreaId: null,
          travelTimeLeft: 0,
          assignedCraftJobId: null
        };

        set((state) => ({
          gold: state.gold - 100,
          villagers: [...state.villagers, newVillager]
        }));

        state.addLog(`新しい村人 ${name} を雇用しました。`, 'info');
      },

      // 周回アップグレード購入
      buySoulUpgrade: (upgradeId) => {
        const state = get();
        const currentLvl = state.soulUpgrades[upgradeId] || 0;
        const uDef = SOUL_UPGRADES.find(u => u.id === upgradeId);
        if (!uDef || currentLvl >= uDef.maxLevel) return;

        const cost = uDef.costPerLevel * (currentLvl + 1);
        if (state.soulPoints < cost) {
          state.addLog('ソウルポイントが不足しています。', 'warning');
          return;
        }

        set((state) => ({
          soulPoints: state.soulPoints - cost,
          soulUpgrades: {
            ...state.soulUpgrades,
            [upgradeId]: currentLvl + 1
          }
        }));

        state.addLog(`転生バフ【${uDef.name}】のレベルを ${currentLvl + 1} に強化しました。`, 'system');
      },

      // リセット & 転生
      resetGame: (prestige = false) => {
        const state = get();
        let earnedSp = 0;

        if (prestige) {
          // 周回SPの計算
          const invValue = Object.entries(state.inventory).reduce((sum, [itemId, count]) => {
            return sum + (ITEMS[itemId]?.sellPrice || 0) * count;
          }, 0);
          const bossCount = state.currentTier - (state.bossDefeated ? 0 : 1);
          earnedSp = Math.floor(state.gold / 1000) + Math.floor(invValue / 100) + (bossCount * 50) + (state.currentDay * 2);
        }

        const heritageLvl = state.soulUpgrades.heritage || 0;
        const storageLvl = state.soulUpgrades.storage || 0;

        const startGold = 500 + heritageLvl * 500;
        const startFood = 50 + storageLvl * 100;

        const bodyLvl = state.soulUpgrades.body || 0;

        set({
          currentDay: 1,
          currentHour: 0,
          gold: startGold,
          food: startFood,
          soulPoints: state.soulPoints + earnedSp,
          villagers: getInitialVillagers(bodyLvl),
          facilities: getInitialFacilities(),
          inventory: { ...DEFAULT_INVENTORY, food: startFood },
          targetAmounts: Object.keys(ITEMS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
          logs: [{
            id: 'prestige_init',
            timestamp: '1日目 00:00',
            message: prestige
              ? `ソウルポイントを ${earnedSp} SP 獲得し、新たな周回を開始しました。`
              : 'ゲームを初期状態からリスタートしました。',
            type: 'system'
          }],
          currentTier: 1,
          bossDefeated: false,
          gameLimitDays: TIER_LIMIT_DAYS[1],
          gameOver: false,
          isPaused: true
        });
      },

      // ==========================================
      // 4. コアロジック: 1時間の時間経過 (advanceHour)
      // ==========================================
      advanceHour: () => {
        const state = get();
        if (state.gameOver) return;

        let {
          currentDay, currentHour, gold, food, villagers, facilities, inventory, targetAmounts, currentTier, bossDefeated, gameLimitDays
        } = state;

        currentHour += 1;
        if (currentHour >= 24) {
          currentHour = 0;
          currentDay += 1;
        }

        // ボス期限切れ判定
        if (currentDay > gameLimitDays && !bossDefeated) {
          state.addLog(`制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。ゲームオーバー！`, 'error');
          set({ gameOver: true, isPaused: true });
          return;
        }

        // ① 食料消費と飢餓判定
        const villagerCount = villagers.length;
        const foodConsumed = villagerCount * (1.0 / 24.0);
        let hasStarvation = false;

        if (food < foodConsumed) {
          food = 0;
          hasStarvation = true;
        } else {
          food -= foodConsumed;
        }

        // ② 施設クラフト・アップグレード進捗処理
        const updatedFacilities = { ...facilities };
        const updatedVillagers = [...villagers];
        const updatedInventory = { ...inventory };
        updatedInventory.food = Math.floor(food); // 画面表示等と連動させるために丸め（実際は消費をfloat管理しても良いが、簡素化のため丸め保存）

        Object.keys(updatedFacilities).forEach((facKey) => {
          const fac = updatedFacilities[facKey as FacilityType];
          
          // アップグレード進捗
          if (fac.upgradeTimeLeft > 0) {
            fac.upgradeTimeLeft -= 1;
            if (fac.upgradeTimeLeft === 0) {
              fac.level += 1;
              state.addLog(`${fac.name} のアップグレードが完了し、Lv.${fac.level} になりました！`, 'upgrade');
              
              // 次のレベルのアップグレードコスト再計算
              fac.upgradeCost.gold = fac.level * 300;
              fac.upgradeCost.materials = fac.upgradeCost.materials.map(m => ({ ...m, count: m.count + 5 }));
            }
          }

          // クラフト進捗
          fac.craftQueue = fac.craftQueue.filter((job) => {
            job.timeLeft -= 1;
            if (job.timeLeft <= 0) {
              // 完成
              const successBonus = 0.05 + (JOBS['職人'].statsMultiplier.dex * 0.05); // 職人なら大成功率高い
              const isGreatSuccess = Math.random() < successBonus;
              const craftCount = isGreatSuccess ? 2 : 1;

              updatedInventory[job.itemId] = (updatedInventory[job.itemId] || 0) + craftCount;

              state.addLog(
                `${fac.name} で ${ITEMS[job.itemId].name} の加工が完了しました！${isGreatSuccess ? '【大成功！2倍獲得】' : ''}`,
                'craft'
              );

              // 担当村人の解放
              if (job.assignedVillagerId) {
                const idx = updatedVillagers.findIndex(v => v.id === job.assignedVillagerId);
                if (idx !== -1) {
                  updatedVillagers[idx].status = 'idle';
                  updatedVillagers[idx].assignedCraftJobId = null;
                }
              }
              return false; // キューから削除
            }
            return true;
          });
        });

        // ③ 村人の行動・移動・戦闘・採取処理
        for (let i = 0; i < updatedVillagers.length; i++) {
          const v = updatedVillagers[i];
          
          // 宿屋での休息処理
          if (v.status === 'resting') {
            const innLvl = facilities.inn.level;
            const hpRecovery = 10 + innLvl * 5;
            const staminaRecovery = 15 + innLvl * 5;

            v.currentHp = Math.min(v.maxHp, v.currentHp + hpRecovery);
            v.stamina = Math.min(100, v.stamina + staminaRecovery);

            if (v.currentHp === v.maxHp && v.stamina === 100) {
              v.status = 'idle';
              v.order = 'gather';
              state.addLog(`${v.name} は体力が全回復し、行動可能になりました。`, 'info');
            }
            continue;
          }

          // 飢餓による弱体化
          if (hasStarvation) {
            v.currentHp = Math.max(1, v.currentHp - Math.floor(v.maxHp * 0.004)); // 最大HPの0.4%減少
          }

          // 移動中
          if (v.status === 'traveling_to') {
            v.travelTimeLeft -= 1;
            if (v.travelTimeLeft <= 0) {
              v.status = 'active';
              const areaName = DUNGEONS.find(d => d.id === v.destinationAreaId)?.name;
              state.addLog(`${v.name} が ${areaName} に到着し、活動を開始しました。`, 'info');
            }
            continue;
          }

          if (v.status === 'traveling_back') {
            v.travelTimeLeft -= 1;
            if (v.travelTimeLeft <= 0) {
              v.destinationAreaId = null;
              if (v.order === 'rest') {
                v.status = 'resting';
                state.addLog(`${v.name} が村に帰還し、宿屋で休息を開始しました。`, 'info');
              } else {
                v.status = 'idle';
                state.addLog(`${v.name} が村に帰還しました。`, 'info');
              }
            }
            continue;
          }

          // ダンジョンでの活動中
          if (v.status === 'active' && v.destinationAreaId) {
            const area = DUNGEONS.find(d => d.id === v.destinationAreaId)!;
            v.stamina = Math.max(0, v.stamina - 5);

            // 飢餓やスタミナ切れによる効率変化
            const efficiency = (hasStarvation ? 0.5 : 1.0) * (v.stamina === 0 ? 0.3 : 1.0);

            // HP30%未満、またはスタミナ0になったら強制撤退
            if (v.currentHp < v.maxHp * 0.3 || v.stamina <= 0) {
              v.status = 'traveling_back';
              v.travelTimeLeft = area.distance;
              v.order = 'rest'; // 帰還後に休息状態へ移行させる
              state.addLog(`${v.name} は消耗が激しいため、村への帰還を開始しました（残り時間: ${area.distance}h）。`, 'warning');
              continue;
            }

            if (v.order === 'gather') {
              // 採取AIアルゴリズム
              // 1. スコア計算
              let bestItemId = '';
              let maxScore = -1;

              area.gathers.forEach((gather) => {
                const item = ITEMS[gather.itemId];
                const baseMultiplier = 1.0 / gather.difficulty;
                
                // 職業別補正
                let jobMod = 1.0;
                const jobAdapt = JOBS[v.currentJob]?.adaptability[item.category];
                if (jobAdapt) jobMod = jobAdapt;

                // ステータス値
                let statVal = 0;
                if (item.category === 'food' || item.category === 'ore' || item.category === 'material') {
                  statVal = v.str * 0.7 + v.dex * 0.3;
                } else {
                  statVal = v.int * 0.7 + v.dex * 0.3;
                }

                const score = baseMultiplier * jobMod * statVal * (1.0 + v.agi * 0.01) * efficiency;
                if (score > maxScore) {
                  maxScore = score;
                  bestItemId = gather.itemId;
                }
              });

              if (bestItemId) {
                // 採取判定 (簡易: 成功率 DEX基準)
                const successRate = Math.min(0.95, 0.5 + (v.dex * 0.01));
                if (Math.random() < successRate) {
                  updatedInventory[bestItemId] = (updatedInventory[bestItemId] || 0) + 1;
                  state.addLog(`${v.name} が ${area.name} で ${ITEMS[bestItemId].name} を採取しました。`, 'gather');
                } else {
                  state.addLog(`${v.name} は ${area.name} で採取に失敗しました。`, 'gather');
                }
              }
            } else if (v.order === 'hunt') {
              // 討伐AIアルゴリズム
              // レベルに近い敵を探す (ボスは最優先かつ出現Tierが達していれば)
              // 簡易的に、ランダムで雑魚敵か、ボスに挑む
              // ボスが未撃破かつ、推奨レベル以上であれば 20%の確率でボス戦、それ以外は雑魚
              const normalMonsters = area.monsters.filter(m => !m.isBoss);
              const bossMonster = area.monsters.find(m => m.isBoss);

              let enemy: Monster | null = null;
              if (bossMonster && !bossDefeated && v.level >= area.recommendedLevel && Math.random() < 0.25) {
                enemy = { ...bossMonster };
              } else if (normalMonsters.length > 0) {
                // レベル相性の良いモンスターを選択
                enemy = { ...normalMonsters[Math.floor(Math.random() * normalMonsters.length)] };
              }

              if (enemy) {
                state.addLog(`${v.name} が ${enemy.name} (Lv.${enemy.level}) と遭遇し、戦闘を開始！`, 'combat');
                
                // 簡易戦闘シミュレーション
                // 装備によるステータス補正
                let weaponAtk = 0;
                let armorDef = 0;
                if (v.weaponId === 'iron_sword') weaponAtk = 15;
                if (v.armorId === 'iron_armor') armorDef = 15;

                const vAtk = Math.floor((v.str * 1.5 + weaponAtk) * (v.currentJob === '戦士' ? 1.3 : 1.0) * efficiency);
                const vDef = Math.floor((v.vit + armorDef) * efficiency);

                // モンスターHP
                let enemyHp = enemy.hp;

                // 交互攻撃
                // 1ターン目 (村人)
                const damageToEnemy = Math.max(2, vAtk - enemy.def);
                enemyHp -= damageToEnemy;
                
                if (enemyHp <= 0) {
                  // 勝利
                  const eduBonus = 1.0 + (state.soulUpgrades.education || 0) * 0.1;
                  const expGained = Math.floor(enemy.expReward * eduBonus);
                  v.exp += expGained;

                  state.addLog(`${v.name} は ${enemy.name} に勝利！ 経験値 ${expGained} を獲得。`, 'combat');

                  // レベルアップ
                  const expNeeded = v.level * 100;
                  if (v.exp >= expNeeded) {
                    v.level += 1;
                    v.exp -= expNeeded;
                    v.str += 2;
                    v.int += 2;
                    v.dex += 2;
                    v.agi += 2;
                    v.vit += 2;
                    v.maxHp += 15;
                    v.currentHp = v.maxHp;
                    state.addLog(`${v.name} が レベル ${v.level} に上がりました！`, 'info');
                  }

                  // ドロップアイテム
                  enemy.drops.forEach((drop) => {
                    // 猟師はドロップ率アップ
                    const hunterBonus = v.currentJob === '猟師' ? 1.5 : 1.0;
                    if (Math.random() < drop.chance * hunterBonus) {
                      updatedInventory[drop.itemId] = (updatedInventory[drop.itemId] || 0) + 1;
                      state.addLog(`敵から ${ITEMS[drop.itemId].name} を獲得しました。`, 'combat');
                    }
                  });

                  // ボス撃破時の処理
                  if (enemy.isBoss) {
                    bossDefeated = true;
                    state.addLog(`エリアボス【${enemy.name}】を撃破しました！`, 'system');
                    
                    // 次のTierの解放
                    if (currentTier < 5) {
                      currentTier += 1;
                      gameLimitDays = TIER_LIMIT_DAYS[currentTier];
                      bossDefeated = false;
                      state.addLog(`新しいエリアと施設が解放されました！ 次のボス討伐期限は ${gameLimitDays} 日目まで。`, 'system');
                    } else {
                      state.addLog(`おめでとうございます！【終焉の竜】を撃破し、世界に平和が戻りました！(無限サバイバルに移行します)`, 'system');
                    }
                  }
                } else {
                  // 2ターン目 (敵)
                  const damageToVillager = Math.max(2, enemy.atk - vDef);
                  v.currentHp = Math.max(0, v.currentHp - damageToVillager);
                  
                  state.addLog(`${enemy.name} の反撃！ ${v.name} は ${damageToVillager} ダメージを受けた。`, 'combat');

                  if (v.currentHp <= 0) {
                    state.addLog(`${v.name} が戦闘不能（死亡）になりました…`, 'error');
                    // 死亡したため、リストから除外
                    updatedVillagers.splice(i, 1);
                    i--; // インデックス調整

                    // ゲームオーバー条件チェック: 全滅かつ雇用費用なし
                    if (updatedVillagers.length === 0 && gold < 100) {
                      state.addLog('すべての村人が死亡し、雇用するゴールドもありません。ゲームオーバー！', 'error');
                      set({ gameOver: true, isPaused: true });
                      return;
                    }
                  }
                }
              }
            }
          }
        }

        // ④ 自動化（自動アサイン＆自動クラフト）
        // 目標値に達していないアイテムがあり、余っている素材があり、施設にキューの空きがある場合自動クラフト
        Object.keys(updatedFacilities).forEach((facKey) => {
          const fac = updatedFacilities[facKey as FacilityType];
          if (fac.level > 0 && fac.craftQueue.length < 3) {
            // クラフト可能なレシピを探す
            Object.keys(ITEMS).forEach((itemId) => {
              const item = ITEMS[itemId];
              if (item.recipe) {
                // 目標に達しておらず、かつ現在キューに入っている個数 + 在庫数が目標未満か
                const currentCount = updatedInventory[itemId] || 0;
                const inQueueCount = fac.craftQueue.filter(j => j.itemId === itemId).length;
                const target = targetAmounts[itemId] || 0;

                if (currentCount + inQueueCount < target) {
                  // レシピが必要な施設か
                  const isMatchFacility =
                    (itemId === 'wood_plank' || itemId === 'iron_ingot') && fac.id === 'workshop' ||
                    (itemId === 'iron_sword' || itemId === 'iron_armor') && fac.id === 'blacksmith' ||
                    (itemId === 'potion') && fac.id === 'alchemy';

                  if (isMatchFacility) {
                    // 素材が足りているか
                    const hasMaterials = item.recipe.requiredItems.every(
                      req => (updatedInventory[req.itemId] || 0) >= req.count
                    );
                    if (hasMaterials) {
                      // 素材消費
                      item.recipe.requiredItems.forEach((req) => {
                        updatedInventory[req.itemId] = Math.max(0, (updatedInventory[req.itemId] || 0) - req.count);
                      });

                      // 暇な村人アサイン
                      const idleCrafter = updatedVillagers.find(v => v.status === 'idle' && v.currentJob === '職人');
                      const idleAny = updatedVillagers.find(v => v.status === 'idle');
                      const assignedId = (idleCrafter || idleAny)?.id || null;

                      const jobId = Math.random().toString(36).substring(2);
                      const baseTime = item.recipe.requiredTime;
                      const isCrafter = assignedId ? updatedVillagers.find(v => v.id === assignedId)?.currentJob === '職人' : false;
                      const timeNeeded = isCrafter ? Math.max(1, Math.floor(baseTime * 0.8)) : baseTime;

                      fac.craftQueue.push({
                        id: jobId,
                        itemId,
                        timeLeft: timeNeeded,
                        totalTime: timeNeeded,
                        assignedVillagerId: assignedId
                      });

                      if (assignedId) {
                        const idx = updatedVillagers.findIndex(v => v.id === assignedId);
                        updatedVillagers[idx].status = 'active';
                        updatedVillagers[idx].assignedCraftJobId = jobId;
                      }

                      state.addLog(`【自動クラフト】${fac.name} で ${item.name} の生産を開始しました。`, 'craft');
                    }
                  }
                }
              }
            });
          }
        });

        // 待機村人の自動派遣
        // 在庫 + 派遣中人数が目標を下回る採取アイテムがあるエリアを探し、暇な村人を派遣
        updatedVillagers.forEach((v) => {
          if (v.status === 'idle' && v.order !== 'rest') {
            // 不足している採取アイテムを探す
            let targetAreaId: string | null = null;
            let targetOrder: OrderType = 'gather';

            // 優先度の高い目標アイテムを検索
            const missingItemIds = Object.keys(targetAmounts).filter((itemId) => {
              const count = updatedInventory[itemId] || 0;
              const target = targetAmounts[itemId] || 0;
              return count < target;
            });

            if (missingItemIds.length > 0) {
              // 職業ごとの得意カテゴリの定義
              let preferredCategories: string[] = [];
              const job = v.currentJob;
              if (job === '農民') preferredCategories = ['food'];
              else if (job === '猟師') preferredCategories = ['food', 'material'];
              else if (job === '鉱夫') preferredCategories = ['ore', 'material'];
              else if (job === '薬師') preferredCategories = ['herb', 'mana_stone'];
              else if (job === '魔術師') preferredCategories = ['mana_stone'];
              else if (job === '僧侶') preferredCategories = ['herb'];
              else if (job === '職人') preferredCategories = ['ore', 'material'];
              else if (job === '戦士') preferredCategories = ['material'];

              // 得意カテゴリのアイテムを優先するようにソート
              const sortedMissingItemIds = [...missingItemIds].sort((a, b) => {
                const aCategory = ITEMS[a]?.category || '';
                const bCategory = ITEMS[b]?.category || '';
                const aPref = preferredCategories.includes(aCategory) ? 1 : 0;
                const bPref = preferredCategories.includes(bCategory) ? 1 : 0;
                return bPref - aPref;
              });

              // 村人の適性に合ったアイテムを探す
              for (const missingId of sortedMissingItemIds) {
                // 採取できるエリアを検索
                const area = DUNGEONS.find(d => d.unlockedAtTier <= currentTier && d.gathers.some(g => g.itemId === missingId));
                if (area) {
                  targetAreaId = area.id;
                  targetOrder = 'gather';
                  break;
                }

                // 討伐でドロップするエリアを検索
                const dropArea = DUNGEONS.find(d =>
                  d.unlockedAtTier <= currentTier &&
                  d.monsters.some(m => m.drops.some(dr => dr.itemId === missingId))
                );
                if (dropArea) {
                  targetAreaId = dropArea.id;
                  targetOrder = 'hunt';
                  break;
                }
              }
            }

            // 見つかったら派遣
            if (targetAreaId) {
              v.status = 'traveling_to';
              v.destinationAreaId = targetAreaId;
              v.order = targetOrder;
              const area = DUNGEONS.find(d => d.id === targetAreaId)!;
              v.travelTimeLeft = area.distance;
              state.addLog(`【自動派遣】${v.name} を ${area.name} へ派遣しました（目的: ${targetOrder === 'gather' ? '採取' : '討伐'}）。`, 'info');
            }
          }
        });

        // 状態更新
        set({
          currentDay,
          currentHour,
          food,
          villagers: updatedVillagers,
          facilities: updatedFacilities,
          inventory: updatedInventory,
          currentTier,
          bossDefeated,
          gameLimitDays
        });
      }
    }),
    {
      name: 'fast-slow-life-save-state',
      partialize: (state) => ({
        currentDay: state.currentDay,
        currentHour: state.currentHour,
        gold: state.gold,
        food: state.food,
        soulPoints: state.soulPoints,
        villagers: state.villagers,
        facilities: state.facilities,
        inventory: state.inventory,
        targetAmounts: state.targetAmounts,
        logs: state.logs,
        currentTier: state.currentTier,
        bossDefeated: state.bossDefeated,
        gameLimitDays: state.gameLimitDays,
        gameOver: state.gameOver,
        soulUpgrades: state.soulUpgrades
      })
    }
  )
);
