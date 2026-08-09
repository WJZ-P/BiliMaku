use crate::types::account::AccountProfile;
use crate::types::config::{
    AccountStorageConfig, AppConfig, LiveAppearanceSettings, LiveMessageSettings,
    OverlayAutoOpenConfig, TtsUserSettings, CONFIG_SCHEMA_VERSION,
    DEFAULT_MAX_STORED_LIVE_MESSAGES, MAX_STORED_LIVE_MESSAGES,
};
use crate::types::overlay::SidebarOverlayPlacement;
use crate::types::tts::TtsEnvironmentCache;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

/// bilimaku 当前统一配置文件名。
pub const CONFIG_FILE_NAME: &str = "config.json";

/// 进程内统一配置 Store。
///
/// 启动时只从磁盘读取一次。之后所有读取都来自内存，写入先比较新旧值，
/// 只有发生实际变更时才通过临时文件与备份文件原子落盘。
pub struct AppConfigStore {
    config: RwLock<AppConfig>,
    path: OnceLock<PathBuf>,
}

impl Default for AppConfigStore {
    fn default() -> Self {
        Self {
            config: RwLock::new(AppConfig::default()),
            path: OnceLock::new(),
        }
    }
}

const TTS_SPEAKABLE_EVENT_TYPES: [&str; 10] = [
    "message",
    "interaction-enter",
    "interaction-follow",
    "interaction-share",
    "interaction-special-follow",
    "interaction-mutual-follow",
    "interaction-like",
    "gift",
    "superchat",
    "guard",
];

fn normalize_tts_settings(mut settings: TtsUserSettings) -> TtsUserSettings {
    let mut enabled_event_types = Vec::new();
    for event_type in settings.enabled_event_types {
        if TTS_SPEAKABLE_EVENT_TYPES.contains(&event_type.as_str())
            && !enabled_event_types.contains(&event_type)
        {
            enabled_event_types.push(event_type);
        }
    }
    settings.enabled_event_types = enabled_event_types;
    settings
}

const LIVE_MESSAGE_DISPLAY_FILTERS: [&str; 5] =
    ["all", "message", "interaction", "gift", "superchat"];

/// 容错读取用户手动编辑的 JSON，并将越界值恢复到可用范围。
fn normalize_live_message_settings(mut settings: LiveMessageSettings) -> LiveMessageSettings {
    if !LIVE_MESSAGE_DISPLAY_FILTERS.contains(&settings.display_filter.as_str()) {
        settings.display_filter = LiveMessageSettings::default().display_filter;
    }
    if settings.max_stored_messages == 0 {
        settings.max_stored_messages = DEFAULT_MAX_STORED_LIVE_MESSAGES;
    } else {
        settings.max_stored_messages = settings.max_stored_messages.min(MAX_STORED_LIVE_MESSAGES);
    }
    settings
}

fn validate_live_message_settings(
    settings: LiveMessageSettings,
) -> Result<LiveMessageSettings, String> {
    if !LIVE_MESSAGE_DISPLAY_FILTERS.contains(&settings.display_filter.as_str()) {
        return Err(format!("不支持的消息展示分类：{}", settings.display_filter));
    }
    if !(1..=MAX_STORED_LIVE_MESSAGES).contains(&settings.max_stored_messages) {
        return Err(format!(
            "最大存储消息条数需要在 1 到 {MAX_STORED_LIVE_MESSAGES} 之间"
        ));
    }
    Ok(settings)
}

fn normalize_hex_color(value: &str) -> Result<String, String> {
    let color = value.trim();
    if color.len() != 7
        || !color.starts_with('#')
        || !color[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("颜色需要使用 #RRGGBB 格式".to_string());
    }
    Ok(color.to_ascii_uppercase())
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

impl AppConfigStore {
    /// 根据 Tauri 应用数据目录初始化统一配置。
    pub fn initialize(&self, app: &AppHandle) -> Result<PathBuf, String> {
        if let Some(path) = self.path.get() {
            return Ok(path.clone());
        }
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("定位 bilimaku 配置目录失败：{error}"))?;
        let config_path = app_data_dir.join(CONFIG_FILE_NAME);
        self.initialize_from_path(config_path)
    }

    fn initialize_from_path(&self, config_path: PathBuf) -> Result<PathBuf, String> {
        if let Some(path) = self.path.get() {
            return Ok(path.clone());
        }
        let parent = config_path
            .parent()
            .ok_or_else(|| "统一配置文件缺少父目录".to_string())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("创建 bilimaku 配置目录失败：{error}"))?;

        let backup_path = config_path.with_extension("bak");
        let has_saved_config = config_path.is_file() || backup_path.is_file();
        let (mut config, recovered_from_backup) = if has_saved_config {
            read_config_with_backup(&config_path)?
        } else {
            (AppConfig::default(), false)
        };
        let mut should_persist = !config_path.is_file() || recovered_from_backup;
        if config.schema_version > CONFIG_SCHEMA_VERSION {
            return Err(format!(
                "配置文件版本 {} 高于当前支持的 {}",
                config.schema_version, CONFIG_SCHEMA_VERSION
            ));
        }
        if config.schema_version < CONFIG_SCHEMA_VERSION {
            config.schema_version = CONFIG_SCHEMA_VERSION;
            should_persist = true;
        }
        let normalized_messages = normalize_live_message_settings(config.live.messages.clone());
        if config.live.messages != normalized_messages {
            config.live.messages = normalized_messages;
            should_persist = true;
        }
        if should_persist {
            config.updated_at = unix_timestamp();
            persist_config(&config_path, &config)?;
        }
        *self
            .config
            .write()
            .map_err(|_| "统一配置内存状态锁定失败".to_string())? = config;
        self.path
            .set(config_path.clone())
            .map_err(|_| "统一配置 Store 已被其他初始化流程占用".to_string())?;
        Ok(config_path)
    }

    /// 返回统一配置的内存快照，不重新读取磁盘。
    pub fn snapshot(&self) -> Result<AppConfig, String> {
        self.config
            .read()
            .map(|config| config.clone())
            .map_err(|_| "统一配置内存状态锁定失败".to_string())
    }

    /// 返回当前统一配置文件路径。
    pub fn config_path(&self) -> Result<PathBuf, String> {
        self.path
            .get()
            .cloned()
            .ok_or_else(|| "统一配置 Store 尚未初始化".to_string())
    }

    /// 更新内存配置；只有字段实际变化时才写入磁盘。
    pub fn update<F>(&self, updater: F) -> Result<bool, String>
    where
        F: FnOnce(&mut AppConfig),
    {
        let path = self.config_path()?;
        let mut current = self
            .config
            .write()
            .map_err(|_| "统一配置内存状态锁定失败".to_string())?;
        let mut next = current.clone();
        updater(&mut next);
        if next == *current {
            return Ok(false);
        }
        next.schema_version = CONFIG_SCHEMA_VERSION;
        next.updated_at = unix_timestamp();
        persist_config(&path, &next)?;
        *current = next;
        Ok(true)
    }

    /// 读取内存中的账号会话。
    pub fn account_session(&self) -> Result<Option<AccountStorageConfig>, String> {
        let account = self.snapshot()?.account;
        Ok(
            (!account.cookie_header.trim().is_empty() && account.profile.is_some())
                .then_some(account),
        )
    }

    /// 保存账号 Cookie 与账号资料。
    pub fn set_account_session(
        &self,
        cookie_header: String,
        profile: AccountProfile,
    ) -> Result<bool, String> {
        self.update(|config| {
            if config.account.cookie_header == cookie_header
                && config.account.profile.as_ref() == Some(&profile)
            {
                return;
            }
            config.account = AccountStorageConfig {
                cookie_header,
                profile: Some(profile),
                saved_at: unix_timestamp(),
            };
        })
    }

    /// 清除账号登录态，不影响其他配置。
    pub fn clear_account_session(&self) -> Result<bool, String> {
        self.update(|config| config.account = AccountStorageConfig::default())
    }

    /// 读取最近一次保存的房间号。
    pub fn room_id(&self) -> Result<String, String> {
        Ok(self.snapshot()?.live.room_id)
    }

    /// 保存经过格式校验的房间号。
    pub fn set_room_id(&self, room_id: String) -> Result<bool, String> {
        self.update(|config| config.live.room_id = room_id)
    }

    /// 读取冷启动时是否应自动恢复直播间连接。
    pub fn live_auto_connect(&self) -> Result<bool, String> {
        Ok(self.snapshot()?.live.auto_connect)
    }

    /// 原子保存房间号与连接意图，避免一次连接操作触发两次配置落盘。
    pub fn set_live_connection_intent(
        &self,
        room_id: String,
        auto_connect: bool,
    ) -> Result<bool, String> {
        self.update(|config| {
            config.live.room_id = room_id;
            config.live.auto_connect = auto_connect;
        })
    }

    /// 只更新连接意图；主动断开时保留最近使用的房间号。
    pub fn set_live_auto_connect(&self, auto_connect: bool) -> Result<bool, String> {
        self.update(|config| config.live.auto_connect = auto_connect)
    }

    /// 读取直播间聊天区外观设置。
    pub fn live_appearance_settings(&self) -> Result<LiveAppearanceSettings, String> {
        let mut settings = self.snapshot()?.live.appearance;
        settings.message_bubble_color = normalize_hex_color(&settings.message_bubble_color)
            .unwrap_or_else(|_| LiveAppearanceSettings::default().message_bubble_color);
        Ok(settings)
    }

    /// 校验并保存直播间聊天区外观设置。
    pub fn set_live_appearance_settings(
        &self,
        mut settings: LiveAppearanceSettings,
    ) -> Result<bool, String> {
        settings.message_bubble_color = normalize_hex_color(&settings.message_bubble_color)?;
        self.update(|config| config.live.appearance = settings)
    }

    /// 读取聊天区消息展示与缓存偏好。
    pub fn live_message_settings(&self) -> Result<LiveMessageSettings, String> {
        Ok(normalize_live_message_settings(
            self.snapshot()?.live.messages,
        ))
    }

    /// 校验并保存聊天区消息展示与缓存偏好。
    pub fn set_live_message_settings(&self, settings: LiveMessageSettings) -> Result<bool, String> {
        let settings = validate_live_message_settings(settings)?;
        self.update(|config| config.live.messages = settings)
    }

    /// 读取 TTS 模型注册表的 JSON 值。
    pub fn tts_models(&self) -> Result<Vec<Value>, String> {
        Ok(self.snapshot()?.tts.models)
    }

    /// 保存 TTS 模型注册表。
    pub fn set_tts_models(&self, models: Vec<Value>) -> Result<bool, String> {
        self.update(|config| {
            if config.tts.models == models {
                return;
            }
            config.tts.models = models;
            config.tts.environment_cache.clear();
        })
    }

    /// 读取全机共享的 Chinese BERT 路径。
    pub fn chinese_bert_dir(&self) -> Result<String, String> {
        Ok(self.snapshot()?.tts.chinese_bert_dir)
    }

    /// 保存全机共享的 Chinese BERT 路径。
    pub fn set_chinese_bert_dir(&self, path: String) -> Result<bool, String> {
        self.update(|config| {
            if config.tts.chinese_bert_dir == path {
                return;
            }
            config.tts.chinese_bert_dir = path;
            config.tts.environment_cache.clear();
        })
    }

    /// 读取指定模型的 TTS 环境检测缓存。
    pub fn tts_environment_cache(
        &self,
        model_id: &str,
    ) -> Result<Option<TtsEnvironmentCache>, String> {
        Ok(self
            .snapshot()?
            .tts
            .environment_cache
            .into_iter()
            .find(|cache| cache.report.model_id == model_id))
    }

    /// 写入指定模型的 TTS 环境检测缓存。
    pub fn set_tts_environment_cache(&self, cache: TtsEnvironmentCache) -> Result<bool, String> {
        self.update(|config| {
            config
                .tts
                .environment_cache
                .retain(|current| current.report.model_id != cache.report.model_id);
            config.tts.environment_cache.push(cache);
        })
    }

    /// 清除指定模型的 TTS 环境检测缓存。
    pub fn clear_tts_environment_cache(&self, model_id: &str) -> Result<bool, String> {
        self.update(|config| {
            config
                .tts
                .environment_cache
                .retain(|cache| cache.report.model_id != model_id);
        })
    }

    /// 读取 TTS 用户偏好。
    pub fn tts_settings(&self) -> Result<TtsUserSettings, String> {
        Ok(normalize_tts_settings(self.snapshot()?.tts.settings))
    }

    /// 保存 TTS 用户偏好。
    pub fn set_tts_settings(&self, settings: TtsUserSettings) -> Result<bool, String> {
        let settings = normalize_tts_settings(settings);
        self.update(|config| config.tts.settings = settings)
    }

    /// 读取悬浮窗设置。
    pub fn overlay_settings(&self) -> Result<Option<Value>, String> {
        Ok(self.snapshot()?.overlay.settings)
    }

    /// 保存悬浮窗设置。
    pub fn set_overlay_settings(&self, settings: Value) -> Result<bool, String> {
        self.update(|config| config.overlay.settings = Some(settings))
    }

    /// 读取需要在下次启动时恢复的悬浮窗。
    pub fn overlay_auto_open(&self) -> Result<OverlayAutoOpenConfig, String> {
        Ok(self.snapshot()?.overlay.auto_open)
    }

    /// 记录用户对某个悬浮窗的最后一次显式开关操作。
    pub fn set_overlay_auto_open(&self, kind: &str, enabled: bool) -> Result<bool, String> {
        if kind != "danmaku" && kind != "sidebar" {
            return Err(format!("不支持的悬浮组件类型：{kind}"));
        }
        self.update(|config| match kind {
            "danmaku" => config.overlay.auto_open.danmaku = enabled,
            "sidebar" => config.overlay.auto_open.sidebar = enabled,
            _ => unreachable!("overlay kind was validated"),
        })
    }

    /// 读取侧边事件栏相对于显示器工作区的归一化位置。
    pub fn sidebar_overlay_placement(&self) -> Result<Option<SidebarOverlayPlacement>, String> {
        Ok(self.snapshot()?.overlay.sidebar_placement)
    }

    /// 保存侧边事件栏位置；数值未变化时不会重复写盘。
    pub fn set_sidebar_overlay_placement(
        &self,
        placement: SidebarOverlayPlacement,
    ) -> Result<bool, String> {
        self.update(|config| config.overlay.sidebar_placement = Some(placement))
    }
}

fn read_config_with_backup(path: &Path) -> Result<(AppConfig, bool), String> {
    match read_config(path) {
        Ok(config) => Ok((config, false)),
        Err(primary_error) => {
            let backup = path.with_extension("bak");
            if backup.is_file() {
                read_config(&backup)
                    .map(|config| (config, true))
                    .map_err(|backup_error| {
                        format!(
                            "读取统一配置失败：{primary_error}；备份文件也不可用：{backup_error}"
                        )
                    })
            } else {
                Err(primary_error)
            }
        }
    }
}

fn read_config(path: &Path) -> Result<AppConfig, String> {
    let bytes =
        fs::read(path).map_err(|error| format!("读取统一配置 {} 失败：{error}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("解析统一配置 {} 失败：{error}", path.display()))
}

fn persist_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    let mut bytes = serde_json::to_vec_pretty(config)
        .map_err(|error| format!("序列化统一配置失败：{error}"))?;
    bytes.push(b'\n');
    let temporary = path.with_extension("tmp");
    let backup = path.with_extension("bak");
    fs::write(&temporary, bytes).map_err(|error| format!("写入统一配置临时文件失败：{error}"))?;
    if backup.exists() {
        fs::remove_file(&backup).map_err(|error| format!("清理统一配置备份失败：{error}"))?;
    }
    if path.exists() {
        fs::rename(path, &backup).map_err(|error| format!("备份旧统一配置失败：{error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        if backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        return Err(format!("替换统一配置失败：{error}"));
    }
    if backup.exists() {
        fs::remove_file(&backup).map_err(|error| format!("清理统一配置备份失败：{error}"))?;
    }
    Ok(())
}

/// 返回统一配置文件的绝对路径，供设置页展示给用户。
#[tauri::command]
pub fn get_config_file_path(store: State<'_, AppConfigStore>) -> Result<String, String> {
    Ok(store.config_path()?.to_string_lossy().to_string())
}

/// 读取内存中的 TTS 播报偏好。
#[tauri::command]
pub fn get_tts_settings(store: State<'_, AppConfigStore>) -> Result<TtsUserSettings, String> {
    store.tts_settings()
}

/// 更新 TTS 播报偏好，并在有实际变化时写入统一配置。
#[tauri::command]
pub fn update_tts_settings(
    store: State<'_, AppConfigStore>,
    settings: TtsUserSettings,
) -> Result<bool, String> {
    store.set_tts_settings(settings)
}

/// 读取直播间聊天区外观设置。
#[tauri::command]
pub fn get_live_appearance_settings(
    store: State<'_, AppConfigStore>,
) -> Result<LiveAppearanceSettings, String> {
    store.live_appearance_settings()
}

/// 更新直播间聊天区外观设置。
#[tauri::command]
pub fn update_live_appearance_settings(
    store: State<'_, AppConfigStore>,
    settings: LiveAppearanceSettings,
) -> Result<bool, String> {
    store.set_live_appearance_settings(settings)
}

/// 读取聊天区消息分类与缓存上限。
#[tauri::command]
pub fn get_live_message_settings(
    store: State<'_, AppConfigStore>,
) -> Result<LiveMessageSettings, String> {
    store.live_message_settings()
}

/// 更新聊天区消息分类与缓存上限。
#[tauri::command]
pub fn update_live_message_settings(
    store: State<'_, AppConfigStore>,
    settings: LiveMessageSettings,
) -> Result<bool, String> {
    store.set_live_message_settings(settings)
}

/// 保存用户在播报台输入的直播间号。
#[tauri::command]
pub fn update_saved_room_id(
    store: State<'_, AppConfigStore>,
    room_id: String,
) -> Result<bool, String> {
    let room_id = room_id.trim();
    let parsed = room_id
        .parse::<u64>()
        .map_err(|_| "直播间 ID 需要是正整数".to_string())?;
    if parsed == 0 {
        return Err("直播间 ID 需要大于 0".to_string());
    }
    store.set_room_id(parsed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "bilimaku-store-{name}-{}-{}",
            std::process::id(),
            unix_timestamp()
        ))
    }

    #[test]
    fn loads_once_and_skips_unchanged_writes() {
        let directory = test_directory("memory");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");
        assert!(path.is_file());
        assert!(store.set_room_id("4457340".to_string()).expect("set room"));
        assert!(!store
            .set_room_id("4457340".to_string())
            .expect("skip same room"));

        let mut disk = read_config(&path).expect("read config from disk");
        disk.live.room_id = "999".to_string();
        persist_config(&path, &disk).expect("simulate manual edit while running");
        assert_eq!(store.room_id().expect("read memory"), "4457340");
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_live_connection_intent() {
        let directory = test_directory("live-connection-intent");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");

        assert!(!store.live_auto_connect().expect("read default intent"));
        assert!(store
            .set_live_connection_intent("4457340".to_string(), true)
            .expect("enable startup reconnect"));
        assert!(!store
            .set_live_connection_intent("4457340".to_string(), true)
            .expect("skip unchanged intent"));

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        assert_eq!(reloaded.room_id().expect("read persisted room"), "4457340");
        assert!(reloaded.live_auto_connect().expect("read persisted intent"));
        assert!(reloaded
            .set_live_auto_connect(false)
            .expect("disable startup reconnect"));
        assert_eq!(reloaded.room_id().expect("keep persisted room"), "4457340");
        assert!(!reloaded.live_auto_connect().expect("read disabled intent"));

        let persisted: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read persisted config"))
                .expect("parse persisted config");
        assert_eq!(persisted["live"]["autoConnect"], false);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_and_validates_live_appearance_settings() {
        let directory = test_directory("live-appearance");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");

        assert_eq!(
            store
                .live_appearance_settings()
                .expect("read default appearance")
                .message_bubble_color,
            "#66CCFF"
        );
        assert!(store
            .set_live_appearance_settings(LiveAppearanceSettings {
                message_bubble_color: "#ff72ad".to_string(),
            })
            .expect("save appearance"));
        assert!(store
            .set_live_appearance_settings(LiveAppearanceSettings {
                message_bubble_color: "blue".to_string(),
            })
            .is_err());

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        assert_eq!(
            reloaded
                .live_appearance_settings()
                .expect("read persisted appearance")
                .message_bubble_color,
            "#FF72AD"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn migrates_missing_live_message_settings_to_default() {
        let directory = test_directory("live-message-migration");
        let path = directory.join(CONFIG_FILE_NAME);
        fs::create_dir_all(&directory).expect("create config directory");
        fs::write(
            &path,
            serde_json::to_vec_pretty(&serde_json::json!({
                "schemaVersion": 1,
                "live": {
                    "roomId": "4457340",
                    "autoConnect": false
                }
            }))
            .expect("serialize legacy config"),
        )
        .expect("write legacy config");

        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("migrate store");
        assert_eq!(
            store
                .live_message_settings()
                .expect("read migrated message settings"),
            LiveMessageSettings::default()
        );
        let persisted: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read migrated config"))
                .expect("parse migrated config");
        assert_eq!(persisted["schemaVersion"], CONFIG_SCHEMA_VERSION);
        assert_eq!(persisted["live"]["messages"]["displayFilter"], "all");
        assert_eq!(
            persisted["live"]["messages"]["maxStoredMessages"],
            DEFAULT_MAX_STORED_LIVE_MESSAGES
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_and_validates_live_message_settings() {
        let directory = test_directory("live-message-settings");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");

        assert_eq!(
            store
                .live_message_settings()
                .expect("read default message settings"),
            LiveMessageSettings::default()
        );
        assert!(store
            .set_live_message_settings(LiveMessageSettings {
                display_filter: "interaction".to_string(),
                max_stored_messages: 1_234,
            })
            .expect("save message settings"));
        assert!(store
            .set_live_message_settings(LiveMessageSettings {
                display_filter: "unknown".to_string(),
                max_stored_messages: 821,
            })
            .is_err());
        assert!(store
            .set_live_message_settings(LiveMessageSettings {
                display_filter: "all".to_string(),
                max_stored_messages: MAX_STORED_LIVE_MESSAGES + 1,
            })
            .is_err());

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        assert_eq!(
            reloaded
                .live_message_settings()
                .expect("read persisted message settings"),
            LiveMessageSettings {
                display_filter: "interaction".to_string(),
                max_stored_messages: 1_234,
            }
        );
        let persisted: Value =
            serde_json::from_str(&fs::read_to_string(&path).expect("read persisted config"))
                .expect("parse persisted config");
        assert_eq!(
            persisted["live"]["messages"]["displayFilter"],
            "interaction"
        );
        assert_eq!(persisted["live"]["messages"]["maxStoredMessages"], 1_234);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_tts_auto_speak_and_event_filters() {
        let directory = test_directory("tts-speech-filter");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");

        let mut settings = TtsUserSettings::default();
        settings.auto_speak = false;
        settings.enabled_event_types = vec![
            "message".to_string(),
            "interaction-follow".to_string(),
            "interaction-follow".to_string(),
            "interaction".to_string(),
            "interaction-entered".to_string(),
            "system".to_string(),
        ];
        assert!(store
            .set_tts_settings(settings)
            .expect("save speech preferences"));

        let current = store.tts_settings().expect("read speech preferences");
        assert!(!current.auto_speak);
        assert_eq!(
            current.enabled_event_types,
            vec!["message", "interaction-follow"]
        );

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        let persisted = reloaded.tts_settings().expect("read persisted preferences");
        assert!(!persisted.auto_speak);
        assert_eq!(
            persisted.enabled_event_types,
            vec!["message", "interaction-follow"]
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_overlay_auto_open_preferences() {
        let directory = test_directory("overlay-auto-open");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");

        assert_eq!(
            store.overlay_auto_open().expect("read defaults"),
            OverlayAutoOpenConfig::default()
        );
        assert!(store
            .set_overlay_auto_open("sidebar", true)
            .expect("enable sidebar"));
        assert!(!store
            .set_overlay_auto_open("sidebar", true)
            .expect("skip unchanged sidebar"));
        assert!(store.set_overlay_auto_open("unknown", true).is_err());

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        assert_eq!(
            reloaded.overlay_auto_open().expect("read preferences"),
            OverlayAutoOpenConfig {
                danmaku: false,
                sidebar: true,
            }
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn persists_and_invalidates_tts_environment_cache() {
        let directory = test_directory("tts-environment-cache");
        let path = directory.join(CONFIG_FILE_NAME);
        let store = AppConfigStore::default();
        store
            .initialize_from_path(path.clone())
            .expect("initialize store");
        let cache = TtsEnvironmentCache {
            fingerprint: "fingerprint-v1".to_string(),
            report: crate::types::tts::TtsEnvironmentReport {
                model_id: "model-a".to_string(),
                adapter: "bert-vits2".to_string(),
                ready: true,
                summary: "环境就绪".to_string(),
                python_program: "python".to_string(),
                python_version: "3.12.0".to_string(),
                acceleration: "cuda".to_string(),
                resource_directory: "W:\\data\\chinese-roberta-wwm-ext-large".to_string(),
                checks: Vec::new(),
                setup_commands: Vec::new(),
                cached: false,
                checked_at: 1,
            },
        };

        assert!(store
            .set_tts_environment_cache(cache.clone())
            .expect("save environment cache"));
        assert!(!store
            .set_tts_environment_cache(cache.clone())
            .expect("skip identical environment cache"));

        let reloaded = AppConfigStore::default();
        reloaded
            .initialize_from_path(path.clone())
            .expect("reload store");
        assert_eq!(
            reloaded
                .tts_environment_cache("model-a")
                .expect("read reloaded cache"),
            Some(cache)
        );

        assert!(reloaded
            .set_chinese_bert_dir("W:\\data\\bert-new".to_string())
            .expect("change BERT resource"));
        assert!(reloaded
            .tts_environment_cache("model-a")
            .expect("read invalidated cache")
            .is_none());
        assert!(read_config(&path)
            .expect("read invalidated config")
            .tts
            .environment_cache
            .is_empty());
        let _ = fs::remove_dir_all(directory);
    }
}
