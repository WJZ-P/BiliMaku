mod bilibili;
mod protocol;

use crate::account::BiliAccountState;
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;

pub const LIVE_EVENT_NAME: &str = "live://event";
pub const LIVE_STATUS_EVENT_NAME: &str = "live://status";
pub const LIVE_POPULARITY_EVENT_NAME: &str = "live://popularity";

static SESSION_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct LiveConnectionState {
    active: Mutex<Option<ActiveConnection>>,
}

struct ActiveConnection {
    session_id: u64,
    room_id: u64,
    cancel: watch::Sender<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomConnectionInfo {
    pub session_id: u64,
    pub requested_room_id: u64,
    pub room_id: u64,
    pub owner_uid: u64,
    pub title: String,
    pub live_status: u8,
    pub access_mode: &'static str,
    pub viewer_uid: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStatus {
    pub session_id: u64,
    pub room_id: u64,
    pub state: &'static str,
    pub message: String,
    pub attempt: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEvent {
    pub id: String,
    pub session_id: u64,
    pub room_id: u64,
    #[serde(rename = "type")]
    pub event_type: String,
    pub user_id: Option<String>,
    pub user: String,
    pub avatar: String,
    pub content: String,
    pub meta: Option<String>,
    pub raw_command: String,
    pub emitted_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PopularityUpdate {
    pub session_id: u64,
    pub room_id: u64,
    pub popularity: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSnapshot {
    pub connected: bool,
    pub session_id: Option<u64>,
    pub room_id: Option<u64>,
}

#[tauri::command]
pub async fn connect_live_room(
    app: AppHandle,
    state: State<'_, LiveConnectionState>,
    account: State<'_, BiliAccountState>,
    room_id: String,
) -> Result<RoomConnectionInfo, String> {
    let requested_room_id = room_id
        .trim()
        .parse::<u64>()
        .map_err(|_| "请输入正确的数字直播间 ID".to_string())?;
    if requested_room_id == 0 {
        return Err("直播间 ID 需要大于 0".to_string());
    }

    let session_id = SESSION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let config = bilibili::prepare_room(requested_room_id, session_id, &account).await?;
    let info = config.connection_info();

    let (cancel, cancel_receiver) = watch::channel(false);
    {
        let mut active = state
            .active
            .lock()
            .map_err(|_| "直播连接状态锁定失败".to_string())?;
        if let Some(previous) = active.take() {
            let _ = previous.cancel.send(true);
        }
        *active = Some(ActiveConnection {
            session_id,
            room_id: config.room_id,
            cancel,
        });
    }

    emit_status(
        &app,
        LiveStatus {
            session_id,
            room_id: config.room_id,
            state: "connecting",
            message: "房间信息已确认，正在连接弹幕长链".to_string(),
            attempt: 0,
        },
    );

    tauri::async_runtime::spawn(bilibili::run_connection(app, config, cancel_receiver));

    Ok(info)
}

#[tauri::command]
pub fn disconnect_live_room(
    app: AppHandle,
    state: State<'_, LiveConnectionState>,
) -> Result<(), String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "直播连接状态锁定失败".to_string())?
        .take();

    if let Some(active) = active {
        let _ = active.cancel.send(true);
        emit_status(
            &app,
            LiveStatus {
                session_id: active.session_id,
                room_id: active.room_id,
                state: "disconnected",
                message: "已主动断开直播间".to_string(),
                attempt: 0,
            },
        );
    }

    Ok(())
}

#[tauri::command]
pub fn get_live_connection_status(
    state: State<'_, LiveConnectionState>,
) -> Result<ConnectionSnapshot, String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "直播连接状态锁定失败".to_string())?;

    Ok(ConnectionSnapshot {
        connected: active.is_some(),
        session_id: active.as_ref().map(|connection| connection.session_id),
        room_id: active.as_ref().map(|connection| connection.room_id),
    })
}

pub fn emit_status(app: &AppHandle, status: LiveStatus) {
    let _ = app.emit(LIVE_STATUS_EVENT_NAME, status);
}
