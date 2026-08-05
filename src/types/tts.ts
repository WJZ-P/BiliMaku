export interface TtsVoice {
  id: string;
  name: string;
  language: string;
}

export type TtsRuntime =
  | {
      type: "command";
      program: string;
      args: string[];
      outputFormat: string;
      timeoutSeconds: number;
    }
  | {
      type: "openai-http";
      endpoint: string;
      model: string;
      apiKeyEnv: string;
      responseFormat: string;
      timeoutSeconds: number;
    };

export interface InstalledTtsModel {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  runtime: TtsRuntime;
  voices: TtsVoice[];
  defaultVoice: string;
  modelDir: string;
  importedAt: number;
}

export interface TtsSynthesisResult {
  audioDataUrl: string;
  mimeType: string;
  bytes: number;
}

export interface TtsSettings {
  provider: "system" | "custom";
  modelId: string;
  voiceId: string;
  systemVoiceUri: string;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
}
