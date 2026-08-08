import type { LiveEventType, LiveInteractionKind } from "./events";

/** 模型包提供的一种可选音色。 */
export interface TtsVoice {
  /** 音色在模型内的稳定编号。 */
  id: string;
  /** 面向用户的音色名称。 */
  name: string;
  /** 音色主要语言。 */
  language: string;
}

/** TTS 适配器的实际运行方式。 */
export type TtsRuntime =
  | {
      /** bilimaku 内置架构适配器。 */
      type: "builtin";
      /** 内置适配器编号。 */
      adapter: string;
      /** Python 解释器或回退命令。 */
      pythonProgram: string;
      /** 输出音频格式。 */
      outputFormat: string;
      /** 单次推理超时秒数。 */
      timeoutSeconds: number;
    }
  | {
      /** 外部命令适配器。 */
      type: "command";
      /** 可执行程序路径或名称。 */
      program: string;
      /** 带占位符的命令参数。 */
      args: string[];
      /** 输出音频格式。 */
      outputFormat: string;
      /** 单次推理超时秒数。 */
      timeoutSeconds: number;
    }
  | {
      /** OpenAI 风格 HTTP 语音接口。 */
      type: "openai-http";
      /** HTTP 服务地址。 */
      endpoint: string;
      /** 服务端模型编号。 */
      model: string;
      /** API Key 所在环境变量名。 */
      apiKeyEnv: string;
      /** 服务端响应音频格式。 */
      responseFormat: string;
      /** 单次请求超时秒数。 */
      timeoutSeconds: number;
    };

/** 已导入统一配置的 TTS 模型。 */
export interface InstalledTtsModel {
  /** 模型描述结构版本。 */
  schemaVersion: number;
  /** 模型稳定编号。 */
  id: string;
  /** 模型显示名称。 */
  name: string;
  /** 模型用途说明。 */
  description: string;
  /** 模型包版本。 */
  version: string;
  /** 模型作者或发布者。 */
  author: string;
  /** 推理运行方式。 */
  runtime: TtsRuntime;
  /** 模型内包含的音色。 */
  voices: TtsVoice[];
  /** 默认音色编号。 */
  defaultVoice: string;
  /** 原始模型目录绝对路径。 */
  modelDir: string;
  /** 导入时的 Unix 秒级时间戳。 */
  importedAt: number;
}

/** 一次 TTS 合成返回的音频。 */
export interface TtsSynthesisResult {
  /** 可直接播放的音频 Data URL。 */
  audioDataUrl: string;
  /** 音频 MIME 类型。 */
  mimeType: string;
  /** 音频字节数。 */
  bytes: number;
}

export type TtsEnvironmentState = "ready" | "missing" | "warning";

/** 单项 TTS 运行环境检查。 */
export interface TtsEnvironmentCheck {
  /** 检查项稳定编号。 */
  id: string;
  /** 检查项名称。 */
  label: string;
  /** 当前检查状态。 */
  state: TtsEnvironmentState;
  /** 未就绪时是否会阻止推理。 */
  required: boolean;
  /** 当前检测结果详情。 */
  detail: string;
  /** 面向用户的处理指南。 */
  guide: string;
  /** 对应资源或依赖的下载页面。 */
  downloadUrl: string;
}

/** 一个模型的完整运行环境报告。 */
export interface TtsEnvironmentReport {
  /** 模型编号。 */
  modelId: string;
  /** 适配器编号。 */
  adapter: string;
  /** 所有必需项是否已经就绪。 */
  ready: boolean;
  /** 检测结果摘要。 */
  summary: string;
  /** 实际使用的 Python 路径。 */
  pythonProgram: string;
  /** Python 版本。 */
  pythonVersion: string;
  /** 当前计算加速方式。 */
  acceleration: string;
  /** 当前共享资源目录。 */
  resourceDirectory: string;
  /** 各项环境检查结果。 */
  checks: TtsEnvironmentCheck[];
  /** 可供用户执行的环境安装命令。 */
  setupCommands: string[];
  /** 本次结果是否直接复用了统一配置中的持久化缓存。 */
  cached: boolean;
  /** 检测发生时的 Unix 秒级时间戳。 */
  checkedAt: number;
}

/** 常驻 TTS Worker 的预热结果。 */
export interface TtsPreparationResult {
  /** 模型编号。 */
  modelId: string;
  /** Worker 是否可用于推理。 */
  ready: boolean;
  /** 是否复用了已加载 Worker。 */
  reused: boolean;
  /** PyTorch 实际计算设备。 */
  device: string;
  /** 显卡名称。 */
  gpu: string;
  /** PyTorch 版本。 */
  torchVersion: string;
  /** PyTorch 内置 CUDA 运行时版本。 */
  cudaRuntime: string;
  /** 可用显存，单位为 MiB。 */
  gpuMemoryMb: number;
  /** 模型加载耗时，单位为毫秒。 */
  loadMs: number;
}

/** Rust 后台 TTS 预热任务的生命周期阶段。 */
export type TtsPreloadPhase =
  | "idle"
  | "queued"
  | "loading"
  | "ready"
  | "error";

/** 后端通过事件同步给前端的后台预热状态。 */
export interface TtsPreloadStatus {
  /** 当前后台预热阶段。 */
  phase: TtsPreloadPhase;
  /** 当前任务对应的模型编号。 */
  modelId: string;
  /** 面向用户的中文状态说明。 */
  message: string;
  /** 成功后返回的设备、显存与耗时信息。 */
  result: TtsPreparationResult | null;
  /** 最近一次状态变化的 Unix 毫秒级时间戳。 */
  updatedAt: number;
}

/**
 * 可进入 TTS 自动播报队列的事件筛选键。
 *
 * 互动事件按平台动作完全拆分，确保进场、关注、分享、特别关注、互粉与点赞可分别开关。
 */
export type TtsSpeechEventType =
  | Exclude<LiveEventType, "interaction" | "system">
  | `interaction-${LiveInteractionKind}`;

/** 用户当前的语音播报偏好。 */
export interface TtsSettings {
  /** 使用系统语音或自定义模型。 */
  provider: "system" | "custom";
  /** 当前自定义模型编号。 */
  modelId: string;
  /** 当前自定义音色编号。 */
  voiceId: string;
  /** 当前系统语音 URI。 */
  systemVoiceUri: string;
  /** 语速倍率。 */
  rate: number;
  /** 音高倍率。 */
  pitch: number;
  /** 音量倍率。 */
  volume: number;
  /** 是否自动播报符合规则的事件。 */
  autoSpeak: boolean;
  /** 允许进入自动播报队列的事件种类。 */
  enabledEventTypes: TtsSpeechEventType[];
}
