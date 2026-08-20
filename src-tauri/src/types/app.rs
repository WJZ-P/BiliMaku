use serde::Serialize;

/// 前端用于确认 Rust 核心可用性的应用状态。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    /// 当前产品名称。
    pub name: &'static str,
    /// 当前 Cargo 包版本。
    pub version: &'static str,
    /// Rust 核心是否已经完成基础初始化。
    pub core_ready: bool,
}

/// GitHub Release 与当前桌面程序版本的比较结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateStatus {
    /// 当前正在运行的应用版本，不包含 `v` 前缀。
    pub current_version: String,
    /// GitHub 最新正式 Release 的版本，不包含 `v` 前缀。
    pub latest_version: String,
    /// 最新正式 Release 是否高于当前应用版本。
    pub update_available: bool,
    /// 最新正式 Release 的浏览器页面。
    pub release_url: String,
    /// Release 展示名称；平台未设置名称时回退到标签。
    pub release_name: String,
    /// Release 发布时间，保持 GitHub 返回的 RFC 3339 字符串。
    pub published_at: Option<String>,
}
