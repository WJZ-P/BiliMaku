use base64::{engine::general_purpose::STANDARD, Engine as _};
use qrcode::{render::svg, QrCode};
use reqwest::cookie::{CookieStore, Jar};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;
use tauri::State;

const BILIBILI_HOME_URL: &str = "https://www.bilibili.com/";
const NAV_URL: &str = "https://api.bilibili.com/x/web-interface/nav";
const QR_GENERATE_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate";
const QR_POLL_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll";
const USER_AGENT_VALUE: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const QR_CODE_EXPIRED: i64 = 86_038;
const QR_CODE_SCANNED: i64 = 86_090;
const QR_CODE_WAITING: i64 = 86_101;

#[derive(Clone)]
pub(crate) struct HttpSession {
    pub client: Client,
    pub jar: Arc<Jar>,
}

pub struct BiliAccountState {
    http: RwLock<HttpSession>,
    profile: Mutex<Option<AccountProfile>>,
    pending_qr_key: Mutex<Option<String>>,
}

impl Default for BiliAccountState {
    fn default() -> Self {
        Self {
            http: RwLock::new(build_http_session().expect("创建 B 站账号会话失败")),
            profile: Mutex::new(None),
            pending_qr_key: Mutex::new(None),
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

    pub(crate) fn sync_profile(
        &self,
        is_login: bool,
        uid: Option<u64>,
        username: Option<&str>,
        avatar: Option<&str>,
    ) -> Result<(), String> {
        let profile = if is_login {
            uid.filter(|uid| *uid > 0).map(|uid| AccountProfile {
                uid: uid.to_string(),
                username: username.unwrap_or("B 站用户").to_string(),
                avatar: avatar.unwrap_or_default().to_string(),
            })
        } else {
            None
        };
        *self
            .profile
            .lock()
            .map_err(|_| "账号资料状态锁定失败".to_string())? = profile;
        Ok(())
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
        Ok(session)
    }

    fn status(&self) -> Result<LoginStatus, String> {
        let profile = self
            .profile
            .lock()
            .map_err(|_| "账号资料状态锁定失败".to_string())?
            .clone();
        Ok(match profile {
            Some(profile) => LoginStatus::authenticated(profile),
            None => LoginStatus::anonymous(),
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    pub uid: String,
    pub username: String,
    pub avatar: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatus {
    pub phase: &'static str,
    pub message: String,
    pub profile: Option<AccountProfile>,
}

impl LoginStatus {
    fn anonymous() -> Self {
        Self {
            phase: "anonymous",
            message: "当前为匿名 Web 会话".to_string(),
            profile: None,
        }
    }

    fn waiting(message: impl Into<String>) -> Self {
        Self {
            phase: "waiting",
            message: message.into(),
            profile: None,
        }
    }

    fn scanned(message: impl Into<String>) -> Self {
        Self {
            phase: "scanned",
            message: message.into(),
            profile: None,
        }
    }

    fn expired(message: impl Into<String>) -> Self {
        Self {
            phase: "expired",
            message: message.into(),
            profile: None,
        }
    }

    fn authenticated(profile: AccountProfile) -> Self {
        Self {
            phase: "authenticated",
            message: format!("已登录为 {}", profile.username),
            profile: Some(profile),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrLoginTicket {
    pub image_data_url: String,
    pub expires_in_seconds: u16,
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
struct NavData {
    #[serde(rename = "isLogin", default)]
    is_login: bool,
    mid: Option<u64>,
    uname: Option<String>,
    face: Option<String>,
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

    if response.code != 0 {
        return Err(format!(
            "B 站账号资料接口返回 {}：{}",
            response.code, response.message
        ));
    }
    let Some(data) = response.data else {
        return Ok(None);
    };
    if !data.is_login {
        return Ok(None);
    }
    Ok(data.mid.filter(|uid| *uid > 0).map(|uid| AccountProfile {
        uid: uid.to_string(),
        username: data.uname.unwrap_or_else(|| "B 站用户".to_string()),
        avatar: data.face.unwrap_or_default(),
    }))
}

fn render_qr_data_url(content: &str) -> Result<String, String> {
    let code =
        QrCode::new(content.as_bytes()).map_err(|error| format!("生成登录二维码失败：{error}"))?;
    let image = code
        .render::<svg::Color>()
        .dark_color(svg::Color("#2563eb"))
        .light_color(svg::Color("#ffffff"))
        .build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(image.as_bytes())
    ))
}

#[tauri::command]
pub fn get_bilibili_login_status(
    state: State<'_, BiliAccountState>,
) -> Result<LoginStatus, String> {
    state.status()
}

#[tauri::command]
pub async fn create_bilibili_login_qr(
    state: State<'_, BiliAccountState>,
) -> Result<QrLoginTicket, String> {
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

    Ok(QrLoginTicket {
        image_data_url,
        expires_in_seconds: 180,
    })
}

#[tauri::command]
pub async fn poll_bilibili_login(
    state: State<'_, BiliAccountState>,
) -> Result<LoginStatus, String> {
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
            *state
                .profile
                .lock()
                .map_err(|_| "账号资料状态锁定失败".to_string())? = Some(profile.clone());
            state.set_pending_key(None)?;
            Ok(LoginStatus::authenticated(profile))
        }
        QR_CODE_SCANNED => Ok(LoginStatus::scanned("已扫码，请在手机上确认登录")),
        QR_CODE_WAITING => Ok(LoginStatus::waiting("请使用哔哩哔哩客户端扫码")),
        QR_CODE_EXPIRED => {
            state.set_pending_key(None)?;
            Ok(LoginStatus::expired("二维码已过期，请刷新后重试"))
        }
        code => Err(format!("B 站扫码状态 {code}：{}", data.message)),
    }
}

#[tauri::command]
pub fn logout_bilibili_account(state: State<'_, BiliAccountState>) -> Result<LoginStatus, String> {
    state.reset_http_session()?;
    Ok(LoginStatus::anonymous())
}

pub(crate) fn cookie_header(jar: &Jar) -> String {
    let Ok(url) = Url::parse(BILIBILI_HOME_URL) else {
        return String::new();
    };
    jar.cookies(&url)
        .and_then(|value| value.to_str().ok().map(str::to_owned))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_scannable_svg_data_url() {
        let data_url = render_qr_data_url("https://example.com/login?qrcode_key=test")
            .expect("render QR code");
        assert!(data_url.starts_with("data:image/svg+xml;base64,"));
        assert!(data_url.len() > 200);
    }

    #[test]
    fn default_account_state_is_anonymous() {
        let state = BiliAccountState::default();
        let status = state.status().expect("account status");
        assert_eq!(status.phase, "anonymous");
        assert!(status.profile.is_none());
    }
}
