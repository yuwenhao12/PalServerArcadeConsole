export const supportedLocales = ["zh-CN", "en", "ja"] as const;
export type Locale = typeof supportedLocales[number];

const translations: Record<Exclude<Locale, "zh-CN">, Record<string, string>> = {
  en: {
    "总览": "Overview", "规则面板": "Rules", "世界图鉴": "World Atlas", "刷新": "Refresh", "手动存档": "Save World", "退出": "Sign out",
    "服务器摘要": "Server Summary", "状态": "Status", "已连接": "Connected", "未就绪": "Unavailable", "服务器": "Server", "版本": "Version", "世界天数": "World Days", "据点数量": "Bases",
    "全服广播": "Server Broadcast", "公告内容": "Message", "服务器将在 10 分钟后维护。": "Server maintenance begins in 10 minutes.", "发送公告": "Send Broadcast",
    "重置": "Reset", "保存": "Save", "应用": "Apply", "等待应用": "Ready to apply", "正在保存规则": "Saving rules", "正在重启服务器": "Restarting server", "正在等待服务器": "Waiting for server", "应用完成": "Applied", "应用未完成": "Apply failed",
    "人数与世界": "Players & World", "世界倍率": "World Rates", "玩家与公会": "Players & Guilds", "帕鲁与物件": "Pals & Objects", "语音与标识": "Voice & Identity", "规则开关": "Rule Switches",
    "最大人数": "Max Players", "合作人数": "Co-op Players", "公会人数上限": "Guild Player Limit", "总据点上限": "Base Limit", "据点工作帕鲁": "Base Workers", "公会据点上限": "Guild Base Limit", "建筑数量上限": "Building Limit", "掉落物上限": "Dropped Item Limit", "掉落保留时间": "Dropped Item Lifetime", "小时": "hours",
    "难度": "Difficulty", "自定义": "Custom", "休闲": "Casual", "普通": "Normal", "困难": "Hard", "白天速度": "Day Speed", "夜晚速度": "Night Speed", "经验倍率": "Experience Rate", "捕获倍率": "Capture Rate", "帕鲁刷新倍率": "Pal Spawn Rate", "敌人掉落倍率": "Enemy Drop Rate", "采集掉落倍率": "Gathering Drop Rate", "资源刷新速度": "Resource Respawn Speed", "工作速度": "Work Speed", "孵蛋时间": "Egg Hatching Time", "倍": "x",
    "玩家攻击倍率": "Player Damage", "玩家受伤倍率": "Player Damage Taken", "玩家饥饿消耗": "Player Hunger", "玩家耐力消耗": "Player Stamina", "玩家回血倍率": "Player HP Regen", "睡眠回血倍率": "Sleep HP Regen", "物品重量倍率": "Item Weight", "死亡惩罚": "Death Penalty", "无惩罚": "None", "掉落物品": "Drop Items", "掉落物品和装备": "Drop Items & Equipment", "全部掉落": "Drop Everything",
    "帕鲁攻击倍率": "Pal Damage", "帕鲁受伤倍率": "Pal Damage Taken", "帕鲁饥饿消耗": "Pal Hunger", "帕鲁耐力消耗": "Pal Stamina", "帕鲁回血倍率": "Pal HP Regen", "帕鲁睡眠回血": "Pal Sleep HP Regen", "建筑血量倍率": "Building HP", "建筑受伤倍率": "Building Damage Taken", "建筑劣化倍率": "Building Deterioration", "牧场产出速度": "Ranch Production",
    "游戏内语音": "In-game Voice", "语音全音量距离": "Full Volume Distance", "语音静音距离": "Silent Distance", "显示建筑创建者": "Show Building Creator", "开启": "On", "关闭": "Off", "正在使用": "Enabled", "未启用": "Disabled",
    "PVP": "PVP", "硬核模式": "Hardcore", "死亡丢失帕鲁": "Lose Pals on Death", "玩家互伤": "Player Damage", "友军伤害": "Friendly Fire", "快速传送": "Fast Travel", "仅据点传送": "Base-only Fast Travel", "地图选出生点": "Choose Start on Map", "离线保留角色": "Keep Character Offline", "入侵事件": "Raid Events", "启用备份存档": "Use Backup Saves", "捕食 Boss": "Predator Bosses", "全局终端导出": "Global Palbox Export", "全局终端导入": "Global Palbox Import",
    "刷新世界": "Refresh World", "还没有世界记录": "No world record yet", "刷新后即可查看世界状态。": "Refresh to inspect the world.", "玩家": "Players", "在线": "Online", "帕鲁": "Pals", "背包物品": "Inventory Items", "最近更新": "Last Updated", "玩家列表": "Players", "暂无玩家记录。": "No players found.", "等级": "Level", "选择一位玩家": "Select a player", "离线": "Offline", "暂无组织": "No guild", "背包": "Inventory", "暂未找到已归属的帕鲁。": "No owned Pals found.", "未找到该玩家的个人存档。": "Player save was not found.", "背包中暂时没有可统计的物品。": "No inventory items to show.",
    "登录提示": "Sign-in", "账号": "Username", "密码": "Password", "登录控制台": "Sign in", "使用部署配置文件中的 WebUI 账号和密码登录。": "Sign in with the WebUI credentials from the deployment configuration.", "立即保存当前世界进度。": "Save the current world progress now.", "取消": "Cancel", "确认存档": "Confirm Save", "连接失败": "Connection Failed", "有个小提示": "Notice", "操作成功": "Success", "服务器 FPS": "Server FPS", "运行帧率": "Frame Rate", "在线玩家": "Online Players", "当前大厅人数": "Current Players", "帧时间": "Frame Time", "模拟开销": "Simulation Cost", "运行时长": "Uptime", "本轮开服时间": "Current Session",
  },
  ja: {
    "总览": "概要", "规则面板": "ルール", "世界图鉴": "ワールド図鑑", "刷新": "更新", "手动存档": "手動セーブ", "退出": "ログアウト",
    "服务器摘要": "サーバー概要", "状态": "状態", "已连接": "接続済み", "未就绪": "未準備", "服务器": "サーバー", "版本": "バージョン", "世界天数": "経過日数", "据点数量": "拠点数",
    "全服广播": "全体アナウンス", "公告内容": "メッセージ", "服务器将在 10 分钟后维护。": "サーバーメンテナンスは10分後に開始します。", "发送公告": "アナウンスを送信",
    "重置": "リセット", "保存": "保存", "应用": "適用", "等待应用": "適用待機", "正在保存规则": "ルールを保存中", "正在重启服务器": "サーバーを再起動中", "正在等待服务器": "サーバーを待機中", "应用完成": "適用完了", "应用未完成": "適用失敗",
    "人数与世界": "プレイヤーと世界", "世界倍率": "ワールド倍率", "玩家与公会": "プレイヤーとギルド", "帕鲁与物件": "パルと建築物", "语音与标识": "ボイスと表示", "规则开关": "ルール設定",
    "最大人数": "最大プレイヤー数", "合作人数": "協力プレイヤー数", "公会人数上限": "ギルド人数上限", "总据点上限": "拠点上限", "据点工作帕鲁": "拠点作業パル", "公会据点上限": "ギルド拠点上限", "建筑数量上限": "建築数上限", "掉落物上限": "ドロップ上限", "掉落保留时间": "ドロップ保持時間", "小时": "時間",
    "难度": "難易度", "自定义": "カスタム", "休闲": "カジュアル", "普通": "ノーマル", "困难": "ハード", "白天速度": "昼の速度", "夜晚速度": "夜の速度", "经验倍率": "経験値倍率", "捕获倍率": "捕獲倍率", "帕鲁刷新倍率": "パル出現倍率", "敌人掉落倍率": "敵ドロップ倍率", "采集掉落倍率": "採集ドロップ倍率", "资源刷新速度": "資源リスポーン速度", "工作速度": "作業速度", "孵蛋时间": "孵化時間", "倍": "倍",
    "玩家攻击倍率": "プレイヤー攻撃倍率", "玩家受伤倍率": "プレイヤー被ダメージ", "玩家饥饿消耗": "プレイヤー空腹消費", "玩家耐力消耗": "プレイヤースタミナ消費", "玩家回血倍率": "プレイヤーHP回復", "睡眠回血倍率": "睡眠時HP回復", "物品重量倍率": "アイテム重量", "死亡惩罚": "死亡ペナルティ", "无惩罚": "なし", "掉落物品": "アイテムを落とす", "掉落物品和装备": "アイテムと装備を落とす", "全部掉落": "すべて落とす",
    "帕鲁攻击倍率": "パル攻撃倍率", "帕鲁受伤倍率": "パル被ダメージ", "帕鲁饥饿消耗": "パル空腹消費", "帕鲁耐力消耗": "パルスタミナ消費", "帕鲁回血倍率": "パルHP回復", "帕鲁睡眠回血": "パル睡眠時HP回復", "建筑血量倍率": "建築HP", "建筑受伤倍率": "建築被ダメージ", "建筑劣化倍率": "建築劣化", "牧场产出速度": "牧場生産速度",
    "游戏内语音": "ゲーム内ボイス", "语音全音量距离": "最大音量距離", "语音静音距离": "無音距離", "显示建筑创建者": "建築者を表示", "开启": "オン", "关闭": "オフ", "正在使用": "有効", "未启用": "無効",
    "PVP": "PVP", "硬核模式": "ハードコア", "死亡丢失帕鲁": "死亡時パルを失う", "玩家互伤": "プレイヤー同士のダメージ", "友军伤害": "フレンドリーファイア", "快速传送": "ファストトラベル", "仅据点传送": "拠点のみ転送", "地图选出生点": "マップで開始地点選択", "离线保留角色": "ログアウト後も残る", "入侵事件": "襲撃イベント", "启用备份存档": "バックアップを使用", "捕食 Boss": "プレデターボス", "全局终端导出": "グローバルパルボックス書き出し", "全局终端导入": "グローバルパルボックス読み込み",
    "刷新世界": "ワールドを更新", "还没有世界记录": "ワールド記録がありません", "刷新后即可查看世界状态。": "更新するとワールド状態を確認できます。", "玩家": "プレイヤー", "在线": "オンライン", "帕鲁": "パル", "背包物品": "インベントリ", "最近更新": "最終更新", "玩家列表": "プレイヤー一覧", "暂无玩家记录。": "プレイヤー記録がありません。", "等级": "レベル", "选择一位玩家": "プレイヤーを選択", "离线": "オフライン", "暂无组织": "ギルドなし", "背包": "バッグ", "暂未找到已归属的帕鲁。": "所属パルが見つかりません。", "未找到该玩家的个人存档。": "プレイヤーのセーブデータが見つかりません。", "背包中暂时没有可统计的物品。": "表示できるアイテムがありません。",
    "登录提示": "ログイン", "账号": "ユーザー名", "密码": "パスワード", "登录控制台": "ログイン", "使用部署配置文件中的 WebUI 账号和密码登录。": "デプロイ設定の WebUI 認証情報でログインします。", "立即保存当前世界进度。": "現在のワールド進行を保存します。", "取消": "キャンセル", "确认存档": "保存する", "连接失败": "接続失敗", "有个小提示": "お知らせ", "操作成功": "完了", "服务器 FPS": "サーバーFPS", "运行帧率": "フレームレート", "在线玩家": "オンライン人数", "当前大厅人数": "現在の人数", "帧时间": "フレーム時間", "模拟开销": "シミュレーション負荷", "运行时长": "稼働時間", "本轮开服时间": "今回の稼働時間",
  },
};

export function translate(locale: Locale, source: string) {
  return locale === "zh-CN" ? source : translations[locale][source] || source;
}
