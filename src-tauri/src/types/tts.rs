use serde::{Deserialize, Serialize};

/// 默认音频输出格式。
pub(crate) fn default_audio_format() -> String {
    "wav".to_string()
}

/// 默认 Python 可执行程序名。
pub(crate) fn default_python_program() -> String {
    "python".to_string()
}

/// 外部 TTS 调用的默认超时秒数。
pub(crate) fn default_timeout_seconds() -> u64 {
    120
}

/// 内置模型首次加载的默认超时秒数。
pub(crate) fn default_builtin_timeout_seconds() -> u64 {
    300
}

/// 默认语速倍率。
pub(crate) fn default_speed() -> f64 {
    1.0
}

/// 模型包提供的一种可选音色。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsVoice {
    /// 音色在模型内的稳定编号。
    pub id: String,
    /// 面向用户的音色名称。
    pub name: String,
    /// 音色主要语言。
    #[serde(default)]
    pub language: String,
}

/// TTS 适配器的实际运行方式。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TtsRuntime {
    /// bilimaku 内置的本地架构适配器。
    Builtin {
        /// 内置适配器编号。
        adapter: String,
        /// Python 解释器路径或回退命令。
        #[serde(default = "default_python_program")]
        python_program: String,
        /// 输出音频格式。
        #[serde(default = "default_audio_format")]
        output_format: String,
        /// 模型加载与单次推理超时秒数。
        #[serde(default = "default_builtin_timeout_seconds")]
        timeout_seconds: u64,
    },
    /// 通过外部命令完成推理。
    Command {
        /// 可执行程序路径或名称。
        program: String,
        /// 支持占位符替换的命令参数。
        args: Vec<String>,
        /// 输出音频格式。
        #[serde(default = "default_audio_format")]
        output_format: String,
        /// 单次命令超时秒数。
        #[serde(default = "default_timeout_seconds")]
        timeout_seconds: u64,
    },
    /// 通过 OpenAI 风格 HTTP 接口完成推理。
    OpenaiHttp {
        /// HTTP 服务地址。
        endpoint: String,
        /// 服务端模型编号。
        model: String,
        /// API Key 所在环境变量名，为空时表示不鉴权。
        #[serde(default)]
        api_key_env: String,
        /// 服务端响应音频格式。
        #[serde(default = "default_audio_format")]
        response_format: String,
        /// 单次请求超时秒数。
        #[serde(default = "default_timeout_seconds")]
        timeout_seconds: u64,
    },
}

/// TTS 适配器识别出的模型描述。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsModelDescriptor {
    /// 模型描述结构版本。
    pub schema_version: u8,
    /// 模型稳定编号。
    pub id: String,
    /// 模型显示名称。
    pub name: String,
    /// 模型用途说明。
    #[serde(default)]
    pub description: String,
    /// 模型包版本。
    #[serde(default)]
    pub version: String,
    /// 模型作者或发布者。
    #[serde(default)]
    pub author: String,
    /// 推理运行方式。
    pub runtime: TtsRuntime,
    /// 模型内包含的音色。
    #[serde(default)]
    pub voices: Vec<TtsVoice>,
    /// 默认音色编号。
    #[serde(default)]
    pub default_voice: String,
}

/// 已导入统一配置的 TTS 模型。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledTtsModel {
    /// 适配器生成的模型描述字段。
    #[serde(flatten)]
    pub descriptor: TtsModelDescriptor,
    /// 原始模型目录绝对路径。
    pub model_dir: String,
    /// 导入时的 Unix 秒级时间戳。
    pub imported_at: u64,
}

/// 单次自定义 TTS 合成请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsSynthesisRequest {
    /// 使用的模型编号。
    pub model_id: String,
    /// 待合成文本。
    pub text: String,
    /// 使用的音色编号；为空时采用模型默认音色。
    #[serde(default)]
    pub voice: String,
    /// 语速倍率。
    #[serde(default = "default_speed")]
    pub speed: f64,
}

/// 单次 TTS 合成返回的音频。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsSynthesisResult {
    /// 可直接交给前端播放器的音频 Data URL。
    pub audio_data_url: String,
    /// 音频 MIME 类型。
    pub mime_type: String,
    /// 音频字节数。
    pub bytes: usize,
}

/// 单项 TTS 运行环境检查。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsEnvironmentCheck {
    /// 检查项稳定编号。
    pub id: String,
    /// 检查项名称。
    pub label: String,
    /// 当前状态，可为 ready、missing 或 warning。
    pub state: String,
    /// 未就绪时是否阻止推理。
    pub required: bool,
    /// 当前检测详情。
    pub detail: String,
    /// 面向用户的中文处理指南。
    pub guide: String,
    /// 对应依赖或资源下载页面。
    pub download_url: String,
}

/// 一个模型的完整运行环境报告。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsEnvironmentReport {
    /// 模型编号。
    pub model_id: String,
    /// 适配器编号。
    pub adapter: String,
    /// 所有必需项是否已经就绪。
    pub ready: bool,
    /// 检测结果摘要。
    pub summary: String,
    /// 实际使用的 Python 路径。
    pub python_program: String,
    /// Python 版本。
    pub python_version: String,
    /// 当前计算加速方式。
    pub acceleration: String,
    /// 当前共享资源目录。
    pub resource_directory: String,
    /// 各项环境检查结果。
    pub checks: Vec<TtsEnvironmentCheck>,
    /// 可供用户执行的环境安装命令。
    pub setup_commands: Vec<String>,
    /// 本次结果是否直接复用了统一配置中的持久化缓存。
    #[serde(default)]
    pub cached: bool,
    /// 检测发生时的 Unix 秒级时间戳。
    pub checked_at: u64,
}

/// 持久化到统一配置的一份 TTS 环境检测缓存。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsEnvironmentCache {
    /// 模型、运行时、共享资源和适配器版本共同生成的缓存指纹。
    pub fingerprint: String,
    /// 最近一次完整 Python 环境探测报告。
    pub report: TtsEnvironmentReport,
}

/// 常驻 TTS Worker 的预热结果。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsPreparationResult {
    /// 模型编号。
    pub model_id: String,
    /// Worker 是否可用于推理。
    pub ready: bool,
    /// 是否复用了已经加载的 Worker。
    pub reused: bool,
    /// PyTorch 实际计算设备。
    pub device: String,
    /// 显卡名称。
    pub gpu: String,
    /// PyTorch 版本。
    pub torch_version: String,
    /// PyTorch 内置 CUDA 运行时版本。
    pub cuda_runtime: String,
    /// 可用显存，单位为 MiB。
    pub gpu_memory_mb: u64,
    /// 模型加载耗时，单位为毫秒。
    pub load_ms: u64,
}

/// 后台 TTS 预热任务的生命周期阶段。
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum TtsPreloadPhase {
    /// 当前没有后台预热任务。
    Idle,
    /// 任务已经进入队列，命令调用方可以立即返回。
    Queued,
    /// 后台任务正在加载 Python、BERT 与音色权重。
    Loading,
    /// 模型已经加载完成并可直接推理。
    Ready,
    /// 后台预热任务执行失败。
    Error,
}

/// Rust 后端同步给前端的 TTS 后台预热状态。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsPreloadStatus {
    /// 当前后台预热阶段。
    pub phase: TtsPreloadPhase,
    /// 当前任务对应的模型编号；空字符串表示尚未选择模型。
    pub model_id: String,
    /// 面向用户的中文状态说明。
    pub message: String,
    /// 成功完成后返回的设备、显存与耗时信息。
    pub result: Option<TtsPreparationResult>,
    /// 最近一次状态变化的 Unix 毫秒级时间戳。
    pub updated_at: u64,
}

impl Default for TtsPreloadStatus {
    fn default() -> Self {
        Self {
            phase: TtsPreloadPhase::Idle,
            model_id: String::new(),
            message: "尚未启动自定义音色预热".to_string(),
            result: None,
            updated_at: 0,
        }
    }
}
