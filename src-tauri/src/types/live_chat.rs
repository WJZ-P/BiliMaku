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
    /// 使用当前登录账号发送的弹幕正文；图片表情时填写平台下发的唯一标识。
    pub message: String,
    /// 平台弹幕类型：0 为普通文本，1 为独立图片表情。
    #[serde(default)]
    pub dm_type: u8,
}

/// 平台确认接收弹幕后返回给前端的结果。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendLiveDanmakuResult {
    /// 弹幕实际发送到的真实直播间号。
    pub room_id: u64,
    /// 已提交给平台的弹幕正文。
    pub message: String,
    /// 平台接收的弹幕类型：0 为普通文本，1 为独立图片表情。
    pub dm_type: u8,
    /// 平台成功响应时的 Unix 秒级时间戳。
    pub sent_at: u64,
}

/// 当前账号在活动直播间中可以看到的一份表情目录。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEmoticonCatalog {
    /// 表情权限所对应的真实直播间号。
    pub room_id: u64,
    /// 当前账号是否拥有该直播间的粉丝团身份。
    pub fans_brand: bool,
    /// 平台按来源与权限划分的表情包。
    pub packages: Vec<LiveEmoticonPackage>,
}

/// 平台表情目录中的一个表情包。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEmoticonPackage {
    /// 平台表情包 ID。
    pub id: u64,
    /// 表情包展示名称。
    pub name: String,
    /// 表情包补充说明。
    pub description: String,
    /// 平台表情包类型；3 为可插入普通弹幕的文本表情，其余为独立图片表情。
    pub package_type: u8,
    /// 平台原始表情包权限码，保留用于后续权限策略扩展。
    pub permission_code: u8,
    /// 当前账号是否具备该表情包的直接使用权限。
    pub permitted: bool,
    /// 表情包标签页封面地址。
    pub cover_url: String,
    /// 表情包内的全部表情。
    pub emoticons: Vec<LiveEmoticon>,
    /// 平台记录的近期使用表情。
    pub recently_used: Vec<LiveEmoticon>,
}

/// 一个可插入输入框或直接发送的直播表情。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEmoticon {
    /// 平台表情 ID。
    pub id: u64,
    /// 表情面板中展示的短名称。
    pub name: String,
    /// 插入普通弹幕时使用的文本，例如 `[dog]`。
    pub description: String,
    /// 表情图片地址。
    pub image_url: String,
    /// 平台发送独立图片表情时使用的唯一标识。
    pub unique: String,
    /// 图片原始宽度。
    pub width: u32,
    /// 图片原始高度。
    pub height: u32,
    /// 是否为动态图片。
    pub dynamic: bool,
    /// 是否允许显示在播放器弹幕区域。
    pub in_player_area: bool,
    /// 是否使用凸出的大表情显示方式。
    pub bulge_display: bool,
    /// 平台原始表情权限码。
    pub permission_code: u8,
    /// 当前账号是否可以使用该表情。
    pub permitted: bool,
    /// 权限不足时平台给出的简短说明。
    pub unlock_text: String,
    /// 解锁表情所需的粉丝牌或身份等级。
    pub unlock_level: u32,
}
