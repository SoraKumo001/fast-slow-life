import React from "react";

interface SortOption {
  value: string;
  label: string;
}

interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  className?: string;
}

export const SortSelect: React.FC<SortSelectProps> = ({
  value,
  onChange,
  options,
  className = "",
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-medium cursor-pointer shrink-0 mb-3 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
