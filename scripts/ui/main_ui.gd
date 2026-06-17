extends Control

# UI要素の参照 (Unique Name機能を利用)
@onready var day_label = %DayLabel
@onready var hour_label = %HourLabel
@onready var gold_label = %GoldLabel
@onready var food_label = %FoodLabel
@onready var soul_label = %SoulPointsLabel
@onready var target_label = %TargetLabel

# 時間コントロール
@onready var btn_pause = %BtnPause
@onready var btn_play = %BtnPlay
@onready var btn_double = %BtnDouble
@onready var btn_skip = %BtnSkip

# 4カラム
@onready var inventory_container = %InventoryContainer
@onready var villager_container = %VillagerContainer
@onready var facility_container = %FacilityContainer
@onready var area_container = %AreaContainer

# ログティッカー
@onready var log_ticker = %LogTicker
@onready var btn_history = %BtnHistory

# ポップアップ
@onready var detail_popup = %DetailPopup
@onready var detail_text = %DetailText
@onready var action_container_a = %ActionContainerA
@onready var action_container_b = %ActionContainerB
@onready var history_popup = %HistoryPopup
@onready var history_log_text = %HistoryLogText

# ゲームオーバー画面
@onready var rebirth_panel = %RebirthPanel
@onready var restart_loop_btn = %RestartLoopButton

# タイマー
@onready var auto_play_timer = %AutoPlayTimer

var logs_archive: Array[String] = []
var show_detailed_target: bool = false
var is_paused: bool = true
var current_speed: float = 1.0

# 詳細表示中のオブジェクトを追跡するための変数
var active_detail_type: String = "" # "item", "villager", "facility", "area"
var active_detail_id: String = ""
var active_detail_obj = null

# 操作UIダブルバッファ用参照
var front_container: VBoxContainer
var back_container: VBoxContainer

# 詳細ポップアップの状態変化検知用キャッシュ
var last_detail_status_mats: Dictionary = {}

func _ready():
	# ダブルバッファ初期設定
	front_container = action_container_a
	back_container = action_container_b
	front_container.visible = true
	back_container.visible = false
	
	# シグナル接続
	GameState.game_state_updated.connect(update_ui)
	GameState.log_added.connect(add_log_message)
	
	auto_play_timer.timeout.connect(_on_timer_timeout)
	
	# 時間コントロールボタンのイベント接続
	btn_pause.pressed.connect(_on_pause_pressed)
	btn_play.pressed.connect(_on_play_pressed)
	btn_double.pressed.connect(_on_double_pressed)
	btn_skip.pressed.connect(_on_skip_pressed)
	btn_history.pressed.connect(_on_history_pressed)
	restart_loop_btn.pressed.connect(_on_restart_loop_pressed)
	target_label.pressed.connect(_on_target_button_pressed)
	
	# 初期速度セット (ポーズ状態)
	_on_pause_pressed()
	
	# 初回UI更新
	update_ui()
	
	add_log_message("=== 村の開拓へようこそ！ ===")

func add_log_message(msg: String):
	# キーワードに応じたBBCodeカラーリング
	var colored = msg
	if "[LV UP]" in msg or "レベル" in msg:
		colored = "[color=#ffd700][b]" + msg + "[/b][/color]"
	elif "警告" in msg or "飢え" in msg or "死亡" in msg or "敗北" in msg or "[疲労]" in msg:
		colored = "[color=#ff4d4d][b]" + msg + "[/b][/color]"
	elif "勝利" in msg or "回復" in msg or "撃破" in msg or "帰還" in msg:
		colored = "[color=#4dff88][b]" + msg + "[/b][/color]"
	elif "クラフト完成" in msg or "大成功" in msg or "施設アップグレード完了" in msg:
		colored = "[color=#00e5ff][b]" + msg + "[/b][/color]"
	elif "採取した" in msg or "ゴールド獲得" in msg or "手に入れた" in msg:
		colored = "[color=#66b2ff]" + msg + "[/color]"
	elif "ボス戦開始" in msg:
		colored = "[color=#ff3399][b]" + msg + "[/b][/color]"
		
	logs_archive.append(colored)
	if logs_archive.size() > 200:
		logs_archive.remove_at(0)
		
	# ティッカーには最新の3件を結合して表示
	var ticker_text = ""
	var start_idx = max(0, logs_archive.size() - 3)
	for i in range(start_idx, logs_archive.size()):
		if ticker_text != "":
			ticker_text += "  |  "
		ticker_text += logs_archive[i].replace("\n", " ")
		
	# アトミックなテキスト更新（clear()とappend_text()の連続を避ける）
	log_ticker.text = ticker_text

# UI全体の更新
func update_ui():
	# 基本ステータス
	day_label.text = "経過日数: %d日目" % GameState.current_day
	hour_label.text = "%02d:00" % GameState.current_hour
	gold_label.text = "%d G" % GameState.gold
	
	# 食料表示に予測値を併記
	var alive_count = GameState.get_alive_villagers_count()
	food_label.text = "食料: %d (-%d/日)" % [GameState.food, alive_count]
	
	soul_label.text = "%d SP" % GameState.soul_points
	
	var boss_name = "ゴブリンロード"
	if GameState.current_tier == 2: boss_name = "ゴーレム"
	elif GameState.current_tier == 3: boss_name = "キマイラ"
	elif GameState.current_tier == 4: boss_name = "アークデーモン"
	elif GameState.current_tier == 5: boss_name = "終焉の竜"
	
	if GameState.is_game_cleared:
		target_label.text = "目標: 完全クリア！"
	else:
		if show_detailed_target:
			target_label.text = "目標: %d日目までに「%s」を討伐！" % [GameState.target_day, boss_name]
		else:
			target_label.text = "期限: %d日目まで (クリックで詳細)" % GameState.target_day
	
	# 4カラムの再利用（キャッシュ）更新
	_update_inventory_column()
	_update_villager_column()
	_update_facility_column()
	_update_area_column()
	
	# ゲームオーバーパネルの表示切替
	rebirth_panel.visible = GameState.is_game_over
	
	# 詳細ポップアップが開かれている場合、中身をアトミックにテキストだけ再描画する（コントロールは再生成しない）
	if detail_popup.visible:
		_refresh_detail_popup()

# --- 時間コントロール ---
func _on_pause_pressed():
	is_paused = true
	auto_play_timer.stop()
	_update_time_control_buttons_state()
	GameState.add_log("ゲームを一時停止しました。")

func _on_play_pressed():
	is_paused = false
	current_speed = 1.0
	auto_play_timer.wait_time = 1.0
	auto_play_timer.start()
	_update_time_control_buttons_state()
	GameState.add_log("時間進行速度を 1倍速 に設定しました。")

func _on_double_pressed():
	is_paused = false
	if current_speed == 2.0:
		current_speed = 4.0
		auto_play_timer.wait_time = 0.25
		GameState.add_log("時間進行速度を 4倍速 に設定しました。")
	else:
		current_speed = 2.0
		auto_play_timer.wait_time = 0.5
		GameState.add_log("時間進行速度を 2倍速 に設定しました。")
	auto_play_timer.start()
	_update_time_control_buttons_state()

func _on_skip_pressed():
	if is_paused:
		GameState.add_log("24時間スキップを実行します...")
		GameState.advance_day()
	else:
		GameState.add_log("一時停止中のみ1日スキップが可能です。")

func _on_timer_timeout():
	if GameState.is_game_over:
		_on_pause_pressed()
		return
	GameState.advance_hour()

func _update_time_control_buttons_state():
	btn_pause.flat = not is_paused
	btn_play.flat = (is_paused or current_speed != 1.0)
	btn_double.flat = (is_paused or (current_speed != 2.0 and current_speed != 4.0))
	btn_double.text = ">> (4x)" if current_speed == 4.0 else ">>"
	btn_skip.disabled = not is_paused


# --- 4カラムのノード再利用（キャッシュ）更新ロジック ---

# 1. 倉庫・アイテム
func _update_inventory_column():
	var items_sorted = GameState.inventory.keys()
	items_sorted.sort()
	
	var active_items = []
	for item_id in items_sorted:
		var count = GameState.inventory[item_id]
		if count > 0 and Database.items.has(item_id):
			active_items.append({"id": item_id, "count": count})
			
	var target_count = active_items.size()
	
	# ノード数の調整
	while inventory_container.get_child_count() < target_count:
		var btn = Button.new()
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.custom_minimum_size = Vector2(0, 32)
		inventory_container.add_child(btn)
	while inventory_container.get_child_count() > target_count:
		var extra = inventory_container.get_child(inventory_container.get_child_count() - 1)
		inventory_container.remove_child(extra)
		extra.queue_free()
		
	# 値の更新
	for i in range(target_count):
		var btn = inventory_container.get_child(i) as Button
		var data = active_items[i]
		var item = Database.items[data.id]
		
		btn.text = " %s  x%d" % [item.name, data.count]
		
		# シグナルの再バインド
		for sig in btn.pressed.get_connections():
			btn.pressed.disconnect(sig.callable)
		btn.pressed.connect(func(): _show_item_detail(data.id))

# 2. キャラクターカード
func _update_villager_column():
	var villagers = GameState.villagers
	var target_count = villagers.size()
	
	# ノード数の調整
	while villager_container.get_child_count() < target_count:
		var card = _create_villager_card_node()
		villager_container.add_child(card)
	while villager_container.get_child_count() > target_count:
		var extra = villager_container.get_child(villager_container.get_child_count() - 1)
		villager_container.remove_child(extra)
		extra.queue_free()
		
	# 既存カードの値のみ更新（再生成なし）
	for i in range(target_count):
		var card = villager_container.get_child(i)
		var v = villagers[i]
		_update_villager_card_values(card, v)

func _create_villager_card_node() -> PanelContainer:
	var panel = PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 95)
	
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.13, 0.16, 0.9)
	style.border_width_left = 3
	style.content_margin_left = 8
	style.content_margin_top = 6
	style.content_margin_right = 8
	style.content_margin_bottom = 6
	panel.add_theme_stylebox_override("panel", style)
	
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 3)
	panel.add_child(vbox)
	
	var lbl_name = Label.new()
	lbl_name.add_theme_font_size_override("font_size", 13)
	vbox.add_child(lbl_name)
	
	var hp_bar = ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(0, 10)
	hp_bar.show_percentage = false
	var hp_fill = StyleBoxFlat.new()
	hp_fill.bg_color = Color(0.2, 0.8, 0.3)
	hp_bar.add_theme_stylebox_override("fill", hp_fill)
	vbox.add_child(hp_bar)
	
	var st_bar = ProgressBar.new()
	st_bar.custom_minimum_size = Vector2(0, 8)
	st_bar.show_percentage = false
	var st_fill = StyleBoxFlat.new()
	st_fill.bg_color = Color(0.9, 0.7, 0.1)
	st_bar.add_theme_stylebox_override("fill", st_fill)
	vbox.add_child(st_bar)
	
	var lbl_task = Label.new()
	lbl_task.add_theme_font_size_override("font_size", 11)
	lbl_task.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	vbox.add_child(lbl_task)
	
	var btn = Button.new()
	btn.flat = true
	btn.custom_minimum_size = panel.custom_minimum_size
	panel.add_child(btn)
	
	# メタデータへコントロールをキャッシュ
	panel.set_meta("lbl_name", lbl_name)
	panel.set_meta("hp_bar", hp_bar)
	panel.set_meta("st_bar", st_bar)
	panel.set_meta("lbl_task", lbl_task)
	panel.set_meta("btn", btn)
	panel.set_meta("style", style)
	
	return panel

func _update_villager_card_values(panel: PanelContainer, v: Villager):
	var lbl_name = panel.get_meta("lbl_name") as Label
	var hp_bar = panel.get_meta("hp_bar") as ProgressBar
	var st_bar = panel.get_meta("st_bar") as ProgressBar
	var lbl_task = panel.get_meta("lbl_task") as Label
	var btn = panel.get_meta("btn") as Button
	var style = panel.get_meta("style") as StyleBoxFlat
	
	var job_name = Database.jobs[v.current_job].name
	lbl_name.text = "%s [Lv.%d %s]" % [v.name, v.level, job_name]
	
	if v.is_dead:
		lbl_name.text += " (死亡)"
		lbl_name.add_theme_color_override("font_color", Color(0.8, 0.3, 0.3))
		style.border_color = Color(0.8, 0.2, 0.2)
		hp_bar.visible = false
		st_bar.visible = false
		lbl_task.text = "死亡しました"
	else:
		lbl_name.add_theme_color_override("font_color", Color(1, 1, 1))
		style.border_color = Color(0.2, 0.7, 0.9)
		hp_bar.visible = true
		st_bar.visible = true
		
		hp_bar.max_value = v.get_max_hp()
		hp_bar.value = v.current_hp
		
		st_bar.max_value = v.get_max_stamina()
		st_bar.value = v.current_stamina
		
		if v.order == "inn":
			lbl_task.text = "方針: 宿屋で休養中"
		else:
			var area_name = Database.areas[v.assigned_area].name
			var order_name = "採取" if v.order == "gather" else "討伐"
			if v.travel_time > 0:
				var dir_name = "帰還中" if v.is_returning else "移動中"
				lbl_task.text = "派遣: %s (%sへ%s あと%d時間)" % [order_name, area_name, dir_name, v.travel_time]
			else:
				lbl_task.text = "派遣: %s (%sで活動中)" % [order_name, area_name]
				
	for sig in btn.pressed.get_connections():
		btn.pressed.disconnect(sig.callable)
	btn.pressed.connect(func(): _show_villager_detail(v))

# 3. 施設カード
func _update_facility_column():
	var fac_ids = GameState.facility_levels.keys()
	var target_count = fac_ids.size()
	
	while facility_container.get_child_count() < target_count:
		var card = _create_facility_card_node()
		facility_container.add_child(card)
	while facility_container.get_child_count() > target_count:
		var extra = facility_container.get_child(facility_container.get_child_count() - 1)
		facility_container.remove_child(extra)
		extra.queue_free()
		
	for i in range(target_count):
		var card = facility_container.get_child(i)
		var fac_id = fac_ids[i]
		_update_facility_card_values(card, fac_id)

func _create_facility_card_node() -> PanelContainer:
	var panel = PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 75)
	
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.12, 0.14, 0.18, 0.9)
	style.border_width_left = 3
	style.content_margin_left = 8
	style.content_margin_top = 6
	style.content_margin_right = 8
	style.content_margin_bottom = 6
	panel.add_theme_stylebox_override("panel", style)
	
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)
	
	var lbl_name = Label.new()
	lbl_name.add_theme_font_size_override("font_size", 13)
	vbox.add_child(lbl_name)
	
	var lbl_status = Label.new()
	lbl_status.add_theme_font_size_override("font_size", 11)
	lbl_status.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	vbox.add_child(lbl_status)
	
	var btn = Button.new()
	btn.flat = true
	btn.custom_minimum_size = panel.custom_minimum_size
	panel.add_child(btn)
	
	panel.set_meta("lbl_name", lbl_name)
	panel.set_meta("lbl_status", lbl_status)
	panel.set_meta("btn", btn)
	panel.set_meta("style", style)
	
	return panel

func _update_facility_card_values(panel: PanelContainer, fac_id: String):
	var lbl_name = panel.get_meta("lbl_name") as Label
	var lbl_status = panel.get_meta("lbl_status") as Label
	var btn = panel.get_meta("btn") as Button
	var style = panel.get_meta("style") as StyleBoxFlat
	
	var lv = GameState.facility_levels[fac_id]
	var fac_name = GameState._get_facility_name(fac_id)
	
	lbl_name.text = "%s (Lv.%d)" % [fac_name, lv] if lv > 0 else "%s (未建設)" % fac_name
	style.border_color = Color(0.9, 0.6, 0.2) if lv > 0 else Color(0.4, 0.4, 0.4)
	
	if GameState.active_upgrades.has(fac_id):
		lbl_status.text = "状態: アップグレード中 (残り%d時間)" % GameState.active_upgrades[fac_id]
	else:
		var crafting_count = 0
		for recipe_id in GameState.active_crafts.keys():
			var recipe = Database.recipes[recipe_id]
			if recipe.facility == fac_id:
				crafting_count += 1
		
		if crafting_count > 0:
			lbl_status.text = "状態: 加工クラフト中 (%d件)" % crafting_count
		else:
			lbl_status.text = "状態: アイドル" if lv > 0 else "状態: ロック"
			
	for sig in btn.pressed.get_connections():
		btn.pressed.disconnect(sig.callable)
	btn.pressed.connect(func(): _show_facility_detail(fac_id))

# 4. エリア・ダンジョンカード
func _update_area_column():
	var area_ids = []
	for area_id in Database.areas.keys():
		var is_unlocked = true
		if area_id == "mine" and not "forest" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "valley" and not "mine" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "roots" and not "valley" in GameState.defeated_bosses: is_unlocked = false
		elif area_id == "abyss" and not "roots" in GameState.defeated_bosses: is_unlocked = false
		if is_unlocked:
			area_ids.append(area_id)
			
	var target_count = area_ids.size()
	
	while area_container.get_child_count() < target_count:
		var card = _create_area_card_node()
		area_container.add_child(card)
	while area_container.get_child_count() > target_count:
		var extra = area_container.get_child(area_container.get_child_count() - 1)
		area_container.remove_child(extra)
		extra.queue_free()
		
	for i in range(target_count):
		var card = area_container.get_child(i)
		var area_id = area_ids[i]
		_update_area_card_values(card, area_id)

func _create_area_card_node() -> PanelContainer:
	var panel = PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 75)
	
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.11, 0.15, 0.15, 0.9)
	style.border_width_left = 3
	style.content_margin_left = 8
	style.content_margin_top = 6
	style.content_margin_right = 8
	style.content_margin_bottom = 6
	panel.add_theme_stylebox_override("panel", style)
	
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)
	
	var lbl_name = Label.new()
	lbl_name.add_theme_font_size_override("font_size", 13)
	vbox.add_child(lbl_name)
	
	var bar = ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 8)
	bar.show_percentage = false
	var bar_style = StyleBoxFlat.new()
	bar_style.bg_color = Color(0.2, 0.7, 0.9)
	bar.add_theme_stylebox_override("fill", bar_style)
	vbox.add_child(bar)
	
	var lbl_boss = Label.new()
	lbl_boss.add_theme_font_size_override("font_size", 11)
	lbl_boss.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	vbox.add_child(lbl_boss)
	
	var btn = Button.new()
	btn.flat = true
	btn.custom_minimum_size = panel.custom_minimum_size
	panel.add_child(btn)
	
	panel.set_meta("lbl_name", lbl_name)
	panel.set_meta("bar", bar)
	panel.set_meta("bar_style", bar_style)
	panel.set_meta("lbl_boss", lbl_boss)
	panel.set_meta("btn", btn)
	panel.set_meta("style", style)
	
	return panel

func _update_area_card_values(panel: PanelContainer, area_id: String):
	var lbl_name = panel.get_meta("lbl_name") as Label
	var bar = panel.get_meta("bar") as ProgressBar
	var bar_style = panel.get_meta("bar_style") as StyleBoxFlat
	var lbl_boss = panel.get_meta("lbl_boss") as Label
	var btn = panel.get_meta("btn") as Button
	var style = panel.get_meta("style") as StyleBoxFlat
	
	var area = Database.areas[area_id]
	var rate = GameState.explore_rates[area_id]
	var is_defeated = area_id in GameState.defeated_bosses
	
	lbl_name.text = "%s (★%d)" % [area.name, area.difficulty]
	style.border_color = Color(0.2, 0.8, 0.5) if is_defeated else Color(0.2, 0.6, 0.8)
	
	bar.max_value = 100.0
	bar.value = rate
	bar_style.bg_color = Color(0.2, 0.7, 0.9) if rate < 100.0 else Color(0.2, 0.8, 0.4)
	
	if is_defeated:
		lbl_boss.text = "ボス: 討伐完了"
		lbl_boss.add_theme_color_override("font_color", Color(0.3, 0.8, 0.5))
	elif rate >= 100.0:
		lbl_boss.text = "ボス: 挑戦可能！"
		lbl_boss.add_theme_color_override("font_color", Color(1.0, 0.7, 0.2))
	else:
		lbl_boss.text = "探索進行度: %.1f%%" % rate
		lbl_boss.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
		
	for sig in btn.pressed.get_connections():
		btn.pressed.disconnect(sig.callable)
	btn.pressed.connect(func(): _show_area_detail(area_id))


# --- 詳細ポップアップ表示・ダブルバッファロジック ---

func _refresh_detail_popup():
	# 現在詳細表示中のテキストのみをアトミックに更新しつつ、
	# 主要なステータス変化（死亡、アップグレード・クラフト完了など）があった場合のみ操作UIを再構築する
	match active_detail_type:
		"item":
			_update_item_detail_text(active_detail_id)
		"villager":
			var v = active_detail_obj as Villager
			if v:
				_update_villager_detail_text(v)
				var was_dead = last_detail_status_mats.get("is_dead", false)
				if was_dead != v.is_dead:
					last_detail_status_mats["is_dead"] = v.is_dead
					_setup_villager_detail_actions(v)
		"facility":
			var fac_id = active_detail_id
			_update_facility_detail_text(fac_id)
			
			var is_upgrading = GameState.active_upgrades.has(fac_id)
			var crafting_count = 0
			for recipe_id in GameState.active_crafts.keys():
				var recipe = Database.recipes[recipe_id]
				if recipe.facility == fac_id:
					crafting_count += 1
			
			var was_upgrading = last_detail_status_mats.get("is_upgrading", false)
			var was_crafting_count = last_detail_status_mats.get("crafting_count", 0)
			
			if was_upgrading != is_upgrading or was_crafting_count != crafting_count:
				last_detail_status_mats["is_upgrading"] = is_upgrading
				last_detail_status_mats["crafting_count"] = crafting_count
				_setup_facility_detail_actions(fac_id)
		"area":
			var area_id = active_detail_id
			_update_area_detail_text(area_id)
			
			var rate = GameState.explore_rates[area_id]
			var is_defeated = area_id in GameState.defeated_bosses
			var can_challenge = not is_defeated and rate >= 100.0
			
			var was_can_challenge = last_detail_status_mats.get("can_challenge", false)
			if was_can_challenge != can_challenge:
				last_detail_status_mats["can_challenge"] = can_challenge
				_setup_area_detail_actions(area_id)

func _clear_action_container():
	# ダブルバッファの両方のコンテナを完全にクリア
	for child in front_container.get_children():
		child.queue_free()
	for child in back_container.get_children():
		child.queue_free()

func _swap_detail_action_buffers():
	# バックバッファを表示し、フロントバッファを非表示に（一瞬で切り替え）
	front_container.visible = false
	back_container.visible = true
	
	# フロントとバックの参照を入れ替え
	var temp = front_container
	front_container = back_container
	back_container = temp

# 1. アイテム詳細
func _show_item_detail(item_id: String, open_dialog: bool = true):
	active_detail_type = "item"
	active_detail_id = item_id
	active_detail_obj = null
	last_detail_status_mats.clear()
	
	_update_item_detail_text(item_id)
	_clear_action_container() # アイテムは操作UIがないので、両方クリアするだけ
	
	if open_dialog:
		detail_popup.title = "アイテム詳細"
		detail_popup.popup_centered()

func _update_item_detail_text(item_id: String):
	var item = Database.items.get(item_id)
	if not item: return
	
	var count = GameState.inventory.get(item_id, 0)
	var txt = "[b][size=18]%s[/size][/b] (倉庫所持数: %d個)\n" % [item.name, count]
	txt += "[color=#aaaaaa]%s[/color]\n\n" % item.description
	
	var cat_str = "その他"
	match item.category:
		Database.Category.FOOD: cat_str = "食料・消耗品素材"
		Database.Category.WOOD: cat_str = "木材系素材"
		Database.Category.STONE: cat_str = "石材系素材"
		Database.Category.ORE: cat_str = "鉱石・金属素材"
		Database.Category.MANA_STONE: cat_str = "薬草・魔法石素材"
		Database.Category.MONSTER_MATERIAL: cat_str = "魔物素材"
		Database.Category.INTERMEDIATE: cat_str = "中間加工品"
		Database.Category.CONSUMABLE: cat_str = "薬品"
		Database.Category.WEAPON: cat_str = "武器"
		Database.Category.ARMOR: cat_str = "防具"
	txt += "■ 分類: %s\n" % cat_str
	txt += "■ 取引価値: 売却 %d G / 購入 %d G\n" % [item.value_sell, item.value_buy]
	
	if item.effect_data.size() > 0:
		txt += "■ 装備効果・性能:\n"
		for k in item.effect_data.keys():
			txt += "  - %s: %+d\n" % [k.to_upper(), item.effect_data[k]]
			
	detail_text.text = txt # アトミック代入

# 2. キャラクター詳細
func _show_villager_detail(v: Villager, open_dialog: bool = true):
	active_detail_type = "villager"
	active_detail_id = ""
	active_detail_obj = v
	
	last_detail_status_mats.clear()
	last_detail_status_mats["is_dead"] = v.is_dead
	
	_update_villager_detail_text(v)
	_setup_villager_detail_actions(v)
	
	if open_dialog:
		detail_popup.title = "キャラクター詳細"
		detail_popup.popup_centered()

func _update_villager_detail_text(v: Villager):
	var job_name = Database.jobs[v.current_job].name
	var txt = "[b][size=18]%s[/size][/b] [Lv.%d %s]\n" % [v.name, v.level, job_name]
	
	if v.is_dead:
		txt += "[color=#ff4444]状態: 死亡[/color]\n\n"
		detail_text.text = txt
		return
		
	txt += "■ HP: %d / %d\n" % [v.current_hp, v.get_max_hp()]
	txt += "■ スタミナ: %d / %d\n" % [v.current_stamina, v.get_max_stamina()]
	txt += "■ EXP: %d / %d\n\n" % [v.exp, v.get_required_exp()]
	
	txt += "■ 能力値:\n"
	txt += "  - 物理攻撃 (STR): %d\n" % v.get_str()
	txt += "  - 魔法効果 (INT): %d\n" % v.get_int()
	txt += "  - 技術器用 (DEX): %d\n" % v.get_dex()
	txt += "  - 俊敏素早 (AGI): %d\n" % v.get_agi()
	txt += "  - 防御体力 (VIT): %d\n\n" % v.get_vit()
	
	var w_name = Database.items[v.weapon_id].name if v.weapon_id != "" else "なし"
	var a_name = Database.items[v.armor_id].name if v.armor_id != "" else "なし"
	txt += "■ 装備:\n"
	txt += "  - 武器: %s\n" % w_name
	txt += "  - 防具: %s\n" % a_name
	
	detail_text.text = txt # アトミック代入

func _setup_villager_detail_actions(v: Villager):
	# 1. バックバッファのクリア
	for child in back_container.get_children():
		child.queue_free()
		
	if v.is_dead:
		_swap_detail_action_buffers()
		return
		
	# 2. バックバッファ上にコントロールを生成配置
	# (1) 行動指針
	var order_hbox = HBoxContainer.new()
	var order_lbl = Label.new()
	order_lbl.text = "行動方針: "
	order_lbl.custom_minimum_size = Vector2(80, 0)
	order_hbox.add_child(order_lbl)
	
	var order_opt = OptionButton.new()
	order_opt.add_item("採取", 0)
	order_opt.add_item("討伐", 1)
	order_opt.add_item("宿屋休養", 2)
	var cur_idx = 0
	if v.order == "hunt": cur_idx = 1
	elif v.order == "inn": cur_idx = 2
	order_opt.selected = cur_idx
	order_opt.item_selected.connect(func(idx):
		var prev_order = v.order
		if idx == 0:
			v.order = "gather"
			if prev_order == "inn":
				var area = Database.areas.get(v.assigned_area)
				if area:
					v.travel_time = int(area.difficulty * 2)
					v.is_returning = false
		elif idx == 1:
			v.order = "hunt"
			if prev_order == "inn":
				var area = Database.areas.get(v.assigned_area)
				if area:
					v.travel_time = int(area.difficulty * 2)
					v.is_returning = false
		elif idx == 2:
			v.order = "inn"
			v.travel_time = 0
			v.is_returning = false
			
		GameState.add_log("%s の方針を「%s」に変更しました。" % [v.name, order_opt.get_item_text(idx)])
		_update_villager_detail_text(v) # テキストだけ更新（ちらつきゼロ）
		update_ui()
	)
	order_hbox.add_child(order_opt)
	back_container.add_child(order_hbox)
	
	# (2) 派遣先
	var area_hbox = HBoxContainer.new()
	var area_lbl = Label.new()
	area_lbl.text = "派遣エリア: "
	area_lbl.custom_minimum_size = Vector2(80, 0)
	area_hbox.add_child(area_lbl)
	
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
		GameState.change_villager_area(v, area_id)
		_update_villager_detail_text(v)
		update_ui()
	)
	area_hbox.add_child(area_opt)
	back_container.add_child(area_hbox)
	
	# (3) 転職
	var job_hbox = HBoxContainer.new()
	var job_lbl = Label.new()
	job_lbl.text = "職業変更: "
	job_lbl.custom_minimum_size = Vector2(80, 0)
	job_hbox.add_child(job_lbl)
	
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
	job_hbox.add_child(job_opt)
	
	var change_job_btn = Button.new()
	change_job_btn.text = "転職する"
	change_job_btn.pressed.connect(func():
		var sel_job_id = job_opt.get_item_metadata(job_opt.selected)
		if sel_job_id != v.current_job:
			if GameState.change_job(v, sel_job_id):
				_update_villager_detail_text(v)
				update_ui()
	)
	job_hbox.add_child(change_job_btn)
	back_container.add_child(job_hbox)
	
	# 3. ダブルバッファの切替
	_swap_detail_action_buffers()

# 3. 施設詳細
func _show_facility_detail(fac_id: String, open_dialog: bool = true):
	active_detail_type = "facility"
	active_detail_id = fac_id
	active_detail_obj = null
	
	last_detail_status_mats.clear()
	var is_upgrading = GameState.active_upgrades.has(fac_id)
	var crafting_count = 0
	for recipe_id in GameState.active_crafts.keys():
		var recipe = Database.recipes[recipe_id]
		if recipe.facility == fac_id:
			crafting_count += 1
	last_detail_status_mats["is_upgrading"] = is_upgrading
	last_detail_status_mats["crafting_count"] = crafting_count
	
	_update_facility_detail_text(fac_id)
	_setup_facility_detail_actions(fac_id)
	
	if open_dialog:
		detail_popup.title = "施設詳細・クラフト"
		detail_popup.popup_centered()

func _update_facility_detail_text(fac_id: String):
	var lv = GameState.facility_levels[fac_id]
	var fac_name = GameState._get_facility_name(fac_id)
	
	var txt = "[b][size=18]%s[/size][/b] (施設ランク: Lv.%d)\n" % [fac_name, lv]
	var desc = ""
	if fac_id == "inn": desc = "村人の最大雇用人数を増やし、宿屋休養(inn)時の毎時間HP・スタミナの回復量を向上させます。"
	elif fac_id == "workshop": desc = "採取してきた木材や石材を消費し、より高度なクラフト材料（木板や石レンガ等）を加工・生産します。"
	elif fac_id == "forge": desc = "金属インゴットと燃料を消費して、村人が装備できる強力な武器・防具を鍛造・クラフトします。"
	elif fac_id == "alchemy_lab": desc = "採取した薬草や魔力石を調合し、HPを即時回復するポーションなどの薬品を生産します。"
	elif fac_id == "trading_post": desc = "倉庫内の素材をあらかじめ設定した価格・数量ルールに従って毎日自動で売買（自動取引）します。"
	
	txt += "[color=#aaaaaa]%s[/color]\n\n" % desc
	
	if GameState.active_upgrades.has(fac_id):
		txt += "[color=#00ff55]※ 現在施設をアップグレード中です。(残り%d時間)[/color]\n" % GameState.active_upgrades[fac_id]
	
	detail_text.text = txt # アトミック代入

func _setup_facility_detail_actions(fac_id: String):
	# 1. バックバッファクリア
	for child in back_container.get_children():
		child.queue_free()
		
	var lv = GameState.facility_levels[fac_id]
	
	# アップグレードボタン
	if lv < 4 and not GameState.active_upgrades.has(fac_id):
		var upgrade_hbox = HBoxContainer.new()
		var cost = GameState.get_facility_upgrade_cost(fac_id)
		var cost_gold = cost.gold
		var cost_items = cost.items
		
		var mats_text = ""
		var can_upgrade = GameState.gold >= cost_gold
		for m in cost_items:
			var owned = GameState.inventory.get(m.id, 0)
			var mat_name = Database.items[m.id].name
			if mats_text != "": mats_text += ", "
			mats_text += "%s(%d/%d)" % [mat_name, owned, m.amount]
			if owned < m.amount: can_upgrade = false
			
		var up_btn = Button.new()
		up_btn.text = "建設する" if lv == 0 else "アップグレード (所要:%d時間)" % ((lv + 1) * 4)
		up_btn.disabled = not can_upgrade
		up_btn.pressed.connect(func():
			if GameState.upgrade_facility(fac_id):
				_show_facility_detail(fac_id) # アップグレード進行状態に再構築するため、全体更新
				update_ui()
		)
		upgrade_hbox.add_child(up_btn)
		
		var lbl_cost = Label.new()
		lbl_cost.text = "コスト: %dG / 必要素材: %s" % [cost_gold, mats_text if mats_text != "" else "なし"]
		lbl_cost.add_theme_font_size_override("font_size", 11)
		lbl_cost.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
		upgrade_hbox.add_child(lbl_cost)
		back_container.add_child(upgrade_hbox)
		
	# クラフトレシピ
	if lv > 0:
		var recipes_to_show = []
		for r_id in Database.recipes.keys():
			var r = Database.recipes[r_id]
			if r.facility == fac_id and lv >= r.required_level:
				recipes_to_show.append(r_id)
				
		if recipes_to_show.size() > 0:
			var lbl_title = Label.new()
			lbl_title.text = "【加工・クラフトレシピ一覧】"
			lbl_title.add_theme_font_size_override("font_size", 12)
			back_container.add_child(lbl_title)
			
			for r_id in recipes_to_show:
				var r = Database.recipes[r_id]
				var r_hbox = HBoxContainer.new()
				
				var mats_text = ""
				var can_craft = true
				for m in r.materials:
					var owned = GameState.inventory.get(m.id, 0)
					if mats_text != "": mats_text += ", "
					mats_text += "%s(%d/%d)" % [Database.items[m.id].name, owned, m.amount]
					if owned < m.amount: can_craft = false
					
				var r_lbl = Label.new()
				r_lbl.text = " - %s [材料: %s]" % [Database.items[r.result.id].name, mats_text]
				r_lbl.add_theme_font_size_override("font_size", 11)
				r_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				r_hbox.add_child(r_lbl)
				
				var craft_btn = Button.new()
				if GameState.active_crafts.has(r_id):
					craft_btn.text = "加工中 (残り:%.1f)" % GameState.active_crafts[r_id]
					craft_btn.disabled = true
				else:
					craft_btn.text = "生産開始"
					craft_btn.disabled = not can_craft
					craft_btn.pressed.connect(func():
						if GameState.start_craft(r_id):
							_show_facility_detail(fac_id) # ボタン表記変更のため全体更新
							update_ui()
					)
				r_hbox.add_child(craft_btn)
				back_container.add_child(r_hbox)
				
	# 3. ダブルバッファの切替
	_swap_detail_action_buffers()

# 4. フィールド・ダンジョン詳細
func _show_area_detail(area_id: String, open_dialog: bool = true):
	active_detail_type = "area"
	active_detail_id = area_id
	active_detail_obj = null
	
	last_detail_status_mats.clear()
	var rate = GameState.explore_rates[area_id]
	var is_defeated = area_id in GameState.defeated_bosses
	last_detail_status_mats["can_challenge"] = (not is_defeated and rate >= 100.0)
	
	_update_area_detail_text(area_id)
	_setup_area_detail_actions(area_id)
	
	if open_dialog:
		detail_popup.title = "ダンジョン・フィールド詳細"
		detail_popup.popup_centered()

func _update_area_detail_text(area_id: String):
	var area = Database.areas.get(area_id)
	if not area: return
	
	var rate = GameState.explore_rates[area_id]
	var txt = "[b][size=18]%s[/size][/b] (難易度: ★%d)\n" % [area.name, area.difficulty]
	txt += "■ 探索完了度: %.1f%%\n" % rate
	
	var is_defeated = area_id in GameState.defeated_bosses
	if is_defeated:
		txt += "■ ボス「%s」: [color=#00ff66]討伐完了 (解放条件クリア)[/color]\n\n" % area.boss.name
	else:
		txt += "■ 目標ボス: 「%s」 (未撃破)\n\n" % area.boss.name
		
	txt += "■ 出現する可能性のある魔物:\n"
	for m in area.monsters:
		txt += "  - %s (Lv.%d) - ドロップ: %s\n" % [m.name, m.level, Database.items[m.drop].name]
	txt += "\n"
	
	txt += "■ 採取可能な一次素材:\n"
	for g in area.gathers:
		txt += "  - %s (採取確率: %d%%)\n" % [Database.items[g.id].name, int(g.rate * 100)]
		
	detail_text.text = txt # アトミック代入

func _setup_area_detail_actions(area_id: String):
	# 1. バックバッファクリア
	for child in back_container.get_children():
		child.queue_free()
		
	var area = Database.areas.get(area_id)
	if not area:
		_swap_detail_action_buffers()
		return
	
	var rate = GameState.explore_rates[area_id]
	var is_defeated = area_id in GameState.defeated_bosses
	
	# ボス挑戦ボタン
	if not is_defeated and rate >= 100.0:
		var challenge_btn = Button.new()
		challenge_btn.text = "ボス「%s」に挑戦する！ (全員で戦闘を行います)" % area.boss.name
		challenge_btn.custom_minimum_size = Vector2(0, 40)
		challenge_btn.pressed.connect(func():
			detail_popup.hide()
			if GameState.challenge_boss(area_id):
				update_ui()
		)
		back_container.add_child(challenge_btn)
		
	# 3. ダブルバッファの切替
	_swap_detail_action_buffers()


# --- 過去ログ履歴表示 ---
func _on_history_pressed():
	history_log_text.text = ""
	var hist_text = ""
	for line in logs_archive:
		hist_text += line + "\n"
	history_log_text.text = hist_text
	history_popup.popup_centered()

# --- ゲームオーバー/転生処理 ---
func _on_restart_loop_pressed():
	GameState.start_new_game(false)
	rebirth_panel.hide()
	update_ui()

func _on_target_button_pressed():
	show_detailed_target = not show_detailed_target
	update_ui()
