use futures_util::{SinkExt, StreamExt};
use md5::{Digest, Md5};
use reqwest::cookie::{CookieStore, Jar};
use reqwest::header::REFERER;
#[cfg(test)]
use reqwest::Client;
use reqwest::Url;
use serde::Deserialize;
use serde_json::json;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;
use tokio::time::{interval, sleep, timeout, MissedTickBehavior};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::{COOKIE, ORIGIN, USER_AGENT};
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

use super::protocol;
use super::{
    emit_status, LiveStatus, PopularityUpdate, RoomConnectionInfo, LIVE_EVENT_NAME,
    LIVE_POPULARITY_EVENT_NAME, LIVE_ROOM_STATS_EVENT_NAME,
};
use crate::account::{cookie_header, BiliAccountState};
use crate::types::account::AccountProfile;
use crate::types::live::{DecodedPacket, LiveOnlineRankEntry, LiveOnlineRankSnapshot};

const BILIBILI_HOME_URL: &str = "https://www.bilibili.com/";
const NAV_URL: &str = "https://api.bilibili.com/x/web-interface/nav";
const ROOM_INFO_URL: &str = "https://api.live.bilibili.com/room/v1/Room/get_info";
const ONLINE_GOLD_RANK_URL: &str =
    "https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank";
const DANMAKU_INFO_URL: &str = "https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo";
const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const WBI_KEY_INDEX_TABLE: [usize; 32] = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
    28, 14, 39, 12, 38, 41, 13,
];

pub struct RoomConfig {
    pub session_id: u64,
    pub requested_room_id: u64,
    pub room_id: u64,
    pub owner_uid: u64,
    pub title: String,
    pub live_status: u8,
    pub live_time: String,
    pub cover_url: String,
    pub account_profile: Option<AccountProfile>,
    /// 当前账号会话从导航接口取得的 WBI 混合密钥，供同一直播间内的 Web API 复用。
    pub wbi_mixin_key: String,
    auth_uid: u64,
    token: String,
    buvid: String,
    cookie_header: String,
    hosts: Vec<DanmakuHost>,
}

impl RoomConfig {
    pub fn connection_info(&self) -> RoomConnectionInfo {
        RoomConnectionInfo {
            session_id: self.session_id,
            requested_room_id: self.requested_room_id,
            room_id: self.room_id,
            owner_uid: self.owner_uid,
            title: self.title.clone(),
            live_status: self.live_status,
            live_time: self.live_time.clone(),
            cover_url: self.cover_url.clone(),
            access_mode: if self.auth_uid > 0 {
                "web-authenticated"
            } else {
                "web-anonymous"
            },
            viewer_uid: (self.auth_uid > 0).then_some(self.auth_uid),
        }
    }

    fn websocket_url(&self, attempt: usize) -> String {
        let host = &self.hosts[attempt % self.hosts.len()];
        format!("wss://{}:{}/sub", host.host, host.wss_port)
    }
}

#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    code: i64,
    #[serde(default)]
    message: String,
    data: Option<T>,
}

#[derive(Debug, Deserialize)]
struct RoomInfoData {
    room_id: u64,
    uid: u64,
    #[serde(default)]
    title: String,
    #[serde(default)]
    live_status: u8,
    #[serde(default)]
    live_time: String,
    #[serde(default)]
    cover: Option<String>,
    #[serde(default)]
    user_cover: Option<String>,
    #[serde(default)]
    keyframe: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OnlineRankData {
    #[serde(rename = "onlineNum", default)]
    online_num: u64,
    #[serde(rename = "OnlineRankItem", default)]
    items: Vec<OnlineRankItem>,
    #[serde(rename = "onlineNumText", default)]
    online_num_text: String,
    #[serde(default)]
    tips_text: String,
    #[serde(default)]
    value_text: String,
}

#[derive(Debug, Deserialize)]
struct OnlineRankItem {
    #[serde(rename = "userRank", default)]
    rank: u32,
    #[serde(default)]
    uid: u64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    face: String,
    #[serde(default)]
    score: u64,
    #[serde(default)]
    guard_level: u8,
    #[serde(default)]
    wealth_level: u16,
    #[serde(rename = "is_mystery", default)]
    mystery: bool,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum NavNextExp {
    Number(u64),
    Text(String),
}

impl NavNextExp {
    fn into_number(self) -> Option<u64> {
        match self {
            Self::Number(value) => Some(value),
            Self::Text(value) => value.parse().ok(),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
struct NavLevelInfo {
    #[serde(default)]
    current_level: u8,
    #[serde(default)]
    current_min: u64,
    #[serde(default)]
    current_exp: u64,
    next_exp: Option<NavNextExp>,
}

#[derive(Debug, Deserialize)]
struct NavData {
    wbi_img: WbiImage,
    #[serde(rename = "isLogin", default)]
    is_login: bool,
    mid: Option<u64>,
    uname: Option<String>,
    face: Option<String>,
    #[serde(default)]
    level_info: NavLevelInfo,
    #[serde(default)]
    money: f64,
}

#[derive(Debug, Deserialize)]
struct WbiImage {
    img_url: String,
    sub_url: String,
}

#[derive(Debug, Deserialize)]
struct DanmakuInfoData {
    token: String,
    host_list: Vec<DanmakuHost>,
}

#[derive(Clone, Debug, Deserialize)]
struct DanmakuHost {
    host: String,
    wss_port: u16,
}

enum SessionEnd {
    Cancelled,
    Retry(String),
}

/// 选择最适合顶部 UI 的房间封面，并统一升级为 HTTPS。
fn preferred_room_cover(room: &RoomInfoData) -> String {
    [
        room.user_cover.as_deref(),
        room.cover.as_deref(),
        room.keyframe.as_deref(),
    ]
    .into_iter()
    .flatten()
    .find_map(|candidate| {
        let candidate = candidate.trim();
        if candidate.is_empty() {
            None
        } else if let Some(path) = candidate.strip_prefix("//") {
            Some(format!("https://{path}"))
        } else if let Some(path) = candidate.strip_prefix("http://") {
            Some(format!("https://{path}"))
        } else if candidate.starts_with("https://") {
            Some(candidate.to_string())
        } else {
            None
        }
    })
    .unwrap_or_default()
}
pub async fn prepare_room(
    requested_room_id: u64,
    session_id: u64,
    account: &BiliAccountState,
) -> Result<RoomConfig, String> {
    let http = account.http_session()?;
    let client = &http.client;
    let cookie_jar = http.jar;

    // 访问主页用于获得匿名 buvid Cookie。即使此请求短暂失败，后续房间
    // 信息和 WBI 初始化仍可继续，并在长链认证时使用空 buvid 降级。
    let _ = client.get(BILIBILI_HOME_URL).send().await;

    let room_response: ApiResponse<RoomInfoData> = client
        .get(ROOM_INFO_URL)
        .query(&[("room_id", requested_room_id)])
        .send()
        .await
        .map_err(|error| format!("获取直播间信息失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("获取直播间信息失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析直播间信息失败：{error}"))?;

    if room_response.code != 0 {
        return Err(format!(
            "直播间信息接口返回 {}：{}",
            room_response.code, room_response.message
        ));
    }
    let room = room_response
        .data
        .ok_or_else(|| "直播间信息为空，请检查房间号".to_string())?;

    let cover_url = preferred_room_cover(&room);

    let nav_response: ApiResponse<NavData> = client
        .get(NAV_URL)
        .send()
        .await
        .map_err(|error| format!("初始化 WBI 鉴权失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("初始化 WBI 鉴权失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析 WBI 鉴权信息失败：{error}"))?;
    let nav_data = nav_response
        .data
        .ok_or_else(|| "WBI 鉴权信息为空".to_string())?;
    let auth_uid = if nav_data.is_login {
        nav_data.mid.unwrap_or_default()
    } else {
        0
    };
    let account_profile = (auth_uid > 0).then(|| AccountProfile {
        uid: auth_uid.to_string(),
        username: nav_data
            .uname
            .clone()
            .unwrap_or_else(|| "B 站用户".to_string()),
        avatar: nav_data.face.clone().unwrap_or_default(),
        level: nav_data.level_info.current_level,
        current_exp: nav_data.level_info.current_exp,
        current_min_exp: nav_data.level_info.current_min,
        next_exp: nav_data
            .level_info
            .next_exp
            .and_then(NavNextExp::into_number),
        coins: nav_data.money,
    });
    let mixin_key = make_mixin_key(&nav_data.wbi_img)?;
    let signed_url = make_signed_danmaku_url(room.room_id, &mixin_key)?;

    let danmaku_response: ApiResponse<DanmakuInfoData> = client
        .get(signed_url)
        .send()
        .await
        .map_err(|error| format!("获取弹幕服务器失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("获取弹幕服务器失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析弹幕服务器信息失败：{error}"))?;

    if danmaku_response.code != 0 {
        return Err(format!(
            "弹幕服务器接口返回 {}：{}",
            danmaku_response.code, danmaku_response.message
        ));
    }
    let danmaku = danmaku_response
        .data
        .ok_or_else(|| "弹幕服务器信息为空".to_string())?;
    if danmaku.host_list.is_empty() || danmaku.token.is_empty() {
        return Err("弹幕服务器未返回可用地址或令牌".to_string());
    }

    Ok(RoomConfig {
        session_id,
        requested_room_id,
        room_id: room.room_id,
        owner_uid: room.uid,
        title: room.title,
        live_status: room.live_status,
        live_time: room.live_time,
        cover_url,
        account_profile,
        wbi_mixin_key: mixin_key,
        auth_uid,
        token: danmaku.token,
        buvid: cookie_value(&cookie_jar, "buvid3"),
        cookie_header: if auth_uid > 0 {
            cookie_header(&cookie_jar)
        } else {
            String::new()
        },
        hosts: danmaku.host_list,
    })
}

fn map_online_rank(room_id: u64, data: OnlineRankData) -> LiveOnlineRankSnapshot {
    LiveOnlineRankSnapshot {
        room_id,
        online_count: data.online_num,
        online_count_text: if data.online_num_text.trim().is_empty() {
            data.online_num.to_string()
        } else {
            data.online_num_text
        },
        entries: data
            .items
            .into_iter()
            .take(3)
            .map(|item| LiveOnlineRankEntry {
                rank: item.rank,
                user_id: item.uid.to_string(),
                name: item.name,
                avatar: item.face,
                score: item.score,
                guard_level: item.guard_level,
                wealth_level: item.wealth_level,
                mystery: item.mystery,
            })
            .collect(),
        tips_text: data.tips_text,
        value_text: data.value_text,
    }
}

/// 读取 Web 直播间使用的在线贡献榜；该接口无需中心服务器，可复用当前账号 HTTP 会话。
pub async fn fetch_online_rank(
    room_id: u64,
    owner_uid: u64,
    account: &BiliAccountState,
) -> Result<LiveOnlineRankSnapshot, String> {
    let http = account.http_session()?;
    let response: ApiResponse<OnlineRankData> = http
        .client
        .get(ONLINE_GOLD_RANK_URL)
        .header(REFERER, format!("https://live.bilibili.com/{room_id}"))
        .query(&[
            ("roomId", room_id.to_string()),
            ("ruid", owner_uid.to_string()),
            ("page", "1".to_string()),
            ("pageSize", "3".to_string()),
        ])
        .send()
        .await
        .map_err(|error| format!("读取直播间在线贡献榜失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("读取直播间在线贡献榜失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析直播间在线贡献榜失败：{error}"))?;
    if response.code != 0 {
        return Err(format!(
            "在线贡献榜接口返回 {}：{}",
            response.code, response.message
        ));
    }
    response
        .data
        .map(|data| map_online_rank(room_id, data))
        .ok_or_else(|| "在线贡献榜接口没有返回数据".to_string())
}

pub async fn run_connection(app: AppHandle, config: RoomConfig, mut cancel: watch::Receiver<bool>) {
    let mut attempt = 0_u32;

    loop {
        if *cancel.borrow() {
            return;
        }

        if attempt > 0 {
            emit_status(
                &app,
                LiveStatus {
                    session_id: config.session_id,
                    room_id: config.room_id,
                    state: "reconnecting",
                    message: format!("正在第 {attempt} 次重连弹幕服务器"),
                    attempt,
                },
            );
        }

        match run_socket_session(&app, &config, attempt as usize, &mut cancel).await {
            SessionEnd::Cancelled => return,
            SessionEnd::Retry(reason) => {
                if *cancel.borrow() {
                    return;
                }
                attempt = attempt.saturating_add(1);
                emit_status(
                    &app,
                    LiveStatus {
                        session_id: config.session_id,
                        room_id: config.room_id,
                        state: "reconnecting",
                        message: reason,
                        attempt,
                    },
                );

                let delay = Duration::from_secs(u64::from(attempt.min(5)) * 2);
                tokio::select! {
                    _ = sleep(delay) => {}
                    changed = cancel.changed() => {
                        if changed.is_err() || *cancel.borrow() {
                            return;
                        }
                    }
                }
            }
        }
    }
}

async fn run_socket_session(
    app: &AppHandle,
    config: &RoomConfig,
    attempt: usize,
    cancel: &mut watch::Receiver<bool>,
) -> SessionEnd {
    let mut socket = match open_socket(config, attempt).await {
        Ok(socket) => socket,
        Err(error) => return SessionEnd::Retry(error),
    };

    let auth_body = json!({
        "uid": config.auth_uid,
        "roomid": config.room_id,
        "protover": 3,
        "platform": "web",
        "type": 2,
        "buvid": config.buvid,
        "key": config.token,
    });
    let auth_packet = protocol::make_packet(auth_body.to_string().as_bytes(), 7);
    if let Err(error) = socket.send(Message::Binary(auth_packet.into())).await {
        return SessionEnd::Retry(format!("发送弹幕长链认证失败：{error}"));
    }

    let mut authenticated = false;
    let auth_timeout = sleep(Duration::from_secs(10));
    tokio::pin!(auth_timeout);
    let mut heartbeat = interval(Duration::from_secs(30));
    heartbeat.set_missed_tick_behavior(MissedTickBehavior::Delay);
    heartbeat.tick().await;

    loop {
        tokio::select! {
            changed = cancel.changed() => {
                if changed.is_err() || *cancel.borrow() {
                    let _ = socket.close(None).await;
                    return SessionEnd::Cancelled;
                }
            }
            _ = &mut auth_timeout, if !authenticated => {
                return SessionEnd::Retry("弹幕服务器认证超时".to_string());
            }
            _ = heartbeat.tick(), if authenticated => {
                let heartbeat_packet = protocol::make_packet(b"{}", 2);
                if let Err(error) = socket.send(Message::Binary(heartbeat_packet.into())).await {
                    return SessionEnd::Retry(format!("发送弹幕心跳失败：{error}"));
                }
            }
            incoming = socket.next() => {
                let Some(incoming) = incoming else {
                    return SessionEnd::Retry("弹幕服务器已关闭连接".to_string());
                };

                match incoming {
                    Ok(Message::Binary(data)) => {
                        let packets = match protocol::decode_packet_stream(&data) {
                            Ok(packets) => packets,
                            Err(error) => {
                                eprintln!("bilimaku packet decode warning: {error}");
                                continue;
                            }
                        };

                        for packet in packets {
                            match packet {
                                DecodedPacket::Auth(0) if !authenticated => {
                                    authenticated = true;
                                    emit_status(
                                        app,
                                        LiveStatus {
                                            session_id: config.session_id,
                                            room_id: config.room_id,
                                            state: "connected",
                                            message: if config.auth_uid > 0 {
                                                format!("登录态弹幕长链认证成功 · UID {}", config.auth_uid)
                                            } else {
                                                "匿名弹幕长链认证成功".to_string()
                                            },
                                            attempt: attempt as u32,
                                        },
                                    );
                                    let heartbeat_packet = protocol::make_packet(b"{}", 2);
                                    if let Err(error) = socket.send(Message::Binary(heartbeat_packet.into())).await {
                                        return SessionEnd::Retry(format!("发送首次心跳失败：{error}"));
                                    }
                                }
                                DecodedPacket::Auth(code) => {
                                    return SessionEnd::Retry(format!("弹幕长链认证失败，错误码 {code}"));
                                }
                                DecodedPacket::Popularity(popularity) => {
                                    let _ = app.emit(
                                        LIVE_POPULARITY_EVENT_NAME,
                                        PopularityUpdate {
                                            session_id: config.session_id,
                                            room_id: config.room_id,
                                            popularity,
                                        },
                                    );
                                }
                                DecodedPacket::Command(command) => {
                                    if let Some(update) = protocol::normalize_room_stats_update(
                                        config.session_id,
                                        config.room_id,
                                        &command,
                                    ) {
                                        let _ = app.emit(LIVE_ROOM_STATS_EVENT_NAME, update);
                                    }
                                    if let Some(event) = protocol::normalize_command(
                                        config.session_id,
                                        config.room_id,
                                        command,
                                    ) {
                                        let _ = app.emit(LIVE_EVENT_NAME, event);
                                    }
                                }
                            }
                        }
                    }
                    Ok(Message::Ping(payload)) => {
                        if let Err(error) = socket.send(Message::Pong(payload)).await {
                            return SessionEnd::Retry(format!("回复 WebSocket Ping 失败：{error}"));
                        }
                    }
                    Ok(Message::Close(frame)) => {
                        let reason = frame
                            .map(|frame| frame.reason.to_string())
                            .filter(|reason| !reason.is_empty())
                            .unwrap_or_else(|| "无关闭原因".to_string());
                        return SessionEnd::Retry(format!("弹幕长链已关闭：{reason}"));
                    }
                    Ok(_) => {}
                    Err(error) => {
                        return SessionEnd::Retry(format!("读取弹幕长链失败：{error}"));
                    }
                }
            }
        }
    }
}

async fn open_socket(
    config: &RoomConfig,
    attempt: usize,
) -> Result<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    String,
> {
    let websocket_url = config.websocket_url(attempt);
    let mut request = websocket_url
        .into_client_request()
        .map_err(|error| format!("创建弹幕 WebSocket 请求失败：{error}"))?;
    request
        .headers_mut()
        .insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    request.headers_mut().insert(
        ORIGIN,
        HeaderValue::from_static("https://live.bilibili.com"),
    );
    if !config.cookie_header.is_empty() {
        let cookie = HeaderValue::from_str(&config.cookie_header)
            .map_err(|error| format!("创建弹幕 Cookie 请求头失败：{error}"))?;
        request.headers_mut().insert(COOKIE, cookie);
    }

    let (socket, _) = timeout(Duration::from_secs(12), connect_async(request))
        .await
        .map_err(|_| "连接弹幕服务器超时".to_string())?
        .map_err(|error| format!("连接弹幕服务器失败：{error}"))?;
    Ok(socket)
}

fn make_mixin_key(wbi: &WbiImage) -> Result<String, String> {
    let img_key = extract_wbi_filename(&wbi.img_url)?;
    let sub_key = extract_wbi_filename(&wbi.sub_url)?;
    let shuffled = format!("{img_key}{sub_key}");
    let bytes = shuffled.as_bytes();
    let mixed: Vec<u8> = WBI_KEY_INDEX_TABLE
        .iter()
        .filter_map(|index| bytes.get(*index).copied())
        .take(32)
        .collect();
    String::from_utf8(mixed).map_err(|error| format!("生成 WBI 混合密钥失败：{error}"))
}

fn extract_wbi_filename(url: &str) -> Result<String, String> {
    let filename = url
        .rsplit('/')
        .next()
        .and_then(|name| name.split('.').next())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "WBI 图片密钥格式异常".to_string())?;
    Ok(filename.to_string())
}

fn make_signed_danmaku_url(room_id: u64, mixin_key: &str) -> Result<Url, String> {
    make_signed_live_api_url(
        DANMAKU_INFO_URL,
        vec![
            ("id".to_string(), room_id.to_string()),
            ("type".to_string(), "0".to_string()),
        ],
        mixin_key,
    )
}

/// 使用连接直播间时取得的 WBI 混合密钥签名一个直播 Web API 地址。
///
/// 参数会按键名排序、过滤 WBI 不参与签名的特殊字符并进行 URL 编码；发送弹幕和
/// 获取长链令牌因此可以复用同一套平台签名逻辑。
pub(super) fn make_signed_live_api_url(
    base_url: &str,
    mut parameters: Vec<(String, String)>,
    mixin_key: &str,
) -> Result<Url, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("系统时间异常：{error}"))?
        .as_secs();
    parameters.push(("wts".to_string(), timestamp.to_string()));
    for (_, value) in &mut parameters {
        value.retain(|character| !matches!(character, '!' | '\'' | '(' | ')' | '*'));
    }
    parameters.sort_by(|left, right| left.0.cmp(&right.0));

    let mut query_encoder = Url::parse("https://bilimaku.invalid/")
        .map_err(|error| format!("创建 WBI 参数编码器失败：{error}"))?;
    {
        let mut query = query_encoder.query_pairs_mut();
        for (key, value) in &parameters {
            query.append_pair(key, value);
        }
    }
    let query_to_sign = query_encoder.query().unwrap_or_default();
    let mut hasher = Md5::new();
    hasher.update(format!("{query_to_sign}{mixin_key}").as_bytes());
    let signature = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();

    let mut url =
        Url::parse(base_url).map_err(|error| format!("直播 API 地址格式异常：{error}"))?;
    {
        let mut query = url.query_pairs_mut();
        for (key, value) in &parameters {
            query.append_pair(key, value);
        }
        query.append_pair("w_rid", &signature);
    }
    Ok(url)
}

fn cookie_value(jar: &Jar, name: &str) -> String {
    let Ok(url) = Url::parse(BILIBILI_HOME_URL) else {
        return String::new();
    };
    let Some(header) = jar.cookies(&url) else {
        return String::new();
    };
    let Ok(cookies) = header.to_str() else {
        return String::new();
    };

    cookies
        .split(';')
        .filter_map(|cookie| cookie.trim().split_once('='))
        .find_map(|(key, value)| (key == name).then(|| value.to_string()))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_online_rank_to_stable_top_three_types() {
        let response: ApiResponse<OnlineRankData> = serde_json::from_value(json!({
            "code": 0,
            "message": "OK",
            "data": {
                "onlineNum": 5,
                "onlineNumText": "5",
                "tips_text": "投喂、点赞、发弹幕均可上榜",
                "value_text": "贡献值",
                "OnlineRankItem": [
                    {"userRank": 1, "uid": 11, "name": "榜一", "face": "https://example.com/1.png", "score": 99, "guard_level": 3, "wealth_level": 12, "is_mystery": false},
                    {"userRank": 2, "uid": 22, "name": "榜二", "face": "", "score": 88, "guard_level": 0, "wealth_level": 8, "is_mystery": false},
                    {"userRank": 3, "uid": 33, "name": "榜三", "face": "", "score": 77, "guard_level": 0, "wealth_level": 5, "is_mystery": true},
                    {"userRank": 4, "uid": 44, "name": "榜四", "face": "", "score": 66, "guard_level": 0, "wealth_level": 1, "is_mystery": false}
                ]
            }
        }))
        .expect("deserialize rank response");
        let snapshot = map_online_rank(4457340, response.data.expect("rank data"));
        assert_eq!(snapshot.room_id, 4457340);
        assert_eq!(snapshot.online_count, 5);
        assert_eq!(snapshot.entries.len(), 3);
        assert_eq!(snapshot.entries[0].user_id, "11");
        assert_eq!(snapshot.entries[2].name, "榜三");
        assert!(snapshot.entries[2].mystery);
    }

    #[test]
    fn prefers_configured_room_cover_and_falls_back_to_keyframe() {
        let configured = RoomInfoData {
            room_id: 1,
            uid: 2,
            title: "测试直播间".to_string(),
            live_status: 1,
            live_time: "2026-08-08 20:00:00".to_string(),
            cover: Some("https://example.com/cover.jpg".to_string()),
            user_cover: Some("http://example.com/user-cover.jpg".to_string()),
            keyframe: Some("https://example.com/keyframe.jpg".to_string()),
        };
        assert_eq!(
            preferred_room_cover(&configured),
            "https://example.com/user-cover.jpg"
        );

        let keyframe_only = RoomInfoData {
            user_cover: None,
            cover: Some(String::new()),
            keyframe: Some("//example.com/keyframe.jpg".to_string()),
            ..configured
        };
        assert_eq!(
            preferred_room_cover(&keyframe_only),
            "https://example.com/keyframe.jpg"
        );
    }
    #[test]
    fn creates_32_character_mixin_key() {
        let wbi = WbiImage {
            img_url: "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png"
                .to_string(),
            sub_url: "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png"
                .to_string(),
        };
        assert_eq!(make_mixin_key(&wbi).expect("mixin key").len(), 32);
    }

    #[test]
    fn signs_live_api_parameters_in_stable_order() {
        let url = make_signed_live_api_url(
            "https://api.live.bilibili.com/msg/send",
            vec![("web_location".to_string(), "444.8".to_string())],
            "ea1db124af3c7062474693fa704f4ff8",
        )
        .expect("signed live URL");
        let query = url.query().expect("signed query");
        assert!(query.starts_with("web_location=444.8&wts="));
        assert!(query.contains("&w_rid="));
        assert_eq!(
            url.query_pairs()
                .find(|(key, _)| key == "w_rid")
                .map(|(_, value)| value.len()),
            Some(32)
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    #[ignore = "requires a live network connection"]
    async fn authenticates_real_room() {
        let room_id = std::env::var("BILIMAKU_TEST_ROOM")
            .or_else(|_| std::env::var("BILICAST_TEST_ROOM"))
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(1732562239);
        let account = BiliAccountState::default();
        let config = prepare_room(room_id, 1, &account)
            .await
            .expect("prepare room");
        let mut socket = open_socket(&config, 0).await.expect("open websocket");
        let auth_body = json!({
            "uid": config.auth_uid,
            "roomid": config.room_id,
            "protover": 3,
            "platform": "web",
            "type": 2,
            "buvid": config.buvid,
            "key": config.token,
        });
        socket
            .send(Message::Binary(
                protocol::make_packet(auth_body.to_string().as_bytes(), 7).into(),
            ))
            .await
            .expect("send auth");

        let authenticated = timeout(Duration::from_secs(15), async {
            while let Some(message) = socket.next().await {
                let Message::Binary(data) = message.expect("websocket message") else {
                    continue;
                };
                for packet in protocol::decode_packet_stream(&data).expect("decode packet") {
                    if matches!(packet, DecodedPacket::Auth(0)) {
                        return true;
                    }
                }
            }
            false
        })
        .await
        .expect("auth timeout");

        assert!(authenticated, "Bilibili websocket authentication failed");

        socket
            .send(Message::Binary(protocol::make_packet(b"{}", 2).into()))
            .await
            .expect("send heartbeat");
        let popularity = timeout(Duration::from_secs(15), async {
            while let Some(message) = socket.next().await {
                let Message::Binary(data) = message.expect("websocket message") else {
                    continue;
                };
                for packet in protocol::decode_packet_stream(&data).expect("decode packet") {
                    if let DecodedPacket::Popularity(value) = packet {
                        return Some(value);
                    }
                }
            }
            None
        })
        .await
        .expect("heartbeat timeout");

        assert!(popularity.is_some(), "Bilibili heartbeat reply was missing");
    }

    #[tokio::test(flavor = "multi_thread")]
    #[ignore = "requires a live room with incoming danmaku"]
    async fn inspects_real_danmaku_avatar() {
        let room_id = std::env::var("BILIMAKU_TEST_ROOM")
            .or_else(|_| std::env::var("BILICAST_TEST_ROOM"))
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(1732562239);
        let account = BiliAccountState::default();
        let config = prepare_room(room_id, 2, &account)
            .await
            .expect("prepare room");
        eprintln!(
            "inspecting requested_room={} real_room={} live_status={} title={}",
            room_id, config.room_id, config.live_status, config.title
        );

        let mut socket = open_socket(&config, 0).await.expect("open websocket");
        let auth_body = json!({
            "uid": config.auth_uid,
            "roomid": config.room_id,
            "protover": 3,
            "platform": "web",
            "type": 2,
            "buvid": config.buvid,
            "key": config.token,
        });
        socket
            .send(Message::Binary(
                protocol::make_packet(auth_body.to_string().as_bytes(), 7).into(),
            ))
            .await
            .expect("send auth");

        let command = timeout(Duration::from_secs(45), async {
            while let Some(message) = socket.next().await {
                let Message::Binary(data) = message.expect("websocket message") else {
                    continue;
                };
                for packet in protocol::decode_packet_stream(&data).expect("decode packet") {
                    match packet {
                        DecodedPacket::Auth(0) => {
                            socket
                                .send(Message::Binary(protocol::make_packet(b"{}", 2).into()))
                                .await
                                .expect("send heartbeat");
                        }
                        DecodedPacket::Command(command)
                            if command
                                .get("cmd")
                                .and_then(serde_json::Value::as_str)
                                .is_some_and(|name| name.starts_with("DANMU_MSG")) =>
                        {
                            return Some(command);
                        }
                        _ => {}
                    }
                }
            }
            None
        })
        .await
        .expect("danmaku timeout")
        .expect("room produced no danmaku");

        let mode_info = command
            .pointer("/info/0/15")
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let normalized = protocol::normalize_command(2, config.room_id, command.clone())
            .expect("normalize danmaku");
        let avatar_url = normalized.avatar.clone();
        eprintln!(
            "mode_info={}\nnormalized_avatar={:?}\ncommand={}",
            serde_json::to_string_pretty(&mode_info).expect("format mode info"),
            avatar_url,
            serde_json::to_string_pretty(&command).expect("format command")
        );

        let client = Client::builder()
            .user_agent(USER_AGENT_VALUE)
            .build()
            .expect("avatar client");
        for referer in [
            None,
            Some("http://tauri.localhost/"),
            Some("https://live.bilibili.com/"),
        ] {
            let mut request = client.get(&avatar_url);
            if let Some(referer) = referer {
                request = request.header("Referer", referer);
            }
            let response = request.send().await.expect("fetch avatar");
            let status = response.status();
            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("")
                .to_string();
            let length = response.bytes().await.expect("read avatar").len();
            eprintln!(
                "avatar_fetch referer={referer:?} status={status} content_type={content_type} bytes={length}"
            );
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    #[ignore = "requires a live room with incoming interaction events"]
    async fn inspects_real_interaction_commands() {
        let room_id = std::env::var("BILIMAKU_TEST_ROOM")
            .or_else(|_| std::env::var("BILICAST_TEST_ROOM"))
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(1732562239);
        let account = BiliAccountState::default();
        let config = prepare_room(room_id, 3, &account)
            .await
            .expect("prepare room");
        let mut socket = open_socket(&config, 0).await.expect("open websocket");
        let auth_body = json!({
            "uid": config.auth_uid,
            "roomid": config.room_id,
            "protover": 3,
            "platform": "web",
            "type": 2,
            "buvid": config.buvid,
            "key": config.token,
        });
        socket
            .send(Message::Binary(
                protocol::make_packet(auth_body.to_string().as_bytes(), 7).into(),
            ))
            .await
            .expect("send auth");

        let interaction = timeout(Duration::from_secs(35), async {
            while let Some(message) = socket.next().await {
                let Message::Binary(data) = message.expect("websocket message") else {
                    continue;
                };
                for packet in protocol::decode_packet_stream(&data).expect("decode packet") {
                    match packet {
                        DecodedPacket::Auth(0) => {
                            socket
                                .send(Message::Binary(protocol::make_packet(b"{}", 2).into()))
                                .await
                                .expect("send heartbeat");
                        }
                        DecodedPacket::Command(command) => {
                            let name = command
                                .get("cmd")
                                .and_then(serde_json::Value::as_str)
                                .unwrap_or_default();
                            if name.contains("INTERACT") || name.contains("ENTRY_EFFECT") {
                                return Some(command);
                            }
                        }
                        _ => {}
                    }
                }
            }
            None
        })
        .await
        .expect("interaction timeout")
        .expect("room produced no interaction event");

        eprintln!(
            "interaction_command={}",
            serde_json::to_string_pretty(&interaction).expect("format interaction")
        );
        let normalized = protocol::normalize_command(3, config.room_id, interaction)
            .expect("normalize live interaction");
        eprintln!(
            "normalized_interaction type={} user={:?} content={} avatar={:?}",
            normalized.event_type, normalized.user, normalized.content, normalized.avatar
        );
        assert_eq!(normalized.event_type, "interaction");
    }
}
