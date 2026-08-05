use serde::Serialize;

mod account;
mod live;
mod overlay;
mod tts;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStatus {
    name: &'static str,
    version: &'static str,
    core_ready: bool,
}

#[tauri::command]
fn get_app_status() -> AppStatus {
    AppStatus {
        name: "BiliCast",
        version: env!("CARGO_PKG_VERSION"),
        core_ready: true,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(account::BiliAccountState::default())
        .manage(live::LiveConnectionState::default())
        .manage(overlay::OverlayState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_status,
            account::get_bilibili_login_status,
            account::create_bilibili_login_qr,
            account::poll_bilibili_login,
            account::logout_bilibili_account,
            live::connect_live_room,
            live::disconnect_live_room,
            live::get_live_connection_status,
            tts::list_tts_models,
            tts::import_tts_model,
            tts::remove_tts_model,
            tts::synthesize_custom_tts,
            overlay::open_overlay,
            overlay::update_overlay_window,
            overlay::close_overlay,
            overlay::get_overlay_settings,
            overlay::update_overlay_settings,
            overlay::preview_overlay_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running BiliCast");
}
