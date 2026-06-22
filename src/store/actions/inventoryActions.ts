import { StoreSet, StoreGet } from "../../types/game";

export const createInventoryActions = (set: StoreSet, get: StoreGet) => ({
  setTargetAmount: (itemId: string, count: number) => {
    set((state) => ({
      targetAmounts: {
        ...state.targetAmounts,
        [itemId]: Math.max(0, count),
      },
    }));
    get().dispatchIdleVillagers();
  },
});
