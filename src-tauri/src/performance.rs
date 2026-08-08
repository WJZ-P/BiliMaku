use crate::types::performance::FrontendStartupReport;
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

/// Rust 进程级启动性能记录器。
pub struct StartupPerformanceState {
    started_at: Instant,
    session_id: String,
    log_path: OnceLock<PathBuf>,
    write_lock: Mutex<()>,
}

impl Default for StartupPerformanceState {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
            session_id: format!("{}-{}", unix_millis(), std::process::id()),
            log_path: OnceLock::new(),
            write_lock: Mutex::new(()),
        }
    }
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or_default()
}

impl StartupPerformanceState {
    /// 在应用数据目录创建本次启动独立的 JSONL 日志。
    pub fn initialize(&self, app: &AppHandle) -> Result<PathBuf, String> {
        if let Some(path) = self.log_path.get() {
            return Ok(path.clone());
        }
        let directory = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("定位启动性能日志目录失败：{error}"))?
            .join("logs");
        fs::create_dir_all(&directory)
            .map_err(|error| format!("创建启动性能日志目录失败：{error}"))?;
        let path = directory.join(format!("startup-{}.jsonl", self.session_id));
        self.log_path
            .set(path.clone())
            .map_err(|_| "启动性能日志已被其他初始化流程占用".to_string())?;
        self.mark("rust", "performance-log-initialized", None, None)?;
        Ok(path)
    }

    /// 记录 Rust 启动阶段及可选阶段耗时。
    pub fn mark(
        &self,
        source: &str,
        stage: &str,
        duration_ms: Option<f64>,
        detail: Option<String>,
    ) -> Result<(), String> {
        self.append(json!({
            "runtimeSessionId": self.session_id,
            "recordedAtUnixMs": unix_millis(),
            "source": source,
            "stage": stage,
            "processElapsedMs": self.started_at.elapsed().as_secs_f64() * 1000.0,
            "durationMs": duration_ms,
            "detail": detail,
        }))
    }

    /// 把浏览器采集的阶段与 Resource Timing 写入同一次 Rust 启动日志。
    pub fn record_frontend(&self, report: FrontendStartupReport) -> Result<PathBuf, String> {
        let received_at = self.started_at.elapsed().as_secs_f64() * 1000.0;
        self.append(json!({
            "runtimeSessionId": self.session_id,
            "recordedAtUnixMs": unix_millis(),
            "source": "frontend",
            "stage": "frontend-report",
            "processElapsedMs": received_at,
            "pageSessionId": report.session_id,
            "timeOriginMs": report.time_origin_ms,
            "reason": report.reason,
            "location": report.location,
            "userAgent": report.user_agent,
        }))?;
        for metric in report.metrics {
            self.append(json!({
                "runtimeSessionId": self.session_id,
                "recordedAtUnixMs": unix_millis(),
                "source": "frontend",
                "stage": metric.stage,
                "processElapsedMs": received_at,
                "pageSessionId": report.session_id,
                "pageElapsedMs": metric.elapsed_ms,
                "durationMs": metric.duration_ms,
                "detail": metric.detail,
            }))?;
        }
        self.log_path()
    }

    pub fn log_path(&self) -> Result<PathBuf, String> {
        self.log_path
            .get()
            .cloned()
            .ok_or_else(|| "启动性能日志尚未初始化".to_string())
    }

    fn append(&self, value: Value) -> Result<(), String> {
        let path = self.log_path()?;
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| "启动性能日志写入锁定失败".to_string())?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| format!("打开启动性能日志失败：{error}"))?;
        serde_json::to_writer(&mut file, &value)
            .map_err(|error| format!("序列化启动性能记录失败：{error}"))?;
        file.write_all(b"\n")
            .map_err(|error| format!("写入启动性能日志失败：{error}"))
    }
}

#[tauri::command]
pub fn record_startup_metrics(
    state: State<'_, StartupPerformanceState>,
    report: FrontendStartupReport,
) -> Result<String, String> {
    Ok(state.record_frontend(report)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_startup_performance_log_path(
    state: State<'_, StartupPerformanceState>,
) -> Result<String, String> {
    Ok(state.log_path()?.to_string_lossy().to_string())
}
