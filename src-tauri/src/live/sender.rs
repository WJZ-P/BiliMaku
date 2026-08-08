use super::bilibili::make_signed_live_api_url;
use super::ActiveRoomContext;
use crate::account::{
    cookie_value, ensure_bilibili_session_initialized, expire_current_session, BiliAccountState,
};
use crate::store::AppConfigStore;
use crate::types::live_chat::{
    SendLiveDanmakuRequest, SendLiveDanmakuResult, LIVE_DANMAKU_MAX_CHARS,
};
use reqwest::header::{ACCEPT, ORIGIN, REFERER};
use reqwest::multipart::Form;
use serde::Deserialize;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const SEND_DANMAKU_URL: &str = "https://api.live.bilibili.com/msg/send";
const LIVE_ORIGIN: &str = "https://live.bilibili.com";
const LIVE_WEB_LOCATION: &str = "444.8";
const ACCOUNT_NOT_LOGGED_IN: i64 = -101;

#[derive(Debug, Deserialize)]
struct SendDanmakuApiResponse {
    code: i64,
    #[serde(default)]
    message: Value,
    #[serde(default)]
    msg: Value,
}

impl SendDanmakuApiResponse {
    fn readable_message(&self) -> String {
        readable_api_value(&self.message)
            .or_else(|| readable_api_value(&self.msg))
            .filter(|message| !message.is_empty())
            .unwrap_or_else(|| "平台未返回错误说明".to_string())
    }
}

fn readable_api_value(value: &Value) -> Option<String> {
    match value {
        Value::String(message) => Some(message.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn unix_timestamp() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| format!("系统时间异常：{error}"))
}

fn normalize_message(message: String) -> Result<String, String> {
    let message = message.trim().to_string();
    let length = message.chars().count();
    if length == 0 {
        return Err("请输入要发送的弹幕".to_string());
    }
    if length > LIVE_DANMAKU_MAX_CHARS {
        return Err(format!(
            "弹幕最多输入 {LIVE_DANMAKU_MAX_CHARS} 个字符，当前为 {length} 个"
        ));
    }
    Ok(message)
}

fn response_excerpt(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .chars()
        .filter(|character| !character.is_control() || character.is_whitespace())
        .take(180)
        .collect::<String>()
        .trim()
        .to_string()
}

pub(super) async fn send(
    app: &AppHandle,
    context: ActiveRoomContext,
    account: &BiliAccountState,
    store: &AppConfigStore,
    request: SendLiveDanmakuRequest,
) -> Result<SendLiveDanmakuResult, String> {
    let message = normalize_message(request.message)?;
    let login = ensure_bilibili_session_initialized(app, account, store).await?;
    if login.profile.is_none() {
        return Err("发送弹幕需要先完成扫码登录".to_string());
    }

    let session = account.http_session()?;
    let csrf = cookie_value(&session.jar, "bili_jct")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "当前登录 Cookie 缺少 bili_jct，需重新扫码刷新会话".to_string())?;
    let sent_at = unix_timestamp()?;
    let signed_url = make_signed_live_api_url(
        SEND_DANMAKU_URL,
        vec![("web_location".to_string(), LIVE_WEB_LOCATION.to_string())],
        &context.wbi_mixin_key,
    )?;
    let referer = format!("{LIVE_ORIGIN}/{}", context.room_id);
    let form = Form::new()
        .text("bubble", "0")
        .text("msg", message.clone())
        .text("color", "16777215")
        .text("mode", "1")
        .text("room_type", "0")
        .text("jumpfrom", "0")
        .text("reply_mid", "0")
        .text("reply_attr", "0")
        .text("replay_dmid", "")
        .text("reply_type", "0")
        .text("reply_uname", "")
        .text("statistics", r#"{"appId":100,"platform":5}"#)
        .text("data_extend", "{}")
        .text("fontsize", "25")
        .text("rnd", sent_at.to_string())
        .text("roomid", context.room_id.to_string())
        .text("csrf", csrf.clone())
        .text("csrf_token", csrf);

    let response = session
        .client
        .post(signed_url)
        .header(ACCEPT, "application/json, text/plain, */*")
        .header(ORIGIN, LIVE_ORIGIN)
        .header(REFERER, referer)
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("发送直播弹幕失败：{error}"))?;
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| format!("读取直播弹幕响应失败：{error}"))?;
    if !status.is_success() {
        let excerpt = response_excerpt(&body);
        return Err(if excerpt.is_empty() {
            format!("发送直播弹幕失败：HTTP {status}")
        } else {
            format!("发送直播弹幕失败：HTTP {status} · {excerpt}")
        });
    }

    let payload: SendDanmakuApiResponse = serde_json::from_slice(&body).map_err(|error| {
        let excerpt = response_excerpt(&body);
        if excerpt.is_empty() {
            format!("解析直播弹幕响应失败：{error}")
        } else {
            format!("解析直播弹幕响应失败：{error} · {excerpt}")
        }
    })?;
    if payload.code == ACCOUNT_NOT_LOGGED_IN {
        expire_current_session(app, account, store, "登录 Cookie 已过期，请重新扫码")?;
        return Err("登录态已失效，已切换到扫码登录页".to_string());
    }
    if payload.code != 0 {
        return Err(format!(
            "平台未接收这条弹幕（{}）：{}",
            payload.code,
            payload.readable_message()
        ));
    }

    Ok(SendLiveDanmakuResult {
        room_id: context.room_id,
        message,
        sent_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_accepts_normal_danmaku() {
        assert_eq!(
            normalize_message("  大家晚上好  ".to_string()).expect("normal message"),
            "大家晚上好"
        );
    }

    #[test]
    fn keeps_livehime_compatible_character_limit() {
        assert_eq!(LIVE_DANMAKU_MAX_CHARS, 40);
    }

    #[test]
    fn counts_unicode_characters_instead_of_utf8_bytes() {
        let exact = "派".repeat(LIVE_DANMAKU_MAX_CHARS);
        assert_eq!(
            normalize_message(exact.clone()).expect("exact length"),
            exact
        );
        let too_long = "派".repeat(LIVE_DANMAKU_MAX_CHARS + 1);
        assert!(normalize_message(too_long).is_err());
    }

    #[test]
    fn rejects_blank_danmaku() {
        assert!(normalize_message(" \n\t ".to_string()).is_err());
    }

    #[test]
    fn prefers_message_field_from_platform_response() {
        let response = SendDanmakuApiResponse {
            code: 1003,
            message: Value::String("发送频率过快".to_string()),
            msg: Value::String("fallback".to_string()),
        };
        assert_eq!(response.readable_message(), "发送频率过快");
    }
}
