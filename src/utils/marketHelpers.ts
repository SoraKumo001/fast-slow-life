export const getMarketSellBonus = (level: number): number => {
  if (level <= 1) return 0.0;
  if (level === 2) return 0.1;
  return 0.2;
};
