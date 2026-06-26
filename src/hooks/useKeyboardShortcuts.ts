import { useEffect } from "react";

import { useGameControls } from "./index";

export type PlaySpeed = "normal" | "fast" | "super";

export interface KeyboardShortcutConfig {
  onTogglePause: () => void;
  onSetSpeed: (speed: PlaySpeed) => void;
  onAdvanceDay: () => void;
  onOpenHelp: () => void;
  onOpenResult: () => void;
  onOpenLogHistory: () => void;
  isPaused: boolean;
  gameOver: boolean;
}

/**
 * Global keyboard shortcuts.
 *
 * Basic 4: Space (pause), 1/2/3 (speed), ? (help)
 * Applied 3: D (+24h when paused), R (result), L (log history)
 *
 * Shortcuts are ignored when:
 * - Ctrl / Meta / Alt is held (to avoid hijacking browser shortcuts)
 * - Focus is in input / textarea / select / contenteditable
 * - Game is over
 */
export const useKeyboardShortcuts = (config: KeyboardShortcutConfig) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if modifier pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Skip if focus is in editable element
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }

      // Space - pause / resume (works even when game over so player can examine state)
      if (e.key === " " || e.code === "Space") {
        if (config.gameOver) return;
        e.preventDefault();
        config.onTogglePause();
        return;
      }

      // ? - help (works always, even when game over)
      if (e.key === "?") {
        e.preventDefault();
        config.onOpenHelp();
        return;
      }

      // All other shortcuts are blocked when game over
      if (config.gameOver) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          config.onSetSpeed("normal");
          break;
        case "2":
          e.preventDefault();
          config.onSetSpeed("fast");
          break;
        case "3":
          e.preventDefault();
          config.onSetSpeed("super");
          break;
        case "d":
        case "D":
          if (config.isPaused) {
            e.preventDefault();
            config.onAdvanceDay();
          }
          break;
        case "r":
        case "R":
          e.preventDefault();
          config.onOpenResult();
          break;
        case "l":
        case "L":
          e.preventDefault();
          config.onOpenLogHistory();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [config]);
};

/**
 * Convenience hook: wires the keyboard shortcuts directly to game controls.
 * Caller still needs to provide modal openers.
 */
export const useGameKeyboardShortcuts = (opts: {
  onOpenHelp: () => void;
  onOpenResult: () => void;
  onOpenLogHistory: () => void;
  isPaused: boolean;
  gameOver: boolean;
}) => {
  const { togglePause, setPlaySpeed, advanceDay } = useGameControls();

  useKeyboardShortcuts({
    onTogglePause: togglePause,
    onSetSpeed: setPlaySpeed,
    onAdvanceDay: advanceDay,
    onOpenHelp: opts.onOpenHelp,
    onOpenResult: opts.onOpenResult,
    onOpenLogHistory: opts.onOpenLogHistory,
    isPaused: opts.isPaused,
    gameOver: opts.gameOver,
  });
};
