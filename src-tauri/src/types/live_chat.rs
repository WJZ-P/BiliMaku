use serde::{Deserialize, Serialize};

/// 单条普通直播弹幕允许输入的最大 Unicode 字符数。
///
/// 平台会根据账号与房间策略进一步校验；这里与当前直播姬可发送的 40 字限制保持一致，
/// 提前阻止明显超长的请求。
pub const LIVE_DANMAKU_MAX_CHARS: usize = 40;

/// 前端提交的一次直播弹幕发送请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendLiveDanmakuRequest {
    /// 使用当前登录账号发送的弹幕正文。
    pub message: String,
}

/// 平台确认接收弹幕后返回给前端的结果。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendLiveDanmakuResult {
    /// 弹幕实际发送到的真实直播间号。
    pub room_id: u64,
    /// 已提交给平台的弹幕正文。
    pub message: String,
    /// 平台成功响应时的 Unix 秒级时间戳。
    pub sent_at: u64,
}
