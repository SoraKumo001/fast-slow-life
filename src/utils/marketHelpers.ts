import { ItemCategory } from "../types/game";

export const getSlotsForLevel = (lvl: number): number => {
  if (lvl === 1) return 2;
  if (lvl === 2) return 4;
  if (lvl >= 3) return 8;
  return 0;
};

export const getMarketSellBonus = (level: number): number => {
  if (level <= 1) return 0.0;
  if (level === 2) return 0.1;
  return 0.2;
};

export const getSellBonus = (
  category: ItemCategory,
  facilities: {
    market: { level: number };
    weapon_shop?: { level: number };
  },
): number => {
  const marketLvl = facilities.market?.level || 0;
  const marketBonus = getMarketSellBonus(marketLvl);

  if (category === "gear_weapon" || category === "gear_armor") {
    const weaponShopLvl = facilities.weapon_shop?.level || 0;
    if (weaponShopLvl > 0) {
      const weaponShopBonus = weaponShopLvl * 0.2;
      return Math.max(marketBonus, weaponShopBonus);
    }
  }

  return marketBonus;
};
