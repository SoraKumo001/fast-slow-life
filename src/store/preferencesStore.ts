import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * User preferences for the game UI.
 * Persisted to localStorage under the key "fsl-preferences".
 */

export type ToastDensity = "comfortable" | "compact";

export interface Preferences {
  /** Show toast notifications for new log entries. */
  toastEnabled: boolean;
  /** Toast visual density. */
  toastDensity: ToastDensity;
  /** Animation speed multiplier (1.0 = normal). */
  animationSpeed: number;
  /** Compact mode: tighter padding on lists. */
  denseMode: boolean;
  /** Maximum number of logs to keep in history. */
  maxLogHistory: number;
  /** Show the in-game help tooltip on first launch. */
  showOnboarding: boolean;
}

interface PreferencesState extends Preferences {
  setToastEnabled: (v: boolean) => void;
  setToastDensity: (v: ToastDensity) => void;
  setAnimationSpeed: (v: number) => void;
  setDenseMode: (v: boolean) => void;
  setMaxLogHistory: (v: number) => void;
  setShowOnboarding: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  toastEnabled: true,
  toastDensity: "comfortable",
  animationSpeed: 1.0,
  denseMode: false,
  maxLogHistory: 100,
  showOnboarding: true,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setToastEnabled: (toastEnabled) => set({ toastEnabled }),
      setToastDensity: (toastDensity) => set({ toastDensity }),
      setAnimationSpeed: (animationSpeed) =>
        set({ animationSpeed: Math.max(0.25, Math.min(4, animationSpeed)) }),
      setDenseMode: (denseMode) => set({ denseMode }),
      setMaxLogHistory: (maxLogHistory) =>
        set({ maxLogHistory: Math.max(10, Math.min(500, maxLogHistory)) }),
      setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "fsl-preferences",
      version: 1,
    },
  ),
);
