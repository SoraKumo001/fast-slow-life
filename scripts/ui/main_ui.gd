extends Control

# UI要素の参照 (Unique Name機能を利用)
@onready var day_label = %DayLabel
@onready var gold_label = %GoldLabel
@onready var food_label = %FoodLabel
@onready var soul_label = %SoulPointsLabel
@onready var target_label = %TargetLabel

@onready var log_text = %LogText
@onready var auto_play_check = %AutoPlayCheck
@onready var auto_play_timer = %AutoPlayTimer

@onready var villager_container = %VillagerContainer
@onready var facility_container = %FacilityContainer
@onready var area_container = %AreaContainer
@onready var rebirth_container = %RebirthContainer
@onready var rebirth_panel = %RebirthPanel
@onready var village_status_label = %VillageStatusLabel
@onready var exploration_label = %ExplorationLabel
@onready var inventory_container = %InventoryContainer

var logs_archive: Array[String] = []
var show_detailed_target: bool = false

func _ready():
	# シグナルの接続
	GameState.game_state_updated.connect(update_ui)
	GameState.log_added.connect(add_log_message)
	
	auto_play_timer.timeout.connect(_on_auto_play_timer_timeout)
	
	# 初回UI更新
	update_ui()
	
	# ログの初期メッセージ表示
	add_log_message("=== 村の開拓へようこそ！ ===")

func add_log_message(msg: String):
	# キーワードに応じたBBCodeカラーリング
	var colored = msg
	if "LV UP" in msg or "レベル" in msg:
		colored = "[color=#ffd700][b]" + msg + "[/b][/color]"
	elif "警告" in msg or "飢え" in msg or "死亡" in msg or "敗北" in msg:
		colored = "[color=#ff4d4d][b]" + msg + "[/b][/color]"
	elif "勝利" in msg or "回復" in msg or "撃破" in msg:
		colored = "[color=#4dff88][b]" + msg + "[/b][/color]"
	elif "クラフト完成" in msg or "大成功" in msg:
		colored = "[color=#00e5ff][b]" + msg + "[/b][/color]"
	elif "採取した" in msg or "ゴールド獲得" in msg or "手に入れた" in msg:
		colored = "[color=#66b2ff]" + msg + "[/color]"
	elif "ボス戦開始" in msg:
		colored = "[color=#ff3399][b]" + msg + "[/b][/color]"
		
	logs_archive.append(colored)
	if logs_archive.size() > 100:
		logs_archive.remove_at(0)
		
	log_text.clear()
	for log_line in logs_archive:
		log_text.append_text(log_line + "\n")
	
	await get_tree().process_frame
	var v_scroll = log_text.get_v_scroll_bar()
	if v_scroll:
		v_scroll.value = v_scroll.max_value

# UI全体の更新
func update_ui():
	# 基本ステータス
	day_label.text = "経過日数: %d 日" % GameState.current_day
	gold_label.text = "ゴールド: %d G" % GameState.gold
	food_label.text = "食料: %d" % GameState.food
	soul_label.text = "ソウルポイント: %d SP" % GameState.soul_points
	
	var boss_name = "ゴブリンロード"
	if GameState.current_tier == 2: boss_name = "ゴーレム"
	elif GameState.current_tier == 3: boss_name = "キマイラ"
	elif GameState.current_tier == 4: boss_name = "アークデーモン"
	elif GameState.current_tier == 5: boss_name = "終焉の竜"
	
	if GameState.is_game_cleared:
		target_label.text = "目標: 完全クリア！"
	else:
		if show_detailed_target:
			target_label.text = "目標: %d 日目までに「%s」を討伐！ (クリックで期限表示)" % [GameState.target_day, boss_name]
		else:
			target_label.text = "期限: %d 日目まで (クリックで目標表示)" % GameState.target_day
	
	# 各タブの中身の更新
	_update_villager_tab()
	_update_facility_tab()
	_update_area_tab()
	_update_rebirth_tab()
	_update_overview_tab()
	_update_inventory_tab()
	
	# ゲームオーバーパネルの表示切替
	rebirth_panel.visible = GameState.is_game_over

# 1日進めるボタン
func _on_advance_day_pressed():
	if GameState.is_game_over: return
	GameState.advance_day()

# オートプレイチェックボックス
func _on_auto_play_toggled(button_pressed: bool):
	if button_pressed:
		auto_play_timer.start()
	else:
		auto_play_timer.stop()

func _on_auto_play_timer_timeout():
	if GameState.is_game_over:
		auto_play_check.button_pressed = false
		auto_play_timer.stop()
		return
	GameState.advance_day()

# --- 各タブの更新処理 ---

# 1. 村人管理タブ (アバターカード・各種ゲージ・装備スロット)
func _update_villager_tab():
	for child in villager_container.get_children():
		child.queue_free()
		
	var grid = GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 15)
	villager_container.add_child(grid)
		
	for v in GameState.villagers:
		var card = PanelContainer.new()
		card.custom_minimum_size = Vector2(480, 200)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(card)
		
		# メイン配置
		var main_vbox = VBoxContainer.new()
		main_vbox.add_theme_constant_override("separation", 8)
		card.add_child(main_vbox)
		
		# 1. ヘッダー (名前・職業)
		var head_hbox = HBoxContainer.new()
		main_vbox.add_child(head_hbox)
		
		var name_lbl = Label.new()
		var job_name = Database.jobs[v.current_job].name
		name_lbl.text = " %s (Lv %d)" % [v.name, v.level]
		name_lbl.add_theme_font_size_override("font_size", 18)
		head_hbox.add_child(name_lbl)
		
		var job_lbl = Label.new()
		job_lbl.text = "[ %s ]" % job_name
		job_lbl.add_theme_font_size_override("font_size", 14)
		# 職業ごとのカラー設定
		var job_color = Color(0.8, 0.8, 0.8) # デフォルト
		if v.current_job == "warrior": job_color = Color(1.0, 0.4, 0.4) # 赤
		elif v.current_job == "mage": job_color = Color(0.4, 0.6, 1.0) # 青
		elif v.current_job == "farmer": job_color = Color(0.4, 1.0, 0.4) # 緑
		elif v.current_job == "miner": job_color = Color(0.9, 0.7, 0.4) # 茶
		elif v.current_job == "priest": job_color = Color(1.0, 1.0, 0.6) # 黄
		elif v.current_job == "crafter": job_color = Color(0.8, 0.4, 1.0) # 紫
		job_lbl.add_theme_color_override("font_color", job_color)
		head_hbox.add_child(job_lbl)
		
		var status_lbl = Label.new()
		status_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		status_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		if v.is_dead:
			status_lbl.text = "【死亡】"
			status_lbl.add_theme_color_override("font_color", Color(1.0, 0.2, 0.2))
		else:
			status_lbl.text = "【健康】"
			status_lbl.add_theme_color_override("font_color", Color(0.2, 1.0, 0.6))
		head_hbox.add_child(status_lbl)
		
		if v.is_dead: continue
		
		# 2. ゲージセクション (HP・EXPバー)
		var gauge_vbox = VBoxContainer.new()
		gauge_vbox.add_theme_constant_override("separation", 2)
		main_vbox.add_child(gauge_vbox)
		
		# HPバー
		var hp_hbox = HBoxContainer.new()
		gauge_vbox.add_child(hp_hbox)
		var hp_title = Label.new()
		hp_title.text = " HP: "
		hp_title.custom_minimum_size = Vector2(40, 0)
		hp_hbox.add_child(hp_title)
		
		var hp_bar = ProgressBar.new()
		hp_bar.max_value = v.get_max_hp()
		hp_bar.value = v.current_hp
		hp_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hp_bar.custom_minimum_size = Vector2(0, 16)
		var hp_fill = StyleBoxFlat.new()
		var ratio = float(v.current_hp) / v.get_max_hp()
		hp_fill.bg_color = Color(1.0 - ratio, ratio, 0.2, 1.0)
		hp_fill.corner_radius_top_left = 4
		hp_fill.corner_radius_top_right = 4
		hp_fill.corner_radius_bottom_right = 4
		hp_fill.corner_radius_bottom_left = 4
		hp_bar.add_theme_stylebox_override("fill", hp_fill)
		hp_hbox.add_child(hp_bar)
		
		# EXPバー
		var exp_hbox = HBoxContainer.new()
		gauge_vbox.add_child(exp_hbox)
		var exp_title = Label.new()
		exp_title.text = " EXP:"
		exp_title.custom_minimum_size = Vector2(40, 0)
		exp_hbox.add_child(exp_title)
		
		var exp_bar = ProgressBar.new()
		exp_bar.max_value = v.get_required_exp()
		exp_bar.value = v.exp
		exp_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		exp_bar.custom_minimum_size = Vector2(0, 12)
		var exp_fill = StyleBoxFlat.new()
		exp_fill.bg_color = Color(0.2, 0.5, 0.9, 1.0)
		exp_fill.corner_radius_top_left = 4
		exp_fill.corner_radius_top_right = 4
		exp_fill.corner_radius_bottom_right = 4
		exp_fill.corner_radius_bottom_left = 4
		exp_bar.add_theme_stylebox_override("fill", exp_fill)
		exp_hbox.add_child(exp_bar)
		
		# 3. ステータス ＆ 装備スロット (横並び)
		var mid_hbox = HBoxContainer.new()
		mid_hbox.add_theme_constant_override("separation", 15)
		main_vbox.add_child(mid_hbox)
		
		# ステータス詳細
		var stat_lbl = Label.new()
		stat_lbl.text = " [物理]: %d  [魔法]: %d\n [技術]: %d  [俊敏]: %d\n [防御]: %d" % [
			v.get_str(), v.get_int(), v.get_dex(), v.get_agi(), v.get_vit()
		]
		stat_lbl.add_theme_font_size_override("font_size", 13)
		mid_hbox.add_child(stat_lbl)
		
		# 装備スロット (視覚的な枠)
		var equip_panel = PanelContainer.new()
		equip_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mid_hbox.add_child(equip_panel)
		var eq_style = StyleBoxFlat.new()
		eq_style.bg_color = Color(0.08, 0.09, 0.11, 0.8)
		eq_style.border_width_left = 1
		eq_style.border_width_top = 1
		eq_style.border_width_right = 1
		eq_style.border_width_bottom = 1
		eq_style.border_color = Color(0.18, 0.20, 0.25, 1)
		eq_style.corner_radius_top_left = 6
		eq_style.corner_radius_top_right = 6
		eq_style.corner_radius_bottom_right = 6
		eq_style.corner_radius_bottom_left = 6
		equip_panel.add_theme_stylebox_override("panel", eq_style)
		
		var equip_vbox = VBoxContainer.new()
		equip_panel.add_child(equip_vbox)
		
		var w_name = Database.items[v.weapon_id].name if v.weapon_id != "" else "なし"
		var a_name = Database.items[v.armor_id].name if v.armor_id != "" else "なし"
		var w_lbl = Label.new()
		w_lbl.text = " [武器]: %s" % w_name
		w_lbl.add_theme_font_size_override("font_size", 12)
		equip_vbox.add_child(w_lbl)
		var a_lbl = Label.new()
		a_lbl.text = " [防具]: %s" % a_name
		a_lbl.add_theme_font_size_override("font_size", 12)
		equip_vbox.add_child(a_lbl)
		
		# 4. 指示と転職アクション
		var act_hbox = HBoxContainer.new()
		act_hbox.add_theme_constant_override("separation", 10)
		main_vbox.add_child(act_hbox)
		
		var order_opt = OptionButton.new()
		order_opt.add_item("採取", 0)
		order_opt.add_item("討伐", 1)
		order_opt.add_item("宿屋休養", 2)
		var cur_idx = 0
		if v.order == "hunt": cur_idx = 1
		elif v.order == "inn": cur_idx = 2
		order_opt.selected = cur_idx
		order_opt.item_selected.connect(func(idx):
			if idx == 0: v.order = "gather"
			elif idx == 1: v.order = "hunt"
			elif idx == 2: v.order = "inn"
			GameState.add_log("%s の方針を「%s」に変更しました。" % [v.name, order_opt.get_item_text(idx)])
		)
		act_hbox.add_child(order_opt)
		
		var area_opt = OptionButton.new()
		var idx = 0
		for area_id in Database.areas.keys():
			var is_unlocked = true
			if area_id == "mine" and not "forest" in GameState.defeated_bosses: is_unlocked = false
			elif area_id == "valley" and not "mine" in GameState.defeated_bosses: is_unlocked = false
			elif area_id == "roots" and not "valley" in GameState.defeated_bosses: is_unlocked = false
			elif area_id == "abyss" and not "roots" in GameState.defeated_bosses: is_unlocked = false
			
			if is_unlocked:
				area_opt.add_item(Database.areas[area_id].name, idx)
				area_opt.set_item_metadata(idx, area_id)
				if v.assigned_area == area_id:
					area_opt.selected = idx
				idx += 1
		area_opt.item_selected.connect(func(sel_idx):
			var area_id = area_opt.get_item_metadata(sel_idx)
			v.assigned_area = area_id
			GameState.add_log("%s の派遣先を「%s」に変更しました。" % [v.name, Database.areas[area_id].name])
		)
		act_hbox.add_child(area_opt)
		
		var job_opt = OptionButton.new()
		var job_idx = 0
		for job_id in Database.jobs.keys():
			var job = Database.jobs[job_id]
			var cost = job.cost
			if job_id in v.job_history:
				cost = 0
			else:
				cost = int(cost * (1.0 - GameState.perma_buffs["discount"] * 0.1))
			var btn_text = "%s (%dG)" % [job.name, cost] if cost > 0 else "%s (無料)" % job.name
			job_opt.add_item(btn_text, job_idx)
			job_opt.set_item_metadata(job_idx, job_id)
			if v.current_job == job_id:
				job_opt.selected = job_idx
			job_idx += 1
		act_hbox.add_child(job_opt)
		
		var change_job_btn = Button.new()
		change_job_btn.text = "転職"
		change_job_btn.pressed.connect(func():
			var sel_job_id = job_opt.get_item_metadata(job_opt.selected)
			if sel_job_id != v.current_job:
				GameState.change_job(v, sel_job_id)
		)
		act_hbox.add_child(change_job_btn)

# 2. 施設・クラフトタブ
func _update_facility_tab():
	for child in facility_container.get_children():
		child.queue_free()
		
	# 施設アップグレードセクション
	var fac_title = Label.new()
	fac_title.text = "[ 施設のアップグレード ]"
	fac_title.add_theme_font_size_override("font_size", 16)
	facility_container.add_child(fac_title)
	
	var fac_grid = GridContainer.new()
	fac_grid.columns = 3
	fac_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fac_grid.add_theme_constant_override("h_separation", 15)
	fac_grid.add_theme_constant_override("v_separation", 15)
	facility_container.add_child(fac_grid)
	
	for fac_id in GameState.facility_levels.keys():
		var lv = GameState.facility_levels[fac_id]
		var card = PanelContainer.new()
		card.custom_minimum_size = Vector2(300, 110)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		fac_grid.add_child(card)
		
		var v_box = VBoxContainer.new()
		card.add_child(v_box)
		
		var fac_name = ""
		if fac_id == "inn": fac_name = "宿屋 (人口・回復)"
		elif fac_id == "workshop": fac_name = "工房 (資材加工)"
		elif fac_id == "forge": fac_name = "鍛冶屋 (装備鍛造)"
		elif fac_id == "alchemy_lab": fac_name = "錬金工房 (薬品クラフト)"
		elif fac_id == "trading_post": fac_name = "交易所 (自動取引)"
		
		var title_lbl = Label.new()
		title_lbl.text = fac_name
		title_lbl.add_theme_font_size_override("font_size", 15)
		v_box.add_child(title_lbl)
		
		# レベルのスター表記
		var star_lbl = Label.new()
		var stars = ""
		if lv == 0: stars = "未建設"
		else:
			for s in range(lv): stars += "*"
			for s in range(4 - lv): stars += "-"
		star_lbl.text = "ランク: " + stars
		star_lbl.add_theme_font_size_override("font_size", 13)
		var star_color = Color(1.0, 0.85, 0.3) if lv > 0 else Color(0.6, 0.6, 0.6)
		star_lbl.add_theme_color_override("font_color", star_color)
		v_box.add_child(star_lbl)
		
		# アクション
		if lv < 4:
			var cost_info = GameState.get_facility_upgrade_cost(fac_id)
			var cost_gold = cost_info.gold
			var cost_items = cost_info.items
			
			var cost_lbl = Label.new()
			var mats_text = ""
			for m in cost_items:
				var owned = GameState.inventory.get(m.id, 0)
				var mat_name = Database.items[m.id].name
				mats_text += "%s: %d/%d  " % [mat_name, owned, m.amount]
				
			cost_lbl.text = " コスト: %d G\n 必要素材: %s" % [cost_gold, mats_text if mats_text != "" else "なし"]
			cost_lbl.add_theme_font_size_override("font_size", 12)
			cost_lbl.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
			v_box.add_child(cost_lbl)
			
			var up_btn = Button.new()
			up_btn.text = "建設する" if lv == 0 else "アップグレード"
			
			var can_upgrade = GameState.gold >= cost_gold
			for m in cost_items:
				var owned = GameState.inventory.get(m.id, 0)
				if owned < m.amount:
					can_upgrade = false
			if not can_upgrade:
				up_btn.disabled = true
				
			up_btn.pressed.connect(func():
				GameState.upgrade_facility(fac_id)
			)
			v_box.add_child(up_btn)
		else:
			var max_lbl = Label.new()
			max_lbl.text = "最大ランク (MAX)"
			max_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			max_lbl.add_theme_color_override("font_color", Color(0.0, 0.9, 0.9))
			v_box.add_child(max_lbl)
			
	# クラフトレシピ部分
	var craft_title = Label.new()
	craft_title.text = "\n[ 加工クラフトレシピ ]"
	craft_title.add_theme_font_size_override("font_size", 16)
	facility_container.add_child(craft_title)
	
	var craft_grid = GridContainer.new()
	craft_grid.columns = 2
	craft_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	craft_grid.add_theme_constant_override("h_separation", 30)
	craft_grid.add_theme_constant_override("v_separation", 15)
	facility_container.add_child(craft_grid)
	
	for recipe_id in Database.recipes.keys():
		var recipe = Database.recipes[recipe_id]
		var fac_lv = GameState.facility_levels.get(recipe.facility, 0)
		if fac_lv >= recipe.required_level:
			var card = PanelContainer.new()
			card.custom_minimum_size = Vector2(450, 80)
			card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			craft_grid.add_child(card)
			
			var h_box = HBoxContainer.new()
			h_box.alignment = BoxContainer.ALIGNMENT_CENTER
			h_box.add_theme_constant_override("separation", 15)
			card.add_child(h_box)
			
			# レシピ詳細
			var r_lbl = Label.new()
			var mats_text = ""
			for m in recipe.materials:
				mats_text += "%s x %d  " % [Database.items[m.id].name, m.amount]
			r_lbl.text = " %s\n 材料: %s" % [Database.items[recipe.result.id].name, mats_text]
			r_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			r_lbl.add_theme_font_size_override("font_size", 13)
			h_box.add_child(r_lbl)
			
			var craft_btn = Button.new()
			if GameState.active_crafts.has(recipe_id):
				craft_btn.text = "加工中 (%d)" % GameState.active_crafts[recipe_id]
				craft_btn.disabled = true
			else:
				craft_btn.text = "加工開始"
				craft_btn.pressed.connect(func():
					GameState.start_craft(recipe_id)
				)
			h_box.add_child(craft_btn)
		


# 3. 探索タブ
func _update_area_tab():
	for child in area_container.get_children():
		child.queue_free()
		
	var grid = GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 15)
	area_container.add_child(grid)
		
	for area_id in Database.areas.keys():
		var area = Database.areas[area_id]
		var rate = GameState.explore_rates[area_id]
		
		# 解放条件チェック
		var is_unlocked = true
		if area_id == "mine" and not "forest" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "valley" and not "mine" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "roots" and not "valley" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "abyss" and not "roots" in GameState.defeated_bosses: is_unlocked = false
		
		if not is_unlocked: continue
		
		var card = PanelContainer.new()
		card.custom_minimum_size = Vector2(450, 140)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(card)
		
		var vbox = VBoxContainer.new()
		vbox.add_theme_constant_override("separation", 8)
		card.add_child(vbox)
		
		# 1. エリア名と危険度
		var head = HBoxContainer.new()
		vbox.add_child(head)
		
		var name_lbl = Label.new()
		name_lbl.text = " %s" % area.name
		name_lbl.add_theme_font_size_override("font_size", 16)
		head.add_child(name_lbl)
		
		var diff_lbl = Label.new()
		var stars = ""
		for i in range(area.difficulty):
			stars += "*"
		diff_lbl.text = " (難易度: %s)" % stars
		diff_lbl.add_theme_color_override("font_color", Color(1.0, 0.4, 0.4))
		diff_lbl.add_theme_font_size_override("font_size", 12)
		head.add_child(diff_lbl)
		
		# 2. 探索率 ProgressBar
		var prog_hbox = HBoxContainer.new()
		vbox.add_child(prog_hbox)
		
		var prog_title = Label.new()
		prog_title.text = " 探索率:"
		prog_title.custom_minimum_size = Vector2(60, 0)
		prog_title.add_theme_font_size_override("font_size", 13)
		prog_hbox.add_child(prog_title)
		
		var bar = ProgressBar.new()
		bar.max_value = 100.0
		bar.value = rate
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.custom_minimum_size = Vector2(0, 16)
		
		var bar_style = StyleBoxFlat.new()
		if rate >= 100.0:
			bar_style.bg_color = Color(0.2, 0.8, 0.4, 1.0)
		else:
			bar_style.bg_color = Color(0.0, 0.7, 0.9, 1.0)
		bar_style.corner_radius_top_left = 4
		bar_style.corner_radius_top_right = 4
		bar_style.corner_radius_bottom_right = 4
		bar_style.corner_radius_bottom_left = 4
		bar.add_theme_stylebox_override("fill", bar_style)
		prog_hbox.add_child(bar)
		
		# 3. アクション（ボス挑戦など）
		var act_hbox = HBoxContainer.new()
		act_hbox.alignment = BoxContainer.ALIGNMENT_END
		vbox.add_child(act_hbox)
		
		var is_defeated = area_id in GameState.defeated_bosses
		var boss_btn = Button.new()
		
		if is_defeated:
			boss_btn.text = "ボス撃破済み"
			boss_btn.disabled = true
		elif rate >= 100.0:
			boss_btn.text = "[ボス挑戦] %s に挑む！" % area.boss.name
			boss_btn.add_theme_color_override("font_color", Color(1.0, 0.8, 0.2))
			var btn_style = StyleBoxFlat.new()
			btn_style.bg_color = Color(0.6, 0.1, 0.2, 1.0)
			btn_style.border_width_left = 2
			btn_style.border_width_top = 2
			btn_style.border_width_right = 2
			btn_style.border_width_bottom = 2
			btn_style.border_color = Color(1.0, 0.8, 0.2, 1.0)
			btn_style.corner_radius_top_left = 6
			btn_style.corner_radius_top_right = 6
			btn_style.corner_radius_bottom_right = 6
			btn_style.corner_radius_bottom_left = 6
			boss_btn.add_theme_stylebox_override("normal", btn_style)
			boss_btn.pressed.connect(func():
				GameState.challenge_boss(area_id)
			)
		else:
			boss_btn.text = "ボス未開放 (%s)" % area.boss.name
			boss_btn.disabled = true
			
		act_hbox.add_child(boss_btn)

# 4. 転生・周回ショップタブ
func _update_rebirth_tab():
	for child in rebirth_container.get_children():
		child.queue_free()
		
	# ヘッダーカード
	var header_panel = PanelContainer.new()
	header_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rebirth_container.add_child(header_panel)
	
	var header_style = StyleBoxFlat.new()
	header_style.bg_color = Color(0.12, 0.15, 0.20, 1.0)
	header_style.corner_radius_top_left = 8
	header_style.corner_radius_top_right = 8
	header_style.corner_radius_bottom_right = 8
	header_style.corner_radius_bottom_left = 8
	header_panel.add_theme_stylebox_override("panel", header_style)
	
	var header_lbl = Label.new()
	header_lbl.text = " 所持ソウルポイント: %d SP\n 転生で得たソウルを使用し、ゲームを永続的に有利にするバフを獲得できます。" % GameState.soul_points
	header_lbl.add_theme_font_size_override("font_size", 15)
	header_panel.add_child(header_lbl)
	
	var grid = GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 15)
	rebirth_container.add_child(grid)
	
	for buff_id in GameState.perma_buffs.keys():
		var lv = GameState.perma_buffs[buff_id]
		
		var card = PanelContainer.new()
		card.custom_minimum_size = Vector2(450, 120)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(card)
		
		var vbox = VBoxContainer.new()
		vbox.add_theme_constant_override("separation", 8)
		card.add_child(vbox)
		
		var b_name = ""
		var b_effect = ""
		var cost = 0
		
		if buff_id == "heritage":
			b_name = "先祖の遺産"
			b_effect = "初期ゴールド +500 (現在: +%d)" % (lv * 500)
			cost = 10
		elif buff_id == "stock":
			b_name = "豊かな備蓄"
			b_effect = "初期食料 +100 (現在: +%d)" % (lv * 100)
			cost = 5
		elif buff_id == "education":
			b_name = "英才教育"
			b_effect = "村人の獲得経験値 +10%% (現在: +%d%%)" % (lv * 10)
			cost = 20
		elif buff_id == "body":
			b_name = "頑強な肉体"
			b_effect = "全村人の初期全ステータス +2 (現在: +%d)" % (lv * 2)
			cost = 15
		elif buff_id == "building":
			b_name = "効率的な建築"
			b_effect = "施設強化の素材・G要求量 -5%% (現在: -%d%%)" % (lv * 5)
			cost = 25
		elif buff_id == "discount":
			b_name = "値切り上手"
			b_effect = "転職時の必要ゴールド -10%% (現在: -%d%%)" % (lv * 10)
			cost = 15
			
		# 1. バフ名とレベル
		var head = HBoxContainer.new()
		vbox.add_child(head)
		
		var name_lbl = Label.new()
		name_lbl.text = " %s" % b_name
		name_lbl.add_theme_font_size_override("font_size", 16)
		head.add_child(name_lbl)
		
		var max_lv = 10
		if buff_id in ["education", "body", "building", "discount"]:
			max_lv = 5
			
		var lv_lbl = Label.new()
		lv_lbl.text = " Lv %d / %d" % [lv, max_lv]
		lv_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lv_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		lv_lbl.add_theme_color_override("font_color", Color(0.9, 0.7, 0.2))
		head.add_child(lv_lbl)
		
		# 2. 効果内容
		var effect_lbl = Label.new()
		effect_lbl.text = " %s" % b_effect
		effect_lbl.add_theme_font_size_override("font_size", 13)
		vbox.add_child(effect_lbl)
		
		# 3. アクション
		var act_hbox = HBoxContainer.new()
		act_hbox.alignment = BoxContainer.ALIGNMENT_END
		vbox.add_child(act_hbox)
		
		if lv < max_lv:
			var buy_btn = Button.new()
			buy_btn.text = "購入 (%d SP)" % cost
			buy_btn.disabled = GameState.soul_points < cost
			buy_btn.pressed.connect(func():
				GameState.buy_perma_buff(buff_id)
			)
			act_hbox.add_child(buy_btn)
		else:
			var max_lbl = Label.new()
			max_lbl.text = "[MAX] 最大強化済み"
			max_lbl.add_theme_color_override("font_color", Color(0.2, 0.8, 0.6))
			act_hbox.add_child(max_lbl)

# ゲームオーバー画面から次の周回を開始するボタン
func _on_restart_loop_pressed():
	GameState.start_new_game(false) # バフを引き継いでニューゲーム

# 5. 概要（ダッシュボード）タブの更新
func _update_overview_tab():
	var village_text = ""
	
	# 生存者数と最大数
	var max_v = 3
	var inn_lv = GameState.facility_levels["inn"]
	if inn_lv == 2: max_v = 4
	elif inn_lv == 3: max_v = 6
	elif inn_lv >= 4: max_v = 8
	
	village_text += "[b][color=#00ffcc]■ 人口情報[/color][/b]\n"
	village_text += "生存者数: [b]%d[/b] / %d 名 (宿屋 Lv %d)\n\n" % [GameState.get_alive_villagers_count(), max_v, inn_lv]
	
	# 施設レベル
	village_text += "[b][color=#ffcc00]■ 施設レベル[/color][/b]\n"
	var facs = {
		"workshop": "工房",
		"forge": "鍛冶屋",
		"alchemy_lab": "錬金工房",
		"trading_post": "交易所"
	}
	for f_id in facs.keys():
		var flv = GameState.facility_levels[f_id]
		var lv_str = "Lv %d" % flv if flv > 0 else "[color=#888888]未建設[/color]"
		village_text += " - %s: %s\n" % [facs[f_id], lv_str]
	
	# 村人の現在の行動
	village_text += "\n[b][color=#ff66cc]■ 村人の現在の指示[/color][/b]\n"
	for v in GameState.villagers:
		var job_name = Database.jobs[v.current_job].name
		var state_str = "[color=#ff3333]死亡[/color]"
		if not v.is_dead:
			var order_name = "採取"
			if v.order == "hunt": order_name = "討伐"
			elif v.order == "inn": order_name = "宿屋休養"
			
			var area_name = Database.areas[v.assigned_area].name
			if v.order == "inn":
				state_str = "[color=#88ff88]%s (宿屋)[/color]" % order_name
			else:
				state_str = "[color=#33ccff]%s [%s][/color]" % [area_name, order_name]
		
		village_text += " - %s (%s): %s\n" % [v.name, job_name, state_str]
		
	village_status_label.text = village_text
	
	# ダンジョン探索状況のテキスト生成
	var explore_text = ""
	explore_text += "[b][color=#00e5ff]■ ダンジョン開拓進行度[/color][/b]\n\n"
	for area_id in GameState.explore_rates.keys():
		# 解放条件チェック
		var is_unlocked = true
		if area_id == "mine" and not "forest" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "valley" and not "mine" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "roots" and not "valley" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "abyss" and not "roots" in GameState.defeated_bosses: is_unlocked = false
		
		if not is_unlocked: continue
		
		var area = Database.areas[area_id]
		var rate = GameState.explore_rates[area_id]
		var is_defeated = area_id in GameState.defeated_bosses
		
		var blocks = int(rate / 10.0)
		var bar = "[" + "=".repeat(blocks) + "-".repeat(10 - blocks) + "]"
		
		var status_str = "[color=#00ff88]ボス討伐済[/color]" if is_defeated else ("[color=#ffaa00]ボス挑戦可能！[/color]" if rate >= 100.0 else "[color=#88ccff]探索中[/color]")
		
		explore_text += "[b]%s[/b] (探索率: %.1f%%)\n  [code]%s[/code]  %s\n\n" % [area.name, rate, bar, status_str]
		
	exploration_label.text = explore_text

# 6. 倉庫（インベントリ）タブの更新
func _update_inventory_tab():
	for child in inventory_container.get_children():
		child.queue_free()
		
	var categorized: Dictionary = {}
	for cat in Database.Category.values():
		categorized[cat] = []
		
	for item_id in GameState.inventory.keys():
		var count = GameState.inventory[item_id]
		if count <= 0: continue
		
		var item = Database.items.get(item_id)
		if item:
			categorized[item.category].append({
				"item": item,
				"count": count
			})
			
	var cat_names = {
		Database.Category.FOOD: "食料・消耗品素材",
		Database.Category.WOOD: "木材系素材",
		Database.Category.STONE: "石材系素材",
		Database.Category.ORE: "鉱石・金属素材",
		Database.Category.MANA_STONE: "薬草・魔法石素材",
		Database.Category.MONSTER_MATERIAL: "魔物討伐素材",
		Database.Category.INTERMEDIATE: "中間加工品",
		Database.Category.CONSUMABLE: "薬品・消費アイテム",
		Database.Category.WEAPON: "武器（装備品）",
		Database.Category.ARMOR: "防具（装備品）"
	}
	
	for cat in Database.Category.values():
		var list = categorized[cat]
		if list.size() == 0: continue
		
		# カテゴリ用の枠線付きヘッダー
		var cat_panel = PanelContainer.new()
		cat_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		inventory_container.add_child(cat_panel)
		
		var cat_style = StyleBoxFlat.new()
		cat_style.bg_color = Color(0.15, 0.17, 0.22, 1.0)
		cat_style.border_width_left = 4
		cat_style.border_color = Color(0.0, 0.7, 0.9, 1.0) # 水色のアクセントライン
		cat_style.content_margin_left = 10
		cat_style.content_margin_top = 4
		cat_style.content_margin_bottom = 4
		cat_panel.add_theme_stylebox_override("panel", cat_style)
		
		var cat_label = Label.new()
		cat_label.text = cat_names[cat]
		cat_label.add_theme_font_size_override("font_size", 15)
		cat_panel.add_child(cat_label)
		
		var grid = GridContainer.new()
		grid.columns = 2
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_theme_constant_override("h_separation", 20)
		grid.add_theme_constant_override("v_separation", 12)
		inventory_container.add_child(grid)
		
		for data in list:
			var item = data.item
			var count = data.count
			
			var card = PanelContainer.new()
			card.custom_minimum_size = Vector2(450, 80)
			card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			grid.add_child(card)
			
			# カードの内側余白を設定するためのマージンコンテナ
			var margin = MarginContainer.new()
			margin.add_theme_constant_override("margin_left", 8)
			margin.add_theme_constant_override("margin_top", 8)
			margin.add_theme_constant_override("margin_right", 8)
			margin.add_theme_constant_override("margin_bottom", 8)
			card.add_child(margin)
			
			var h_box = HBoxContainer.new()
			h_box.add_theme_constant_override("separation", 15)
			margin.add_child(h_box)
			
			# 左側：名前と数量
			var name_vbox = VBoxContainer.new()
			name_vbox.custom_minimum_size = Vector2(160, 0)
			name_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
			h_box.add_child(name_vbox)
			
			var name_lbl = Label.new()
			name_lbl.text = item.name
			name_lbl.add_theme_font_size_override("font_size", 14)
			name_vbox.add_child(name_lbl)
			
			var count_lbl = Label.new()
			count_lbl.text = "所持: %d 個" % count
			count_lbl.add_theme_color_override("font_color", Color(0.9, 0.7, 0.2)) # ゴールド色
			count_lbl.add_theme_font_size_override("font_size", 12)
			name_vbox.add_child(count_lbl)
			
			# 右側：説明と価値
			var desc_vbox = VBoxContainer.new()
			desc_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			desc_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
			h_box.add_child(desc_vbox)
			
			var desc_lbl = Label.new()
			desc_lbl.text = item.description
			desc_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			desc_lbl.add_theme_font_size_override("font_size", 12)
			desc_vbox.add_child(desc_lbl)
			
			var value_lbl = Label.new()
			var effect_text = ""
			if item.effect_data.size() > 0:
				effect_text = " [効果: "
				for eff_key in item.effect_data.keys():
					var eff_val = item.effect_data[eff_key]
					effect_text += "%s:%+d " % [eff_key.to_upper(), eff_val]
				effect_text += "]"
			value_lbl.text = "価値: %d G (売) / %d G (買)%s" % [item.value_sell, item.value_buy, effect_text]
			value_lbl.add_theme_color_override("font_color", Color(0.6, 0.6, 0.7))
			value_lbl.add_theme_font_size_override("font_size", 11)
			desc_vbox.add_child(value_lbl)
			
		var space = Control.new()
		space.custom_minimum_size = Vector2(0, 10)
		inventory_container.add_child(space)

func _on_target_button_pressed():
	show_detailed_target = !show_detailed_target
	update_ui()
