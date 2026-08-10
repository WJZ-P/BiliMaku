import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  connectLiveRoom,
  disconnectLiveRoom,
  getLiveConnectionStatus,
  getLiveMessageSettings,
  getLiveOnlineRank,
  isDesktopRuntime,
  listenToLiveEvents,
  listenToLiveStatus,
  listenToPopularity,
  saveLiveMessageSettings,
} from "../../services/desktop";
import {
  loadTtsSettings,
  saveTtsSettings,
  TTS_SETTINGS_EVENT,
} from "../../services/tts";
import {
  cancelSpeech,
  enqueueSpeech,
} from "../../services/ttsPlayback";
import type {
  LiveEvent,
  LiveStatusPayload,
  RoomConnectionInfo,
} from "../../types/events";
import {
  DEFAULT_LIVE_MESSAGE_SETTINGS,
  type LiveMessageSettings,
} from "../../types/liveMessages";
import type { LiveOnlineRankSnapshot } from "../../types/liveRank";
import type { TtsSettings, TtsSpeechEventType } from "../../types/tts";

const initialStatus: LiveStatusPayload = {
  sessionId: 0,
  roomId: 0,
  state: "disconnected",
  message: "输入直播间 ID 后即可建立本机长链",
  attempt: 0,
};

/** 把实时事件转换为自动播报文本。 */
function makeSpeechText(event: LiveEvent) {
  if (event.type === "message") return `${event.user}说，${event.content}`;
  if (event.type === "superchat") return `${event.user}的醒目留言，${event.content}`;
  return `${event.user}${event.content}`;
}

/** 把统一直播事件映射为更细粒度的 TTS 筛选键。 */
function getTtsSpeechEventType(event: LiveEvent): TtsSpeechEventType | null {
  if (event.type === "system") return null;
  if (event.type === "interaction") {
    return event.interactionKind ? `interaction-${event.interactionKind}` : null;
  }
  return event.type;
}

export function useLiveRoomController() {
  const [status, setStatus] = useState<LiveStatusPayload>(initialStatus);
  const [room, setRoom] = useState<RoomConnectionInfo | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [popularity, setPopularity] = useState(0);
  const [onlineRank, setOnlineRank] = useState<LiveOnlineRankSnapshot | null>(null);
  const [onlineRankError, setOnlineRankError] = useState("");
  const [messageSettings, setMessageSettings] = useState<LiveMessageSettings>(() => ({
    ...DEFAULT_LIVE_MESSAGE_SETTINGS,
  }));
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => loadTtsSettings());
  const messageSettingsRef = useRef(messageSettings);
  const messageSettingsSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastSpokenId = useRef<string | null>(null);
  const startupAutoConnectStarted = useRef(false);
  const desktopRuntime = useMemo(() => isDesktopRuntime(), []);

  const applyMessageSettings = useCallback((next: LiveMessageSettings) => {
    messageSettingsRef.current = next;
    setMessageSettings(next);
    setEvents((current) => (
      current.length > next.maxStoredMessages
        ? current.slice(0, next.maxStoredMessages)
        : current
    ));
  }, []);

  /** 更新共享消息偏好，先即时反映到 UI，再按顺序写入 Rust Store。 */
  const updateMessageSettings = useCallback(
    (patch: Partial<LiveMessageSettings>) => {
      const next = { ...messageSettingsRef.current, ...patch };
      applyMessageSettings(next);
      const save = messageSettingsSaveChainRef.current.then(() =>
        saveLiveMessageSettings(next),
      );
      messageSettingsSaveChainRef.current = save.catch(() => undefined);
      return save;
    },
    [applyMessageSettings],
  );

  const connect = useCallback(
    async (roomId: string) => {
      const numericRoomId = Number(roomId);
      setStatus({
        sessionId: 0,
        roomId: Number.isFinite(numericRoomId) ? numericRoomId : 0,
        state: "connecting",
        message: desktopRuntime
          ? "正在解析直播间与 WBI 长链参数"
          : "请从 Tauri 桌面窗口启动真实连接",
        attempt: 0,
      });
      setEvents([]);
      setPopularity(0);
      setOnlineRank(null);
      setOnlineRankError("");

      try {
        const info = await connectLiveRoom(roomId);
        setRoom(info);
        return info;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({
          sessionId: 0,
          roomId: Number.isFinite(numericRoomId) ? numericRoomId : 0,
          state: "error",
          message,
          attempt: 0,
        });
        throw error;
      }
    },
    [desktopRuntime],
  );

  useEffect(() => {
    let active = true;
    void getLiveMessageSettings().then((settings) => {
      if (active) applyMessageSettings(settings);
    }).catch((error) => {
      console.error("bilimaku live message settings loading failed", error);
    });
    return () => {
      active = false;
    };
  }, [applyMessageSettings]);

  useEffect(() => {
    let active = true;
    const unlisteners: UnlistenFn[] = [];

    Promise.all([
      listenToLiveEvents((event) => {
        if (!active) return;
        setEvents((current) => {
          if (current.some((item) => item.id === event.id)) return current;
          return [event, ...current].slice(
            0,
            messageSettingsRef.current.maxStoredMessages,
          );
        });
      }),
      listenToLiveStatus((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
      }),
      listenToPopularity((update) => {
        if (!active) return;
        setPopularity(update.popularity);
      }),
    ]).then(async (subscriptions) => {
      if (active) {
        unlisteners.push(...subscriptions);
      } else {
        subscriptions.forEach((unsubscribe) => unsubscribe());
        return;
      }

      const snapshot = await getLiveConnectionStatus();
      if (active && snapshot.connected && snapshot.sessionId && snapshot.roomId) {
        setRoom(snapshot.room);
        setStatus((current) =>
          current.sessionId === 0
            ? {
                sessionId: snapshot.sessionId!,
                roomId: snapshot.roomId!,
                state: "connected",
                message: "直播间已连接",
                attempt: 0,
              }
            : current,
        );
      } else if (active && snapshot.savedRoomId) {
        const savedRoomId = Number(snapshot.savedRoomId);
        if (Number.isSafeInteger(savedRoomId) && savedRoomId > 0) {
          setStatus((current) =>
            current.roomId === 0
              ? {
                  ...current,
                  roomId: savedRoomId,
                  message: "已从统一配置恢复上次使用的直播间",
                }
              : current,
          );
          if (snapshot.autoConnect && !startupAutoConnectStarted.current) {
            startupAutoConnectStarted.current = true;
            try {
              await connect(snapshot.savedRoomId);
            } catch {
              // connect 已将具体失败原因写入共享状态；保留自动连接开关供下次冷启动重试。
            }
          }
        }
      }
    });

    return () => {
      active = false;
      unlisteners.forEach((unsubscribe) => unsubscribe());
    };
  }, [connect]);

  useEffect(() => {
    if (!desktopRuntime || status.state !== "connected" || status.sessionId === 0) {
      setOnlineRank(null);
      setOnlineRankError("");
      return;
    }

    let active = true;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const snapshot = await getLiveOnlineRank();
        if (!active || snapshot.roomId !== status.roomId) return;
        setOnlineRank(snapshot);
        setOnlineRankError("");
      } catch (error) {
        if (!active) return;
        setOnlineRankError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) timer = window.setTimeout(refresh, 30_000);
      }
    };
    void refresh();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [desktopRuntime, status.roomId, status.sessionId, status.state]);

  useEffect(() => {
    const syncTtsSettings = (event: Event) => {
      const next = (event as CustomEvent<TtsSettings>).detail;
      setTtsSettings(next);
      if (!next.autoSpeak) cancelSpeech();
    };
    window.addEventListener(TTS_SETTINGS_EVENT, syncTtsSettings);
    return () => window.removeEventListener(TTS_SETTINGS_EVENT, syncTtsSettings);
  }, []);

  /**
   * 自动播报属于直播会话，不应跟随某个页面的挂载与卸载。
   * 因此切到设置、音色或悬浮窗页时，新弹幕仍会继续进入同一队列。
   */
  useEffect(() => {
    const latest = events[0];
    if (
      status.state !== "connected"
      || !latest
      || lastSpokenId.current === latest.id
    ) {
      return;
    }

    // 无论当前类型是否启用，都先标记为已观测，避免修改设置时突然补播旧消息。
    lastSpokenId.current = latest.id;
    const speechEventType = getTtsSpeechEventType(latest);
    if (
      !ttsSettings.autoSpeak
      || !speechEventType
      || !ttsSettings.enabledEventTypes.includes(speechEventType)
    ) {
      return;
    }

    void enqueueSpeech(makeSpeechText(latest), ttsSettings).catch((error) => {
      console.error("bilimaku TTS playback failed", error);
    });
  }, [events, status.state, ttsSettings]);

  useEffect(() => {
    if (status.state === "disconnected") {
      cancelSpeech();
      lastSpokenId.current = null;
    }
  }, [status.state]);

  useEffect(
    () => () => {
      cancelSpeech();
    },
    [],
  );

  const disconnect = useCallback(async () => {
    await disconnectLiveRoom();
    setStatus((current) => ({
      ...current,
      state: "disconnected",
      message: "已断开直播间",
      attempt: 0,
    }));
    setRoom(null);
    setPopularity(0);
    setOnlineRank(null);
    setOnlineRankError("");
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    const next = { ...ttsSettings, autoSpeak: !ttsSettings.autoSpeak };
    setTtsSettings(next);
    saveTtsSettings(next);
    if (!next.autoSpeak) cancelSpeech();
  }, [ttsSettings]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return {
    desktopRuntime,
    status,
    room,
    events,
    popularity,
    onlineRank,
    onlineRankError,
    messageSettings,
    updateMessageSettings,
    autoSpeak: ttsSettings.autoSpeak,
    toggleAutoSpeak,
    connect,
    disconnect,
    clearEvents,
  };
}

export type LiveRoomController = ReturnType<typeof useLiveRoomController>;
