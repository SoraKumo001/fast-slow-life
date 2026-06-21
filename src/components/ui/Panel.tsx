import React from "react";

interface PanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({ title, icon, children, className = "" }) => {
  return (
    <div
      className={`bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col h-full ${className}`}
    >
      <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2 shrink-0">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
};
