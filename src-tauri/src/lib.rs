use serde::Serialize;

mod account;
mod live;

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
        .manage(account::BiliAccountState::default())
        .manage(live::LiveConnectionState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_status,
            account::get_bilibili_login_status,
            account::create_bilibili_login_qr,
            account::poll_bilibili_login,
            account::logout_bilibili_account,
            live::connect_live_room,
            live::disconnect_live_room,
            live::get_live_connection_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running BiliCast");
}
