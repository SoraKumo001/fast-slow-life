using Godot;
using System;
using System.Collections.Generic;
using System.Linq;

public partial class MainUI : Control
{
    // UI要素の参照 (Unique Name機能を利用)
    private Label _dayLabel;
    private Label _hourLabel;
    private Label _goldLabel;
    private Label _foodLabel;
    private Label _soulLabel;
    private Button _targetLabel; // GDScript側でpressedシグナルがあるのでButton

    // 時間コントロール
    private Button _btnPause;
    private Button _btnPlay;
    private Button _btnDouble;
    private Button _btnSkip;

    // 4カラム
    private VBoxContainer _inventoryContainer;
    private VBoxContainer _villagerContainer;
    private VBoxContainer _facilityContainer;
    private VBoxContainer _areaContainer;

    // ログティッカー
    private RichTextLabel _logTicker;
    private Button _btnHistory;

    // ポップアップ
    private AcceptDialog _detailPopup; // Window/AcceptDialog
    private RichTextLabel _detailText;
    private VBoxContainer _actionContainerA;
    private VBoxContainer _actionContainerB;
    private AcceptDialog _historyPopup;
    private RichTextLabel _historyLogText;

    // ゲームオーバー画面
    private Panel _rebirthPanel; // RebirthPanel
    private Button _restartLoopBtn;

    // タイマー
    private Timer _autoPlayTimer;

    private readonly List<string> _logsArchive = new();
    private bool _showDetailedTarget = false;
    private bool _isPaused = true;
    private double _currentSpeed = 1.0;

    // 詳細表示中のオブジェクトを追跡するための変数
    private string _activeDetailType = ""; // "item", "villager", "facility", "area"
    private string _activeDetailId = "";
    private Villager _activeDetailObj = null;

    // 操作UIダブルバッファ用参照
    private VBoxContainer _frontContainer;
    private VBoxContainer _backContainer;

    // 詳細ポップアップの状態変化検知用キャッシュ
    private readonly Dictionary<string, Variant> _lastDetailStatusMats = new();

    public override void _Ready()
    {
        // ユニークノードのバインド
        _dayLabel = GetNode<Label>("%DayLabel");
        _hourLabel = GetNode<Label>("%HourLabel");
        _goldLabel = GetNode<Label>("%GoldLabel");
        _foodLabel = GetNode<Label>("%FoodLabel");
        _soulLabel = GetNode<Label>("%SoulPointsLabel");
        _targetLabel = GetNode<Button>("%TargetLabel");

        _btnPause = GetNode<Button>("%BtnPause");
        _btnPlay = GetNode<Button>("%BtnPlay");
        _btnDouble = GetNode<Button>("%BtnDouble");
        _btnSkip = GetNode<Button>("%BtnSkip");

        _inventoryContainer = GetNode<VBoxContainer>("%InventoryContainer");
        _villagerContainer = GetNode<VBoxContainer>("%VillagerContainer");
        _facilityContainer = GetNode<VBoxContainer>("%FacilityContainer");
        _areaContainer = GetNode<VBoxContainer>("%AreaContainer");

        _logTicker = GetNode<RichTextLabel>("%LogTicker");
        _btnHistory = GetNode<Button>("%BtnHistory");

        _detailPopup = GetNode<AcceptDialog>("%DetailPopup");
        _detailText = GetNode<RichTextLabel>("%DetailText");
        _actionContainerA = GetNode<VBoxContainer>("%ActionContainerA");
        _actionContainerB = GetNode<VBoxContainer>("%ActionContainerB");
        _historyPopup = GetNode<AcceptDialog>("%HistoryPopup");
        _historyLogText = GetNode<RichTextLabel>("%HistoryLogText");

        _rebirthPanel = GetNode<Panel>("%RebirthPanel");
        _restartLoopBtn = GetNode<Button>("%RestartLoopButton");

        _autoPlayTimer = GetNode<Timer>("%AutoPlayTimer");

        // ダブルバッファ初期設定
        _frontContainer = _actionContainerA;
        _backContainer = _actionContainerB;
        _frontContainer.Visible = true;
        _backContainer.Visible = false;

        // シグナル接続 (GameState)
        GameState.Instance.Connect(GameState.SignalName.GameStateUpdated, Callable.From(UpdateUI));
        GameState.Instance.Connect(GameState.SignalName.LogAdded, Callable.From<string>(AddLogMessage));

        _autoPlayTimer.Timeout += OnTimerTimeout;

        // 時間コントロールボタンのイベント接続
        _btnPause.Pressed += OnPausePressed;
        _btnPlay.Pressed += OnPlayPressed;
        _btnDouble.Pressed += OnDoublePressed;
        _btnSkip.Pressed += OnSkipPressed;
        _btnHistory.Pressed += OnHistoryPressed;
        _restartLoopBtn.Pressed += OnRestartLoopPressed;
        _targetLabel.Pressed += OnTargetButtonPressed;

        // 初期速度セット (ポーズ状態)
        OnPausePressed();

        // 初回UI更新
        UpdateUI();

        AddLogMessage("=== 村の開拓へようこそ！ ===");
    }

    private void AddLogMessage(string msg)
    {
        string colored = msg;
        if (msg.Contains("[LV UP]") || msg.Contains("レベル"))
        {
            colored = "[color=#ffd700][b]" + msg + "[/b][/color]";
        }
        else if (msg.Contains("警告") || msg.Contains("飢え") || msg.Contains("死亡") || msg.Contains("敗北") || msg.Contains("[疲労]"))
        {
            colored = "[color=#ff4d4d][b]" + msg + "[/b][/color]";
        }
        else if (msg.Contains("勝利") || msg.Contains("回復") || msg.Contains("撃破") || msg.Contains("帰還"))
        {
            colored = "[color=#4dff88][b]" + msg + "[/b][/color]";
        }
        else if (msg.Contains("クラフト完成") || msg.Contains("大成功") || msg.Contains("施設アップグレード完了"))
        {
            colored = "[color=#00e5ff][b]" + msg + "[/b][/color]";
        }
        else if (msg.Contains("採取した") || msg.Contains("ゴールド獲得") || msg.Contains("手に入れた"))
        {
            colored = "[color=#66b2ff]" + msg + "[/color]";
        }
        else if (msg.Contains("ボス戦開始"))
        {
            colored = "[color=#ff3399][b]" + msg + "[/b][/color]";
        }

        _logsArchive.Add(colored);
        if (_logsArchive.Count > 200)
        {
            _logsArchive.RemoveAt(0);
        }

        string tickerText = "";
        int startIdx = Math.Max(0, _logsArchive.Count - 3);
        for (int i = startIdx; i < _logsArchive.Count; i++)
        {
            if (tickerText != "")
            {
                tickerText += "  |  ";
            }
            tickerText += _logsArchive[i].Replace("\n", " ");
        }

        _logTicker.Text = tickerText;
    }

    private void UpdateUI()
    {
        _dayLabel.Text = $"経過日数: {GameState.Instance.CurrentDay}日目";
        _hourLabel.Text = $"{GameState.Instance.CurrentHour:02}:00";
        _goldLabel.Text = $"{GameState.Instance.Gold} G";

        int aliveCount = GameState.Instance.GetAliveVillagersCount();
        _foodLabel.Text = $"食料: {GameState.Instance.Food} (-{aliveCount}/日)";

        _soulLabel.Text = $"{GameState.Instance.SoulPoints} SP";

        string bossName = GameState.Instance.CurrentTier switch
        {
            2 => "ゴーレム",
            3 => "キマイラ",
            4 => "アークデーモン",
            5 => "終焉の竜",
            _ => "ゴブリンロード"
        };

        if (GameState.Instance.IsGameCleared)
        {
            _targetLabel.Text = "目標: 完全クリア！";
        }
        else
        {
            if (_showDetailedTarget)
            {
                _targetLabel.Text = $"目標: {GameState.Instance.TargetDay}日目までに「{bossName}」を討伐！";
            }
            else
            {
                _targetLabel.Text = $"期限: {GameState.Instance.TargetDay}日目まで (クリックで詳細)";
            }
        }

        UpdateInventoryColumn();
        UpdateVillagerColumn();
        UpdateFacilityColumn();
        UpdateAreaColumn();

        _rebirthPanel.Visible = GameState.Instance.IsGameOver;

        if (_detailPopup.Visible)
        {
            RefreshDetailPopup();
        }
    }

    private void OnPausePressed()
    {
        _isPaused = true;
        _autoPlayTimer.Stop();
        UpdateTimeControlButtonsState();
        GameState.Instance.AddLog("ゲームを一時停止しました。");
    }

    private void OnPlayPressed()
    {
        _isPaused = false;
        _currentSpeed = 1.0;
        _autoPlayTimer.WaitTime = 1.0;
        _autoPlayTimer.Start();
        UpdateTimeControlButtonsState();
        GameState.Instance.AddLog("時間進行速度を 1倍速 に設定しました。");
    }

    private void OnDoublePressed()
    {
        _isPaused = false;
        if (_currentSpeed == 2.0)
        {
            _currentSpeed = 4.0;
            _autoPlayTimer.WaitTime = 0.25;
            GameState.Instance.AddLog("時間進行速度を 4倍速 に設定しました。");
        }
        else
        {
            _currentSpeed = 2.0;
            _autoPlayTimer.WaitTime = 0.5;
            GameState.Instance.AddLog("時間進行速度を 2倍速 に設定しました。");
        }
        _autoPlayTimer.Start();
        UpdateTimeControlButtonsState();
    }

    private void OnSkipPressed()
    {
        if (_isPaused)
        {
            GameState.Instance.AddLog("24時間スキップを実行します...");
            GameState.Instance.AdvanceDay();
        }
        else
        {
            GameState.Instance.AddLog("一時停止中のみ1日スキップが可能です。");
        }
    }

    private void OnTimerTimeout()
    {
        if (GameState.Instance.IsGameOver)
        {
            OnPausePressed();
            return;
        }
        GameState.Instance.AdvanceHour();
    }

    private void UpdateTimeControlButtonsState()
    {
        _btnPause.Flat = !_isPaused;
        _btnPlay.Flat = (_isPaused || _currentSpeed != 1.0);
        _btnDouble.Flat = (_isPaused || (_currentSpeed != 2.0 && _currentSpeed != 4.0));
        _btnDouble.Text = _currentSpeed == 4.0 ? ">> (4x)" : ">>";
        _btnSkip.Disabled = !_isPaused;
    }

    // --- 4カラムのノード再利用（キャッシュ）更新ロジック ---

    private void ClearIncomingConnections(Node node, string signalName)
    {
        foreach (Godot.Collections.Dictionary conn in node.GetSignalConnectionList(signalName))
        {
            node.Disconnect(signalName, (Callable)conn["callable"]);
        }
    }

    private void UpdateInventoryColumn()
    {
        var itemsSorted = GameState.Instance.Inventory.Keys.ToList();
        itemsSorted.Sort();

        var activeItems = new List<Tuple<string, int>>();
        foreach (var itemId in itemsSorted)
        {
            int count = GameState.Instance.Inventory[itemId];
            if (count > 0 && Database.Instance.Items.ContainsKey(itemId))
            {
                activeItems.Add(Tuple.Create(itemId, count));
            }
        }

        int targetCount = activeItems.Count;

        while (_inventoryContainer.GetChildCount() < targetCount)
        {
            var btn = new Button();
            btn.Alignment = HorizontalAlignment.Left;
            btn.CustomMinimumSize = new Vector2(0, 32);
            _inventoryContainer.AddChild(btn);
        }
        while (_inventoryContainer.GetChildCount() > targetCount)
        {
            var extra = _inventoryContainer.GetChild(_inventoryContainer.GetChildCount() - 1);
            _inventoryContainer.RemoveChild(extra);
            extra.QueueFree();
        }

        for (int i = 0; i < targetCount; i++)
        {
            var btn = (Button)_inventoryContainer.GetChild(i);
            var data = activeItems[i];
            var item = Database.Instance.Items[data.Item1];

            btn.Text = $" {item.Name}  x{data.Item2}";

            ClearIncomingConnections(btn, "pressed");
            string id = data.Item1;
            btn.Connect("pressed", Callable.From(() => ShowItemDetail(id, true)));
        }
    }

    private void UpdateVillagerColumn()
    {
        var villagers = GameState.Instance.Villagers;
        int targetCount = villagers.Count;

        while (_villagerContainer.GetChildCount() < targetCount)
        {
            var card = CreateVillagerCardNode();
            _villagerContainer.AddChild(card);
        }
        while (_villagerContainer.GetChildCount() > targetCount)
        {
            var extra = _villagerContainer.GetChild(_villagerContainer.GetChildCount() - 1);
            _villagerContainer.RemoveChild(extra);
            extra.QueueFree();
        }

        for (int i = 0; i < targetCount; i++)
        {
            var card = (PanelContainer)_villagerContainer.GetChild(i);
            var v = villagers[i];
            UpdateVillagerCardValues(card, v);
        }
    }

    private PanelContainer CreateVillagerCardNode()
    {
        var panel = new PanelContainer();
        panel.CustomMinimumSize = new Vector2(0, 95);

        var style = new StyleBoxFlat();
        style.BgColor = new Color(0.12f, 0.13f, 0.16f, 0.9f);
        style.BorderWidthLeft = 3;
        style.ContentMarginLeft = 8;
        style.ContentMarginTop = 6;
        style.ContentMarginRight = 8;
        style.ContentMarginBottom = 6;
        panel.AddThemeStyleboxOverride("panel", style);

        var vbox = new VBoxContainer();
        vbox.AddThemeConstantOverride("separation", 3);
        panel.AddChild(vbox);

        var lblName = new Label();
        lblName.AddThemeFontSizeOverride("font_size", 13);
        vbox.AddChild(lblName);

        var hpBar = new ProgressBar();
        hpBar.CustomMinimumSize = new Vector2(0, 10);
        hpBar.ShowPercentage = false;
        var hpFill = new StyleBoxFlat();
        hpFill.BgColor = new Color(0.2f, 0.8f, 0.3f);
        hpBar.AddThemeStyleboxOverride("fill", hpFill);
        vbox.AddChild(hpBar);

        var stBar = new ProgressBar();
        stBar.CustomMinimumSize = new Vector2(0, 8);
        stBar.ShowPercentage = false;
        var stFill = new StyleBoxFlat();
        stFill.BgColor = new Color(0.9f, 0.7f, 0.1f);
        stBar.AddThemeStyleboxOverride("fill", stFill);
        vbox.AddChild(stBar);

        var lblTask = new Label();
        lblTask.AddThemeFontSizeOverride("font_size", 11);
        lblTask.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.8f));
        vbox.AddChild(lblTask);

        var btn = new Button();
        btn.Flat = true;
        btn.CustomMinimumSize = panel.CustomMinimumSize;
        panel.AddChild(btn);

        panel.SetMeta("lbl_name", lblName);
        panel.SetMeta("hp_bar", hpBar);
        panel.SetMeta("st_bar", stBar);
        panel.SetMeta("lbl_task", lblTask);
        panel.SetMeta("btn", btn);
        panel.SetMeta("style", style);

        return panel;
    }

    private void UpdateVillagerCardValues(PanelContainer panel, Villager v)
    {
        var lblName = (Label)panel.GetMeta("lbl_name");
        var hpBar = (ProgressBar)panel.GetMeta("hp_bar");
        var stBar = (ProgressBar)panel.GetMeta("st_bar");
        var lblTask = (Label)panel.GetMeta("lbl_task");
        var btn = (Button)panel.GetMeta("btn");
        var style = (StyleBoxFlat)panel.GetMeta("style");

        var jobName = Database.Instance.Jobs.GetValueOrDefault(v.CurrentJob)?.Name ?? v.CurrentJob;
        lblName.Text = $"{v.Name} [Lv.{v.Level} {jobName}]";

        if (v.IsDead)
        {
            lblName.Text += " (死亡)";
            lblName.AddThemeColorOverride("font_color", new Color(0.8f, 0.3f, 0.3f));
            style.BorderColor = new Color(0.8f, 0.2f, 0.2f);
            hpBar.Visible = false;
            stBar.Visible = false;
            lblTask.Text = "死亡しました";
        }
        else
        {
            lblName.AddThemeColorOverride("font_color", new Color(1, 1, 1));
            style.BorderColor = new Color(0.2f, 0.7f, 0.9f);
            hpBar.Visible = true;
            stBar.Visible = true;

            hpBar.MaxValue = v.GetMaxHp();
            hpBar.Value = v.CurrentHp;

            stBar.MaxValue = v.GetMaxStamina();
            stBar.Value = v.CurrentStamina;

            if (v.Order == "inn")
            {
                lblTask.Text = "方針: 宿屋で休養中";
            }
            else
            {
                var areaName = Database.Instance.Areas.GetValueOrDefault(v.AssignedArea)?.Name ?? v.AssignedArea;
                string orderName = v.Order == "gather" ? "採取" : "討伐";
                if (v.TravelTime > 0)
                {
                    string dirName = v.IsReturning ? "帰還中" : "移動中";
                    lblTask.Text = $"派遣: {orderName} ({areaName}へ{dirName} あと{v.TravelTime}時間)";
                }
                else
                {
                    lblTask.Text = $"派遣: {orderName} ({areaName}で活動中)";
                }
            }
        }

        ClearIncomingConnections(btn, "pressed");
        btn.Connect("pressed", Callable.From(() => ShowVillagerDetail(v, true)));
    }

    private void UpdateFacilityColumn()
    {
        var facIds = GameState.Instance.FacilityLevels.Keys.ToList();
        int targetCount = facIds.Count;

        while (_facilityContainer.GetChildCount() < targetCount)
        {
            var card = CreateFacilityCardNode();
            _facilityContainer.AddChild(card);
        }
        while (_facilityContainer.GetChildCount() > targetCount)
        {
            var extra = _facilityContainer.GetChild(_facilityContainer.GetChildCount() - 1);
            _facilityContainer.RemoveChild(extra);
            extra.QueueFree();
        }

        for (int i = 0; i < targetCount; i++)
        {
            var card = (PanelContainer)_facilityContainer.GetChild(i);
            var facId = facIds[i];
            UpdateFacilityCardValues(card, facId);
        }
    }

    private PanelContainer CreateFacilityCardNode()
    {
        var panel = new PanelContainer();
        panel.CustomMinimumSize = new Vector2(0, 75);

        var style = new StyleBoxFlat();
        style.BgColor = new Color(0.12f, 0.14f, 0.18f, 0.9f);
        style.BorderWidthLeft = 3;
        style.ContentMarginLeft = 8;
        style.ContentMarginTop = 6;
        style.ContentMarginRight = 8;
        style.ContentMarginBottom = 6;
        panel.AddThemeStyleboxOverride("panel", style);

        var vbox = new VBoxContainer();
        vbox.AddThemeConstantOverride("separation", 4);
        panel.AddChild(vbox);

        var lblName = new Label();
        lblName.AddThemeFontSizeOverride("font_size", 13);
        vbox.AddChild(lblName);

        var lblStatus = new Label();
        lblStatus.AddThemeFontSizeOverride("font_size", 11);
        lblStatus.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.8f));
        vbox.AddChild(lblStatus);

        var btn = new Button();
        btn.Flat = true;
        btn.CustomMinimumSize = panel.CustomMinimumSize;
        panel.AddChild(btn);

        panel.SetMeta("lbl_name", lblName);
        panel.SetMeta("lbl_status", lblStatus);
        panel.SetMeta("btn", btn);
        panel.SetMeta("style", style);

        return panel;
    }

    private void UpdateFacilityCardValues(PanelContainer panel, string facId)
    {
        var lblName = (Label)panel.GetMeta("lbl_name");
        var lblStatus = (Label)panel.GetMeta("lbl_status");
        var btn = (Button)panel.GetMeta("btn");
        var style = (StyleBoxFlat)panel.GetMeta("style");

        int lv = GameState.Instance.FacilityLevels[facId];
        string facName = GameState.Instance.GetFacilityName(facId);

        lblName.Text = lv > 0 ? $"{facName} (Lv.{lv})" : $"{facName} (未建設)";
        style.BorderColor = lv > 0 ? new Color(0.9f, 0.6f, 0.2f) : new Color(0.4f, 0.4f, 0.4f);

        if (GameState.Instance.ActiveUpgrades.ContainsKey(facId))
        {
            lblStatus.Text = $"状態: アップグレード中 (残り{GameState.Instance.ActiveUpgrades[facId]}時間)";
        }
        else
        {
            int craftingCount = 0;
            foreach (var recipeId in GameState.Instance.ActiveCrafts.Keys)
            {
                var recipe = Database.Instance.Recipes.GetValueOrDefault(recipeId);
                if (recipe != null && recipe.Facility == facId)
                {
                    craftingCount++;
                }
            }

            if (craftingCount > 0)
            {
                lblStatus.Text = $"状態: 加工クラフト中 ({craftingCount}件)";
            }
            else
            {
                lblStatus.Text = lv > 0 ? "状態: アイドル" : "状態: ロック";
            }
        }

        ClearIncomingConnections(btn, "pressed");
        btn.Connect("pressed", Callable.From(() => ShowFacilityDetail(facId, true)));
    }

    private void UpdateAreaColumn()
    {
        var areaIds = new List<string>();
        foreach (var areaId in Database.Instance.Areas.Keys)
        {
            bool isUnlocked = true;
            if (areaId == "mine" && !GameState.Instance.DefeatedBosses.Contains("forest")) isUnlocked = false;
            else if (areaId == "valley" && !GameState.Instance.DefeatedBosses.Contains("mine")) isUnlocked = false;
            else if (areaId == "roots" && !GameState.Instance.DefeatedBosses.Contains("valley")) isUnlocked = false;
            else if (areaId == "abyss" && !GameState.Instance.DefeatedBosses.Contains("roots")) isUnlocked = false;

            if (isUnlocked)
            {
                areaIds.Add(areaId);
            }
        }

        int targetCount = areaIds.Count;

        while (_areaContainer.GetChildCount() < targetCount)
        {
            var card = CreateAreaCardNode();
            _areaContainer.AddChild(card);
        }
        while (_areaContainer.GetChildCount() > targetCount)
        {
            var extra = _areaContainer.GetChild(_areaContainer.GetChildCount() - 1);
            _areaContainer.RemoveChild(extra);
            extra.QueueFree();
        }

        for (int i = 0; i < targetCount; i++)
        {
            var card = (PanelContainer)_areaContainer.GetChild(i);
            var areaId = areaIds[i];
            UpdateAreaCardValues(card, areaId);
        }
    }

    private PanelContainer CreateAreaCardNode()
    {
        var panel = new PanelContainer();
        panel.CustomMinimumSize = new Vector2(0, 75);

        var style = new StyleBoxFlat();
        style.BgColor = new Color(0.11f, 0.15f, 0.15f, 0.9f);
        style.BorderWidthLeft = 3;
        style.ContentMarginLeft = 8;
        style.ContentMarginTop = 6;
        style.ContentMarginRight = 8;
        style.ContentMarginBottom = 6;
        panel.AddThemeStyleboxOverride("panel", style);

        var vbox = new VBoxContainer();
        vbox.AddThemeConstantOverride("separation", 4);
        panel.AddChild(vbox);

        var lblName = new Label();
        lblName.AddThemeFontSizeOverride("font_size", 13);
        vbox.AddChild(lblName);

        var bar = new ProgressBar();
        bar.CustomMinimumSize = new Vector2(0, 8);
        bar.ShowPercentage = false;
        var barStyle = new StyleBoxFlat();
        barStyle.BgColor = new Color(0.2f, 0.7f, 0.9f);
        bar.AddThemeStyleboxOverride("fill", barStyle);
        vbox.AddChild(bar);

        var lblBoss = new Label();
        lblBoss.AddThemeFontSizeOverride("font_size", 11);
        lblBoss.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.8f));
        vbox.AddChild(lblBoss);

        var btn = new Button();
        btn.Flat = true;
        btn.CustomMinimumSize = panel.CustomMinimumSize;
        panel.AddChild(btn);

        panel.SetMeta("lbl_name", lblName);
        panel.SetMeta("bar", bar);
        panel.SetMeta("bar_style", barStyle);
        panel.SetMeta("lbl_boss", lblBoss);
        panel.SetMeta("btn", btn);
        panel.SetMeta("style", style);

        return panel;
    }

    private void UpdateAreaCardValues(PanelContainer panel, string areaId)
    {
        var lblName = (Label)panel.GetMeta("lbl_name");
        var bar = (ProgressBar)panel.GetMeta("bar");
        var barStyle = (StyleBoxFlat)panel.GetMeta("bar_style");
        var lblBoss = (Label)panel.GetMeta("lbl_boss");
        var btn = (Button)panel.GetMeta("btn");
        var style = (StyleBoxFlat)panel.GetMeta("style");

        var area = Database.Instance.Areas[areaId];
        double rate = GameState.Instance.ExploreRates.GetValueOrDefault(areaId, 0.0);
        bool isDefeated = GameState.Instance.DefeatedBosses.Contains(areaId);

        lblName.Text = $"{area.Name} (★{(int)area.Difficulty})";
        style.BorderColor = isDefeated ? new Color(0.2f, 0.8f, 0.5f) : new Color(0.2f, 0.6f, 0.8f);

        bar.MaxValue = 100.0;
        bar.Value = rate;
        barStyle.BgColor = rate < 100.0 ? new Color(0.2f, 0.7f, 0.9f) : new Color(0.2f, 0.8f, 0.4f);

        if (isDefeated)
        {
            lblBoss.Text = "ボス: 討伐完了";
            lblBoss.AddThemeColorOverride("font_color", new Color(0.3f, 0.8f, 0.5f));
        }
        else if (rate >= 100.0)
        {
            lblBoss.Text = "ボス: 挑戦可能！";
            lblBoss.AddThemeColorOverride("font_color", new Color(1.0f, 0.7f, 0.2f));
        }
        else
        {
            lblBoss.Text = $"探索進行度: {rate:F1}%";
            lblBoss.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.8f));
        }

        ClearIncomingConnections(btn, "pressed");
        btn.Connect("pressed", Callable.From(() => ShowAreaDetail(areaId, true)));
    }

    // --- 詳細ポップアップ表示・ダブルバッファロジック ---

    private void RefreshDetailPopup()
    {
        switch (_activeDetailType)
        {
            case "item":
                UpdateItemDetailText(_activeDetailId);
                break;
            case "villager":
                var v = _activeDetailObj;
                if (v != null)
                {
                    UpdateVillagerDetailText(v);
                    bool wasDead = _lastDetailStatusMats.GetValueOrDefault("is_dead", (Variant)false).AsBool();
                    if (wasDead != v.IsDead)
                    {
                        _lastDetailStatusMats["is_dead"] = v.IsDead;
                        SetupVillagerDetailActions(v);
                    }
                }
                break;
            case "facility":
                string facId = _activeDetailId;
                UpdateFacilityDetailText(facId);

                bool isUpgrading = GameState.Instance.ActiveUpgrades.ContainsKey(facId);
                int craftingCount = GameState.Instance.ActiveCrafts.Keys
                    .Select(recipeId => Database.Instance.Recipes.GetValueOrDefault(recipeId))
                    .Count(recipe => recipe != null && recipe.Facility == facId);

                bool wasUpgrading = _lastDetailStatusMats.GetValueOrDefault("is_upgrading", (Variant)false).AsBool();
                int wasCraftingCount = _lastDetailStatusMats.GetValueOrDefault("crafting_count", (Variant)0).AsInt32();

                if (wasUpgrading != isUpgrading || wasCraftingCount != craftingCount)
                {
                    _lastDetailStatusMats["is_upgrading"] = isUpgrading;
                    _lastDetailStatusMats["crafting_count"] = craftingCount;
                    SetupFacilityDetailActions(facId);
                }
                break;
            case "area":
                string areaId = _activeDetailId;
                UpdateAreaDetailText(areaId);

                double rate = GameState.Instance.ExploreRates.GetValueOrDefault(areaId, 0.0);
                bool isDefeated = GameState.Instance.DefeatedBosses.Contains(areaId);
                bool canChallenge = !isDefeated && rate >= 100.0;

                bool wasCanChallenge = _lastDetailStatusMats.GetValueOrDefault("can_challenge", (Variant)false).AsBool();
                if (wasCanChallenge != canChallenge)
                {
                    _lastDetailStatusMats["can_challenge"] = canChallenge;
                    SetupAreaDetailActions(areaId);
                }
                break;
        }
    }

    private void ClearActionContainer()
    {
        foreach (Node child in _frontContainer.GetChildren())
        {
            child.QueueFree();
        }
        foreach (Node child in _backContainer.GetChildren())
        {
            child.QueueFree();
        }
    }

    private void SwapDetailActionBuffers()
    {
        _frontContainer.Visible = false;
        _backContainer.Visible = true;

        var temp = _frontContainer;
        _frontContainer = _backContainer;
        _backContainer = temp;
    }

    private void ShowItemDetail(string itemId, bool openDialog)
    {
        _activeDetailType = "item";
        _activeDetailId = itemId;
        _activeDetailObj = null;
        _lastDetailStatusMats.Clear();

        UpdateItemDetailText(itemId);
        ClearActionContainer();

        if (openDialog)
        {
            _detailPopup.Title = "アイテム詳細";
            _detailPopup.PopupCentered();
        }
    }

    private void UpdateItemDetailText(string itemId)
    {
        var item = Database.Instance.Items.GetValueOrDefault(itemId);
        if (item == null) return;

        int count = GameState.Instance.Inventory.GetValueOrDefault(itemId, 0);
        string txt = $"[b][size=18]{item.Name}[/size][/b] (倉庫所持数: {count}個)\n";
        txt += $"[color=#aaaaaa]{item.Description}[/color]\n\n";

        string catStr = item.Category switch
        {
            ItemCategory.Food => "食料・消耗品素材",
            ItemCategory.Wood => "木材系素材",
            ItemCategory.Stone => "石材系素材",
            ItemCategory.Ore => "鉱石・金属素材",
            ItemCategory.ManaStone => "薬草・魔法石素材",
            ItemCategory.MonsterMaterial => "魔物素材",
            ItemCategory.Intermediate => "中間加工品",
            ItemCategory.Consumable => "薬品",
            ItemCategory.Weapon => "武器",
            ItemCategory.Armor => "防具",
            _ => "その他"
        };

        txt += $"■ 分類: {catStr}\n";
        txt += $"■ 取引価値: 売却 {item.ValueSell} G / 購入 {item.ValueBuy} G\n";

        if (item.EffectData.Count > 0)
        {
            txt += "■ 装備効果・性能:\n";
            foreach (var k in item.EffectData.Keys)
            {
                txt += $"  - {k.ToUpper()}: {item.EffectData[k]:+0;-0;0}\n";
            }
        }

        _detailText.Text = txt;
    }

    private void ShowVillagerDetail(Villager v, bool openDialog)
    {
        _activeDetailType = "villager";
        _activeDetailId = "";
        _activeDetailObj = v;

        _lastDetailStatusMats.Clear();
        _lastDetailStatusMats["is_dead"] = v.IsDead;

        UpdateVillagerDetailText(v);
        SetupVillagerDetailActions(v);

        if (openDialog)
        {
            _detailPopup.Title = "キャラクター詳細";
            _detailPopup.PopupCentered();
        }
    }

    private void UpdateVillagerDetailText(Villager v)
    {
        var jobName = Database.Instance.Jobs.GetValueOrDefault(v.CurrentJob)?.Name ?? v.CurrentJob;
        string txt = $"[b][size=18]{v.Name}[/size][/b] [Lv.{v.Level} {jobName}]\n";

        if (v.IsDead)
        {
            txt += "[color=#ff4444]状態: 死亡[/color]\n\n";
            _detailText.Text = txt;
            return;
        }

        txt += $"■ HP: {v.CurrentHp} / {v.GetMaxHp()}\n";
        txt += $"■ スタミナ: {v.CurrentStamina} / {v.GetMaxStamina()}\n";
        txt += $"■ EXP: {v.Exp} / {v.GetRequiredExp()}\n\n";

        txt += "■ 能力値:\n";
        txt += $"  - 物理攻撃 (STR): {v.GetStr()}\n";
        txt += $"  - 魔法効果 (INT): {v.GetInt()}\n";
        txt += $"  - 技術器用 (DEX): {v.GetDex()}\n";
        txt += $"  - 俊敏素早 (AGI): {v.GetAgi()}\n";
        txt += $"  - 防御体力 (VIT): {v.GetVit()}\n\n";

        string wName = !string.IsNullOrEmpty(v.WeaponId) ? Database.Instance.Items.GetValueOrDefault(v.WeaponId)?.Name ?? v.WeaponId : "なし";
        string aName = !string.IsNullOrEmpty(v.ArmorId) ? Database.Instance.Items.GetValueOrDefault(v.ArmorId)?.Name ?? v.ArmorId : "なし";
        txt += "■ 装備:\n";
        txt += $"  - 武器: {wName}\n";
        txt += $"  - 防具: {aName}\n";

        _detailText.Text = txt;
    }

    private void SetupVillagerDetailActions(Villager v)
    {
        // 1. バックバッファのクリア
        foreach (Node child in _backContainer.GetChildren())
        {
            child.QueueFree();
        }

        if (v.IsDead)
        {
            SwapDetailActionBuffers();
            return;
        }

        // (1) 行動指針
        var orderHBox = new HBoxContainer();
        var orderLbl = new Label();
        orderLbl.Text = "行動方針: ";
        orderLbl.CustomMinimumSize = new Vector2(80, 0);
        orderHBox.AddChild(orderLbl);

        var orderOpt = new OptionButton();
        orderOpt.AddItem("採取", 0);
        orderOpt.AddItem("討伐", 1);
        orderOpt.AddItem("宿屋休養", 2);

        int curIdx = v.Order switch
        {
            "hunt" => 1,
            "inn" => 2,
            _ => 0
        };
        orderOpt.Selected = curIdx;

        orderOpt.ItemSelected += (long idx) =>
        {
            var prevOrder = v.Order;
            if (idx == 0)
            {
                v.Order = "gather";
                if (prevOrder == "inn")
                {
                    var area = Database.Instance.Areas.GetValueOrDefault(v.AssignedArea);
                    if (area != null)
                    {
                        v.TravelTime = (int)(area.Difficulty * 2);
                        v.IsReturning = false;
                    }
                }
            }
            else if (idx == 1)
            {
                v.Order = "hunt";
                if (prevOrder == "inn")
                {
                    var area = Database.Instance.Areas.GetValueOrDefault(v.AssignedArea);
                    if (area != null)
                    {
                        v.TravelTime = (int)(area.Difficulty * 2);
                        v.IsReturning = false;
                    }
                }
            }
            else if (idx == 2)
            {
                v.Order = "inn";
                v.TravelTime = 0;
                v.IsReturning = false;
            }

            GameState.Instance.AddLog($"{v.Name} の方針を「{orderOpt.GetItemText((int)idx)}」に変更しました。");
            UpdateVillagerDetailText(v);
            UpdateUI();
        };

        orderHBox.AddChild(orderOpt);
        _backContainer.AddChild(orderHBox);

        // (2) 派遣先
        var areaHBox = new HBoxContainer();
        var areaLbl = new Label();
        areaLbl.Text = "派遣エリア: ";
        areaLbl.CustomMinimumSize = new Vector2(80, 0);
        areaHBox.AddChild(areaLbl);

        var areaOpt = new OptionButton();
        int areaIdx = 0;
        foreach (var areaId in Database.Instance.Areas.Keys)
        {
            bool isUnlocked = true;
            if (areaId == "mine" && !GameState.Instance.DefeatedBosses.Contains("forest")) isUnlocked = false;
            else if (areaId == "valley" && !GameState.Instance.DefeatedBosses.Contains("mine")) isUnlocked = false;
            else if (areaId == "roots" && !GameState.Instance.DefeatedBosses.Contains("valley")) isUnlocked = false;
            else if (areaId == "abyss" && !GameState.Instance.DefeatedBosses.Contains("roots")) isUnlocked = false;

            if (isUnlocked)
            {
                var area = Database.Instance.Areas[areaId];
                areaOpt.AddItem(area.Name, areaIdx);
                areaOpt.SetItemMetadata(areaIdx, areaId);
                if (v.AssignedArea == areaId)
                {
                    areaOpt.Selected = areaIdx;
                }
                areaIdx++;
            }
        }

        areaOpt.ItemSelected += (long selIdx) =>
        {
            string areaId = (string)areaOpt.GetItemMetadata((int)selIdx);
            GameState.Instance.ChangeVillagerArea(v, areaId);
            UpdateVillagerDetailText(v);
            UpdateUI();
        };

        areaHBox.AddChild(areaOpt);
        _backContainer.AddChild(areaHBox);

        // (3) 転職
        var jobHBox = new HBoxContainer();
        var jobLbl = new Label();
        jobLbl.Text = "職業変更: ";
        jobLbl.CustomMinimumSize = new Vector2(80, 0);
        jobHBox.AddChild(jobLbl);

        var jobOpt = new OptionButton();
        int jobIdx = 0;
        foreach (var jobId in Database.Instance.Jobs.Keys)
        {
            var job = Database.Instance.Jobs[jobId];
            int cost = job.Cost;
            if (v.JobHistory.Contains(jobId))
            {
                cost = 0;
            }
            else
            {
                double discount = 1.0 - GameState.Instance.PermaBuffs["discount"] * 0.1;
                cost = (int)(cost * discount);
            }

            string btnText = cost > 0 ? $"{job.Name} ({cost}G)" : $"{job.Name} (無料)";
            jobOpt.AddItem(btnText, jobIdx);
            jobOpt.SetItemMetadata(jobIdx, jobId);
            if (v.CurrentJob == jobId)
            {
                jobOpt.Selected = jobIdx;
            }
            jobIdx++;
        }
        jobHBox.AddChild(jobOpt);

        var changeJobBtn = new Button();
        changeJobBtn.Text = "転職する";
        changeJobBtn.Pressed += () =>
        {
            string selJobId = (string)jobOpt.GetItemMetadata(jobOpt.Selected);
            if (selJobId != v.CurrentJob)
            {
                if (GameState.Instance.ChangeJob(v, selJobId))
                {
                    UpdateVillagerDetailText(v);
                    UpdateUI();
                }
            }
        };
        jobHBox.AddChild(changeJobBtn);
        _backContainer.AddChild(jobHBox);

        SwapDetailActionBuffers();
    }

    private void ShowFacilityDetail(string facId, bool openDialog)
    {
        _activeDetailType = "facility";
        _activeDetailId = facId;
        _activeDetailObj = null;

        _lastDetailStatusMats.Clear();
        bool isUpgrading = GameState.Instance.ActiveUpgrades.ContainsKey(facId);
        int craftingCount = GameState.Instance.ActiveCrafts.Keys
            .Select(recipeId => Database.Instance.Recipes.GetValueOrDefault(recipeId))
            .Count(recipe => recipe != null && recipe.Facility == facId);

        _lastDetailStatusMats["is_upgrading"] = isUpgrading;
        _lastDetailStatusMats["crafting_count"] = craftingCount;

        UpdateFacilityDetailText(facId);
        SetupFacilityDetailActions(facId);

        if (openDialog)
        {
            _detailPopup.Title = "施設詳細・クラフト";
            _detailPopup.PopupCentered();
        }
    }

    private void UpdateFacilityDetailText(string facId)
    {
        int lv = GameState.Instance.FacilityLevels.GetValueOrDefault(facId, 0);
        string facName = GameState.Instance.GetFacilityName(facId);

        string txt = $"[b][size=18]{facName}[/size][/b] (施設ランク: Lv.{lv})\n";
        string desc = facId switch
        {
            "inn" => "村人の最大雇用人数を増やし、宿屋休養(inn)時の毎時間HP・スタミナの回復量を向上させます。",
            "workshop" => "採取してきた木材や石材を消費し、より高度なクラフト材料（木板や石レンガ等）を加工・生産します。",
            "forge" => "金属インゴットと燃料を消費して、村人が装備できる強力な武器・防具を鍛造・クラフトします。",
            "alchemy_lab" => "採取した薬草や魔力石を調合し、HPを即時回復するポーションなどの薬品を生産します。",
            "trading_post" => "倉庫内の素材をあらかじめ設定した価格・数量ルールに従って毎日自動で売買（自動取引）します。",
            _ => ""
        };

        txt += $"[color=#aaaaaa]{desc}[/color]\n\n";

        if (GameState.Instance.ActiveUpgrades.ContainsKey(facId))
        {
            txt += $"[color=#00ff55]※ 現在施設をアップグレード中です。(残り{GameState.Instance.ActiveUpgrades[facId]}時間)[/color]\n";
        }

        _detailText.Text = txt;
    }

    private void SetupFacilityDetailActions(string facId)
    {
        // 1. バックバッファクリア
        foreach (Node child in _backContainer.GetChildren())
        {
            child.QueueFree();
        }

        int lv = GameState.Instance.FacilityLevels[facId];

        // アップグレードボタン
        if (lv < 4 && !GameState.Instance.ActiveUpgrades.ContainsKey(facId))
        {
            var upgradeHBox = new HBoxContainer();
            var cost = GameState.Instance.GetFacilityUpgradeCost(facId);
            int costGold = cost.Gold;

            string matsText = "";
            bool canUpgrade = GameState.Instance.Gold >= costGold;
            foreach (var m in cost.Items)
            {
                int owned = GameState.Instance.Inventory.GetValueOrDefault(m.Id, 0);
                var item = Database.Instance.Items.GetValueOrDefault(m.Id);
                string matName = item != null ? item.Name : m.Id;
                if (matsText != "") matsText += ", ";
                matsText += $"{matName}({owned}/{m.Amount})";
                if (owned < m.Amount)
                {
                    canUpgrade = false;
                }
            }

            var upBtn = new Button();
            upBtn.Text = lv == 0 ? "建設する" : $"アップグレード (所要:{(lv + 1) * 4}時間)";
            upBtn.Disabled = !canUpgrade;
            upBtn.Pressed += () =>
            {
                if (GameState.Instance.UpgradeFacility(facId))
                {
                    ShowFacilityDetail(facId, false);
                    UpdateUI();
                }
            };
            upgradeHBox.AddChild(upBtn);

            var lblCost = new Label();
            lblCost.Text = $"コスト: {costGold}G / 必要素材: {(matsText != "" ? matsText : "なし")}";
            lblCost.AddThemeFontSizeOverride("font_size", 11);
            lblCost.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.8f));
            upgradeHBox.AddChild(lblCost);

            _backContainer.AddChild(upgradeHBox);
        }

        // クラフトレシピ
        if (lv > 0)
        {
            var recipesToShow = new List<string>();
            foreach (var rId in Database.Instance.Recipes.Keys)
            {
                var r = Database.Instance.Recipes[rId];
                if (r.Facility == facId && lv >= r.RequiredLevel)
                {
                    recipesToShow.Add(rId);
                }
            }

            if (recipesToShow.Count > 0)
            {
                var lblTitle = new Label();
                lblTitle.Text = "【加工・クラフトレシピ一覧】";
                lblTitle.AddThemeFontSizeOverride("font_size", 12);
                _backContainer.AddChild(lblTitle);

                foreach (var rId in recipesToShow)
                {
                    var r = Database.Instance.Recipes[rId];
                    var rHBox = new HBoxContainer();

                    string matsText = "";
                    bool canCraft = true;
                    foreach (var m in r.Materials)
                    {
                        int owned = GameState.Instance.Inventory.GetValueOrDefault(m.Id, 0);
                        var item = Database.Instance.Items.GetValueOrDefault(m.Id);
                        string matName = item != null ? item.Name : m.Id;
                        if (matsText != "") matsText += ", ";
                        matsText += $"{matName}({owned}/{m.Amount})";
                        if (owned < m.Amount)
                        {
                            canCraft = false;
                        }
                    }

                    var rLbl = new Label();
                    var resultItem = Database.Instance.Items.GetValueOrDefault(r.Result.Id);
                    string resultName = resultItem != null ? resultItem.Name : r.Result.Id;
                    rLbl.Text = $" - {resultName} [材料: {matsText}]";
                    rLbl.AddThemeFontSizeOverride("font_size", 11);
                    rLbl.SizeFlagsHorizontal = SizeFlags.ExpandFill;
                    rHBox.AddChild(rLbl);

                    var craftBtn = new Button();
                    if (GameState.Instance.ActiveCrafts.ContainsKey(rId))
                    {
                        craftBtn.Text = $"加工中 (残り:{GameState.Instance.ActiveCrafts[rId]:F1})";
                        craftBtn.Disabled = true;
                    }
                    else
                    {
                        craftBtn.Text = "生産開始";
                        craftBtn.Disabled = !canCraft;
                        craftBtn.Pressed += () =>
                        {
                            if (GameState.Instance.StartCraft(rId))
                            {
                                ShowFacilityDetail(facId, false);
                                UpdateUI();
                            }
                        };
                    }
                    rHBox.AddChild(craftBtn);
                    _backContainer.AddChild(rHBox);
                }
            }
        }

        SwapDetailActionBuffers();
    }

    private void ShowAreaDetail(string areaId, bool openDialog)
    {
        _activeDetailType = "area";
        _activeDetailId = areaId;
        _activeDetailObj = null;

        _lastDetailStatusMats.Clear();
        double rate = GameState.Instance.ExploreRates.GetValueOrDefault(areaId, 0.0);
        bool isDefeated = GameState.Instance.DefeatedBosses.Contains(areaId);
        _lastDetailStatusMats["can_challenge"] = (!isDefeated && rate >= 100.0);

        UpdateAreaDetailText(areaId);
        SetupAreaDetailActions(areaId);

        if (openDialog)
        {
            _detailPopup.Title = "ダンジョン・フィールド詳細";
            _detailPopup.PopupCentered();
        }
    }

    private void UpdateAreaDetailText(string areaId)
    {
        var area = Database.Instance.Areas.GetValueOrDefault(areaId);
        if (area == null) return;

        double rate = GameState.Instance.ExploreRates.GetValueOrDefault(areaId, 0.0);
        string txt = $"[b][size=18]{area.Name}[/size][/b] (難易度: ★{(int)area.Difficulty})\n";
        txt += $"■ 探索完了度: {rate:F1}%\n";

        bool isDefeated = GameState.Instance.DefeatedBosses.Contains(areaId);
        if (isDefeated)
        {
            txt += $"■ ボス「{area.Boss.Name}」: [color=#00ff66]討伐完了 (解放条件クリア)[/color]\n\n";
        }
        else
        {
            txt += $"■ 目標ボス: 「{area.Boss.Name}」 (未撃破)\n\n";
        }

        txt += "■ 出現する可能性のある魔物:\n";
        foreach (var m in area.Monsters)
        {
            var dropName = Database.Instance.Items.GetValueOrDefault(m.Drop)?.Name ?? m.Drop;
            txt += $"  - {m.Name} (Lv.{m.Level}) - ドロップ: {dropName}\n";
        }
        txt += "\n";

        txt += "■ 採取可能な一次素材:\n";
        foreach (var g in area.Gathers)
        {
            var matName = Database.Instance.Items.GetValueOrDefault(g.Id)?.Name ?? g.Id;
            txt += $"  - {matName} (採取確率: {(int)(g.Rate * 100)}%)\n";
        }

        _detailText.Text = txt;
    }

    private void SetupAreaDetailActions(string areaId)
    {
        // 1. バックバッファクリア
        foreach (Node child in _backContainer.GetChildren())
        {
            child.QueueFree();
        }

        var area = Database.Instance.Areas.GetValueOrDefault(areaId);
        if (area == null)
        {
            SwapDetailActionBuffers();
            return;
        }

        double rate = GameState.Instance.ExploreRates.GetValueOrDefault(areaId, 0.0);
        bool isDefeated = GameState.Instance.DefeatedBosses.Contains(areaId);

        // ボス挑戦ボタン
        if (!isDefeated && rate >= 100.0)
        {
            var challengeBtn = new Button();
            challengeBtn.Text = $"ボス「{area.Boss.Name}」に挑戦する！ (全員で戦闘を行います)";
            challengeBtn.CustomMinimumSize = new Vector2(0, 40);
            challengeBtn.Pressed += () =>
            {
                _detailPopup.Hide();
                if (GameState.Instance.ChallengeBoss(areaId))
                {
                    UpdateUI();
                }
            };
            _backContainer.AddChild(challengeBtn);
        }

        SwapDetailActionBuffers();
    }

    // --- 過去ログ履歴表示 ---
    private void OnHistoryPressed()
    {
        _historyLogText.Text = "";
        string histText = "";
        foreach (var line in _logsArchive)
        {
            histText += line + "\n";
        }
        _historyLogText.Text = histText;
        _historyPopup.PopupCentered();
    }

    // --- ゲームオーバー/転生処理 ---
    private void OnRestartLoopPressed()
    {
        GameState.Instance.StartNewGame(false);
        _rebirthPanel.Hide();
        UpdateUI();
    }

    private void OnTargetButtonPressed()
    {
        _showDetailedTarget = !_showDetailedTarget;
        UpdateUI();
    }
}
