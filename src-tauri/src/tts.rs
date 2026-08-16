use crate::performance::StartupPerformanceState;
use crate::store::AppConfigStore;
use crate::types::tts::{
    default_audio_format, default_builtin_timeout_seconds, default_python_program,
    InstalledTtsModel, TtsEnvironmentCache, TtsEnvironmentCheck, TtsEnvironmentReport,
    TtsModelDescriptor, TtsPreloadPhase, TtsPreloadStatus, TtsPreparationResult, TtsRuntime,
    TtsSynthesisRequest, TtsSynthesisResult, TtsVoice,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StandardMutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tokio::time::timeout;

const MANIFEST_FILE: &str = "bilimaku-tts.json";
const LEGACY_MANIFEST_FILE: &str = "bilicast-tts.json";
const CHINESE_BERT_DIRECTORY: &str = "chinese-roberta-wwm-ext-large";
const MAX_AUDIO_BYTES: u64 = 100 * 1024 * 1024;
const BERT_VITS2_ADAPTER_ID: &str = "bert-vits2";
const BERT_VITS2_ADAPTER_CACHE_VERSION: &str = "bert-vits2-v3";
const TTS_ENVIRONMENT_CACHE_VERSION: &str = "tts-environment-v2";
const TTS_WORKER_IPC_PREFIX: &str = "BILIMAKU_TTS_IPC:";
const TTS_WORKER_STDERR_TAIL_LINES: usize = 80;
/// TTS 后台预热状态事件名。
pub const TTS_PRELOAD_EVENT_NAME: &str = "tts://preload-status";
static OUTPUT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

// 这些文件由 bilimaku 自己维护版本。导入模型目录始终只读，不会被写入
// bilimaku 专用清单、脚本或缓存。
const BERT_VITS2_ADAPTER_FILES: &[(&str, &[u8])] = &[
    (
        "infer.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/infer.py"),
    ),
    (
        "README.md",
        include_bytes!("../resources/tts-adapters/bert-vits2/README.md"),
    ),
    (
        "requirements.txt",
        include_bytes!("../resources/tts-adapters/bert-vits2/requirements.txt"),
    ),
    (
        "upstream/LICENSE",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/LICENSE"),
    ),
    (
        "upstream/attentions.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/attentions.py"),
    ),
    (
        "upstream/commons.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/commons.py"),
    ),
    (
        "upstream/models.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/models.py"),
    ),
    (
        "upstream/modules.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/modules.py"),
    ),
    (
        "upstream/transforms.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/transforms.py"),
    ),
    (
        "upstream/utils.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/utils.py"),
    ),
    (
        "upstream/monotonic_align/core.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/monotonic_align/core.py"),
    ),
    (
        "upstream/monotonic_align/__init__.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/monotonic_align/__init__.py"),
    ),
    (
        "upstream/text/chinese.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/chinese.py"),
    ),
    (
        "upstream/text/chinese_bert.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/chinese_bert.py"),
    ),
    (
        "upstream/text/cleaner.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/cleaner.py"),
    ),
    (
        "upstream/text/english_bert_mock.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/english_bert_mock.py"),
    ),
    (
        "upstream/text/opencpop-strict.txt",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/opencpop-strict.txt"),
    ),
    (
        "upstream/text/symbols.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/symbols.py"),
    ),
    (
        "upstream/text/tone_sandhi.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/tone_sandhi.py"),
    ),
    (
        "upstream/text/__init__.py",
        include_bytes!("../resources/tts-adapters/bert-vits2/upstream/text/__init__.py"),
    ),
];

#[derive(Default)]
pub struct TtsWorkerState {
    worker: Mutex<Option<BuiltinTtsWorker>>,
    preload_status: StandardMutex<TtsPreloadStatus>,
    preload_generation: AtomicU64,
}

impl TtsWorkerState {
    /// 返回当前后台预热状态的内存快照。
    fn preload_status(&self) -> Result<TtsPreloadStatus, String> {
        self.preload_status
            .lock()
            .map(|status| status.clone())
            .map_err(|_| "TTS 后台预热状态锁定失败".to_string())
    }
}

struct BuiltinTtsWorker {
    key: String,
    child: Child,
    stdin: ChildStdin,
    stdout: Lines<BufReader<ChildStdout>>,
    preparation: TtsPreparationResult,
    pid: Option<u32>,
    stderr_tail: Arc<StandardMutex<VecDeque<String>>>,
}

struct BuiltinTtsWorkerConfig {
    key: String,
    python_program: String,
    entrypoint: PathBuf,
    model_dir: PathBuf,
    bert_dir: PathBuf,
}

trait TtsModelAdapter {
    fn id(&self) -> &'static str;
    fn detect(&self, model_dir: &Path) -> Result<Option<TtsModelDescriptor>, String>;
}

struct BertVits2Adapter;
struct ManifestAdapter;

impl TtsModelAdapter for BertVits2Adapter {
    fn id(&self) -> &'static str {
        BERT_VITS2_ADAPTER_ID
    }

    fn detect(&self, model_dir: &Path) -> Result<Option<TtsModelDescriptor>, String> {
        let config_path = model_dir.join("config.json");
        if !config_path.is_file() {
            return Ok(None);
        }

        let config_bytes = fs::read(&config_path)
            .map_err(|error| format!("读取 {} 失败：{error}", config_path.display()))?;
        let config: Value = match serde_json::from_slice(&config_bytes) {
            Ok(value) => value,
            Err(_) => return Ok(None),
        };
        let speaker_map = match config
            .get("data")
            .and_then(|value| value.get("spk2id"))
            .and_then(Value::as_object)
        {
            Some(value) if !value.is_empty() => value,
            _ => return Ok(None),
        };
        let model = match config.get("model").and_then(Value::as_object) {
            Some(value) => value,
            None => return Ok(None),
        };
        let has_bert_vits2_signature = [
            "use_spk_conditioned_encoder",
            "use_noise_scaled_mas",
            "use_duration_discriminator",
        ]
        .iter()
        .any(|key| model.contains_key(*key));
        if !has_bert_vits2_signature {
            return Ok(None);
        }

        let checkpoint = latest_generator_checkpoint(model_dir)?.ok_or_else(|| {
            "已识别为 Bert-VITS2，但目录中缺少 G_<step>.pth 生成器权重".to_string()
        })?;

        let mut indexed_voices = speaker_map
            .iter()
            .filter_map(|(name, value)| value.as_i64().map(|index| (index, name.clone())))
            .collect::<Vec<_>>();
        indexed_voices
            .sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
        if indexed_voices.is_empty() {
            return Err("Bert-VITS2 的 data.spk2id 中没有可用音色".to_string());
        }
        let voices = indexed_voices
            .into_iter()
            .map(|(_, name)| TtsVoice {
                id: name.clone(),
                name,
                language: "zh-CN".to_string(),
            })
            .collect::<Vec<_>>();
        let paimon = "\u{6d3e}\u{8499}";
        let default_voice = voices
            .iter()
            .find(|voice| voice.id == paimon)
            .or_else(|| voices.first())
            .map(|voice| voice.id.clone())
            .unwrap_or_default();

        let checkpoint_name = checkpoint
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("G_unknown.pth");
        let checkpoint_size = fs::metadata(&checkpoint)
            .map(|value| value.len())
            .unwrap_or(0);
        let mut hasher = Sha256::new();
        hasher.update(&config_bytes);
        hasher.update(checkpoint_name.as_bytes());
        hasher.update(checkpoint_size.to_le_bytes());
        let digest = format!("{:x}", hasher.finalize());
        let folder_name = model_dir
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("model");
        let slug = ascii_slug(folder_name);
        let checkpoint_step = checkpoint_step(checkpoint_name)
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unknown".to_string());
        let sample_rate = config
            .get("data")
            .and_then(|value| value.get("sampling_rate"))
            .and_then(Value::as_u64)
            .unwrap_or_default();

        Ok(Some(TtsModelDescriptor {
            schema_version: 1,
            id: format!("bert-vits2-{slug}-{}", &digest[..12]),
            name: format!("{folder_name} · Bert-VITS2"),
            description: format!(
                "bilimaku 自动识别的 Bert-VITS2 模型，共 {} 个音色，{} Hz",
                voices.len(),
                sample_rate
            ),
            version: format!("checkpoint-{checkpoint_step}"),
            author: "原始模型目录".to_string(),
            runtime: TtsRuntime::Builtin {
                adapter: BERT_VITS2_ADAPTER_ID.to_string(),
                python_program: default_python_program(),
                output_format: default_audio_format(),
                timeout_seconds: default_builtin_timeout_seconds(),
            },
            voices,
            default_voice,
        }))
    }
}

impl TtsModelAdapter for ManifestAdapter {
    fn id(&self) -> &'static str {
        "manifest"
    }

    fn detect(&self, model_dir: &Path) -> Result<Option<TtsModelDescriptor>, String> {
        let current = model_dir.join(MANIFEST_FILE);
        let legacy = model_dir.join(LEGACY_MANIFEST_FILE);
        let path = if current.is_file() {
            current
        } else if legacy.is_file() {
            legacy
        } else {
            return Ok(None);
        };
        let bytes = fs::read(&path)
            .map_err(|error| format!("读取旧版适配清单 {} 失败：{error}", path.display()))?;
        let descriptor = serde_json::from_slice(&bytes)
            .map_err(|error| format!("解析旧版适配清单 {} 失败：{error}", path.display()))?;
        Ok(Some(descriptor))
    }
}

fn adapters() -> [&'static dyn TtsModelAdapter; 2] {
    static BERT_VITS2: BertVits2Adapter = BertVits2Adapter;
    static MANIFEST: ManifestAdapter = ManifestAdapter;
    [&BERT_VITS2, &MANIFEST]
}

fn detect_tts_model(model_dir: &Path) -> Result<TtsModelDescriptor, String> {
    let available = adapters();
    for adapter in &available {
        if let Some(descriptor) = adapter.detect(model_dir)? {
            validate_descriptor(&descriptor)?;
            return Ok(descriptor);
        }
    }
    Err(format!(
        "尚未识别这个 TTS 目录；已尝试适配器：{}。当前原生识别 Bert-VITS2，其他架构可继续在 bilimaku 适配器注册表中扩展",
        available
            .iter()
            .map(|adapter| adapter.id())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn latest_generator_checkpoint(model_dir: &Path) -> Result<Option<PathBuf>, String> {
    let entries = fs::read_dir(model_dir)
        .map_err(|error| format!("扫描模型目录 {} 失败：{error}", model_dir.display()))?;
    let mut checkpoints = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("读取模型目录条目失败：{error}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if let Some(step) = checkpoint_step(name) {
            checkpoints.push((step, path));
        }
    }
    checkpoints.sort_by_key(|(step, _)| *step);
    Ok(checkpoints.pop().map(|(_, path)| path))
}

fn checkpoint_step(name: &str) -> Option<u64> {
    name.strip_prefix("G_")?.strip_suffix(".pth")?.parse().ok()
}

fn ascii_slug(value: &str) -> String {
    let mut result = String::new();
    let mut last_was_dash = false;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            result.push(character.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash && !result.is_empty() {
            result.push('-');
            last_was_dash = true;
        }
        if result.len() >= 32 {
            break;
        }
    }
    while result.ends_with('-') {
        result.pop();
    }
    if result.is_empty() {
        "model".to_string()
    } else {
        result
    }
}

fn registry_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位 TTS 配置目录失败：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("创建 TTS 配置目录失败：{error}"))?;
    Ok(dir)
}

fn load_registry(store: &AppConfigStore) -> Result<Vec<InstalledTtsModel>, String> {
    serde_json::from_value(Value::Array(store.tts_models()?))
        .map_err(|error| format!("解析统一配置中的 TTS 模型注册表失败：{error}"))
}

fn save_registry(store: &AppConfigStore, models: &[InstalledTtsModel]) -> Result<(), String> {
    let value = serde_json::to_value(models)
        .map_err(|error| format!("序列化 TTS 模型注册表失败：{error}"))?;
    let Value::Array(models) = value else {
        return Err("TTS 模型注册表序列化结果不是数组".to_string());
    };
    store.set_tts_models(models)?;
    Ok(())
}

fn validate_descriptor(descriptor: &TtsModelDescriptor) -> Result<(), String> {
    if descriptor.schema_version != 1 {
        return Err(format!(
            "TTS 描述版本 {} 尚未适配，当前支持 schemaVersion=1",
            descriptor.schema_version
        ));
    }
    if descriptor.id.is_empty()
        || descriptor.id.len() > 64
        || !descriptor
            .id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.'))
    {
        return Err("模型 id 需要由 1-64 位字母、数字、点、横线或下划线组成".to_string());
    }
    if descriptor.name.trim().is_empty() {
        return Err("模型名称为空".to_string());
    }

    let mut voice_ids = HashSet::new();
    for voice in &descriptor.voices {
        if voice.id.trim().is_empty() || voice.name.trim().is_empty() {
            return Err("音色 id 与名称均需要填写".to_string());
        }
        if !voice_ids.insert(voice.id.as_str()) {
            return Err(format!("音色 id 重复：{}", voice.id));
        }
    }
    if !descriptor.default_voice.is_empty()
        && !descriptor
            .voices
            .iter()
            .any(|voice| voice.id == descriptor.default_voice)
    {
        return Err(format!(
            "默认音色 {} 不在 voices 列表中",
            descriptor.default_voice
        ));
    }

    match &descriptor.runtime {
        TtsRuntime::Builtin {
            adapter,
            python_program,
            output_format,
            timeout_seconds,
        } => {
            if adapter != BERT_VITS2_ADAPTER_ID {
                return Err(format!("内置 TTS 适配器 {adapter} 尚未注册"));
            }
            if python_program.trim().is_empty() {
                return Err("内置 TTS 适配器缺少 Python 程序".to_string());
            }
            validate_audio_format(output_format)?;
            validate_timeout(*timeout_seconds)?;
        }
        TtsRuntime::Command {
            program,
            args,
            output_format,
            timeout_seconds,
        } => {
            if program.trim().is_empty() {
                return Err("命令运行时缺少 program".to_string());
            }
            if !args.iter().any(|arg| arg.contains("{output}")) {
                return Err("命令运行时 args 需要包含 {output} 占位符".to_string());
            }
            validate_audio_format(output_format)?;
            validate_timeout(*timeout_seconds)?;
        }
        TtsRuntime::OpenaiHttp {
            endpoint,
            model,
            response_format,
            timeout_seconds,
            ..
        } => {
            let endpoint = reqwest::Url::parse(endpoint)
                .map_err(|error| format!("TTS HTTP endpoint 格式错误：{error}"))?;
            if !matches!(endpoint.scheme(), "http" | "https") {
                return Err("TTS HTTP endpoint 仅支持 http 或 https".to_string());
            }
            if model.trim().is_empty() {
                return Err("OpenAI 兼容运行时缺少 model".to_string());
            }
            validate_audio_format(response_format)?;
            validate_timeout(*timeout_seconds)?;
        }
    }
    Ok(())
}

fn validate_timeout(seconds: u64) -> Result<(), String> {
    if (5..=900).contains(&seconds) {
        Ok(())
    } else {
        Err("TTS timeoutSeconds 需要位于 5-900 秒".to_string())
    }
}

fn validate_audio_format(format: &str) -> Result<(), String> {
    if matches!(
        format.to_ascii_lowercase().as_str(),
        "wav" | "mp3" | "ogg" | "flac"
    ) {
        Ok(())
    } else {
        Err(format!("尚未识别音频格式：{format}"))
    }
}

fn audio_mime(format: &str) -> &'static str {
    match format.to_ascii_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        _ => "audio/wav",
    }
}

fn data_url(bytes: Vec<u8>, format: &str) -> Result<TtsSynthesisResult, String> {
    if bytes.is_empty() {
        return Err("TTS 运行时返回了空音频".to_string());
    }
    if bytes.len() as u64 > MAX_AUDIO_BYTES {
        return Err("TTS 单次音频超过 100 MiB 上限".to_string());
    }
    let mime_type = audio_mime(format).to_string();
    let prefix = format!("data:{mime_type};base64,");
    let encoded_length = bytes.len().div_ceil(3) * 4;
    let mut audio_data_url = String::with_capacity(prefix.len() + encoded_length);
    audio_data_url.push_str(&prefix);
    STANDARD.encode_string(&bytes, &mut audio_data_url);
    Ok(TtsSynthesisResult {
        audio_data_url,
        mime_type,
        bytes: bytes.len(),
    })
}

fn expand_arg(
    value: &str,
    model_dir: &Path,
    output: &Path,
    request: &TtsSynthesisRequest,
    voice: &str,
) -> String {
    value
        .replace("{modelDir}", &model_dir.to_string_lossy())
        .replace("{output}", &output.to_string_lossy())
        .replace("{text}", &request.text)
        .replace("{voice}", voice)
        .replace("{speed}", &format!("{:.3}", request.speed))
}

fn ensure_builtin_adapter(app: &AppHandle, adapter: &str) -> Result<PathBuf, String> {
    if adapter != BERT_VITS2_ADAPTER_ID {
        return Err(format!("内置 TTS 适配器 {adapter} 尚未注册"));
    }
    let adapter_dir = registry_dir(app)?
        .join("tts-adapters")
        .join(BERT_VITS2_ADAPTER_CACHE_VERSION);
    for (relative_path, expected) in BERT_VITS2_ADAPTER_FILES {
        let destination = adapter_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建内置 TTS 适配器目录失败：{error}"))?;
        }
        let current_matches = fs::read(&destination)
            .map(|bytes| bytes.as_slice() == *expected)
            .unwrap_or(false);
        if !current_matches {
            fs::write(&destination, expected).map_err(|error| {
                format!(
                    "写入内置 TTS 适配器 {} 失败：{error}",
                    destination.display()
                )
            })?;
        }
    }
    Ok(adapter_dir)
}

fn builtin_worker_config(
    app: &AppHandle,
    store: &AppConfigStore,
    installed: &InstalledTtsModel,
    adapter: &str,
    python_fallback: &str,
) -> Result<BuiltinTtsWorkerConfig, String> {
    let adapter_dir = ensure_builtin_adapter(app, adapter)?;
    let python_program = resolve_builtin_python(app, installed, adapter, python_fallback)?;
    let model_dir = fs::canonicalize(&installed.model_dir)
        .map_err(|error| format!("读取 TTS 模型目录失败：{error}"))?;
    let bert_dir = resolve_ready_bert_resource(store, &model_dir, &adapter_dir)?;
    let entrypoint = adapter_dir.join("infer.py");
    let key = format!(
        "{}|{}|{}|{}",
        BERT_VITS2_ADAPTER_CACHE_VERSION,
        python_program,
        model_dir.display(),
        bert_dir.display()
    );
    Ok(BuiltinTtsWorkerConfig {
        key,
        python_program,
        entrypoint,
        model_dir,
        bert_dir,
    })
}

fn record_tts_diagnostic(app: &AppHandle, stage: &str, duration_ms: Option<f64>, detail: String) {
    let logger = app.state::<StartupPerformanceState>();
    if let Err(error) = logger.mark("tts", stage, duration_ms, Some(detail)) {
        eprintln!("bilimaku TTS diagnostic log warning: {error}");
    }
}

fn worker_stderr_snapshot(tail: &Arc<StandardMutex<VecDeque<String>>>) -> String {
    tail.lock()
        .map(|lines| lines.iter().cloned().collect::<Vec<_>>().join(" | "))
        .unwrap_or_else(|_| "stderr tail lock poisoned".to_string())
}

fn worker_exit_status(status: &ExitStatus) -> String {
    status
        .code()
        .map(|code| format!("exit-code={code}"))
        .unwrap_or_else(|| format!("status={status}"))
}

async fn worker_failure_detail(worker: &mut BuiltinTtsWorker, cause: &str) -> String {
    let status = match worker.child.try_wait() {
        Ok(Some(status)) => worker_exit_status(&status),
        Ok(None) => {
            // stdout 关闭与进程状态更新之间可能存在一个很短的竞态窗口。
            tokio::time::sleep(Duration::from_millis(25)).await;
            match worker.child.try_wait() {
                Ok(Some(status)) => worker_exit_status(&status),
                Ok(None) => "worker-still-running".to_string(),
                Err(error) => format!("status-check-error={error}"),
            }
        }
        Err(error) => format!("status-check-error={error}"),
    };
    let stderr = worker_stderr_snapshot(&worker.stderr_tail);
    format!(
        "{cause}；worker_pid={}；{status}；stderr_tail={}",
        worker
            .pid
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unknown".to_string()),
        if stderr.is_empty() {
            "<empty>"
        } else {
            &stderr
        }
    )
}

async fn read_tts_worker_message(
    stdout: &mut Lines<BufReader<ChildStdout>>,
    timeout_seconds: u64,
) -> Result<Value, String> {
    timeout(Duration::from_secs(timeout_seconds), async {
        loop {
            let line = stdout
                .next_line()
                .await
                .map_err(|error| format!("读取 TTS worker 输出失败：{error}"))?
                .ok_or_else(|| "TTS worker 已退出".to_string())?;
            let Some(payload) = line.strip_prefix(TTS_WORKER_IPC_PREFIX) else {
                continue;
            };
            return serde_json::from_str(payload)
                .map_err(|error| format!("解析 TTS worker 响应失败：{error}"));
        }
    })
    .await
    .map_err(|_| format!("等待 TTS worker 超过 {timeout_seconds} 秒"))?
}

async fn spawn_builtin_worker(
    model_id: &str,
    config: BuiltinTtsWorkerConfig,
    timeout_seconds: u64,
) -> Result<BuiltinTtsWorker, String> {
    let mut command = Command::new(&config.python_program);
    command
        .current_dir(&config.model_dir)
        .arg(&config.entrypoint)
        .arg("--worker")
        .arg("--model-dir")
        .arg(&config.model_dir)
        .env("BILIMAKU_TTS_BERT_DIR", &config.bert_dir)
        .env("PYTHONUTF8", "1")
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x0800_0000);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("启动常驻 TTS worker 失败：{error}"))?;
    let pid = child.id();
    let stderr_tail = Arc::new(StandardMutex::new(VecDeque::with_capacity(
        TTS_WORKER_STDERR_TAIL_LINES,
    )));
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "TTS worker stdin 初始化失败".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "TTS worker stdout 初始化失败".to_string())?;
    if let Some(stderr) = child.stderr.take() {
        let captured_tail = Arc::clone(&stderr_tail);
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("bilimaku TTS worker: {line}");
                if let Ok(mut tail) = captured_tail.lock() {
                    if tail.len() == TTS_WORKER_STDERR_TAIL_LINES {
                        tail.pop_front();
                    }
                    tail.push_back(line);
                }
            }
        });
    }

    let mut stdout = BufReader::new(stdout).lines();
    let ready = match read_tts_worker_message(&mut stdout, timeout_seconds).await {
        Ok(value) => value,
        Err(error) => {
            let _ = child.kill().await;
            return Err(error);
        }
    };
    if ready.get("ok").and_then(Value::as_bool) != Some(true) {
        let detail = ready
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("模型初始化失败");
        let _ = child.kill().await;
        return Err(format!("TTS worker 预热失败：{detail}"));
    }

    let preparation = TtsPreparationResult {
        model_id: model_id.to_string(),
        ready: true,
        reused: false,
        device: ready
            .get("device")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        gpu: ready
            .get("gpu")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        torch_version: ready
            .get("torch")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        cuda_runtime: ready
            .get("cudaRuntime")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        gpu_memory_mb: ready
            .get("gpuMemoryMb")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
        load_ms: ready
            .pointer("/timings/totalLoadMs")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
    };

    Ok(BuiltinTtsWorker {
        key: config.key,
        child,
        stdin,
        stdout,
        preparation,
        pid,
        stderr_tail,
    })
}

async fn ensure_builtin_worker(
    app: &AppHandle,
    slot: &mut Option<BuiltinTtsWorker>,
    model_id: &str,
    config: BuiltinTtsWorkerConfig,
    timeout_seconds: u64,
) -> Result<TtsPreparationResult, String> {
    if let Some(worker) = slot.as_mut() {
        let status = worker
            .child
            .try_wait()
            .map_err(|error| format!("检查 TTS worker 状态失败：{error}"))?;
        if status.is_none() && worker.key == config.key {
            let mut result = worker.preparation.clone();
            result.reused = true;
            return Ok(result);
        }
        let stderr = worker_stderr_snapshot(&worker.stderr_tail);
        let detail = if let Some(status) = status {
            format!(
                "model={model_id}, worker_pid={}, {}, stderr_tail={}",
                worker
                    .pid
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "unknown".into()),
                worker_exit_status(&status),
                if stderr.is_empty() {
                    "<empty>"
                } else {
                    &stderr
                }
            )
        } else {
            format!(
                "model={model_id}, worker_pid={}, reason=model-or-runtime-changed",
                worker
                    .pid
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "unknown".into())
            )
        };
        record_tts_diagnostic(app, "tts-worker-replaced", None, detail);
    }

    if let Some(mut previous) = slot.take() {
        let _ = previous.child.kill().await;
    }
    let worker = match spawn_builtin_worker(model_id, config, timeout_seconds).await {
        Ok(worker) => worker,
        Err(error) => {
            record_tts_diagnostic(
                app,
                "tts-worker-start-failed",
                None,
                format!("model={model_id}, error={error}"),
            );
            return Err(error);
        }
    };
    let result = worker.preparation.clone();
    record_tts_diagnostic(
        app,
        "tts-worker-ready",
        Some(result.load_ms as f64),
        format!(
            "model={model_id}, worker_pid={}, device={}, gpu={}, gpu_allocated_mb={}",
            worker
                .pid
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".into()),
            result.device,
            result.gpu,
            result.gpu_memory_mb
        ),
    );
    *slot = Some(worker);
    Ok(result)
}

fn tts_output_path(app: &AppHandle, output_format: &str) -> Result<PathBuf, String> {
    let output_dir = registry_dir(app)?.join("tts-output");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("创建 TTS 临时输出目录失败：{error}"))?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or_default();
    let sequence = OUTPUT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    Ok(output_dir.join(format!("speech-{timestamp}-{sequence}.{output_format}")))
}

fn read_tts_output(output: &Path, output_format: &str) -> Result<TtsSynthesisResult, String> {
    let metadata = fs::metadata(output)
        .map_err(|error| format!("TTS worker 未生成音频 {}：{error}", output.display()))?;
    if metadata.len() > MAX_AUDIO_BYTES {
        let _ = fs::remove_file(output);
        return Err("TTS 单次音频超过 100 MiB 上限".to_string());
    }
    let bytes = fs::read(output).map_err(|error| format!("读取 TTS 音频失败：{error}"))?;
    let _ = fs::remove_file(output);
    data_url(bytes, output_format)
}

async fn synthesize_with_builtin_worker(
    app: &AppHandle,
    store: &AppConfigStore,
    state: &TtsWorkerState,
    installed: &InstalledTtsModel,
    request: &TtsSynthesisRequest,
    adapter: &str,
    python_fallback: &str,
    output_format: &str,
    timeout_seconds: u64,
) -> Result<TtsSynthesisResult, String> {
    let config = builtin_worker_config(app, store, installed, adapter, python_fallback)?;
    let output = tts_output_path(app, output_format)?;
    let request_id = OUTPUT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let voice = if request.voice.trim().is_empty() {
        installed.descriptor.default_voice.as_str()
    } else {
        request.voice.trim()
    };

    let mut slot = state.worker.lock().await;
    let preparation = ensure_builtin_worker(
        app,
        &mut slot,
        &installed.descriptor.id,
        config,
        timeout_seconds,
    )
    .await?;
    let worker_pid = slot.as_ref().and_then(|worker| worker.pid);
    let text_chars = request.text.chars().count();
    record_tts_diagnostic(
        app,
        "tts-inference-started",
        None,
        format!(
            "model={}, request_id={request_id}, worker_pid={}, text_chars={text_chars}, device={}",
            installed.descriptor.id,
            worker_pid
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            preparation.device
        ),
    );

    let payload = json!({
        "type": "synthesize",
        "id": request_id,
        "text": request.text,
        "voice": voice,
        "speed": request.speed,
        "output": output,
    });
    let line = serde_json::to_vec(&payload)
        .map_err(|error| format!("编码 TTS worker 请求失败：{error}"))?;

    let response_result = async {
        let worker = slot
            .as_mut()
            .ok_or_else(|| "TTS worker 状态丢失".to_string())?;
        worker
            .stdin
            .write_all(&line)
            .await
            .map_err(|error| format!("写入 TTS worker 请求失败：{error}"))?;
        worker
            .stdin
            .write_all(b"\n")
            .await
            .map_err(|error| format!("写入 TTS worker 换行失败：{error}"))?;
        worker
            .stdin
            .flush()
            .await
            .map_err(|error| format!("刷新 TTS worker 请求失败：{error}"))?;
        read_tts_worker_message(&mut worker.stdout, timeout_seconds).await
    }
    .await;

    let response = match response_result {
        Ok(value) => value,
        Err(error) => {
            let _ = fs::remove_file(&output);
            let detail = if let Some(mut broken) = slot.take() {
                let detail = worker_failure_detail(&mut broken, &error).await;
                let _ = broken.child.kill().await;
                detail
            } else {
                error
            };
            record_tts_diagnostic(
                app,
                "tts-worker-io-failed",
                None,
                format!(
                    "model={}, request_id={request_id}, {detail}",
                    installed.descriptor.id
                ),
            );
            return Err(detail);
        }
    };
    if response.get("id").and_then(Value::as_u64) != Some(request_id) {
        let _ = fs::remove_file(&output);
        let error = "TTS worker 返回了不匹配的请求编号".to_string();
        record_tts_diagnostic(
            app,
            "tts-worker-protocol-failed",
            None,
            format!("model={}, request_id={request_id}", installed.descriptor.id),
        );
        if let Some(mut broken) = slot.take() {
            let _ = broken.child.kill().await;
        }
        return Err(error);
    }
    if response.get("ok").and_then(Value::as_bool) != Some(true) {
        let _ = fs::remove_file(&output);
        let error = response
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("TTS worker 推理失败")
            .to_string();
        let memory = response
            .get("memory")
            .map(Value::to_string)
            .unwrap_or_else(|| "null".to_string());
        record_tts_diagnostic(
            app,
            "tts-inference-failed",
            None,
            format!(
                "model={}, request_id={request_id}, error={error}, memory={memory}",
                installed.descriptor.id
            ),
        );
        return Err(error);
    }

    let inference_ms = response
        .pointer("/timings/inferenceMs")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let total_ms = response
        .pointer("/timings/totalMs")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let gpu_allocated_mb = response
        .pointer("/timings/memory/after/gpuAllocatedMb")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let gpu_reserved_mb = response
        .pointer("/timings/memory/after/gpuReservedMb")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let gpu_peak_mb = response
        .pointer("/timings/memory/after/gpuPeakAllocatedMb")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let gpu_free_mb = response
        .pointer("/timings/memory/after/gpuFreeMb")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let commit_available_mb = response
        .pointer("/timings/memory/after/commitAvailableMb")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let commit_used_percent = response
        .pointer("/timings/memory/after/commitUsedPercent")
        .and_then(Value::as_f64)
        .unwrap_or_default();
    let cache_released = response
        .pointer("/timings/memory/after/cacheReleased")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    record_tts_diagnostic(
        app,
        "tts-worker-response-received",
        Some(inference_ms as f64),
        format!(
            "model={}, request_id={request_id}, worker_pid={}, inference_ms={inference_ms}, total_ms={total_ms}, gpu_allocated_mb={gpu_allocated_mb}, gpu_reserved_mb={gpu_reserved_mb}, gpu_peak_mb={gpu_peak_mb}, gpu_free_mb={gpu_free_mb}, commit_available_mb={commit_available_mb}, commit_used_percent={commit_used_percent:.1}, cache_released={cache_released}",
            installed.descriptor.id,
            worker_pid
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        ),
    );

    match read_tts_output(&output, output_format) {
        Ok(result) => {
            record_tts_diagnostic(
                app,
                "tts-inference-finished",
                Some(total_ms as f64),
                format!(
                    "model={}, request_id={request_id}, worker_pid={}, audio_bytes={}",
                    installed.descriptor.id,
                    worker_pid
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "unknown".to_string()),
                    result.bytes
                ),
            );
            eprintln!(
                "bilimaku TTS inference: model={}, device={}, warm_worker={}, inference_ms={}, gpu_allocated_mb={}, gpu_reserved_mb={}, gpu_peak_mb={}, gpu_free_mb={}, commit_available_mb={}, cache_released={}",
                installed.descriptor.id,
                preparation.device,
                preparation.reused,
                inference_ms,
                gpu_allocated_mb,
                gpu_reserved_mb,
                gpu_peak_mb,
                gpu_free_mb,
                commit_available_mb,
                cache_released
            );
            Ok(result)
        }
        Err(error) => {
            record_tts_diagnostic(
                app,
                "tts-output-read-failed",
                None,
                format!(
                    "model={}, request_id={request_id}, error={error}",
                    installed.descriptor.id
                ),
            );
            Err(error)
        }
    }
}

async fn synthesize_command(
    app: &AppHandle,
    installed: &InstalledTtsModel,
    request: &TtsSynthesisRequest,
    program: &str,
    args: &[String],
    output_format: &str,
    timeout_seconds: u64,
    environment: &[(String, String)],
) -> Result<TtsSynthesisResult, String> {
    let model_dir = PathBuf::from(&installed.model_dir);
    let output_dir = registry_dir(app)?.join("tts-output");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("创建 TTS 临时输出目录失败：{error}"))?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or_default();
    let sequence = OUTPUT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let output = output_dir.join(format!("speech-{timestamp}-{sequence}.{output_format}"));
    let voice = if request.voice.trim().is_empty() {
        installed.descriptor.default_voice.as_str()
    } else {
        request.voice.trim()
    };

    let expanded_program = expand_arg(program, &model_dir, &output, request, voice);
    let program_path = PathBuf::from(&expanded_program);
    let local_program = model_dir.join(&program_path);
    let executable = if program_path.is_absolute() || !local_program.exists() {
        program_path
    } else {
        local_program
    };

    let mut command = Command::new(executable);
    command
        .current_dir(&model_dir)
        .args(
            args.iter()
                .map(|arg| expand_arg(arg, &model_dir, &output, request, voice)),
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    command.envs(environment.iter().map(|(key, value)| (key, value)));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x0800_0000);
    }

    let result = timeout(Duration::from_secs(timeout_seconds), command.output())
        .await
        .map_err(|_| format!("TTS 推理超过 {timeout_seconds} 秒，任务已终止"))?
        .map_err(|error| format!("启动 TTS 命令失败：{error}"))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let detail = stderr.trim().chars().take(800).collect::<String>();
        return Err(format!(
            "TTS 命令退出码 {}：{}",
            result.status.code().unwrap_or(-1),
            if detail.is_empty() {
                "未返回错误文本"
            } else {
                &detail
            }
        ));
    }
    let metadata = fs::metadata(&output)
        .map_err(|error| format!("TTS 命令未生成预期音频 {}：{error}", output.display()))?;
    if metadata.len() > MAX_AUDIO_BYTES {
        let _ = fs::remove_file(&output);
        return Err("TTS 单次音频超过 100 MiB 上限".to_string());
    }
    let bytes = fs::read(&output).map_err(|error| format!("读取 TTS 音频失败：{error}"))?;
    let _ = fs::remove_file(output);
    data_url(bytes, output_format)
}

async fn synthesize_builtin(
    app: &AppHandle,
    store: &AppConfigStore,
    state: &TtsWorkerState,
    installed: &InstalledTtsModel,
    request: &TtsSynthesisRequest,
    adapter: &str,
    python_program: &str,
    output_format: &str,
    timeout_seconds: u64,
) -> Result<TtsSynthesisResult, String> {
    synthesize_with_builtin_worker(
        app,
        store,
        state,
        installed,
        request,
        adapter,
        python_program,
        output_format,
        timeout_seconds,
    )
    .await
}

fn resolve_builtin_python(
    app: &AppHandle,
    installed: &InstalledTtsModel,
    adapter: &str,
    fallback: &str,
) -> Result<String, String> {
    if let Some(configured) = std::env::var("BILIMAKU_TTS_PYTHON")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            // 兼容旧版环境变量，便于已有运行环境平滑迁移。
            std::env::var("BILICAST_TTS_PYTHON")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
    {
        return Ok(configured);
    }

    let model_dir = Path::new(&installed.model_dir);
    let mut runtime_roots = Vec::new();
    if let Some(model_parent) = model_dir.parent() {
        runtime_roots.push(model_parent.join("runtime").join(adapter));
    }
    runtime_roots.push(registry_dir(app)?.join("tts-runtime").join(adapter));

    for runtime_root in runtime_roots {
        #[cfg(windows)]
        let candidates = [
            runtime_root.join("Scripts").join("python.exe"),
            runtime_root.join("python.exe"),
        ];
        #[cfg(not(windows))]
        let candidates = [
            runtime_root.join("bin").join("python"),
            runtime_root.join("python"),
        ];
        if let Some(candidate) = candidates.into_iter().find(|path| path.is_file()) {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Ok(fallback.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PythonEnvironmentProbe {
    version: String,
    modules: HashMap<String, bool>,
    errors: HashMap<String, String>,
    torch_version: String,
    cuda_available: bool,
    cuda_version: String,
    cuda_device: String,
}

fn environment_check(
    id: &str,
    label: &str,
    state: &str,
    required: bool,
    detail: impl Into<String>,
    guide: impl Into<String>,
    download_url: &str,
) -> TtsEnvironmentCheck {
    TtsEnvironmentCheck {
        id: id.to_string(),
        label: label.to_string(),
        state: state.to_string(),
        required,
        detail: detail.into(),
        guide: guide.into(),
        download_url: download_url.to_string(),
    }
}

fn checked_at() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

fn quoted_program(value: &str) -> String {
    if value.contains([' ', '\t']) {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

async fn run_python_environment_probe(
    python_program: &str,
) -> Result<PythonEnvironmentProbe, String> {
    const PROBE: &str = r#"
import importlib
import json
import sys

required = [
    "torch", "transformers", "numpy", "cn2an", "jieba",
    "numba", "pypinyin", "requests", "scipy", "tqdm"
]
modules = {}
errors = {}
loaded = {}
for name in required:
    try:
        loaded[name] = importlib.import_module(name)
        modules[name] = True
    except BaseException as error:
        modules[name] = False
        errors[name] = f"{type(error).__name__}: {error}"[:300]

torch = loaded.get("torch")
cuda_available = bool(torch and torch.cuda.is_available())
result = {
    "version": sys.version.split()[0],
    "modules": modules,
    "errors": errors,
    "torchVersion": getattr(torch, "__version__", "") if torch else "",
    "cudaAvailable": cuda_available,
    "cudaVersion": str(getattr(getattr(torch, "version", None), "cuda", "") or "") if torch else "",
    "cudaDevice": torch.cuda.get_device_name(0) if cuda_available else "",
}
print(json.dumps(result, ensure_ascii=False))
"#;

    let mut command = Command::new(python_program);
    command
        .arg("-c")
        .arg(PROBE)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x0800_0000);
    }
    let output = timeout(Duration::from_secs(45), command.output())
        .await
        .map_err(|_| "Python 环境检查超过 45 秒".to_string())?
        .map_err(|error| format!("启动 Python 环境检查失败：{error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr)
            .trim()
            .chars()
            .take(600)
            .collect::<String>();
        return Err(if stderr.is_empty() {
            format!("Python 环境检查退出码 {}", output.status)
        } else {
            stderr
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let payload = stdout
        .lines()
        .rev()
        .find(|line| line.trim_start().starts_with('{'))
        .ok_or_else(|| "Python 环境检查没有返回 JSON".to_string())?;
    serde_json::from_str(payload).map_err(|error| format!("解析 Python 环境检查结果失败：{error}"))
}

async fn detect_nvidia_gpu() -> Option<String> {
    let mut command = Command::new("nvidia-smi");
    command
        .args([
            "--query-gpu=name,driver_version,memory.total",
            "--format=csv,noheader",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x0800_0000);
    }
    let output = timeout(Duration::from_secs(5), command.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout)
        .ok()?
        .lines()
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn bert_resource_ready(path: &Path) -> bool {
    validate_chinese_bert_resource(path).is_ok()
}

fn validate_chinese_bert_resource(path: &Path) -> Result<(), String> {
    if !path.is_dir() {
        return Err(format!("BERT 路径不是目录：{}", path.display()));
    }
    let config_path = path.join("config.json");
    if !config_path.is_file() {
        return Err("缺少 config.json".to_string());
    }
    let weight_path = [
        path.join("model.safetensors"),
        path.join("pytorch_model.bin"),
    ]
    .into_iter()
    .find(|candidate| candidate.is_file())
    .ok_or_else(|| "缺少 model.safetensors 或 pytorch_model.bin".to_string())?;
    if fs::metadata(&weight_path)
        .map(|value| value.len())
        .unwrap_or(0)
        < 100 * 1024 * 1024
    {
        return Err(format!("BERT 权重文件体积异常：{}", weight_path.display()));
    }
    if !path.join("tokenizer.json").is_file() && !path.join("vocab.txt").is_file() {
        return Err("缺少 tokenizer.json 或 vocab.txt".to_string());
    }
    let bytes =
        fs::read(&config_path).map_err(|error| format!("读取 BERT config.json 失败：{error}"))?;
    let config: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("解析 BERT config.json 失败：{error}"))?;
    let hidden_size = config.get("hidden_size").and_then(Value::as_u64);
    let layers = config.get("num_hidden_layers").and_then(Value::as_u64);
    if hidden_size != Some(1024) || layers != Some(24) {
        return Err(format!(
            "模型规格与 chinese-roberta-wwm-ext-large 不匹配（hidden_size={hidden_size:?}, layers={layers:?}）"
        ));
    }
    Ok(())
}

fn push_unique_path(candidates: &mut Vec<PathBuf>, seen: &mut HashSet<String>, path: PathBuf) {
    let key = if cfg!(windows) {
        path.to_string_lossy().to_ascii_lowercase()
    } else {
        path.to_string_lossy().to_string()
    };
    if seen.insert(key) {
        candidates.push(path);
    }
}

fn expand_bert_cache_root(
    candidates: &mut Vec<PathBuf>,
    seen: &mut HashSet<String>,
    root: PathBuf,
) {
    push_unique_path(candidates, seen, root.clone());
    push_unique_path(candidates, seen, root.join(CHINESE_BERT_DIRECTORY));
    push_unique_path(
        candidates,
        seen,
        root.join("dienstag").join(CHINESE_BERT_DIRECTORY),
    );
    push_unique_path(
        candidates,
        seen,
        root.join("models")
            .join("dienstag")
            .join(CHINESE_BERT_DIRECTORY),
    );
    push_unique_path(
        candidates,
        seen,
        root.join("hub")
            .join("dienstag")
            .join(CHINESE_BERT_DIRECTORY),
    );

    let snapshots = root
        .join("models--hfl--chinese-roberta-wwm-ext-large")
        .join("snapshots");
    if let Ok(entries) = fs::read_dir(&snapshots) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                push_unique_path(candidates, seen, entry.path());
            }
        }
    }
}

fn expand_model_ancestor_bert_candidates(
    candidates: &mut Vec<PathBuf>,
    seen: &mut HashSet<String>,
    model_dir: &Path,
) {
    for ancestor in model_dir.ancestors().skip(1) {
        expand_bert_cache_root(candidates, seen, ancestor.join(CHINESE_BERT_DIRECTORY));
    }
}

fn bert_resource_candidates(
    store: &AppConfigStore,
    model_dir: &Path,
    adapter_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Some(configured) = std::env::var("BILIMAKU_TTS_BERT_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            // 兼容旧版环境变量，便于已有机器继续复用共享资源。
            std::env::var("BILICAST_TTS_BERT_DIR")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
    {
        expand_bert_cache_root(&mut candidates, &mut seen, PathBuf::from(configured));
    }
    let configured_bert_dir = store.chinese_bert_dir()?;
    if !configured_bert_dir.trim().is_empty() {
        expand_bert_cache_root(
            &mut candidates,
            &mut seen,
            PathBuf::from(configured_bert_dir),
        );
    }

    expand_bert_cache_root(
        &mut candidates,
        &mut seen,
        model_dir.join("bert").join(CHINESE_BERT_DIRECTORY),
    );
    if let Some(parent) = model_dir.parent() {
        expand_bert_cache_root(
            &mut candidates,
            &mut seen,
            parent.join("shared").join(CHINESE_BERT_DIRECTORY),
        );
    }
    expand_model_ancestor_bert_candidates(&mut candidates, &mut seen, model_dir);
    expand_bert_cache_root(
        &mut candidates,
        &mut seen,
        adapter_dir.join("bert").join(CHINESE_BERT_DIRECTORY),
    );

    for variable in [
        "BILIMAKU_TTS_RESOURCE_HOME",
        "BILICAST_TTS_RESOURCE_HOME",
        "HF_HUB_CACHE",
        "HUGGINGFACE_HUB_CACHE",
        "TRANSFORMERS_CACHE",
        "MODELSCOPE_CACHE",
    ] {
        if let Some(value) = std::env::var(variable)
            .ok()
            .filter(|value| !value.trim().is_empty())
        {
            expand_bert_cache_root(&mut candidates, &mut seen, PathBuf::from(value));
        }
    }
    if let Some(hf_home) = std::env::var("HF_HOME")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        expand_bert_cache_root(
            &mut candidates,
            &mut seen,
            PathBuf::from(hf_home).join("hub"),
        );
    }
    if let Some(user_home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        let home = PathBuf::from(user_home);
        expand_bert_cache_root(
            &mut candidates,
            &mut seen,
            home.join(".cache").join("huggingface").join("hub"),
        );
        expand_bert_cache_root(
            &mut candidates,
            &mut seen,
            home.join(".cache").join("modelscope").join("hub"),
        );
    }
    Ok(candidates)
}

fn resolve_ready_bert_resource(
    store: &AppConfigStore,
    model_dir: &Path,
    adapter_dir: &Path,
) -> Result<PathBuf, String> {
    bert_resource_candidates(store, model_dir, adapter_dir)?
        .into_iter()
        .find(|candidate| bert_resource_ready(candidate))
        .ok_or_else(|| {
            "Chinese BERT 资源尚未就绪，请在语音模型页面选择 chinese-roberta-wwm-ext-large 目录"
                .to_string()
        })
}

fn resolve_selected_bert_resource(selection: &Path) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    expand_bert_cache_root(&mut candidates, &mut seen, selection.to_path_buf());
    candidates
        .into_iter()
        .find(|candidate| bert_resource_ready(candidate))
}

fn python_version_supported(version: &str) -> bool {
    let mut parts = version
        .split('.')
        .take(2)
        .filter_map(|value| value.parse::<u32>().ok());
    matches!((parts.next(), parts.next()), (Some(3), Some(minor)) if minor >= 10)
}

fn update_environment_fingerprint_path(hasher: &mut Sha256, path: &Path) {
    hasher.update(path.to_string_lossy().as_bytes());
    match fs::metadata(path) {
        Ok(metadata) => {
            hasher.update([1]);
            hasher.update(metadata.len().to_le_bytes());
            let modified = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_nanos())
                .unwrap_or_default();
            hasher.update(modified.to_le_bytes());
        }
        Err(_) => hasher.update([0]),
    }
}

fn update_model_weight_fingerprints(hasher: &mut Sha256, model_dir: &Path) {
    let Ok(entries) = fs::read_dir(model_dir) else {
        return;
    };
    let mut weights = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(|extension| {
                        matches!(
                            extension.to_ascii_lowercase().as_str(),
                            "pth" | "pt" | "ckpt" | "safetensors" | "bin"
                        )
                    })
                    .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    weights.sort();
    for weight in weights {
        update_environment_fingerprint_path(hasher, &weight);
    }
}

fn update_python_site_packages_fingerprint(hasher: &mut Sha256, site_packages: &Path) {
    update_environment_fingerprint_path(hasher, site_packages);
    let Ok(entries) = fs::read_dir(site_packages) else {
        return;
    };
    const MODULES: &[&str] = &[
        "torch",
        "transformers",
        "numpy",
        "cn2an",
        "jieba",
        "numba",
        "pypinyin",
        "requests",
        "scipy",
        "tqdm",
    ];
    let mut relevant = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                return false;
            };
            let name = name.to_ascii_lowercase().replace('-', "_");
            MODULES.iter().any(|module| {
                name == *module
                    || name.starts_with(&format!("{module}."))
                    || name.starts_with(&format!("{module}_"))
            })
        })
        .collect::<Vec<_>>();
    relevant.sort();
    for path in relevant {
        update_environment_fingerprint_path(hasher, &path);
    }
}

fn update_python_environment_fingerprint(hasher: &mut Sha256, python_path: &Path) {
    update_environment_fingerprint_path(hasher, python_path);
    let Some(parent) = python_path.parent() else {
        return;
    };
    let environment_root = if parent
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("Scripts") || value == "bin")
        .unwrap_or(false)
    {
        parent.parent().unwrap_or(parent)
    } else {
        parent
    };
    update_environment_fingerprint_path(hasher, &environment_root.join("pyvenv.cfg"));
    update_python_site_packages_fingerprint(
        hasher,
        &environment_root.join("Lib").join("site-packages"),
    );
    let unix_lib = environment_root.join("lib");
    if let Ok(entries) = fs::read_dir(&unix_lib) {
        let mut site_packages = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path().join("site-packages"))
            .filter(|path| path.is_dir())
            .collect::<Vec<_>>();
        site_packages.sort();
        for path in site_packages {
            update_python_site_packages_fingerprint(hasher, &path);
        }
    }
}

fn tts_environment_fingerprint(
    app: &AppHandle,
    store: &AppConfigStore,
    installed: &InstalledTtsModel,
) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(TTS_ENVIRONMENT_CACHE_VERSION.as_bytes());
    hasher.update(BERT_VITS2_ADAPTER_CACHE_VERSION.as_bytes());
    hasher.update(
        serde_json::to_vec(installed)
            .map_err(|error| format!("序列化 TTS 环境缓存指纹失败：{error}"))?,
    );

    for variable in [
        "BILIMAKU_TTS_PYTHON",
        "BILICAST_TTS_PYTHON",
        "BILIMAKU_TTS_BERT_DIR",
        "BILICAST_TTS_BERT_DIR",
        "PATH",
    ] {
        hasher.update(variable.as_bytes());
        if let Some(value) = std::env::var_os(variable) {
            hasher.update(value.to_string_lossy().as_bytes());
        }
    }

    let model_dir = Path::new(&installed.model_dir);
    update_environment_fingerprint_path(&mut hasher, model_dir);
    update_environment_fingerprint_path(&mut hasher, &model_dir.join("config.json"));
    update_model_weight_fingerprints(&mut hasher, model_dir);

    let configured_bert = store.chinese_bert_dir()?;
    hasher.update(configured_bert.as_bytes());
    if !configured_bert.trim().is_empty() {
        let bert_dir = Path::new(&configured_bert);
        update_environment_fingerprint_path(&mut hasher, bert_dir);
        for file_name in [
            "config.json",
            "tokenizer.json",
            "vocab.txt",
            "model.safetensors",
            "pytorch_model.bin",
        ] {
            update_environment_fingerprint_path(&mut hasher, &bert_dir.join(file_name));
        }
    }

    if let TtsRuntime::Builtin {
        adapter,
        python_program,
        ..
    } = &installed.descriptor.runtime
    {
        let python_program =
            resolve_builtin_python(app, installed, adapter, python_program.as_str())?;
        hasher.update(python_program.as_bytes());
        if let Some(python_path) = resolve_executable_path(&python_program, model_dir) {
            update_python_environment_fingerprint(&mut hasher, &python_path);
        } else {
            hasher.update([0]);
        }
    }
    if let TtsRuntime::OpenaiHttp { api_key_env, .. } = &installed.descriptor.runtime {
        hasher.update(api_key_env.as_bytes());
        hasher.update([u8::from(
            !api_key_env.trim().is_empty() && std::env::var_os(api_key_env).is_some(),
        )]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn cached_environment_still_available(
    installed: &InstalledTtsModel,
    report: &TtsEnvironmentReport,
) -> bool {
    if report.model_id != installed.descriptor.id || !Path::new(&installed.model_dir).is_dir() {
        return false;
    }
    if !report.ready {
        return true;
    }
    match &installed.descriptor.runtime {
        TtsRuntime::Builtin { .. } => {
            executable_available(&report.python_program, Path::new(&installed.model_dir))
                && validate_chinese_bert_resource(Path::new(&report.resource_directory)).is_ok()
        }
        TtsRuntime::Command { program, .. } => {
            executable_available(program, Path::new(&installed.model_dir))
        }
        TtsRuntime::OpenaiHttp { .. } => true,
    }
}

async fn inspect_builtin_tts_environment(
    app: &AppHandle,
    store: &AppConfigStore,
    installed: &InstalledTtsModel,
    adapter: &str,
    python_fallback: &str,
) -> Result<TtsEnvironmentReport, String> {
    let adapter_dir = ensure_builtin_adapter(app, adapter)?;
    let python_program = resolve_builtin_python(app, installed, adapter, python_fallback)?;
    let model_dir = Path::new(&installed.model_dir);
    let nvidia_gpu = detect_nvidia_gpu().await;
    let probe = run_python_environment_probe(&python_program).await;
    let mut checks = vec![environment_check(
        "adapter",
        "架构适配器",
        "ready",
        true,
        format!("已加载 bilimaku 内置 {adapter} 适配器"),
        "",
        "",
    )];
    let mut setup_commands = Vec::new();
    let mut python_version = String::new();
    let mut acceleration = "unknown".to_string();
    let quoted_python = quoted_program(&python_program);

    match &probe {
        Ok(probe) => {
            python_version.clone_from(&probe.version);
            let supported = python_version_supported(&probe.version);
            checks.push(environment_check(
                "python",
                "Python 运行时",
                if supported { "ready" } else { "missing" },
                true,
                format!("{} · Python {}", python_program, probe.version),
                if supported {
                    ""
                } else {
                    "请安装 Python 3.10 或更高版本，并在 BILIMAKU_TTS_PYTHON 中指定解释器"
                },
                "https://www.python.org/downloads/windows/",
            ));

            let missing_modules = probe
                .modules
                .iter()
                .filter(|(_, ready)| !**ready)
                .map(|(name, _)| name.clone())
                .collect::<Vec<_>>();
            let package_detail = if missing_modules.is_empty() {
                let mut versions = Vec::new();
                if !probe.torch_version.is_empty() {
                    versions.push(format!("torch {}", probe.torch_version));
                }
                format!(
                    "推理依赖已就绪{}",
                    if versions.is_empty() {
                        String::new()
                    } else {
                        format!("（{}）", versions.join(", "))
                    }
                )
            } else {
                let first_error = missing_modules.iter().find_map(|name| {
                    probe
                        .errors
                        .get(name)
                        .map(|error| format!("{name}: {error}"))
                });
                format!(
                    "缺少 {}{}",
                    missing_modules.join(", "),
                    first_error
                        .map(|value| format!("；{value}"))
                        .unwrap_or_default()
                )
            };
            checks.push(environment_check(
                "python-packages",
                "Python 推理依赖",
                if missing_modules.is_empty() {
                    "ready"
                } else {
                    "missing"
                },
                true,
                package_detail,
                if missing_modules.is_empty() {
                    String::new()
                } else if missing_modules.iter().any(|name| name == "torch") {
                    "先选择 GPU 或 CPU 版 PyTorch，再安装适配器 requirements.txt".to_string()
                } else {
                    "安装适配器 requirements.txt 中缺少的依赖".to_string()
                },
                "https://pytorch.org/get-started/locally/",
            ));
            if missing_modules.iter().any(|name| name == "torch") {
                if nvidia_gpu.is_some() {
                    setup_commands.push(format!(
                        "{quoted_python} -m pip install torch --index-url https://download.pytorch.org/whl/cu128"
                    ));
                } else {
                    setup_commands.push(format!(
                        "{quoted_python} -m pip install torch --index-url https://download.pytorch.org/whl/cpu"
                    ));
                }
            }
            if missing_modules.iter().any(|name| name != "torch") {
                setup_commands.push(format!(
                    "{quoted_python} -m pip install -r \"{}\"",
                    adapter_dir.join("requirements.txt").display()
                ));
            }

            if probe.cuda_available {
                acceleration = "cuda".to_string();
                checks.push(environment_check(
                    "acceleration",
                    "计算加速",
                    "ready",
                    false,
                    format!(
                        "{} · CUDA {}",
                        probe.cuda_device,
                        if probe.cuda_version.is_empty() {
                            "runtime"
                        } else {
                            &probe.cuda_version
                        }
                    ),
                    "",
                    "",
                ));
            } else {
                acceleration = "cpu".to_string();
                checks.push(environment_check(
                    "acceleration",
                    "计算加速",
                    "warning",
                    false,
                    nvidia_gpu
                        .clone()
                        .map(|gpu| format!("检测到 {gpu}，当前 PyTorch 尚未启用 CUDA"))
                        .unwrap_or_else(|| "当前使用 CPU 推理，合成速度会较慢".to_string()),
                    "如需显卡加速，请安装与显卡驱动匹配的 CUDA 版 PyTorch wheel",
                    "https://pytorch.org/get-started/locally/",
                ));
            }
        }
        Err(error) => {
            checks.push(environment_check(
                "python",
                "Python 运行时",
                "missing",
                true,
                format!("{python_program}：{error}"),
                "安装 Python 3.10 或更高版本，或通过 BILIMAKU_TTS_PYTHON 指定已有环境",
                "https://www.python.org/downloads/windows/",
            ));
            checks.push(environment_check(
                "python-packages",
                "Python 推理依赖",
                "missing",
                true,
                "等待 Python 运行时就绪后检查",
                "",
                "https://pytorch.org/get-started/locally/",
            ));
            checks.push(environment_check(
                "acceleration",
                "计算加速",
                "warning",
                false,
                nvidia_gpu
                    .clone()
                    .map(|gpu| format!("检测到 {gpu}"))
                    .unwrap_or_else(|| "尚未检测到 NVIDIA CUDA 设备，将使用 CPU 路径".to_string()),
                "",
                "",
            ));
        }
    }

    let bert_candidates = bert_resource_candidates(store, model_dir, &adapter_dir)?;
    let ready_bert = bert_candidates
        .iter()
        .find(|candidate| bert_resource_ready(candidate));
    let preferred_bert = model_dir
        .parent()
        .map(|parent| parent.join("shared").join("chinese-roberta-wwm-ext-large"))
        .unwrap_or_else(|| bert_candidates[0].clone());
    let active_bert = ready_bert
        .cloned()
        .unwrap_or_else(|| preferred_bert.clone());
    checks.push(environment_check(
        "chinese-bert",
        "中文 BERT 资源",
        if ready_bert.is_some() {
            "ready"
        } else {
            "missing"
        },
        true,
        ready_bert
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| format!("目标目录：{}", preferred_bert.display())),
        if ready_bert.is_some() {
            String::new()
        } else {
            "下载 hfl/chinese-roberta-wwm-ext-large，并保留 config、tokenizer 与 PyTorch/Safetensors 权重"
                .to_string()
        },
        "https://huggingface.co/hfl/chinese-roberta-wwm-ext-large",
    ));
    if ready_bert.is_none() {
        setup_commands.push(format!(
            "{quoted_python} -c \"from huggingface_hub import snapshot_download; snapshot_download('hfl/chinese-roberta-wwm-ext-large', local_dir=r'{}')\"",
            preferred_bert.display()
        ));
    }

    let ready = checks
        .iter()
        .all(|check| !check.required || check.state == "ready");
    let blockers = checks
        .iter()
        .filter(|check| check.required && check.state != "ready")
        .map(|check| check.label.as_str())
        .collect::<Vec<_>>();
    let summary = if ready {
        "自定义音色运行环境已就绪".to_string()
    } else {
        format!("还需配置：{}", blockers.join("、"))
    };

    Ok(TtsEnvironmentReport {
        model_id: installed.descriptor.id.clone(),
        adapter: adapter.to_string(),
        ready,
        summary,
        python_program,
        python_version,
        acceleration,
        resource_directory: active_bert.display().to_string(),
        checks,
        setup_commands,
        cached: false,
        checked_at: checked_at(),
    })
}

async fn synthesize_http(
    installed: &InstalledTtsModel,
    request: &TtsSynthesisRequest,
    endpoint: &str,
    model: &str,
    api_key_env: &str,
    response_format: &str,
    timeout_seconds: u64,
) -> Result<TtsSynthesisResult, String> {
    let voice = if request.voice.trim().is_empty() {
        installed.descriptor.default_voice.as_str()
    } else {
        request.voice.trim()
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|error| format!("创建 TTS HTTP 客户端失败：{error}"))?;
    let mut builder = client.post(endpoint).json(&json!({
        "model": model,
        "input": request.text,
        "voice": voice,
        "response_format": response_format,
        "speed": request.speed,
    }));
    if !api_key_env.trim().is_empty() {
        let key =
            std::env::var(api_key_env).map_err(|_| format!("环境变量 {api_key_env} 尚未设置"))?;
        builder = builder.bearer_auth(key);
    }
    let response = builder
        .send()
        .await
        .map_err(|error| format!("请求 TTS HTTP 服务失败：{error}"))?;
    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取 TTS HTTP 音频失败：{error}"))?;
    if !status.is_success() {
        let detail = String::from_utf8_lossy(&bytes)
            .trim()
            .chars()
            .take(800)
            .collect::<String>();
        return Err(format!("TTS HTTP 服务返回 {status}：{detail}"));
    }
    data_url(bytes.to_vec(), response_format)
}

fn resolve_executable_path(program: &str, model_dir: &Path) -> Option<PathBuf> {
    let program_path = Path::new(program);
    if program_path.is_absolute() {
        return program_path.is_file().then(|| program_path.to_path_buf());
    }
    let model_candidate = model_dir.join(program_path);
    if model_candidate.is_file() {
        return Some(model_candidate);
    }
    let path_value = std::env::var_os("PATH")?;
    #[cfg(windows)]
    let extensions = ["", ".exe", ".cmd", ".bat", ".com"];
    #[cfg(not(windows))]
    let extensions = [""];
    std::env::split_paths(&path_value).find_map(|directory| {
        extensions.iter().find_map(|extension| {
            let candidate = directory.join(format!("{program}{extension}"));
            candidate.is_file().then_some(candidate)
        })
    })
}

fn executable_available(program: &str, model_dir: &Path) -> bool {
    resolve_executable_path(program, model_dir).is_some()
}

fn external_environment_report(
    installed: &InstalledTtsModel,
    adapter: &str,
    checks: Vec<TtsEnvironmentCheck>,
) -> TtsEnvironmentReport {
    let ready = checks
        .iter()
        .all(|check| !check.required || check.state == "ready");
    let blockers = checks
        .iter()
        .filter(|check| check.required && check.state != "ready")
        .map(|check| check.label.as_str())
        .collect::<Vec<_>>();
    TtsEnvironmentReport {
        model_id: installed.descriptor.id.clone(),
        adapter: adapter.to_string(),
        ready,
        summary: if ready {
            "自定义音色运行环境已就绪".to_string()
        } else {
            format!("还需配置：{}", blockers.join("、"))
        },
        python_program: String::new(),
        python_version: String::new(),
        acceleration: "external".to_string(),
        resource_directory: installed.model_dir.clone(),
        checks,
        setup_commands: Vec::new(),
        cached: false,
        checked_at: checked_at(),
    }
}

#[tauri::command]
pub fn register_tts_bert_resource(
    store: State<'_, AppConfigStore>,
    resource_dir: String,
) -> Result<String, String> {
    let selected = fs::canonicalize(&resource_dir)
        .map_err(|error| format!("读取 Chinese BERT 目录失败：{error}"))?;
    let resolved = resolve_selected_bert_resource(&selected).ok_or_else(|| {
        format!(
            "在 {} 中没有找到完整的 chinese-roberta-wwm-ext-large；需要 config.json、tokenizer/vocab 与完整权重",
            selected.display()
        )
    })?;
    validate_chinese_bert_resource(&resolved)?;
    let resolved = fs::canonicalize(&resolved)
        .map_err(|error| format!("规范化 Chinese BERT 路径失败：{error}"))?;
    let resolved = resolved.to_string_lossy().to_string();
    store.set_chinese_bert_dir(resolved.clone())?;
    Ok(resolved)
}

async fn prepare_tts_model_inner(
    app: &AppHandle,
    state: &TtsWorkerState,
    store: &AppConfigStore,
    model_id: &str,
) -> Result<TtsPreparationResult, String> {
    let models = load_registry(&store)?;
    let installed = models
        .iter()
        .find(|model| model.descriptor.id == model_id)
        .ok_or_else(|| format!("模型 {model_id} 尚未注册"))?;
    match &installed.descriptor.runtime {
        TtsRuntime::Builtin {
            adapter,
            python_program,
            timeout_seconds,
            ..
        } => {
            let config = builtin_worker_config(&app, &store, installed, adapter, python_program)?;
            let mut slot = state.worker.lock().await;
            ensure_builtin_worker(
                app,
                &mut slot,
                &installed.descriptor.id,
                config,
                *timeout_seconds,
            )
            .await
        }
        TtsRuntime::Command { .. } => Ok(TtsPreparationResult {
            model_id: model_id.to_string(),
            ready: true,
            reused: true,
            device: "external-command".to_string(),
            gpu: String::new(),
            torch_version: String::new(),
            cuda_runtime: String::new(),
            gpu_memory_mb: 0,
            load_ms: 0,
        }),
        TtsRuntime::OpenaiHttp { .. } => Ok(TtsPreparationResult {
            model_id: model_id.to_string(),
            ready: true,
            reused: true,
            device: "http".to_string(),
            gpu: String::new(),
            torch_version: String::new(),
            cuda_runtime: String::new(),
            gpu_memory_mb: 0,
            load_ms: 0,
        }),
    }
}

fn preload_updated_at() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}

fn preload_status(
    phase: TtsPreloadPhase,
    model_id: &str,
    message: impl Into<String>,
    result: Option<TtsPreparationResult>,
) -> TtsPreloadStatus {
    TtsPreloadStatus {
        phase,
        model_id: model_id.to_string(),
        message: message.into(),
        result,
        updated_at: preload_updated_at(),
    }
}

fn publish_preload_status(
    app: &AppHandle,
    state: &TtsWorkerState,
    generation: u64,
    status: TtsPreloadStatus,
) -> Result<bool, String> {
    if state.preload_generation.load(Ordering::Acquire) != generation {
        return Ok(false);
    }
    *state
        .preload_status
        .lock()
        .map_err(|_| "TTS 后台预热状态锁定失败".to_string())? = status.clone();
    app.emit(TTS_PRELOAD_EVENT_NAME, status)
        .map_err(|error| format!("广播 TTS 后台预热状态失败：{error}"))?;
    Ok(true)
}

fn preload_already_active(status: &TtsPreloadStatus, model_id: &str) -> bool {
    status.model_id == model_id
        && matches!(
            status.phase,
            TtsPreloadPhase::Queued | TtsPreloadPhase::Loading | TtsPreloadPhase::Ready
        )
}

/// 立即返回并把模型预热安排到 Tauri 后台运行时。
#[tauri::command]
pub fn preload_tts_model(app: AppHandle, model_id: String) -> Result<TtsPreloadStatus, String> {
    let model_id = model_id.trim().to_string();
    if model_id.is_empty() {
        return Err("TTS 模型编号为空".to_string());
    }

    let state = app.state::<TtsWorkerState>();
    let current = state.preload_status()?;
    if preload_already_active(&current, &model_id) {
        return Ok(current);
    }
    let store = app.state::<AppConfigStore>();
    if !load_registry(&store)?
        .iter()
        .any(|model| model.descriptor.id == model_id)
    {
        return Err(format!("模型 {model_id} 尚未注册"));
    }

    let generation = state.preload_generation.fetch_add(1, Ordering::AcqRel) + 1;
    let queued = preload_status(
        TtsPreloadPhase::Queued,
        &model_id,
        "自定义音色已加入后台预热队列",
        None,
    );
    publish_preload_status(&app, &state, generation, queued.clone())?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = handle.state::<TtsWorkerState>();
        let store = handle.state::<AppConfigStore>();
        let loading = preload_status(
            TtsPreloadPhase::Loading,
            &model_id,
            "正在后台加载 Python、BERT 与音色权重",
            None,
        );
        match publish_preload_status(&handle, &state, generation, loading) {
            Ok(true) => {}
            Ok(false) => return,
            Err(error) => {
                eprintln!("bilimaku TTS preload status warning: {error}");
                return;
            }
        }

        let result = prepare_tts_model_inner(&handle, &state, &store, &model_id).await;
        let status = match result {
            Ok(result) => preload_status(
                TtsPreloadPhase::Ready,
                &model_id,
                format!(
                    "自定义音色已在后台加载完成：{}",
                    if result.gpu.is_empty() {
                        result.device.as_str()
                    } else {
                        result.gpu.as_str()
                    }
                ),
                Some(result),
            ),
            Err(error) => {
                let _ = store.clear_tts_environment_cache(&model_id);
                preload_status(
                    TtsPreloadPhase::Error,
                    &model_id,
                    format!("自定义音色后台加载失败：{error}"),
                    None,
                )
            }
        };
        if let Err(error) = publish_preload_status(&handle, &state, generation, status) {
            eprintln!("bilimaku TTS preload completion warning: {error}");
        }
    });

    Ok(queued)
}

/// 返回当前 TTS 后台预热状态，读取过程只访问内存。
#[tauri::command]
pub fn get_tts_preload_status(
    state: State<'_, TtsWorkerState>,
) -> Result<TtsPreloadStatus, String> {
    state.preload_status()
}

/// 保留给显式等待场景的同步式异步命令；冷启动不再调用此入口。
#[tauri::command]
pub async fn prepare_tts_model(
    app: AppHandle,
    state: State<'_, TtsWorkerState>,
    store: State<'_, AppConfigStore>,
    model_id: String,
) -> Result<TtsPreparationResult, String> {
    prepare_tts_model_inner(&app, &state, &store, model_id.trim()).await
}

#[tauri::command]
pub async fn inspect_tts_environment(
    app: AppHandle,
    store: State<'_, AppConfigStore>,
    model_id: String,
    force: Option<bool>,
) -> Result<TtsEnvironmentReport, String> {
    let models = load_registry(&store)?;
    let installed = models
        .iter()
        .find(|model| model.descriptor.id == model_id)
        .ok_or_else(|| format!("模型 {model_id} 尚未注册"))?;
    let fingerprint = tts_environment_fingerprint(&app, &store, installed)?;
    if !force.unwrap_or(false) {
        if let Some(cache) = store.tts_environment_cache(&installed.descriptor.id)? {
            if cache.fingerprint == fingerprint
                && cached_environment_still_available(installed, &cache.report)
            {
                let mut report = cache.report;
                report.cached = true;
                return Ok(report);
            }
        }
    }

    let mut report = match &installed.descriptor.runtime {
        TtsRuntime::Builtin {
            adapter,
            python_program,
            ..
        } => {
            inspect_builtin_tts_environment(&app, &store, installed, adapter, python_program).await
        }
        TtsRuntime::Command { program, .. } => {
            let ready = executable_available(program, Path::new(&installed.model_dir));
            Ok(external_environment_report(
                installed,
                "command",
                vec![environment_check(
                    "command-runtime",
                    "外部命令运行时",
                    if ready { "ready" } else { "missing" },
                    true,
                    program,
                    if ready {
                        ""
                    } else {
                        "请安装对应程序，或在旧版模型描述中填写绝对路径"
                    },
                    "",
                )],
            ))
        }
        TtsRuntime::OpenaiHttp {
            endpoint,
            api_key_env,
            ..
        } => {
            let key_ready = api_key_env.trim().is_empty()
                || std::env::var(api_key_env)
                    .map(|value| !value.trim().is_empty())
                    .unwrap_or(false);
            Ok(external_environment_report(
                installed,
                "openai-http",
                vec![
                    environment_check(
                        "http-endpoint",
                        "HTTP 语音服务",
                        "ready",
                        true,
                        endpoint,
                        "",
                        "",
                    ),
                    environment_check(
                        "http-api-key",
                        "HTTP 鉴权变量",
                        if key_ready { "ready" } else { "missing" },
                        true,
                        if api_key_env.trim().is_empty() {
                            "该服务未配置鉴权变量"
                        } else if key_ready {
                            "环境变量已设置"
                        } else {
                            api_key_env
                        },
                        if key_ready {
                            ""
                        } else {
                            "启动 bilimaku 前设置对应环境变量"
                        },
                        "",
                    ),
                ],
            ))
        }
    }?;
    report.cached = false;

    if matches!(&installed.descriptor.runtime, TtsRuntime::Builtin { .. })
        && validate_chinese_bert_resource(Path::new(&report.resource_directory)).is_ok()
    {
        let configured = store.chinese_bert_dir()?;
        if configured.trim().is_empty() || !same_model_dir(&configured, &report.resource_directory)
        {
            store.set_chinese_bert_dir(report.resource_directory.clone())?;
        }
    }

    let fingerprint = tts_environment_fingerprint(&app, &store, installed)?;
    store.set_tts_environment_cache(TtsEnvironmentCache {
        fingerprint,
        report: report.clone(),
    })?;
    Ok(report)
}

#[tauri::command]
pub fn list_tts_models(store: State<'_, AppConfigStore>) -> Result<Vec<InstalledTtsModel>, String> {
    load_registry(&store)
}

#[tauri::command]
pub fn import_tts_model(
    store: State<'_, AppConfigStore>,
    model_dir: String,
) -> Result<InstalledTtsModel, String> {
    let model_dir =
        fs::canonicalize(&model_dir).map_err(|error| format!("读取模型目录失败：{error}"))?;
    if !model_dir.is_dir() {
        return Err("选择的模型路径不是目录".to_string());
    }
    let descriptor = detect_tts_model(&model_dir)?;
    let model_dir_text = model_dir.to_string_lossy().to_string();
    let imported = InstalledTtsModel {
        descriptor,
        model_dir: model_dir_text.clone(),
        imported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_secs())
            .unwrap_or_default(),
    };
    let mut models = load_registry(&store)?;
    models.retain(|model| {
        model.descriptor.id != imported.descriptor.id
            && !same_model_dir(&model.model_dir, &model_dir_text)
    });
    models.push(imported.clone());
    models.sort_by(|left, right| left.descriptor.name.cmp(&right.descriptor.name));
    save_registry(&store, &models)?;
    Ok(imported)
}

fn same_model_dir(left: &str, right: &str) -> bool {
    if cfg!(windows) {
        left.eq_ignore_ascii_case(right)
    } else {
        left == right
    }
}

#[tauri::command]
pub fn remove_tts_model(store: State<'_, AppConfigStore>, model_id: String) -> Result<(), String> {
    let mut models = load_registry(&store)?;
    let before = models.len();
    models.retain(|model| model.descriptor.id != model_id);
    if before == models.len() {
        return Err(format!("模型 {model_id} 尚未注册"));
    }
    save_registry(&store, &models)
}

#[tauri::command]
pub async fn synthesize_custom_tts(
    app: AppHandle,
    state: State<'_, TtsWorkerState>,
    store: State<'_, AppConfigStore>,
    request: TtsSynthesisRequest,
) -> Result<TtsSynthesisResult, String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("TTS 文本为空".to_string());
    }
    if text.chars().count() > 2_000 {
        return Err("单次 TTS 文本超过 2000 字符".to_string());
    }
    if !(0.25..=4.0).contains(&request.speed) {
        return Err("TTS speed 需要位于 0.25-4.0".to_string());
    }
    let models = load_registry(&store)?;
    let installed = models
        .iter()
        .find(|model| model.descriptor.id == request.model_id)
        .ok_or_else(|| format!("模型 {} 尚未注册", request.model_id))?;
    match &installed.descriptor.runtime {
        TtsRuntime::Builtin {
            adapter,
            python_program,
            output_format,
            timeout_seconds,
        } => {
            synthesize_builtin(
                &app,
                &store,
                &state,
                installed,
                &request,
                adapter,
                python_program,
                output_format,
                *timeout_seconds,
            )
            .await
        }
        TtsRuntime::Command {
            program,
            args,
            output_format,
            timeout_seconds,
        } => {
            synthesize_command(
                &app,
                installed,
                &request,
                program,
                args,
                output_format,
                *timeout_seconds,
                &[],
            )
            .await
        }
        TtsRuntime::OpenaiHttp {
            endpoint,
            model,
            api_key_env,
            response_format,
            timeout_seconds,
        } => {
            synthesize_http(
                installed,
                &request,
                endpoint,
                model,
                api_key_env,
                response_format,
                *timeout_seconds,
            )
            .await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempModelDir(PathBuf);

    impl TempModelDir {
        fn new(name: &str) -> Self {
            let suffix = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "bilimaku-tts-test-{name}-{}-{suffix}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("temp model directory");
            Self(path)
        }
    }

    impl Drop for TempModelDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn preload_state_starts_idle_and_deduplicates_active_model() {
        let state = TtsWorkerState::default();
        let idle = state.preload_status().expect("preload status");
        assert_eq!(idle.phase, TtsPreloadPhase::Idle);
        assert!(!preload_already_active(&idle, "voice-pack"));

        let loading = preload_status(TtsPreloadPhase::Loading, "voice-pack", "loading", None);
        assert!(preload_already_active(&loading, "voice-pack"));
        assert!(!preload_already_active(&loading, "another-pack"));
    }

    #[test]
    fn detects_native_bert_vits2_without_model_side_manifest() {
        let model_dir = TempModelDir::new("bert-vits2");
        fs::write(
            model_dir.0.join("config.json"),
            serde_json::to_vec(&json!({
                "train": {"segment_size": 8192},
                "data": {
                    "sampling_rate": 44100,
                    "spk2id": {"荧": 189, "派蒙": 129, "空": 165}
                },
                "model": {"use_duration_discriminator": true}
            }))
            .expect("config"),
        )
        .expect("write config");
        fs::write(model_dir.0.join("G_78000.pth"), b"test-checkpoint").expect("write checkpoint");

        let descriptor = detect_tts_model(&model_dir.0).expect("detected model");
        assert_eq!(descriptor.default_voice, "派蒙");
        assert_eq!(
            descriptor
                .voices
                .iter()
                .map(|voice| voice.id.as_str())
                .collect::<Vec<_>>(),
            vec!["派蒙", "空", "荧"]
        );
        assert!(matches!(
            descriptor.runtime,
            TtsRuntime::Builtin { ref adapter, .. } if adapter == BERT_VITS2_ADAPTER_ID
        ));
        assert!(!model_dir.0.join(MANIFEST_FILE).exists());
        assert!(!model_dir.0.join(LEGACY_MANIFEST_FILE).exists());
    }

    #[test]
    fn detects_local_hoyotts_snapshot_when_available() {
        let model_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("resources")
            .join("tss")
            .join("hoyoTTS");
        if !model_dir.is_dir() {
            return;
        }

        let descriptor = detect_tts_model(&model_dir).expect("detect local hoyoTTS snapshot");
        assert_eq!(descriptor.voices.len(), 251);
        assert_eq!(descriptor.default_voice, "派蒙");
        assert!(matches!(
            descriptor.runtime,
            TtsRuntime::Builtin { ref adapter, .. } if adapter == BERT_VITS2_ADAPTER_ID
        ));
        assert!(!model_dir.join(MANIFEST_FILE).exists());
        assert!(!model_dir.join(LEGACY_MANIFEST_FILE).exists());
    }

    #[tokio::test]
    #[ignore = "requires local hoyoTTS, Chinese BERT and CUDA runtime"]
    async fn persistent_worker_round_trip_when_local_runtime_is_available() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let model_dir = manifest_dir
            .join("..")
            .join("resources")
            .join("tss")
            .join("hoyoTTS");
        let Some(model_parent) = model_dir.parent() else {
            return;
        };
        #[cfg(windows)]
        let python_program = model_parent
            .join("runtime")
            .join(BERT_VITS2_ADAPTER_ID)
            .join("Scripts")
            .join("python.exe");
        #[cfg(not(windows))]
        let python_program = model_parent
            .join("runtime")
            .join(BERT_VITS2_ADAPTER_ID)
            .join("bin")
            .join("python");
        let adapter = manifest_dir
            .join("resources")
            .join("tts-adapters")
            .join(BERT_VITS2_ADAPTER_ID)
            .join("infer.py");
        let bert_dir = model_dir
            .ancestors()
            .map(|ancestor| ancestor.join(CHINESE_BERT_DIRECTORY))
            .find(|candidate| bert_resource_ready(candidate));
        let Some(bert_dir) = bert_dir else {
            return;
        };
        if !model_dir.is_dir() || !python_program.is_file() || !adapter.is_file() {
            return;
        }

        let config = BuiltinTtsWorkerConfig {
            key: "local-worker-test".to_string(),
            python_program: python_program.display().to_string(),
            entrypoint: adapter,
            model_dir: model_dir.clone(),
            bert_dir,
        };
        let mut worker = spawn_builtin_worker("local-hoyotts", config, 300)
            .await
            .expect("start persistent TTS worker");
        assert_eq!(worker.preparation.device, "cuda:0");
        assert!(!worker.preparation.gpu.is_empty());

        let output = std::env::temp_dir().join(format!(
            "bilimaku-worker-test-{}-{}.wav",
            std::process::id(),
            OUTPUT_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        let request_id = OUTPUT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let request = json!({
            "type": "synthesize",
            "id": request_id,
            "text": "你好，我是派蒙，我最喜欢玩原神，原神最牛逼了！",
            "voice": "派蒙",
            "speed": 1.0,
            "output": output,
        });
        worker
            .stdin
            .write_all(
                serde_json::to_string(&request)
                    .expect("request JSON")
                    .as_bytes(),
            )
            .await
            .expect("write request");
        worker.stdin.write_all(b"\n").await.expect("write newline");
        worker.stdin.flush().await.expect("flush request");
        let response = read_tts_worker_message(&mut worker.stdout, 30)
            .await
            .expect("worker response");
        assert_eq!(response.get("ok").and_then(Value::as_bool), Some(true));
        assert_eq!(response.get("id").and_then(Value::as_u64), Some(request_id));
        assert!(response
            .pointer("/timings/inferenceMs")
            .and_then(Value::as_u64)
            .is_some_and(|value| value < 5_000));
        assert!(fs::metadata(&output)
            .map(|metadata| metadata.len() > 44)
            .unwrap_or(false));
        let _ = fs::remove_file(output);
        let _ = worker.child.kill().await;
    }

    #[test]
    fn python_preflight_uses_a_minimum_version_without_an_upper_cap() {
        assert!(!python_version_supported("3.9.18"));
        assert!(python_version_supported("3.10.14"));
        assert!(python_version_supported("3.14.6"));
        assert!(python_version_supported("3.20.0"));
    }

    #[test]
    fn bert_preflight_requires_config_tokenizer_and_weights() {
        let resource_dir = TempModelDir::new("bert-resources");
        fs::write(
            resource_dir.0.join("config.json"),
            br#"{"hidden_size":1024,"num_hidden_layers":24}"#,
        )
        .expect("config");
        fs::write(resource_dir.0.join("vocab.txt"), b"test").expect("vocab");
        assert!(!bert_resource_ready(&resource_dir.0));
        let weights = fs::File::create(resource_dir.0.join("model.safetensors"))
            .expect("create sparse weights");
        weights
            .set_len(101 * 1024 * 1024)
            .expect("size sparse weights");
        assert!(bert_resource_ready(&resource_dir.0));
    }

    #[test]
    fn bert_selection_accepts_the_parent_of_a_complete_resource() {
        let parent = TempModelDir::new("bert-parent");
        let resource = parent.0.join(CHINESE_BERT_DIRECTORY);
        fs::create_dir_all(&resource).expect("resource directory");
        fs::write(
            resource.join("config.json"),
            br#"{"hidden_size":1024,"num_hidden_layers":24}"#,
        )
        .expect("config");
        fs::write(resource.join("tokenizer.json"), b"{}").expect("tokenizer");
        fs::File::create(resource.join("pytorch_model.bin"))
            .expect("weights")
            .set_len(101 * 1024 * 1024)
            .expect("weight size");

        assert_eq!(resolve_selected_bert_resource(&parent.0), Some(resource));
    }

    #[test]
    fn bert_discovery_walks_model_ancestors_for_a_shared_copy() {
        let root = TempModelDir::new("bert-ancestor");
        let model_dir = root.0.join("projects").join("voices").join("hoyoTTS");
        fs::create_dir_all(&model_dir).expect("model directory");
        let resource = root.0.join(CHINESE_BERT_DIRECTORY);
        fs::create_dir_all(&resource).expect("resource directory");
        fs::write(
            resource.join("config.json"),
            br#"{"hidden_size":1024,"num_hidden_layers":24}"#,
        )
        .expect("config");
        fs::write(resource.join("vocab.txt"), b"test").expect("vocab");
        fs::File::create(resource.join("pytorch_model.bin"))
            .expect("weights")
            .set_len(101 * 1024 * 1024)
            .expect("weight size");

        let mut candidates = Vec::new();
        let mut seen = HashSet::new();
        expand_model_ancestor_bert_candidates(&mut candidates, &mut seen, &model_dir);
        assert!(candidates
            .iter()
            .any(|candidate| candidate == &resource && bert_resource_ready(candidate)));
    }

    #[test]
    fn accepts_legacy_command_descriptor_with_output_placeholder() {
        let descriptor: TtsModelDescriptor = serde_json::from_value(json!({
            "schemaVersion": 1,
            "id": "cosyvoice-local",
            "name": "CosyVoice Local",
            "runtime": {
                "type": "command",
                "program": "python",
                "args": ["infer.py", "--text", "{text}", "--output", "{output}"],
                "outputFormat": "wav",
                "timeoutSeconds": 120
            },
            "voices": [{"id": "default", "name": "默认", "language": "zh-CN"}],
            "defaultVoice": "default"
        }))
        .expect("descriptor");
        validate_descriptor(&descriptor).expect("valid command descriptor");
    }

    #[test]
    fn rejects_legacy_command_descriptor_without_output_placeholder() {
        let descriptor: TtsModelDescriptor = serde_json::from_value(json!({
            "schemaVersion": 1,
            "id": "broken-model",
            "name": "Broken",
            "runtime": {
                "type": "command",
                "program": "python",
                "args": ["infer.py", "--text", "{text}"]
            }
        }))
        .expect("descriptor");
        assert!(validate_descriptor(&descriptor).is_err());
    }
}
