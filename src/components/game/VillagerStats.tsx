import { Heart, Zap } from "lucide-react";
import React from "react";

import { ITEMS } from "../../data/masterData";
import { getFoodBuffBonus } from "../../store/combatEngine";
import { Villager } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";
import { Tooltip } from "../ui/Tooltip";

const computeEffectiveAtk = (v: Villager, buffStr: number, buffInt: number): number => {
  const weaponAtk = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0;
  const weaponInt = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0;
  const physical = Math.floor((v.str + buffStr) * 1.5 + weaponAtk);
  const magical = Math.floor((v.int + buffInt) * 1.8 + weaponInt);
  return Math.max(physical, magical);
};

const computeEffectiveDef = (v: Villager, buffVit: number): number => {
  const armorDef = v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0;
  return Math.floor(v.vit + buffVit + armorDef);
};

interface VillagerStatsProps {
  villager: Villager;
}

export const VillagerStats: React.FC<VillagerStatsProps> = ({ villager: v }) => {
  const buffStr = getFoodBuffBonus(v.activeFoodBuffId || null, "str");
  const buffInt = getFoodBuffBonus(v.activeFoodBuffId || null, "int");
  const buffDex = getFoodBuffBonus(v.activeFoodBuffId || null, "dex");
  const buffAgi = getFoodBuffBonus(v.activeFoodBuffId || null, "agi");
  const buffVit = getFoodBuffBonus(v.activeFoodBuffId || null, "vit");
  const buffMaxHp = getFoodBuffBonus(v.activeFoodBuffId || null, "maxHp");
  const buffMaxStamina = getFoodBuffBonus(v.activeFoodBuffId || null, "maxStamina");

  const effectiveMaxHp = v.maxHp + buffMaxHp;
  const effectiveMaxStamina = (v.maxStamina || 100) + buffMaxStamina;

  const activeBuffItem = v.activeFoodBuffId ? ITEMS[v.activeFoodBuffId] : null;

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
              content={`攻撃力: ${computeEffectiveAtk(v, buffStr, buffInt)} (STR ${v.str + (v.bonusStr || 0) + buffStr}×1.5 + 武器ATK ${v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">STR</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.str}</span>
            {(v.bonusStr || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusStr}</span>
            )}
            {buffStr > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffStr}</span>}
          </p>
          <p>
            <Tooltip
              content={`魔法攻撃力: ${Math.floor((v.int + buffInt) * 1.8 + (v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0))} (INT ${v.int + (v.bonusInt || 0) + buffInt}×1.8 + 武器INT)`}
            >
              <span className="border-b border-dotted border-slate-600">INT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.int}</span>
            {(v.bonusInt || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusInt}</span>
            )}
            {buffInt > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffInt}</span>}
          </p>
          <p>
            DEX: <span className="text-slate-200 font-bold">{v.dex}</span>
            {(v.bonusDex || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusDex}</span>
            )}
            {buffDex > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffDex}</span>}
          </p>
          <p>
            AGI: <span className="text-slate-200 font-bold">{v.agi}</span>
            {(v.bonusAgi || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusAgi}</span>
            )}
            {buffAgi > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffAgi}</span>}
          </p>
          <p>
            <Tooltip
              content={`防御力: ${computeEffectiveDef(v, buffVit)} (VIT ${v.vit + (v.bonusVit || 0) + buffVit} + 防具DEF ${v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">VIT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.vit}</span>
            {(v.bonusVit || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusVit}</span>
            )}
            {buffVit > 0 && <span className="text-emerald-400 text-[10px] ml-1">+{buffVit}</span>}
          </p>
          <p className="pt-1 text-[10px] text-slate-500 font-sans">
            ATK {computeEffectiveAtk(v, buffStr, buffInt)} / DEF {computeEffectiveDef(v, buffVit)}
          </p>
        </div>
      </div>
    </div>
  );
};
