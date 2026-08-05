use serde::Deserialize;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

pub const SETTINGS_EVENT: &str = "overlay://settings";
pub const PREVIEW_EVENT: &str = "overlay://preview";
const DANMAKU_LABEL: &str = "danmaku-overlay";
const SIDEBAR_LABEL: &str = "event-sidebar";

#[derive(Default)]
pub struct OverlayState {
    settings: Mutex<Option<Value>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayWindowOptions {
    #[serde(default = "default_click_through")]
    click_through: bool,
    #[serde(default = "default_sidebar_width")]
    width: f64,
    #[serde(default = "default_sidebar_height")]
    height: f64,
    #[serde(default = "default_side")]
    side: String,
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

fn overlay_label(kind: &str) -> Result<&'static str, String> {
    match kind {
        "danmaku" => Ok(DANMAKU_LABEL),
        "sidebar" => Ok(SIDEBAR_LABEL),
        _ => Err(format!("未知悬浮窗类型：{kind}")),
    }
}

fn apply_sidebar_geometry(
    window: &WebviewWindow,
    options: &OverlayWindowOptions,
) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| format!("读取悬浮窗显示器失败：{error}"))?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "没有检测到可用显示器".to_string())?;
    let scale = monitor.scale_factor();
    let monitor_size = monitor.size().to_logical::<f64>(scale);
    let monitor_position = monitor.position().to_logical::<f64>(scale);
    let width = options.width.clamp(280.0, monitor_size.width * 0.8);
    let height = options.height.clamp(360.0, monitor_size.height - 48.0);
    let margin = 24.0;
    let x = if options.side == "left" {
        monitor_position.x + margin
    } else {
        monitor_position.x + monitor_size.width - width - margin
    };
    let y = monitor_position.y + ((monitor_size.height - height) / 2.0).max(24.0);
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| format!("调整侧边栏尺寸失败：{error}"))?;
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|error| format!("调整侧边栏位置失败：{error}"))?;
    Ok(())
}

fn apply_window_options(
    window: &WebviewWindow,
    kind: &str,
    options: &OverlayWindowOptions,
) -> Result<(), String> {
    window
        .set_ignore_cursor_events(options.click_through)
        .map_err(|error| format!("设置悬浮窗鼠标穿透失败：{error}"))?;
    if kind == "sidebar" {
        apply_sidebar_geometry(window, options)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_overlay(
    app: AppHandle,
    state: State<'_, OverlayState>,
    kind: String,
    settings: Value,
    options: OverlayWindowOptions,
) -> Result<(), String> {
    let label = overlay_label(&kind)?;
    *state
        .settings
        .lock()
        .map_err(|_| "悬浮窗设置状态锁定失败".to_string())? = Some(settings);

    if let Some(window) = app.get_webview_window(label) {
        apply_window_options(&window, &kind, &options)?;
        window
            .show()
            .map_err(|error| format!("显示悬浮窗失败：{error}"))?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?overlay={kind}").into());
    let mut builder = WebviewWindowBuilder::new(&app, label, url)
        .title(if kind == "danmaku" {
            "BiliCast 弹幕悬浮层"
        } else {
            "BiliCast 事件侧边栏"
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
            .resizable(true)
    };
    let window = builder
        .build()
        .map_err(|error| format!("创建悬浮窗失败：{error}"))?;
    apply_window_options(&window, &kind, &options)?;
    window
        .show()
        .map_err(|error| format!("显示悬浮窗失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub fn update_overlay_window(
    app: AppHandle,
    kind: String,
    options: OverlayWindowOptions,
) -> Result<(), String> {
    let label = overlay_label(&kind)?;
    if let Some(window) = app.get_webview_window(label) {
        apply_window_options(&window, &kind, &options)?;
    }
    Ok(())
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

#[tauri::command]
pub fn get_overlay_settings(state: State<'_, OverlayState>) -> Result<Option<Value>, String> {
    state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .map_err(|_| "悬浮窗设置状态锁定失败".to_string())
}

#[tauri::command]
pub fn update_overlay_settings(
    app: AppHandle,
    state: State<'_, OverlayState>,
    settings: Value,
) -> Result<(), String> {
    *state
        .settings
        .lock()
        .map_err(|_| "悬浮窗设置状态锁定失败".to_string())? = Some(settings.clone());
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
}
