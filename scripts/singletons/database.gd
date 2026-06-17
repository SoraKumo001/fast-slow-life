extends Node

# アイテムカテゴリ
enum Category {
	FOOD,
	WOOD,
	STONE,
	ORE,
	MANA_STONE,
	MONSTER_MATERIAL,
	INTERMEDIATE,
	CONSUMABLE,
	WEAPON,
	ARMOR
}

# マスタデータ辞書
var items: Dictionary = {}
var jobs: Dictionary = {}
var recipes: Dictionary = {}
var areas: Dictionary = {}

func _ready():
	_init_items()
	_init_jobs()
	_init_recipes()
	_init_areas()

# アイテム定義
func _init_items():
	var data = [
		# 一次素材
		["wild_grain", "野生の穀物", Category.FOOD, "村人の食料となる主食。", 1, 3, {}],
		["raw_meat", "生肉", Category.FOOD, "猟師の討伐行動などで得られる獣の肉。", 3, 9, {}],
		["herb", "薬草", Category.MANA_STONE, "回復薬の基礎となる薬草。", 2, 6, {}], # カテゴリを適宜マッピング
		["high_herb", "高級薬草", Category.MANA_STONE, "より高い効能を持つ珍しい薬草。", 8, 24, {}],
		["wood", "木材", Category.WOOD, "建築や加工に広く使われる木材。", 2, 6, {}],
		["stone", "石材", Category.STONE, "建物の土台や石材加工に使われる。", 2, 6, {}],
		["coal", "石炭", Category.ORE, "鍛冶場の燃料となる可燃性の鉱石。", 4, 12, {}],
		["iron_ore", "鉄鉱石", Category.ORE, "鉄製品の原料となる赤茶けた鉱石。", 5, 15, {}],
		["copper_ore", "銅鉱石", Category.ORE, "青緑色の鉱石。合金の材料。", 3, 9, {}],
		["mana_stone", "魔法石", Category.MANA_STONE, "魔力を秘めた結晶。", 10, 30, {}],
		["shiny_mana", "輝く魔法石", Category.MANA_STONE, "強い魔力を帯び、光を放つ魔法石。", 40, 120, {}],
		["beast_leather", "魔獣の革", Category.MONSTER_MATERIAL, "モンスターから剥ぎ取った頑丈な革。", 6, 18, {}],
		["beast_bone", "魔獣の骨", Category.MONSTER_MATERIAL, "骨製品や薬品の原料となる硬い骨。", 5, 15, {}],
		["world_branch", "世界樹の枝", Category.WOOD, "神秘的な力を宿した強固な枝。", 20, 60, {}],
		["world_leaf", "世界樹の葉", Category.MANA_STONE, "万病を癒すと伝えられる黄金の葉。", 25, 75, {}],
		["abyss_stone", "奈落の石", Category.STONE, "闇の魔力を帯びた漆黒の鉱石。", 30, 90, {}],
		["orichalcum_ore", "オリハルコン鉱石", Category.ORE, "神々の金属と呼ばれる極めて希少な鉱石。", 50, 150, {}],
		
		# 中間素材
		["wood_plank", "頑丈な木板", Category.INTERMEDIATE, "建築用に切り出された強固な木板。", 8, 16, {}],
		["build_stone", "建築用石材", Category.INTERMEDIATE, "滑らかに加工された土台用の石材。", 8, 16, {}],
		["iron_ingot", "鉄インゴット", Category.INTERMEDIATE, "不純物を取り除き鋳造された鉄の塊。", 20, 40, {}],
		["steel_ingot", "鋼鉄インゴット", Category.INTERMEDIATE, "鉄を極限まで鍛え上げた鋼の塊。", 50, 100, {}],
		["mana_steel", "魔鉄インゴット", Category.INTERMEDIATE, "魔力を浸透させた特殊な合金。", 120, 240, {}],
		["orichalcum", "オリハルコン", Category.INTERMEDIATE, "最高品質の硬度と魔導率を誇る超金属。", 300, 600, {}],
		["dry_meat", "干し肉", Category.FOOD, "長期保存が可能な栄養満点の食料。", 10, 20, {}],

		# 消費アイテム
		["potion_s", "回復薬(小)", Category.CONSUMABLE, "使用者のHPを50回復。", 10, 20, {"hp_recover": 50}],
		["potion_l", "回復薬(大)", Category.CONSUMABLE, "使用者のHPを150回復。", 35, 70, {"hp_recover": 150}],
		["elixir", "万能薬", Category.CONSUMABLE, "使用者のHPを全回復し、状態異常を治す。", 100, 200, {"hp_recover_full": true, "remove_debuff": true}],
		["str_pill", "活力の丸薬", Category.CONSUMABLE, "戦闘中、物理攻撃力を高める丸薬。", 30, 60, {"temp_str": 5}],
		["int_pill", "賢者の秘薬", Category.CONSUMABLE, "戦闘中、魔法の威力を高める薬液。", 40, 80, {"temp_int": 5}],

		# 装備品
		["wooden_staff", "木の杖", Category.WEAPON, "魔術師や僧侶が使うシンプルな杖。", 20, 40, {"int": 5}],
		["iron_sword", "鉄の剣", Category.WEAPON, "初心者向けのオーソドックスな鉄剣。", 60, 120, {"str": 10}],
		["steel_sword", "鋼鉄の剣", Category.WEAPON, "重量感があり強固な鋼の剣。", 180, 360, {"str": 25}],
		["magic_sword", "魔法の剣", Category.WEAPON, "刃に魔力が揺らめく美しい片手剣。", 400, 800, {"str": 20, "int": 15}],
		["sage_staff", "賢者の杖", Category.WEAPON, "大魔術師の秘儀が込められた聖なる杖。", 600, 1200, {"int": 35}],
		
		["leather_cloth", "皮の服", Category.ARMOR, "軽量で動きやすい革製の防具。", 20, 40, {"vit": 3}],
		["iron_armor", "鉄の鎧", Category.ARMOR, "ずっしりと重く、物理防御に優れた鉄鎧。", 80, 160, {"vit": 10}],
		["steel_armor", "鋼鉄の鎧", Category.ARMOR, "高い強度の鋼で全身を保護する重鎧。", 240, 480, {"vit": 25}],
		["mana_cloak", "魔力外套", Category.ARMOR, "魔法防御を高めるエンチャントが施された外套。", 300, 600, {"vit": 15, "int": 5}]
	]
	
	for item in data:
		items[item[0]] = {
			"id": item[0],
			"name": item[1],
			"category": item[2],
			"description": item[3],
			"value_sell": item[4],
			"value_buy": item[5],
			"effect_data": item[6]
		}

# 職業定義
func _init_jobs():
	# id, 名前, STR, INT, AGI, DEX, VIT, コスト, 説明, 適性倍率(food, wood/stone/ore, herb/mana, monster)
	var data = [
		["unemployed", "無職", 1.0, 1.0, 1.0, 1.0, 1.0, 0, "初期状態。特徴なし。", {"food": 1.0, "gather_ore": 1.0, "gather_herb": 1.0, "monster": 1.0}],
		["farmer", "農民", 1.1, 0.9, 1.1, 1.0, 1.0, 100, "食料の採取効率が非常に高い。", {"food": 2.0, "gather_ore": 1.0, "gather_herb": 1.0, "monster": 1.0}],
		["miner", "鉱夫", 1.3, 0.7, 0.8, 1.0, 1.2, 150, "鉱石や石材の採取効率が非常に高い。", {"food": 1.0, "gather_ore": 2.0, "gather_herb": 1.0, "monster": 1.0}],
		["herbalist", "薬師", 0.8, 1.2, 1.0, 1.3, 0.8, 150, "薬草の採取効率が非常に高い。", {"food": 1.0, "gather_ore": 1.0, "gather_herb": 2.0, "monster": 1.0}],
		["hunter", "猟師", 1.1, 0.9, 1.2, 1.2, 0.9, 200, "食料と、討伐時の素材採取が得意。", {"food": 1.5, "gather_ore": 1.0, "gather_herb": 1.0, "monster": 1.5}],
		["warrior", "戦士", 1.4, 0.5, 1.1, 1.0, 1.3, 300, "物理戦闘に特化。物理ダメージ+30%", {"food": 1.0, "gather_ore": 1.0, "gather_herb": 1.0, "monster": 1.3}],
		["mage", "魔術師", 0.5, 1.5, 1.0, 1.1, 0.7, 350, "魔法戦闘に特化。魔法石採取が得意。", {"food": 1.0, "gather_ore": 1.0, "gather_herb": 1.5, "monster": 1.2}],
		["priest", "僧侶", 0.8, 1.3, 0.9, 1.1, 1.1, 350, "戦闘中の回復スキルを持つ。生存率UP", {"food": 1.0, "gather_ore": 1.0, "gather_herb": 1.3, "monster": 1.0}],
		["crafter", "職人", 1.0, 1.0, 0.9, 1.4, 1.0, 300, "加工大成功率+20%。採掘も少し得意。", {"food": 1.0, "gather_ore": 1.2, "gather_herb": 1.0, "monster": 1.0}]
	]
	
	for job in data:
		jobs[job[0]] = {
			"id": job[0],
			"name": job[1],
			"str_mod": job[2],
			"int_mod": job[3],
			"agi_mod": job[4],
			"dex_mod": job[5],
			"vit_mod": job[6],
			"cost": job[7],
			"description": job[8],
			"multipliers": job[9]
		}

# レシピ定義
func _init_recipes():
	# レシピID, 施設, 必要施設Lv, 材料, 完成品, 必要作業量
	var data = [
		["wood_plank", "workshop", 1, [{"id": "wood", "amount": 3}], {"id": "wood_plank", "amount": 1}, 30],
		["build_stone", "workshop", 1, [{"id": "stone", "amount": 3}], {"id": "build_stone", "amount": 1}, 30],
		["iron_ingot", "forge", 1, [{"id": "iron_ore", "amount": 3}, {"id": "coal", "amount": 1}], {"id": "iron_ingot", "amount": 1}, 50],
		["steel_ingot", "forge", 2, [{"id": "iron_ingot", "amount": 2}, {"id": "coal", "amount": 2}], {"id": "steel_ingot", "amount": 1}, 80],
		["mana_steel", "forge", 3, [{"id": "steel_ingot", "amount": 1}, {"id": "mana_stone", "amount": 2}], {"id": "mana_steel", "amount": 1}, 120],
		["orichalcum", "forge", 3, [{"id": "orichalcum_ore", "amount": 3}, {"id": "shiny_mana", "amount": 1}], {"id": "orichalcum", "amount": 1}, 200],
		["dry_meat", "workshop", 1, [{"id": "raw_meat", "amount": 2}], {"id": "dry_meat", "amount": 1}, 20],
		
		# 薬品
		["potion_s", "alchemy_lab", 1, [{"id": "herb", "amount": 3}], {"id": "potion_s", "amount": 1}, 30],
		["potion_l", "alchemy_lab", 2, [{"id": "high_herb", "amount": 3}, {"id": "mana_stone", "amount": 1}], {"id": "potion_l", "amount": 1}, 60],
		["elixir", "alchemy_lab", 3, [{"id": "world_leaf", "amount": 1}, {"id": "shiny_mana", "amount": 1}], {"id": "elixir", "amount": 1}, 150],
		
		# 装備
		["wooden_staff", "forge", 1, [{"id": "wood", "amount": 3}], {"id": "wooden_staff", "amount": 1}, 40],
		["iron_sword", "forge", 1, [{"id": "iron_ingot", "amount": 2}, {"id": "wood_plank", "amount": 1}], {"id": "iron_sword", "amount": 1}, 80],
		["steel_sword", "forge", 2, [{"id": "steel_ingot", "amount": 2}, {"id": "wood_plank", "amount": 1}], {"id": "steel_sword", "amount": 1}, 150],
		["magic_sword", "forge", 3, [{"id": "mana_steel", "amount": 2}, {"id": "shiny_mana", "amount": 1}], {"id": "magic_sword", "amount": 1}, 250],
		["sage_staff", "forge", 3, [{"id": "world_branch", "amount": 2}, {"id": "shiny_mana", "amount": 2}], {"id": "sage_staff", "amount": 1}, 300],
		
		["leather_cloth", "forge", 1, [{"id": "beast_leather", "amount": 3}], {"id": "leather_cloth", "amount": 1}, 40],
		["iron_armor", "forge", 1, [{"id": "iron_ingot", "amount": 3}, {"id": "beast_leather", "amount": 1}], {"id": "iron_armor", "amount": 1}, 90],
		["steel_armor", "forge", 2, [{"id": "steel_ingot", "amount": 3}, {"id": "beast_leather", "amount": 2}], {"id": "steel_armor", "amount": 1}, 180],
		["mana_cloak", "forge", 3, [{"id": "beast_leather", "amount": 2}, {"id": "mana_stone", "amount": 3}], {"id": "mana_cloak", "amount": 1}, 200]
	]
	
	for recipe in data:
		recipes[recipe[0]] = {
			"id": recipe[0],
			"facility": recipe[1],
			"required_level": recipe[2],
			"materials": recipe[3],
			"result": recipe[4],
			"work_required": recipe[5]
		}

# エリア・ダンジョン定義
func _init_areas():
	# ID, 名前, 解放の必要施設, 探索難易度, 採取(id, 確率), 通常敵リスト(名前, LV, HP, STR, INT, VIT, EXP, ドロップ), ボス(名前, LV, HP, STR, INT, VIT, EXP)
	areas["forest"] = {
		"id": "forest",
		"name": "始まりの森",
		"difficulty": 1.0,
		"gathers": [{"id": "wild_grain", "rate": 0.7}, {"id": "herb", "rate": 0.2}, {"id": "wood", "rate": 0.1}],
		"monsters": [
			{"name": "スライム", "level": 1, "hp": 20, "str": 4, "int": 1, "vit": 2, "exp": 10, "drop": "wild_grain"},
			{"name": "ゴブリン", "level": 3, "hp": 40, "str": 8, "int": 2, "vit": 4, "exp": 25, "drop": "raw_meat"}
		],
		"boss": {"name": "ゴブリンロード", "level": 5, "hp": 150, "str": 15, "int": 5, "vit": 8, "exp": 100}
	}
	
	areas["mine"] = {
		"id": "mine",
		"name": "廃鉱山",
		"difficulty": 2.0,
		"gathers": [{"id": "stone", "rate": 0.5}, {"id": "iron_ore", "rate": 0.4}, {"id": "coal", "rate": 0.1}],
		"monsters": [
			{"name": "ケーブバット", "level": 6, "hp": 60, "str": 12, "int": 2, "vit": 6, "exp": 40, "drop": "stone"},
			{"name": "オーク", "level": 8, "hp": 100, "str": 22, "int": 1, "vit": 12, "exp": 60, "drop": "copper_ore"}
		],
		"boss": {"name": "ゴーレム", "level": 12, "hp": 400, "str": 35, "int": 1, "vit": 25, "exp": 300}
	}
	
	areas["valley"] = {
		"id": "valley",
		"name": "魔獣の谷",
		"difficulty": 3.5,
		"gathers": [{"id": "beast_leather", "rate": 0.4}, {"id": "beast_bone", "rate": 0.3}, {"id": "high_herb", "rate": 0.2}, {"id": "mana_stone", "rate": 0.1}],
		"monsters": [
			{"name": "ウェアウルフ", "level": 14, "hp": 150, "str": 35, "int": 4, "vit": 15, "exp": 120, "drop": "beast_leather"},
			{"name": "ワイバーン", "level": 18, "hp": 220, "str": 45, "int": 10, "vit": 20, "exp": 180, "drop": "beast_bone"}
		],
		"boss": {"name": "キマイラ", "level": 22, "hp": 800, "str": 70, "int": 30, "vit": 40, "exp": 800}
	}

	areas["roots"] = {
		"id": "roots",
		"name": "世界樹の根",
		"difficulty": 5.0,
		"gathers": [{"id": "world_branch", "rate": 0.4}, {"id": "world_leaf", "rate": 0.3}, {"id": "mana_stone", "rate": 0.2}, {"id": "shiny_mana", "rate": 0.1}],
		"monsters": [
			{"name": "エント", "level": 24, "hp": 350, "str": 60, "int": 15, "vit": 35, "exp": 250, "drop": "world_branch"},
			{"name": "ピクシー", "level": 28, "hp": 200, "str": 20, "int": 60, "vit": 20, "exp": 350, "drop": "mana_stone"}
		],
		"boss": {"name": "アークデーモン", "level": 35, "hp": 1800, "str": 120, "int": 100, "vit": 70, "exp": 2000}
	}

	areas["abyss"] = {
		"id": "abyss",
		"name": "深淵の奈落",
		"difficulty": 8.0,
		"gathers": [{"id": "abyss_stone", "rate": 0.5}, {"id": "orichalcum_ore", "rate": 0.3}, {"id": "shiny_mana", "rate": 0.2}],
		"monsters": [
			{"name": "シャドウウォーリア", "level": 38, "hp": 500, "str": 130, "int": 10, "vit": 80, "exp": 500, "drop": "abyss_stone"},
			{"name": "ヘルハウンド", "level": 42, "hp": 600, "str": 150, "int": 40, "vit": 90, "exp": 700, "drop": "shiny_mana"}
		],
		"boss": {"name": "終焉の竜", "level": 50, "hp": 5000, "str": 250, "int": 200, "vit": 150, "exp": 10000}
	}
