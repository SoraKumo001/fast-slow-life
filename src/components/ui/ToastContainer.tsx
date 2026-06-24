import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React from "react";

import { useToastStore } from "../../hooks/useToastStore";

const iconMap = {
  info: <Info className="w-4 h-4 text-sky-400" />,
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  error: <AlertTriangle className="w-4 h-4 text-red-400" />,
};

const borderMap = {
  info: "border-sky-500/20",
  success: "border-emerald-500/20",
  warning: "border-amber-500/20",
  error: "border-red-500/20",
};

const bgMap = {
  info: "bg-sky-500/10",
  success: "bg-emerald-500/10",
  warning: "bg-amber-500/10",
  error: "bg-red-500/10",
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border ${borderMap[t.type]} ${bgMap[t.type]} backdrop-blur-md shadow-lg max-w-sm`}
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          {iconMap[t.type]}
          <span className="text-xs text-slate-200 leading-relaxed flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-500 hover:text-slate-300 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
