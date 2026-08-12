import { styled } from "@linaria/react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { CardDanmakuParticles } from "../../components/CardDanmakuParticles";
import { Icon } from "../../components/Icon";
import { VoiceSearchSelect } from "./VoiceSearchSelect";
import {
  AnimatedSwitchTrack as SwitchTrack,
  FrostedPanel,
  FrostedPanelSurface,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelMeta,
  PanelTitle,
} from "../../components/ui";
import {
  chooseAndRegisterChineseBert,
  chooseAndImportTtsModel,
  defaultTtsSettings,
  getTtsPreloadStatus,
  inspectTtsEnvironment,
  listenToTtsPreloadStatus,
  listTtsModels,
  loadTtsSettings,
  preloadTtsModel,
  removeTtsModel,
  saveTtsSettings,
} from "../../services/tts";
import { cancelSpeech, previewSpeech } from "../../services/ttsPlayback";
import { theme } from "../../styles/theme";
import type {
  InstalledTtsModel,
  TtsEnvironmentReport,
  TtsEnvironmentState,
  TtsPreloadStatus,
  TtsPreparationResult,
  TtsSettings,
  TtsSpeechEventType,
} from "../../types/tts";

const Page = styled.div`
  display: grid;
  gap: 12px;
  padding: 12px 20px 24px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
  align-items: start;
  gap: 12px;

  @media (max-width: 1080px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const PreviewPanel = styled(FrostedPanel)`
  grid-column: 1 / -1;
`;

const HeaderAside = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brandDeep} 35%, ${theme.colors.brand});
  border-radius: 5px;
  background: linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandDeep});
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 800;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 38%, transparent),
    0 5px 13px color-mix(in srgb, ${theme.colors.brand} 18%, transparent);
  transition:
    transform ${theme.motion.fast},
    filter ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  &:hover:not(:disabled) {
    filter: saturate(1.08) brightness(1.04);
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 48%, transparent),
      0 7px 16px color-mix(in srgb, ${theme.colors.brand} 23%, transparent);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.58;
  }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 82%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.surface} 42%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 760;
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  backdrop-filter: blur(6px) saturate(1.2);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    color ${theme.motion.fast},
    transform ${theme.motion.fast};

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 48%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 46%, transparent);
    color: ${theme.colors.brandDeep};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }
`;

const EngineBody = styled.div`
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
`;

const EngineItem = styled.div`
  display: grid;
  gap: 5px;
`;

const EngineCard = styled.button`
  position: relative;
  display: grid;
  width: 100%;
  min-height: 62px;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 68%, transparent);
  border-radius: 4px;
  background:
    linear-gradient(
      126deg,
      color-mix(in srgb, ${theme.colors.highlight} 16%, transparent),
      transparent 48%
    ),
    color-mix(in srgb, ${theme.colors.surface} 36%, transparent);
  color: inherit;
  text-align: left;
  -webkit-backdrop-filter: blur(6px) saturate(1.24);
  backdrop-filter: blur(6px) saturate(1.24);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    transform ${theme.motion.fast};

  &::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: ${theme.colors.brand};
    content: "";
    opacity: 0;
    transform: scaleY(0.45);
    transition:
      opacity ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 48%, ${theme.colors.borderStrong});
    background:
      linear-gradient(126deg, color-mix(in srgb, ${theme.colors.brandSoft} 28%, transparent), transparent 54%),
      color-mix(in srgb, ${theme.colors.surface} 48%, transparent);
  }

  &[data-active="true"]::before {
    opacity: 1;
    transform: scaleY(1);
  }

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 38%, ${theme.colors.borderStrong});
    transform: translateX(2px);
  }
`;

const EngineIcon = styled.span`
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-left: 2px solid color-mix(in srgb, ${theme.colors.brand} 58%, transparent);
  color: ${theme.colors.brandDeep};
`;

const EngineCopy = styled.span`
  display: block;
  min-width: 0;
`;

const EngineName = styled.span`
  display: block;
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 820;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EngineDescription = styled.span`
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RuntimeText = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 720;
  letter-spacing: 0.03em;
`;

const ModelMeta = styled.div`
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  padding: 1px 5px 3px 42px;
  color: ${theme.colors.textMuted};
  font-size: 8px;

  & > span + span::before {
    margin: 0 7px;
    color: ${theme.colors.borderStrong};
    content: "|";
  }
`;

const RemoveButton = styled.button`
  margin-left: auto;
  padding: 2px 0 2px 8px;
  border: 0;
  background: transparent;
  color: ${theme.colors.danger};
  font-size: 8px;
  font-weight: 750;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const EmptyModels = styled.div`
  padding: 17px 14px;
  border: 1px dashed color-mix(in srgb, ${theme.colors.borderStrong} 82%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 24%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.7;
  text-align: center;
`;

const SettingsBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 16px 20px 20px;
`;

const Field = styled.label`
  display: grid;
  gap: 7px;
`;

const FieldTop = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 760;
`;

const FieldValue = styled.span`
  color: ${theme.colors.brandDeep};
  font-family: ${theme.typography.mono};
  font-size: 10px;
  font-weight: 820;
`;

const Select = styled.select`
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 78%, transparent);
  border-radius: 4px;
  outline: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 58%, transparent);
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  backdrop-filter: blur(6px) saturate(1.2);

  &:focus {
    border-color: ${theme.colors.brand};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
  }
`;

const ParameterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 540px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Range = styled.input`
  --range-track-height: 5px;
  --range-thumb-size: 15px;

  width: 100%;
  height: 26px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: grab;

  &::-webkit-slider-runnable-track {
    height: var(--range-track-height);
    border-radius: 3px;
    background:
      linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan})
        0 / var(--range-progress, 50%) 100% no-repeat,
      color-mix(in srgb, ${theme.colors.surfacePressed} 76%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, ${theme.colors.borderStrong} 76%, transparent);
    transition: height 180ms cubic-bezier(0.18, 1.35, 0.35, 1);
  }

  &::-webkit-slider-thumb {
    width: var(--range-thumb-size);
    height: var(--range-thumb-size);
    margin-top: calc((var(--range-track-height) - var(--range-thumb-size)) / 2);
    appearance: none;
    border: 2px solid ${theme.colors.brandDeep};
    border-radius: 4px;
    background: linear-gradient(145deg, ${theme.colors.surface}, ${theme.colors.cyanSoft});
    box-shadow: 0 3px 9px color-mix(in srgb, ${theme.colors.brandDeep} 18%, transparent);
    transition:
      margin-top 180ms cubic-bezier(0.18, 1.35, 0.35, 1),
      transform ${theme.motion.spring};
  }

  &:hover,
  &:focus-visible {
    --range-track-height: 7px;
  }

  &:active {
    --range-track-height: 9px;
    cursor: grabbing;
  }

  &:active::-webkit-slider-thumb {
    transform: scale(1.12);
  }

  &:focus-visible {
    outline: 1px solid ${theme.colors.brand};
    outline-offset: 2px;
  }
`;

const AutoSpeakSwitch = styled.label`
  position: relative;
  display: grid;
  min-height: 62px;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 68%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 34%, transparent);
  cursor: pointer;
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  backdrop-filter: blur(6px) saturate(1.2);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 46%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 34%, transparent);
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  input:checked + span {
    border-color: color-mix(in srgb, ${theme.colors.brand} 62%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 26%, transparent),
      0 4px 13px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
  }

  input:checked + span::before {
    opacity: 1;
  }

  input:checked + span::after {
    transform: translateX(18px) rotate(90deg);
  }
`;

const SwitchIcon = styled.span`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-left: 2px solid color-mix(in srgb, ${theme.colors.brand} 62%, transparent);
  background: color-mix(in srgb, ${theme.colors.brandSoft} 28%, transparent);
  color: ${theme.colors.brandDeep};
`;

const SwitchCopy = styled.span`
  display: grid;
  min-width: 0;
  gap: 3px;

  strong {
    color: ${theme.colors.textPrimary};
    font-size: 10px;
    font-weight: 820;
  }

  small {
    color: ${theme.colors.textMuted};
    font-size: 8px;
    line-height: 1.45;
  }
`;


const SpeechEventSection = styled.section`
  display: grid;
  gap: 9px;
  padding-top: 13px;
  border-top: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 64%, transparent);
`;

const SpeechEventHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const SpeechEventTitle = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  font-weight: 820;
`;

const SpeechEventHint = styled.div`
  max-width: 270px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.5;
  text-align: right;
`;

const SpeechEventGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
`;

const SpeechEventOption = styled.label`
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 7px;
  padding: 8px 9px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 62%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 32%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  line-height: 1.42;
  -webkit-backdrop-filter: blur(5px) saturate(1.18);
  backdrop-filter: blur(5px) saturate(1.18);
  transition:
    border-color ${theme.motion.normal},
    background ${theme.motion.normal},
    transform ${theme.motion.fast};

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 44%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 48%, transparent);
    color: ${theme.colors.textPrimary};
  }

  &:hover {
    transform: translateX(1px);
  }

  input {
    margin: 1px 0 0;
    accent-color: ${theme.colors.brand};
  }

  strong {
    display: block;
    margin-bottom: 1px;
    font-size: 9px;
  }
`;

const EnvironmentCard = styled.section`
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 70%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 30%, transparent);
  -webkit-backdrop-filter: blur(7px) saturate(1.22);
  backdrop-filter: blur(7px) saturate(1.22);
`;

const EnvironmentHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const EnvironmentTitle = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  font-weight: 820;
`;

const EnvironmentSummary = styled.div`
  margin-top: 3px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.55;
`;

const EnvironmentState = styled.span`
  flex: 0 0 auto;
  color: ${theme.colors.warning};
  font-size: 9px;
  font-weight: 800;

  &[data-ready="true"] {
    color: ${theme.colors.success};
  }
`;

const EnvironmentChecks = styled.div`
  display: grid;
  gap: 7px;
`;

const EnvironmentCheckRow = styled.div`
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  gap: 8px;
  padding-top: 7px;
  border-top: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 54%, transparent);
`;

const CheckDot = styled.span`
  width: 7px;
  height: 7px;
  margin-top: 3px;
  border-radius: 50%;
  background: ${theme.colors.warning};

  &[data-state="ready"] { background: ${theme.colors.success}; }
  &[data-state="missing"] { background: ${theme.colors.danger}; }
`;

const CheckName = styled.div`
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 800;
`;

const CheckDetail = styled.div`
  overflow-wrap: anywhere;
  margin-top: 2px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.5;
`;

const CheckGuide = styled.div`
  margin-top: 3px;
  color: ${theme.colors.warning};
  font-size: 8px;
  line-height: 1.5;

  a {
    margin-left: 5px;
    color: ${theme.colors.brandDeep};
    font-weight: 750;
  }
`;

const SetupCommands = styled.div`
  display: grid;
  gap: 5px;
`;

const SetupCommand = styled.button`
  overflow: hidden;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 72%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, ${theme.colors.surface} 46%, transparent);
  color: ${theme.colors.textSecondary};
  font: 7px/1.45 ${theme.typography.mono};
  text-align: left;
  text-overflow: ellipsis;

  &:hover { border-color: ${theme.colors.brand}; }
`;

const EnvironmentActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

const PreviewBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 16px 20px 20px;

  @media (max-width: 620px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const TextArea = styled.textarea`
  min-height: 74px;
  resize: vertical;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 76%, transparent);
  border-radius: 4px;
  outline: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 54%, transparent);
  color: ${theme.colors.textPrimary};
  font: 10px/1.65 ${theme.typography.family};
  -webkit-backdrop-filter: blur(7px) saturate(1.2);
  backdrop-filter: blur(7px) saturate(1.2);

  &:focus {
    border-color: ${theme.colors.brand};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
  }
`;

const PreviewActions = styled.div`
  display: grid;
  min-width: 92px;
  align-content: center;
  gap: 7px;
`;

const Notice = styled.div`
  grid-column: 1 / -1;
  padding: 9px 10px;
  border-left: 2px solid ${theme.colors.danger};
  border-radius: 3px;
  background: color-mix(in srgb, ${theme.colors.dangerSoft} 58%, transparent);
  color: ${theme.colors.danger};
  font-size: 9px;
  line-height: 1.55;

  &[data-success="true"] {
    border-left-color: ${theme.colors.success};
    background: color-mix(in srgb, ${theme.colors.successSoft} 62%, transparent);
    color: ${theme.colors.success};
  }
`;

function rangeProgress(value: number, min: number, max: number): CSSProperties {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return { "--range-progress": `${progress}%` } as CSSProperties;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function runtimeLabel(model: InstalledTtsModel) {
  if (model.runtime.type === "builtin") {
    return model.runtime.adapter.toUpperCase();
  }
  return model.runtime.type.toUpperCase();
}

function checkStateLabel(state: TtsEnvironmentState) {
  if (state === "ready") return "就绪";
  if (state === "missing") return "待配置";
  return "提示";
}

const speechEventOptions = [
  { value: "message", label: "弹幕", description: "用户发送的普通弹幕" },
  { value: "interaction-enter", label: "进场", description: "用户进入直播间" },
  { value: "interaction-follow", label: "关注", description: "用户关注主播" },
  { value: "interaction-share", label: "分享", description: "用户分享直播间" },
  { value: "interaction-special-follow", label: "特别关注", description: "用户特别关注主播" },
  { value: "interaction-mutual-follow", label: "互粉", description: "用户与主播互相关注" },
  { value: "interaction-like", label: "点赞", description: "用户为主播点赞" },
  { value: "gift", label: "礼物", description: "普通礼物事件" },
  { value: "superchat", label: "醒目留言", description: "Super Chat 消息" },
  { value: "guard", label: "大航海", description: "舰长、提督和总督" },
] satisfies ReadonlyArray<{
  value: TtsSpeechEventType;
  label: string;
  description: string;
}>;

/** 未选择模型时复用同一个空音色集合，避免搜索框被无意义地重置。 */
const EMPTY_TTS_VOICES: InstalledTtsModel["voices"] = [];
export function VoiceStudioPage() {
  const [models, setModels] = useState<InstalledTtsModel[]>([]);
  const [settings, setSettings] = useState<TtsSettings>(() => loadTtsSettings());
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testText, setTestText] = useState("欢迎使用 bilimaku 自定义语音模型，今天也要开心直播喵！");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);
  const [environment, setEnvironment] = useState<TtsEnvironmentReport | null>(null);
  const [checkingEnvironment, setCheckingEnvironment] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<TtsPreloadStatus | null>(null);

  const refreshModels = async () => {
    setModels(await listTtsModels());
  };

  useEffect(() => {
    void refreshModels().catch((error) => {
      setSuccess(false);
      setNotice(errorText(error));
    });
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setSystemVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === settings.modelId) ?? null,
    [models, settings.modelId],
  );
  const selectedPreloadStatus = preloadStatus?.modelId === settings.modelId
    ? preloadStatus
    : null;
  const preparation: TtsPreparationResult | null = selectedPreloadStatus?.result ?? null;
  const preparingModel = selectedPreloadStatus?.phase === "queued"
    || selectedPreloadStatus?.phase === "loading";

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const applyStatus = (status: TtsPreloadStatus) => {
      if (!active) return;
      setPreloadStatus(status);
      if (status.phase === "error") {
        setSuccess(false);
        setNotice(status.message);
      }
    };
    void listenToTtsPreloadStatus(applyStatus).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    void getTtsPreloadStatus().then((status) => {
      if (status) applyStatus(status);
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const refreshEnvironment = async (modelId: string) => {
    setCheckingEnvironment(true);
    try {
      const report = await inspectTtsEnvironment(modelId, true);
      setEnvironment(report);
    } catch (error) {
      setEnvironment(null);
      setSuccess(false);
      setNotice(errorText(error));
    } finally {
      setCheckingEnvironment(false);
    }
  };

  useEffect(() => {
    if (settings.provider !== "custom" || !settings.modelId) {
      setEnvironment(null);
      setCheckingEnvironment(false);
      return;
    }
    let active = true;
    setCheckingEnvironment(true);
    void inspectTtsEnvironment(settings.modelId)
      .then((report) => {
        if (active) setEnvironment(report);
      })
      .catch((error) => {
        if (!active) return;
        setEnvironment(null);
        setSuccess(false);
        setNotice(errorText(error));
      })
      .finally(() => {
        if (active) setCheckingEnvironment(false);
      });
    return () => {
      active = false;
    };
  }, [settings.modelId, settings.provider]);

  useEffect(() => {
    if (
      settings.provider !== "custom" ||
      !settings.modelId ||
      !environment?.ready ||
      environment.modelId !== settings.modelId
    ) {
      return;
    }
    let active = true;
    void preloadTtsModel(settings.modelId)
      .then((status) => {
        if (active) setPreloadStatus(status);
      })
      .catch((error) => {
        if (!active) return;
        setSuccess(false);
        setNotice(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [environment, settings.modelId, settings.provider]);

  const updateSettings = (patch: Partial<TtsSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveTtsSettings(next);
  };

  const toggleSpeechEventType = (type: TtsSpeechEventType) => {
    const enabledEventTypes = settings.enabledEventTypes.includes(type)
      ? settings.enabledEventTypes.filter((item) => item !== type)
      : [...settings.enabledEventTypes, type];
    updateSettings({ enabledEventTypes });
  };

  const importModel = async () => {
    setBusy(true);
    setNotice("");
    try {
      const model = await chooseAndImportTtsModel();
      if (!model) return;
      await refreshModels();
      updateSettings({
        provider: "custom",
        modelId: model.id,
        voiceId: model.defaultVoice || model.voices[0]?.id || "",
      });
      setSuccess(true);
      setNotice(`已识别并导入 ${model.name}，共发现 ${model.voices.length} 个音色`);
    } catch (error) {
      setSuccess(false);
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const registerChineseBert = async () => {
    setBusy(true);
    setNotice("");
    try {
      const path = await chooseAndRegisterChineseBert();
      if (!path) return;
      setSuccess(true);
      setNotice(`Chinese BERT 已登记：${path}`);
      if (settings.modelId) {
        await refreshEnvironment(settings.modelId);
      }
    } catch (error) {
      setSuccess(false);
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const removeModel = async (modelId: string) => {
    setBusy(true);
    try {
      await removeTtsModel(modelId);
      const remaining = models.filter((model) => model.id !== modelId);
      setModels(remaining);
      if (settings.modelId === modelId) {
        updateSettings({ provider: "system", modelId: "", voiceId: "" });
      }
      setSuccess(true);
      setNotice("模型登记已移除，原模型文件保持原样");
    } catch (error) {
      setSuccess(false);
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setBusy(true);
    setNotice("");
    try {
      await previewSpeech(testText, settings);
      setSuccess(true);
      setNotice("试听播放完成");
    } catch (error) {
      setSuccess(false);
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Grid>
        <FrostedPanel>
          <FrostedPanelSurface>
            <CardDanmakuParticles seed={0x564f4943} />
            <PanelHeader>
              <PanelHeading>
                <PanelTitle>播报角色</PanelTitle>
                <PanelDescription>选择系统音色或已导入的本地语音模型</PanelDescription>
              </PanelHeading>
              <HeaderAside>
                <PanelMeta>{models.length} 个自定义模型</PanelMeta>
                <SecondaryButton type="button" onClick={() => void refreshModels()}>
                  <Icon name="radio" size={13} />
                  刷新
                </SecondaryButton>
                <PrimaryButton type="button" onClick={() => void importModel()} disabled={busy}>
                  <Icon name="sparkles" size={14} />
                  {busy ? "识别中…" : "导入模型"}
                </PrimaryButton>
              </HeaderAside>
            </PanelHeader>
            <EngineBody>
              <EngineItem>
                <EngineCard
                  type="button"
                  data-active={settings.provider === "system"}
                  onClick={() => updateSettings({ provider: "system" })}
                >
                  <EngineIcon><Icon name="volume" size={18} /></EngineIcon>
                  <EngineCopy>
                    <EngineName>系统语音</EngineName>
                    <EngineDescription>使用 Windows / WebView 提供的 SpeechSynthesis 音色</EngineDescription>
                  </EngineCopy>
                  <RuntimeText>内置</RuntimeText>
                </EngineCard>
              </EngineItem>

              {models.map((model) => (
                <EngineItem key={model.id}>
                  <EngineCard
                    type="button"
                    data-active={settings.provider === "custom" && settings.modelId === model.id}
                    onClick={() =>
                      updateSettings({
                        provider: "custom",
                        modelId: model.id,
                        voiceId: model.defaultVoice || model.voices[0]?.id || "",
                      })
                    }
                  >
                    <EngineIcon><Icon name="waveform" size={18} /></EngineIcon>
                    <EngineCopy>
                      <EngineName>{model.name}</EngineName>
                      <EngineDescription>{model.description || model.modelDir}</EngineDescription>
                    </EngineCopy>
                    <RuntimeText>{runtimeLabel(model)}</RuntimeText>
                  </EngineCard>
                  <ModelMeta>
                    <span>{model.version || "未标版本"}</span>
                    <span>{model.author || "本地模型"}</span>
                    <span>{model.voices.length} 个音色</span>
                    <RemoveButton type="button" onClick={() => void removeModel(model.id)}>
                      移除登记
                    </RemoveButton>
                  </ModelMeta>
                </EngineItem>
              ))}

              {models.length === 0 ? (
                <EmptyModels>
                  还没有自定义模型。点击“导入模型”选择原始目录，BiliMaku 会自动识别架构与音色。
                </EmptyModels>
              ) : null}
            </EngineBody>
          </FrostedPanelSurface>
        </FrostedPanel>

        <FrostedPanel>
          <FrostedPanelSurface>
            <CardDanmakuParticles seed={0x54545350} />
            <PanelHeader>
              <PanelHeading>
                <PanelTitle>音色与播报</PanelTitle>
                <PanelDescription>调整当前角色的音色、合成参数与自动播报范围</PanelDescription>
              </PanelHeading>
              <PanelMeta>{settings.provider === "custom" ? "本地模型" : "系统语音"}</PanelMeta>
            </PanelHeader>
            <SettingsBody>
              {settings.provider === "system" ? (
                <Field>
                  <FieldTop>系统音色</FieldTop>
                  <Select
                    value={settings.systemVoiceUri}
                    onChange={(event) => updateSettings({ systemVoiceUri: event.target.value })}
                  >
                    <option value="">自动选择中文音色</option>
                    {systemVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} · {voice.lang}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field>
                  <FieldTop>模型音色</FieldTop>
                  <VoiceSearchSelect
                    voices={selectedModel?.voices ?? EMPTY_TTS_VOICES}
                    value={settings.voiceId}
                    disabled={!selectedModel || selectedModel.voices.length === 0}
                    onChange={(voiceId) => updateSettings({ voiceId })}
                  />
                </Field>
              )}

              {settings.provider === "custom" && selectedModel ? (
                <EnvironmentCard>
                  <EnvironmentHeader>
                    <div>
                      <EnvironmentTitle>运行环境</EnvironmentTitle>
                      <EnvironmentSummary>
                        {checkingEnvironment
                          ? "正在检查 Python、推理依赖、BERT 与计算设备…"
                          : preparingModel
                            ? "环境检查通过，正在把 BERT 与音色模型预热到显存…"
                            : selectedPreloadStatus?.phase === "error"
                              ? selectedPreloadStatus.message
                              : preparation?.ready
                                ? `${preparation.gpu || preparation.device} 已驻留显存 · ${preparation.gpuMemoryMb} MiB · 预热 ${(preparation.loadMs / 1000).toFixed(1)} 秒`
                                : environment?.cached
                                  ? `${environment.summary} · 已复用上次检查结果`
                                  : environment?.summary || "等待环境检查"}
                      </EnvironmentSummary>
                    </div>
                    <EnvironmentState
                      data-ready={environment?.ready === true && selectedPreloadStatus?.phase !== "error"}
                    >
                      {checkingEnvironment
                        ? "检查中"
                        : preparingModel
                          ? "预热中"
                          : selectedPreloadStatus?.phase === "error"
                            ? "异常"
                            : preparation?.ready
                              ? "GPU 就绪"
                              : environment?.ready
                                ? "已就绪"
                                : "待配置"}
                    </EnvironmentState>
                  </EnvironmentHeader>

                  {environment ? (
                    <EnvironmentChecks>
                      {environment.checks.map((check) => (
                        <EnvironmentCheckRow key={check.id}>
                          <CheckDot data-state={check.state} />
                          <div>
                            <CheckName>{check.label} · {checkStateLabel(check.state)}</CheckName>
                            <CheckDetail>{check.detail}</CheckDetail>
                            {check.guide || check.downloadUrl ? (
                              <CheckGuide>
                                {check.guide}
                                {check.downloadUrl ? (
                                  <a href={check.downloadUrl} target="_blank" rel="noreferrer">
                                    查看下载页
                                  </a>
                                ) : null}
                              </CheckGuide>
                            ) : null}
                          </div>
                        </EnvironmentCheckRow>
                      ))}
                    </EnvironmentChecks>
                  ) : null}

                  {environment?.setupCommands.length ? (
                    <SetupCommands>
                      {environment.setupCommands.map((command) => (
                        <SetupCommand
                          key={command}
                          type="button"
                          data-tooltip="点击复制命令"
                          onClick={() => void navigator.clipboard.writeText(command)}
                        >
                          {command}
                        </SetupCommand>
                      ))}
                    </SetupCommands>
                  ) : null}

                  <EnvironmentActions>
                    <SecondaryButton
                      type="button"
                      disabled={busy}
                      onClick={() => void registerChineseBert()}
                    >
                      选择 Chinese BERT
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={checkingEnvironment}
                      onClick={() => void refreshEnvironment(selectedModel.id)}
                    >
                      {checkingEnvironment ? "检查中…" : "重新检查环境"}
                    </SecondaryButton>
                  </EnvironmentActions>
                </EnvironmentCard>
              ) : null}

              <ParameterGrid>
                <Field>
                  <FieldTop>语速 <FieldValue>{settings.rate.toFixed(2)}×</FieldValue></FieldTop>
                  <Range
                    type="range" min="0.5" max="2" step="0.05" value={settings.rate}
                    style={rangeProgress(settings.rate, 0.5, 2)}
                    onChange={(event) => updateSettings({ rate: Number(event.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldTop>音量 <FieldValue>{Math.round(settings.volume * 100)}%</FieldValue></FieldTop>
                  <Range
                    type="range" min="0" max="1" step="0.05" value={settings.volume}
                    style={rangeProgress(settings.volume, 0, 1)}
                    onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
                  />
                </Field>
                {settings.provider === "system" ? (
                  <Field>
                    <FieldTop>音调 <FieldValue>{settings.pitch.toFixed(2)}</FieldValue></FieldTop>
                    <Range
                      type="range" min="0.5" max="2" step="0.05" value={settings.pitch}
                      style={rangeProgress(settings.pitch, 0.5, 2)}
                      onChange={(event) => updateSettings({ pitch: Number(event.target.value) })}
                    />
                  </Field>
                ) : null}
              </ParameterGrid>

              <AutoSpeakSwitch>
                <SwitchIcon><Icon name="volume" size={17} /></SwitchIcon>
                <SwitchCopy>
                  <strong>自动语音播报</strong>
                  <small>直播事件进入当前语音队列；关闭后仅保留手动试听</small>
                </SwitchCopy>
                <input
                  type="checkbox"
                  checked={settings.autoSpeak}
                  onChange={(event) => updateSettings({ autoSpeak: event.target.checked })}
                />
                <SwitchTrack aria-hidden="true" />
              </AutoSpeakSwitch>

              <SpeechEventSection>
                <SpeechEventHeading>
                  <SpeechEventTitle>播报事件</SpeechEventTitle>
                  <SpeechEventHint>弹幕、进场与关注均可独立控制</SpeechEventHint>
                </SpeechEventHeading>
                <SpeechEventGrid>
                  {speechEventOptions.map((option) => {
                    const active = settings.enabledEventTypes.includes(option.value);
                    return (
                      <SpeechEventOption key={option.value} data-active={active}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSpeechEventType(option.value)}
                        />
                        <span>
                          <strong>{option.label}</strong>
                          {option.description}
                        </span>
                      </SpeechEventOption>
                    );
                  })}
                </SpeechEventGrid>
              </SpeechEventSection>
            </SettingsBody>
          </FrostedPanelSurface>
        </FrostedPanel>

        <PreviewPanel>
          <FrostedPanelSurface>
            <CardDanmakuParticles seed={0x50524556} />
            <PanelHeader>
              <PanelHeading>
                <PanelTitle>试听</PanelTitle>
                <PanelDescription>输入文本确认当前音色与合成参数</PanelDescription>
              </PanelHeading>
              <PanelMeta>{preparingModel ? "模型预热中" : "实时试听"}</PanelMeta>
            </PanelHeader>
            <PreviewBody>
              <TextArea
                aria-label="试听文本"
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
              />
              <PreviewActions>
                <PrimaryButton
                  type="button"
                  onClick={() => void preview()}
                  disabled={
                    busy ||
                    preparingModel ||
                    !testText.trim() ||
                    (settings.provider === "custom" &&
                      (checkingEnvironment || environment?.ready !== true))
                  }
                >
                  <Icon name="play" size={14} />
                  {preparingModel ? "预热中…" : "试听"}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={cancelSpeech}>
                  <Icon name="pause" size={13} />
                  停止
                </SecondaryButton>
              </PreviewActions>
              {notice ? <Notice data-success={success}>{notice}</Notice> : null}
            </PreviewBody>
          </FrostedPanelSurface>
        </PreviewPanel>
      </Grid>
    </Page>
  );
}
