use crate::overlay;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";

/// 统一应用退出状态，避免多个窗口事件重复发起退出流程。
#[derive(Default)]
pub struct AppLifecycleState {
    exiting: AtomicBool,
}

impl AppLifecycleState {
    fn begin_exit(&self) -> bool {
        self.exiting
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn is_exiting(&self) -> bool {
        self.exiting.load(Ordering::Acquire)
    }
}

fn is_main_window(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}

/// 在事件循环结束前主动关闭悬浮窗；直接操作窗口，不改变下次自动恢复配置。
pub fn prepare_for_exit<R: Runtime>(app: &AppHandle<R>) -> bool {
    let state = app.state::<AppLifecycleState>();
    if !state.begin_exit() {
        return false;
    }
    overlay::close_all_overlay_windows(app);
    true
}

/// 发起一次应用级退出，确保所有窗口和后台状态跟随同一个进程生命周期结束。
pub fn request_app_exit<R: Runtime>(app: &AppHandle<R>) {
    if prepare_for_exit(app) {
        app.exit(0);
    }
}

/// 自绘标题栏 X 按钮调用的应用级退出命令。
#[tauri::command]
pub fn exit_application(app: AppHandle) {
    request_app_exit(&app);
}

/// 主窗口关闭代表用户退出应用；单独关闭悬浮窗仍只影响对应浮窗。
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !is_main_window(window.label()) {
        return;
    }

    match event {
        WindowEvent::CloseRequested { api, .. } => {
            let app = window.app_handle();
            if app.state::<AppLifecycleState>().is_exiting() {
                return;
            }
            api.prevent_close();
            request_app_exit(app);
        }
        WindowEvent::Destroyed => request_app_exit(window.app_handle()),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_main_window_owns_the_application_lifecycle() {
        assert!(is_main_window("main"));
        assert!(!is_main_window(overlay::DANMAKU_LABEL));
        assert!(!is_main_window(overlay::SIDEBAR_LABEL));
    }

    #[test]
    fn exit_transition_only_starts_once() {
        let state = AppLifecycleState::default();
        assert!(state.begin_exit());
        assert!(state.is_exiting());
        assert!(!state.begin_exit());
    }
}
