extends Node

signal game_state_updated
signal log_added(message: String)

# --- ゲームの状態変数 ---
var gold: int = 0
var food: int = 0
var food_fraction: float = 0.0 # 食料の端数管理用
var soul_points: int = 0

var current_day: int = 1
var current_hour: int = 8      # 0 ~ 23 (初期値8時)
var target_day: int = 30
var current_tier: int = 1
var target_boss_id: String = "goblin_lord" # 実装上はエリア名と紐づく

var villagers: Array[Villager] = []
var inventory: Dictionary = {} # item_id (String) -> count (int)
var facility_levels: Dictionary = {
	"inn": 1,
	"workshop": 1,
	"forge": 0,       # Tier 1ボス撃破で解放
	"alchemy_lab": 0, # Tier 2ボス撃破で解放
	"trading_post": 0 # Tier 3ボス撃破で解放
}
var explore_rates: Dictionary = {
	"forest": 0.0,
	"mine": 0.0,
	"valley": 0.0,
	"roots": 0.0,
	"abyss": 0.0
}
var defeated_bosses: Array[String] = []

# --- 永続バフ (周回ショップ) ---
var perma_buffs: Dictionary = {
	"heritage": 0,  # 初期ゴールド +500 / Lv
	"stock": 0,     # 初期食料 +100 / Lv
	"education": 0, # 獲得EXP +10% / Lv (最大5)
	"body": 0,      # 初期ステータス +2 / Lv (最大5)
	"building": 0,  # 施設アップグレード素材 -5% / Lv (最大5)
	"discount": 0   # 転職コスト -10% / Lv (最大5)
}

# --- 状態フラグ ---
var is_game_over: bool = false
var is_game_cleared: bool = false

# --- 自動取引の設定 ---
# {"item_id": {"sell_over": 100, "buy_under": 50, "buy_amount": 20}}
var auto_trade_settings: Dictionary = {}

# --- クラフト中の仕事 ---
# {"recipe_id": work_progress}
var active_crafts: Dictionary = {}

# --- 施設アップグレード中の進行時間 (時間単位) ---
# {"facility_id": remaining_hours}
var active_upgrades: Dictionary = {}

func _ready():
	# ゲームの初期セットアップ
	start_new_game(true)

# ゲームの新規開始
func start_new_game(reset_all: bool = false):
	if reset_all:
		perma_buffs = {
			"heritage": 0, "stock": 0, "education": 0,
			"body": 0, "building": 0, "discount": 0
		}
		soul_points = 0
		
	gold = 1000 + perma_buffs["heritage"] * 500
	food = 200 + perma_buffs["stock"] * 100
	food_fraction = 0.0
	current_day = 1
	current_hour = 8
	target_day = 30
	current_tier = 1
	is_game_over = false
	is_game_cleared = false
	
	inventory.clear()
	# 初期アイテム
	inventory["wood"] = 10
	inventory["stone"] = 10
	
	facility_levels = {
		"inn": 1,
		"workshop": 1,
		"forge": 0,
		"alchemy_lab": 0,
		"trading_post": 0
	}
	
	explore_rates = {
		"forest": 0.0, "mine": 0.0, "valley": 0.0, "roots": 0.0, "abyss": 0.0
	}
	defeated_bosses.clear()
	active_crafts.clear()
	active_upgrades.clear()
	auto_trade_settings.clear()
	
	# 初期村人の生成 (3人)
	villagers.clear()
	_create_villager("アルク", "farmer")
	_create_villager("ルナ", "miner")
	_create_villager("ガイア", "warrior")
	
	add_log("=== 新しいゲームが開始されました ===")
	add_log("初期村人: アルク(農民)、ルナ(鉱夫)、ガイア(戦士) が加入しました。")
	add_log("30日目までに「始まりの森」のボス「ゴブリンロード」を倒してください！")
	
	emit_signal("game_state_updated")

func _create_villager(v_name: String, job_id: String):
	var v = Villager.new()
	v.name = v_name
	v.current_job = job_id
	v.job_history = [job_id]
	v.level = 1
	v.exp = 0
	
	# 永続バフ補正
	var buff_bonus = perma_buffs["body"] * 2
	v.base_str = 10 + buff_bonus + (randi() % 3)
	v.base_int = 10 + buff_bonus + (randi() % 3)
	v.base_dex = 10 + buff_bonus + (randi() % 3)
	v.base_agi = 10 + buff_bonus + (randi() % 3)
	v.base_vit = 10 + buff_bonus + (randi() % 3)
	v.base_max_hp = 100 + buff_bonus * 5
	v.current_hp = v.get_max_hp()
	
	v.order = "gather"
	v.assigned_area = "forest"
	v.travel_time = 2 # 始まりの森(difficulty 1.0)への初期移動時間 (difficulty * 2)
	v.is_dead = false
	
	villagers.append(v)

func add_log(msg: String):
	emit_signal("log_added", msg)

# 1日進める
func advance_day():
	if is_game_over: return
	
	add_log("\n--- Day %d ---" % current_day)
	for i in range(24):
		if is_game_over: break
		advance_hour()

# 1時間進める
func advance_hour():
	if is_game_over: return
	
	current_hour += 1
	if current_hour >= 24:
		current_hour = 0
		current_day += 1
		add_log("\n--- Day %d ---" % current_day)
		
		# 期限チェック
		if current_day > target_day:
			trigger_game_over()
			emit_signal("game_state_updated")
			return
			
	# 1. 食料消費と飢餓判定
	_process_food_hourly()

	# 2. 施設のクラフト・アップグレード進行
	_process_crafting_hourly()
	_process_upgrades_hourly()

	# 3. 村人の行動処理
	_process_villagers_hourly()

	# 4. 施設の自動取引処理 (交易所) - 毎日午前0時に実行
	if current_hour == 0 and facility_levels["trading_post"] >= 1:
		_process_auto_trading()

	emit_signal("game_state_updated")

# 1時間ごとの食料消費
func _process_food_hourly():
	var alive_count = get_alive_villagers_count()
	var food_consumed_hourly = alive_count * (1.0 / 24.0)
	food_fraction += food_consumed_hourly
	
	var consumed_int = int(food_fraction)
	if consumed_int > 0:
		food_fraction -= consumed_int
		if food >= consumed_int:
			food -= consumed_int
		else:
			food = 0

# 1時間ごとのクラフト処理
func _process_crafting_hourly():
	var craft_power = 0
	for v in villagers:
		if v.is_dead: continue
		if v.current_job == "crafter" and v.order == "inn":
			craft_power += v.get_dex()
			
	var hourly_power = (craft_power + 10) / 24.0
	
	var completed = []
	for recipe_id in active_crafts.keys():
		active_crafts[recipe_id] -= hourly_power
		if active_crafts[recipe_id] <= 0:
			var recipe = Database.recipes[recipe_id]
			var result = recipe.result
			var success_msg = ""
			var amount = result.amount
			if randf() < (craft_power * 0.001):
				amount += 1
				success_msg = " (大成功！)"
				
			_add_to_inventory(result.id, amount)
			add_log("[%02d:00][クラフト完成] %s を %d 個作成しました。%s" % [current_hour, Database.items[result.id].name, amount, success_msg])
			completed.append(recipe_id)
			
	for r in completed:
		active_crafts.erase(r)

# 1時間ごとの施設アップグレード処理
func _process_upgrades_hourly():
	var completed = []
	for fac_id in active_upgrades.keys():
		active_upgrades[fac_id] -= 1
		if active_upgrades[fac_id] <= 0:
			var next_lv = facility_levels[fac_id] + 1
			facility_levels[fac_id] = next_lv
			add_log("[%02d:00][施設アップグレード完了] 施設「%s」がレベル %d になりました！" % [current_hour, _get_facility_name(fac_id), next_lv])
			
			if fac_id == "forge" and next_lv == 1:
				add_log("鍛冶屋が村に建設されました！装備を加工・強化できます。")
			elif fac_id == "alchemy_lab" and next_lv == 1:
				add_log("錬金工房が村に建設されました！薬品をクラフトできます。")
			elif fac_id == "trading_post" and next_lv == 1:
				add_log("交易所が村に建設されました！自動売買機能が有効です。")
				
			completed.append(fac_id)
			
	for f in completed:
		active_upgrades.erase(f)

func _get_facility_name(fac_id: String) -> String:
	match fac_id:
		"inn": return "宿屋"
		"workshop": return "工房"
		"forge": return "鍛冶屋"
		"alchemy_lab": return "錬金工房"
		"trading_post": return "交易所"
	return fac_id

# 1時間ごとの村人処理
func _process_villagers_hourly():
	var starvation = (food <= 0)
	if starvation and get_alive_villagers_count() > 0 and current_hour % 4 == 0:
		add_log("[%02d:00][警告] 食料が不足しています！村人が飢えています。" % current_hour)
	
	for v in villagers:
		if v.is_dead: continue
		
		# 飢餓ダメージ（毎時間 0.4%）
		if starvation:
			var dmg = max(1, int(v.get_max_hp() * 0.004))
			var dead = v.take_damage(dmg)
			if dead:
				add_log("[%02d:00][悲報] %s は飢えにより死亡した。" % [current_hour, v.name])
				continue
				
		if v.order == "inn":
			_process_villager_inn_hourly(v)
		elif v.order in ["gather", "hunt"]:
			_process_villager_expedition_hourly(v, starvation)

# 宿屋滞在者の1時間処理
func _process_villager_inn_hourly(v: Villager):
	var inn_lv = facility_levels["inn"]
	
	# HP回復
	var heal_percent = 0.3 / 24.0
	if inn_lv == 2: heal_percent = 0.5 / 24.0
	elif inn_lv == 3: heal_percent = 0.7 / 24.0
	elif inn_lv >= 4: heal_percent = 1.0 / 24.0
	
	var heal_amount = max(1, int(v.get_max_hp() * heal_percent))
	v.heal(heal_amount)
	
	# スタミナ回復
	var stamina_heal = 10
	if inn_lv == 2: stamina_heal = 15
	elif inn_lv == 3: stamina_heal = 20
	elif inn_lv >= 4: stamina_heal = 25
	v.heal_stamina(stamina_heal)
	
	# 職人(crafter)以外の村人で、HPとスタミナが全回復した場合は自動的に元の行動を再開
	if v.current_job != "crafter" and v.current_hp >= v.get_max_hp() and v.current_stamina >= v.get_max_stamina():
		var next_order = v.last_active_order
		var next_area = v.last_active_area
		
		# 無限ループ防止用のデフォルトフォールバック
		if next_order == "inn" or next_order == "":
			next_order = "gather"
			next_area = "forest"
			
		v.order = next_order
		v.assigned_area = next_area
		
		var area = Database.areas.get(next_area)
		if area:
			var req_travel = area.difficulty * 2
			v.travel_time = req_travel
			v.is_returning = false
			add_log("[%02d:00][休息完了] %s は全回復し、「%s」へ再出発しました。(所要時間: %d時間)" % [current_hour, v.name, area.name, req_travel])
		else:
			v.travel_time = 0
			add_log("[%02d:00][休息完了] %s は全回復しました。" % [current_hour, v.name])

# 派遣メンバーの1時間処理
func _process_villager_expedition_hourly(v: Villager, starvation: bool):
	# スタミナ消費
	var exhausted = v.consume_stamina(5)
	if exhausted:
		add_log("[%02d:00][疲労] %s はスタミナ切れのため、宿屋で休養を開始しました。" % [current_hour, v.name])
		v.order = "inn"
		v.travel_time = 0
		v.is_returning = false
		return
		
	var area = Database.areas.get(v.assigned_area)
	if not area: return
	
	var required_travel_time = area.difficulty * 2
	
	
		
	# 移動中の処理
	if v.travel_time > 0:
		v.travel_time -= 1
		if v.travel_time == 0:
			if v.is_returning:
				add_log("[%02d:00] %s は村に帰還し、宿屋で休養を開始しました。" % [current_hour, v.name])
				v.order = "inn"
				v.is_returning = false
			else:
				add_log("[%02d:00] %s が「%s」に到着し、活動を開始しました。" % [current_hour, v.name, area.name])
		return
		
	# 現地活動（遭遇率 30%）
	if randf() < 0.30:
		var str_val = v.get_str()
		var int_val = v.get_int()
		var dex_val = v.get_dex()
		var agi_val = v.get_agi()
		if starvation:
			str_val /= 2
			int_val /= 2
			dex_val /= 2
			agi_val /= 2
			
		if v.order == "gather":
			_process_villager_gather_hourly(v, area, str_val, int_val, dex_val, agi_val)
		elif v.order == "hunt":
			_process_villager_hunt_hourly(v, area, str_val, int_val, dex_val, agi_val)

# 派遣先の変更
func change_villager_area(v: Villager, area_id: String):
	if not Database.areas.has(area_id): return
	var old_area = v.assigned_area
	v.assigned_area = area_id
	
	# 現在すでに現地にいるか移動中の場合、移動時間をリセットして再出発
	var area = Database.areas[area_id]
	v.travel_time = area.difficulty * 2
	v.is_returning = false
	add_log("%s の派遣先を「%s」に変更しました。移動を開始します。(所要時間: %d時間)" % [v.name, area.name, v.travel_time])

# 生存村人数
func get_alive_villagers_count() -> int:
	var c = 0
	for v in villagers:
		if not v.is_dead: c += 1
	return c

# 採取のシミュレーション（1時間単位）
func _process_villager_gather_hourly(v: Villager, area: Dictionary, str_val: int, int_val: int, dex_val: int, agi_val: int):
	var explore_gain = ((dex_val * 0.2 + agi_val * 0.2) / area.difficulty) * 0.1
	explore_rates[v.assigned_area] = min(100.0, explore_rates[v.assigned_area] + explore_gain)
	
	var job = Database.jobs.get(v.current_job)
	
	# 各アイテムの採取スコア（重み）を計算
	var gather_scores = []
	var total_score = 0.0
	
	for g in area.gathers:
		var item = Database.items.get(g.id)
		if not item: continue
		
		var base_mult = 1.0 / area.difficulty
		var job_mod = 1.0
		if job:
			var category = item.category
			if category == Database.Category.FOOD:
				job_mod = job.multipliers.get("food", 1.0)
			elif category in [Database.Category.WOOD, Database.Category.STONE, Database.Category.ORE]:
				job_mod = job.multipliers.get("gather_ore", 1.0)
			elif category in [Database.Category.MANA_STONE]:
				job_mod = job.multipliers.get("gather_herb", 1.0)
				
		var stat_val = 0.0
		if item.category in [Database.Category.FOOD, Database.Category.WOOD, Database.Category.STONE, Database.Category.ORE]:
			stat_val = str_val * 0.7 + dex_val * 0.3
		else:
			stat_val = int_val * 0.7 + dex_val * 0.3
			
		var score = base_mult * job_mod * stat_val * (1.0 + agi_val * 0.01) * g.rate
		score = max(0.001, score) # スコアが0以下になるのを防ぐ
		
		gather_scores.append({"id": g.id, "score": score})
		total_score += score
		
	# 重み付きランダム抽選
	var best_item_id = ""
	if total_score > 0.0:
		var r = randf() * total_score
		var cumulative = 0.0
		for entry in gather_scores:
			cumulative += entry.score
			if r <= cumulative:
				best_item_id = entry.id
				break
				
	if best_item_id != "":
		var amount = 1
		if randf() < 0.2:
			amount += 1
			
		_add_to_inventory(best_item_id, amount)
		add_log("[%02d:00] %s は「%s」で %s を %d 個採取した。(探索率: %.1f%%)" % [current_hour, v.name, area.name, Database.items[best_item_id].name, amount, explore_rates[v.assigned_area]])
		
		var exp_gain = int(2 * area.difficulty)
		var exp_log = v.add_exp(_calc_exp_with_buff(exp_gain))
		if exp_log != "":
			add_log(exp_log)

# 討伐のシミュレーション（1時間単位）
func _process_villager_hunt_hourly(v: Villager, area: Dictionary, str_val: int, int_val: int, dex_val: int, agi_val: int):
	if float(v.current_hp) / v.get_max_hp() < 0.3:
		add_log("[%02d:00] %s はHPが低下しているため、討伐をやめ宿屋へ戻りました。" % [current_hour, v.name])
		v.order = "inn"
		return
		
	var best_monster = null
	var min_lv_diff = 999
	for m in area.monsters:
		var diff = abs(v.level - m.level)
		if diff < min_lv_diff:
			min_lv_diff = diff
			best_monster = m
			
	if best_monster:
		var enemy = best_monster.duplicate()
		var battle_log = _simulate_battle(v, enemy, str_val, int_val, dex_val, agi_val)
		add_log("[%02d:00] %s" % [current_hour, battle_log.replace("\n", "\n[%02d:00] " % current_hour)])

# 経験値補正計算
func _calc_exp_with_buff(base_exp: int) -> int:
	var mod = 1.0 + perma_buffs["education"] * 0.1
	return int(base_exp * mod)

# インベントリ追加
func _add_to_inventory(item_id: String, amount: int):
	if inventory.has(item_id):
		inventory[item_id] += amount
	else:
		inventory[item_id] = amount

# インベントリ消費（足りていれば消費してtrue）
func _consume_from_inventory(item_id: String, amount: int) -> bool:
	if inventory.has(item_id) and inventory[item_id] >= amount:
		inventory[item_id] -= amount
		if inventory[item_id] == 0:
			inventory.erase(item_id)
		return true
	return false



# 戦闘シミュレーション (1 vs 1)
func _simulate_battle(v: Villager, enemy: Dictionary, str_val: int, int_val: int, dex_val: int, agi_val: int) -> String:
	var log_msg = "%s は %s (LV %d) と戦闘を開始した。" % [v.name, enemy.name, enemy.level]
	var turns = 0
	var is_victory = false
	
	while turns < 10:
		turns += 1
		# 1. プレイヤーの攻撃
		var p_hit = 85 + (dex_val - enemy.vit) * 1.5
		if randf() * 100 <= p_hit:
			# ダメージ
			var dmg = 0
			var is_magic = (v.current_job == "mage" or v.current_job == "priest")
			if is_magic:
				dmg = int_val * 1.8 - enemy.int * 0.5
			else:
				dmg = str_val * 1.5 - enemy.vit * 0.5
			dmg = max(1, int(dmg))
			
			# クリティカル
			var crit = dex_val * 0.1
			if randf() * 100 < crit:
				dmg = int(dmg * 1.5)
				log_msg += " (クリティカル!)"
				
			enemy.hp -= dmg
			log_msg += " %sの攻撃 -> %d ダメージ! (敵HP: %d)" % [v.name, dmg, max(0, enemy.hp)]
			if enemy.hp <= 0:
				is_victory = true
				break
		else:
			log_msg += " %sの攻撃は外れた。" % v.name
			
		# 2. 敵の攻撃
		var e_hit = 85 + (enemy.vit - agi_val) * 1.5
		if randf() * 100 <= e_hit:
			var dmg = max(1, int(enemy.str * 1.2 - v.get_vit() * 0.5))
			var dead = v.take_damage(dmg)
			log_msg += " %sの反撃 -> %d ダメージ! (%sHP: %d/%d)" % [enemy.name, dmg, v.name, v.current_hp, v.get_max_hp()]
			if dead:
				log_msg += " [死亡] %s は力尽きた…" % v.name
				break
		else:
			log_msg += " %sの攻撃を回避した。" % enemy.name
			
	if is_victory:
		log_msg += "\n-> %s に勝利した！" % enemy.name
		# 報酬
		var exp_gain = _calc_exp_with_buff(enemy.exp)
		var exp_log = v.add_exp(exp_gain)
		log_msg += " 経験値 %d 獲得。%s" % [exp_gain, exp_log]
		
		# ゴールド
		var g_gain = enemy.level * 10 + (randi() % 10)
		gold += g_gain
		log_msg += " %d ゴールド獲得。" % g_gain
		
		# ドロップ
		if randf() < 0.5:
			_add_to_inventory(enemy.drop, 1)
			log_msg += " %s を手に入れた。" % Database.items[enemy.drop].name
	else:
		if not v.is_dead:
			log_msg += "\n-> 制限ターン超過、または敗北により %s は一時撤退した。" % v.name
			
	return log_msg



# クラフトの開始
func start_craft(recipe_id: String) -> bool:
	if not Database.recipes.has(recipe_id): return false
	var recipe = Database.recipes[recipe_id]
	
	# レベルチェック
	var facility = recipe.facility
	if facility_levels[facility] < recipe.required_level:
		add_log("施設レベルが不足しています。")
		return false
		
	# 素材チェック
	for m in recipe.materials:
		if not inventory.has(m.id) or inventory[m.id] < m.amount:
			add_log("クラフト素材が不足しています。")
			return false
			
	# 消費
	for m in recipe.materials:
		_consume_from_inventory(m.id, m.amount)
		
	active_crafts[recipe_id] = recipe.work_required
	add_log("%s のクラフトを開始しました。" % Database.items[recipe.result.id].name)
	emit_signal("game_state_updated")
	return true

# 施設アップグレードコストの取得（バフ適用前）
func get_facility_upgrade_cost_raw(fac_id: String, next_lv: int) -> Dictionary:
	var cost_gold = 0
	var cost_items = [] # Array of Dictionary {"id": String, "amount": int}
	
	if fac_id == "inn":
		if next_lv == 2:
			cost_gold = 500
			cost_items = [{"id": "wood", "amount": 20}]
		elif next_lv == 3:
			cost_gold = 1500
			cost_items = [{"id": "wood_plank", "amount": 15}, {"id": "dry_meat", "amount": 30}]
		elif next_lv == 4:
			cost_gold = 5000
			cost_items = [{"id": "build_stone", "amount": 20}, {"id": "iron_ingot", "amount": 10}]
	elif fac_id == "workshop":
		if next_lv == 2:
			cost_gold = 800
			cost_items = [{"id": "wood", "amount": 30}, {"id": "stone", "amount": 30}]
		elif next_lv == 3:
			cost_gold = 2500
			cost_items = [{"id": "wood_plank", "amount": 20}, {"id": "iron_ingot", "amount": 5}]
	elif fac_id == "forge":
		if next_lv == 2:
			cost_gold = 3000
			cost_items = [{"id": "iron_ingot", "amount": 15}, {"id": "coal", "amount": 30}]
		elif next_lv == 3:
			cost_gold = 8000
			cost_items = [{"id": "steel_ingot", "amount": 10}, {"id": "mana_stone", "amount": 15}]
	elif fac_id == "alchemy_lab":
		if next_lv == 2:
			cost_gold = 3500
			cost_items = [{"id": "herb", "amount": 50}, {"id": "mana_stone", "amount": 25}]
		elif next_lv == 3:
			cost_gold = 9000
			cost_items = [{"id": "high_herb", "amount": 20}, {"id": "shiny_mana", "amount": 10}]
	elif fac_id == "trading_post":
		if next_lv == 2:
			cost_gold = 4000
			cost_items = [{"id": "iron_ingot", "amount": 10}]
		elif next_lv == 3:
			cost_gold = 10000
			cost_items = [{"id": "steel_ingot", "amount": 10}]
			
	return {"gold": cost_gold, "items": cost_items}

# バフを適用した実際のアップグレードコスト
func get_facility_upgrade_cost(fac_id: String) -> Dictionary:
	var next_lv = facility_levels.get(fac_id, 0) + 1
	if next_lv > 4:
		return {"gold": 0, "items": []}
		
	var raw = get_facility_upgrade_cost_raw(fac_id, next_lv)
	var discount = 1.0 - perma_buffs["building"] * 0.05
	
	var cost_gold = int(raw.gold * discount)
	var cost_items = []
	for m in raw.items:
		cost_items.append({
			"id": m.id,
			"amount": max(1, int(m.amount * discount))
		})
		
	return {"gold": cost_gold, "items": cost_items}

# 施設アップグレード（開始）
func upgrade_facility(fac_id: String) -> bool:
	if not facility_levels.has(fac_id): return false
	var next_lv = facility_levels[fac_id] + 1
	if next_lv > 4: return false # 最大Lv4
	
	if active_upgrades.has(fac_id):
		add_log("すでにアップグレード中です。")
		return false
		
	var cost = get_facility_upgrade_cost(fac_id)
	var cost_gold = cost.gold
	var cost_items = cost.items
		
	# 支払いチェック
	if gold < cost_gold:
		add_log("ゴールドが不足しています！")
		return false
		
	for m in cost_items:
		if not inventory.has(m.id) or inventory[m.id] < m.amount:
			add_log("アップグレード素材 %s が不足しています。" % Database.items[m.id].name)
			return false
			
	# 消費
	gold -= cost_gold
	for m in cost_items:
		_consume_from_inventory(m.id, m.amount)
		
	# 必要時間（例: 施設レベルアップごとに 4時間 * next_lv）
	var req_hours = next_lv * 4
	active_upgrades[fac_id] = req_hours
	add_log("施設「%s」のアップグレード（Lv.%dへ）を開始しました。(所要時間: %d時間)" % [_get_facility_name(fac_id), next_lv, req_hours])
	
	emit_signal("game_state_updated")
	return true

# 自動取引の処理
func _process_auto_trading():
	var fee = 0.2
	if facility_levels["trading_post"] == 2: fee = 0.1
	elif facility_levels["trading_post"] >= 3: fee = 0.05
	
	for item_id in auto_trade_settings.keys():
		var rule = auto_trade_settings[item_id]
		var count = inventory.get(item_id, 0)
		var item = Database.items[item_id]
		
		# 売却
		if rule.has("sell_over") and count > rule["sell_over"]:
			var sell_amt = count - rule["sell_over"]
			var gain = int(sell_amt * item.value_sell * (1.0 - fee))
			if _consume_from_inventory(item_id, sell_amt):
				gold += gain
				add_log("[自動取引] %s を %d 個売却し、%d G獲得しました。" % [item.name, sell_amt, gain])
				
		# 購入
		count = inventory.get(item_id, 0)
		if rule.has("buy_under") and count < rule["buy_under"]:
			var buy_amt = rule.get("buy_amount", 10)
			var cost = int(buy_amt * item.value_buy * (1.0 + fee))
			if gold >= cost:
				gold -= cost
				_add_to_inventory(item_id, buy_amt)
				add_log("[自動取引] %s を %d 個購入し、%d G消費しました。" % [item.name, buy_amt, cost])

# 転職
func change_job(v: Villager, job_id: String) -> bool:
	if not Database.jobs.has(job_id): return false
	var job = Database.jobs[job_id]
	
	var cost = job.cost
	# 既に一度ついたことのある職業なら無料
	if job_id in v.job_history:
		cost = 0
	else:
		# 転職割引バフ
		var discount = 1.0 - perma_buffs["discount"] * 0.1
		cost = int(cost * discount)
		
	if gold < cost:
		add_log("転職費用ゴールドが不足しています！")
		return false
		
	gold -= cost
	v.current_job = job_id
	if not job_id in v.job_history:
		v.job_history.append(job_id)
		
	add_log("%s が職業を「%s」に変更しました。" % [v.name, job.name])
	emit_signal("game_state_updated")
	return true

# ボスへの挑戦
func challenge_boss(area_id: String) -> bool:
	var area = Database.areas.get(area_id)
	if not area: return false
	
	if explore_rates[area_id] < 100.0:
		add_log("まだ探索度が100%に達していません。")
		return false
		
	var boss = area.boss
	add_log("\n=== ボス戦開始: vs %s ===" % boss.name)
	
	# ボス戦（生存している村人全員で挑む）
	var combatants = []
	for v in villagers:
		if not v.is_dead:
			combatants.append(v)
			
	if combatants.size() == 0:
		add_log("戦闘可能な村人がいません！")
		return false
		
	# ボスデータ
	var boss_hp = boss.hp
	var turn = 0
	var victory = false
	
	while turn < 20 and boss_hp > 0:
		turn += 1
		# 村人の攻撃
		for v in combatants:
			if v.is_dead: continue
			var hit = 85 + (v.get_dex() - boss.vit) * 1.5
			if randf() * 100 <= hit:
				var is_magic = (v.current_job == "mage" or v.current_job == "priest")
				var dmg = 0
				if is_magic:
					dmg = v.get_int() * 1.8 - boss.int * 0.5
				else:
					dmg = v.get_str() * 1.5 - boss.vit * 0.5
				dmg = max(1, int(dmg))
				
				# クリティカル
				if randf() * 100 < v.get_dex() * 0.1:
					dmg = int(dmg * 1.5)
				
				boss_hp -= dmg
				add_log("%s の攻撃 -> %s に %d ダメージ! (ボスHP: %d)" % [v.name, boss.name, dmg, max(0, boss_hp)])
				if boss_hp <= 0:
					victory = true
					break
			else:
				add_log("%s の攻撃は回避された。" % v.name)
				
		if victory: break
		
		# ボスの攻撃（ランダムな村人1人）
		var alive_v = []
		for v in combatants:
			if not v.is_dead: alive_v.append(v)
		if alive_v.size() == 0: break
		
		var target = alive_v[randi() % alive_v.size()]
		var boss_hit = 85 + (boss.vit - target.get_agi()) * 1.5
		if randf() * 100 <= boss_hit:
			var dmg = max(1, int(boss.str * 1.5 - target.get_vit() * 0.5))
			var dead = target.take_damage(dmg)
			add_log("%s の攻撃 -> %s に %d ダメージ! (HP: %d/%d)" % [boss.name, target.name, dmg, target.current_hp, target.get_max_hp()])
			if dead:
				add_log("[警告] %s はボス戦で倒れた！" % target.name)
		else:
			add_log("%s の攻撃を回避した！" % target.name)
			
		# ヒーラー（僧侶）の自動回復アクション
		for v in combatants:
			if v.is_dead or v.current_job != "priest": continue
			# 最もHPの減っている人を回復
			var low_hp_v = null
			var min_hp_ratio = 1.0
			for av in alive_v:
				var r = float(av.current_hp) / av.get_max_hp()
				if r < min_hp_ratio:
					min_hp_ratio = r
					low_hp_v = av
			if low_hp_v and min_hp_ratio < 0.8:
				var heal_amt = int(v.get_int() * 1.5)
				low_hp_v.heal(heal_amt)
				add_log("[スキル] 僧侶 %s のヒール -> %s のHPが %d 回復した。" % [v.name, low_hp_v.name, heal_amt])
				
	if victory:
		add_log("=== 勝利！ %s を撃破した！ ===" % boss.name)
		defeated_bosses.append(area_id)
		
		# 報酬
		var exp_gain = boss.exp
		for v in combatants:
			if not v.is_dead:
				var l = v.add_exp(exp_gain)
				if l != "": add_log(l)
				
		gold += boss.level * 200
		
		# Tier進行と次のボス設定
		if current_tier == 1:
			current_tier = 2
			target_day += 40 # 期限+40日
			facility_levels["forge"] = 1 # 鍛冶屋解放
			add_log("鍛冶屋が村に建設されました！装備を加工・強化できます。")
			add_log("次の目標: 累計 %d日目までに「廃鉱山」のボス「ゴーレム」を倒せ！" % target_day)
		elif current_tier == 2:
			current_tier = 3
			target_day += 50
			facility_levels["alchemy_lab"] = 1 # 錬金工房解放
			add_log("錬金工房が村に建設されました！薬品をクラフトできます。")
			add_log("次の目標: 累計 %d日目までに「魔獣の谷」のボス「キマイラ」を倒せ！" % target_day)
		elif current_tier == 3:
			current_tier = 4
			target_day += 60
			facility_levels["trading_post"] = 1 # 交易所解放
			add_log("交易所が村に建設されました！売買が可能です。")
			add_log("次の目標: 累計 %d日目までに「世界樹の根」のボス「アークデーモン」を倒せ！" % target_day)
		elif current_tier == 4:
			current_tier = 5
			target_day += 70
			add_log("次の目標: 累計 %d日目までに「深淵の奈落」のボス「終焉の竜」を倒せ！" % target_day)
		elif current_tier == 5:
			is_game_cleared = true
			add_log("=== おめでとうございます！終焉の竜を倒し、世界に平和が訪れました！ ===")
			
		emit_signal("game_state_updated")
		return true
	else:
		add_log("=== 敗北… ボス %s に敗れました。 ===" % boss.name)
		emit_signal("game_state_updated")
		return false

# ゲームオーバー処理
func trigger_game_over():
	is_game_over = true
	add_log("\n=== GAME OVER ===")
	add_log("目標期限を過ぎたか、全滅したためゲームオーバーになりました。")
	
	# ソウルポイント算出
	var item_values = 0
	for item_id in inventory.keys():
		var count = inventory[item_id]
		var item = Database.items.get(item_id)
		if item:
			item_values += item.value_sell * count
			
	var sp_gain = int(gold / 1000) + int(item_values / 100) + (defeated_bosses.size() * 50) + (current_day * 2)
	soul_points += sp_gain
	add_log("獲得ソウルポイント: +%d SP (合計: %d SP)" % [sp_gain, soul_points])
	emit_signal("game_state_updated")

# 転生バフ購入
func buy_perma_buff(buff_id: String) -> bool:
	if not perma_buffs.has(buff_id): return false
	var lv = perma_buffs[buff_id]
	
	# バフごとの最大レベル設定
	var max_lv = 10
	if buff_id in ["education", "body", "building", "discount"]:
		max_lv = 5
		
	if lv >= max_lv: return false
	
	var cost = 0
	if buff_id == "heritage": cost = 10
	elif buff_id == "stock": cost = 5
	elif buff_id == "education": cost = 20
	elif buff_id == "body": cost = 15
	elif buff_id == "building": cost = 25
	elif buff_id == "discount": cost = 15
	
	if soul_points >= cost:
		soul_points -= cost
		perma_buffs[buff_id] = lv + 1
		add_log("永続バフ %s がレベル %d に上がりました。" % [buff_id, lv + 1])
		emit_signal("game_state_updated")
		return true
	return false
