/** 主播数据总览可选择的统计周期。 */
export type AnchorAnalyticsRange =
  | "today"
  | "lastSevenDays"
  | "lastThirtyDays"
  | "naturalMonth";

/** 官方接口使用的统计周期数字。 */
export type AnchorAnalyticsRangeType = 1 | 2 | 3 | 4;

/** 当前面板重点展示的主播指标键。 */
export type PrimaryAnchorMetricKey =
  | "income"
  | "broadcast"
  | "watchNum"
  | "changeFans";

/** 指标原始数值的计量方式。 */
export type AnchorMetricValueKind =
  | "count"
  | "durationSeconds"
  | "milliYuan";

/** 趋势线中的单个日期数据点。 */
export interface AnchorAnalyticsPoint {
  /** 平台返回的统计日期。 */
  date: string;
  /** 当日原始值，计量方式由所属指标的 valueKind 决定。 */
  value: number;
}

/** 一个指标下的一组趋势线，例如全部观众与粉丝观众。 */
export interface AnchorAnalyticsSeries {
  /** 平台返回的趋势线名称。 */
  name: string;
  /** 按日期排列的趋势点。 */
  points: AnchorAnalyticsPoint[];
}

/** 主播中心中的单个统计指标。 */
export interface AnchorAnalyticsMetric {
  /** 平台指标键；已知值包括 income、broadcast、watchNum 和 changeFans。 */
  key: string;
  /** BiliMaku 面板使用的中文名称。 */
  label: string;
  /** 原始值的计量方式。 */
  valueKind: AnchorMetricValueKind;
  /** 当前统计周期的汇总原始值。 */
  value: number;
  /** 相比上一统计周期的变化量，不是百分比。 */
  comparisonDelta: number;
  /** 该指标包含的趋势线。 */
  series: AnchorAnalyticsSeries[];
}

/** 当前登录主播账号的数据总览快照。 */
export interface AnchorAnalyticsOverview {
  /** 本次查询的强类型统计周期。 */
  range: AnchorAnalyticsRange;
  /** 官方接口使用的统计周期数字。 */
  rangeType: AnchorAnalyticsRangeType;
  /** 面板展示用的中文周期名称。 */
  rangeLabel: string;
  /** 平台标记的数据更新截止时间。 */
  updatedThrough: string;
  /** Rust 后端完成拉取时的 Unix 秒级时间戳。 */
  fetchedAt: number;
  /** 账号是否处于平台定义的蓝海主播分组。 */
  blue: boolean;
  /** 账号是否处于平台定义的游戏主播分组。 */
  game: boolean;
  /** 平台返回并由 Rust 映射后的指标列表。 */
  metrics: AnchorAnalyticsMetric[];
}
