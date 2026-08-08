import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { isDesktopRuntime } from "./desktop";
import type {
  InstalledTtsModel,
  TtsEnvironmentReport,
  TtsPreloadStatus,
  TtsPreparationResult,
  TtsSettings,
  TtsSynthesisResult,
} from "../types/tts";

const SETTINGS_KEY = "bilimaku.tts.settings.v1";
const LEGACY_SETTINGS_KEY = "bilicast.tts.settings.v1";
export const TTS_SETTINGS_EVENT = "bilimaku:tts-settings";
const TTS_PRELOAD_EVENT = "tts://preload-status";

export const defaultTtsSettings: TtsSettings = {
  provider: "system",
  modelId: "",
  voiceId: "",
  systemVoiceUri: "",
  rate: 1.05,
  pitch: 1,
  volume: 1,
  autoSpeak: true,
};

export function loadTtsSettings(): TtsSettings {
  try {
    const value = localStorage.getItem(SETTINGS_KEY)
      ?? localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!value) return defaultTtsSettings;
    const settings = {
      ...defaultTtsSettings,
      ...(JSON.parse(value) as Partial<TtsSettings>),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  } catch {
    return defaultTtsSettings;
  }
}

export function saveTtsSettings(settings: TtsSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(TTS_SETTINGS_EVENT, { detail: settings }));
  if (isDesktopRuntime()) {
    void invoke("update_tts_settings", { settings }).catch((error) => {
      console.warn("bilimaku TTS settings persistence failed", error);
    });
  }
}

/**
 * 启动时以 Rust 内存 Store 为准同步一次 TTS 设置；统一配置为空时，
 * Rust 会返回与前端一致的默认值。
 */
export async function hydrateTtsSettings(): Promise<TtsSettings> {
  if (!isDesktopRuntime()) return loadTtsSettings();
  const settings = await invoke<TtsSettings>("get_tts_settings");
  const normalized = { ...defaultTtsSettings, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(TTS_SETTINGS_EVENT, { detail: normalized }));
  return normalized;
}

export async function listTtsModels(): Promise<InstalledTtsModel[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<InstalledTtsModel[]>("list_tts_models");
}

export async function chooseAndImportTtsModel(): Promise<InstalledTtsModel | null> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 bilimaku 桌面窗口导入模型目录");
  }
  const selected = await open({
    title: "选择 TTS 模型目录（bilimaku 会自动识别架构）",
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<InstalledTtsModel>("import_tts_model", { modelDir: selected });
}

export async function removeTtsModel(modelId: string): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("remove_tts_model", { modelId });
}

export async function inspectTtsEnvironment(
  modelId: string,
  force = false,
): Promise<TtsEnvironmentReport> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 bilimaku 桌面窗口检查 TTS 运行环境");
  }
  return invoke<TtsEnvironmentReport>("inspect_tts_environment", { modelId, force });
}

export async function prepareTtsModel(modelId: string): Promise<TtsPreparationResult> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 bilimaku 桌面窗口预热 TTS 模型");
  }
  return invoke<TtsPreparationResult>("prepare_tts_model", { modelId });
}

/** 把模型预热交给 Rust 后台任务，调用会在任务入队后立即返回。 */
export async function preloadTtsModel(modelId: string): Promise<TtsPreloadStatus> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 bilimaku 桌面窗口预热 TTS 模型");
  }
  return invoke<TtsPreloadStatus>("preload_tts_model", { modelId });
}

/** 读取 Rust 内存中的最新后台预热状态。 */
export async function getTtsPreloadStatus(): Promise<TtsPreloadStatus | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<TtsPreloadStatus>("get_tts_preload_status");
}

/** 订阅后台预热的 queued、loading、ready 与 error 状态。 */
export async function listenToTtsPreloadStatus(
  callback: (status: TtsPreloadStatus) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) return () => undefined;
  return listen<TtsPreloadStatus>(TTS_PRELOAD_EVENT, (event) => callback(event.payload));
}

export async function chooseAndRegisterChineseBert(): Promise<string | null> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 bilimaku 桌面窗口选择 Chinese BERT 目录");
  }
  const selected = await open({
    title: "选择 chinese-roberta-wwm-ext-large 或它的上级目录",
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<string>("register_tts_bert_resource", { resourceDir: selected });
}

export async function synthesizeCustomTts(
  modelId: string,
  text: string,
  voice: string,
  speed: number,
): Promise<TtsSynthesisResult> {
  if (!isDesktopRuntime()) {
    throw new Error("自定义模型推理需要从 bilimaku 桌面窗口启动");
  }
  return invoke<TtsSynthesisResult>("synthesize_custom_tts", {
    request: { modelId, text, voice, speed },
  });
}

export function ttsSettingsLabel(
  settings: TtsSettings,
  models: InstalledTtsModel[] = [],
) {
  if (settings.provider === "system") return "系统语音 · 中文";
  const model = models.find((item) => item.id === settings.modelId);
  const voice = model?.voices.find((item) => item.id === settings.voiceId);
  return [model?.name || "自定义 TTS", voice?.name].filter(Boolean).join(" · ");
}
