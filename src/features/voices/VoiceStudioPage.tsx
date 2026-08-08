import { styled } from "@linaria/react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import {
  EyebrowBadge,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
  SubtleButton,
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
} from "../../types/tts";

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Intro = styled.section`
  position: relative;
  display: grid;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 24px;
  padding: 28px 30px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};
`;

const IntroKicker = styled.div`
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.16em;
`;

const IntroTitle = styled.h2`
  margin: 7px 0 10px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(25px, 3vw, 37px);
  font-weight: 850;
  letter-spacing: -0.05em;
`;

const IntroDescription = styled.p`
  max-width: 720px;
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  line-height: 1.75;
`;

const IntroActions = styled.div`
  display: flex;
  gap: 9px;
  margin-top: 20px;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 15px;
  border: 0;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 9px 22px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);

  &:disabled {
    cursor: wait;
    opacity: 0.58;
  }
`;

const IntroOrb = styled.div`
  position: relative;
  display: grid;
  min-height: 150px;
  place-items: center;
`;

const Orb = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  width: 108px;
  height: 108px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 20%, transparent);
  border-radius: 38% 62% 52% 48%;
  background: color-mix(in srgb, ${theme.colors.brandSoft} 84%, white);
  color: ${theme.colors.brand};
  box-shadow: 0 24px 60px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
  transform: rotate(-8deg);

  svg {
    transform: rotate(8deg);
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  gap: 16px;

  @media (max-width: 1120px) {
    grid-template-columns: 1fr;
  }
`;

const EngineBody = styled.div`
  display: grid;
  gap: 10px;
  padding: 18px 20px 21px;
`;

const EngineCard = styled.button`
  display: grid;
  width: 100%;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: ${theme.colors.surfaceMuted};
  color: inherit;
  text-align: left;
  transition: all ${theme.motion.fast};

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 42%, ${theme.colors.border});
    background: ${theme.colors.brandSubtle};
    box-shadow: 0 10px 24px color-mix(in srgb, ${theme.colors.brand} 10%, transparent);
  }
`;

const EngineIcon = styled.span`
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: ${theme.colors.surface};
  color: ${theme.colors.brand};
`;

const EngineName = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
`;

const EngineDescription = styled.div`
  overflow: hidden;
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.55;
  text-overflow: ellipsis;
`;

const RuntimeBadge = styled.span`
  padding: 4px 7px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.surface};
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 700;
`;

const ModelMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 5px 5px 54px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

const RemoveButton = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: ${theme.colors.danger};
  font-size: 8px;
  font-weight: 700;
`;

const EmptyModels = styled.div`
  padding: 22px;
  border: 1px dashed ${theme.colors.borderStrong};
  border-radius: ${theme.radius.md};
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.75;
  text-align: center;
`;

const SettingsBody = styled.div`
  display: grid;
  gap: 15px;
  padding: 18px 20px 21px;
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
  font-size: 9px;
  font-weight: 750;
`;

const FieldValue = styled.span`
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
`;

const Select = styled.select`
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  outline: 0;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textPrimary};
  font-size: 10px;
`;

const Range = styled.input`
  width: 100%;
  accent-color: ${theme.colors.brand};
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 700;

  input {
    accent-color: ${theme.colors.brand};
  }
`;

const PreviewPanel = styled(Panel)`
  grid-column: 1 / -1;
`;

const PreviewBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 18px 20px 21px;
`;

const TextArea = styled.textarea`
  min-height: 78px;
  resize: vertical;
  padding: 12px 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  outline: 0;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textPrimary};
  font: 10px/1.65 ${theme.typography.family};

  &:focus {
    border-color: ${theme.colors.brand};
  }
`;

const PreviewActions = styled.div`
  display: grid;
  align-content: center;
  gap: 8px;
`;

const Notice = styled.div`
  grid-column: 1 / -1;
  padding: 9px 11px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.dangerSoft};
  color: ${theme.colors.danger};
  font-size: 9px;
  line-height: 1.55;

  &[data-success="true"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }
`;

const EnvironmentCard = styled.section`
  display: grid;
  gap: 11px;
  padding: 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
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
  font-weight: 800;
`;

const EnvironmentSummary = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.55;
`;

const EnvironmentBadge = styled.span`
  flex: 0 0 auto;
  padding: 4px 7px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.warningSoft};
  color: ${theme.colors.warning};
  font-size: 8px;
  font-weight: 800;

  &[data-ready="true"] {
    background: ${theme.colors.successSoft};
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
  border-top: 1px solid ${theme.colors.border};
`;

const CheckDot = styled.span`
  width: 7px;
  height: 7px;
  margin-top: 3px;
  border-radius: 50%;
  background: ${theme.colors.warning};

  &[data-state="ready"] {
    background: ${theme.colors.success};
  }

  &[data-state="missing"] {
    background: ${theme.colors.danger};
  }
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
    color: ${theme.colors.brand};
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
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.xs};
  background: ${theme.colors.surface};
  color: ${theme.colors.textSecondary};
  font: 7px/1.45 ${theme.typography.mono};
  text-align: left;
  text-overflow: ellipsis;

  &:hover {
    border-color: ${theme.colors.brand};
  }
`;

const EnvironmentActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

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
      <Intro>
        <div>
          <IntroKicker>TTS MODEL STUDIO</IntroKicker>
          <IntroTitle>把喜欢的声音，接进统一播报队列</IntroTitle>
          <IntroDescription>
            直接选择原始模型目录，bilimaku 会检查配置、权重与音色映射，并交给匹配的内置适配器。
            模型目录保持原样；当前已接入 Bert-VITS2 自动识别，后续架构只需扩展应用侧适配器。
          </IntroDescription>
          <IntroActions>
            <PrimaryButton type="button" onClick={() => void importModel()} disabled={busy}>
              <Icon name="sparkles" size={15} />
              {busy ? "识别中…" : "识别 TTS 模型目录"}
            </PrimaryButton>
            <SubtleButton type="button" onClick={() => void refreshModels()}>
              刷新登记
            </SubtleButton>
          </IntroActions>
        </div>
        <IntroOrb aria-hidden="true">
          <Orb>
            <Icon name="waveform" size={46} />
          </Orb>
        </IntroOrb>
      </Intro>

      <Grid>
        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>语音引擎</PanelTitle>
              <PanelDescription>系统语音与自定义模型使用相同播放队列</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>{models.length} CUSTOM MODELS</EyebrowBadge>
          </PanelHeader>
          <EngineBody>
            <EngineCard
              type="button"
              data-active={settings.provider === "system"}
              onClick={() => updateSettings({ provider: "system" })}
            >
              <EngineIcon><Icon name="volume" size={19} /></EngineIcon>
              <div>
                <EngineName>系统语音</EngineName>
                <EngineDescription>使用 Windows / WebView 提供的 SpeechSynthesis 音色</EngineDescription>
              </div>
              <RuntimeBadge>BUILT-IN</RuntimeBadge>
            </EngineCard>

            {models.map((model) => (
              <div key={model.id}>
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
                  <EngineIcon><Icon name="waveform" size={19} /></EngineIcon>
                  <div>
                    <EngineName>{model.name}</EngineName>
                    <EngineDescription>{model.description || model.modelDir}</EngineDescription>
                  </div>
                  <RuntimeBadge>{runtimeLabel(model)}</RuntimeBadge>
                </EngineCard>
                <ModelMeta>
                  <span>{model.version || "未标版本"}</span>
                  <span>{model.author || "本地模型"}</span>
                  <span>{model.voices.length} 个音色</span>
                  <RemoveButton type="button" onClick={() => void removeModel(model.id)}>
                    移除登记
                  </RemoveButton>
                </ModelMeta>
              </div>
            ))}

            {models.length === 0 ? (
              <EmptyModels>
                暂无自定义模型。选择模型原始目录即可，bilimaku 会自动探测架构并读取音色，
                无需往模型目录添加专用清单。
              </EmptyModels>
            ) : null}
          </EngineBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>合成参数</PanelTitle>
              <PanelDescription>参数立即保存，并应用于后续播报</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>{settings.provider === "custom" ? "CUSTOM" : "SYSTEM"}</EyebrowBadge>
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
                <Select
                  value={settings.voiceId}
                  disabled={!selectedModel || selectedModel.voices.length === 0}
                  onChange={(event) => updateSettings({ voiceId: event.target.value })}
                >
                  {selectedModel?.voices.length ? (
                    selectedModel.voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}{voice.language ? ` · ${voice.language}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">由模型运行时决定</option>
                  )}
                </Select>
              </Field>
            )}

            {settings.provider === "custom" && selectedModel ? (
              <EnvironmentCard>
                <EnvironmentHeader>
                  <div>
                    <EnvironmentTitle>TTS 运行环境</EnvironmentTitle>
                    <EnvironmentSummary>
                      {checkingEnvironment
                        ? "Rust 后端正在检查 Python、推理依赖、BERT 与计算设备…"
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
                  <div>
                    <EnvironmentBadge
                      data-ready={environment?.ready === true && selectedPreloadStatus?.phase !== "error"}
                    >
                      {checkingEnvironment
                        ? "CHECKING"
                        : preparingModel
                          ? "WARMING"
                          : selectedPreloadStatus?.phase === "error"
                            ? "FAILED"
                            : preparation?.ready
                              ? "GPU READY"
                              : environment?.ready
                                ? "READY"
                                : "SETUP"}
                    </EnvironmentBadge>
                  </div>
                </EnvironmentHeader>

                {environment ? (
                  <EnvironmentChecks>
                    {environment.checks.map((check) => (
                      <EnvironmentCheckRow key={check.id}>
                        <CheckDot data-state={check.state} />
                        <div>
                          <CheckName>
                            {check.label} · {checkStateLabel(check.state)}
                          </CheckName>
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
                  <SubtleButton
                    type="button"
                    disabled={busy}
                    onClick={() => void registerChineseBert()}
                  >
                    选择已有 Chinese BERT
                  </SubtleButton>
                  <SubtleButton
                    type="button"
                    disabled={checkingEnvironment}
                    onClick={() => void refreshEnvironment(selectedModel.id)}
                  >
                    {checkingEnvironment ? "检查中…" : "重新检查环境"}
                  </SubtleButton>
                </EnvironmentActions>
              </EnvironmentCard>
            ) : null}

            <Field>
              <FieldTop>语速 <FieldValue>{settings.rate.toFixed(2)}×</FieldValue></FieldTop>
              <Range
                type="range" min="0.5" max="2" step="0.05" value={settings.rate}
                onChange={(event) => updateSettings({ rate: Number(event.target.value) })}
              />
            </Field>
            <Field>
              <FieldTop>音量 <FieldValue>{Math.round(settings.volume * 100)}%</FieldValue></FieldTop>
              <Range
                type="range" min="0" max="1" step="0.05" value={settings.volume}
                onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
              />
            </Field>
            {settings.provider === "system" ? (
              <Field>
                <FieldTop>音调 <FieldValue>{settings.pitch.toFixed(2)}</FieldValue></FieldTop>
                <Range
                  type="range" min="0.5" max="2" step="0.05" value={settings.pitch}
                  onChange={(event) => updateSettings({ pitch: Number(event.target.value) })}
                />
              </Field>
            ) : null}
            <ToggleRow>
              直播事件自动进入语音队列
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(event) => updateSettings({ autoSpeak: event.target.checked })}
              />
            </ToggleRow>
          </SettingsBody>
        </Panel>

        <PreviewPanel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>实时试听</PanelTitle>
              <PanelDescription>自定义模型由 Rust 调用 bilimaku 内置的架构适配器</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>PREVIEW</EyebrowBadge>
          </PanelHeader>
          <PreviewBody>
            <TextArea value={testText} onChange={(event) => setTestText(event.target.value)} />
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
                {preparingModel ? "模型预热中…" : "试听"}
              </PrimaryButton>
              <SubtleButton type="button" onClick={cancelSpeech}>停止</SubtleButton>
            </PreviewActions>
            {notice ? <Notice data-success={success}>{notice}</Notice> : null}
          </PreviewBody>
        </PreviewPanel>
      </Grid>
    </Page>
  );
}
