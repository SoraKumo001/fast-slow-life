import { HelpCircle, Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DungeonPanel } from "./components/game/DungeonPanel";
import { FacilityList } from "./components/game/FacilityList";
import { InventoryPanel } from "./components/game/InventoryPanel";
import { VillagerList } from "./components/game/VillagerList";
import { ActiveBossBar } from "./components/layout/ActiveBossBar";
import { Header } from "./components/layout/Header";
import { LogHistoryWindow } from "./components/layout/LogHistoryWindow";
import { SettingsDrawer, useSettingsDrawer } from "./components/layout/SettingsDrawer";
import { StatusBar } from "./components/layout/StatusBar";
import { BossBattleModal } from "./components/modals/BossBattleModal";
import { ResultScreen } from "./components/modals/ResultScreen";
import { SoulShop } from "./components/modals/SoulShop";
import { BossDefeatAnnouncement } from "./components/ui/BossDefeatAnnouncement";
import { BossWipeoutAnnouncement } from "./components/ui/BossWipeoutAnnouncement";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { ShortcutKey } from "./components/ui/ShortcutKey";
import { ToastContainer } from "./components/ui/ToastContainer";
import { useGameStatus, useGameControls, useLogs } from "./hooks";
import { useBossDefeatDetector } from "./hooks/useBossDefeatDetector";
import { useGameKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ModalStackProvider } from "./hooks/useModalStack";
import { useToastStore } from "./hooks/useToastStore";
import { useGameStore } from "./store/gameStore";

export default function App() {
  const { isPaused, playSpeed, gameOver, gameOverReason, gameLimitDays } = useGameStatus();
  const { advanceHour } = useGameControls();
  const logs = useLogs();
  const addToast = useToastStore((s) => s.addToast);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [bossAreaId, setBossAreaId] = useState<string | null>(null);
  const [gameOverTab, setGameOverTab] = useState<"result" | "soul">("result");
  const lastLogIdRef = useRef<string | null>(null);
  const settingsDrawer = useSettingsDrawer();

  const bossArea = useGameStore((s) =>
    bossAreaId ? (s.dungeons.find((d) => d.id === bossAreaId) ?? null) : null,
  );

  // Detect boss defeats and show announcement banner (was in timeActions.ts)
  useBossDefeatDetector();

  // 新しいログを監視してToast通知
  useEffect(() => {
    if (logs.length === 0) return;
    const latest = logs[logs.length - 1];
    if (latest.id === lastLogIdRef.current) return;
    lastLogIdRef.current = latest.id;

    const msg = latest.message;
    if (latest.type === "craft") {
      addToast(msg, "success");
    } else if (latest.type === "warning") {
      addToast(msg, "warning");
    } else if (latest.type === "error") {
      addToast(msg, "error");
    } else if (latest.type === "system" && msg.includes("レベルアップ")) {
      addToast(msg, "success");
    } else if (latest.type === "combat" && msg.includes("撃破")) {
      addToast(msg, "success");
    } else if (latest.type === "combat" && msg.includes("死亡")) {
      addToast(msg, "error");
    } else if (latest.type === "system" && (msg.includes("雇") || msg.includes("転職"))) {
      addToast(msg, "info");
    } else if (latest.type === "system" && msg.includes("解放")) {
      addToast(msg, "success");
    }
  }, [logs, addToast]);

  // ゲーム時間進行ループ
  useEffect(() => {
    if (isPaused || gameOver) return;

    let intervalMs = 1000; // normal
    if (playSpeed === "fast") intervalMs = 300;
    if (playSpeed === "super") intervalMs = 100;

    const timer = setInterval(() => {
      advanceHour();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPaused, playSpeed, gameOver, advanceHour]);

  // キーボードショートカット (P1-4)
  useGameKeyboardShortcuts({
    onOpenHelp: () => setShowHelpModal(true),
    onOpenResult: () => setShowResultModal(true),
    onOpenLogHistory: () => setShowHistoryModal(true),
    isPaused,
    gameOver,
  });

  return (
    <ModalStackProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* ヘッダー (上部) */}
        <Header
          onOpenHelp={() => setShowHelpModal(true)}
          onOpenLogHistory={() => setShowHistoryModal(true)}
          onOpenResult={() => setShowResultModal(true)}
          onOpenSettings={settingsDrawer.open}
        />

        {/* クイックステータスバー */}
        <StatusBar onOpenLogHistory={() => setShowHistoryModal(true)} />

        {/* アクティブボスバー (P2-3) */}
        <ActiveBossBar />

        {/* Toast通知 */}
        <ToastContainer />

        {/* メイン 4カラムグリッドエリア (スクロール防止、内部スクロールに依存) */}
        <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.2fr_1.4fr] gap-6 min-h-0 overflow-y-auto lg:overflow-hidden select-none">
          {/* 1. 素材・アイテム */}
          <div className="h-125 lg:h-full min-w-0">
            <InventoryPanel />
          </div>

          {/* 2. 村人一覧 */}
          <div className="h-125 lg:h-full overflow-hidden">
            <VillagerList />
          </div>

          {/* 3. 施設・クラフト */}
          <div className="h-125 lg:h-full overflow-hidden">
            <FacilityList />
          </div>

          {/* 4. ダンジョン派遣 */}
          <div className="h-125 lg:h-full overflow-hidden">
            <DungeonPanel />
          </div>
        </main>

        {/* ボス撃破 / 全滅アナウンス */}
        <BossDefeatAnnouncement />
        <BossWipeoutAnnouncement />

        {/* ゲームオーバー・ゲームクリア時のオーバーレイ */}
        {gameOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-4 space-y-2">
                {gameOverReason === "クリア" ? (
                  <>
                    <h1 className="text-4xl font-extrabold text-amber-400 uppercase tracking-widest animate-bounce drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                      🎉 GAME CLEAR 🎉
                    </h1>
                    <p className="text-emerald-400 text-sm font-bold">
                      おめでとうございます！終焉の竜を討伐し、世界に平和をもたらしました！
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-4xl font-extrabold text-red-500 uppercase tracking-widest animate-pulse">
                      GAME OVER
                    </h1>
                    <p className="text-slate-400 text-sm">
                      {gameOverReason === "破産"
                        ? "所持金マイナス状態が3日間続いたため、破産しました。"
                        : gameOverReason === "脅威度"
                          ? "ダンジョンの脅威度が 100% に達し、村は壊滅しました。"
                          : `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。`}
                    </p>
                  </>
                )}
              </div>

              {/* タブ切り替え */}
              <div className="flex gap-1 mb-4 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setGameOverTab("result")}
                  className={`flex-1 py-2 px-4 rounded text-xs font-bold transition ${
                    gameOverTab === "result"
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  リザルト
                </button>
                <button
                  onClick={() => setGameOverTab("soul")}
                  className={`flex-1 py-2 px-4 rounded text-xs font-bold transition ${
                    gameOverTab === "soul"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  転生ショップ
                </button>
              </div>

              {gameOverTab === "result" ? <ResultScreen /> : <SoulShop />}
            </div>
          </div>
        )}

        {/* 手動表示の転生ショップモーダルは Header.tsx に移管済み */}

        {/* 遊び方ヘルプモーダル */}
        <Modal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          className="max-w-lg"
          showCloseButton
          title={
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
              <HelpCircle className="w-5 h-5 text-sky-400" />
              Fast Slow Life の遊び方
            </h3>
          }
        >
          <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-96 overflow-y-auto pr-1">
            {/* P1-5: キーボードショートカット一覧 */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <p className="text-slate-200 font-bold flex items-center gap-1.5 mb-2">
                <Keyboard className="w-3.5 h-3.5 text-sky-400" />
                キーボードショートカット
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <ShortcutKey keys="Space" label="一時停止 / 再開" />
                <ShortcutKey keys="1 / 2 / 3" label="速度切替" />
                <ShortcutKey keys="D" label="1日スキップ (一時停止中のみ)" />
                <ShortcutKey keys="R" label="リザルト表示" />
                <ShortcutKey keys="L" label="ログ履歴表示" />
                <ShortcutKey keys="?" label="この遊び方を表示" />
                <ShortcutKey keys="Esc" label="モーダルを閉じる" />
              </div>
            </div>

            <p>
              <strong>1. 素材と目標（第1カラム）:</strong>
              <br />
              倉庫内のアイテム一覧が表示されます。目標個数を設定すると、そのアイテムが不足している場合に、村人が自動で採取エリアへ派遣されたり、施設で自動的にクラフトが始まります。
              クリックするとアイテムの詳細（売却額やレシピ）が見られ、交易所が解放されていれば売却できます。
            </p>
            <p>
              <strong>2. キャラクターとAI指示（第2カラム）:</strong>
              <br />
              村人のステータス（HP・スタミナ・基本能力）や、現在の行動状態が表示されます。
              「転職」で異なる職業（得意分野が異なる）にチェンジさせたり、倉庫にある武器・防具を「装備」させて能力を向上させることができます。
            </p>
            <p>
              <strong>3. 施設とクラフト（第3カラム）:</strong>
              <br />
              各施設（宿屋、工房、鍛冶屋、錬金工房、交易所）のレベルやアップグレード、現在行われているクラフトキューが表示されます。
              アップグレードやクラフトを指示すると、時間経過で進行します。
            </p>
            <p>
              <strong>4. ダンジョンと派遣（第4カラム）:</strong>
              <br />
              探索可能なエリアと、推奨レベルや出現する魔物が確認できます。
              村人を選んで「採取派遣」または「討伐派遣」を行うことができます。活動中はスタミナを消費し、HPやスタミナが減ると自動で村に帰還します。
            </p>
            <p>
              <strong>5. ボス討伐と転生:</strong>
              <br />
              一定の日数までにエリアボスを倒せないとゲームオーバーになります。
              ゲームオーバー時にはそれまでの進行度に応じた「ソウルポイント
              (SP)」が獲得でき、これを使って次回プレイが有利になる永続バフを購入できます（いつでも「転生」して次の周回に挑むことも可能です）。
            </p>
            <p>
              <strong>💡 経済システムの注意点とコツ:</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>破産が最大の敵:</strong> 所持金マイナス状態が3日間続くと
                <span className="text-red-400">強制ゲームオーバー</span>です。
                序盤は無理な投資を避け、常に一定の現金を残すよう心がけましょう。
              </li>
              <li>
                <strong>食料は毎時消費:</strong> 村人は1人あたり1日1食を消費します。
                農場を早期にアップグレードして安定供給を確保しましょう。
                食料が尽きると飢餓状態になり、戦闘効率が半減します。
              </li>
              <li>
                <strong>市場レベルを上げよ:</strong> 交易所のレベルが上がると
                輸出時の売却ボーナスが増加（Lv1: +10%, Lv5: +50%）。
                交易が主要な収入源になる中盤以降は優先的な投資先です。
              </li>
              <li>
                <strong>投資で運搬量＆速度アップ:</strong> 各街への投資で
                交易馬車の積載上限が増え、交易時間が短縮されます。1回の交易で多く運べば、
                時間あたりの効率が大幅に向上します。
              </li>
              <li>
                <strong>クラフトで付加価値:</strong> 生の素材をそのまま売るより、
                工房や調理場で加工してから輸出した方が高額に。 特に{" "}
                <span className="text-purple-400">板材(原木→木板)</span> や
                <span className="text-purple-400">鉄インゴット(鉄鉱石→インゴット)</span>
                は効率の良い加工品です。
              </li>
              <li>
                <strong>訓練所は計画的に:</strong> 強力な村人育成には訓練所が有効ですが、 訓練費用は
                <span className="text-yellow-400">1回80G～4000G</span>と高額。
                資金に余裕ができてから計画的に活用しましょう。
              </li>
            </ul>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button onClick={() => setShowHelpModal(false)} variant="primary" size="md">
              了解
            </Button>
          </div>
        </Modal>

        {/* ログ履歴モーダル (Header ボタン / StatusBar ログクリック両方から開かれる) */}
        {showHistoryModal && (
          <LogHistoryWindow logs={logs} onClose={() => setShowHistoryModal(false)} />
        )}

        {/* リザルトモーダル (Header ボタン / R キー両方から開かれる) */}
        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          size="lg"
          showCloseButton
        >
          <ResultScreen />
        </Modal>

        {/* ボス戦モーダル (DungeonPanel から open) */}
        {bossArea && <BossBattleModal area={bossArea} onClose={() => setBossAreaId(null)} />}

        {/* 設定ドロワー (P2-6) */}
        <SettingsDrawer isOpen={settingsDrawer.isOpen} onClose={settingsDrawer.close} />
      </div>
    </ModalStackProvider>
  );
}
