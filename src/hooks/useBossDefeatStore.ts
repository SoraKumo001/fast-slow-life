import { create } from "zustand";

export interface BossDefeatInfo {
  bossName: string;
  tier: number;
  gameLimitDays: number;
}

interface BossDefeatState {
  info: BossDefeatInfo | null;
  announce: (info: BossDefeatInfo) => void;
  clear: () => void;
}

export const useBossDefeatStore = create<BossDefeatState>((set) => ({
  info: null,
  announce: (info) => {
    set({ info });
    setTimeout(() => {
      set({ info: null });
    }, 4000);
  },
  clear: () => set({ info: null }),
}));
