use serde::Serialize;
use serde_json::Value;

/// 平台 Web 长链旧版 JSON 互动事件的原始命令字。
pub const INTERACT_WORD: &str = "INTERACT_WORD";

/// 平台 Web 长链 V2 Protobuf 互动事件的原始命令字。
pub const INTERACT_WORD_V2: &str = "INTERACT_WORD_V2";

/// 平台互动事件的具体动作，由 INTERACT_WORD / INTERACT_WORD_V2 的 msg_type 映射。
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LiveInteractionKind {
    /// 用户进入直播间，msg_type = 1。
    Enter,
    /// 用户关注主播，msg_type = 2。
    Follow,
    /// 用户分享直播间，msg_type = 3。
    Share,
    /// 用户特别关注主播，msg_type = 4。
    SpecialFollow,
    /// 用户与主播互相关注，msg_type = 5。
    MutualFollow,
    /// 用户为主播点赞，msg_type = 6。
    Like,
}

/// 直播间连接建立后的基础信息。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomConnectionInfo {
    /// 本次本地连接会话编号。
    pub session_id: u64,
    /// 用户输入的房间号，可能是短号。
    pub requested_room_id: u64,
    /// 平台解析后的真实房间号。
    pub room_id: u64,
    /// 直播间主播 UID。
    pub owner_uid: u64,
    /// 直播间标题。
    pub title: String,
    /// 平台一级分区 ID，例如网游、单机游戏或虚拟主播。
    pub parent_area_id: u64,
    /// 平台一级分区名称。
    pub parent_area_name: String,
    /// 当前直播间具体分区 ID。
    pub area_id: u64,
    /// 当前直播间具体分区名称，供标题下方直接展示。
    pub area_name: String,
    /// 平台返回的直播状态码。
    pub live_status: u8,
    /// 平台返回的本场开播时间，格式为北京时间 YYYY-MM-DD HH:mm:ss。
    pub live_time: String,
    /// 供 UI 展示的直播封面地址，优先 user_cover，其次 cover，最后回退 keyframe。
    pub cover_url: String,
    /// 当前连接使用的访问模式。
    pub access_mode: &'static str,
    /// 登录观看账号的 UID；匿名连接时为空。
    pub viewer_uid: Option<u64>,
}

/// 直播长连接状态事件。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStatus {
    /// 本次本地连接会话编号。
    pub session_id: u64,
    /// 当前真实房间号。
    pub room_id: u64,
    /// 连接阶段，例如 connecting、connected 或 reconnecting。
    pub state: &'static str,
    /// 面向用户的中文状态说明。
    pub message: String,
    /// 当前重连尝试次数。
    pub attempt: u32,
}

/// 弹幕正文中由平台下发表情元数据描述的行内图片。
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveMessageEmote {
    /// 正文中的占位文本，例如 `[dog]`；前端据此进行精确替换。
    pub text: String,
    /// 平台表情图片地址，协议层会统一升级为 HTTPS。
    pub url: String,
    /// 平台声明的原始图片宽度；缺失时为 0。
    pub width: u32,
    /// 平台声明的原始图片高度；缺失时为 0。
    pub height: u32,
}

/// 经过协议归一化后的直播事件。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEvent {
    /// 事件在本机的唯一编号。
    pub id: String,
    /// 产生事件的本地连接会话编号。
    pub session_id: u64,
    /// 产生事件的真实房间号。
    pub room_id: u64,
    /// 归一化事件种类，例如 message、interaction、gift 或 guard。
    #[serde(rename = "type")]
    pub event_type: String,
    /// 互动事件的具体动作；非互动事件为空。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interaction_kind: Option<LiveInteractionKind>,
    /// 事件主体的用户 UID；上游未提供时为空。
    pub user_id: Option<String>,
    /// 事件主体的昵称。
    pub user: String,
    /// 事件主体的头像地址。
    pub avatar: String,
    /// 可直接展示或播报的事件正文。
    pub content: String,
    /// 弹幕正文中的平台表情；非弹幕事件或普通纯文本弹幕为空。
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub emotes: Vec<LiveMessageEmote>,
    /// 礼物数量、互动种类等补充信息。
    pub meta: Option<String>,
    /// 平台下发的原始命令字，例如 INTERACT_WORD_V2；用于调试与规则筛选。
    pub raw_command: String,
    /// 事件在本机产生时的 Unix 秒级时间戳。
    pub emitted_at: u64,
}

/// 心跳包返回的直播间人气值。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PopularityUpdate {
    /// 本次本地连接会话编号。
    pub session_id: u64,
    /// 当前真实房间号。
    pub room_id: u64,
    /// 平台心跳返回的人气指标，不等同于精确在线人数。
    pub popularity: u32,
}

/// 平台长链推送的本场直播累计统计。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRoomStatsUpdate {
    /// 本次本地连接会话编号。
    pub session_id: u64,
    /// 当前真实房间号。
    pub room_id: u64,
    /// 平台 WATCHED_CHANGE 推送的本场累计看过人数。
    pub watched_count: Option<u64>,
    /// 平台 LIKE_INFO_V3_UPDATE 推送的本场累计点赞次数。
    pub like_count: Option<u64>,
    /// 产生本次统计变化的平台原始命令字。
    pub raw_command: String,
}
/// 前端启动时读取的直播连接快照。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSnapshot {
    /// 当前是否存在活动长连接。
    pub connected: bool,
    /// 活动连接的本地会话编号。
    pub session_id: Option<u64>,
    /// 活动连接的真实房间号。
    pub room_id: Option<u64>,
    /// 活动连接的完整房间信息，用于前端页面重新挂载时恢复标题与开播时间。
    pub room: Option<RoomConnectionInfo>,
    /// 统一配置中保存的用户输入房间号。
    pub saved_room_id: String,
    /// 是否应在冷启动时自动恢复该直播间连接。
    pub auto_connect: bool,
}

/// 当前在线贡献榜中的用户。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveOnlineRankEntry {
    /// 当前贡献排名，从 1 开始。
    pub rank: u32,
    /// 用户 UID；序列化为字符串以避免 JavaScript 整数精度损失。
    pub user_id: String,
    /// 当前展示昵称。
    pub name: String,
    /// 当前展示头像。
    pub avatar: String,
    /// 平台返回的本场贡献值。
    pub score: u64,
    /// 大航海等级，0 表示没有有效身份。
    pub guard_level: u8,
    /// 平台财富等级。
    pub wealth_level: u16,
    /// 是否为平台隐私保护后的神秘用户。
    pub mystery: bool,
}

/// 当前直播间在线贡献榜快照。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveOnlineRankSnapshot {
    /// 当前真实直播间号。
    pub room_id: u64,
    /// 平台 onlineNum 字段，即在线贡献榜人数，并非精确在线观众数。
    pub online_count: u64,
    /// 平台用于 UI 展示的榜单人数文本。
    pub online_count_text: String,
    /// 当前贡献榜前三名。
    pub entries: Vec<LiveOnlineRankEntry>,
    /// 平台返回的上榜规则提示。
    pub tips_text: String,
    /// 平台返回的贡献分值名称。
    pub value_text: String,
}

/// 长连接数据包解码后的内部结果。
#[derive(Debug)]
pub enum DecodedPacket {
    /// 长连接鉴权结果码。
    Auth(i64),
    /// 心跳包返回的人气值。
    Popularity(u32),
    /// 尚未归一化的平台 JSON 命令。
    Command(Value),
}
