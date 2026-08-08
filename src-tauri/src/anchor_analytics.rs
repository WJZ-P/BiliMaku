use crate::account::{self, BiliAccountState};
use crate::store::AppConfigStore;
use crate::types::anchor_analytics::{
    AnchorAnalyticsMetric, AnchorAnalyticsOverview, AnchorAnalyticsPoint, AnchorAnalyticsRange,
    AnchorAnalyticsSeries, AnchorMetricValueKind,
};
use reqwest::header::{ACCEPT, ORIGIN, REFERER};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use tokio::sync::Mutex as AsyncMutex;

/// 官方直播中心“数据总览”页面当前使用的核心数据接口。
const CORE_DATA_URL: &str =
    "https://api.live.bilibili.com/xlive/anchor-task-interface/api/v1/CoreData";
const LIVE_CENTER_REFERER: &str = "https://link.bilibili.com/p/center/index#/live-data/overview";
const LIVE_CENTER_ORIGIN: &str = "https://link.bilibili.com";
const ACCOUNT_NOT_LOGGED_IN: i64 = -101;
/// 同一账号、同一周期在五分钟内复用内存快照，手动刷新可绕过缓存。
const CACHE_TTL_SECONDS: u64 = 5 * 60;

/// 主播数据的进程内缓存；键中包含账号 UID，避免切换账号后串用快照。
#[derive(Default)]
pub struct AnchorAnalyticsState {
    cache: Mutex<HashMap<String, AnchorAnalyticsOverview>>,
    /// 合并标题栏与仪表盘在首帧同时发起的请求，避免击穿五分钟缓存。
    request_lock: AsyncMutex<()>,
}

impl AnchorAnalyticsState {
    fn cache_key(uid: &str, range: AnchorAnalyticsRange) -> String {
        format!("{uid}:{}", range.range_type())
    }

    fn get_cached(
        &self,
        uid: &str,
        range: AnchorAnalyticsRange,
    ) -> Result<Option<AnchorAnalyticsOverview>, String> {
        let key = Self::cache_key(uid, range);
        let now = unix_timestamp();
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "主播数据缓存状态锁定失败".to_string())?;
        let fresh = cache
            .get(&key)
            .filter(|overview| now.saturating_sub(overview.fetched_at) <= CACHE_TTL_SECONDS)
            .cloned();
        if fresh.is_none() {
            cache.remove(&key);
        }
        Ok(fresh)
    }

    fn insert(
        &self,
        uid: &str,
        range: AnchorAnalyticsRange,
        overview: AnchorAnalyticsOverview,
    ) -> Result<(), String> {
        self.cache
            .lock()
            .map_err(|_| "主播数据缓存状态锁定失败".to_string())?
            .insert(Self::cache_key(uid, range), overview);
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    code: i64,
    #[serde(default, alias = "msg")]
    message: String,
    data: Option<T>,
}

#[derive(Debug, Deserialize)]
struct RawCoreData {
    #[serde(default)]
    blue: bool,
    #[serde(default)]
    game: bool,
    #[serde(default)]
    end_time: String,
    #[serde(default)]
    list: Option<Vec<RawMetric>>,
}

#[derive(Debug, Deserialize)]
struct RawMetric {
    name: String,
    #[serde(default)]
    value: i64,
    #[serde(default)]
    ratio: i64,
    #[serde(default)]
    line_chart: Option<Vec<RawSeries>>,
}

#[derive(Debug, Deserialize)]
struct RawSeries {
    #[serde(default)]
    name: String,
    #[serde(default)]
    node: Option<Vec<RawPoint>>,
}

#[derive(Debug, Deserialize)]
struct RawPoint {
    #[serde(default)]
    date: String,
    #[serde(default)]
    value: i64,
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

fn metric_definition(key: &str) -> (&'static str, AnchorMetricValueKind) {
    match key {
        "income" => ("收益", AnchorMetricValueKind::MilliYuan),
        "giftNum" => ("送礼人数", AnchorMetricValueKind::Count),
        "broadcast" => ("开播时长", AnchorMetricValueKind::DurationSeconds),
        "watchNum" => ("观众人数", AnchorMetricValueKind::Count),
        "avgWatchTime" => ("平均观看时长", AnchorMetricValueKind::DurationSeconds),
        "barrageNum" => ("弹幕人数", AnchorMetricValueKind::Count),
        "barrage" => ("弹幕条数", AnchorMetricValueKind::Count),
        "changeFans" => ("净增粉丝", AnchorMetricValueKind::Count),
        "fans" => ("总粉丝", AnchorMetricValueKind::Count),
        "totalWatchTime" => ("累计有效观看时长", AnchorMetricValueKind::DurationSeconds),
        "popularity" => ("人气峰值", AnchorMetricValueKind::Count),
        "fansMedal" => ("粉丝勋章", AnchorMetricValueKind::Count),
        _ => ("其他指标", AnchorMetricValueKind::Count),
    }
}

fn normalize_metric(metric: RawMetric) -> AnchorAnalyticsMetric {
    let (label, value_kind) = metric_definition(&metric.name);
    AnchorAnalyticsMetric {
        key: metric.name,
        label: label.to_string(),
        value_kind,
        value: metric.value,
        comparison_delta: metric.ratio,
        series: metric
            .line_chart
            .unwrap_or_default()
            .into_iter()
            .map(|series| AnchorAnalyticsSeries {
                name: series.name,
                points: series
                    .node
                    .unwrap_or_default()
                    .into_iter()
                    .map(|point| AnchorAnalyticsPoint {
                        date: point.date,
                        value: point.value,
                    })
                    .collect(),
            })
            .collect(),
    }
}

fn normalize_overview(range: AnchorAnalyticsRange, data: RawCoreData) -> AnchorAnalyticsOverview {
    AnchorAnalyticsOverview {
        range,
        range_type: range.range_type(),
        range_label: range.label().to_string(),
        updated_through: data.end_time,
        fetched_at: unix_timestamp(),
        blue: data.blue,
        game: data.game,
        metrics: data
            .list
            .unwrap_or_default()
            .into_iter()
            .map(normalize_metric)
            .collect(),
    }
}

/// 使用 Rust 中已经恢复的扫码 Cookie 拉取当前账号自己的主播数据总览。
///
/// 该接口按登录账号确定主播身份，并不接受任意房间号；Cookie 与原始响应都不会暴露给前端。
#[tauri::command]
pub async fn get_anchor_analytics_overview(
    app: AppHandle,
    account_state: State<'_, BiliAccountState>,
    config_store: State<'_, AppConfigStore>,
    analytics_state: State<'_, AnchorAnalyticsState>,
    range_type: u8,
    force_refresh: bool,
) -> Result<AnchorAnalyticsOverview, String> {
    let range = AnchorAnalyticsRange::from_range_type(range_type)
        .ok_or_else(|| format!("不支持的主播数据统计周期：{range_type}"))?;
    let uid = account_state
        .profile_uid()?
        .ok_or_else(|| "当前账号尚未登录，主播数据需要扫码会话".to_string())?;

    if !force_refresh {
        if let Some(overview) = analytics_state.get_cached(&uid, range)? {
            return Ok(overview);
        }
    }

    // 首次进入工作台时，标题栏与仪表盘可能在同一帧读取相同周期。
    // 第二个请求等待首个请求写入缓存后直接复用结果。
    let _request_guard = analytics_state.request_lock.lock().await;
    if !force_refresh {
        if let Some(overview) = analytics_state.get_cached(&uid, range)? {
            return Ok(overview);
        }
    }

    let session = account_state.http_session()?;
    let range_value = range.range_type().to_string();
    let response_body = session
        .client
        .get(CORE_DATA_URL)
        .header(REFERER, LIVE_CENTER_REFERER)
        .header(ORIGIN, LIVE_CENTER_ORIGIN)
        .header(ACCEPT, "application/json, text/plain, */*")
        .query(&[
            ("platform", "web"),
            ("mobi_app", "web"),
            ("build", "1"),
            ("range_type", range_value.as_str()),
        ])
        .send()
        .await
        .map_err(|error| format!("请求主播数据总览失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("主播数据总览网络响应异常：{error}"))?
        .bytes()
        .await
        .map_err(|error| format!("读取主播数据总览响应失败：{error}"))?;
    let response: ApiResponse<RawCoreData> =
        serde_json::from_slice(&response_body).map_err(|error| {
            format!(
                "解析主播数据总览失败（第 {} 行，第 {} 列）：{error}",
                error.line(),
                error.column()
            )
        })?;

    if response.code == ACCOUNT_NOT_LOGGED_IN {
        account::expire_current_session(
            &app,
            &account_state,
            &config_store,
            "登录 Cookie 已过期，请重新扫码后读取主播数据",
        )?;
        return Err("登录 Cookie 已过期，请重新扫码".to_string());
    }
    if response.code != 0 {
        return Err(format!(
            "主播数据接口返回 {}：{}",
            response.code,
            if response.message.is_empty() {
                "平台未返回错误说明"
            } else {
                &response.message
            }
        ));
    }

    let data = response
        .data
        .ok_or_else(|| "主播数据接口成功响应中缺少 data".to_string())?;
    let overview = normalize_overview(range, data);
    analytics_state.insert(&uid, range, overview.clone())?;
    Ok(overview)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_official_core_data_shape_to_stable_types() {
        let response: ApiResponse<RawCoreData> = serde_json::from_str(
            r#"{
                "code": 0,
                "message": "OK",
                "data": {
                    "blue": false,
                    "game": false,
                    "end_time": "2026-08-07 23:59:59",
                    "list": [{
                        "name": "income",
                        "value": 21900,
                        "ratio": 21500,
                        "line_chart": [{
                            "name": "直播收益",
                            "node": [{"date": "2026/08/01", "value": 1200}]
                        }]
                    }]
                }
            }"#,
        )
        .expect("parse fixture");
        let overview = normalize_overview(
            AnchorAnalyticsRange::LastSevenDays,
            response.data.expect("data"),
        );

        assert_eq!(overview.range_type, 2);
        assert_eq!(overview.updated_through, "2026-08-07 23:59:59");
        assert_eq!(overview.metrics.len(), 1);
        assert_eq!(overview.metrics[0].key, "income");
        assert_eq!(overview.metrics[0].label, "收益");
        assert_eq!(
            overview.metrics[0].value_kind,
            AnchorMetricValueKind::MilliYuan
        );
        assert_eq!(overview.metrics[0].series[0].points[0].value, 1200);
    }

    #[test]
    fn accepts_null_nodes_from_metrics_without_trend_data() {
        let response: ApiResponse<RawCoreData> = serde_json::from_str(
            r#"{
                "code": 0,
                "message": "OK",
                "data": {
                    "end_time": "2026-08-07 23:59:59",
                    "list": [{
                        "name": "totalWatchTime",
                        "value": 1200,
                        "ratio": 0,
                        "line_chart": [{
                            "name": "totalWatchTime",
                            "node": null
                        }]
                    }]
                }
            }"#,
        )
        .expect("parse nullable trend fixture");
        let overview = normalize_overview(
            AnchorAnalyticsRange::LastSevenDays,
            response.data.expect("data"),
        );

        assert_eq!(overview.metrics.len(), 1);
        assert_eq!(overview.metrics[0].series.len(), 1);
        assert!(overview.metrics[0].series[0].points.is_empty());
    }

    #[test]
    fn rejects_unknown_range_type() {
        assert_eq!(AnchorAnalyticsRange::from_range_type(0), None);
        assert_eq!(AnchorAnalyticsRange::from_range_type(5), None);
    }
}
