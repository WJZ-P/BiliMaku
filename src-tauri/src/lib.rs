use crate::types::app::AppStatus;
use std::time::Instant;
use tauri::{Manager, RunEvent};

mod account;
mod anchor_analytics;
mod live;
mod overlay;
mod performance;
mod store;
mod tts;
mod types;

#[tauri::command]
fn get_app_status() -> AppStatus {
    AppStatus {
        name: "bilimaku",
        version: env!("CARGO_PKG_VERSION"),
        core_ready: true,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_performance = performance::StartupPerformanceState::default();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(account::BiliAccountState::default())
        .manage(anchor_analytics::AnchorAnalyticsState::default())
        .manage(live::LiveConnectionState::default())
        .manage(startup_performance)
        .manage(store::AppConfigStore::default())
        .manage(tts::TtsWorkerState::default())
        .setup(|app| {
            let startup = app.state::<performance::StartupPerformanceState>();
            let log_path = startup
                .initialize(app.handle())
                .map_err(std::io::Error::other)?;
            performance::install_process_panic_hook(log_path);
            startup
                .mark("rust", "setup-enter", None, None)
                .map_err(std::io::Error::other)?;

            let store_started = Instant::now();
            let store = app.state::<store::AppConfigStore>();
            store
                .initialize(app.handle())
                .map_err(std::io::Error::other)?;
            startup
                .mark(
                    "rust",
                    "config-store-initialized",
                    Some(store_started.elapsed().as_secs_f64() * 1000.0),
                    None,
                )
                .map_err(std::io::Error::other)?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let account_started = Instant::now();
                let startup = handle.state::<performance::StartupPerformanceState>();
                let _ = startup.mark("rust", "account-session-restore-started", None, None);
                let state = handle.state::<account::BiliAccountState>();
                let store = handle.state::<store::AppConfigStore>();
                let result =
                    account::ensure_bilibili_session_initialized(&handle, &state, &store).await;
                let detail = match &result {
                    Ok(status) => format!(
                        "phase={}, persisted={}, validated={}",
                        status.phase,
                        status.persisted,
                        status.validated_at.is_some()
                    ),
                    Err(error) => format!("error: {error}"),
                };
                let _ = startup.mark(
                    "rust",
                    "account-session-restore-finished",
                    Some(account_started.elapsed().as_secs_f64() * 1000.0),
                    Some(detail),
                );
                if let Err(error) = result {
                    eprintln!("bilimaku account session initialization failed: {error}");
                }
            });
            startup
                .mark("rust", "setup-complete", None, None)
                .map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_status,
            performance::record_startup_metrics,
            performance::get_startup_performance_log_path,
            account::get_bilibili_login_status,
            account::create_bilibili_login_qr,
            account::poll_bilibili_login,
            account::logout_bilibili_account,
            anchor_analytics::get_anchor_analytics_overview,
            live::connect_live_room,
            live::disconnect_live_room,
            live::get_live_connection_status,
            live::update_live_auto_connect,
            live::get_live_online_rank,
            live::get_live_emoticons,
            live::send_live_danmaku,
            store::get_config_file_path,
            store::get_app_theme,
            store::update_app_theme,
            store::get_live_appearance_settings,
            store::update_live_appearance_settings,
            store::get_live_activity_totals,
            store::increment_live_activity_totals,
            store::get_live_message_settings,
            store::update_live_message_settings,
            store::get_tts_settings,
            store::update_saved_room_id,
            store::update_tts_settings,
            tts::list_tts_models,
            tts::import_tts_model,
            tts::inspect_tts_environment,
            tts::preload_tts_model,
            tts::get_tts_preload_status,
            tts::prepare_tts_model,
            tts::register_tts_bert_resource,
            tts::remove_tts_model,
            tts::synthesize_custom_tts,
            overlay::open_overlay,
            overlay::update_overlay_window,
            overlay::finalize_sidebar_overlay_position,
            overlay::close_overlay,
            overlay::is_overlay_open,
            overlay::get_overlay_settings,
            overlay::get_overlay_auto_open,
            overlay::update_overlay_auto_open,
            overlay::update_overlay_settings,
            overlay::preview_overlay_event
        ])
        .build(tauri::generate_context!())
        .expect("error while running bilimaku");

    app.run(|handle, event| match event {
        RunEvent::ExitRequested { code, .. } => {
            let _ = handle.state::<performance::StartupPerformanceState>().mark(
                "rust",
                "process-exit-requested",
                None,
                Some(format!("code={code:?}")),
            );
        }
        RunEvent::Exit => {
            let _ = handle.state::<performance::StartupPerformanceState>().mark(
                "rust",
                "process-exit",
                None,
                None,
            );
        }
        _ => {}
    });
}
