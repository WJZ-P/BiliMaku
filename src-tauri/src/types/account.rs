use serde::{Deserialize, Serialize};

/// 已登录的哔哩哔哩账号摘要。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    /// 账号数字 UID，使用字符串保存以避免前端整数精度损失。
    pub uid: String,
    /// 账号当前昵称。
    pub username: String,
    /// 账号头像的远程地址。
    pub avatar: String,
    /// B 站主站账号等级，当前通常为 0 到 6 级。
    #[serde(default)]
    pub level: u8,
    /// 当前累计经验值。
    #[serde(default)]
    pub current_exp: u64,
    /// 当前等级的起始累计经验值。
    #[serde(default)]
    pub current_min_exp: u64,
    /// 下一等级所需的累计经验值；满级账号没有下一等级。
    #[serde(default)]
    pub next_exp: Option<u64>,
    /// 主站账号硬币余额；该字段不同于钱包中的 B 币余额。
    #[serde(default)]
    pub coins: f64,
}

/// 前端展示用的账号登录状态。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatus {
    /// 状态阶段，例如 checking、anonymous 或 authenticated。
    pub phase: &'static str,
    /// 面向用户的中文状态说明。
    pub message: String,
    /// 登录成功后的账号资料；匿名状态下为空。
    pub profile: Option<AccountProfile>,
    /// 当前登录态是否已经写入统一配置文件。
    pub persisted: bool,
    /// 最近一次在线验证成功的 Unix 秒级时间戳。
    pub validated_at: Option<u64>,
}

/// Rust 后端广播给前端的账号生命周期事件。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountEvent {
    /// 事件种类，例如 login、restored、cookie-expired 或 logout。
    pub kind: &'static str,
    /// 事件发生后的完整账号状态。
    pub status: LoginStatus,
    /// 事件发生时的 Unix 秒级时间戳。
    pub occurred_at: u64,
}

/// 二维码登录初始化结果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrLoginTicket {
    /// 可直接交给图片组件渲染的 SVG Data URL。
    pub image_data_url: String,
    /// 二维码预计有效秒数。
    pub expires_in_seconds: u16,
}
