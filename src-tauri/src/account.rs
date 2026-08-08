use crate::store::AppConfigStore;
use crate::types::account::{AccountEvent, AccountProfile, LoginStatus, QrLoginTicket};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use qrcode::{render::svg, QrCode};
use reqwest::cookie::{CookieStore, Jar};
use reqwest::{Client, Url};
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex as AsyncMutex;

const BILIBILI_HOME_URL: &str = "https://www.bilibili.com/";
const NAV_URL: &str = "https://api.bilibili.com/x/web-interface/nav"; //  一些个人的基本信息，json格式返回
const QR_GENERATE_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"; //  拿登录链接，自己生成二维码
const QR_POLL_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll"; //  轮询查看是否登录，入参有上面接口返回的
const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const QR_CODE_EXPIRED: i64 = 86_038;
const QR_CODE_SCANNED: i64 = 86_090;
const QR_CODE_WAITING: i64 = 86_101;
const ACCOUNT_NOT_LOGGED_IN: i64 = -101;
const STARTUP_SESSION_VALIDATION_TIMEOUT: Duration = Duration::from_secs(3);

pub const ACCOUNT_EVENT_NAME: &str = "account://event";

#[derive(Clone)]
pub(crate) struct HttpSession {
    pub client: Client,
    pub jar: Arc<Jar>,
}

pub struct BiliAccountState {
    http: RwLock<HttpSession>,
    profile: Mutex<Option<AccountProfile>>,
    pending_qr_key: Mutex<Option<String>>,
    message: Mutex<String>,
    initialized: AtomicBool,
    persisted: AtomicBool,
    validated_at: AtomicU64,
    initialize_lock: AsyncMutex<()>,
}

impl Default for BiliAccountState {
    fn default() -> Self {
        Self {
            http: RwLock::new(build_http_session().expect("创建 B 站账号会话失败")),
            profile: Mutex::new(None),
            pending_qr_key: Mutex::new(None),
            message: Mutex::new("正在检查本地登录态".to_string()),
            initialized: AtomicBool::new(false),
            persisted: AtomicBool::new(false),
            validated_at: AtomicU64::new(0),
            initialize_lock: AsyncMutex::new(()),
        }
    }
}

impl BiliAccountState {
    pub(crate) fn http_session(&self) -> Result<HttpSession, String> {
        self.http
            .read()
            .map(|session| session.clone())
            .map_err(|_| "账号 HTTP 会话读取失败".to_string())
    }

    fn reset_http_session(&self) -> Result<HttpSession, String> {
        let session = build_http_session()?;
        *self
            .http
            .write()
            .map_err(|_| "账号 HTTP 会话写入失败".to_string())? = session.clone();
        *self
            .profile
            .lock()
            .map_err(|_| "账号资料状态锁定失败".to_string())? = None;
        *self
            .pending_qr_key
            .lock()
            .map_err(|_| "二维码状态锁定失败".to_string())? = None;
        self.persisted.store(false, Ordering::Release);
        self.validated_at.store(0, Ordering::Release);
        Ok(session)
    }

    fn install_http_session(&self, session: HttpSession) -> Result<(), String> {
        *self
            .http
            .write()
            .map_err(|_| "账号 HTTP 会话写入失败".to_string())? = session;
        Ok(())
    }

    fn set_message(&self, message: impl Into<String>) -> Result<(), String> {
        *self
            .message
            .lock()
            .map_err(|_| "账号消息状态锁定失败".to_string())? = message.into();
        Ok(())
    }

    fn set_profile(&self, profile: Option<AccountProfile>) -> Result<(), String> {
        *self
            .profile
            .lock()
            .map_err(|_| "账号资料状态锁定失败".to_string())? = profile;
        Ok(())
    }

    fn is_authenticated(&self) -> Result<bool, String> {
        self.profile
            .lock()
            .map(|profile| profile.is_some())
            .map_err(|_| "账号资料状态锁定失败".to_string())
    }

    /// 返回当前登录账号 UID；主播数据缓存以此隔离不同账号。
    pub(crate) fn profile_uid(&self) -> Result<Option<String>, String> {
        self.profile
            .lock()
            .map(|profile| profile.as_ref().map(|profile| profile.uid.clone()))
            .map_err(|_| "账号资料状态锁定失败".to_string())
    }

    fn mark_initialized(&self) {
        self.initialized.store(true, Ordering::Release);
    }

    fn status(&self) -> Result<LoginStatus, String> {
        if !self.initialized.load(Ordering::Acquire) {
            return Ok(LoginStatus::checking());
        }
        let profile = self
            .profile
            .lock()
            .map_err(|_| "账号资料状态锁定失败".to_string())?
            .clone();
        let message = self
            .message
            .lock()
            .map_err(|_| "账号消息状态锁定失败".to_string())?
            .clone();
        let persisted = self.persisted.load(Ordering::Acquire);
        let validated_at = match self.validated_at.load(Ordering::Acquire) {
            0 => None,
            value => Some(value),
        };
        Ok(match profile {
            Some(profile) => LoginStatus::authenticated(profile, message, persisted, validated_at),
            None => LoginStatus::anonymous_with_message(message),
        })
    }

    fn pending_key(&self) -> Result<String, String> {
        self.pending_qr_key
            .lock()
            .map_err(|_| "二维码状态锁定失败".to_string())?
            .clone()
            .ok_or_else(|| "请先生成登录二维码".to_string())
    }

    fn set_pending_key(&self, key: Option<String>) -> Result<(), String> {
        *self
            .pending_qr_key
            .lock()
            .map_err(|_| "二维码状态锁定失败".to_string())? = key;
        Ok(())
    }
}

impl LoginStatus {
    fn checking() -> Self {
        Self {
            phase: "checking",
            message: "正在检查本地登录态".to_string(),
            profile: None,
            persisted: false,
            validated_at: None,
        }
    }

    fn anonymous_with_message(message: impl Into<String>) -> Self {
        Self {
            phase: "anonymous",
            message: message.into(),
            profile: None,
            persisted: false,
            validated_at: None,
        }
    }

    fn waiting(message: impl Into<String>) -> Self {
        Self {
            phase: "waiting",
            message: message.into(),
            profile: None,
            persisted: false,
            validated_at: None,
        }
    }

    fn scanned(message: impl Into<String>) -> Self {
        Self {
            phase: "scanned",
            message: message.into(),
            profile: None,
            persisted: false,
            validated_at: None,
        }
    }

    fn expired(message: impl Into<String>) -> Self {
        Self {
            phase: "expired",
            message: message.into(),
            profile: None,
            persisted: false,
            validated_at: None,
        }
    }

    fn authenticated(
        profile: AccountProfile,
        message: impl Into<String>,
        persisted: bool,
        validated_at: Option<u64>,
    ) -> Self {
        Self {
            phase: "authenticated",
            message: message.into(),
            profile: Some(profile),
            persisted,
            validated_at,
        }
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
struct QrGenerateData {
    url: String,
    qrcode_key: String,
}

#[derive(Debug, Deserialize)]
struct QrPollData {
    code: i64,
    #[serde(default)]
    message: String,
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

fn build_http_session() -> Result<HttpSession, String> {
    let jar = Arc::new(Jar::default());
    let client = Client::builder()
        .cookie_provider(jar.clone())
        .user_agent(USER_AGENT_VALUE)
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("创建 B 站账号网络客户端失败：{error}"))?;
    Ok(HttpSession { client, jar })
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

fn write_persisted_session(
    store: &AppConfigStore,
    state: &BiliAccountState,
    profile: &AccountProfile,
) -> Result<(), String> {
    let session = state.http_session()?;
    let cookie_header = cookie_header(&session.jar);
    if cookie_header.is_empty() || !cookie_header.contains("SESSDATA=") {
        return Err("登录 Cookie 中缺少 SESSDATA，暂不写入本地会话".to_string());
    }
    store.set_account_session(cookie_header, profile.clone())?;
    state.persisted.store(true, Ordering::Release);
    Ok(())
}

fn build_http_session_with_cookies(cookie_header: &str) -> Result<HttpSession, String> {
    let session = build_http_session()?;
    let url = Url::parse(BILIBILI_HOME_URL)
        .map_err(|error| format!("解析 B 站 Cookie 域失败：{error}"))?;
    let mut restored = 0_usize;
    for pair in cookie_header.split(';').map(str::trim) {
        let Some((name, value)) = pair.split_once('=') else {
            continue;
        };
        if name.is_empty()
            || value.contains(['\r', '\n'])
            || !name.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '_' | '-')
            })
        {
            continue;
        }
        session.jar.add_cookie_str(
            &format!("{name}={value}; Domain=.bilibili.com; Path=/"),
            &url,
        );
        restored += 1;
    }
    if restored == 0 {
        return Err("本地账号会话中没有可恢复的 Cookie".to_string());
    }
    Ok(session)
}

fn emit_account_event(
    app: &AppHandle,
    kind: &'static str,
    status: LoginStatus,
) -> Result<(), String> {
    let payload = AccountEvent {
        kind,
        status,
        occurred_at: unix_timestamp(),
    };
    app.emit(ACCOUNT_EVENT_NAME, payload.clone())
        .map_err(|error| format!("广播账号事件失败：{error}"))?;
    app.emit(&format!("account://{kind}"), payload)
        .map_err(|error| format!("广播账号细分事件失败：{error}"))
}

fn set_authenticated_state(
    state: &BiliAccountState,
    profile: AccountProfile,
    message: impl Into<String>,
    persisted: bool,
    validated_at: Option<u64>,
) -> Result<LoginStatus, String> {
    state.set_profile(Some(profile))?;
    state.set_message(message)?;
    state.persisted.store(persisted, Ordering::Release);
    state
        .validated_at
        .store(validated_at.unwrap_or_default(), Ordering::Release);
    state.mark_initialized();
    state.status()
}

fn set_anonymous_state(
    state: &BiliAccountState,
    message: impl Into<String>,
) -> Result<LoginStatus, String> {
    state.set_profile(None)?;
    state.set_message(message)?;
    state.persisted.store(false, Ordering::Release);
    state.validated_at.store(0, Ordering::Release);
    state.mark_initialized();
    state.status()
}

fn expire_persisted_session(
    app: &AppHandle,
    state: &BiliAccountState,
    store: &AppConfigStore,
    message: impl Into<String>,
) -> Result<LoginStatus, String> {
    state.reset_http_session()?;
    store.clear_account_session()?;
    let status = set_anonymous_state(state, message)?;
    emit_account_event(app, "cookie-expired", status.clone())?;
    Ok(status)
}

/// 供其他需要登录态的 Rust 模块统一触发 Cookie 过期与前端账号事件。
pub(crate) fn expire_current_session(
    app: &AppHandle,
    state: &BiliAccountState,
    store: &AppConfigStore,
    message: impl Into<String>,
) -> Result<(), String> {
    expire_persisted_session(app, state, store, message).map(|_| ())
}

pub(crate) async fn ensure_bilibili_session_initialized(
    app: &AppHandle,
    state: &BiliAccountState,
    store: &AppConfigStore,
) -> Result<LoginStatus, String> {
    if state.initialized.load(Ordering::Acquire) {
        return state.status();
    }
    let _guard = state.initialize_lock.lock().await;
    if state.initialized.load(Ordering::Acquire) {
        return state.status();
    }

    let persisted = match store.account_session() {
        Ok(Some(session)) => session,
        Ok(None) => {
            return set_anonymous_state(state, "当前为匿名 Web 会话");
        }
        Err(error) => {
            let _ = store.clear_account_session();
            state.reset_http_session()?;
            let status = set_anonymous_state(
                state,
                format!("本地登录态校验失败，已切换匿名会话：{error}"),
            )?;
            emit_account_event(app, "session-error", status.clone())?;
            return Ok(status);
        }
    };
    let cached_profile = persisted
        .profile
        .clone()
        .ok_or_else(|| "统一配置中的账号资料为空".to_string())?;

    let restored_http = match build_http_session_with_cookies(&persisted.cookie_header) {
        Ok(session) => session,
        Err(error) => {
            let _ = store.clear_account_session();
            state.reset_http_session()?;
            let status = set_anonymous_state(
                state,
                format!("本地 Cookie 恢复失败，已切换匿名会话：{error}"),
            )?;
            emit_account_event(app, "session-error", status.clone())?;
            return Ok(status);
        }
    };
    state.install_http_session(restored_http.clone())?;

    let validation = match tokio::time::timeout(
        STARTUP_SESSION_VALIDATION_TIMEOUT,
        fetch_profile(&restored_http.client),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err(format!(
            "在线校验超过 {} 秒",
            STARTUP_SESSION_VALIDATION_TIMEOUT.as_secs()
        )),
    };

    match validation {
        Ok(Some(profile)) => {
            let validated_at = unix_timestamp();
            let message = format!("已恢复并验证 {} 的本地登录态", profile.username);
            let status =
                set_authenticated_state(state, profile.clone(), message, true, Some(validated_at))?;
            if let Err(error) = write_persisted_session(store, state, &profile) {
                let _ = emit_account_event(app, "session-error", status.clone());
                eprintln!("bilimaku refresh persisted account session failed: {error}");
            }
            emit_account_event(app, "restored", status.clone())?;
            Ok(status)
        }
        Ok(None) => expire_persisted_session(app, state, store, "登录 Cookie 已过期，请重新扫码"),
        Err(error) => {
            let message =
                format!("已恢复本地登录态；在线校验暂未完成，将在连接直播间时重试：{error}");
            let status = set_authenticated_state(state, cached_profile, message, true, None)?;
            emit_account_event(app, "validation-error", status.clone())?;
            Ok(status)
        }
    }
}

pub(crate) fn apply_remote_account_validation(
    app: &AppHandle,
    state: &BiliAccountState,
    store: &AppConfigStore,
    profile: Option<AccountProfile>,
) -> Result<(), String> {
    match profile {
        Some(profile) => {
            let was_pending = state.validated_at.load(Ordering::Acquire) == 0;
            let validated_at = unix_timestamp();
            let message = format!("登录态有效，当前账号为 {}", profile.username);
            let status =
                set_authenticated_state(state, profile.clone(), message, true, Some(validated_at))?;
            if let Err(error) = write_persisted_session(store, state, &profile) {
                state.set_message(format!("登录态有效，本地会话更新失败：{error}"))?;
                emit_account_event(app, "session-error", state.status()?)?;
            } else if was_pending {
                emit_account_event(app, "validated", status)?;
            }
        }
        None if state.is_authenticated()? => {
            expire_persisted_session(
                app,
                state,
                store,
                "登录 Cookie 已过期，当前连接已切换匿名模式",
            )?;
        }
        None => {}
    }
    Ok(())
}

async fn fetch_profile(client: &Client) -> Result<Option<AccountProfile>, String> {
    let response: ApiResponse<NavData> = client
        .get(NAV_URL)
        .header("Referer", BILIBILI_HOME_URL)
        .send()
        .await
        .map_err(|error| format!("校验 B 站登录态失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("校验 B 站登录态失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析 B 站账号资料失败：{error}"))?;

    if response.code == ACCOUNT_NOT_LOGGED_IN {
        return Ok(None);
    }
    if response.code != 0 {
        return Err(format!(
            "B 站账号资料接口返回 {}：{}",
            response.code, response.message
        ));
    }
    let Some(data) = response.data else {
        return Ok(None);
    };
    Ok(account_profile_from_nav(data))
}

fn account_profile_from_nav(data: NavData) -> Option<AccountProfile> {
    if !data.is_login {
        return None;
    }
    let NavLevelInfo {
        current_level,
        current_min,
        current_exp,
        next_exp,
    } = data.level_info;
    data.mid.filter(|uid| *uid > 0).map(|uid| AccountProfile {
        uid: uid.to_string(),
        username: data.uname.unwrap_or_else(|| "B 站用户".to_string()),
        avatar: data.face.unwrap_or_default(),
        level: current_level,
        current_exp,
        current_min_exp: current_min,
        next_exp: next_exp.and_then(NavNextExp::into_number),
        coins: data.money,
    })
}

fn render_qr_data_url(content: &str) -> Result<String, String> {
    let code =
        QrCode::new(content.as_bytes()).map_err(|error| format!("生成登录二维码失败：{error}"))?;
    let image = code
        .render::<svg::Color>()
        .dark_color(svg::Color("#438ff1"))
        .light_color(svg::Color("#ffffff"))
        .build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(image.as_bytes())
    ))
}

#[tauri::command]
pub async fn get_bilibili_login_status(
    app: AppHandle,
    state: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
) -> Result<LoginStatus, String> {
    ensure_bilibili_session_initialized(&app, &state, &store).await
}

#[tauri::command]
pub async fn create_bilibili_login_qr(
    app: AppHandle,
    state: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
) -> Result<QrLoginTicket, String> {
    ensure_bilibili_session_initialized(&app, &state, &store).await?;
    let session = state.reset_http_session()?;
    let response: ApiResponse<QrGenerateData> = session
        .client
        .get(QR_GENERATE_URL)
        .header("Referer", BILIBILI_HOME_URL)
        .send()
        .await
        .map_err(|error| format!("获取 B 站登录二维码失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("获取 B 站登录二维码失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析 B 站登录二维码失败：{error}"))?;

    if response.code != 0 {
        return Err(format!(
            "B 站登录二维码接口返回 {}：{}",
            response.code, response.message
        ));
    }
    let data = response
        .data
        .ok_or_else(|| "B 站登录二维码数据为空".to_string())?;
    let image_data_url = render_qr_data_url(&data.url)?;
    state.set_pending_key(Some(data.qrcode_key))?;
    state.set_message("请使用哔哩哔哩客户端扫码")?;
    emit_account_event(
        &app,
        "qr-created",
        LoginStatus::waiting("请使用哔哩哔哩客户端扫码"),
    )?;

    Ok(QrLoginTicket {
        image_data_url,
        expires_in_seconds: 180,
    })
}

#[tauri::command]
pub async fn poll_bilibili_login(
    app: AppHandle,
    state: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
) -> Result<LoginStatus, String> {
    ensure_bilibili_session_initialized(&app, &state, &store).await?;
    let key = state.pending_key()?;
    let session = state.http_session()?;
    let response: ApiResponse<QrPollData> = session
        .client
        .get(QR_POLL_URL)
        .header("Referer", BILIBILI_HOME_URL)
        .query(&[("qrcode_key", key)])
        .send()
        .await
        .map_err(|error| format!("查询 B 站扫码状态失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("查询 B 站扫码状态失败：{error}"))?
        .json()
        .await
        .map_err(|error| format!("解析 B 站扫码状态失败：{error}"))?;

    if response.code != 0 {
        return Err(format!(
            "B 站扫码状态接口返回 {}：{}",
            response.code, response.message
        ));
    }
    let data = response
        .data
        .ok_or_else(|| "B 站扫码状态数据为空".to_string())?;

    match data.code {
        0 => {
            let profile = fetch_profile(&session.client)
                .await?
                .ok_or_else(|| "扫码已确认，账号会话仍未生效，请刷新二维码重试".to_string())?;
            let validated_at = unix_timestamp();
            let message = format!("已登录为 {}，Cookie 已写入统一配置", profile.username);
            let status = set_authenticated_state(
                &state,
                profile.clone(),
                message,
                false,
                Some(validated_at),
            )?;
            state.set_pending_key(None)?;
            match write_persisted_session(&store, &state, &profile) {
                Ok(()) => {
                    let status = state.status().unwrap_or(status);
                    emit_account_event(&app, "login", status.clone())?;
                    Ok(status)
                }
                Err(error) => {
                    state.set_message(format!("已登录，本地 Cookie 保存失败：{error}"))?;
                    let status = state.status()?;
                    emit_account_event(&app, "session-error", status.clone())?;
                    Ok(status)
                }
            }
        }
        QR_CODE_SCANNED => Ok(LoginStatus::scanned("已扫码，请在手机上确认登录")),
        QR_CODE_WAITING => Ok(LoginStatus::waiting("请使用哔哩哔哩客户端扫码")),
        QR_CODE_EXPIRED => {
            state.set_pending_key(None)?;
            let status = LoginStatus::expired("二维码已过期，请刷新后重试");
            emit_account_event(&app, "qr-expired", status.clone())?;
            Ok(status)
        }
        code => Err(format!("B 站扫码状态 {code}：{}", data.message)),
    }
}

#[tauri::command]
pub async fn logout_bilibili_account(
    app: AppHandle,
    state: State<'_, BiliAccountState>,
    store: State<'_, AppConfigStore>,
) -> Result<LoginStatus, String> {
    ensure_bilibili_session_initialized(&app, &state, &store).await?;
    state.reset_http_session()?;
    store.clear_account_session()?;
    let status = set_anonymous_state(&state, "已退出账号并清理本地登录态")?;
    emit_account_event(&app, "logout", status.clone())?;
    Ok(status)
}

pub(crate) fn cookie_header(jar: &Jar) -> String {
    let Ok(url) = Url::parse(BILIBILI_HOME_URL) else {
        return String::new();
    };
    jar.cookies(&url)
        .and_then(|value| value.to_str().ok().map(str::to_owned))
        .unwrap_or_default()
}

/// 从当前哔哩哔哩 Cookie Jar 中读取单个 Cookie，避免业务模块接触完整会话文本。
pub(crate) fn cookie_value(jar: &Jar, name: &str) -> Option<String> {
    cookie_header(jar)
        .split(';')
        .filter_map(|cookie| cookie.trim().split_once('='))
        .find_map(|(key, value)| (key == name).then(|| value.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_account_level_experience_and_coins_from_nav() {
        let data: NavData = serde_json::from_str(
            r#"{
                "isLogin": true,
                "mid": 42,
                "uname": "测试用户",
                "face": "https://example.com/avatar.jpg",
                "money": 3095.7,
                "level_info": {
                    "current_level": 5,
                    "current_min": 10800,
                    "current_exp": 18800,
                    "next_exp": 28800
                }
            }"#,
        )
        .expect("deserialize nav profile");
        let profile = account_profile_from_nav(data).expect("account profile");
        assert_eq!(profile.level, 5);
        assert_eq!(profile.current_min_exp, 10_800);
        assert_eq!(profile.current_exp, 18_800);
        assert_eq!(profile.next_exp, Some(28_800));
        assert!((profile.coins - 3095.7).abs() < f64::EPSILON);
    }

    #[test]
    fn treats_max_level_text_next_exp_as_no_next_level() {
        let data: NavData = serde_json::from_str(
            r#"{
                "isLogin": true,
                "mid": 42,
                "level_info": {
                    "current_level": 6,
                    "current_min": 28800,
                    "current_exp": 47383,
                    "next_exp": "--"
                }
            }"#,
        )
        .expect("deserialize max-level nav profile");
        let profile = account_profile_from_nav(data).expect("account profile");
        assert_eq!(profile.level, 6);
        assert_eq!(profile.next_exp, None);
    }

    #[test]
    fn renders_scannable_svg_data_url() {
        let data_url = render_qr_data_url("https://example.com/login?qrcode_key=test")
            .expect("render QR code");
        assert!(data_url.starts_with("data:image/svg+xml;base64,"));
        assert!(data_url.len() > 200);
        let encoded = data_url
            .strip_prefix("data:image/svg+xml;base64,")
            .expect("SVG data URL prefix");
        let svg =
            String::from_utf8(STANDARD.decode(encoded).expect("decode SVG")).expect("UTF-8 SVG");
        assert!(svg.contains("#438ff1"));
    }

    #[test]
    fn default_account_state_starts_in_checking_phase() {
        let state = BiliAccountState::default();
        let status = state.status().expect("account status");
        assert_eq!(status.phase, "checking");
        assert!(status.profile.is_none());
    }

    #[test]
    fn restores_cookie_pairs_into_the_bilibili_domain() {
        let session = build_http_session_with_cookies(
            "SESSDATA=session-value; bili_jct=csrf-value; DedeUserID=123",
        )
        .expect("restore cookie jar");
        let header = cookie_header(&session.jar);
        assert!(header.contains("SESSDATA=session-value"));
        assert!(header.contains("bili_jct=csrf-value"));
        assert!(header.contains("DedeUserID=123"));
        assert_eq!(
            cookie_value(&session.jar, "bili_jct").as_deref(),
            Some("csrf-value")
        );
    }
}
