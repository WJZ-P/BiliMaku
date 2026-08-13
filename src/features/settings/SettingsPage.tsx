import { styled } from "@linaria/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CardDanmakuParticles } from "../../components/CardDanmakuParticles";
import { Icon } from "../../components/Icon";
import {
  AnimatedSwitchTrack,
  FrostedPanel as SettingsPanel,
  FrostedPanelSurface as SettingsPanelSurface,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
} from "../../components/ui";
import {
  disconnectLiveRoom,
  getConfigFilePath,
  getLiveAppearanceSettings,
  getLiveConnectionStatus,
  logoutBilibiliAccount,
  saveLiveAppearanceSettings,
  saveLiveAutoConnect,
} from "../../services/desktop";
import {
  getOverlayAutoOpenState,
  saveOverlayAutoOpenState,
} from "../../services/overlays";
import {
  hydrateTtsSettings,
  loadTtsSettings,
  saveTtsSettingsPersisted,
} from "../../services/tts";
import { cancelSpeech } from "../../services/ttsPlayback";
import { DEFAULT_MESSAGE_BUBBLE_COLOR, theme } from "../../styles/theme";
import type { BilibiliLoginStatus } from "../../types/account";
import {
  DEFAULT_STARTUP_BEHAVIOR_SETTINGS,
  type StartupBehaviorSettings,
} from "../../types/applicationSettings";
import type { LiveAppearanceSettings } from "../../types/liveAppearance";
import {
  MAX_STORED_LIVE_MESSAGES,
  MIN_STORED_LIVE_MESSAGES,
} from "../../types/liveMessages";
import { useLiveRoom } from "../dashboard/LiveRoomContext";

interface SettingsPageProps {
  accountStatus: BilibiliLoginStatus;
  onAccountStatusChange: (status: BilibiliLoginStatus) => void;
}

const Page = styled.div`
  display: grid;
  gap: 12px;
  padding: 12px 20px 24px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
`;

const AccountBody = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(330px, 1.2fr) auto;
  align-items: center;
  gap: 20px;
  padding: 18px 20px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr) auto;

    & > div:nth-child(2) {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 620px) {
    grid-template-columns: minmax(0, 1fr);

    & > button {
      justify-self: start;
    }
  }
`;

const AccountIdentity = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
`;

const Avatar = styled.img`
  width: 64px;
  height: 64px;
  border: 2px solid color-mix(in srgb, ${theme.colors.brand} 36%, ${theme.colors.surface});
  border-radius: 50%;
  background: ${theme.colors.surfaceMuted};
  object-fit: cover;
`;

const AvatarFallback = styled.div`
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border: 2px solid color-mix(in srgb, ${theme.colors.brand} 36%, ${theme.colors.surface});
  border-radius: 50%;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 22px;
  font-weight: 900;
`;

const AccountName = styled.div`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 16px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AccountUid = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 10px;
`;


const AccountStats = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(86px, 1fr));
  align-items: stretch;
  border-left: 1px solid ${theme.colors.border};

  @media (max-width: 900px) {
    padding-top: 14px;
    border-top: 1px solid ${theme.colors.border};
    border-left: 0;
  }
`;

const AccountStat = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 2px 14px;

  & + & {
    border-left: 1px solid ${theme.colors.border};
  }

  svg {
    color: ${theme.colors.brand};
  }
`;

const AccountStatCopy = styled.div`
  display: grid;
  min-width: 0;
  gap: 2px;
`;

const AccountStatValue = styled.strong`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 18px;
  font-weight: 860;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-overflow: ellipsis;
`;

const AccountStatLabel = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-weight: 680;
  white-space: nowrap;
`;

const LogoutButton = styled.button`
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 7px;
  justify-self: end;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.danger} 28%, ${theme.colors.border});
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.dangerSoft} 58%, transparent);
  color: ${theme.colors.danger};
  font-size: 10px;
  font-weight: 800;
  transition:
    transform ${theme.motion.fast},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.danger} 52%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.dangerSoft} 82%, transparent);
    transform: translateX(2px);
  }

  &:active {
    transform: translateX(1px) scale(0.97);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
    transform: none;
  }
`;

const AutomationBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 18px 20px 20px;
`;

const PreferenceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const PreferenceSwitch = styled.label`
  position: relative;
  display: grid;
  min-height: 66px;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 66%, transparent);
  border-radius: 4px;
  background:
    linear-gradient(
      128deg,
      color-mix(in srgb, ${theme.colors.highlight} 16%, transparent),
      transparent 48%
    ),
    color-mix(in srgb, ${theme.colors.surface} 38%, transparent);
  cursor: pointer;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    transform ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 46%, ${theme.colors.borderStrong});
    background:
      linear-gradient(
        128deg,
        color-mix(in srgb, ${theme.colors.brandSoft} 22%, transparent),
        transparent 52%
      ),
      color-mix(in srgb, ${theme.colors.surface} 44%, transparent);
    transform: translateY(-1px);
  }

  &:focus-within {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    outline-offset: 1px;
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
    box-shadow: 0 4px 13px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
  }

  input:checked + span::before {
    opacity: 1;
  }

  input:checked + span::after {
    transform: translateX(18px) rotate(90deg);
  }

`;

const PreferenceIcon = styled.span`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-left: 2px solid color-mix(in srgb, ${theme.colors.brand} 62%, transparent);
  background: color-mix(in srgb, ${theme.colors.brandSoft} 34%, transparent);
  color: ${theme.colors.brandDeep};
`;

const PreferenceCopy = styled.span`
  display: grid;
  min-width: 0;
  gap: 4px;
`;

const PreferenceTitle = styled.strong`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 820;
  letter-spacing: 0.01em;
`;

const PreferenceDescription = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 620;
  line-height: 1.5;
`;

const PreferenceTrack = styled(AnimatedSwitchTrack)`
  --switch-width: 39px;
  --switch-height: 21px;
  --switch-thumb-size: 15px;
  --switch-thumb-offset: 2px;
  --switch-radius: 4px;
`;
const ThemeBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 20px;
`;

const ThemeOption = styled.div`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 27%, ${theme.colors.border});
  border-radius: 5px;
  background: linear-gradient(
    122deg,
    color-mix(in srgb, ${theme.colors.surface} 27%, transparent),
    color-mix(in srgb, ${theme.colors.brandSubtle} 20%, transparent)
  );
  -webkit-backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 62%, transparent);
`;

const BubbleColorOption = styled.div`
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 26%, transparent);
  -webkit-backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 58%, transparent);
`;

const BubblePreview = styled.div`
  display: grid;
  min-height: 36px;
  place-items: center;
  padding: 6px 8px;
  border: 1px solid color-mix(
    in srgb,
    var(--preview-bubble-color, ${theme.colors.messageBubble}) 42%,
    ${theme.colors.border}
  );
  border-radius: 3px 10px 10px 10px;
  background: color-mix(
    in srgb,
    var(--preview-bubble-color, ${theme.colors.messageBubble}) 14%,
    ${theme.colors.surface}
  );
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;
  box-shadow: 0 4px 12px color-mix(
    in srgb,
    var(--preview-bubble-color, ${theme.colors.messageBubble}) 12%,
    transparent
  );
`;

const BubbleColorInput = styled.input`
  width: 38px;
  height: 38px;
  padding: 3px;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 76%, transparent);

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: 0;
    border-radius: 6px;
  }
`;

const MessageLimitOption = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 26%, transparent);
  -webkit-backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  backdrop-filter: blur(6px) saturate(1.34) brightness(1.025);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 58%, transparent);
`;

const MessageLimitField = styled.label`
  display: grid;
  width: 112px;
  height: 38px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  overflow: hidden;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 76%, transparent);
  transition:
    border-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  &:focus-within {
    border-color: ${theme.colors.brand};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 13%, transparent);
  }
`;

const MessageLimitInput = styled.input`
  width: 100%;
  min-width: 0;
  padding: 0 7px 0 10px;
  border: 0;
  outline: 0;
  appearance: textfield;
  background: transparent;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.mono};
  font-size: 14px;
  font-weight: 800;
  text-align: right;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    margin: 0;
    -webkit-appearance: none;
  }
`;

const MessageLimitUnit = styled.span`
  display: grid;
  height: 100%;
  place-items: center;
  padding: 0 9px;
  border-left: 1px solid ${theme.colors.border};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-size: 11px;
  font-weight: 750;
`;

const Swatches = styled.div`
  display: grid;
  width: 48px;
  height: 40px;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 4px;

  span:nth-child(1) { background: ${theme.colors.brand}; }
  span:nth-child(2) { background: ${theme.colors.cyan}; }
  span:nth-child(3) { background: ${theme.colors.brandSoft}; }
  span:nth-child(4) { background: ${theme.colors.surface}; }
`;

const OptionTitle = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
`;

const OptionDescription = styled.div`
  margin-top: 3px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
`;

const Detail = styled.div`
  padding: 11px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 24%, transparent);
  -webkit-backdrop-filter: blur(6px) saturate(1.32) brightness(1.025);
  backdrop-filter: blur(6px) saturate(1.32) brightness(1.025);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 52%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.65;
  word-break: break-all;
`;

const ErrorMessage = styled.div`
  padding: 10px 12px;
  border-radius: 4px;
  background: ${theme.colors.dangerSoft};
  color: ${theme.colors.danger};
  font-size: 9px;
`;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsPage({ accountStatus, onAccountStatusChange }: SettingsPageProps) {
  const live = useLiveRoom();
  const [configPath, setConfigPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [appearanceError, setAppearanceError] = useState("");
  const [messageSettingsError, setMessageSettingsError] = useState("");
  const [messageLimitDraft, setMessageLimitDraft] = useState(() =>
    String(live.messageSettings.maxStoredMessages),
  );
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [liveAppearance, setLiveAppearance] = useState<LiveAppearanceSettings>({
    messageBubbleColor: DEFAULT_MESSAGE_BUBBLE_COLOR,
  });
  const [startupSettings, setStartupSettings] = useState<StartupBehaviorSettings>(
    DEFAULT_STARTUP_BEHAVIOR_SETTINGS,
  );
  const [startupReady, setStartupReady] = useState(false);
  const [startupBusyKeys, setStartupBusyKeys] = useState<
    ReadonlySet<keyof StartupBehaviorSettings>
  >(() => new Set());
  const [startupError, setStartupError] = useState("");
  const [savedRoomId, setSavedRoomId] = useState("");
  const latestAppearanceRef = useRef(liveAppearance);
  const ttsSettingsRef = useRef(loadTtsSettings());
  const appearanceReadyRef = useRef(false);
  const profile = accountStatus.profile;
  const recordedActivity = useMemo(() => {
    const totals = { entrances: 0, messages: 0, gifts: 0 };
    for (const event of live.events) {
      if (event.type === "interaction" && event.interactionKind === "enter") {
        totals.entrances += 1;
      } else if (event.type === "message") {
        totals.messages += 1;
      } else if (event.type === "gift") {
        const quantity = Number(event.content.match(/×\s*(\d+)/u)?.[1] ?? "1");
        totals.gifts += Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1;
      }
    }
    return totals;
  }, [live.events]);

  useEffect(() => {
    let active = true;
    void getConfigFilePath().then((path) => {
      if (active) setConfigPath(path);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getLiveConnectionStatus(),
      getOverlayAutoOpenState(),
      hydrateTtsSettings(),
    ]).then(([connection, overlay, tts]) => {
      if (!active) return;
      ttsSettingsRef.current = tts;
      setSavedRoomId(connection.savedRoomId);
      setStartupSettings({
        autoConnect: connection.autoConnect,
        autoOpenDanmaku: overlay.danmaku,
        autoOpenSidebar: overlay.sidebar,
        autoSpeak: tts.autoSpeak,
      });
      setStartupReady(true);
      setStartupError("");
    }).catch((reason) => {
      if (active) setStartupError(`读取启动偏好失败：${errorText(reason)}`);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMessageLimitDraft(String(live.messageSettings.maxStoredMessages));
  }, [live.messageSettings.maxStoredMessages]);

  useEffect(() => {
    let active = true;
    void getLiveAppearanceSettings().then((settings) => {
      if (!active) return;
      latestAppearanceRef.current = settings;
      appearanceReadyRef.current = true;
      setLiveAppearance(settings);
      setAppearanceReady(true);
    }).catch((reason) => {
      if (active) setAppearanceError(errorText(reason));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!appearanceReady) return;
    const timer = window.setTimeout(() => {
      void saveLiveAppearanceSettings(liveAppearance).then(() => {
        setAppearanceError("");
      }).catch((reason) => {
        setAppearanceError(errorText(reason));
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [appearanceReady, liveAppearance]);

  useEffect(
    () => () => {
      if (!appearanceReadyRef.current) return;
      void saveLiveAppearanceSettings(latestAppearanceRef.current).catch((reason) => {
        console.error("bilimaku live appearance final save failed", reason);
      });
    },
    [],
  );

  const updateMessageBubbleColor = (messageBubbleColor: string) => {
    const next = { messageBubbleColor };
    latestAppearanceRef.current = next;
    setLiveAppearance(next);
  };

  const bubblePreviewStyle = {
    "--preview-bubble-color": liveAppearance.messageBubbleColor,
  } as CSSProperties;

  const commitMessageLimit = async () => {
    const nextLimit = Number(messageLimitDraft);
    if (
      !Number.isInteger(nextLimit)
      || nextLimit < MIN_STORED_LIVE_MESSAGES
      || nextLimit > MAX_STORED_LIVE_MESSAGES
    ) {
      setMessageSettingsError(
        `请输入 ${MIN_STORED_LIVE_MESSAGES} 到 ${MAX_STORED_LIVE_MESSAGES.toLocaleString("zh-CN")} 之间的整数`,
      );
      setMessageLimitDraft(String(live.messageSettings.maxStoredMessages));
      return;
    }
    if (nextLimit === live.messageSettings.maxStoredMessages) {
      setMessageSettingsError("");
      return;
    }
    try {
      await live.updateMessageSettings({ maxStoredMessages: nextLimit });
      setMessageSettingsError("");
    } catch (reason) {
      setMessageSettingsError(errorText(reason));
    }
  };

  const updateStartupSetting = async (
    key: keyof StartupBehaviorSettings,
    enabled: boolean,
  ) => {
    if (!startupReady || startupBusyKeys.has(key)) return;
    const previousValue = startupSettings[key];
    setStartupBusyKeys((current) => new Set(current).add(key));
    setStartupError("");
    setStartupSettings((current) => ({ ...current, [key]: enabled }));

    try {
      if (key === "autoConnect") {
        await saveLiveAutoConnect(enabled);
      } else if (key === "autoOpenDanmaku") {
        await saveOverlayAutoOpenState("danmaku", enabled);
      } else if (key === "autoOpenSidebar") {
        await saveOverlayAutoOpenState("sidebar", enabled);
      } else {
        const nextTtsSettings = await saveTtsSettingsPersisted({
          ...ttsSettingsRef.current,
          autoSpeak: enabled,
        });
        ttsSettingsRef.current = nextTtsSettings;
        if (!enabled) cancelSpeech();
      }
    } catch (reason) {
      setStartupSettings((current) => ({ ...current, [key]: previousValue }));
      setStartupError(`保存启动偏好失败：${errorText(reason)}`);
    } finally {
      setStartupBusyKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };
  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await disconnectLiveRoom().catch(() => undefined);
      onAccountStatusChange(await logoutBilibiliAccount());
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Grid>
        <SettingsPanel>
          <SettingsPanelSurface>
            <CardDanmakuParticles seed={0x41434354} />
            <PanelHeader>
            <PanelHeading>
              <PanelTitle>账号与记录</PanelTitle>
              <PanelDescription>
                BiliMaku 当前会话已记录 {recordedActivity.entrances.toLocaleString("zh-CN")} 个入场、{recordedActivity.messages.toLocaleString("zh-CN")} 条弹幕和 {recordedActivity.gifts.toLocaleString("zh-CN")} 个礼物
              </PanelDescription>
            </PanelHeading>
          </PanelHeader>
          <AccountBody>
            <AccountIdentity>
              {profile?.avatar ? (
                <Avatar src={profile.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <AvatarFallback>{profile?.username.slice(0, 1) || "播"}</AvatarFallback>
              )}
              <div>
                <AccountName>{profile?.username || "已登录账号"}</AccountName>
                <AccountUid>UID {profile?.uid || "--"}</AccountUid>
              </div>
            </AccountIdentity>
            <AccountStats aria-label="BiliMaku 当前会话记录">
              <AccountStat data-tooltip="当前消息缓存中的进场事件数">
                <Icon name="users" size={18} />
                <AccountStatCopy>
                  <AccountStatValue>{recordedActivity.entrances.toLocaleString("zh-CN")}</AccountStatValue>
                  <AccountStatLabel>入场消息</AccountStatLabel>
                </AccountStatCopy>
              </AccountStat>
              <AccountStat data-tooltip="当前消息缓存中的普通弹幕数">
                <Icon name="message" size={18} />
                <AccountStatCopy>
                  <AccountStatValue>{recordedActivity.messages.toLocaleString("zh-CN")}</AccountStatValue>
                  <AccountStatLabel>弹幕记录</AccountStatLabel>
                </AccountStatCopy>
              </AccountStat>
              <AccountStat data-tooltip="当前消息缓存中的礼物总数">
                <Icon name="gift" size={18} />
                <AccountStatCopy>
                  <AccountStatValue>{recordedActivity.gifts.toLocaleString("zh-CN")}</AccountStatValue>
                  <AccountStatLabel>收到礼物</AccountStatLabel>
                </AccountStatCopy>
              </AccountStat>
            </AccountStats>
            <LogoutButton type="button" disabled={busy} onClick={() => void logout()}>
              <Icon name="arrow" size={14} />
              {busy ? "正在退出…" : "退出登录"}
            </LogoutButton>
          </AccountBody>
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          </SettingsPanelSurface>
        </SettingsPanel>

        <SettingsPanel>
          <SettingsPanelSurface>
            <CardDanmakuParticles seed={0x4155544f} />
            <PanelHeader>
              <PanelHeading>
                <PanelTitle>启动与自动化</PanelTitle>
                <PanelDescription>统一管理冷启动恢复与自动播报行为</PanelDescription>
              </PanelHeading>
            </PanelHeader>
            <AutomationBody>
              <PreferenceGrid>
                <PreferenceSwitch>
                  <PreferenceIcon><Icon name="plug" size={18} /></PreferenceIcon>
                  <PreferenceCopy>
                    <PreferenceTitle>恢复直播间连接</PreferenceTitle>
                    <PreferenceDescription>
                      {savedRoomId
                        ? `下次启动自动连接房间 ${savedRoomId}`
                        : "先在直播间页面保存一个有效房间号"}
                    </PreferenceDescription>
                  </PreferenceCopy>
                  <input
                    type="checkbox"
                    aria-label="冷启动恢复直播间连接"
                    checked={startupSettings.autoConnect}
                    disabled={!startupReady || startupBusyKeys.has("autoConnect") || !savedRoomId}
                    onChange={(event) => {
                      void updateStartupSetting("autoConnect", event.target.checked);
                    }}
                  />
                  <PreferenceTrack aria-hidden="true" />
                </PreferenceSwitch>

                <PreferenceSwitch>
                  <PreferenceIcon><Icon name="message" size={18} /></PreferenceIcon>
                  <PreferenceCopy>
                    <PreferenceTitle>恢复全屏弹幕</PreferenceTitle>
                    <PreferenceDescription>下次启动恢复滚动弹幕层，不改变当前窗口</PreferenceDescription>
                  </PreferenceCopy>
                  <input
                    type="checkbox"
                    aria-label="冷启动恢复全屏弹幕"
                    checked={startupSettings.autoOpenDanmaku}
                    disabled={!startupReady || startupBusyKeys.has("autoOpenDanmaku")}
                    onChange={(event) => {
                      void updateStartupSetting("autoOpenDanmaku", event.target.checked);
                    }}
                  />
                  <PreferenceTrack aria-hidden="true" />
                </PreferenceSwitch>

                <PreferenceSwitch>
                  <PreferenceIcon><Icon name="dashboard" size={18} /></PreferenceIcon>
                  <PreferenceCopy>
                    <PreferenceTitle>恢复侧边播报</PreferenceTitle>
                    <PreferenceDescription>下次启动恢复侧边事件栏，不改变当前窗口</PreferenceDescription>
                  </PreferenceCopy>
                  <input
                    type="checkbox"
                    aria-label="冷启动恢复侧边事件栏"
                    checked={startupSettings.autoOpenSidebar}
                    disabled={!startupReady || startupBusyKeys.has("autoOpenSidebar")}
                    onChange={(event) => {
                      void updateStartupSetting("autoOpenSidebar", event.target.checked);
                    }}
                  />
                  <PreferenceTrack aria-hidden="true" />
                </PreferenceSwitch>

                <PreferenceSwitch>
                  <PreferenceIcon><Icon name="volume" size={18} /></PreferenceIcon>
                  <PreferenceCopy>
                    <PreferenceTitle>自动语音播报</PreferenceTitle>
                    <PreferenceDescription>沿用语音角色页的音色与事件筛选；关闭会清空当前队列</PreferenceDescription>
                  </PreferenceCopy>
                  <input
                    type="checkbox"
                    aria-label="自动语音播报"
                    checked={startupSettings.autoSpeak}
                    disabled={!startupReady || startupBusyKeys.has("autoSpeak")}
                    onChange={(event) => {
                      void updateStartupSetting("autoSpeak", event.target.checked);
                    }}
                  />
                  <PreferenceTrack aria-hidden="true" />
                </PreferenceSwitch>
              </PreferenceGrid>
              {startupError ? <ErrorMessage>{startupError}</ErrorMessage> : null}
            </AutomationBody>
          </SettingsPanelSurface>
        </SettingsPanel>
        <SettingsPanel>
          <SettingsPanelSurface>
            <CardDanmakuParticles seed={0x53455454} />
            <PanelHeader>
            <PanelHeading>
              <PanelTitle>界面与消息</PanelTitle>
              <PanelDescription>主题外观与聊天缓存</PanelDescription>
            </PanelHeading>
          </PanelHeader>
          <ThemeBody>
            <ThemeOption>
              <Swatches><span /><span /><span /><span /></Swatches>
              <div>
                <OptionTitle>浅蓝晴空</OptionTitle>
                <OptionDescription>当前默认 · 白色表面 · 浅蓝强调色</OptionDescription>
              </div>
              <Icon name="check" size={17} />
            </ThemeOption>
            <BubbleColorOption>
              <BubblePreview style={bubblePreviewStyle}>进入了直播间</BubblePreview>
              <div>
                <OptionTitle>聊天气泡颜色</OptionTitle>
                <OptionDescription>
                  {liveAppearance.messageBubbleColor.toUpperCase()} · 直播间消息和互动事件
                </OptionDescription>
              </div>
              <BubbleColorInput
                type="color"
                aria-label="自定义聊天气泡颜色"
                value={liveAppearance.messageBubbleColor}
                disabled={!appearanceReady}
                onChange={(event) => updateMessageBubbleColor(event.target.value)}
              />
            </BubbleColorOption>
            <MessageLimitOption>
              <div>
                <OptionTitle>最大存储消息条数</OptionTitle>
                <OptionDescription>
                  保留当前会话最新的 {live.messageSettings.maxStoredMessages.toLocaleString("zh-CN")} 条；消息分类也会自动记住
                </OptionDescription>
              </div>
              <MessageLimitField>
                <MessageLimitInput
                  type="number"
                  inputMode="numeric"
                  min={MIN_STORED_LIVE_MESSAGES}
                  max={MAX_STORED_LIVE_MESSAGES}
                  step={1}
                  aria-label="最大存储消息条数"
                  aria-invalid={Boolean(messageSettingsError)}
                  value={messageLimitDraft}
                  onChange={(event) => setMessageLimitDraft(event.target.value)}
                  onBlur={() => void commitMessageLimit()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setMessageLimitDraft(String(live.messageSettings.maxStoredMessages));
                      setMessageSettingsError("");
                    }
                  }}
                  onWheel={(event) => event.currentTarget.blur()}
                />
                <MessageLimitUnit>条</MessageLimitUnit>
              </MessageLimitField>
            </MessageLimitOption>
            {appearanceError ? <ErrorMessage>{appearanceError}</ErrorMessage> : null}
            {messageSettingsError ? <ErrorMessage>{messageSettingsError}</ErrorMessage> : null}
            <Detail>配置文件：{configPath || "正在读取…"}</Detail>
            </ThemeBody>
          </SettingsPanelSurface>
        </SettingsPanel>
      </Grid>
    </Page>
  );
}
