mod bilibili;
mod protocol;
mod sender;

use crate::account::{
    apply_remote_account_validation, ensure_bilibili_session_initialized, BiliAccountState,
};
use crate::store::AppConfigStore;
use crate::types::live::{
    ConnectionSnapshot, LiveEvent, LiveOnlineRankSnapshot, LiveStatus, PopularityUpdate,
    RoomConnectionInfo,
};
use crate::types::live_chat::{SendLiveDanmakuRequest, SendLiveDanmakuResult};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;

pub const LIVE_EVENT_NAME: &str = "live://event";
pub const LIVE_STATUS_EVENT_NAME: &str = "live://status";
pub const LIVE_POPULARITY_EVENT_NAME: &str = "live://popularity";
pub const LIVE_ROOM_STATS_EVENT_NAME: &str = "live://room-stats";

static SESSION_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct LiveConnectionState {
    active: Mutex<Option<ActiveConnection>>,
}

struct ActiveConnection {
    session_id: u64,
    room: RoomConnectionInfo,
    wbi_mixin_key: String,
    cancel: watch::Sender<bool>,
}

#[derive(Clone)]
struct ActiveRoomContext {
    room_id: u64,
    owner_uid: u64,
    wbi_mixin_key: String,
}

impl LiveConnectionState {
    fn active_room_context(&self) -> Result<ActiveRoomContext, String> {
        self.active
            .lock()
            .map_err(|_| "直播连接状态锁定失败".to_string())?
            .as_ref()
            .map(|connection| ActiveRoomContext {
                room_id: connection.room.room_id,
                owner_uid: connection.room.owner_uid,
                wbi_mixin_key: connection.wbi_mixin_key.clone(),
            })
            .ok_or_else(|| "请先连接一个直播间再发送弹幕".to_string())
    }
}

#[tauri::command]
pub async fn connect_live_room(
    app: AppHandle,
    state: State<'_, LiveConnectionState>,
    account: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
    room_id: String,
) -> Result<RoomConnectionInfo, String> {
    let requested_room_id = room_id
        .trim()
        .parse::<u64>()
        .map_err(|_| "请输入正确的数字直播间 ID".to_string())?;
    if requested_room_id == 0 {
        return Err("直播间 ID 需要大于 0".to_string());
    }
    ensure_bilibili_session_initialized(&app, &account, &store).await?;

    let session_id = SESSION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let config = bilibili::prepare_room(requested_room_id, session_id, &account).await?;
    apply_remote_account_validation(&app, &account, &store, config.account_profile.clone())?;
    // 只有房间信息成功解析后才开启冷启动恢复，避免无效房间造成循环失败。
    store.set_live_connection_intent(requested_room_id.to_string(), true)?;
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
            room: info.clone(),
            wbi_mixin_key: config.wbi_mixin_key.clone(),
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

/// 使用当前扫码登录账号向已连接的直播间发送一条普通滚动弹幕。
#[tauri::command]
pub async fn send_live_danmaku(
    app: AppHandle,
    state: State<'_, LiveConnectionState>,
    account: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
    request: SendLiveDanmakuRequest,
) -> Result<SendLiveDanmakuResult, String> {
    let context = state.active_room_context()?;
    sender::send(&app, context, &account, &store, request).await
}

/// 读取当前活动直播间的在线贡献榜人数与前三名。
#[tauri::command]
pub async fn get_live_online_rank(
    state: State<'_, LiveConnectionState>,
    account: State<'_, BiliAccountState>,
) -> Result<LiveOnlineRankSnapshot, String> {
    let context = state.active_room_context()?;
    bilibili::fetch_online_rank(context.room_id, context.owner_uid, &account).await
}

#[tauri::command]
pub fn disconnect_live_room(
    app: AppHandle,
    state: State<'_, LiveConnectionState>,
    store: State<'_, AppConfigStore>,
) -> Result<(), String> {
    // 主动断开先关闭持久化连接意图；保留房间号供下次手动连接。
    store.set_live_auto_connect(false)?;
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
                room_id: active.room.room_id,
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
    store: State<'_, AppConfigStore>,
) -> Result<ConnectionSnapshot, String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "直播连接状态锁定失败".to_string())?;

    Ok(ConnectionSnapshot {
        connected: active.is_some(),
        session_id: active.as_ref().map(|connection| connection.session_id),
        room_id: active.as_ref().map(|connection| connection.room.room_id),
        room: active.as_ref().map(|connection| connection.room.clone()),
        saved_room_id: store.room_id()?,
        auto_connect: store.live_auto_connect()?,
    })
}

pub fn emit_status(app: &AppHandle, status: LiveStatus) {
    let _ = app.emit(LIVE_STATUS_EVENT_NAME, status);
}
