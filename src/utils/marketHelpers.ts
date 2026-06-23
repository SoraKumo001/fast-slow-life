import { ItemCategory } from "../types/game";

export const getSlotsForLevel = (lvl: number): number => {
  if (lvl === 1) return 2;
  if (lvl === 2) return 4;
  if (lvl >= 3) return 8;
  return 0;
};

export const getMarketSellBonus = (level: number): number => {
  if (level === 1) return 0.1;
  if (level === 2) return 0.2;
  return 0.3;
};

export const getSellBonus = (
  _category: ItemCategory,
  facilities: {
    market: { level: number };
  },
): number => {
  const marketLvl = facilities.market?.level || 0;
  return getMarketSellBonus(marketLvl);
};
