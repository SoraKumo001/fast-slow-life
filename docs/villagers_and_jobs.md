# キャラクター＆職業設計書：村人とAI

村人（キャラクター）のステータス、職業（ジョブ）のデータ定義、およびプレイヤーからの大まかな指示（採取・討伐）に対する自動意思決定ロジックの設計です。

---

## 1. 村人のステータス設計

各村人は、以下のプロパティを持ちます（TypeScriptの `Villager` 型として定義）。

```typescript
export interface Villager {
  id: string;
  name: string;

  // 基本能力値
  level: number;
  exp: number;
  str: number; // 物理攻撃、鉱石採取に影響
  int: number; // 魔法攻撃、薬草・魔石採取に影響
  dex: number; // 命中率、クラフト大成功確率、採取効率に影響
  agi: number; // 回避率、行動順、探索効率に影響
  vit: number; // 防御力、最大HPに影響

  maxHp: number;
  currentHp: number;
  maxStamina: number;
  stamina: number;

  // 職業関連
  currentJob: JobType;
  jobHistory: JobType[];

  // 装備
  weaponId: string;
  armorId: string;

  // 状態
  status: "idle" | "resting" | "traveling_to" | "traveling_back" | "active";
  order: "gather" | "hunt" | "rest";
  destinationAreaId: string | null;
  travelTimeLeft: number;
  assignedCraftJobId: string | null;
  targetGatherItemId: string | null;
  targetMonsterId: string | null;
  autoTargetName: string | null;

  // 所持品・経済
  gold: number; // 個人所持金
  potionItemId: string; // 所持回復薬の種類
  potionCount: number; // 所持回復薬の数
  staminaDrinkItemId: string; // 所持スタミナポーションの種類
  staminaDrinkCount: number; // 所持スタミナポーションの数
  pool: Record<string, number>; // 仮置き場（買取不可時の一時保管）

  // 食料関連
  activeFoodBuffId: string | null; // 現在適用中の料理Buff
  isStarving?: boolean; // 飢餓状態か

  // 永続ボーナス（転職引継ぎ用）
  bonusStr: number;
  bonusInt: number;
  bonusDex: number;
  bonusAgi: number;
  bonusVit: number;
  bonusMaxHp: number;
  bonusMaxStamina: number;
}
```

---

## 2. 職業（ジョブ）システム

※各職業の具体的なステータス補正や転職条件、AI動作への影響の詳細は [職業特性・仕様まとめ](jobs.md) を参照。

### 職業一覧とパラメータ

| 職業名     | 特性・適性                     | STR | INT | AGI | DEX | VIT | 転職コスト | 必要Lv | 前提職業 |
| :--------- | :----------------------------- | :-: | :-: | :-: | :-: | :-: | :--------: | :----: | :------: |
| **無職**   | 初期状態。特徴なし。           | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |    0 G     |   1    |   なし   |
| **農民**   | 食料の採取効率+100%            | 1.1 | 0.9 | 1.1 | 1.0 | 1.0 |   100 G    |   1    |   なし   |
| **木こり** | 素材の採取効率+100%            | 1.2 | 0.8 | 1.1 | 1.0 | 1.0 |   100 G    |   1    |   なし   |
| **鉱夫**   | 鉱石+100%、石材+50%            | 1.3 | 0.7 | 0.8 | 1.0 | 1.2 |   150 G    |   1    |   なし   |
| **薬師**   | 薬草+100%、魔法石+20%          | 0.8 | 1.2 | 1.0 | 1.3 | 0.8 |   150 G    |   1    |   なし   |
| **猟師**   | 食料+50%、ドロップ率1.5倍      | 1.1 | 0.9 | 1.2 | 1.2 | 0.9 |   200 G    |   1    |   なし   |
| **戦士**   | 物理戦闘特化。物理ダメージ+30% | 1.4 | 0.5 | 1.1 | 1.0 | 1.3 |   300 G    |   5    |   猟師   |
| **魔術師** | 魔法戦闘特化。魔法石+100%      | 0.5 | 1.5 | 1.0 | 1.1 | 0.7 |   350 G    |   5    |   薬師   |
| **僧侶**   | 回復スキル。薬草+30%           | 0.8 | 1.3 | 0.9 | 1.1 | 1.1 |   350 G    |   5    |   薬師   |
| **職人**   | クラフト大成功率+12%、時間-20% | 1.0 | 1.0 | 0.9 | 1.4 | 1.0 |   300 G    |   5    |   鉱夫   |

- **復職ルール**: すでに一度転職したことのある職業（`jobHistory` に含まれる）へ戻る際は、転職コストは 0 G。
- **値引き**: ソウルアップグレード「値切り上手」1Lvにつき転職コストが10%割引（最大50%割引）。

### 転職時のレベルボーナスとレベルリセット

1. **永続ボーナスの累積**: 転職時に、前職のレベルに応じたボーナスが `bonusStr` 等に加算。
   - STR/INT/DEX/AGI/VIT: `floor((前職Lv - 1) × 1.5 × 前職のマルチプライヤー)`
   - HP: `floor((前職Lv - 1) × 10 × 前職のVITマルチプライヤー)`
   - Stamina: `(前職Lv - 1) × 10`
2. **レベルのリセット**: 転職後、レベルは1にリセット。
3. **転職後のステータス**: `floor(基礎値(10 + ソウルUG分) × 新職マルチプライヤー) + 累積永続ボーナス`

---

## 3. 指示と自動行動（AI）アルゴリズム

### 基本ルール

- **自動選択と個別指示**: デフォルトでは自動で最適な行動を選択。プレイヤーは特定の素材や魔物を直接指定可能。
- **即時指示変更**: 行動中でも指示変更可能。次のアクションから反映。
- **ボス討伐の例外**: 初討伐のボスは自動行動のターゲットに選ばれない。

### ① 自動派遣ロジック（dispatchIdleVillagersHelper）

待機中の村人がいるとき、不足アイテムに基づいて自動派遣されます。

1. **不足アイテムの特定**: `targetAmounts` で在庫 < 目標 のアイテムを抽出
2. **職業の優先カテゴリでソート**:
   - 農民: `food`
   - 木こり: `material`
   - 猟師: `food`, `material`
   - 鉱夫: `ore`, `material`
   - 薬師: `herb`, `mana_stone`
   - 魔術師: `mana_stone`
   - 僧侶: `herb`
   - 職人: `ore`, `material`
   - 戦士: `material`
3. **達成率（在庫/目標）でソート**: 最も達成率が低いアイテムを優先
4. **エリア選定**: 不足アイテムが採取可能なダンジョンがあれば「採取」で派遣。なければドロップで入手可能なダンジョンがあれば「討伐」で派遣。
5. **目標アイテムが不足していない場合**: 最も進んだダンジョンに自由派遣（戦闘職は討伐、それ以外は採取）。
6. **ポーション・スタミナドリンクの自動購入**: 派遣時に所持金で購入。回復薬は効果量の高い順に最大2個、スタミナポーションは最大2個。

### ② 「採取 (Gather)」指示時の自動決定アルゴリズム

村人は、派遣されたエリアで採集可能なアイテムごとに「適性スコア」を計算し、最もスコアが高いアイテムを対象として採取します。

#### スコア計算式

$$\text{Score} = \frac{1}{\text{難易度}} \times (\text{職業適性})^2 \times \text{関連ステータス値} \times (1.0 + \text{AGI} \times 0.01) \times \text{効率} \times \text{目標ペナルティ} \times \text{重複ペナルティ}$$

- **職業適性**: 農民(food)=2.0、鉱夫(ore)=2.0/material=1.5、薬師(herb)=2.0/mana_stone=1.2、木こり(material)=2.0、猟師(food)=1.5、魔術師(mana_stone)=2.0、僧侶(herb)=1.3、職人(ore)=1.2、その他=1.0
- **関連ステータス値**:
  - food/ore/material: `STR × 0.7 + DEX × 0.3`
  - herb/mana_stone: `INT × 0.7 + DEX × 0.3`
- **目標ペナルティ**:
  - 目標未設定のアイテム: 0.1倍
  - 目標達成済みのアイテム: 0.01倍
- **重複ペナルティ**: 他の村人が同じターゲットを狙っている場合: 0.05倍
- **効率**: 飢餓(0.5) や スタミナ0(0.3) が反映

#### 採取進行速度

$$\text{1時間あたりの上昇量} = \frac{\text{DEX} \times 0.8 + 10}{\text{採取難易度}}$$

100%に達するとアイテム獲得。獲得量 = `baseAmount × jobMod × (1 + statVal × 0.01) × efficiency`。

### ③ 「討伐 (Hunt)」指示時の自動決定アルゴリズム

#### 討伐ターゲット選定スコア

不足しているドロップアイテムの達成率と戦闘の有利度を考慮して選択。

1. エリア内でリスポーン中でない通常モンスター（ボス除く）を抽出。
2. 各モンスターのスコアを計算:
   - `monsterRatio = min(achievementRatio of needed drops)` — 不足ドロップの達成率が低いほど優先
   - 必要ドロップがない場合: `monsterRatio = 1.5`
   - `advantageMultiplier = clamp(combatDifficulty / 30, 0.5, 1.5)` — 倒しやすい敵ほど優先
   - 他の村人が同じモンスターを狙っている場合: `+10.0`（重複回避）
3. 最も `monsterRatio` が低い（優先度が高い）モンスターを選択。

#### 戦闘処理

- 進捗ゲージが100%に達すると戦闘が発生。最大10ターンの自動戦闘。
- 各ターン: ポーション使用 → 僧侶ヒール(自身50%以下) → 攻撃 → 敵の反撃
- 勝利: 経験値獲得 + ドロップ抽選
- 敗北(HP0): 強制帰還
- 引分(10ターン以内に未決着): 進捗リセット、次回再挑戦

---

## 4. 村人の経済と報酬サイクル

### アイテム獲得時の買取処理

村人がアイテムを獲得すると、`processItemAcquisition` で以下の処理が行われます：

1. 基本買取価格 = `アイテムの基本売値 × 2`
2. プレイヤーのゴールドから買取金額が差し引かれ、村人の所持金に加算
3. アイテムが倉庫に追加
4. プレイヤーのゴールド不足時は、アイテムが村人の `pool`（仮置き場）に保管

### 自動買取

毎時間の `processItemPoolPurchase` で、村人の仮置き場にあるアイテムを順次買取。プレイヤーにゴールドがある限り自動購入されます。

---

## 5. レベルアップ

### 必要経験値

$$\text{次のレベルに必要なEXP} = \text{EXP\_NEEDED\_PER\_LEVEL(40)} \times \text{現在レベル}$$

### レベルアップ時の成長

- 全ステータス: 基礎値に `STAT_GROWTH_PER_LEVEL(5)` を加算
- 最大HP: `HP_GROWTH_PER_LEVEL(20)` を加算、HP全回復
- 最大スタミナ: `STAMINA_GROWTH_PER_LEVEL(15)` を加算、スタミナ全回復
