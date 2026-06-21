import { ITEMS } from "../../data/masterData";
import { GameState, GameActions, Item, Villager, TradeRule } from "../../types/game";
import { generateId } from "../../utils/craftHelpers";
import { getMarketSellBonus } from "../../utils/marketHelpers";

// ヘルパー関数: 魔法職かどうか
const isMagicJob = (job: string): boolean => {
  return ["魔術師", "僧侶", "薬師"].includes(job);
};

// ヘルパー関数: 武器の評価スコア
const getWeaponScore = (item: Item, v: Villager): number => {
  if (!item.equipment || item.equipment.slot !== "weapon") return -1;
  const bonuses = item.equipment.bonuses || {};

  const isMagic = isMagicJob(v.currentJob);
  const hasIntVal = (bonuses.int || 0) > 0;

  if (isMagic) {
    const penalty = hasIntVal ? 0 : -1000;
    const intVal = bonuses.int || 0;
    const atkVal = bonuses.attack || 0;
    return intVal * 100 + atkVal + penalty;
  } else {
    const penalty = hasIntVal ? -1000 : 0;
    const atkVal = bonuses.attack || 0;
    const strVal = bonuses.str || 0;
    const agiVal = bonuses.agi || 0;
    const dexVal = bonuses.dex || 0;
    return atkVal * 100 + strVal * 10 + agiVal * 5 + dexVal + penalty;
  }
};

// ヘルパー関数: 防具の評価スコア
const getArmorScore = (item: Item, v: Villager): number => {
  if (!item.equipment || item.equipment.slot !== "armor") return -1;
  const bonuses = item.equipment.bonuses || {};

  const defVal = bonuses.defense || 0;
  const isMagic = isMagicJob(v.currentJob);
  const hasIntVal = (bonuses.int || 0) > 0;

  if (isMagic) {
    const penalty = hasIntVal ? 0 : -100;
    const intVal = bonuses.int || 0;
    const vitVal = bonuses.vit || 0;
    return defVal * 10 + intVal * 5 + vitVal * 2 + penalty;
  } else {
    const penalty = hasIntVal ? -500 : 0;
    const vitVal = bonuses.vit || 0;
    const strVal = bonuses.str || 0;
    const agiVal = bonuses.agi || 0;
    return defVal * 10 + vitVal * 5 + strVal * 2 + agiVal + penalty;
  }
};

type StoreSet = (
  partial:
    | Partial<GameState & GameActions>
    | ((state: GameState & GameActions) => Partial<GameState & GameActions>),
) => void;
type StoreGet = () => GameState & GameActions;

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

  sellItem: (itemId: string, count: number) => {
    const state = get();
    const marketLvl = state.facilities.market.level;
    if (marketLvl === 0) {
      state.addLog("交易所が建設されていないため売却できません。", "warning");
      return;
    }
    const currentCount = state.inventory[itemId] || 0;
    const toSell = Math.min(currentCount, count);
    if (toSell <= 0) return;

    const bonusRate = getMarketSellBonus(marketLvl);
    const basePrice = (ITEMS[itemId]?.sellPrice || 0) * toSell;
    const price = Math.floor(basePrice * (1 + bonusRate));

    set((state) => ({
      inventory: { ...state.inventory, [itemId]: currentCount - toSell },
      gold: state.gold + price,
    }));

    const bonusText = bonusRate > 0 ? ` (ボーナス +${Math.round(bonusRate * 100)}% 適用)` : "";
    state.addLog(
      `${ITEMS[itemId].name} を ${toSell} 個売却し、${price} G 獲得しました。${bonusText}`,
      "info",
    );
  },

  equipItem: (villagerId: string, itemId: string, slot: "weapon" | "armor") => {
    const state = get();
    const item = ITEMS[itemId];
    if (!item?.equipment || item.equipment.slot !== slot) return;

    const currentCount = state.inventory[itemId] || 0;
    if (currentCount <= 0) return;

    set((state) => {
      const inv = { ...state.inventory };
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;

        const oldEquipId = slot === "weapon" ? v.weaponId : v.armorId;
        if (oldEquipId && oldEquipId !== "none") {
          inv[oldEquipId] = (inv[oldEquipId] || 0) + 1;
        }

        inv[itemId] = Math.max(0, currentCount - 1);

        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: itemId,
        };
      });

      return { villagers: updated, inventory: inv };
    });

    const vName = get().villagers.find((v) => v.id === villagerId)?.name;
    state.addLog(`${vName} に ${ITEMS[itemId].name} を装備しました。`, "info");
  },

  unequipItem: (villagerId: string, slot: "weapon" | "armor") => {
    const state = get();
    const villager = state.villagers.find((v) => v.id === villagerId);
    if (!villager) return;

    const itemId = slot === "weapon" ? villager.weaponId : villager.armorId;
    if (!itemId || itemId === "none") return;

    set((state) => {
      const updated = state.villagers.map((v) => {
        if (v.id !== villagerId) return v;
        return {
          ...v,
          [slot === "weapon" ? "weaponId" : "armorId"]: "none",
        };
      });
      const inv = { ...state.inventory };
      inv[itemId] = (inv[itemId] || 0) + 1;

      return { villagers: updated, inventory: inv };
    });

    state.addLog(`${villager.name} の装備を外しました。`, "info");
  },

  autoEquipAll: () => {
    const state = get();
    const villagers = [...state.villagers];
    const inventory = { ...state.inventory };

    // 1. 全ての現在装備品と倉庫内の装備品をプールする
    const weaponPool: { [itemId: string]: number } = {};
    const armorPool: { [itemId: string]: number } = {};

    // 倉庫から追加
    Object.entries(inventory).forEach(([itemId, count]) => {
      const item = ITEMS[itemId];
      if (!item || !item.equipment || count <= 0) return;
      if (item.equipment.slot === "weapon") {
        weaponPool[itemId] = (weaponPool[itemId] || 0) + count;
      } else if (item.equipment.slot === "armor") {
        armorPool[itemId] = (armorPool[itemId] || 0) + count;
      }
    });

    // 村人から追加（一旦全員丸裸にする）
    villagers.forEach((v) => {
      if (v.weaponId && v.weaponId !== "none") {
        weaponPool[v.weaponId] = (weaponPool[v.weaponId] || 0) + 1;
      }
      if (v.armorId && v.armorId !== "none") {
        armorPool[v.armorId] = (armorPool[v.armorId] || 0) + 1;
      }
    });

    // 2. 村人のアサイン優先度を決定する
    const getJobPriority = (job: string) => {
      if (["戦士", "魔術師", "僧侶"].includes(job)) return 3;
      if (["猟師"].includes(job)) return 2;
      if (job !== "無職") return 1;
      return 0;
    };

    const getStatusPriority = (status: string, order: string) => {
      if (status === "active" && order !== "rest") return 2;
      if (status === "idle") return 1;
      return 0;
    };

    // villagers を直接書き換えるため、インデックスでアクセスできるように準備
    const sortedVillagerIndices = villagers
      .map((v, index) => ({ v, index }))
      .sort((a, b) => {
        // 状態優先度
        const statusDiff =
          getStatusPriority(b.v.status, b.v.order) - getStatusPriority(a.v.status, a.v.order);
        if (statusDiff !== 0) return statusDiff;

        // 職業優先度
        const jobDiff = getJobPriority(b.v.currentJob) - getJobPriority(a.v.currentJob);
        if (jobDiff !== 0) return jobDiff;

        // レベル
        return b.v.level - a.v.level;
      });

    // 3. 優先度の高い村人から最適な装備をアサインしていく
    const logs: string[] = [];

    sortedVillagerIndices.forEach(({ v, index }) => {
      // 武器のアサイン
      let bestWeaponId = "none";
      let bestWeaponScore = -1;

      Object.entries(weaponPool).forEach(([itemId, count]) => {
        if (count <= 0) return;
        const item = ITEMS[itemId];
        const score = getWeaponScore(item, v);
        if (score > bestWeaponScore) {
          bestWeaponScore = score;
          bestWeaponId = itemId;
        }
      });

      // アサインされた武器をプールから引く
      if (bestWeaponId !== "none") {
        weaponPool[bestWeaponId]--;
      }

      // 防具のアサイン
      let bestArmorId = "none";
      let bestArmorScore = -1;

      Object.entries(armorPool).forEach(([itemId, count]) => {
        if (count <= 0) return;
        const item = ITEMS[itemId];
        const score = getArmorScore(item, v);
        if (score > bestArmorScore) {
          bestArmorScore = score;
          bestArmorId = itemId;
        }
      });

      // アサインされた防具をプールから引く
      if (bestArmorId !== "none") {
        armorPool[bestArmorId]--;
      }

      // 村人の状態を更新
      const originalWeapon = v.weaponId;
      const originalArmor = v.armorId;

      villagers[index] = {
        ...v,
        weaponId: bestWeaponId,
        armorId: bestArmorId,
      };

      if (originalWeapon !== bestWeaponId) {
        const oldName = originalWeapon !== "none" ? ITEMS[originalWeapon].name : "素手";
        const newName = bestWeaponId !== "none" ? ITEMS[bestWeaponId].name : "素手";
        logs.push(`${v.name} の武器を ${oldName} → ${newName} に自動変更しました。`);
      }
      if (originalArmor !== bestArmorId) {
        const oldName = originalArmor !== "none" ? ITEMS[originalArmor].name : "防具なし";
        const newName = bestArmorId !== "none" ? ITEMS[bestArmorId].name : "防具なし";
        logs.push(`${v.name} の防具を ${oldName} → ${newName} に自動変更しました。`);
      }
    });

    // 4. 残った装備品を倉庫（inventory）に戻す
    // まず、倉庫にある全ての装備（weapon, armor）のカウントをリセット
    Object.keys(inventory).forEach((itemId) => {
      const item = ITEMS[itemId];
      if (item && item.equipment) {
        inventory[itemId] = 0;
      }
    });

    // プールに残っている数を倉庫に戻す
    Object.entries(weaponPool).forEach(([itemId, count]) => {
      if (count > 0) inventory[itemId] = count;
    });
    Object.entries(armorPool).forEach(([itemId, count]) => {
      if (count > 0) inventory[itemId] = count;
    });

    // 状態更新
    set({
      villagers,
      inventory,
    });

    // 変更ログを追加
    logs.forEach((log) => state.addLog(log, "info"));
  },

  addTradeRule: (itemId: string, type: "buy" | "sell", threshold: number, amount: number) => {
    const state = get();
    const marketLvl = state.facilities.market.level;
    if (marketLvl === 0) {
      state.addLog("交易所が建設されていないため、自動取引を設定できません。", "warning");
      return;
    }

    const maxSlots = marketLvl === 1 ? 2 : marketLvl === 2 ? 4 : marketLvl >= 3 ? 8 : 0;
    if (state.tradeRules.length >= maxSlots) {
      state.addLog(`自動取引の設定枠（最大 ${maxSlots} 枠）が上限に達しています。`, "warning");
      return;
    }

    const newRule = {
      id: generateId(),
      itemId,
      type,
      threshold,
      amount,
      isEnabled: true,
    };

    set((state) => ({
      tradeRules: [...state.tradeRules, newRule],
    }));

    state.addLog(`自動取引ルール（${ITEMS[itemId]?.name || itemId}）を追加しました。`, "info");
  },

  updateTradeRule: (ruleId: string, updates: Partial<Omit<TradeRule, "id" | "itemId">>) => {
    set((state) => ({
      tradeRules: state.tradeRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          ...updates,
        };
      }),
    }));
  },

  deleteTradeRule: (ruleId: string) => {
    const state = get();
    const rule = state.tradeRules.find((r) => r.id === ruleId);
    set((state) => ({
      tradeRules: state.tradeRules.filter((r) => r.id !== ruleId),
    }));
    if (rule) {
      const itemName = ITEMS[rule.itemId]?.name || rule.itemId;
      state.addLog(`自動取引ルール（${itemName}）を削除しました。`, "info");
    }
  },

  toggleTradeRule: (ruleId: string) => {
    set((state) => ({
      tradeRules: state.tradeRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          isEnabled: !rule.isEnabled,
        };
      }),
    }));
  },
});
