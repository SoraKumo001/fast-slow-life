# キャラクター＆職業設計書：村人とAI

村人（キャラクター）のステータス、職業（ジョブ）のデータ定義、およびプレイヤーからの大まかな指示（採取・討伐）に対する自動意思決定ロジックの設計です。

---

## 1. 村人のステータス設計

各村人は、以下のプロパティを持ちます。Godotでは `Resource` またはカスタムの `RefCounted` クラスとして実装します。

```gdscript
# villager_data.gd (イメージ)
class_name VillagerData
extends Resource

@export var name: String
@export var level: int = 1
@export var exp: int = 0
@export var current_job: String = "無職"
@export var job_history: Array[String] = ["無職"] # 転職済みの職業（コスト不要で復帰可能）

# 基本能力値
@export var max_hp: int = 100
@export var current_hp: int = 100
@export var str: int = 10  # 物理攻撃、鉱石採取に影響
@export var int: int = 10  # 魔法攻撃、薬草・魔石採取に影響
@export var dex: int = 10  # 命中率、クラフト時の大成功確率に影響
@export var agi: int = 10  # 回避率、行動順、採取効率に影響
@export var vit: int = 10  # 物理防御力、最大HPに影響

# 現在の装備
@export var weapon_id: String = "none"
@export var armor_id: String = "none"

# プレイヤーからの現在の方針指示 ("gather" または "hunt")
@export var order: String = "gather"
```

---

## 2. 職業（ジョブ）システム

職業は、村人のステータス補正と「採取」「戦闘」時における得意分野（適性）を決定します。

### 職業一覧とパラメータ

| 職業名 | 特性・適性 | STR補正 | INT補正 | AGI補正 | DEX補正 | VIT補正 | 転職コスト |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **無職** | 初期状態。特徴なし。 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | - |
| **農民** | 食料の採取効率 +100% | 1.1 | 0.9 | 1.1 | 1.0 | 1.0 | 100 G |
| **鉱夫** | 鉱石の採取効率 +100% | 1.3 | 0.7 | 0.8 | 1.0 | 1.2 | 150 G |
| **薬師** | 薬草の採取効率 +100% | 0.8 | 1.2 | 1.0 | 1.3 | 0.8 | 150 G |
| **猟師** | 食料+革・骨などの討伐素材採取 +50% | 1.1 | 0.9 | 1.2 | 1.2 | 0.9 | 200 G |
| **戦士** | 物理戦闘に特化。物理ダメージ +30% | 1.4 | 0.5 | 1.1 | 1.0 | 1.3 | 300 G |
| **魔術師**| 魔法戦闘に特化。魔法石採取 +50% | 0.5 | 1.5 | 1.0 | 1.1 | 0.7 | 350 G |
| **僧侶** | 戦闘中の回復スキル。生存率大幅UP | 0.8 | 1.3 | 0.9 | 1.1 | 1.1 | 350 G |
| **職人** | 施設での加工（クラフト）大成功率 +20% | 1.0 | 1.0 | 0.9 | 1.4 | 1.0 | 300 G |

- **復職ルール**：すでに一度転職したことのある職業（`job_history` に含まれる職業）へ切り替える際は、転職コスト（ゴールド）は 0 G となります。

---

## 3. 指示と自動行動（AI）アルゴリズム

プレイヤーは村人に対して細かな指示を出す必要はありません。「採取」または「討伐」の方針と、派遣先の「エリア」を指定するだけです。村人は自分の職業とステータスに基づき、最も効率的な具体的なアクションを自動選択します。

### ① 「採取 (Gather)」指示時の自動決定アルゴリズム

村人は、派遣されたエリアで採集可能なアイテムごとに「適性スコア」を計算し、最もスコアが高いアイテムを対象として採取します。

#### スコア計算式
$$\text{Score} = (\text{アイテムの基本採取難易度による逆数}) \times (\text{職業のカテゴリ適性補正}) \times (\text{関連ステータス値})$$

- **カテゴリ適性補正**：
  - 食料系：農民 = 2.0、猟師 = 1.5、その他 = 1.0
  - 鉱石系：鉱夫 = 2.0、職人 = 1.2、その他 = 1.0
  - 薬草系：薬師 = 2.0、僧侶 = 1.3、その他 = 1.0
  - 魔法石系：魔術師 = 2.0、薬師 = 1.2、その他 = 1.0
- **関連ステータス値**：
  - 食料系・鉱石系：`STR * 0.7 + DEX * 0.3`
  - 薬草系・魔法石系：`INT * 0.7 + DEX * 0.3`

#### 実装アルゴリズム（擬似コード）
```gdscript
func select_best_gather_target(area: AreaData) -> ItemData:
	var best_item: ItemData = null
	var max_score: float = -1.0
	
	for item in area.gathers:
		var score = calculate_gather_score(item)
		if score > max_score:
			max_score = score
			best_item = item
			
	return best_item

func calculate_gather_score(item: ItemData) -> float:
	var base_multiplier = 1.0 / item.difficulty # 難易度が高いほど基本スコアは下がるが…
	var job_mod = get_job_multiplier_for_category(item.category)
	
	var stat_val = 0.0
	if item.category in ["food", "ore"]:
		stat_val = self.str * 0.7 + self.dex * 0.3
	elif item.category in ["herb", "mana_stone"]:
		stat_val = self.int * 0.7 + self.dex * 0.3
		
	return base_multiplier * job_mod * stat_val * (1.0 + self.agi * 0.01)
```

---

## 4. ② 「討伐 (Hunt)」指示時の自動決定アルゴリズム

「討伐」の指示を受けた村人は、エリアの探索を進めつつ、自身の戦闘能力に合わせて「最も安全かつ見返りの大きい」敵を自動で選択して戦います。

- **安全第一ルール**：
  - 残りHPが 30% 未満の場合、村人は討伐を拒否（または自動撤退）して、村に戻り「宿屋で休養」します。
- **戦闘対象のスコアリング**：
  - モンスターの強さ（推奨LV）が自身のレベルに近い敵を選びます。
  - 戦士などの前衛系は物理防御の低い敵を、魔術師は魔法防御の低い敵を優先的にターゲットします。

#### 討伐ターゲット決定ロジック
1. 自身の現在レベル $L$ に対し、エリア内の出現モンスターから「推奨レベルが $L-2$ から $L+1$」の範囲に収まるものを抽出。
2. 範囲内に収まる敵の中から、以下の「相性スコア」が最も高い敵を選択。
   - **物理アタッカー（戦士・猟師）**：敵の物理防御力が低いほどスコアUP。
   - **魔法アタッカー（魔術師）**：敵の魔法防御力が低いほどスコアUP。
   - **ヒーラー（僧侶）**：自身や同伴している村人のHPが減っている場合、攻撃よりも「回復アクション」のスコアが跳ね上がり、最優先で回復を行う。
