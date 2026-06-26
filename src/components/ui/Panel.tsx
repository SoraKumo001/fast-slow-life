import React from "react";

export type PanelVariant = "default" | "critical" | "compact" | "success";

interface PanelProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: PanelVariant;
  /**
   * Override the title color (Tailwind class). Useful for variants.
   */
  titleClassName?: string;
  /**
   * Optional action area shown on the right of the title.
   */
  actions?: React.ReactNode;
}

const variantStyles: Record<PanelVariant, string> = {
  default: "bg-slate-900/40 border-slate-800",
  critical: "bg-red-950/30 border-red-900/60",
  compact: "bg-slate-900/40 border-slate-800",
  success: "bg-emerald-950/30 border-emerald-900/60",
};

const variantPadding: Record<PanelVariant, string> = {
  default: "p-5",
  critical: "p-4",
  compact: "p-3",
  success: "p-4",
};

const variantTitleColor: Record<PanelVariant, string> = {
  default: "text-slate-100",
  critical: "text-red-200",
  compact: "text-slate-200",
  success: "text-emerald-100",
};

export const Panel: React.FC<PanelProps> = ({
  title,
  icon,
  children,
  className = "",
  variant = "default",
  titleClassName,
  actions,
}) => {
  return (
    <div
      className={`border rounded-xl flex flex-col h-full ${variantStyles[variant]} ${variantPadding[variant]} ${className}`}
    >
      {(title !== undefined || actions) && (
        <h2
          className={`text-lg font-bold mb-4 flex items-center gap-2 shrink-0 ${
            titleClassName ?? variantTitleColor[variant]
          }`}
        >
          {icon}
          {title !== undefined && <span className="flex-1">{title}</span>}
          {actions}
        </h2>
      )}
      {children}
    </div>
  );
};
