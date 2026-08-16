use super::account::AccountProfile;
use super::overlay::SidebarOverlayPlacement;
use super::tts::TtsEnvironmentCache;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 当前统一配置文件结构版本。
pub const CONFIG_SCHEMA_VERSION: u32 = 4;

/// bilimaku 统一配置文件。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    /// 配置结构版本，用于后续自动迁移。
    pub schema_version: u32,
    /// 哔哩哔哩账号与 Cookie 配置。
    pub account: AccountStorageConfig,
    /// 软件界面外观配置。
    pub appearance: AppearanceStorageConfig,
    /// 直播间连接配置。
    pub live: LiveStorageConfig,
    /// TTS 模型、共享资源与播报偏好。
    pub tts: TtsStorageConfig,
    /// 透明悬浮窗配置。
    pub overlay: OverlayStorageConfig,
    /// 最近一次实际落盘变更的 Unix 秒级时间戳。
    pub updated_at: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            schema_version: CONFIG_SCHEMA_VERSION,
            account: AccountStorageConfig::default(),
            appearance: AppearanceStorageConfig::default(),
            live: LiveStorageConfig::default(),
            tts: TtsStorageConfig::default(),
            overlay: OverlayStorageConfig::default(),
            updated_at: 0,
        }
    }
}

/// 软件界面外观配置。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceStorageConfig {
    /// 当前主题模式，可选 light 或 dark。
    pub theme: String,
}

impl Default for AppearanceStorageConfig {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
        }
    }
}

/// 持久化账号登录态。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AccountStorageConfig {
    /// 可重新构建 Cookie Jar 的完整 Cookie 请求头。
    pub cookie_header: String,
    /// 最近一次成功读取到的账号资料。
    pub profile: Option<AccountProfile>,
    /// 登录态写入配置时的 Unix 秒级时间戳。
    pub saved_at: u64,
}

/// 直播间聊天区外观设置。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LiveAppearanceSettings {
    /// 消息气泡的 #RRGGBB 基础主题色。
    pub message_bubble_color: String,
}

impl Default for LiveAppearanceSettings {
    fn default() -> Self {
        Self {
            message_bubble_color: "#66CCFF".to_string(),
        }
    }
}

/// 默认在内存中保留的最新直播事件数量。
pub const DEFAULT_MAX_STORED_LIVE_MESSAGES: u32 = 821;
/// 允许用户配置的直播事件缓存上限，避免误输入导致无界内存增长。
pub const MAX_STORED_LIVE_MESSAGES: u32 = 50_000;

/// 直播间消息展示与内存缓存偏好。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LiveMessageSettings {
    /// 聊天工作台最后一次选中的消息分类。
    pub display_filter: String,
    /// 当前会话最多保留的最新消息条数。
    pub max_stored_messages: u32,
}

impl Default for LiveMessageSettings {
    fn default() -> Self {
        Self {
            display_filter: "all".to_string(),
            max_stored_messages: DEFAULT_MAX_STORED_LIVE_MESSAGES,
        }
    }
}

/// 自首次使用 bilimaku 以来累计收到的直播事件统计。
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LiveActivityTotals {
    /// 累计收到的用户进场事件数。
    pub entrances: u64,
    /// 累计收到的普通弹幕数。
    pub messages: u64,
    /// 累计收到的礼物数量；同一事件中的礼物数量会累加。
    pub gifts: u64,
}

/// 直播间连接与界面配置。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LiveStorageConfig {
    /// 用户最近一次输入并通过格式校验的房间号。
    pub room_id: String,
    /// 上次运行结束时是否保持直播间连接；为真时冷启动自动恢复长链。
    pub auto_connect: bool,
    /// 聊天区的可持久化外观。
    pub appearance: LiveAppearanceSettings,
    /// 消息分类与当前会话缓存上限。
    pub messages: LiveMessageSettings,
    /// 自首次使用软件以来累计收到的事件数量。
    pub activity_totals: LiveActivityTotals,
}

fn default_tts_event_types() -> Vec<String> {
    vec!["message".to_string()]
}

/// TTS 播报偏好，字段与 React 前端设置保持一致。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TtsUserSettings {
    /// 当前语音来源，可选 system 或 custom。
    pub provider: String,
    /// 当前自定义模型编号。
    pub model_id: String,
    /// 当前自定义音色编号。
    pub voice_id: String,
    /// 当前系统语音 URI。
    pub system_voice_uri: String,
    /// 语速倍率。
    pub rate: f64,
    /// 音高倍率。
    pub pitch: f64,
    /// 音量倍率。
    pub volume: f64,
    /// 收到符合规则的事件后是否自动播报。
    pub auto_speak: bool,
    /// 允许进入语音队列的事件筛选键；互动动作使用 interaction-* 独立键。
    #[serde(default = "default_tts_event_types")]
    pub enabled_event_types: Vec<String>,
}

impl Default for TtsUserSettings {
    fn default() -> Self {
        Self {
            provider: "system".to_string(),
            model_id: String::new(),
            voice_id: String::new(),
            system_voice_uri: String::new(),
            rate: 1.05,
            pitch: 1.0,
            volume: 1.0,
            auto_speak: true,
            enabled_event_types: default_tts_event_types(),
        }
    }
}

/// TTS 模型与运行资源配置。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TtsStorageConfig {
    /// 用户当前的播报偏好。
    pub settings: TtsUserSettings,
    /// 已导入模型注册表；元素由 TTS 适配器进一步校验。
    pub models: Vec<Value>,
    /// 全机共享的 Chinese BERT 模型目录。
    pub chinese_bert_dir: String,
    /// 按模型保存的运行环境检测结果；命中指纹时只读内存，不再启动 Python 探针。
    pub environment_cache: Vec<TtsEnvironmentCache>,
}

/// 需要在软件启动后自动恢复的悬浮窗。
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OverlayAutoOpenConfig {
    /// 启动后恢复全屏滚动弹幕层。
    pub danmaku: bool,
    /// 启动后恢复侧边事件栏。
    pub sidebar: bool,
}

/// 透明悬浮窗持久化配置。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OverlayStorageConfig {
    /// 前端定义的完整悬浮窗设置；首次启动时为空并使用前端默认值。
    pub settings: Option<Value>,
    /// 上次运行时用户主动保持开启的悬浮窗。
    pub auto_open: OverlayAutoOpenConfig,
    /// 侧边事件栏相对目标显示器工作区的位置。
    pub sidebar_placement: Option<SidebarOverlayPlacement>,
}
