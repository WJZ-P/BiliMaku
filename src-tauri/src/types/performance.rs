use serde::Deserialize;

/// 浏览器启动时间线中的单个阶段或资源请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupMetric {
    /// 阶段名，例如 html-inline、react-first-frame 或 resource。
    pub stage: String,
    /// 相对于浏览器 performance.timeOrigin 的毫秒数。
    pub elapsed_ms: f64,
    /// 阶段自身耗时；瞬时标记为空。
    #[serde(default)]
    pub duration_ms: Option<f64>,
    /// 文件路径、触发原因等补充信息。
    #[serde(default)]
    pub detail: Option<String>,
}

/// 前端一次完整启动采样报告。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendStartupReport {
    /// 浏览器页面级采样编号。
    pub session_id: String,
    /// 浏览器导航时间原点，单位为 Unix 毫秒。
    pub time_origin_ms: f64,
    /// 触发本次写入的阶段。
    pub reason: String,
    /// 当前页面地址；用于区分主窗口与悬浮窗。
    pub location: String,
    /// WebView 浏览器标识。
    pub user_agent: String,
    /// 按发生顺序采集的阶段与资源耗时。
    pub metrics: Vec<StartupMetric>,
}
