import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isDesktopRuntime } from "./desktop";
import type {
  InstalledTtsModel,
  TtsSettings,
  TtsSynthesisResult,
} from "../types/tts";

const SETTINGS_KEY = "bilicast.tts.settings.v1";
export const TTS_SETTINGS_EVENT = "bilicast:tts-settings";

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
    const value = localStorage.getItem(SETTINGS_KEY);
    if (!value) return defaultTtsSettings;
    return { ...defaultTtsSettings, ...(JSON.parse(value) as Partial<TtsSettings>) };
  } catch {
    return defaultTtsSettings;
  }
}

export function saveTtsSettings(settings: TtsSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(TTS_SETTINGS_EVENT, { detail: settings }));
}

export async function listTtsModels(): Promise<InstalledTtsModel[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<InstalledTtsModel[]>("list_tts_models");
}

export async function chooseAndImportTtsModel(): Promise<InstalledTtsModel | null> {
  if (!isDesktopRuntime()) {
    throw new Error("请从 BiliCast 桌面窗口导入模型目录");
  }
  const selected = await open({
    title: "选择包含 bilicast-tts.json 的 TTS 模型目录",
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

export async function synthesizeCustomTts(
  modelId: string,
  text: string,
  voice: string,
  speed: number,
): Promise<TtsSynthesisResult> {
  if (!isDesktopRuntime()) {
    throw new Error("自定义模型推理需要从 BiliCast 桌面窗口启动");
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
