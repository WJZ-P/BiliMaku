import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  connectLiveRoom,
  disconnectLiveRoom,
  getLiveConnectionStatus,
  getLiveOnlineRank,
  isDesktopRuntime,
  listenToLiveEvents,
  listenToLiveStatus,
  listenToPopularity,
} from "../../services/desktop";
import {
  cancelSpeech,
  enqueueSpeech,
  pauseSpeech,
  resumeSpeech,
} from "../../services/ttsPlayback";
import type {
  LiveEvent,
  LiveStatusPayload,
  RoomConnectionInfo,
} from "../../types/events";
import type { LiveOnlineRankSnapshot } from "../../types/liveRank";

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

export function useLiveRoomController() {
  const [status, setStatus] = useState<LiveStatusPayload>(initialStatus);
  const [room, setRoom] = useState<RoomConnectionInfo | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [popularity, setPopularity] = useState(0);
  const [onlineRank, setOnlineRank] = useState<LiveOnlineRankSnapshot | null>(null);
  const [onlineRankError, setOnlineRankError] = useState("");
  const [queuePaused, setQueuePaused] = useState(false);
  const lastSpokenId = useRef<string | null>(null);
  const desktopRuntime = useMemo(() => isDesktopRuntime(), []);

  useEffect(() => {
    let active = true;
    const unlisteners: UnlistenFn[] = [];

    Promise.all([
      listenToLiveEvents((event) => {
        if (!active) return;
        setEvents((current) => {
          if (current.some((item) => item.id === event.id)) return current;
          return [event, ...current].slice(0, 150);
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
        if (Number.isFinite(savedRoomId) && savedRoomId > 0) {
          setStatus((current) =>
            current.roomId === 0
              ? {
                  ...current,
                  roomId: savedRoomId,
                  message: "已从统一配置恢复上次使用的直播间",
                }
              : current,
          );
        }
      }
    });

    return () => {
      active = false;
      unlisteners.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

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

  /**
   * 自动播报属于直播会话，不应跟随某个页面的挂载与卸载。
   * 因此切到设置、音色或悬浮窗页时，新弹幕仍会继续进入同一队列。
   */
  useEffect(() => {
    const latest = events[0];
    if (
      status.state !== "connected"
      || !latest
      || latest.type === "system"
      || lastSpokenId.current === latest.id
      || queuePaused
    ) {
      return;
    }

    lastSpokenId.current = latest.id;
    void enqueueSpeech(makeSpeechText(latest)).catch((error) => {
      console.error("bilimaku TTS playback failed", error);
    });
  }, [events, queuePaused, status.state]);

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

  const togglePlayback = useCallback(() => {
    setQueuePaused((paused) => {
      const nextPaused = !paused;
      if (nextPaused) pauseSpeech();
      else resumeSpeech();
      return nextPaused;
    });
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  return {
    desktopRuntime,
    status,
    room,
    events,
    popularity,
    onlineRank,
    onlineRankError,
    queuePaused,
    togglePlayback,
    connect,
    disconnect,
    clearEvents,
  };
}

export type LiveRoomController = ReturnType<typeof useLiveRoomController>;
