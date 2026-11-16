# Phase 1 仕様 ― 町の器（本体接続）

前提: Phase 0 完了（commit `f846a00`、ブランチ `feat/v2-polygon-town` push 済み）。
目的: **プロトタイプの町を、本体ゲームの主画面にする。** ゲームのシミュレーション（経済・探索・クラフト等のロジック）には一切触らず、「状態の見え方」だけを町に置き換える。

## 1. 絶対条件（守らないと Phase 1 ではない）

1. **ゲームロジック無改変**: `src/store/` の既存ファイル、`src/store/gameLoop/`、`src/data/` の既存マスタ、`src/utils/` は変更しない。変更してよい既存ファイルは `src/App.tsx`（レイアウト）と Phase 0 で作った v2 ファイル群（townLayout / builders / TownViewport 等）のみ
2. **セーブ互換を壊さない**: ストアの状態形状を変えない（`saveVersion` 据え置き）。空間状態はすべて既存状態から**導出**する純関数で作る
3. **従来画面にいつでも戻れる**: `?classic=1` で従来の4カラム画面がそのまま起動する（移行期間の安全弁。Phase 5 で撤去判断）

## 2. 画面構成

- 既定（`?classic` なし）: Header / StatusBar / ActiveBossBar は現行のまま。その下を「町ビューポート（主・左）＋タブ式サイドパネル（右、幅 420px 前後）」にする
- サイドパネルのタブ: 在庫 / 村人 / 施設 / ダンジョン ― 中身は既存コンポーネント（`InventoryPanel` / `VillagerList` / `FacilityList` / `DungeonPanel`）を**無改変で**差し込む。高さは親に合わせて伸縮させる
- モーダル群（ボス戦・結果・ソウルショップ・ヘルプ・ログ・設定）は現行のまま全て動くこと
- 町ビューポートは残り領域いっぱいに広がる。狭幅（モバイル相当）ではサイドパネルを下段に回す

## 3. 空間レイヤー（新規: `src/store/town/townSpatial.ts`）

純関数モジュール＋単体テスト。Three 非依存。

### 3.1 村人の行き先解決 `resolveVillagerDestination(villager, facilities, activeBoss, hour)`

優先順位（上から順に最初に当たったもの）:

| # | 条件 | 行き先 | 活動 | 表示 |
|---|---|---|---|---|
| 1 | `activeBoss?.attackerIds` に含まれる | 門 → 町外 | dungeon | 門まで歩き、着いたら非表示 |
| 2 | `status` が traveling_to / active / traveling_back | 門 → 町外 | dungeon | 同上（帰還中も門から現れる扱いでよい。Phase 1 は簡略化し「門に着いたら目的地へ切り替え」で統一） |
| 3 | `assignedCraftJobId` がいずれかの施設の `craftQueue` にある | その施設 | work | workAnchor 付近で作業アニメ |
| 4 | `assignedCraftJobId` が `training_ground.trainingQueue` にある | 訓練所 | work | 同上 |
| 5 | いずれかの施設の `upgradeAssignedVillagerId === villager.id` | その施設 | work | 同上 |
| 6 | `status === "resting"` | 宿屋（Lv≥1 のとき）。Lv0 なら自宅 | rest | 建物前の休憩スポットで idle |
| 7 | idle かつ 22時〜6時 | 自宅 | sleep | 非表示（家の窓明かりのみ） |
| 8 | idle かつ 7〜18時 | 広場 | idle | 広場の散布スポットで idle／たまに小移動 |
| 9 | idle かつ それ以外 | 自宅 | home | 家の前で idle |

- 戻り値: `{ buildingId, activity: "work"|"rest"|"idle"|"home"|"sleep"|"dungeon", anchor: GridPoint }`
- anchor は建物の `workAnchor` を基本に、村人の index で ±1 マスずらして重なりを避ける（決定論的に）
- 自宅の割り当て `homeBuildingForVillager(villagers, villagerId)`: 村人リストの並び順 index で民家に割り当てる（民家5軒に順に、6人目以降は1軒目から相部屋）。Phase 2 で永続化する前提の暫定でよい旨をコメントに明記

### 3.2 天気 `weatherForDay(day): "sunny"|"rain"|"snow"`

- `day` のハッシュから決定論的に決める（晴 70% / 雨 20% / 雪 10% 目安）。セーブに持たない
- Phase 1 では見た目のみ（雨: 青み＋雨粒 Points、雪: 白い粒＋積雪色）。ゲーム効果は付けない

### 3.3 テスト

- 行き先解決の優先順位を各行ケースで検証（特に 3/4 の craft と training の判別、1 のボス参加が 2 より優先）
- 全村人・全時刻（0〜23）で行き先が必ず歩行可能マスに解決すること
- 天気は同じ day で常に同じ、分布が極端に偏らないこと

## 4. 建物の見た目（`buildingMeshBuilder` の拡張）

- `buildBuildingMesh(def, level)` の level を実際に使う:
  - **Lv0（未建設）**: 建物は建てず、更地＋柵＋「予定地」看板（低めの板）にする。`townEnvironmentBuilder` 側ではなくビルダーが Lv0 専用グループを返す
  - Lv1: Phase 0 の形状
  - Lv2: 屋根を少し高く＋煙突（ある建物のみ）
  - Lv3: 横に小さな増築棟
  - Lv4: 2階建て化（壁を高く＋窓列追加）
  - Lv5: 屋根の飾り（看板色のオーブ／旗）＋看板発光
- 施設の現在レベルは `facilities[facilityId].level` から取る。レベルが変わったら該当建物だけ作り直す
- 初期状態では宿屋・加工工房・農場・調理場だけが Lv1 で、他7施設は更地 ― 「町が育つ」初期風景として正しい
- Phase 0 の所見3点もここで直す: ①カメラ初期距離は町全体が入る値（最大寄り）②夜明け（5〜7時）の環境光の下限を上げて真っ暗にしない ③錬金工房の塔屋根を一回り小さく

## 5. ゲーム接続ビューポート（新規: `src/components/three/town/GameTownViewport.tsx`）

Phase 0 の `TownViewport` を土台にし、入力をプロトタイプ時計＋固定エージェントから本体ストアに差し替える。プロトタイプ側（TownViewport / TownPrototypePage / prototypeAgents）は残す（単独検証用）。

- 購読: `useGameStore` から `villagers / facilities / currentDay / currentHour / isPaused / playSpeed / activeBoss` を取る
- 時刻: 昼夜ライティングは `currentHour` ＋「その時間内の経過割合」で補間する。割合は App の進行インターバル（1x=1000ms / fast=300ms / super=100ms）に合わせ、最後に hour が変わってからの実経過で近似してよい（厳密同期は不要）
- 村人の移動: hour が変わるたび（および初回）に全員の行き先を再解決し、A* 経路を引いて歩かせる。歩行速度は playSpeed に連動（1x で町の端から端を約20秒、super では間に合わないので到着を待たず次の経路に切り替えてよい）
- 作業中は workAnchor 周辺で小さく往復＋ `animateVillagerMesh` の gathering アニメ。rest/idle は idle アニメ＋たまに隣マスへ
- sleep / dungeon（門到着後）はメッシュ非表示
- クリック選択: Raycast で建物と村人を拾い、選択状態をコンポーネント内に持つ。選択中は頭上／足元にリング表示＋左下にミニカード（建物: 名前・Lv・稼働状態／村人: 名前・職業・状態テキスト）。ミニカードのボタンでサイドパネルの該当タブを開く（コールバック props `onSelectTab(tab)`）
- カメラ: Phase 0 と同じ（見下ろし・Q/E と ボタンで90度回転・ホイールズーム・ドラッグパン）。初期位置は町全体俯瞰
- 天気: `weatherForDay(currentDay)` で雨／雪の粒と空色を切り替える
- 頭上ラベル: Phase 0 と同じ方式（名前＋職業）。HP バーは付けない（情報はサイドパネル側にある）

## 6. App レイアウト変更（`src/App.tsx`）

- `?prototype=town` 分岐は現行のまま最優先
- `?classic=1` のとき従来レイアウト（現行の4カラム）を描く
- 既定: 新レイアウト。状態として `sideTab: "inventory"|"villagers"|"facilities"|"dungeons"` を持ち、GameTownViewport の `onSelectTab` で切り替える
- ゲームオーバー overlay、モーダル群、ショートカット、トースト等の既存処理は一切変えない

## 7. ファイル構成

```
docs/v2/phase1-spec.md                  本書
src/store/town/townSpatial.ts           行き先解決・自宅割当・天気（純関数）
src/store/town/townSpatial.test.ts
src/components/three/town/GameTownViewport.tsx
src/components/three/builders/buildingMeshBuilder.ts  Lv別形状＋Lv0更地（拡張）
src/components/three/town/TownViewport.tsx            初期カメラ・夜明け光量（微修正）
src/components/three/builders/buildingMeshBuilder.ts  錬金工房の屋根（微修正は同ファイル内）
src/App.tsx                               新レイアウト＋classic分岐
```

townLayout の変更は原則なし（民家の追加もしない。相部屋で受ける）。

## 8. ゲート

1. `pnpm build` 成功
2. `pnpm test:run` 全緑（既存＋新規 townSpatial）
3. `git diff` で §1-1 の無改変条件を確認（変更が許可ファイルだけであること）
4. 従来画面が `?classic=1` で起動し、従来どおり遊べる（ヘッドレススクリーンショットで4カラムが描かれること）
5. 新画面のスクリーンショット: 初期状態（Day 1 朝）で町・更地・広場・村人ラベルが描かれること
6. バランスシミュレータは対象外（ロジック無改変のため）
