import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DungeonPanel } from "./components/game/DungeonPanel";
import { FacilityList } from "./components/game/FacilityList";
import { InventoryPanel } from "./components/game/InventoryPanel";
import { VillagerList } from "./components/game/VillagerList";
import { Header } from "./components/layout/Header";
import { StatusBar } from "./components/layout/StatusBar";
import { ResultScreen } from "./components/modals/ResultScreen";
import { SoulShop } from "./components/modals/SoulShop";
import { Button } from "./components/ui/Button";
import { Modal } from "./components/ui/Modal";
import { ToastContainer } from "./components/ui/ToastContainer";
import { useGameStatus, useGameControls, useLogs } from "./hooks";
import { useToastStore } from "./hooks/useToastStore";

export default function App() {
  const { isPaused, playSpeed, gameOver, gameOverReason, gameLimitDays } = useGameStatus();
  const { advanceHour } = useGameControls();
  const logs = useLogs();
  const addToast = useToastStore((s) => s.addToast);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [gameOverTab, setGameOverTab] = useState<"result" | "soul">("result");
  const lastLogIdRef = useRef<string | null>(null);

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ヘッダー (上部) */}
      <Header />

      {/* クイックステータスバー */}
      <StatusBar />

      {/* Toast通知 */}
      <ToastContainer />

      <div className="bg-slate-900/40 border-b border-slate-900 px-6 py-2 flex items-center gap-4 text-xs text-slate-400 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <span>村を発展させ、ボス討伐期限までにダンジョンを攻略しましょう。</span>
          <button
            onClick={() => setShowHelpModal(true)}
            className="text-sky-400 hover:underline flex items-center gap-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5" /> 遊び方
          </button>
        </div>
      </div>

      {/* メイン 4カラムグリッドエリア (スクロール防止、内部スクロールに依存) */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-0 overflow-y-auto lg:overflow-hidden select-none">
        {/* 1. 素材・アイテム */}
        <div className="h-125 lg:h-full overflow-hidden">
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

      {/* ゲームオーバー時のオーバーレイ */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-4 space-y-2">
              <h1 className="text-4xl font-extrabold text-red-500 uppercase tracking-widest animate-pulse">
                GAME OVER
              </h1>
              <p className="text-slate-400 text-sm">
                {gameOverReason === "破産"
                  ? "所持金マイナス状態が3日間続いたため、破産しました。"
                  : gameOverReason === "全滅"
                    ? "すべての村人が戦闘不能になりました。"
                    : `制限日数（${gameLimitDays}日）に達しましたが、ボスが未討伐です。`}
              </p>
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
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-850">
          <Button onClick={() => setShowHelpModal(false)} variant="primary" size="md">
            了解
          </Button>
        </div>
      </Modal>
    </div>
  );
}
