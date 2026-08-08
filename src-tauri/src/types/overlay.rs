use serde::{Deserialize, Serialize};

/// 创建或更新悬浮窗时使用的窗口级参数。
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayWindowOptions {
    /// 是否让鼠标事件穿透悬浮窗。
    #[serde(default = "default_click_through")]
    pub click_through: bool,
    /// 是否显示侧边栏编辑边界并启用原生窗口拖动。
    #[serde(default)]
    pub edit_mode: bool,

    /// 侧边栏窗口宽度，单位为逻辑像素。
    #[serde(default = "default_sidebar_width")]
    pub width: f64,
    /// 侧边栏窗口高度，单位为逻辑像素。
    #[serde(default = "default_sidebar_height")]
    pub height: f64,
    /// 没有已保存位置时的初始停靠方向，可选 left 或 right。
    #[serde(default = "default_side")]
    pub side: String,
}

/// 侧边悬浮窗相对于某一显示器工作区的持久化位置。
///
/// 使用归一化比例而非固定像素，能够在分辨率、DPI 或显示器排列变化后
/// 继续恢复到相近位置；显示器原点允许为负数。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SidebarOverlayPlacement {
    /// 操作系统提供的显示器名称；同名设备通过保存时原点进一步区分。
    pub monitor_name: Option<String>,
    /// 保存时显示器工作区左上角物理 X 坐标。
    pub monitor_origin_x: i32,
    /// 保存时显示器工作区左上角物理 Y 坐标。
    pub monitor_origin_y: i32,
    /// 窗口在工作区可移动宽度中的横向比例。
    pub x_ratio: f64,
    /// 窗口在工作区可移动高度中的纵向比例。
    pub y_ratio: f64,
}

impl Default for SidebarOverlayPlacement {
    fn default() -> Self {
        Self {
            monitor_name: None,
            monitor_origin_x: 0,
            monitor_origin_y: 0,
            x_ratio: 1.0,
            y_ratio: 0.5,
        }
    }
}

fn default_click_through() -> bool {
    true
}

fn default_sidebar_width() -> f64 {
    390.0
}

fn default_sidebar_height() -> f64 {
    720.0
}

fn default_side() -> String {
    "right".to_string()
}
