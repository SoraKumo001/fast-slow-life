import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameLog } from '../types/game';
import { Terminal } from 'lucide-react';

export const LogConsole: React.FC = () => {
  const { logs } = useGameStore();
  const [filter, setFilter] = useState<GameLog['type'] | 'all'>('all');

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.type === filter);

  const getTypeStyle = (type: GameLog['type']) => {
    switch (type) {
      case 'combat':
        return 'text-red-400';
      case 'gather':
        return 'text-emerald-400';
      case 'craft':
        return 'text-sky-400';
      case 'upgrade':
        return 'text-amber-400';
      case 'system':
        return 'text-purple-400 font-bold';
      case 'warning':
        return 'text-yellow-400 animate-pulse';
      case 'error':
        return 'text-red-500 font-bold';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      {/* タイトルとフィルタ */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-3">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
          <Terminal className="w-4 h-4 text-sky-400" />
          ゲーム活動ログ
        </h2>

        {/* フィルターボタン */}
        <div className="flex flex-wrap gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
          {(['all', 'combat', 'gather', 'craft', 'upgrade', 'system'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                filter === type
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              {type === 'all'
                ? 'すべて'
                : type === 'combat'
                ? '戦闘'
                : type === 'gather'
                ? '採取'
                : type === 'craft'
                ? '加工'
                : type === 'upgrade'
                ? '施設'
                : 'システム'}
            </button>
          ))}
        </div>
      </div>

      {/* ログ本文 */}
      <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1 leading-relaxed">
        {filteredLogs.length === 0 ? (
          <p className="text-slate-500 text-center py-6 italic">ログはありません</p>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-950/40 py-0.5 rounded px-1 transition duration-100">
              <span className="text-slate-500 font-bold shrink-0">{log.timestamp}</span>
              <span className={`break-words ${getTypeStyle(log.type)}`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
