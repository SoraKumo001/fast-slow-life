import { Heart, Zap } from "lucide-react";
import React from "react";

import { ITEMS } from "../../data/masterData";
import { Villager } from "../../types/game";
import { ProgressBar } from "../ui/ProgressBar";
import { Tooltip } from "../ui/Tooltip";

const computeEffectiveAtk = (v: Villager): number => {
  const weaponAtk = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0;
  const weaponInt = v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0;
  const physical = Math.floor(v.str * 1.5 + weaponAtk);
  const magical = Math.floor(v.int * 1.8 + weaponInt);
  return Math.max(physical, magical);
};

const computeEffectiveDef = (v: Villager): number => {
  const armorDef = v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0;
  return Math.floor(v.vit + armorDef);
};

interface VillagerStatsProps {
  villager: Villager;
}

export const VillagerStats: React.FC<VillagerStatsProps> = ({ villager: v }) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <Heart className="w-3.5 h-3.5 text-red-500" /> HP
        </span>
        <span className="text-slate-200">
          {v.currentHp} / {v.maxHp}
        </span>
      </div>
      <ProgressBar value={v.currentHp} max={v.maxHp} height={1} color="red" />
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> スタミナ
        </span>
        <span className="text-slate-200">
          {v.stamina} / {v.maxStamina || 100}
        </span>
      </div>
      <ProgressBar value={v.stamina} max={v.maxStamina || 100} height={1} color="amber" />
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="space-y-1 text-[11px] font-mono text-slate-400">
          <p>
            <Tooltip
              content={`攻撃力: ${computeEffectiveAtk(v)} (STR ${v.str + (v.bonusStr || 0)}×1.5 + 武器ATK ${v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.attack || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">STR</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.str}</span>
            {(v.bonusStr || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusStr}</span>
            )}
          </p>
          <p>
            <Tooltip
              content={`魔法攻撃力: ${Math.floor(v.int * 1.8 + (v.weaponId !== "none" ? ITEMS[v.weaponId]?.equipment?.bonuses?.int || 0 : 0))} (INT ${v.int + (v.bonusInt || 0)}×1.8 + 武器INT)`}
            >
              <span className="border-b border-dotted border-slate-600">INT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.int}</span>
            {(v.bonusInt || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusInt}</span>
            )}
          </p>
          <p>
            DEX: <span className="text-slate-200 font-bold">{v.dex}</span>
            {(v.bonusDex || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusDex}</span>
            )}
          </p>
          <p>
            AGI: <span className="text-slate-200 font-bold">{v.agi}</span>
            {(v.bonusAgi || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusAgi}</span>
            )}
          </p>
          <p>
            <Tooltip
              content={`防御力: ${computeEffectiveDef(v)} (VIT ${v.vit + (v.bonusVit || 0)} + 防具DEF ${v.armorId !== "none" ? ITEMS[v.armorId]?.equipment?.bonuses?.defense || 0 : 0})`}
            >
              <span className="border-b border-dotted border-slate-600">VIT</span>
            </Tooltip>
            : <span className="text-slate-200 font-bold">{v.vit}</span>
            {(v.bonusVit || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] ml-1">+{v.bonusVit}</span>
            )}
          </p>
          <p className="pt-1 text-[10px] text-slate-500">
            ATK {computeEffectiveAtk(v)} / DEF {computeEffectiveDef(v)}
          </p>
        </div>
      </div>
    </div>
  );
};
