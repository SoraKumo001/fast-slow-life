using Godot;
using System;
using System.Collections.Generic;

public partial class Villager : Resource
{
    [Export] public string Name { get; set; } = "村人";
    [Export] public int Level { get; set; } = 1;
    [Export] public int Exp { get; set; } = 0;
    [Export] public string CurrentJob { get; set; } = "unemployed";
    [Export] public Godot.Collections.Array<string> JobHistory { get; set; } = new() { "unemployed" };

    // 基本能力値 (成長するベース値)
    [Export] public int BaseMaxHp { get; set; } = 80;
    [Export] public int CurrentHp { get; set; } = 80;
    [Export] public int BaseStr { get; set; } = 8;
    [Export] public int BaseInt { get; set; } = 8;
    [Export] public int BaseDex { get; set; } = 8;
    [Export] public int BaseAgi { get; set; } = 8;
    [Export] public int BaseVit { get; set; } = 8;

    // 装備
    [Export] public string WeaponId { get; set; } = "";
    [Export] public string ArmorId { get; set; } = "";

    // 元の活動を記録する変数 (休息完了後の自動復帰用)
    [Export] public string LastActiveOrder { get; set; } = "gather";
    [Export] public string LastActiveArea { get; set; } = "forest";

    private string _order = "gather";
    [Export] public string Order
    {
        get => _order;
        set
        {
            if (value == "inn" && _order != "inn")
            {
                LastActiveOrder = _order;
                LastActiveArea = AssignedArea;
            }
            _order = value;
        }
    }

    [Export] public string AssignedArea { get; set; } = "forest";

    // スタミナと移動状態
    [Export] public int CurrentStamina { get; set; } = 100;
    [Export] public int BaseMaxStamina { get; set; } = 100;
    [Export] public int TravelTime { get; set; } = 0;
    [Export] public bool IsReturning { get; set; } = false;

    // 状態
    [Export] public bool IsDead { get; set; } = false;

    // 最終ステータスの取得（職業倍率と装備補正の適用）
    public int GetStr()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double mod = job != null ? job.StrMod : 1.0;
        int equipBonus = GetEquipBonus("str");
        return (int)(BaseStr * mod) + equipBonus;
    }

    public int GetInt()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double mod = job != null ? job.IntMod : 1.0;
        int equipBonus = GetEquipBonus("int");
        return (int)(BaseInt * mod) + equipBonus;
    }

    public int GetDex()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double mod = job != null ? job.DexMod : 1.0;
        int equipBonus = GetEquipBonus("dex");
        return (int)(BaseDex * mod) + equipBonus;
    }

    public int GetAgi()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double mod = job != null ? job.AgiMod : 1.0;
        int equipBonus = GetEquipBonus("agi");
        return (int)(BaseAgi * mod) + equipBonus;
    }

    public int GetVit()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double mod = job != null ? job.VitMod : 1.0;
        int equipBonus = GetEquipBonus("vit");
        return (int)(BaseVit * mod) + equipBonus;
    }

    public int GetMaxHp()
    {
        int equipBonus = GetEquipBonus("vit") * 5; // VIT補正分HP追加
        return BaseMaxHp + equipBonus;
    }

    // 装備品からのパラメータ補正取得
    private int GetEquipBonus(string statName)
    {
        int bonus = 0;
        if (!string.IsNullOrEmpty(WeaponId) && Database.Instance.Items.TryGetValue(WeaponId, out var weapon))
        {
            if (weapon.EffectData.TryGetValue(statName, out var val))
            {
                bonus += val;
            }
        }
        if (!string.IsNullOrEmpty(ArmorId) && Database.Instance.Items.TryGetValue(ArmorId, out var armor))
        {
            if (armor.EffectData.TryGetValue(statName, out var val))
            {
                bonus += val;
            }
        }
        return bonus;
    }

    // 経験値獲得とレベルアップ
    public string AddExp(int amount)
    {
        if (IsDead) return "";
        Exp += amount;
        int required = GetRequiredExp();
        string logMsg = "";
        while (Exp >= required)
        {
            Exp -= required;
            Level += 1;
            LevelUpStats();
            logMsg += $"\n[LV UP] {Name} がレベル {Level} に上がった！";
            required = GetRequiredExp();
        }
        return logMsg;
    }

    public int GetRequiredExp()
    {
        return Level * 50 + 50;
    }

    // レベルアップ時の能力値上昇
    private void LevelUpStats()
    {
        var job = Database.Instance.Jobs.GetValueOrDefault(CurrentJob);
        double jobStr = job != null ? job.StrMod : 1.0;
        double jobInt = job != null ? job.IntMod : 1.0;
        double jobDex = job != null ? job.DexMod : 1.0;
        double jobAgi = job != null ? job.AgiMod : 1.0;
        double jobVit = job != null ? job.VitMod : 1.0;

        var rand = new Random();
        int strGrow = rand.NextDouble() < (0.5 * jobStr) ? 1 : 0;
        int intGrow = rand.NextDouble() < (0.5 * jobInt) ? 1 : 0;
        int dexGrow = rand.NextDouble() < (0.5 * jobDex) ? 1 : 0;
        int agiGrow = rand.NextDouble() < (0.5 * jobAgi) ? 1 : 0;
        int vitGrow = rand.NextDouble() < (0.5 * jobVit) ? 1 : 0;

        // 最低でもどれか一つは上がるようにする
        if (strGrow + intGrow + dexGrow + agiGrow + vitGrow == 0)
        {
            strGrow = 1;
        }

        BaseStr += strGrow;
        BaseInt += intGrow;
        BaseDex += dexGrow;
        BaseAgi += agiGrow;
        BaseVit += vitGrow;

        BaseMaxHp += vitGrow * 5 + rand.Next(2, 6); // 2~5
        CurrentHp = GetMaxHp(); // レベルアップ時に全回復
    }

    // ダメージを受ける
    public bool TakeDamage(int amount)
    {
        if (IsDead) return false;
        CurrentHp = Math.Max(0, CurrentHp - amount);
        if (CurrentHp <= 0)
        {
            IsDead = true;
            return true; // 死亡した
        }
        return false;
    }

    // 回復
    public void Heal(int amount)
    {
        if (IsDead) return;
        CurrentHp = Math.Min(GetMaxHp(), CurrentHp + amount);
    }

    public int GetMaxStamina()
    {
        return BaseMaxStamina;
    }

    public void HealStamina(int amount)
    {
        if (IsDead) return;
        CurrentStamina = Math.Min(GetMaxStamina(), CurrentStamina + amount);
    }

    public bool ConsumeStamina(int amount)
    {
        if (IsDead) return false;
        CurrentStamina = Math.Max(0, CurrentStamina - amount);
        return CurrentStamina <= 0;
    }
}
