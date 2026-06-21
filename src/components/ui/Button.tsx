import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "success"
    | "warning"
    | "purple"
    | "ghost"
    | "custom";
  size?: "xs" | "sm" | "md" | "lg" | "custom";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  children,
  ...props
}) => {
  const baseStyle =
    "inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed select-none";

  const variantStyles: Record<string, string> = {
    primary: "bg-sky-600 hover:bg-sky-500 text-white disabled:bg-slate-800 disabled:text-slate-500",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-transparent",
    danger: "bg-red-600 hover:bg-red-500 text-white disabled:bg-slate-800 disabled:text-slate-500",
    success:
      "bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-800 disabled:text-slate-500",
    warning:
      "bg-amber-600 hover:bg-amber-500 text-white disabled:bg-slate-850 disabled:text-slate-600",
    purple:
      "bg-purple-600 hover:bg-purple-500 text-white disabled:bg-slate-800 disabled:text-slate-500",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200",
    custom: "",
  };

  const sizeStyles: Record<string, string> = {
    xs: "px-2 py-0.5 text-[10px] rounded",
    sm: "px-2.5 py-1 text-[10px] rounded-md",
    md: "px-4 py-2 text-xs rounded-lg",
    lg: "px-6 py-3 text-sm rounded-xl",
    custom: "",
  };

  const appliedClass = `${variant === "custom" ? "" : baseStyle} ${variant === "custom" ? "" : variantStyles[variant]} ${size === "custom" ? "" : sizeStyles[size]} ${className}`;

  return (
    <button className={appliedClass} disabled={disabled} {...props}>
      {children}
    </button>
  );
};
