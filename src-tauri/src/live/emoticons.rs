use super::ActiveRoomContext;
use crate::account::{
    ensure_bilibili_session_initialized, expire_current_session, BiliAccountState,
};
use crate::store::AppConfigStore;
use crate::types::live_chat::{LiveEmoticon, LiveEmoticonCatalog, LiveEmoticonPackage};
use reqwest::header::{ACCEPT, ORIGIN, REFERER};
use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

const LIVE_EMOTICON_URL: &str =
    "https://api.live.bilibili.com/xlive/web-ucenter/v2/emoticon/GetEmoticons";
const LIVE_ORIGIN: &str = "https://live.bilibili.com";
const ACCOUNT_NOT_LOGGED_IN: i64 = -101;

#[derive(Debug, Deserialize)]
struct LiveEmoticonApiResponse {
    code: i64,
    #[serde(default)]
    message: Value,
    #[serde(default)]
    msg: Value,
    data: Option<RawLiveEmoticonCatalog>,
}

impl LiveEmoticonApiResponse {
    fn readable_message(&self) -> String {
        readable_api_value(&self.message)
            .or_else(|| readable_api_value(&self.msg))
            .filter(|message| !message.is_empty())
            .unwrap_or_else(|| "平台未返回错误说明".to_string())
    }
}

#[derive(Debug, Default, Deserialize)]
struct RawLiveEmoticonCatalog {
    #[serde(default)]
    fans_brand: u8,
    #[serde(default)]
    data: Vec<RawLiveEmoticonPackage>,
}

#[derive(Debug, Default, Deserialize)]
struct RawLiveEmoticonPackage {
    #[serde(default)]
    emoticons: Vec<RawLiveEmoticon>,
    #[serde(default)]
    pkg_id: u64,
    #[serde(default)]
    pkg_name: String,
    #[serde(default)]
    pkg_type: u8,
    #[serde(default)]
    pkg_descript: String,
    #[serde(default)]
    pkg_perm: u8,
    #[serde(default)]
    current_cover: String,
    #[serde(default)]
    recently_used_emoticons: Vec<RawLiveEmoticon>,
}

#[derive(Debug, Default, Deserialize)]
struct RawLiveEmoticon {
    #[serde(default)]
    emoji: String,
    #[serde(default)]
    descript: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    is_dynamic: u8,
    #[serde(default)]
    in_player_area: u8,
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
    #[serde(default)]
    perm: u8,
    #[serde(default)]
    unlock_need_level: u32,
    #[serde(default)]
    bulge_display: u8,
    #[serde(default)]
    unlock_show_text: String,
    #[serde(default)]
    emoticon_unique: String,
    #[serde(default)]
    emoticon_id: u64,
}

fn readable_api_value(value: &Value) -> Option<String> {
    match value {
        Value::String(message) => Some(message.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
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

fn map_emoticon(raw: RawLiveEmoticon, package_type: u8) -> LiveEmoticon {
    LiveEmoticon {
        id: raw.emoticon_id,
        name: raw.emoji,
        description: raw.descript,
        image_url: raw.url,
        unique: raw.emoticon_unique,
        width: raw.width,
        height: raw.height,
        dynamic: raw.is_dynamic == 1,
        in_player_area: raw.in_player_area == 1,
        bulge_display: raw.bulge_display == 1,
        permission_code: raw.perm,
        // 平台网页对 pkg_type=3 的文本表情直接插入输入框，不进入图片表情权限校验。
        permitted: package_type == 3 || raw.perm == 1,
        unlock_text: raw.unlock_show_text,
        unlock_level: raw.unlock_need_level,
    }
}

fn map_catalog(room_id: u64, raw: RawLiveEmoticonCatalog) -> LiveEmoticonCatalog {
    let packages = raw
        .data
        .into_iter()
        .map(|package| {
            let package_type = package.pkg_type;
            let permission_code = package.pkg_perm;
            LiveEmoticonPackage {
                id: package.pkg_id,
                name: package.pkg_name,
                description: package.pkg_descript,
                package_type,
                permission_code,
                permitted: package_type == 3 || permission_code == 1,
                cover_url: package.current_cover,
                emoticons: package
                    .emoticons
                    .into_iter()
                    .map(|emoticon| map_emoticon(emoticon, package_type))
                    .collect(),
                recently_used: package
                    .recently_used_emoticons
                    .into_iter()
                    .map(|emoticon| map_emoticon(emoticon, package_type))
                    .collect(),
            }
        })
        .collect();

    LiveEmoticonCatalog {
        room_id,
        fans_brand: raw.fans_brand == 1,
        packages,
    }
}

/// 使用当前持久化登录态读取活动直播间的账号表情目录与逐项权限。
pub(super) async fn fetch(
    app: &AppHandle,
    context: ActiveRoomContext,
    account: &BiliAccountState,
    store: &AppConfigStore,
) -> Result<LiveEmoticonCatalog, String> {
    let login = ensure_bilibili_session_initialized(app, account, store).await?;
    if login.profile.is_none() {
        return Err("读取账号表情需要先完成扫码登录".to_string());
    }

    let session = account.http_session()?;
    let referer = format!("{LIVE_ORIGIN}/{}", context.room_id);
    let room_id = context.room_id.to_string();
    let response = session
        .client
        .get(LIVE_EMOTICON_URL)
        .header(ACCEPT, "application/json, text/plain, */*")
        .header(ORIGIN, LIVE_ORIGIN)
        .header(REFERER, referer)
        .query(&[("platform", "pc"), ("room_id", room_id.as_str())])
        .send()
        .await
        .map_err(|error| format!("读取直播表情失败：{error}"))?;
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| format!("读取直播表情响应失败：{error}"))?;
    if !status.is_success() {
        let excerpt = response_excerpt(&body);
        return Err(if excerpt.is_empty() {
            format!("读取直播表情失败：HTTP {status}")
        } else {
            format!("读取直播表情失败：HTTP {status} · {excerpt}")
        });
    }

    let payload: LiveEmoticonApiResponse = serde_json::from_slice(&body).map_err(|error| {
        let excerpt = response_excerpt(&body);
        if excerpt.is_empty() {
            format!("解析直播表情响应失败：{error}")
        } else {
            format!("解析直播表情响应失败：{error} · {excerpt}")
        }
    })?;
    if payload.code == ACCOUNT_NOT_LOGGED_IN {
        expire_current_session(app, account, store, "登录 Cookie 已过期，请重新扫码")?;
        return Err("登录态已失效，已切换到扫码登录页".to_string());
    }
    if payload.code != 0 {
        return Err(format!(
            "直播表情接口返回 {}：{}",
            payload.code,
            payload.readable_message()
        ));
    }

    payload
        .data
        .map(|data| map_catalog(context.room_id, data))
        .ok_or_else(|| "直播表情接口没有返回目录数据".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_text_and_image_emoticon_permissions() {
        let payload: LiveEmoticonApiResponse = serde_json::from_str(
            r#"{
                "code": 0,
                "message": "OK",
                "data": {
                    "fans_brand": 1,
                    "data": [
                        {
                            "pkg_id": 1,
                            "pkg_name": "emoji",
                            "pkg_type": 3,
                            "pkg_perm": 0,
                            "current_cover": "cover-a",
                            "recently_used_emoticons": [],
                            "emoticons": [{
                                "emoji": "dog",
                                "descript": "[dog]",
                                "url": "image-a",
                                "perm": 0,
                                "emoticon_unique": "emoji_208",
                                "emoticon_id": 208
                            }]
                        },
                        {
                            "pkg_id": 2,
                            "pkg_name": "通用表情",
                            "pkg_type": 1,
                            "pkg_perm": 1,
                            "current_cover": "cover-b",
                            "recently_used_emoticons": [],
                            "emoticons": [{
                                "emoji": "冲鸭",
                                "descript": "冲鸭",
                                "url": "image-b",
                                "perm": 1,
                                "is_dynamic": 1,
                                "emoticon_unique": "official_332",
                                "emoticon_id": 332
                            }]
                        }
                    ]
                }
            }"#,
        )
        .expect("parse sample response");

        let catalog = map_catalog(4457340, payload.data.expect("catalog data"));
        assert!(catalog.fans_brand);
        assert_eq!(catalog.packages.len(), 2);
        assert!(catalog.packages[0].emoticons[0].permitted);
        assert_eq!(catalog.packages[0].emoticons[0].description, "[dog]");
        assert!(catalog.packages[1].emoticons[0].dynamic);
        assert_eq!(catalog.packages[1].emoticons[0].unique, "official_332");
    }
}
