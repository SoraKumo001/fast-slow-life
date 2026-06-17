class_name Villager
extends Resource

@export var name: String = "村人"
@export var level: int = 1
@export var exp: int = 0
@export var current_job: String = "unemployed"
@export var job_history: Array = ["unemployed"]

# 基本能力値 (成長するベース値)
@export var base_max_hp: int = 80
@export var current_hp: int = 80
@export var base_str: int = 8
@export var base_int: int = 8
@export var base_dex: int = 8
@export var base_agi: int = 8
@export var base_vit: int = 8

# 装備
@export var weapon_id: String = ""
@export var armor_id: String = ""

# 現在の指示方針: "gather" (採取), "hunt" (討伐), "inn" (宿屋待機・自動回復)
@export var order: String = "gather"
@export var assigned_area: String = "forest"

# 状態
@export var is_dead: bool = false

# 最終ステータスの取得（職業倍率と装備補正の適用）
func get_str() -> int:
	var job = Database.jobs.get(current_job)
	var mod = job.str_mod if job else 1.0
	var equip_bonus = _get_equip_bonus("str")
	return int(base_str * mod) + equip_bonus

func get_int() -> int:
	var job = Database.jobs.get(current_job)
	var mod = job.int_mod if job else 1.0
	var equip_bonus = _get_equip_bonus("int")
	return int(base_int * mod) + equip_bonus

func get_dex() -> int:
	var job = Database.jobs.get(current_job)
	var mod = job.dex_mod if job else 1.0
	var equip_bonus = _get_equip_bonus("dex")
	return int(base_dex * mod) + equip_bonus

func get_agi() -> int:
	var job = Database.jobs.get(current_job)
	var mod = job.agi_mod if job else 1.0
	var equip_bonus = _get_equip_bonus("agi")
	return int(base_agi * mod) + equip_bonus

func get_vit() -> int:
	var job = Database.jobs.get(current_job)
	var mod = job.vit_mod if job else 1.0
	var equip_bonus = _get_equip_bonus("vit")
	return int(base_vit * mod) + equip_bonus

func get_max_hp() -> int:
	var equip_bonus = _get_equip_bonus("vit") * 5 # VIT補正分HP追加
	return base_max_hp + equip_bonus

# 装備品からのパラメータ補正取得
func _get_equip_bonus(stat_name: String) -> int:
	var bonus = 0
	if weapon_id != "" and Database.items.has(weapon_id):
		var eff = Database.items[weapon_id].effect_data
		if eff.has(stat_name):
			bonus += eff[stat_name]
	if armor_id != "" and Database.items.has(armor_id):
		var eff = Database.items[armor_id].effect_data
		if eff.has(stat_name):
			bonus += eff[stat_name]
	return bonus

# 経験値獲得とレベルアップ
func add_exp(amount: int) -> String:
	if is_dead: return ""
	exp += amount
	var required = get_required_exp()
	var log_msg = ""
	while exp >= required:
		exp -= required
		level += 1
		_level_up_stats()
		log_msg += "\n[LV UP] %s がレベル %d に上がった！" % [name, level]
		required = get_required_exp()
	return log_msg

func get_required_exp() -> int:
	return level * 50 + 50

# レベルアップ時の能力値上昇
func _level_up_stats():
	# 職業による成長傾向
	var job = Database.jobs.get(current_job)
	var str_grow = 1 if randf() < (0.5 * (job.str_mod if job else 1.0)) else 0
	var int_grow = 1 if randf() < (0.5 * (job.int_mod if job else 1.0)) else 0
	var dex_grow = 1 if randf() < (0.5 * (job.dex_mod if job else 1.0)) else 0
	var agi_grow = 1 if randf() < (0.5 * (job.agi_mod if job else 1.0)) else 0
	var vit_grow = 1 if randf() < (0.5 * (job.vit_mod if job else 1.0)) else 0
	
	# 最低でもどれか一つは上がるようにする
	if str_grow + int_grow + dex_grow + agi_grow + vit_grow == 0:
		str_grow = 1
		
	base_str += str_grow
	base_int += int_grow
	base_dex += dex_grow
	base_agi += agi_grow
	base_vit += vit_grow
	
	base_max_hp += vit_grow * 5 + randi_range(2, 5)
	current_hp = get_max_hp() # レベルアップ時に全回復

# ダメージを受ける
func take_damage(amount: int) -> bool:
	if is_dead: return false
	current_hp = max(0, current_hp - amount)
	if current_hp <= 0:
		is_dead = true
		return true # 死亡した
	return false

# 回復
func heal(amount: int):
	if is_dead: return
	current_hp = min(get_max_hp(), current_hp + amount)
