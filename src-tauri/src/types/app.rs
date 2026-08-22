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
    /// 当前平台是否存在可由应用内更新器安装的 Release 资产。
    pub install_supported: bool,
    /// 应用内更新器将下载的资产名称。
    pub asset_name: Option<String>,
}

/// 应用内更新下载、校验和暂存阶段的实时进度。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateProgress {
    /// 当前阶段：checking、downloading、verifying、staging 或 ready。
    pub phase: String,
    /// 可计算时返回 0 到 100 的整数百分比。
    pub percent: Option<u8>,
    /// 已下载字节数。
    pub downloaded_bytes: u64,
    /// Release 资产声明的总字节数。
    pub total_bytes: Option<u64>,
    /// 面向用户的中文进度说明。
    pub message: String,
}
