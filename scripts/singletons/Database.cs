using Godot;
using System;
using System.Collections.Generic;

public enum ItemCategory
{
    Food,
    Wood,
    Stone,
    Ore,
    ManaStone,
    MonsterMaterial,
    Intermediate,
    Consumable,
    Weapon,
    Armor
}

public class ItemData
{
    public string Id { get; set; }
    public string Name { get; set; }
    public ItemCategory Category { get; set; }
    public string Description { get; set; }
    public int ValueSell { get; set; }
    public int ValueBuy { get; set; }
    public Dictionary<string, int> EffectData { get; set; } = new();
}

public class JobData
{
    public string Id { get; set; }
    public string Name { get; set; }
    public double StrMod { get; set; }
    public double IntMod { get; set; }
    public double AgiMod { get; set; }
    public double DexMod { get; set; }
    public double VitMod { get; set; }
    public int Cost { get; set; }
    public string Description { get; set; }
    public Dictionary<string, double> Multipliers { get; set; } = new();
}

public class MaterialRequirement
{
    public string Id { get; set; }
    public int Amount { get; set; }
}

public class RecipeResult
{
    public string Id { get; set; }
    public int Amount { get; set; }
}

public class RecipeData
{
    public string Id { get; set; }
    public string Facility { get; set; }
    public int RequiredLevel { get; set; }
    public List<MaterialRequirement> Materials { get; set; } = new();
    public RecipeResult Result { get; set; }
    public double WorkRequired { get; set; }
}

public class GatherData
{
    public string Id { get; set; }
    public double Rate { get; set; }
}

public class MonsterData
{
    public string Name { get; set; }
    public int Level { get; set; }
    public int Hp { get; set; }
    public int Str { get; set; }
    public int Int { get; set; }
    public int Vit { get; set; }
    public int Exp { get; set; }
    public string Drop { get; set; }
}

public class BossData
{
    public string Name { get; set; }
    public int Level { get; set; }
    public int Hp { get; set; }
    public int Str { get; set; }
    public int Int { get; set; }
    public int Vit { get; set; }
    public int Exp { get; set; }
}

public class AreaData
{
    public string Id { get; set; }
    public string Name { get; set; }
    public double Difficulty { get; set; }
    public List<GatherData> Gathers { get; set; } = new();
    public List<MonsterData> Monsters { get; set; } = new();
    public BossData Boss { get; set; }
}

public partial class Database : Node
{
    public static Database Instance { get; private set; }

    public Dictionary<string, ItemData> Items { get; } = new();
    public Dictionary<string, JobData> Jobs { get; } = new();
    public Dictionary<string, RecipeData> Recipes { get; } = new();
    public Dictionary<string, AreaData> Areas { get; } = new();

    public override void _Ready()
    {
        Instance = this;
        InitItems();
        InitJobs();
        InitRecipes();
        InitAreas();
    }

    private void InitItems()
    {
        // 項目: ID, Name, Category, Description, ValueSell, ValueBuy, EffectData
        var list = new List<ItemData>
        {
            // 一次素材
            new() { Id = "wild_grain", Name = "野生の穀物", Category = ItemCategory.Food, Description = "村人の食料となる主食。", ValueSell = 1, ValueBuy = 3 },
            new() { Id = "raw_meat", Name = "生肉", Category = ItemCategory.Food, Description = "猟師の討伐行動などで得られる獣の肉。", ValueSell = 3, ValueBuy = 9 },
            new() { Id = "herb", Name = "薬草", Category = ItemCategory.ManaStone, Description = "回復薬の基礎となる薬草。", ValueSell = 2, ValueBuy = 6 },
            new() { Id = "high_herb", Name = "高級薬草", Category = ItemCategory.ManaStone, Description = "より高い効能を持つ珍しい薬草。", ValueSell = 8, ValueBuy = 24 },
            new() { Id = "wood", Name = "木材", Category = ItemCategory.Wood, Description = "建築や加工に広く使われる木材。", ValueSell = 2, ValueBuy = 6 },
            new() { Id = "stone", Name = "石材", Category = ItemCategory.Stone, Description = "建物の土台や石材加工に使われる。", ValueSell = 2, ValueBuy = 6 },
            new() { Id = "coal", Name = "石炭", Category = ItemCategory.Ore, Description = "鍛冶場の燃料となる可燃性の鉱石。", ValueSell = 4, ValueBuy = 12 },
            new() { Id = "iron_ore", Name = "鉄鉱石", Category = ItemCategory.Ore, Description = "鉄製品の原料となる赤茶けた鉱石。", ValueSell = 5, ValueBuy = 15 },
            new() { Id = "copper_ore", Name = "銅鉱石", Category = ItemCategory.Ore, Description = "青緑色の鉱石。合金の材料。", ValueSell = 3, ValueBuy = 9 },
            new() { Id = "mana_stone", Name = "魔法石", Category = ItemCategory.ManaStone, Description = "魔力を秘めた結晶。", ValueSell = 10, ValueBuy = 30 },
            new() { Id = "shiny_mana", Name = "輝く魔法石", Category = ItemCategory.ManaStone, Description = "強い魔力を帯び、光を放つ魔法石。", ValueSell = 40, ValueBuy = 120 },
            new() { Id = "beast_leather", Name = "魔獣の革", Category = ItemCategory.MonsterMaterial, Description = "モンスターから剥ぎ取った頑丈な革。", ValueSell = 6, ValueBuy = 18 },
            new() { Id = "beast_bone", Name = "魔獣の骨", Category = ItemCategory.MonsterMaterial, Description = "骨製品や薬品の原料となる硬い骨。", ValueSell = 5, ValueBuy = 15 },
            new() { Id = "world_branch", Name = "世界樹の枝", Category = ItemCategory.Wood, Description = "神秘的な力を宿した強固な枝。", ValueSell = 20, ValueBuy = 60 },
            new() { Id = "world_leaf", Name = "世界樹の葉", Category = ItemCategory.ManaStone, Description = "万病を癒すと伝えられる黄金の葉。", ValueSell = 25, ValueBuy = 75 },
            new() { Id = "abyss_stone", Name = "奈落の石", Category = ItemCategory.Stone, Description = "闇 of 魔力を帯びた漆黒の鉱石。", ValueSell = 30, ValueBuy = 90 },
            new() { Id = "orichalcum_ore", Name = "オリハルコン鉱石", Category = ItemCategory.Ore, Description = "神々の金属と呼ばれる極めて希少な鉱石。", ValueSell = 50, ValueBuy = 150 },

            // 中間素材
            new() { Id = "wood_plank", Name = "頑丈な木板", Category = ItemCategory.Intermediate, Description = "建築用に切り出された強固な木板。", ValueSell = 8, ValueBuy = 16 },
            new() { Id = "build_stone", Name = "建築用石材", Category = ItemCategory.Intermediate, Description = "滑らかに加工された土台用の石材。", ValueSell = 8, ValueBuy = 16 },
            new() { Id = "iron_ingot", Name = "鉄インゴット", Category = ItemCategory.Intermediate, Description = "不純物を取り除き鋳造された鉄の塊。", ValueSell = 20, ValueBuy = 40 },
            new() { Id = "steel_ingot", Name = "鋼鉄インゴット", Category = ItemCategory.Intermediate, Description = "鉄を極限まで鍛え上げた鋼の塊。", ValueSell = 50, ValueBuy = 100 },
            new() { Id = "mana_steel", Name = "魔鉄インゴット", Category = ItemCategory.Intermediate, Description = "魔力を浸透させた特殊な合金。", ValueSell = 120, ValueBuy = 240 },
            new() { Id = "orichalcum", Name = "オリハルコン", Category = ItemCategory.Intermediate, Description = "最高品質の硬度と魔導率を誇る超金属。", ValueSell = 300, ValueBuy = 600 },
            new() { Id = "dry_meat", Name = "干し肉", Category = ItemCategory.Food, Description = "長期保存が可能な栄養満点の食料。", ValueSell = 10, ValueBuy = 20 },

            // 消費アイテム
            new() { Id = "potion_s", Name = "回復薬(小)", Category = ItemCategory.Consumable, Description = "使用者のHPを50回復。", ValueSell = 10, ValueBuy = 20, EffectData = new(){{"hp_recover", 50}} },
            new() { Id = "potion_l", Name = "回復薬(大)", Category = ItemCategory.Consumable, Description = "使用者のHPを150回復。", ValueSell = 35, ValueBuy = 70, EffectData = new(){{"hp_recover", 150}} },
            new() { Id = "elixir", Name = "万能薬", Category = ItemCategory.Consumable, Description = "使用者のHPを全回復し、状態異常を治す。", ValueSell = 100, ValueBuy = 200, EffectData = new(){{"hp_recover_full", 1}} },
            new() { Id = "str_pill", Name = "活力の丸薬", Category = ItemCategory.Consumable, Description = "戦闘中、物理攻撃力を高める丸薬。", ValueSell = 30, ValueBuy = 60, EffectData = new(){{"temp_str", 5}} },
            new() { Id = "int_pill", Name = "賢者の秘薬", Category = ItemCategory.Consumable, Description = "戦闘中、魔法の威力を高める薬液。", ValueSell = 40, ValueBuy = 80, EffectData = new(){{"temp_int", 5}} },

            // 装備品
            new() { Id = "wooden_staff", Name = "木の杖", Category = ItemCategory.Weapon, Description = "魔術師や僧侶が使うシンプルな杖。", ValueSell = 20, ValueBuy = 40, EffectData = new(){{"int", 5}} },
            new() { Id = "iron_sword", Name = "鉄の剣", Category = ItemCategory.Weapon, Description = "初心者向けのオーソドックスな鉄剣。", ValueSell = 60, ValueBuy = 120, EffectData = new(){{"str", 10}} },
            new() { Id = "steel_sword", Name = "鋼鉄の剣", Category = ItemCategory.Weapon, Description = "重量感があり強固な鋼の剣。", ValueSell = 180, ValueBuy = 360, EffectData = new(){{"str", 25}} },
            new() { Id = "magic_sword", Name = "魔法の剣", Category = ItemCategory.Weapon, Description = "刃に魔力が揺らめく美しい片手剣。", ValueSell = 400, ValueBuy = 800, EffectData = new(){{"str", 20},{"int", 15}} },
            new() { Id = "sage_staff", Name = "賢者の杖", Category = ItemCategory.Weapon, Description = "大魔術師の秘儀が込められた聖なる杖。", ValueSell = 600, ValueBuy = 1200, EffectData = new(){{"int", 35}} },
            
            new() { Id = "leather_cloth", Name = "皮の服", Category = ItemCategory.Armor, Description = "軽量で動きやすい革製の防具。", ValueSell = 20, ValueBuy = 40, EffectData = new(){{"vit", 3}} },
            new() { Id = "iron_armor", Name = "鉄の鎧", Category = ItemCategory.Armor, Description = "ずっしりと重く、物理防御に優れた鉄鎧。", ValueSell = 80, ValueBuy = 160, EffectData = new(){{"vit", 10}} },
            new() { Id = "steel_armor", Name = "鋼鉄の鎧", Category = ItemCategory.Armor, Description = "高い強度の鋼で全身を保護する重鎧。", ValueSell = 240, ValueBuy = 480, EffectData = new(){{"vit", 25}} },
            new() { Id = "mana_cloak", Name = "魔力外套", Category = ItemCategory.Armor, Description = "魔法防御を高めるエンチャントが施された外套。", ValueSell = 300, ValueBuy = 600, EffectData = new(){{"vit", 15},{"int", 5}} }
        };

        foreach (var item in list)
        {
            Items[item.Id] = item;
        }
    }

    private void InitJobs()
    {
        var list = new List<JobData>
        {
            new() { Id = "unemployed", Name = "無職", StrMod = 1.0, IntMod = 1.0, AgiMod = 1.0, DexMod = 1.0, VitMod = 1.0, Cost = 0, Description = "初期状態。特徴なし。", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.0},{"gather_herb", 1.0},{"monster", 1.0}} },
            new() { Id = "farmer", Name = "農民", StrMod = 1.1, IntMod = 0.9, AgiMod = 1.1, DexMod = 1.0, VitMod = 1.0, Cost = 100, Description = "食料の採取効率が非常に高い。", Multipliers = new(){{"food", 2.0},{"gather_ore", 1.0},{"gather_herb", 1.0},{"monster", 1.0}} },
            new() { Id = "miner", Name = "鉱夫", StrMod = 1.3, IntMod = 0.7, AgiMod = 0.8, DexMod = 1.0, VitMod = 1.2, Cost = 150, Description = "鉱石や石材の採取効率が非常に高い。", Multipliers = new(){{"food", 1.0},{"gather_ore", 2.0},{"gather_herb", 1.0},{"monster", 1.0}} },
            new() { Id = "herbalist", Name = "薬師", StrMod = 0.8, IntMod = 1.2, AgiMod = 1.0, DexMod = 1.3, VitMod = 0.8, Cost = 150, Description = "薬草の採取効率が非常に高い。", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.0},{"gather_herb", 2.0},{"monster", 1.0}} },
            new() { Id = "hunter", Name = "猟師", StrMod = 1.1, IntMod = 0.9, AgiMod = 1.2, DexMod = 1.2, VitMod = 0.9, Cost = 200, Description = "食料と、討伐時の素材採取が得意。", Multipliers = new(){{"food", 1.5},{"gather_ore", 1.0},{"gather_herb", 1.0},{"monster", 1.5}} },
            new() { Id = "warrior", Name = "戦士", StrMod = 1.4, IntMod = 0.5, AgiMod = 1.1, DexMod = 1.0, VitMod = 1.3, Cost = 300, Description = "物理戦闘に特化。物理ダメージ+30%", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.0},{"gather_herb", 1.0},{"monster", 1.3}} },
            new() { Id = "mage", Name = "魔術師", StrMod = 0.5, IntMod = 1.5, AgiMod = 1.0, DexMod = 1.1, VitMod = 0.7, Cost = 350, Description = "魔法戦闘に特化。魔法石採取が得意。", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.0},{"gather_herb", 1.5},{"monster", 1.2}} },
            new() { Id = "priest", Name = "僧侶", StrMod = 0.8, IntMod = 1.3, AgiMod = 0.9, DexMod = 1.1, VitMod = 1.1, Cost = 350, Description = "戦闘中の回復スキルを持つ。生存率UP", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.0},{"gather_herb", 1.3},{"monster", 1.0}} },
            new() { Id = "crafter", Name = "職人", StrMod = 1.0, IntMod = 1.0, AgiMod = 0.9, DexMod = 1.4, VitMod = 1.0, Cost = 300, Description = "加工大成功率+20%。採掘も少し得意。", Multipliers = new(){{"food", 1.0},{"gather_ore", 1.2},{"gather_herb", 1.0},{"monster", 1.0}} }
        };

        foreach (var job in list)
        {
            Jobs[job.Id] = job;
        }
    }

    private void InitRecipes()
    {
        var list = new List<RecipeData>
        {
            new() { Id = "wood_plank", Facility = "workshop", RequiredLevel = 1, Materials = new(){new(){Id="wood",Amount=3}}, Result = new(){Id="wood_plank",Amount=1}, WorkRequired = 30 },
            new() { Id = "build_stone", Facility = "workshop", RequiredLevel = 1, Materials = new(){new(){Id="stone",Amount=3}}, Result = new(){Id="build_stone",Amount=1}, WorkRequired = 30 },
            new() { Id = "iron_ingot", Facility = "forge", RequiredLevel = 1, Materials = new(){new(){Id="iron_ore",Amount=3},new(){Id="coal",Amount=1}}, Result = new(){Id="iron_ingot",Amount=1}, WorkRequired = 50 },
            new() { Id = "steel_ingot", Facility = "forge", RequiredLevel = 2, Materials = new(){new(){Id="iron_ingot",Amount=2},new(){Id="coal",Amount=2}}, Result = new(){Id="steel_ingot",Amount=1}, WorkRequired = 80 },
            new() { Id = "mana_steel", Facility = "forge", RequiredLevel = 3, Materials = new(){new(){Id="steel_ingot",Amount=1},new(){Id="mana_stone",Amount=2}}, Result = new(){Id="mana_steel",Amount=1}, WorkRequired = 120 },
            new() { Id = "orichalcum", Facility = "forge", RequiredLevel = 3, Materials = new(){new(){Id="orichalcum_ore",Amount=3},new(){Id="shiny_mana",Amount=1}}, Result = new(){Id="orichalcum",Amount=1}, WorkRequired = 200 },
            new() { Id = "dry_meat", Facility = "workshop", RequiredLevel = 1, Materials = new(){new(){Id="raw_meat",Amount=2}}, Result = new(){Id="dry_meat",Amount=1}, WorkRequired = 20 },

            // 薬品
            new() { Id = "potion_s", Facility = "alchemy_lab", RequiredLevel = 1, Materials = new(){new(){Id="herb",Amount=3}}, Result = new(){Id="potion_s",Amount=1}, WorkRequired = 30 },
            new() { Id = "potion_l", Facility = "alchemy_lab", RequiredLevel = 2, Materials = new(){new(){Id="high_herb",Amount=3},new(){Id="mana_stone",Amount=1}}, Result = new(){Id="potion_l",Amount=1}, WorkRequired = 60 },
            new() { Id = "elixir", Facility = "alchemy_lab", RequiredLevel = 3, Materials = new(){new(){Id="world_leaf",Amount=1},new(){Id="shiny_mana",Amount=1}}, Result = new(){Id="elixir",Amount=1}, WorkRequired = 150 },

            // 装備
            new() { Id = "wooden_staff", Facility = "forge", RequiredLevel = 1, Materials = new(){new(){Id="wood",Amount=3}}, Result = new(){Id="wooden_staff",Amount=1}, WorkRequired = 40 },
            new() { Id = "iron_sword", Facility = "forge", RequiredLevel = 1, Materials = new(){new(){Id="iron_ingot",Amount=2},new(){Id="wood_plank",Amount=1}}, Result = new(){Id="iron_sword",Amount=1}, WorkRequired = 80 },
            new() { Id = "steel_sword", Facility = "forge", RequiredLevel = 2, Materials = new(){new(){Id="steel_ingot",Amount=2},new(){Id="wood_plank",Amount=1}}, Result = new(){Id="steel_sword",Amount=1}, WorkRequired = 150 },
            new() { Id = "magic_sword", Facility = "forge", RequiredLevel = 3, Materials = new(){new(){Id="mana_steel",Amount=2},new(){Id="shiny_mana",Amount=1}}, Result = new(){Id="magic_sword",Amount=1}, WorkRequired = 250 },
            new() { Id = "sage_staff", Facility = "forge", RequiredLevel = 3, Materials = new(){new(){Id="world_branch",Amount=2},new(){Id="shiny_mana",Amount=2}}, Result = new(){Id="sage_staff",Amount=1}, WorkRequired = 300 },

            new() { Id = "leather_cloth", Facility = "forge", RequiredLevel = 1, Materials = new(){new(){Id="beast_leather",Amount=3}}, Result = new(){Id="leather_cloth",Amount=1}, WorkRequired = 40 },
            new() { Id = "iron_armor", Facility = "forge", RequiredLevel = 1, Materials = new(){new(){Id="iron_ingot",Amount=3},new(){Id="beast_leather",Amount=1}}, Result = new(){Id="iron_armor",Amount=1}, WorkRequired = 90 },
            new() { Id = "steel_armor", Facility = "forge", RequiredLevel = 2, Materials = new(){new(){Id="steel_ingot",Amount=3},new(){Id="beast_leather",Amount=2}}, Result = new(){Id="steel_armor",Amount=1}, WorkRequired = 180 },
            new() { Id = "mana_cloak", Facility = "forge", RequiredLevel = 3, Materials = new(){new(){Id="beast_leather",Amount=2},new(){Id="mana_stone",Amount=3}}, Result = new(){Id="mana_cloak",Amount=1}, WorkRequired = 200 }
        };

        foreach (var recipe in list)
        {
            Recipes[recipe.Id] = recipe;
        }
    }

    private void InitAreas()
    {
        // 始まりの森
        var forest = new AreaData { Id = "forest", Name = "始まりの森", Difficulty = 1.0 };
        forest.Gathers.AddRange(new List<GatherData>{ new(){Id="wild_grain",Rate=0.7}, new(){Id="herb",Rate=0.2}, new(){Id="wood",Rate=0.1} });
        forest.Monsters.AddRange(new List<MonsterData>{
            new() { Name = "スライム", Level = 1, Hp = 30, Str = 8, Int = 1, Vit = 2, Exp = 10, Drop = "wild_grain" },
            new() { Name = "ゴブリン", Level = 3, Hp = 50, Str = 12, Int = 2, Vit = 4, Exp = 25, Drop = "raw_meat" }
        });
        forest.Boss = new() { Name = "ゴブリンロード", Level = 5, Hp = 150, Str = 15, Int = 5, Vit = 8, Exp = 100 };
        Areas[forest.Id] = forest;

        // 廃鉱山
        var mine = new AreaData { Id = "mine", Name = "廃鉱山", Difficulty = 2.0 };
        mine.Gathers.AddRange(new List<GatherData>{ new(){Id="stone",Rate=0.5}, new(){Id="iron_ore",Rate=0.4}, new(){Id="coal",Rate=0.1} });
        mine.Monsters.AddRange(new List<MonsterData>{
            new() { Name = "ケーブバット", Level = 6, Hp = 60, Str = 12, Int = 2, Vit = 6, Exp = 40, Drop = "stone" },
            new() { Name = "オーク", Level = 8, Hp = 100, Str = 22, Int = 1, Vit = 12, Exp = 60, Drop = "copper_ore" }
        });
        mine.Boss = new() { Name = "ゴーレム", Level = 12, Hp = 400, Str = 35, Int = 1, Vit = 25, Exp = 300 };
        Areas[mine.Id] = mine;

        // 魔獣の谷
        var valley = new AreaData { Id = "valley", Name = "魔獣の谷", Difficulty = 3.5 };
        valley.Gathers.AddRange(new List<GatherData>{ new(){Id="beast_leather",Rate=0.4}, new(){Id="beast_bone",Rate=0.3}, new(){Id="high_herb",Rate=0.2}, new(){Id="mana_stone",Rate=0.1} });
        valley.Monsters.AddRange(new List<MonsterData>{
            new() { Name = "ウェアウルフ", Level = 14, Hp = 150, Str = 35, Int = 4, Vit = 15, Exp = 120, Drop = "beast_leather" },
            new() { Name = "ワイバーン", Level = 18, Hp = 220, Str = 45, Int = 10, Vit = 20, Exp = 180, Drop = "beast_bone" }
        });
        valley.Boss = new() { Name = "キマイラ", Level = 22, Hp = 800, Str = 70, Int = 30, Vit = 40, Exp = 800 };
        Areas[valley.Id] = valley;

        // 世界樹の根
        var roots = new AreaData { Id = "roots", Name = "世界樹の根", Difficulty = 5.0 };
        roots.Gathers.AddRange(new List<GatherData>{ new(){Id="world_branch",Rate=0.4}, new(){Id="world_leaf",Rate=0.3}, new(){Id="mana_stone",Rate=0.2}, new(){Id="shiny_mana",Rate=0.1} });
        roots.Monsters.AddRange(new List<MonsterData>{
            new() { Name = "エント", Level = 24, Hp = 350, Str = 60, Int = 15, Vit = 35, Exp = 250, Drop = "world_branch" },
            new() { Name = "ピクシー", Level = 28, Hp = 200, Str = 20, Int = 60, Vit = 20, Exp = 350, Drop = "mana_stone" }
        });
        roots.Boss = new() { Name = "アークデーモン", Level = 35, Hp = 1800, Str = 120, Int = 100, Vit = 70, Exp = 2000 };
        Areas[roots.Id] = roots;

        // 深淵の奈落
        var abyss = new AreaData { Id = "abyss", Name = "深淵の奈落", Difficulty = 8.0 };
        abyss.Gathers.AddRange(new List<GatherData>{ new(){Id="abyss_stone",Rate=0.5}, new(){Id="orichalcum_ore",Rate=0.3}, new(){Id="shiny_mana",Rate=0.2} });
        abyss.Monsters.AddRange(new List<MonsterData>{
            new() { Name = "シャドウウォーリア", Level = 38, Hp = 500, Str = 130, Int = 10, Vit = 80, Exp = 500, Drop = "abyss_stone" },
            new() { Name = "ヘルハウンド", Level = 42, Hp = 600, Str = 150, Int = 40, Vit = 90, Exp = 700, Drop = "shiny_mana" }
        });
        abyss.Boss = new() { Name = "終焉の竜", Level = 50, Hp = 5000, Str = 250, Int = 200, Vit = 150, Exp = 10000 };
        Areas[abyss.Id] = abyss;
    }
}
