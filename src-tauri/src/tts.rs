use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tokio::process::Command;
use tokio::time::timeout;

const MANIFEST_FILE: &str = "bilicast-tts.json";
const REGISTRY_FILE: &str = "tts-models.json";
const MAX_AUDIO_BYTES: u64 = 100 * 1024 * 1024;
static OUTPUT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsVoice {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub language: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TtsRuntime {
    Command {
        program: String,
        args: Vec<String>,
        #[serde(default = "default_audio_format")]
        output_format: String,
        #[serde(default = "default_timeout_seconds")]
        timeout_seconds: u64,
    },
    OpenaiHttp {
        endpoint: String,
        model: String,
        #[serde(default)]
        api_key_env: String,
        #[serde(default = "default_audio_format")]
        response_format: String,
        #[serde(default = "default_timeout_seconds")]
        timeout_seconds: u64,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsManifest {
    pub schema_version: u8,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub author: String,
    pub runtime: TtsRuntime,
    #[serde(default)]
    pub voices: Vec<TtsVoice>,
    #[serde(default)]
    pub default_voice: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledTtsModel {
    #[serde(flatten)]
    pub manifest: TtsManifest,
    pub model_dir: String,
    pub imported_at: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsSynthesisRequest {
    pub model_id: String,
    pub text: String,
    #[serde(default)]
    pub voice: String,
    #[serde(default = "default_speed")]
    pub speed: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsSynthesisResult {
    pub audio_data_url: String,
    pub mime_type: String,
    pub bytes: usize,
}

fn default_audio_format() -> String {
    "wav".to_string()
}

fn default_timeout_seconds() -> u64 {
    120
}

fn default_speed() -> f64 {
    1.0
}

fn registry_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位 TTS 配置目录失败：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("创建 TTS 配置目录失败：{error}"))?;
    Ok(dir)
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(registry_dir(app)?.join(REGISTRY_FILE))
}

fn load_registry(app: &AppHandle) -> Result<Vec<InstalledTtsModel>, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(&path).map_err(|error| format!("读取 TTS 模型注册表失败：{error}"))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("解析 TTS 模型注册表失败：{error}"))
}

fn save_registry(app: &AppHandle, models: &[InstalledTtsModel]) -> Result<(), String> {
    let path = registry_path(app)?;
    let bytes = serde_json::to_vec_pretty(models)
        .map_err(|error| format!("序列化 TTS 模型注册表失败：{error}"))?;
    fs::write(path, bytes).map_err(|error| format!("保存 TTS 模型注册表失败：{error}"))
}

fn validate_manifest(manifest: &TtsManifest) -> Result<(), String> {
    if manifest.schema_version != 1 {
        return Err(format!(
            "TTS 模型清单版本 {} 尚未适配，当前支持 schemaVersion=1",
            manifest.schema_version
        ));
    }
    if manifest.id.is_empty()
        || manifest.id.len() > 64
        || !manifest
            .id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.'))
    {
        return Err("模型 id 需要由 1-64 位字母、数字、点、横线或下划线组成".to_string());
    }
    if manifest.name.trim().is_empty() {
        return Err("模型名称为空".to_string());
    }

    let mut voice_ids = HashSet::new();
    for voice in &manifest.voices {
        if voice.id.trim().is_empty() || voice.name.trim().is_empty() {
            return Err("音色 id 与名称均需要填写".to_string());
        }
        if !voice_ids.insert(voice.id.as_str()) {
            return Err(format!("音色 id 重复：{}", voice.id));
        }
    }
    if !manifest.default_voice.is_empty()
        && !manifest
            .voices
            .iter()
            .any(|voice| voice.id == manifest.default_voice)
    {
        return Err(format!(
            "默认音色 {} 不在 voices 列表中",
            manifest.default_voice
        ));
    }

    match &manifest.runtime {
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
        Err(format!("暂未识别音频格式：{format}"))
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
    Ok(TtsSynthesisResult {
        audio_data_url: format!("data:{mime_type};base64,{}", STANDARD.encode(&bytes)),
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

async fn synthesize_command(
    app: &AppHandle,
    installed: &InstalledTtsModel,
    request: &TtsSynthesisRequest,
    program: &str,
    args: &[String],
    output_format: &str,
    timeout_seconds: u64,
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
        installed.manifest.default_voice.as_str()
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
        installed.manifest.default_voice.as_str()
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

#[tauri::command]
pub fn list_tts_models(app: AppHandle) -> Result<Vec<InstalledTtsModel>, String> {
    load_registry(&app)
}

#[tauri::command]
pub fn import_tts_model(app: AppHandle, model_dir: String) -> Result<InstalledTtsModel, String> {
    let model_dir =
        fs::canonicalize(&model_dir).map_err(|error| format!("读取模型目录失败：{error}"))?;
    if !model_dir.is_dir() {
        return Err("选择的模型路径不是目录".to_string());
    }
    let manifest_path = model_dir.join(MANIFEST_FILE);
    let bytes = fs::read(&manifest_path).map_err(|error| {
        format!("模型目录缺少 {MANIFEST_FILE}：{error}。可从 docs/tts-model-package.md 复制模板")
    })?;
    let manifest: TtsManifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("解析 {} 失败：{error}", manifest_path.display()))?;
    validate_manifest(&manifest)?;

    let imported = InstalledTtsModel {
        manifest,
        model_dir: model_dir.to_string_lossy().to_string(),
        imported_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_secs())
            .unwrap_or_default(),
    };
    let mut models = load_registry(&app)?;
    models.retain(|model| model.manifest.id != imported.manifest.id);
    models.push(imported.clone());
    models.sort_by(|left, right| left.manifest.name.cmp(&right.manifest.name));
    save_registry(&app, &models)?;
    Ok(imported)
}

#[tauri::command]
pub fn remove_tts_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let mut models = load_registry(&app)?;
    let before = models.len();
    models.retain(|model| model.manifest.id != model_id);
    if before == models.len() {
        return Err(format!("模型 {model_id} 尚未注册"));
    }
    save_registry(&app, &models)
}

#[tauri::command]
pub async fn synthesize_custom_tts(
    app: AppHandle,
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
    let models = load_registry(&app)?;
    let installed = models
        .iter()
        .find(|model| model.manifest.id == request.model_id)
        .ok_or_else(|| format!("模型 {} 尚未注册", request.model_id))?;
    match &installed.manifest.runtime {
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

    #[test]
    fn accepts_command_manifest_with_output_placeholder() {
        let manifest: TtsManifest = serde_json::from_value(json!({
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
        .expect("manifest");
        validate_manifest(&manifest).expect("valid command manifest");
    }

    #[test]
    fn rejects_command_manifest_without_output_placeholder() {
        let manifest: TtsManifest = serde_json::from_value(json!({
            "schemaVersion": 1,
            "id": "broken-model",
            "name": "Broken",
            "runtime": {
                "type": "command",
                "program": "python",
                "args": ["infer.py", "--text", "{text}"]
            }
        }))
        .expect("manifest");
        assert!(validate_manifest(&manifest).is_err());
    }
}
