using Godot;
using System;
using System.Collections.Generic;
using System.Linq;

public class AutoTradeRule
{
    public int SellOver { get; set; } = -1;
    public int BuyUnder { get; set; } = -1;
    public int BuyAmount { get; set; } = 10;
}

public class UpgradeCost
{
    public int Gold { get; set; }
    public List<MaterialRequirement> Items { get; set; } = new();
}

public partial class GameState : Node
{
    public static GameState Instance { get; private set; }

    [Signal] public delegate void GameStateUpdatedEventHandler();
    [Signal] public delegate void LogAddedEventHandler(string message);

    // --- ゲームの状態変数 ---
    public int Gold { get; set; } = 0;
    public int Food { get; set; } = 0;
    public double FoodFraction { get; set; } = 0.0;
    public int SoulPoints { get; set; } = 0;

    public int CurrentDay { get; set; } = 1;
    public int CurrentHour { get; set; } = 8;
    public int TargetDay { get; set; } = 30;
    public int CurrentTier { get; set; } = 1;
    public string TargetBossId { get; set; } = "goblin_lord";

    public List<Villager> Villagers { get; } = new();
    public Dictionary<string, int> Inventory { get; } = new();
    public Dictionary<string, int> FacilityLevels { get; } = new();
    public Dictionary<string, double> ExploreRates { get; } = new();
    public List<string> DefeatedBosses { get; } = new();

    // --- 永続バフ (周回ショップ) ---
    public Dictionary<string, int> PermaBuffs { get; } = new()
    {
        { "heritage", 0 },
        { "stock", 0 },
        { "education", 0 },
        { "body", 0 },
        { "building", 0 },
        { "discount", 0 }
    };

    // --- 状態フラグ ---
    public bool IsGameOver { get; set; } = false;
    public bool IsGameCleared { get; set; } = false;

    // --- 自動取引の設定 ---
    public Dictionary<string, AutoTradeRule> AutoTradeSettings { get; } = new();

    // --- クラフト中の仕事 ---
    public Dictionary<string, double> ActiveCrafts { get; } = new();

    // --- 施設アップグレード中の進行時間 (時間単位) ---
    public Dictionary<string, int> ActiveUpgrades { get; } = new();

    public override void _Ready()
    {
        Instance = this;
        StartNewGame(true);
    }

    public void StartNewGame(bool resetAll = false)
    {
        if (resetAll)
        {
            PermaBuffs["heritage"] = 0;
            PermaBuffs["stock"] = 0;
            PermaBuffs["education"] = 0;
            PermaBuffs["body"] = 0;
            PermaBuffs["building"] = 0;
            PermaBuffs["discount"] = 0;
            SoulPoints = 0;
        }

        Gold = 1000 + PermaBuffs["heritage"] * 500;
        Food = 200 + PermaBuffs["stock"] * 100;
        FoodFraction = 0.0;
        CurrentDay = 1;
        CurrentHour = 8;
        TargetDay = 30;
        CurrentTier = 1;
        IsGameOver = false;
        IsGameCleared = false;

        Inventory.Clear();
        Inventory["wood"] = 10;
        Inventory["stone"] = 10;

        FacilityLevels.Clear();
        FacilityLevels["inn"] = 1;
        FacilityLevels["workshop"] = 1;
        FacilityLevels["forge"] = 0;
        FacilityLevels["alchemy_lab"] = 0;
        FacilityLevels["trading_post"] = 0;

        ExploreRates.Clear();
        ExploreRates["forest"] = 0.0;
        ExploreRates["mine"] = 0.0;
        ExploreRates["valley"] = 0.0;
        ExploreRates["roots"] = 0.0;
        ExploreRates["abyss"] = 0.0;

        DefeatedBosses.Clear();
        ActiveCrafts.Clear();
        ActiveUpgrades.Clear();
        AutoTradeSettings.Clear();

        Villagers.Clear();
        CreateVillager("アルク", "farmer");
        CreateVillager("ルナ", "miner");
        CreateVillager("ガイア", "warrior");

        AddLog("=== 新しいゲームが開始されました ===");
        AddLog("初期村人: アルク(農民)、ルナ(鉱夫)、ガイア(戦士) が加入しました。");
        AddLog("30日目までに「始まりの森」のボス「ゴブリンロード」を倒してください！");

        EmitSignal(SignalName.GameStateUpdated);
    }

    private void CreateVillager(string vName, string jobId)
    {
        var v = new Villager();
        v.Name = vName;
        v.CurrentJob = jobId;
        v.JobHistory = new() { jobId };
        v.Level = 1;
        v.Exp = 0;

        var rand = new Random();
        int buffBonus = PermaBuffs["body"] * 2;
        v.BaseStr = 10 + buffBonus + rand.Next(0, 3);
        v.BaseInt = 10 + buffBonus + rand.Next(0, 3);
        v.BaseDex = 10 + buffBonus + rand.Next(0, 3);
        v.BaseAgi = 10 + buffBonus + rand.Next(0, 3);
        v.BaseVit = 10 + buffBonus + rand.Next(0, 3);
        v.BaseMaxHp = 100 + buffBonus * 5;
        v.CurrentHp = v.GetMaxHp();

        v.Order = "gather";
        v.AssignedArea = "forest";
        v.TravelTime = 2; // 始まりの森(difficulty 1.0)への初期移動時間 (difficulty * 2)
        v.IsDead = false;

        Villagers.Add(v);
    }

    public void AddLog(string msg)
    {
        EmitSignal(SignalName.LogAdded, msg);
    }

    public void AdvanceDay()
    {
        if (IsGameOver) return;
        AddLog($"\n--- Day {CurrentDay} ---");
        for (int i = 0; i < 24; i++)
        {
            if (IsGameOver) break;
            AdvanceHour();
        }
    }

    public void AdvanceHour()
    {
        if (IsGameOver) return;

        CurrentHour += 1;
        if (CurrentHour >= 24)
        {
            CurrentHour = 0;
            CurrentDay += 1;
            AddLog($"\n--- Day {CurrentDay} ---");

            if (CurrentDay > TargetDay)
            {
                TriggerGameOver();
                EmitSignal(SignalName.GameStateUpdated);
                return;
            }
        }

        ProcessFoodHourly();
        ProcessCraftingHourly();
        ProcessUpgradesHourly();
        ProcessVillagersHourly();

        // 毎日午前0時に自動取引実行
        if (CurrentHour == 0 && FacilityLevels.GetValueOrDefault("trading_post", 0) >= 1)
        {
            ProcessAutoTrading();
        }

        EmitSignal(SignalName.GameStateUpdated);
    }

    private void ProcessFoodHourly()
    {
        int aliveCount = GetAliveVillagersCount();
        double foodConsumedHourly = aliveCount * (1.0 / 24.0);
        FoodFraction += foodConsumedHourly;

        int consumedInt = (int)FoodFraction;
        if (consumedInt > 0)
        {
            FoodFraction -= consumedInt;
            if (Food >= consumedInt)
            {
                Food -= consumedInt;
            }
            else
            {
                Food = 0;
            }
        }
    }

    private void ProcessCraftingHourly()
    {
        int craftPower = 0;
        foreach (var v in Villagers)
        {
            if (v.IsDead) continue;
            if (v.CurrentJob == "crafter" && v.Order == "inn")
            {
                craftPower += v.GetDex();
            }
        }

        double hourlyPower = (craftPower + 10) / 24.0;
        var completed = new List<string>();

        // 進行度の更新
        var keys = ActiveCrafts.Keys.ToList();
        foreach (var recipeId in keys)
        {
            ActiveCrafts[recipeId] -= hourlyPower;
            if (ActiveCrafts[recipeId] <= 0)
            {
                var recipe = Database.Instance.Recipes.GetValueOrDefault(recipeId);
                if (recipe != null)
                {
                    var result = recipe.Result;
                    string successMsg = "";
                    int amount = result.Amount;

                    var rand = new Random();
                    if (rand.NextDouble() < (craftPower * 0.001))
                    {
                        amount += 1;
                        successMsg = " (大成功！)";
                    }

                    AddToInventory(result.Id, amount);
                    var itemName = Database.Instance.Items.GetValueOrDefault(result.Id)?.Name ?? result.Id;
                    AddLog($"[{CurrentHour:00}:00][クラフト完成] {itemName} を {amount} 個作成しました。{successMsg}");
                }
                completed.Add(recipeId);
            }
        }

        foreach (var r in completed)
        {
            ActiveCrafts.Remove(r);
        }
    }

    private void ProcessUpgradesHourly()
    {
        var completed = new List<string>();
        var keys = ActiveUpgrades.Keys.ToList();
        foreach (var facId in keys)
        {
            ActiveUpgrades[facId] -= 1;
            if (ActiveUpgrades[facId] <= 0)
            {
                int nextLv = FacilityLevels[facId] + 1;
                FacilityLevels[facId] = nextLv;
                AddLog($"[{CurrentHour:00}:00][施設アップグレード完了] 施設「{GetFacilityName(facId)}」がレベル {nextLv} になりました！");

                if (facId == "forge" && nextLv == 1)
                    AddLog("鍛冶屋が村に建設されました！装備を加工・強化できます。");
                else if (facId == "alchemy_lab" && nextLv == 1)
                    AddLog("錬金工房が村に建設されました！薬品をクラフトできます。");
                else if (facId == "trading_post" && nextLv == 1)
                    AddLog("交易所が村に建設されました！自動売買機能が有効です。");

                completed.Add(facId);
            }
        }

        foreach (var f in completed)
        {
            ActiveUpgrades.Remove(f);
        }
    }

    public string GetFacilityName(string facId)
    {
        return facId switch
        {
            "inn" => "宿屋",
            "workshop" => "工房",
            "forge" => "鍛冶屋",
            "alchemy_lab" => "錬金工房",
            "trading_post" => "交易所",
            _ => facId
        };
    }

    private void ProcessVillagersHourly()
    {
        bool starvation = (Food <= 0);
        if (starvation && GetAliveVillagersCount() > 0 && CurrentHour % 4 == 0)
        {
            AddLog($"[{CurrentHour:00}:00][警告] 食料が不足しています！村人が飢えています。");
        }

        foreach (var v in Villagers)
        {
            if (v.IsDead) continue;

            if (starvation)
            {
                int dmg = Math.Max(1, (int)(v.GetMaxHp() * 0.004));
                bool dead = v.TakeDamage(dmg);
                if (dead)
                {
                    AddLog($"[{CurrentHour:00}:00][悲報] {v.Name} は飢えにより死亡した。");
                    continue;
                }
            }

            if (v.Order == "inn")
            {
                ProcessVillagerInnHourly(v);
            }
            else if (v.Order == "gather" || v.Order == "hunt")
            {
                ProcessVillagerExpeditionHourly(v, starvation);
            }
        }
    }

    private void ProcessVillagerInnHourly(Villager v)
    {
        int innLv = FacilityLevels.GetValueOrDefault("inn", 1);

        // HP回復
        double healPercent = 0.3 / 24.0;
        if (innLv == 2) healPercent = 0.5 / 24.0;
        else if (innLv == 3) healPercent = 0.7 / 24.0;
        else if (innLv >= 4) healPercent = 1.0 / 24.0;

        int healAmount = Math.Max(1, (int)(v.GetMaxHp() * healPercent));
        v.Heal(healAmount);

        // スタミナ回復
        int staminaHeal = 10;
        if (innLv == 2) staminaHeal = 15;
        else if (innLv == 3) staminaHeal = 20;
        else if (innLv >= 4) staminaHeal = 25;
        v.HealStamina(staminaHeal);

        // 職人(crafter)以外の村人で、HPとスタミナが全回復した場合は自動的に元の行動を再開
        if (v.CurrentJob != "crafter" && v.CurrentHp >= v.GetMaxHp() && v.CurrentStamina >= v.GetMaxStamina())
        {
            string nextOrder = v.LastActiveOrder;
            string nextArea = v.LastActiveArea;

            if (nextOrder == "inn" || string.IsNullOrEmpty(nextOrder))
            {
                nextOrder = "gather";
                nextArea = "forest";
            }

            v.Order = nextOrder;
            v.AssignedArea = nextArea;

            var area = Database.Instance.Areas.GetValueOrDefault(nextArea);
            if (area != null)
            {
                int reqTravel = (int)(area.Difficulty * 2);
                v.TravelTime = reqTravel;
                v.IsReturning = false;
                AddLog($"[{CurrentHour:00}:00][休息完了] {v.Name} は全回復し、「{area.Name}」へ再出発しました。(所要時間: {reqTravel}時間)");
            }
            else
            {
                v.TravelTime = 0;
                AddLog($"[{CurrentHour:00}:00][休息完了] {v.Name} は全回復しました。");
            }
        }
    }

    private void ProcessVillagerExpeditionHourly(Villager v, bool starvation)
    {
        bool exhausted = v.ConsumeStamina(5);
        if (exhausted)
        {
            AddLog($"[{CurrentHour:00}:00][疲労] {v.Name} はスタミナ切れのため、宿屋で休養を開始しました。");
            v.Order = "inn";
            v.TravelTime = 0;
            v.IsReturning = false;
            return;
        }

        var area = Database.Instance.Areas.GetValueOrDefault(v.AssignedArea);
        if (area == null) return;

        // 移動中の処理
        if (v.TravelTime > 0)
        {
            v.TravelTime -= 1;
            if (v.TravelTime == 0)
            {
                if (v.IsReturning)
                {
                    AddLog($"[{CurrentHour:00}:00] {v.Name} は村に帰還し、宿屋で休養を開始しました。");
                    v.Order = "inn";
                    v.IsReturning = false;
                }
                else
                {
                    AddLog($"[{CurrentHour:00}:00] {v.Name} が「{area.Name}」に到着し、活動を開始しました。");
                }
            }
            return;
        }

        // 現地活動 (遭遇率 30%)
        var rand = new Random();
        if (rand.NextDouble() < 0.30)
        {
            int strVal = v.GetStr();
            int intVal = v.GetInt();
            int dexVal = v.GetDex();
            int agiVal = v.GetAgi();

            if (starvation)
            {
                strVal /= 2;
                intVal /= 2;
                dexVal /= 2;
                agiVal /= 2;
            }

            if (v.Order == "gather")
            {
                ProcessVillagerGatherHourly(v, area, strVal, intVal, dexVal, agiVal);
            }
            else if (v.Order == "hunt")
            {
                ProcessVillagerHuntHourly(v, area, strVal, intVal, dexVal, agiVal);
            }
        }
    }

    public void ChangeVillagerArea(Villager v, string areaId)
    {
        if (!Database.Instance.Areas.ContainsKey(areaId)) return;
        v.AssignedArea = areaId;

        var area = Database.Instance.Areas[areaId];
        v.TravelTime = (int)(area.Difficulty * 2);
        v.IsReturning = false;
        AddLog($"{v.Name} の派遣先を「{area.Name}」に変更しました。移動を開始します。(所要時間: {v.TravelTime}時間)");
    }

    public int GetAliveVillagersCount()
    {
        return Villagers.Count(v => !v.IsDead);
    }

    private void ProcessVillagerGatherHourly(Villager v, AreaData area, int strVal, int intVal, int dexVal, int agiVal)
    {
        double exploreGain = ((dexVal * 0.2 + agiVal * 0.2) / area.Difficulty) * 0.1;
        ExploreRates[v.AssignedArea] = Math.Min(100.0, ExploreRates[v.AssignedArea] + exploreGain);

        var job = Database.Instance.Jobs.GetValueOrDefault(v.CurrentJob);

        // 各アイテムの採取スコア（重み）を計算
        var gatherScores = new List<Tuple<string, double>>();
        double totalScore = 0.0;

        foreach (var g in area.Gathers)
        {
            var item = Database.Instance.Items.GetValueOrDefault(g.Id);
            if (item == null) continue;

            double baseMult = 1.0 / area.Difficulty;
            double jobMod = 1.0;
            if (job != null)
            {
                var category = item.Category;
                if (category == ItemCategory.Food)
                {
                    jobMod = job.Multipliers.GetValueOrDefault("food", 1.0);
                }
                else if (category == ItemCategory.Wood || category == ItemCategory.Stone || category == ItemCategory.Ore)
                {
                    jobMod = job.Multipliers.GetValueOrDefault("gather_ore", 1.0);
                }
                else if (category == ItemCategory.ManaStone)
                {
                    jobMod = job.Multipliers.GetValueOrDefault("gather_herb", 1.0);
                }
            }

            double statVal = 0.0;
            if (item.Category == ItemCategory.Food || item.Category == ItemCategory.Wood || item.Category == ItemCategory.Stone || item.Category == ItemCategory.Ore)
            {
                statVal = strVal * 0.7 + dexVal * 0.3;
            }
            else
            {
                statVal = intVal * 0.7 + dexVal * 0.3;
            }

            double score = baseMult * jobMod * statVal * (1.0 + agiVal * 0.01) * g.Rate;
            score = Math.Max(0.001, score);

            gatherScores.Add(Tuple.Create(g.Id, score));
            totalScore += score;
        }

        // 重み付きランダム抽選
        string bestItemId = "";
        if (totalScore > 0.0)
        {
            var rand = new Random();
            double r = rand.NextDouble() * totalScore;
            double cumulative = 0.0;
            foreach (var entry in gatherScores)
            {
                cumulative += entry.Item2;
                if (r <= cumulative)
                {
                    bestItemId = entry.Item1;
                    break;
                }
            }
        }

        if (!string.IsNullOrEmpty(bestItemId))
        {
            int amount = 1;
            var rand = new Random();
            if (rand.NextDouble() < 0.2)
            {
                amount += 1;
            }

            AddToInventory(bestItemId, amount);
            var itemName = Database.Instance.Items.GetValueOrDefault(bestItemId)?.Name ?? bestItemId;
            AddLog($"[{CurrentHour:00}:00] {v.Name} は「{area.Name}」で {itemName} を {amount} 個採取した。(探索率: {ExploreRates[v.AssignedArea]:F1}%)");

            int expGain = (int)(2 * area.Difficulty);
            string expLog = v.AddExp(CalcExpWithBuff(expGain));
            if (!string.IsNullOrEmpty(expLog))
            {
                AddLog(expLog);
            }
        }
    }

    private void ProcessVillagerHuntHourly(Villager v, AreaData area, int strVal, int intVal, int dexVal, int agiVal)
    {
        if ((double)v.CurrentHp / v.GetMaxHp() < 0.3)
        {
            AddLog($"[{CurrentHour:00}:00] {v.Name} はHPが低下しているため、討伐をやめ宿屋へ戻りました。");
            v.Order = "inn";
            return;
        }

        MonsterData bestMonster = null;
        int minLvDiff = 999;
        foreach (var m in area.Monsters)
        {
            int diff = Math.Abs(v.Level - m.Level);
            if (diff < minLvDiff)
            {
                minLvDiff = diff;
                bestMonster = m;
            }
        }

        if (bestMonster != null)
        {
            // モンスターデータをコピー
            var enemy = new MonsterData
            {
                Name = bestMonster.Name,
                Level = bestMonster.Level,
                Hp = bestMonster.Hp,
                Str = bestMonster.Str,
                Int = bestMonster.Int,
                Vit = bestMonster.Vit,
                Exp = bestMonster.Exp,
                Drop = bestMonster.Drop
            };

            string battleLog = SimulateBattle(v, enemy, strVal, intVal, dexVal, agiVal);
            string formatted = string.Join($"\n[{CurrentHour:00}:00] ", battleLog.Split('\n'));
            AddLog($"[{CurrentHour:00}:00] {formatted}");
        }
    }

    private int CalcExpWithBuff(int baseExp)
    {
        double mod = 1.0 + PermaBuffs["education"] * 0.1;
        return (int)(baseExp * mod);
    }

    public void AddToInventory(string itemId, int amount)
    {
        if (Inventory.ContainsKey(itemId))
        {
            Inventory[itemId] += amount;
        }
        else
        {
            Inventory[itemId] = amount;
        }
    }

    private bool ConsumeFromInventory(string itemId, int amount)
    {
        if (Inventory.ContainsKey(itemId) && Inventory[itemId] >= amount)
        {
            Inventory[itemId] -= amount;
            if (Inventory[itemId] == 0)
            {
                Inventory.Remove(itemId);
            }
            return true;
        }
        return false;
    }

    private string SimulateBattle(Villager v, MonsterData enemy, int strVal, int intVal, int dexVal, int agiVal)
    {
        string logMsg = $"{v.Name} は {enemy.Name} (LV {enemy.Level}) と戦闘を開始した。";
        int turns = 0;
        bool isVictory = false;

        var rand = new Random();

        while (turns < 10)
        {
            turns++;
            // 1. プレイヤーの攻撃
            double pHit = 85 + (dexVal - enemy.Vit) * 1.5;
            if (rand.NextDouble() * 100 <= pHit)
            {
                int dmg = 0;
                bool isMagic = (v.CurrentJob == "mage" || v.CurrentJob == "priest");
                if (isMagic)
                {
                    dmg = (int)(intVal * 1.8 - enemy.Int * 0.5);
                }
                else
                {
                    dmg = (int)(strVal * 1.5 - enemy.Vit * 0.5);
                }
                dmg = Math.Max(1, dmg);

                // クリティカル
                double crit = dexVal * 0.1;
                if (rand.NextDouble() * 100 < crit)
                {
                    dmg = (int)(dmg * 1.5);
                    logMsg += " (クリティカル!)";
                }

                enemy.Hp -= dmg;
                logMsg += $" {v.Name}の攻撃 -> {dmg} ダメージ! (敵HP: {Math.Max(0, enemy.Hp)})";
                if (enemy.Hp <= 0)
                {
                    isVictory = true;
                    break;
                }
            }
            else
            {
                logMsg += $" {v.Name}の攻撃は外れた。";
            }

            // 2. 敵の攻撃
            double eHit = 85 + (enemy.Vit - agiVal) * 1.5;
            if (rand.NextDouble() * 100 <= eHit)
            {
                int dmg = Math.Max(1, (int)(enemy.Str * 1.2 - v.GetVit() * 0.5));
                bool dead = v.TakeDamage(dmg);
                logMsg += $" {enemy.Name}の反撃 -> {dmg} ダメージ! ({v.Name}HP: {v.CurrentHp}/{v.GetMaxHp()})";
                if (dead)
                {
                    logMsg += $" [死亡] {v.Name} は力尽きた…";
                    break;
                }
            }
            else
            {
                logMsg += $" {enemy.Name}の攻撃を回避した。";
            }
        }

        if (isVictory)
        {
            logMsg += $"\n-> {enemy.Name} に勝利した！";
            int expGain = CalcExpWithBuff(enemy.Exp);
            string expLog = v.AddExp(expGain);
            logMsg += $" 経験値 {expGain} 獲得。{expLog}";

            int gGain = enemy.Level * 10 + rand.Next(0, 10);
            Gold += gGain;
            logMsg += $" {gGain} ゴールド獲得。";

            if (rand.NextDouble() < 0.5)
            {
                AddToInventory(enemy.Drop, 1);
                var dropName = Database.Instance.Items.GetValueOrDefault(enemy.Drop)?.Name ?? enemy.Drop;
                logMsg += $" {dropName} を手に入れた。";
            }
        }
        else
        {
            if (!v.IsDead)
            {
                logMsg += $"\n-> 制限ターン超過、または敗北により {v.Name} は一時撤退した。";
            }
        }

        return logMsg;
    }

    public bool StartCraft(string recipeId)
    {
        var recipe = Database.Instance.Recipes.GetValueOrDefault(recipeId);
        if (recipe == null) return false;

        // レベルチェック
        string facility = recipe.Facility;
        if (FacilityLevels.GetValueOrDefault(facility, 0) < recipe.RequiredLevel)
        {
            AddLog("施設レベルが不足しています。");
            return false;
        }

        // 素材チェック
        foreach (var m in recipe.Materials)
        {
            if (!Inventory.ContainsKey(m.Id) || Inventory[m.Id] < m.Amount)
            {
                AddLog("クラフト素材が不足しています。");
                return false;
            }
        }

        // 消費
        foreach (var m in recipe.Materials)
        {
            ConsumeFromInventory(m.Id, m.Amount);
        }

        ActiveCrafts[recipeId] = recipe.WorkRequired;
        var resultName = Database.Instance.Items.GetValueOrDefault(recipe.Result.Id)?.Name ?? recipe.Result.Id;
        AddLog($"{resultName} のクラフトを開始しました。");
        EmitSignal(SignalName.GameStateUpdated);
        return true;
    }

    private UpgradeCost GetFacilityUpgradeCostRaw(string facId, int nextLv)
    {
        int costGold = 0;
        var costItems = new List<MaterialRequirement>();

        if (facId == "inn")
        {
            if (nextLv == 2)
            {
                costGold = 500;
                costItems.Add(new() { Id = "wood", Amount = 20 });
            }
            else if (nextLv == 3)
            {
                costGold = 1500;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "wood_plank", Amount = 15 },
                    new() { Id = "dry_meat", Amount = 30 }
                });
            }
            else if (nextLv == 4)
            {
                costGold = 5000;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "build_stone", Amount = 20 },
                    new() { Id = "iron_ingot", Amount = 10 }
                });
            }
        }
        else if (facId == "workshop")
        {
            if (nextLv == 2)
            {
                costGold = 800;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "wood", Amount = 30 },
                    new() { Id = "stone", Amount = 30 }
                });
            }
            else if (nextLv == 3)
            {
                costGold = 2500;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "wood_plank", Amount = 20 },
                    new() { Id = "iron_ingot", Amount = 5 }
                });
            }
        }
        else if (facId == "forge")
        {
            if (nextLv == 2)
            {
                costGold = 3000;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "iron_ingot", Amount = 15 },
                    new() { Id = "coal", Amount = 30 }
                });
            }
            else if (nextLv == 3)
            {
                costGold = 8000;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "steel_ingot", Amount = 10 },
                    new() { Id = "mana_stone", Amount = 15 }
                });
            }
        }
        else if (facId == "alchemy_lab")
        {
            if (nextLv == 2)
            {
                costGold = 3500;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "herb", Amount = 50 },
                    new() { Id = "mana_stone", Amount = 25 }
                });
            }
            else if (nextLv == 3)
            {
                costGold = 9000;
                costItems.AddRange(new List<MaterialRequirement> {
                    new() { Id = "high_herb", Amount = 20 },
                    new() { Id = "shiny_mana", Amount = 10 }
                });
            }
        }
        else if (facId == "trading_post")
        {
            if (nextLv == 2)
            {
                costGold = 4000;
                costItems.Add(new() { Id = "iron_ingot", Amount = 10 });
            }
            else if (nextLv == 3)
            {
                costGold = 10000;
                costItems.Add(new() { Id = "steel_ingot", Amount = 10 });
            }
        }

        return new() { Gold = costGold, Items = costItems };
    }

    public UpgradeCost GetFacilityUpgradeCost(string facId)
    {
        int nextLv = FacilityLevels.GetValueOrDefault(facId, 0) + 1;
        if (nextLv > 4)
        {
            return new() { Gold = 0 };
        }

        var raw = GetFacilityUpgradeCostRaw(facId, nextLv);
        double discount = 1.0 - PermaBuffs["building"] * 0.05;

        int costGold = (int)(raw.Gold * discount);
        var costItems = new List<MaterialRequirement>();
        foreach (var m in raw.Items)
        {
            costItems.Add(new()
            {
                Id = m.Id,
                Amount = Math.Max(1, (int)(m.Amount * discount))
            });
        }

        return new() { Gold = costGold, Items = costItems };
    }

    public bool UpgradeFacility(string facId)
    {
        if (!FacilityLevels.ContainsKey(facId)) return false;
        int nextLv = FacilityLevels[facId] + 1;
        if (nextLv > 4) return false;

        if (ActiveUpgrades.ContainsKey(facId))
        {
            AddLog("すでにアップグレード中です。");
            return false;
        }

        var cost = GetFacilityUpgradeCost(facId);
        int costGold = cost.Gold;

        if (Gold < costGold)
        {
            AddLog("ゴールドが不足しています！");
            return false;
        }

        foreach (var m in cost.Items)
        {
            if (!Inventory.ContainsKey(m.Id) || Inventory[m.Id] < m.Amount)
            {
                var itemName = Database.Instance.Items.GetValueOrDefault(m.Id)?.Name ?? m.Id;
                AddLog($"アップグレード素材 {itemName} が不足しています。");
                return false;
            }
        }

        // 消費
        Gold -= costGold;
        foreach (var m in cost.Items)
        {
            ConsumeFromInventory(m.Id, m.Amount);
        }

        int reqHours = nextLv * 4;
        ActiveUpgrades[facId] = reqHours;
        AddLog($"施設「{GetFacilityName(facId)}」のアップグレード（Lv.{nextLv}へ）を開始しました。(所要時間: {reqHours}時間)");

        EmitSignal(SignalName.GameStateUpdated);
        return true;
    }

    private void ProcessAutoTrading()
    {
        double fee = 0.2;
        int tpLv = FacilityLevels.GetValueOrDefault("trading_post", 0);
        if (tpLv == 2) fee = 0.1;
        else if (tpLv >= 3) fee = 0.05;

        var keys = AutoTradeSettings.Keys.ToList();
        foreach (var itemId in keys)
        {
            var rule = AutoTradeSettings[itemId];
            int count = Inventory.GetValueOrDefault(itemId, 0);
            var item = Database.Instance.Items.GetValueOrDefault(itemId);
            if (item == null) continue;

            // 売却
            if (rule.SellOver >= 0 && count > rule.SellOver)
            {
                int sellAmt = count - rule.SellOver;
                int gain = (int)(sellAmt * item.ValueSell * (1.0 - fee));
                if (ConsumeFromInventory(itemId, sellAmt))
                {
                    Gold += gain;
                    AddLog($"[自動取引] {item.Name} を {sellAmt} 個売却し、{gain} G獲得しました。");
                }
            }

            // 購入
            count = Inventory.GetValueOrDefault(itemId, 0);
            if (rule.BuyUnder >= 0 && count < rule.BuyUnder)
            {
                int buyAmt = rule.BuyAmount;
                int cost = (int)(buyAmt * item.ValueBuy * (1.0 + fee));
                if (Gold >= cost)
                {
                    Gold -= cost;
                    AddToInventory(itemId, buyAmt);
                    AddLog($"[自動取引] {item.Name} を {buyAmt} 個購入し、{cost} G消費しました。");
                }
            }
        }
    }

    public bool ChangeJob(Villager v, string jobId)
    {
        if (!Database.Instance.Jobs.ContainsKey(jobId)) return false;
        var job = Database.Instance.Jobs[jobId];

        int cost = job.Cost;
        if (v.JobHistory.Contains(jobId))
        {
            cost = 0;
        }
        else
        {
            double discount = 1.0 - PermaBuffs["discount"] * 0.1;
            cost = (int)(cost * discount);
        }

        if (Gold < cost)
        {
            AddLog("転職費用ゴールドが不足しています！");
            return false;
        }

        Gold -= cost;
        v.CurrentJob = jobId;
        if (!v.JobHistory.Contains(jobId))
        {
            v.JobHistory.Add(jobId);
        }

        AddLog($"{v.Name} が職業を「{job.Name}」に変更しました。");
        EmitSignal(SignalName.GameStateUpdated);
        return true;
    }

    public bool ChallengeBoss(string areaId)
    {
        var area = Database.Instance.Areas.GetValueOrDefault(areaId);
        if (area == null) return false;

        if (ExploreRates.GetValueOrDefault(areaId, 0.0) < 100.0)
        {
            AddLog("まだ探索度が100%に達していません。");
            return false;
        }

        var boss = area.Boss;
        AddLog($"\n=== ボス戦開始: vs {boss.Name} ===");

        var combatants = Villagers.Where(v => !v.IsDead).ToList();
        if (combatants.Count == 0)
        {
            AddLog("戦闘可能な村人がいません！");
            return false;
        }

        int bossHp = boss.Hp;
        int turn = 0;
        bool victory = false;
        var rand = new Random();

        while (turn < 20 && bossHp > 0)
        {
            turn++;
            // 村人の攻撃
            foreach (var v in combatants)
            {
                if (v.IsDead) continue;
                double hit = 85 + (v.GetDex() - boss.Vit) * 1.5;
                if (rand.NextDouble() * 100 <= hit)
                {
                    bool isMagic = (v.CurrentJob == "mage" || v.CurrentJob == "priest");
                    int dmg = 0;
                    if (isMagic)
                    {
                        dmg = (int)(v.GetInt() * 1.8 - boss.Int * 0.5);
                    }
                    else
                    {
                        dmg = (int)(v.GetStr() * 1.5 - boss.Vit * 0.5);
                    }
                    dmg = Math.Max(1, dmg);

                    // クリティカル
                    if (rand.NextDouble() * 100 < v.GetDex() * 0.1)
                    {
                        dmg = (int)(dmg * 1.5);
                    }

                    bossHp -= dmg;
                    AddLog($"{v.Name} の攻撃 -> {boss.Name} に {dmg} ダメージ! (ボスHP: {Math.Max(0, bossHp)})");
                    if (bossHp <= 0)
                    {
                        victory = true;
                        break;
                    }
                }
                else
                {
                    AddLog($"{v.Name} の攻撃は回避された。");
                }
            }

            if (victory) break;

            // ボスの攻撃
            var aliveV = combatants.Where(v => !v.IsDead).ToList();
            if (aliveV.Count == 0) break;

            var target = aliveV[rand.Next(0, aliveV.Count)];
            double bossHit = 85 + (boss.Vit - target.GetAgi()) * 1.5;
            if (rand.NextDouble() * 100 <= bossHit)
            {
                int dmg = Math.Max(1, (int)(boss.Str * 1.5 - target.GetVit() * 0.5));
                bool dead = target.TakeDamage(dmg);
                AddLog($"{boss.Name} の攻撃 -> {target.Name} に {dmg} ダメージ! (HP: {target.CurrentHp}/{target.GetMaxHp()})");
                if (dead)
                {
                    AddLog($"[警告] {target.Name} はボス戦で倒れた！");
                }
            }
            else
            {
                AddLog($"{boss.Name} の攻撃を回避した！");
            }

            // ヒーラーの自動回復
            foreach (var v in combatants)
            {
                if (v.IsDead || v.CurrentJob != "priest") continue;
                
                var currentAlive = combatants.Where(av => !av.IsDead).ToList();
                Villager lowHpV = null;
                double minHpRatio = 1.0;
                foreach (var av in currentAlive)
                {
                    double r = (double)av.CurrentHp / av.GetMaxHp();
                    if (r < minHpRatio)
                    {
                        minHpRatio = r;
                        lowHpV = av;
                    }
                }

                if (lowHpV != null && minHpRatio < 0.8)
                {
                    int healAmount = (int)(v.GetInt() * 1.2);
                    lowHpV.Heal(healAmount);
                    AddLog($"[回復] {v.Name} のヒール -> {lowHpV.Name} のHPを {healAmount} 回復！");
                }
            }
        }

        if (victory)
        {
            AddLog($"\n=== ボス戦勝利！ {boss.Name} を討伐しました！ ===");
            DefeatedBosses.Add(areaId);

            // ボスごとのクリア報酬 (Tier昇格)
            if (areaId == "forest" && CurrentTier == 1)
            {
                CurrentTier = 2;
                TargetDay = 60;
                TargetBossId = "golem";
                AddLog("【Tier UP】新しい施設「鍛冶屋」が建設可能になりました！");
                AddLog("次の目標: 60日目までに「廃鉱山」のボス「ゴーレム」を討伐！");
            }
            else if (areaId == "mine" && CurrentTier == 2)
            {
                CurrentTier = 3;
                TargetDay = 90;
                TargetBossId = "chimera";
                AddLog("【Tier UP】新しい施設「錬金工房」が建設可能になりました！");
                AddLog("次の目標: 90日目までに「魔獣の谷」のボス「キマイラ」を討伐！");
            }
            else if (areaId == "valley" && CurrentTier == 3)
            {
                CurrentTier = 4;
                TargetDay = 120;
                TargetBossId = "archdemon";
                AddLog("【Tier UP】新しい施設「交易所」が建設可能になりました！");
                AddLog("次の目標: 120日目までに「世界樹の根」のボス「アークデーモン」を討伐！");
            }
            else if (areaId == "roots" && CurrentTier == 4)
            {
                CurrentTier = 5;
                TargetDay = 150;
                TargetBossId = "apocalypse_dragon";
                AddLog("【Tier UP】最終ダンジョン「深淵の奈落」が解放されました！");
                AddLog("次の目標: 150日目までに「深淵の奈落」のボス「終焉の竜」を討伐！");
            }
            else if (areaId == "abyss")
            {
                IsGameCleared = true;
                AddLog("\n★★★★★ ゲームクリア！ ★★★★★");
                AddLog("おめでとうございます！終焉の竜を倒し、村に平穏が戻りました！");
            }

            // 戦闘報酬EXP
            int rewardExp = boss.Exp;
            foreach (var v in combatants)
            {
                if (v.IsDead) continue;
                string expLog = v.AddExp(CalcExpWithBuff(rewardExp));
                AddLog($"{v.Name} は経験値 {rewardExp} 獲得。{expLog}");
            }

            // 周回報酬用SP (ボス撃破でSP獲得)
            int spGain = (int)(area.Difficulty * 10);
            SoulPoints += spGain;
            AddLog($"周回用ソウルポイント {spGain} SPを獲得しました！");
        }
        else
        {
            AddLog($"\n=== ボス戦敗北... {boss.Name} の討伐に失敗しました ===");
            // 生存者が全滅した場合はゲームオーバー
            if (GetAliveVillagersCount() == 0)
            {
                TriggerGameOver();
            }
        }

        EmitSignal(SignalName.GameStateUpdated);
        return victory;
    }

    private void TriggerGameOver()
    {
        IsGameOver = true;
        AddLog("\n【GAME OVER】期限超過、または村人が全滅したためゲームオーバーです。");
        int spGain = CurrentDay * 2 + DefeatedBosses.Count * 15;
        SoulPoints += spGain;
        AddLog($"今回の成績に応じたソウルポイント {spGain} SPを獲得！ (現在の総SP: {SoulPoints})");
    }
}
