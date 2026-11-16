# Phase 0 プロトタイプ仕様 ― ポリゴンの町で生活が見えるか

決定事項（2026-11-16 ユーザー確定・推奨案）:
- A. カメラ: 見下ろし＋90度刻み回転＋ズーム（自由カメラは付けない）
- B. 進め方: 同一リポジトリ、ブランチ `feat/v2-polygon-town` で一新
- C. 脅威度: 100%で即ゲームオーバーではなく、襲撃イベント＋防衛戦に緩和（Phase 4で実装、本Phase対象外）

## 1. Phase 0 の目的と判定

目的はただ1つ: **「町を眺めているだけで、村人の生活が読めるか」を判定すること。**
経済v2・ダンジョンv2・セーブ連携は一切入れない。失敗したら柱1を再設計するための試作であり、本実装への使い回しを前提に作る（捨てコードにしない）。

判定基準（ユーザーが実際に開いて見る）:
1. 村人が家から出て、職場へ歩いて行き、働き、昼に広場／食堂に寄り、夕方に帰るのが分かる
2. 建物を見ただけで何の施設か分かる（看板色＋形）
3. 朝・昼・夕・夜で町の印象が変わる
4. カメラの回転（90度）・ズーム・パンで迷わない
5. 60fps近辺で滑らか（村人5人＋建物約15＋プロップ程度の規模）

## 2. スコープ

### 入れる
- 町グリッドとレイアウトデータ（下記 §3）
- 建物ビルダー（施設7種＋民家＋広場の井戸・掲示板＋町の門）
- 町環境ビルダー（地面・道・広場・木・柵・街灯）
- 経路探索（グリッドA*、建物マスは通行不可、道は低コスト）
- プロトタイプ用エージェント5人（ゲーム本体のストアとは未接続の独立シミュレーション）: 職業と家と職場を持ち、プロトタイプ時計のスケジュールで移動・作業・休息する
- TownViewport: 見下ろしカメラ（回転4方向・ズーム・ドラッグでパン）、昼夜ライティング、頭上名前ラベル
- 表示導線: `?prototype=town` でプロトタイプ画面を単独表示（通常ゲームは無改変で起動できること）

### 入れない（Phase 1以降）
- 本体ゲームストアとの接続、セーブ、経済、ダンジョン
- 欲求パラメータの完全版（Phase 0は時刻スケジュールの固定テンプレートでよい）
- 建物のレベル別形状変化（Lv1形状のみ。ただしビルダーは level 引数を受け取る形にする）

## 3. 町レイアウト（32×32マス、1マス=2単位）

座標: `x: 0..31`（東が+）、`z: 0..31`（南が+）。ワールド変換 `world = (grid - 16) * 2`。

```
北 (z=0)   ─ 町の門（ダンジョン／交易の出発点）を北辺中央に置く
           農場・伐採所・採石場は町の外周（北西〜北東）に置く「仕事場ゾーン」
中央       ─ 広場 4×4（井戸・掲示板・街灯）。広場を囲んで公共施設を配置
南 (z=31)  ─ 住宅ゾーン（民家を南側に並べる）、南辺は森のプロップで閉じる
```

配置（左上マス座標・占有マス）:

| 建物 | 種別 | 位置 (x,z) | 占有 | 看板色 | 特徴形状 |
|---|---|---|---|---|---|
| 町の門 | gate | (14,0) | 4×2 | 灰 | 柱2本＋梁、既存ダンジョン入口アーチと同系 |
| 農場 | farm | (2,3) | 6×4 | 黄緑 | 建物ではなく畑の畝＋小屋 |
| 伐採所 | lumberyard | (24,3) | 5×4 | 茶 | 丸太の山＋小屋 |
| 採石場 | quarry | (9,2) | 5×3 | 灰青 | 岩プロップ群＋小屋 |
| 宿屋 | inn | (9,10) | 4×3 | 橙 | 2階建て・煙突 |
| 加工工房 | workshop | (19,10) | 4×3 | 赤茶 | 煙突＋作業台 |
| 調理場 | kitchen | (10,20) | 3×3 | 黄 | 小さめ・煙突から湯気色 |
| 錬金工房 | alchemy | (20,20) | 3×3 | 紫 | 塔状の屋根 |
| 交易所 | market | (19,14) | 4×3 | 金 | テント屋根・屋台併設 |
| ギルド | guild | (9,14) | 4×3 | 青 | 大きめ・旗 |
| 武器屋 | weapon_shop | (23,16) | 3×3 | 銀 | 看板に剣色 |
| 訓練所 | training_ground | (24,22) | 5×4 | 紺 | 建物ではなく囲い＋的 |
| 倉庫 | warehouse | (12,10) | 3×2 | 焦茶 | 低い・箱の山 |
| 広場 | plaza | (14,14) | 4×4 | 石畳 | 井戸・掲示板・街灯・ベンチ |
| 民家×5 | house | 南側 (4,26)(9,26)(14,26)(19,26)(24,26) | 各3×3 | 家ごとに変える | 三角屋根・ドア・窓 |

残りマスは道（広場から各建物入口へ十字＋外周路）／草地／木・柵の配置マスとする。
入口マス: 各建物は南面中央1マスを `entrance` とし、エージェントの到着点は入口の外側マスにする。

データ形式: `src/data/townLayout.ts`
- `TOWN_GRID_SIZE = 32`, `CELL_SIZE = 2`
- `TOWN_BUILDINGS: TownBuildingDef[]`（id, facilityId?, name, x, z, w, d, entrance: {x,z}, signColor）
- `isWalkable(x,z)`, `buildOccupancyGrid()` など純関数でテスト可能にする

## 4. エージェント（プロトタイプ用、5人）

`src/store/life/prototypeAgents.ts` ― 純粋なシミュレーション（Three非依存）として作り、単体テストを付ける。

| 名前 | 職業 | 家 | 職場 |
|---|---|---|---|
| アリス | 農民 | 民家1 | 農場 |
| ボブ | 木こり | 民家2 | 伐採所 |
| カナ | 職人 | 民家3 | 加工工房 |
| レオン | 戦士 | 民家4 | 訓練所（Phase 0では訓練所を職場とする） |
| ミア | 薬師 | 民家5 | 錬金工房 |

スケジュール（プロトタイプ時計、1日=実時間60秒でループ、速度切替 1x/4x/一時停止つき）:
- 06–07 起床（家）／ 07–12 職場で作業 ／ 12–13 広場で昼休み ／ 13–18 職場 ／ 18–20 広場→家 ／ 20–22 家 ／ 22–06 就寝（家）
- 移動は経路探索の結果をマス単位で辿る。作業中は職場マス内で小さく往復＋作業アニメ、広場では井戸／掲示板付近に散る

状態は `home | toWork | work | toPlaza | plaza | toHome | sleep` のステートマシンとし、tick(dt) で進める。

## 5. 描画

- `src/components/three/builders/buildingMeshBuilder.ts`: `buildBuildingMesh(def, level=1)` ― 土台Box＋壁＋屋根（切妻はプリズム近似: Box回転 or Cylinder 3角柱）＋ドア＋窓（夜は emissive）＋看板（色Box）。材質は `MeshStandardMaterial({ flatShading: true })`、テクスチャなし
- `src/components/three/builders/townEnvironmentBuilder.ts`: 地面（草地色の大きなPlane＋道マスだけ色替えの薄Boxタイル）、広場の石畳、木（既存 `createSideProp` の trees 型を流用し InstancedMesh 化は Phase 1送り、Phase 0は通常Meshで本数30以下）、街灯（夜に PointLight は使わず emissive＋疑似光円）
- `src/components/three/town/TownViewport.tsx`: DungeonThreeViewport の構造（Ref経由でループにpropsを渡す、ResizeObserver、クリーンアップ、WebGL失敗表示、頭上ラベル投影）を踏襲する
  - カメラ: 中心点＋方位角（0/90/180/270度、ボタンと Q/E キーで回転、補間つき）＋距離ズーム（ホイール、12〜48）＋ドラッグでパン（中心は町範囲にクランプ）。高さは距離連動の見下ろし（俯角 約50度固定）
  - 昼夜: プロトタイプ時計の時刻で太陽光の色・角度・空色・窓明かりを補間（06朝焼け／12昼／18夕／22夜）
  - 村人: 既存 `buildVillagerMesh(job)` をそのまま使い、`animateVillagerMesh` の移動／採取アニメを流用。作業は gathering、移動は walk、就寝は家の中で非表示（窓明かりのみ）とする割り切りでよい

## 6. ファイル構成（新規のみ、既存改変は App の分岐1箇所だけ）

```
docs/v2/phase0-spec.md            本書
docs/v2/renewal-plan.md           一新計画の repo 内コピー（決定事項を反映）
src/data/townLayout.ts            町レイアウト＋純関数
src/data/townLayout.test.ts       配置の重なり・歩行可能性・全建物到達可能性
src/store/life/pathfinding.ts     グリッドA*（道コスト優遇）
src/store/life/pathfinding.test.ts
src/store/life/prototypeAgents.ts スケジュール＋ステートマシン
src/store/life/prototypeAgents.test.ts
src/components/three/builders/buildingMeshBuilder.ts
src/components/three/builders/townEnvironmentBuilder.ts
src/components/three/town/TownViewport.tsx
src/components/three/town/TownPrototypePage.tsx  時計・速度・カメラ操作UI付きの単独ページ
src/App.tsx                       ?prototype=town のとき TownPrototypePage を返す分岐のみ追加
```

## 7. ゲート

1. `pnpm build`（tsc含む）が通る
2. 新規テスト＋既存テスト全緑（`pnpm test:run`、balance-simは対象外）
3. 通常起動（`?prototype` なし）で従来ゲームがそのまま動く（App分岐以外の既存ファイル無改変）
4. プロトタイプで5人が1日ループを完走し、経路が建物を突き抜けない（テストで全区間の到達可能性を担保）
