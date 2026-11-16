# Phase 2 仕様 ― 生活AI（スケジュール＋欲求＋今日のあしあと）

前提: Phase 1 完了（commit `6663212` push 済み）。主画面はポリゴンの町になり、村人の行き先は `townSpatial.resolveVillagerDestination` が既存状態から導出している。
目的: **町にいる村人が「暮らしている」ように振る舞い、その1日を後から読めるようにする。**

## 1. Phase 2 の境界（重要）

Phase 1 の絶対条件は維持する: **ゲームロジック無改変・本体セーブ形状無改変**。

- 村人の「仕事・派遣・休息」の決定は引き続き本体ロジックが行う。Phase 2 が決めるのは、本体が拘束していない時間（idle、および resting の過ごし方の詳細）における**町での過ごし方**だけ
- 食事・睡眠の実処理（食料消費、HP/スタミナ回復）は既存の survival / resting 処理が既に行っている。Phase 2 の食事・就寝はその**見える化**であり、在庫やステータスを二重に消費・回復させない
- 欲求（needs）は既存ステータスからの**導出値**であり、新しい保存フィールドは作らない。例外は §5 の自宅割り当てのみ（本体セーブの外のサイドストレージに保存）

## 2. 欲求モデル（新規: `src/store/life/needs.ts`、純関数）

`deriveNeeds(villager, hour): Needs` ― 各 0〜100、**高いほど欠乏**している（行動の駆動力）。

| 欲求 | 導出 | 意味 |
|---|---|---|
| hunger 空腹 | `isStarving` なら 90。`activeFoodBuffId` があれば 20。どちらもなければ時刻で 40〜70（朝起きてから食事どきに向けて上がる単調な曲線でよい） | 食事に行きたい |
| fatigue 疲労 | `100 - (stamina / maxStamina * 100)` | 休みたい |
| health 健康欠乏 | `100 - (currentHp / maxHp * 100)` | 宿屋・自宅で静養したい |
| social 社交 | 時刻ベース: 朝 30 から夕方に向けて上がり、夜は下がる。村人 id ハッシュで ±15 の個人差 | 広場で人と過ごしたい |
| wealth 満足欠乏 | 所持金 0G→80、200G→40、1000G以上→10 の線形目安。ツケ（マイナス）は 95 | 買い物・良い食事への渇き（Phase 3 経済への布石。Phase 2 では食事の質の選択にだけ使う） |

テスト: 境界値（スタミナ満タン→疲労0、HP0→健康欠乏100、飢餓→空腹90）、単調性、決定性（同じ入力で同じ出力）。

## 3. 生活AI（新規: `src/store/life/lifeAI.ts`、純関数）

### 3.1 対象

`townSpatial` の解決で **idle** になった村人と、**resting** の村人（過ごし方の詳細のみ）。work / dungeon / sleep の解決は Phase 1 のまま変えない。ただし夜間帯（22〜6時）の idle→sleep は維持する。

### 3.2 候補行動と Utility スコア

候補（行き先・活動・吹き出し）:

| 候補 | 行き先 | 条件 | 主なスコア源 |
|---|---|---|---|
| 食事 | 調理場（Lv≥1）→なければ宿屋→なければ広場 | 空腹 ≥ 40 | hunger × 1.2 ＋ 食事どき補正（7時・12時・18時台 +20） |
| 静養 | 宿屋（resting の場合は固定でここ）／自宅 | 疲労 ≥ 50 or 健康欠乏 ≥ 50 | fatigue × 1.0 ＋ health欠乏 × 1.0 |
| 広場で過ごす | 広場 | 常時 | social × 0.9 ＋ 昼間補正 |
| 買い物ぶらぶら | 交易所（Lv≥1 のときのみ） | 満足欠乏 ≥ 30 | wealth欠乏 × 0.6 |
| 職場の様子見 | 自分の職業に合う施設の前 | 常時 | 職業嗜好（下記）× 15 ＋ 低い基礎値 |
| 自宅で過ごす | 自宅 | 常時 | 疲労 × 0.4 ＋ 夜間補正（19時以降 +15） |

- スコア = Σ（欲求 × 係数）＋ 補正 ＋ 個人差（id ハッシュで 0〜10 の固定ノイズ。Math.random は使わない＝決定論的）
- 職業嗜好: 農民→農場、木こり→伐採所、鉱夫→鉱山（quarry）、薬師→錬金工房、職人→加工工房、戦士→訓練所、猟師→門付近、魔術師→錬金工房、僧侶→宿屋、無職→なし
- 最高スコアの候補を選ぶ。同点は候補表の上位を優先
- 活動種別は TownActivity に `"meal" | "stroll"` を追加する（既存種別は不変）。meal は食事アニメ＋🍞吹き出し、stroll は広場／職場前での idle ＋たまに小移動

### 3.3 townSpatial との接続

- `resolveVillagerDestination` の idle 分岐（現行の時刻帯テーブル）を、lifeAI の選択に置き換える。シグネチャは維持し、内部で `deriveNeeds` ＋ `chooseLifeActivity` を呼ぶ形にする（resting は行き先こそ宿屋固定だが、活動詳細として lifeAI の結果を参照できるよう戻り値に `lifeAction` を任意追加してよい）
- Phase 1 の townSpatial テストは、idle 帯の期待値が変わる分だけ更新してよい（優先順位 1〜6 のテストは不変であること）

## 4. 今日のあしあと（新規: `src/store/life/footprint.ts`）

### 4.1 記録

- ランタイムストア（zustand、**永続化しない**）。エントリ: `{ villagerId, day, hour, minute?, text, kind }`、kind は `depart|arrive|work|meal|rest|sleep|wake|plaza|other`
- 記録タイミング: GameTownViewport が各村人の「解決済み行き先（buildingId＋activity）」の変化を検出したとき。前回と異なる場合に1件追加する。文面は変化先から生成する純関数 `describeTransition(prev, next, villager, context)` で作る
  - 例: 「07:12 加工工房へ向かった」「07:20 加工工房で作業を始めた」の2段は作らない。到着＝行き先確定で1件に統一し、文面は行き先と活動から作る（例: 「加工工房でクラフト」「始まりの森へ出発（門）」「調理場で食事」「広場で休憩」「帰宅」「就寝」「起床」）
  - 食事の文面: `activeFoodBuffId` があれば料理名（アイテムマスタの名前）を出す。`isStarving` のときの食事は「食べるものがなかった」とする
  - ダンジョン帰還: dungeon → 他への遷移は「帰還」とする
- 保持: 村人ごと・日ごとに保持し、表示は「今日」分のみ。前日分は翌日になったら破棄する（メモリ上限: 村人あたり 100 件で古い順に捨てる）

### 4.2 表示

- GameTownViewport の村人ミニカードに拡張: 欲求バー5本（空腹・疲労・健康・社交・満足、欠乏度を色で）と、その下に「今日のあしあと」リスト（時刻＋文面、最新が上、最大12件表示でスクロール可）
- 頭上ラベルに吹き出しアイコンを追加: meal 🍞 / work 🔨 / plaza・stroll 💬（近くに他の村人がいる場合のみ）/ rest ☕ / sleep は非表示中なのでなし。アイコンはラベル内の小さな span でよい

### 4.3 テスト

- describeTransition の文面生成（各活動・食事の3分岐・帰還）
- ストアの追加・日次ローテーション・上限破棄
- 同じ行き先が続く場合は追加されない（重複防止は Viewport 側の責務だが、ストアにも同一エントリ連続追加を防ぐガードを入れる）

## 5. 自宅割り当ての永続化（新規: `src/store/life/homeAssignment.ts`）

- Phase 1 の暫定（リスト順 index）を、サイドストレージ `localStorage["fsl-life-v1"]` に `{ villagerId: houseBuildingId }` で保存する形に置き換える
- 初回・未登録の村人は、最も入居人数の少ない民家に割り当てて保存する（相部屋は人数バランス優先）
- 本体セーブがリセットされて村人 id が変われば、新 id は未登録として再割り当てされる（古いエントリは容量が小さいので掃除しなくてよい）
- localStorage が使えない環境（テスト等）ではメモリ内 Map にフォールバックし、Phase 1 と同じ index 割当と等価に振る舞う
- `homeBuildingForVillager` の呼び出し側シグネチャは維持する

## 6. ファイル構成

```
docs/v2/phase2-spec.md
src/store/life/needs.ts / needs.test.ts
src/store/life/lifeAI.ts / lifeAI.test.ts
src/store/life/footprint.ts / footprint.test.ts
src/store/life/homeAssignment.ts / homeAssignment.test.ts
src/store/town/townSpatial.ts        idle分岐を lifeAI へ接続、TownActivity に meal/stroll 追加
src/store/town/townSpatial.test.ts    idle帯の期待値を更新（優先順位テストは不変）
src/components/three/town/GameTownViewport.tsx  遷移検出→footprint記録、吹き出し、ミニカード拡張（欲求＋あしあと）
```

prototypeAgents / TownPrototypePage / TownViewport は変更しない。App.tsx の変更も原則なし（ミニカードは Viewport 内で完結）。

## 7. ゲート

1. `pnpm build` 成功
2. `pnpm test:run` 全緑（既存＋新規。townSpatial の優先順位 1〜6 のテストが不変で通ること）
3. `git diff` が §6 の許可ファイルだけであること（ゲームロジック・本体セーブ無改変）
4. 生活シミュレーション検証（テスト内）: 固定の村人セット（idle の農民・飢餓の戦士・疲労した職人など）× 24時間で、①全時刻で行き先が歩行可能マス ②飢餓の村人は食事どきに meal を選ぶ ③夜間は sleep ④同じ入力で同じ選択（決定性）
5. スクリーンショット: 町に村人がいる時刻に、頭上ラベル＋吹き出しが見えること。村人選択でミニカードに欲求バーとあしあとが出ること（CDP でクリック→撮影までできれば理想、難しければミニカード以外の表示までで可と報告する）
