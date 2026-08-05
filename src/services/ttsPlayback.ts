import type { InstalledTtsModel, TtsSettings } from "../types/tts";
import {
  loadTtsSettings,
  synthesizeCustomTts,
  ttsSettingsLabel,
} from "./tts";

let activeAudio: HTMLAudioElement | null = null;
let queueGeneration = 0;
let speechQueue: Promise<void> = Promise.resolve();

function playSystemSpeech(text: string, settings: TtsSettings) {
  return new Promise<void>((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("当前 WebView 没有系统语音接口"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.voiceURI === settings.systemVoiceUri);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`系统语音播放失败：${event.error}`));
    window.speechSynthesis.speak(utterance);
  });
}

async function playCustomSpeech(text: string, settings: TtsSettings) {
  if (!settings.modelId) throw new Error("尚未选择自定义 TTS 模型");
  const result = await synthesizeCustomTts(
    settings.modelId,
    text,
    settings.voiceId,
    settings.rate,
  );
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(result.audioDataUrl);
    activeAudio = audio;
    audio.volume = settings.volume;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      reject(new Error("自定义 TTS 音频播放失败"));
    };
    void audio.play().catch(reject);
  });
}

async function playOne(text: string, settings: TtsSettings) {
  if (settings.provider === "custom") {
    await playCustomSpeech(text, settings);
  } else {
    await playSystemSpeech(text, settings);
  }
}

export function enqueueSpeech(text: string, settings = loadTtsSettings()) {
  const generation = queueGeneration;
  speechQueue = speechQueue
    .catch(() => undefined)
    .then(async () => {
      if (generation !== queueGeneration || !settings.autoSpeak) return;
      await playOne(text, settings);
    });
  return speechQueue;
}

export async function previewSpeech(text: string, settings = loadTtsSettings()) {
  cancelSpeech();
  await playOne(text, settings);
}

export function pauseSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.pause();
  activeAudio?.pause();
}

export function resumeSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.resume();
  if (activeAudio?.paused) void activeAudio.play();
}

export function cancelSpeech() {
  queueGeneration += 1;
  speechQueue = Promise.resolve();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
}

export function currentTtsLabel(models: InstalledTtsModel[] = []) {
  return ttsSettingsLabel(loadTtsSettings(), models);
}
