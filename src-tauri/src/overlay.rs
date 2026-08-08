use crate::store::AppConfigStore;
use crate::types::overlay::{OverlayWindowOptions, SidebarOverlayPlacement};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalSize, State,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub const SETTINGS_EVENT: &str = "overlay://settings";
pub const PREVIEW_EVENT: &str = "overlay://preview";
const DANMAKU_LABEL: &str = "danmaku-overlay";
const SIDEBAR_LABEL: &str = "event-sidebar";

#[derive(Clone, Copy, Debug, PartialEq)]
struct ScreenRect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl ScreenRect {
    fn from_monitor(monitor: &Monitor) -> Self {
        let work_area = monitor.work_area();
        Self {
            x: work_area.position.x,
            y: work_area.position.y,
            width: work_area.size.width,
            height: work_area.size.height,
        }
    }
}

#[derive(Clone, Copy)]
enum SidebarGeometryMode {
    /// 新建窗口时恢复已保存位置；不存在时固定停靠主显示器工作区右下角。
    Restore,
    /// 设置热更新时保留窗口当前所在的显示器与左上角位置。
    Preserve,
}

fn overlay_label(kind: &str) -> Result<&'static str, String> {
    match kind {
        "danmaku" => Ok(DANMAKU_LABEL),
        "sidebar" => Ok(SIDEBAR_LABEL),
        _ => Err(format!("未知悬浮窗类型：{kind}")),
    }
}

fn intersection_area(
    window_position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    screen: ScreenRect,
) -> u64 {
    let window_left = i64::from(window_position.x);
    let window_top = i64::from(window_position.y);
    let window_right = window_left + i64::from(window_size.width);
    let window_bottom = window_top + i64::from(window_size.height);
    let screen_left = i64::from(screen.x);
    let screen_top = i64::from(screen.y);
    let screen_right = screen_left + i64::from(screen.width);
    let screen_bottom = screen_top + i64::from(screen.height);
    let width = (window_right.min(screen_right) - window_left.max(screen_left)).max(0) as u64;
    let height = (window_bottom.min(screen_bottom) - window_top.max(screen_top)).max(0) as u64;
    width * height
}

fn distance_squared_to_screen(
    window_position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
    screen: ScreenRect,
) -> f64 {
    let center_x = f64::from(window_position.x) + f64::from(window_size.width) / 2.0;
    let center_y = f64::from(window_position.y) + f64::from(window_size.height) / 2.0;
    let left = f64::from(screen.x);
    let top = f64::from(screen.y);
    let right = left + f64::from(screen.width);
    let bottom = top + f64::from(screen.height);
    let nearest_x = center_x.clamp(left, right);
    let nearest_y = center_y.clamp(top, bottom);
    (center_x - nearest_x).powi(2) + (center_y - nearest_y).powi(2)
}

/// 优先选择与窗口相交面积最大的显示器；完全落在屏幕外时选择距离最近的显示器。
/// 不能直接约束到整个虚拟桌面外接矩形，因为错位排列的屏幕之间可能存在不可见空洞。
fn target_screen_index(
    screens: &[ScreenRect],
    window_position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
) -> Option<usize> {
    let (largest_index, largest_area) = screens
        .iter()
        .enumerate()
        .map(|(index, screen)| {
            (
                index,
                intersection_area(window_position, window_size, *screen),
            )
        })
        .max_by_key(|(_, area)| *area)?;
    if largest_area > 0 {
        return Some(largest_index);
    }
    screens
        .iter()
        .enumerate()
        .min_by(|(_, left), (_, right)| {
            distance_squared_to_screen(window_position, window_size, **left).total_cmp(
                &distance_squared_to_screen(window_position, window_size, **right),
            )
        })
        .map(|(index, _)| index)
}

fn clamp_axis(position: i32, window_extent: u32, start: i32, screen_extent: u32) -> i32 {
    if window_extent >= screen_extent {
        return start;
    }
    let minimum = i64::from(start);
    let maximum = minimum + i64::from(screen_extent - window_extent);
    i64::from(position).clamp(minimum, maximum) as i32
}

fn clamp_position(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    screen: ScreenRect,
) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        clamp_axis(position.x, size.width, screen.x, screen.width),
        clamp_axis(position.y, size.height, screen.y, screen.height),
    )
}

fn finite_or(value: f64, fallback: f64) -> f64 {
    value.is_finite().then_some(value).unwrap_or(fallback)
}

fn sidebar_physical_size(options: &OverlayWindowOptions, monitor: &Monitor) -> PhysicalSize<u32> {
    let screen = ScreenRect::from_monitor(monitor);
    let logical_work_area = monitor
        .work_area()
        .size
        .to_logical::<f64>(monitor.scale_factor());
    let maximum_width = logical_work_area.width.max(1.0);
    let maximum_height = logical_work_area.height.max(1.0);
    let minimum_width = 280.0_f64.min(maximum_width);
    let minimum_height = 360.0_f64.min(maximum_height);
    let width = finite_or(options.width, 390.0).clamp(minimum_width, maximum_width);
    let height = finite_or(options.height, 720.0).clamp(minimum_height, maximum_height);
    let physical = LogicalSize::new(width, height).to_physical::<u32>(monitor.scale_factor());
    PhysicalSize::new(
        physical.width.max(1).min(screen.width.max(1)),
        physical.height.max(1).min(screen.height.max(1)),
    )
}

fn default_position(screen: ScreenRect, size: PhysicalSize<u32>) -> PhysicalPosition<i32> {
    let horizontal_space = screen.width.saturating_sub(size.width);
    let vertical_space = screen.height.saturating_sub(size.height);
    PhysicalPosition::new(
        (i64::from(screen.x) + i64::from(horizontal_space)) as i32,
        (i64::from(screen.y) + i64::from(vertical_space)) as i32,
    )
}

fn position_from_placement(
    placement: &SidebarOverlayPlacement,
    screen: ScreenRect,
    size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let available_x = f64::from(screen.width.saturating_sub(size.width));
    let available_y = f64::from(screen.height.saturating_sub(size.height));
    let x_ratio = finite_or(placement.x_ratio, 1.0);
    let y_ratio = finite_or(placement.y_ratio, 1.0);
    let x = f64::from(screen.x) + available_x * x_ratio;
    let y = f64::from(screen.y) + available_y * y_ratio;
    PhysicalPosition::new(
        x.round().clamp(f64::from(i32::MIN), f64::from(i32::MAX)) as i32,
        y.round().clamp(f64::from(i32::MIN), f64::from(i32::MAX)) as i32,
    )
}

fn placement_from_position(
    monitor: &Monitor,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> SidebarOverlayPlacement {
    let screen = ScreenRect::from_monitor(monitor);
    let available_x = screen.width.saturating_sub(size.width);
    let available_y = screen.height.saturating_sub(size.height);
    SidebarOverlayPlacement {
        monitor_name: monitor.name().cloned(),
        monitor_origin_x: screen.x,
        monitor_origin_y: screen.y,
        x_ratio: if available_x == 0 {
            0.0
        } else {
            (i64::from(position.x) - i64::from(screen.x)) as f64 / f64::from(available_x)
        },
        y_ratio: if available_y == 0 {
            0.0
        } else {
            (i64::from(position.y) - i64::from(screen.y)) as f64 / f64::from(available_y)
        },
    }
}

fn monitor_origin_distance(monitor: &Monitor, placement: &SidebarOverlayPlacement) -> i128 {
    let screen = ScreenRect::from_monitor(monitor);
    let dx = i128::from(screen.x) - i128::from(placement.monitor_origin_x);
    let dy = i128::from(screen.y) - i128::from(placement.monitor_origin_y);
    dx * dx + dy * dy
}

fn restored_monitor_index(
    monitors: &[Monitor],
    primary: Option<&Monitor>,
    placement: Option<&SidebarOverlayPlacement>,
) -> usize {
    if let Some(placement) = placement {
        if let Some(index) = monitors
            .iter()
            .enumerate()
            .filter(|(_, monitor)| {
                monitor.name().map(String::as_str) == placement.monitor_name.as_deref()
            })
            .min_by_key(|(_, monitor)| monitor_origin_distance(monitor, placement))
            .map(|(index, _)| index)
        {
            return index;
        }
    }
    if let Some(primary) = primary {
        let primary_screen = ScreenRect::from_monitor(primary);
        if let Some(index) = monitors.iter().position(|monitor| {
            ScreenRect::from_monitor(monitor) == primary_screen && monitor.name() == primary.name()
        }) {
            return index;
        }
    }
    0
}

fn available_monitors(window: &WebviewWindow) -> Result<Vec<Monitor>, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| format!("读取可用显示器失败：{error}"))?;
    (!monitors.is_empty())
        .then_some(monitors)
        .ok_or_else(|| "没有检测到可用显示器".to_string())
}

fn persist_sidebar_placement(
    store: &AppConfigStore,
    monitor: &Monitor,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Result<(), String> {
    store
        .set_sidebar_overlay_placement(placement_from_position(monitor, position, size))
        .map(|_| ())
}

fn apply_sidebar_geometry(
    window: &WebviewWindow,
    options: &OverlayWindowOptions,
    store: &AppConfigStore,
    mode: SidebarGeometryMode,
) -> Result<(), String> {
    let monitors = available_monitors(window)?;
    let screens = monitors
        .iter()
        .map(ScreenRect::from_monitor)
        .collect::<Vec<_>>();
    let saved_placement = store.sidebar_overlay_placement()?;
    let current_position = window.outer_position().unwrap_or_default();
    let current_size = window
        .outer_size()
        .unwrap_or_else(|_| PhysicalSize::new(1, 1));
    let primary = window
        .primary_monitor()
        .map_err(|error| format!("读取主显示器失败：{error}"))?;
    let monitor_index = match mode {
        SidebarGeometryMode::Restore => {
            restored_monitor_index(&monitors, primary.as_ref(), saved_placement.as_ref())
        }
        SidebarGeometryMode::Preserve => {
            target_screen_index(&screens, current_position, current_size).unwrap_or(0)
        }
    };
    let monitor = &monitors[monitor_index];
    let screen = screens[monitor_index];
    let size = sidebar_physical_size(options, monitor);
    let mut position = match mode {
        SidebarGeometryMode::Restore => saved_placement
            .as_ref()
            .map(|placement| position_from_placement(placement, screen, size))
            .unwrap_or_else(|| default_position(screen, size)),
        SidebarGeometryMode::Preserve => current_position,
    };
    position = clamp_position(position, size, screen);

    // 全程使用物理像素，避免不同 DPI 显示器之间混用逻辑坐标产生跳变。
    window
        .set_size(size)
        .map_err(|error| format!("调整侧边栏尺寸失败：{error}"))?;
    window
        .set_position(position)
        .map_err(|error| format!("调整侧边栏位置失败：{error}"))?;
    persist_sidebar_placement(store, monitor, position, size)
}

fn apply_window_options(
    window: &WebviewWindow,
    kind: &str,
    options: &OverlayWindowOptions,
    store: &AppConfigStore,
    geometry_mode: SidebarGeometryMode,
) -> Result<(), String> {
    let click_through = options.click_through && !options.edit_mode;
    window
        .set_ignore_cursor_events(click_through)
        .map_err(|error| format!("设置悬浮窗鼠标穿透失败：{error}"))?;
    if kind == "sidebar" {
        apply_sidebar_geometry(window, options, store, geometry_mode)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_overlay(
    app: AppHandle,
    store: State<'_, AppConfigStore>,
    kind: String,
    settings: Value,
    options: OverlayWindowOptions,
) -> Result<(), String> {
    let label = overlay_label(&kind)?;
    store.set_overlay_settings(settings)?;

    if let Some(window) = app.get_webview_window(label) {
        apply_window_options(
            &window,
            &kind,
            &options,
            store.inner(),
            SidebarGeometryMode::Preserve,
        )?;
        window
            .show()
            .map_err(|error| format!("显示悬浮窗失败：{error}"))?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?overlay={kind}").into());
    let mut builder = WebviewWindowBuilder::new(&app, label, url)
        .title(if kind == "danmaku" {
            "bilimaku 弹幕悬浮层"
        } else {
            "bilimaku 事件侧边栏"
        })
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .focused(false)
        .visible(false);
    builder = if kind == "danmaku" {
        builder.fullscreen(true).resizable(false)
    } else {
        builder
            .inner_size(options.width, options.height)
            .resizable(false)
    };
    let window = builder
        .build()
        .map_err(|error| format!("创建悬浮窗失败：{error}"))?;
    apply_window_options(
        &window,
        &kind,
        &options,
        store.inner(),
        SidebarGeometryMode::Restore,
    )?;
    window
        .show()
        .map_err(|error| format!("显示悬浮窗失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub fn update_overlay_window(
    app: AppHandle,
    store: State<'_, AppConfigStore>,
    kind: String,
    options: OverlayWindowOptions,
) -> Result<(), String> {
    let label = overlay_label(&kind)?;
    if let Some(window) = app.get_webview_window(label) {
        apply_window_options(
            &window,
            &kind,
            &options,
            store.inner(),
            SidebarGeometryMode::Preserve,
        )?;
    }
    Ok(())
}

/// 在原生拖动结束后选择相交面积最大的目标显示器，再固定执行防溢出并保存位置。
/// 拖动期间不做实时约束，因此窗口可以自然穿过主副屏边界。
#[tauri::command]
pub fn finalize_sidebar_overlay_position(
    app: AppHandle,
    store: State<'_, AppConfigStore>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(SIDEBAR_LABEL) else {
        return Ok(());
    };
    let monitors = available_monitors(&window)?;
    let screens = monitors
        .iter()
        .map(ScreenRect::from_monitor)
        .collect::<Vec<_>>();
    let size = window
        .outer_size()
        .map_err(|error| format!("读取侧边栏尺寸失败：{error}"))?;
    let current_position = window
        .outer_position()
        .map_err(|error| format!("读取侧边栏位置失败：{error}"))?;
    let target_index = target_screen_index(&screens, current_position, size).unwrap_or(0);
    let monitor = &monitors[target_index];
    let position = clamp_position(current_position, size, screens[target_index]);
    if position != current_position {
        window
            .set_position(position)
            .map_err(|error| format!("收回超出显示器的侧边栏失败：{error}"))?;
    }
    persist_sidebar_placement(store.inner(), monitor, position, size)
}

#[tauri::command]
pub fn close_overlay(app: AppHandle, kind: String) -> Result<(), String> {
    let label = overlay_label(&kind)?;
    if let Some(window) = app.get_webview_window(label) {
        window
            .close()
            .map_err(|error| format!("关闭悬浮窗失败：{error}"))?;
    }
    Ok(())
}

/// 返回指定悬浮组件对应的窗口是否已经创建且仍然存在。
#[tauri::command]
pub fn is_overlay_open(app: AppHandle, kind: String) -> Result<bool, String> {
    let label = overlay_label(&kind)?;
    Ok(app.get_webview_window(label).is_some())
}

#[tauri::command]
pub fn get_overlay_settings(store: State<'_, AppConfigStore>) -> Result<Option<Value>, String> {
    store.overlay_settings()
}

#[tauri::command]
pub fn update_overlay_settings(
    app: AppHandle,
    store: State<'_, AppConfigStore>,
    settings: Value,
) -> Result<(), String> {
    store.set_overlay_settings(settings.clone())?;
    app.emit(SETTINGS_EVENT, settings)
        .map_err(|error| format!("广播悬浮窗设置失败：{error}"))
}

#[tauri::command]
pub fn preview_overlay_event(app: AppHandle, event: Value) -> Result<(), String> {
    app.emit(PREVIEW_EVENT, event)
        .map_err(|error| format!("发送悬浮窗预览事件失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_supported_overlay_kinds() {
        assert_eq!(overlay_label("danmaku").expect("danmaku"), DANMAKU_LABEL);
        assert_eq!(overlay_label("sidebar").expect("sidebar"), SIDEBAR_LABEL);
        assert!(overlay_label("unknown").is_err());
    }

    #[test]
    fn defaults_sidebar_to_bottom_right_of_work_area() {
        let screen = ScreenRect {
            x: -1920,
            y: 40,
            width: 1920,
            height: 1040,
        };
        assert_eq!(
            default_position(screen, PhysicalSize::new(390, 720)),
            PhysicalPosition::new(-390, 360),
        );
    }

    #[test]
    fn selects_monitor_by_largest_intersection_with_negative_coordinates() {
        let screens = [
            ScreenRect {
                x: -1920,
                y: 0,
                width: 1920,
                height: 1040,
            },
            ScreenRect {
                x: 0,
                y: 0,
                width: 2560,
                height: 1400,
            },
        ];
        let index = target_screen_index(
            &screens,
            PhysicalPosition::new(-420, 120),
            PhysicalSize::new(500, 700),
        );
        assert_eq!(index, Some(0));
    }

    #[test]
    fn clamps_inside_selected_work_area_without_forcing_primary_monitor() {
        let secondary = ScreenRect {
            x: -1920,
            y: -180,
            width: 1920,
            height: 1040,
        };
        assert_eq!(
            clamp_position(
                PhysicalPosition::new(-2100, -400),
                PhysicalSize::new(390, 720),
                secondary,
            ),
            PhysicalPosition::new(-1920, -180),
        );
        assert_eq!(
            clamp_position(
                PhysicalPosition::new(-100, 600),
                PhysicalSize::new(390, 720),
                secondary,
            ),
            PhysicalPosition::new(-390, 140),
        );
    }
}
