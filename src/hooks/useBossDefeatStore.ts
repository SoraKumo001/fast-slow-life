import { create } from "zustand";

/**
 * Boss battle result information displayed in the announcement banner.
 * - victory: プレイヤーがボスを倒した
 * - defeat: プレイヤーのアタッカーが全滅した
 */
export type BossBattleResultType = "victory" | "defeat";

export interface BossBattleResult {
  type: BossBattleResultType;
  bossName: string;
  tier: number;
}

interface BossBattleResultState {
  result: BossBattleResult | null;
  announce: (result: BossBattleResult) => void;
  clear: () => void;
}

export const useBossDefeatStore = create<BossBattleResultState>((set) => ({
  result: null,
  announce: (result) => {
    set({ result });
  },
  clear: () => set({ result: null }),
}));
