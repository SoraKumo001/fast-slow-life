import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "purple"
    | "amber"
    | "sky"
    | "custom";
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  className = "",
  children,
  ...props
}) => {
  const baseStyle =
    "inline-flex items-center text-[10px] px-2 py-0.5 rounded font-semibold border transition-all duration-200 select-none";

  const variantStyles: Record<string, string> = {
    default: "bg-slate-800 text-slate-400 border-slate-700",
    success: "bg-emerald-950/60 text-emerald-400 border-emerald-900/60",
    warning: "bg-amber-950/60 text-amber-400 border-amber-900/60",
    error: "bg-red-950/60 text-red-400 border-red-900/60",
    info: "bg-sky-950/60 text-sky-400 border-sky-900/60",
    purple: "bg-purple-950/60 text-purple-400 border-purple-900/60",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    custom: "",
  };

  return (
    <span
      className={`${variant === "custom" ? "" : baseStyle} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
