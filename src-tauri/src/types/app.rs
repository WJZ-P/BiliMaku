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
