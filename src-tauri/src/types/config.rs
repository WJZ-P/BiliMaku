use super::account::AccountProfile;
use super::overlay::SidebarOverlayPlacement;
use super::tts::TtsEnvironmentCache;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 当前统一配置文件结构版本。
pub const CONFIG_SCHEMA_VERSION: u32 = 1;

/// bilimaku 统一配置文件。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    /// 配置结构版本，用于后续自动迁移。
    pub schema_version: u32,
    /// 哔哩哔哩账号与 Cookie 配置。
    pub account: AccountStorageConfig,
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
            live: LiveStorageConfig::default(),
            tts: TtsStorageConfig::default(),
            overlay: OverlayStorageConfig::default(),
            updated_at: 0,
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

/// 直播间连接相关配置。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LiveStorageConfig {
    /// 用户最近一次输入并通过格式校验的房间号。
    pub room_id: String,
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

/// 透明悬浮窗持久化配置。
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OverlayStorageConfig {
    /// 前端定义的完整悬浮窗设置；首次启动时为空并使用前端默认值。
    pub settings: Option<Value>,
    /// 侧边事件栏相对目标显示器工作区的位置。
    pub sidebar_placement: Option<SidebarOverlayPlacement>,
}
