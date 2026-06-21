import { ItemCategory } from "../types/game";

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
    pharmacy?: { level: number };
  },
): number => {
  const marketLvl = facilities.market?.level || 0;
  const marketBonus = getMarketSellBonus(marketLvl);

  if (category === "gear_weapon" || category === "gear_armor") {
    const weaponShopLvl = facilities.weapon_shop?.level || 0;
    if (weaponShopLvl > 0) {
      // 武器屋ボーナス: 1レベルにつき+20%
      const weaponShopBonus = weaponShopLvl * 0.2;
      return Math.max(marketBonus, weaponShopBonus);
    }
  }

  if (category === "consumable") {
    const pharmacyLvl = facilities.pharmacy?.level || 0;
    if (pharmacyLvl > 0) {
      // 薬屋ボーナス: 1レベルにつき+20%
      const pharmacyBonus = pharmacyLvl * 0.2;
      return Math.max(marketBonus, pharmacyBonus);
    }
  }

  return marketBonus;
};
