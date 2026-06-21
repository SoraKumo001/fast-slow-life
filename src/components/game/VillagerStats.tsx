import { Heart, Zap } from "lucide-react";
import React from "react";

import { ITEMS } from "../../data/masterData";
import { getFoodBuffBonus, applySalaryDebuff } from "../../store/combatEngine";
import { useGameStore } from "../../store/gameStore";
import { Villager } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";
import { Tooltip } from "../ui/Tooltip";

const computeEffectiveAtk = (v: Villager, buffStr: number, buffInt: number): number => {
  const isSalaryUnpaid = v.gold < 0;
  const weaponAtk = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0;
  const weaponInt = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0;
  const rawStr = v.str + buffStr;
  const rawInt = v.int + buffInt;
  const effectiveStr = applySalaryDebuff(rawStr, isSalaryUnpaid);
  const effectiveInt = applySalaryDebuff(rawInt, isSalaryUnpaid);
  const physical = Math.floor(effectiveStr * 1.5 + weaponAtk);
  const magical = Math.floor(effectiveInt * 1.8 + weaponInt);
  return Math.max(physical, magical);
};

const computeEffectiveDef = (v: Villager, buffVit: number): number => {
  const isSalaryUnpaid = v.gold < 0;
  const armorDef = v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0;
  const rawVit = v.vit + buffVit;
  const effectiveVit = applySalaryDebuff(rawVit, isSalaryUnpaid);
  return Math.floor(effectiveVit + armorDef);
};

interface VillagerStatsProps {
  villager: Villager;
}

export const VillagerStats: React.FC<VillagerStatsProps> = ({ villager: v }) => {
  const isSalaryUnpaid = v.gold < 0;

  const buffStr = getFoodBuffBonus(v.activeFoodBuffId || null, "str");
  const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
  const buffDex = getFoodBuffBonus(v.activeFoodBuffId || null, "dex");
  const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
  const buffVit = getFoodBuffBonus(v.activeFoodBuffId || null, "vit");
  const buffMaxHp = getFoodBuffBonus(v.activeFoodBuffId || null, "maxHp");
  const buffMaxStamina = getFoodBuffBonus(v.activeFoodBuffId || null, "maxStamina");

  const getDebuffValue = (val: number) => {
    if (!isSalaryUnpaid) return 0;
    return val - applySalaryDebuff(val, true);
  };

  const debuffStr = getDebuffValue(v.str + buffStr);
  const debuffInt = getDebuffValue(v.int + buffInt);
  const debuffDex = getDebuffValue(v.dex + buffDex);
  const debuffAgi = getDebuffValue(v.agi + buffAgi);
  const debuffVit = getDebuffValue(v.vit + buffVit);
  const debuffMaxHp = getDebuffValue(v.maxHp + buffMaxHp);

  const effectiveMaxHp = v.maxHp + buffMaxHp - debuffMaxHp;
  const effectiveMaxStamina = (v.maxStamina || 100) + buffMaxStamina;

  const activeBuffItem = v.activeFoodBuffId ? ITEMS[v.activeFoodBuffId] : null;

  const facilities = useGameStore((s) => s.facilities);
  const innLvl = facilities.inn?.level || 1;

  const poolTotalValue = Object.entries(v.pool || {}).reduce((sum, [itemId, count]) => {
    const price = ITEMS[itemId]?.sellPrice || 0;
    return sum + price * count;
  }, 0);

  let dailyFoodCost = 0;
  if (v.currentJob !== "無職") {
    if (v.activeFoodBuffId) {
      dailyFoodCost = ITEMS[v.activeFoodBuffId]?.sellPrice || 2;
    } else {
      dailyFoodCost = 2;
    }
  }

  const hourlyInnCost = v.currentJob === "無職" ? 0 : 1 + innLvl;

  return (
    <div className="space-y-1.5">
      {activeBuffItem && (
        <div className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 rounded px-1.5 py-0.5 mb-1 flex items-center justify-between">
          <span className="font-semibold">配給効果: {activeBuffItem.name}</span>
          <span className="text-[9px] opacity-80 font-mono">1h持続</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <Heart className="w-3.5 h-3.5 text-red-500" /> HP
        </span>
        <span className="text-slate-200">
          {v.currentHp} / {effectiveMaxHp}
          {buffMaxHp > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffMaxHp}</span>}
          {debuffMaxHp > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffMaxHp}</span>}
        </span>
      </div>
      <ProgressBar value={v.currentHp} max={effectiveMaxHp} height={1} color="red" />
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> スタミナ
        </span>
        <span className="text-slate-200">
          {v.stamina} / {effectiveMaxStamina}
          {buffMaxStamina > 0 && (
            <span className="text-emerald-400 text-[10px] ml-1">+{buffMaxStamina}</span>
          )}
        </span>
      </div>
      <ProgressBar value={v.stamina} max={effectiveMaxStamina} height={1} color="amber" />
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="space-y-1 text-[11px] font-mono text-slate-400">
          <p>
            <Tooltip
              content={`攻撃力: ${computeEffectiveAtk(v, buffStr, buffInt)} (STR ${v.str + (v.bonusStr || 0) + buffStr - debuffStr}×1.5 + 武器ATK ${v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">STR</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.str}</span>
            {(v.bonusStr || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusStr}</span>
            )}
            {buffStr > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffStr}</span>}
            {debuffStr > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffStr}</span>}
          </p>
          <p>
            <Tooltip
              content={`魔法攻撃力: ${Math.floor((v.int + buffInt - debuffInt) * 1.8 + (v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0))} (INT ${v.int + (v.bonusInt || 0) + buffInt - debuffInt}×1.8 + 武器INT)`}
            >
              <span className="border-b border-dotted border-slate-600">INT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.int}</span>
            {(v.bonusInt || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusInt}</span>
            )}
            {buffInt > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffInt}</span>}
            {debuffInt > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffInt}</span>}
          </p>
          <p>
            DEX: <span className="text-slate-200 font-bold">{v.dex}</span>
            {(v.bonusDex || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusDex}</span>
            )}
            {buffDex > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffDex}</span>}
            {debuffDex > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffDex}</span>}
          </p>
          <p>
            AGI: <span className="text-slate-200 font-bold">{v.agi}</span>
            {(v.bonusAgi || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusAgi}</span>
            )}
            {buffAgi > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffAgi}</span>}
            {debuffAgi > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffAgi}</span>}
          </p>
          <p>
            <Tooltip
              content={`防御力: ${computeEffectiveDef(v, buffVit)} (VIT ${v.vit + (v.bonusVit || 0) + buffVit - debuffVit} + 防具DEF ${v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">VIT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.vit}</span>
            {(v.bonusVit || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusVit}</span>
            )}
            {buffVit > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffVit}</span>}
            {debuffVit > 0 && <span className="text-red-400 text-[10px] ml-1">-{debuffVit}</span>}
          </p>
          <p className="pt-1 text-[10px] text-slate-500 font-sans">
            ATK {computeEffectiveAtk(v, buffStr, buffInt)} / DEF {computeEffectiveDef(v, buffVit)}
          </p>
        </div>
      </div>

      {/* 経済ステータス / 家計簿 */}
      <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">
          家計・収支情報
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-slate-900/60 border border-slate-850 p-2 rounded space-y-1 flex flex-col justify-between">
            <div>
              <div className="text-[9px] text-slate-500 font-sans font-semibold mb-0.5">
                資産状況
              </div>
              <p className="flex justify-between">
                <span className="text-slate-400">所持金:</span>
                <span className="text-amber-400 font-bold">{Math.max(0, v.gold)} G</span>
              </p>
              {v.gold < 0 && (
                <p className="flex justify-between">
                  <span className="text-red-400">ツケ(宿・食):</span>
                  <span className="text-red-400 font-bold">{-v.gold} G</span>
                </p>
              )}
            </div>
            <p className="flex justify-between border-t border-slate-800/40 pt-1 mt-1">
              <span className="text-slate-400">未払買取(プール):</span>
              <span className="text-sky-400 font-bold">{poolTotalValue} G</span>
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-850 p-2 rounded space-y-1">
            <div className="text-[9px] text-slate-500 font-sans font-semibold mb-0.5">
              見込み支出
            </div>
            <p className="flex justify-between">
              <span className="text-slate-400">日々の食費:</span>
              <span className="text-slate-200 font-bold">
                {v.currentJob === "無職" ? "無料" : `${dailyFoodCost} G/日`}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-400">宿泊費(休息時):</span>
              <span className="text-slate-200 font-bold">
                {v.currentJob === "無職" ? "無料" : `${hourlyInnCost} G/h`}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
