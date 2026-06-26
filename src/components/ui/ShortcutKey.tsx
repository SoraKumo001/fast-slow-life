import React from "react";

interface ShortcutKeyProps {
  keys: string;
  label: string;
}

/**
 * A small kbd-style indicator followed by a description.
 * Used in the help modal to display keyboard shortcuts.
 */
export const ShortcutKey: React.FC<ShortcutKeyProps> = ({ keys, label }) => {
  const keyParts = keys.split(" / ");
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 shrink-0">
        {keyParts.map((k, i) => (
          <React.Fragment key={k}>
            {i > 0 && <span className="text-slate-600">/</span>}
            <kbd className="bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-200">
              {k}
            </kbd>
          </React.Fragment>
        ))}
      </span>
      <span className="text-slate-400">{label}</span>
    </div>
  );
};
