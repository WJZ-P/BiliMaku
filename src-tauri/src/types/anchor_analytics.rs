use serde::{Deserialize, Serialize};

/// 主播数据总览支持的统计周期。
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AnchorAnalyticsRange {
    /// 当日数据；关播后仍可能需要等待平台汇总。
    Today,
    /// 截至昨日的前七日数据。
    LastSevenDays,
    /// 截至昨日的前三十日数据。
    LastThirtyDays,
    /// 当前自然月数据。
    NaturalMonth,
}

impl AnchorAnalyticsRange {
    /// 把官方接口使用的 range_type 转为强类型周期。
    pub fn from_range_type(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Today),
            2 => Some(Self::LastSevenDays),
            3 => Some(Self::LastThirtyDays),
            4 => Some(Self::NaturalMonth),
            _ => None,
        }
    }

    /// 返回官方接口使用的数字周期值。
    pub const fn range_type(self) -> u8 {
        match self {
            Self::Today => 1,
            Self::LastSevenDays => 2,
            Self::LastThirtyDays => 3,
            Self::NaturalMonth => 4,
        }
    }

    /// 返回面板展示用的中文周期名称。
    pub const fn label(self) -> &'static str {
        match self {
            Self::Today => "今日",
            Self::LastSevenDays => "前 7 日",
            Self::LastThirtyDays => "前 30 日",
            Self::NaturalMonth => "自然月",
        }
    }
}

/// 指标原始值的计量方式。
///
/// 收益沿用平台接口的千分之一元，时长沿用秒；前端只负责格式化，
/// 避免在传输过程中损失原始精度。
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AnchorMetricValueKind {
    /// 普通人数、次数或数量。
    Count,
    /// 秒级时长。
    DurationSeconds,
    /// 千分之一元；1000 表示 1 元。
    MilliYuan,
}

/// 趋势图中的一个日期数据点。
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorAnalyticsPoint {
    /// 平台返回的统计日期。
    pub date: String,
    /// 当日原始值，计量方式由所属指标的 value_kind 决定。
    pub value: i64,
}

/// 一个指标下的一组趋势线，例如全部观众与粉丝观众。
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorAnalyticsSeries {
    /// 平台返回的趋势线名称。
    pub name: String,
    /// 按日期排列的趋势点。
    pub points: Vec<AnchorAnalyticsPoint>,
}

/// 主播中心中的单个统计指标。
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorAnalyticsMetric {
    /// 平台指标键，例如 income、broadcast、watchNum 或 changeFans。
    pub key: String,
    /// 面板使用的中文名称。
    pub label: String,
    /// 原始值的计量方式。
    pub value_kind: AnchorMetricValueKind,
    /// 当前统计周期的汇总原始值。
    pub value: i64,
    /// 相比上一统计周期的变化量，不是百分比。
    pub comparison_delta: i64,
    /// 该指标包含的趋势线。
    pub series: Vec<AnchorAnalyticsSeries>,
}

/// 已登录主播账号的数据总览快照。
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorAnalyticsOverview {
    /// 本次查询的强类型统计周期。
    pub range: AnchorAnalyticsRange,
    /// 官方接口使用的 range_type，便于前端保留请求状态。
    pub range_type: u8,
    /// 面板展示用的中文周期名称。
    pub range_label: String,
    /// 平台标记的数据更新截止时间。
    pub updated_through: String,
    /// BiliMaku 完成拉取时的 Unix 秒级时间戳。
    pub fetched_at: u64,
    /// 账号是否处于平台定义的蓝海主播分组。
    pub blue: bool,
    /// 账号是否处于平台定义的游戏主播分组。
    pub game: bool,
    /// 平台返回并经过稳定字段映射的指标列表。
    pub metrics: Vec<AnchorAnalyticsMetric>,
}
