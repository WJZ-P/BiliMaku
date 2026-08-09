import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { LiquidGlassSurface } from "../../components/LiquidGlassSurface";
import { getLiveAppearanceSettings, saveLiveRoomId } from "../../services/desktop";
import { sendLiveDanmaku } from "../../services/liveChat";
import {
  closeOverlay,
  getOverlayWindowState,
  listenToOverlayWindowState,
  openOverlay,
} from "../../services/overlays";
import {
  flushStartupMetrics,
  markStartup,
} from "../../services/startupPerformance";
import type { LiveConnectionPhase, LiveEvent, LiveEventType } from "../../types/events";
import { DEFAULT_MESSAGE_BUBBLE_COLOR } from "../../styles/theme";
import type { LiveMessageDisplayFilter } from "../../types/liveMessages";
import { LIVE_DANMAKU_MAX_LENGTH } from "../../types/liveChat";
import type { AppView } from "../../types/navigation";
import {
  AnalyticsDrawer,
  AvatarImage,
  DrawerBar,
  DrawerClose,
  DrawerLoading,
  DrawerTitle,
  ChatHeader,
  ChatPanel,
  ChatToolbar,
  Composer,
  ComposerAssist,
  ComposerButton,
  ComposerCounter,
  ComposerField,
  ComposerInput,
  ComposerInputShell,
  ConnectButton,
  ConnectForm,
  DashboardShell,
  EmptyFeed,
  EventAvatar,
  EventTime,
  EventType,
  EventUser,
  EventUserId,
  FilterButton,
  FilterGroup,
  FunctionRail,
  MessageBody,
  MessageBubble,
  MessageBubbleText,
  MessageEntry,
  MessageEntryContent,
  MessageFeed,
  MessageMeta,
  MessageRow,
  MessageViewport,
  Page,
  RailButton,
  RailSpacer,
  RailTitle,
  RoomCaption,
  RoomCopy,
  RoomCover,
  RoomCoverFallback,
  RoomCoverImage,
  RoomField,
  RoomIdentity,
  RoomInput,
  RoomTitle,
} from "./CompactDashboardStyles";
import { useLiveRoom } from "./LiveRoomContext";

markStartup("dashboard-module-evaluated");

const AnchorAnalyticsPanel = lazy(() =>
  import("./AnchorAnalyticsPanel").then((module) => ({
    default: module.AnchorAnalyticsPanel,
  })),
);

interface DashboardPageProps {
  /** 从直播间右侧功能栏跳转到其他工作台模块。 */
  onNavigate?: (view: AppView) => void;
}

interface RailAction {
  /** 目标工作台视图。 */
  view: AppView;
  /** 功能栏短标题。 */
  label: string;
  /** Tooltip 中展示的完整说明。 */
  tooltip: string;
  /** 对应的公共图标。 */
  icon: IconName;
}

const eventFilters: Array<{ label: string; value: LiveMessageDisplayFilter }> = [
  { label: "全部", value: "all" },
  { label: "弹幕", value: "message" },
  { label: "互动", value: "interaction" },
  { label: "礼物", value: "gift" },
  { label: "高亮", value: "superchat" },
];

const railActions: RailAction[] = [
  { view: "rules", label: "规则", tooltip: "弹幕过滤与播报规则", icon: "sliders" },
  { view: "voices", label: "音色", tooltip: "语音角色与 TTS 引擎", icon: "waveform" },
];

const statusLabels = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  reconnecting: "重连中",
  error: "异常",
} as const;

const eventTypeLabels: Record<LiveEventType, string> = {
  message: "弹幕",
  interaction: "互动",
  gift: "礼物",
  superchat: "SC",
  guard: "大航海",
  system: "系统",
};

/** 仅普通弹幕需要根据发送者 UID 提升为主播消息。 */
function isAnchorDanmaku(event: LiveEvent, ownerUid: number | null) {
  if (event.type !== "message" || ownerUid === null || ownerUid <= 0) {
    return false;
  }
  return event.userId?.trim() === String(ownerUid);
}

/** 将一级分区与具体分区合并为紧凑的房间分类说明，并避免重名。 */
function formatRoomArea(parentAreaName?: string, areaName?: string) {
  const areaNames = [parentAreaName, areaName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(areaNames)].join(" · ");
}

function formatEventTime(event: LiveEvent) {
  if (event.time) return event.time;
  if (!event.emittedAt) return "刚刚";
  return new Date(event.emittedAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 读取消息流 CSS 中的时长变量，让滚动跟随和 Linaria 动画共用同一套参数。 */
function readCssTimeMilliseconds(
  element: HTMLElement,
  property: string,
  fallback: number,
) {
  const value = window.getComputedStyle(element).getPropertyValue(property).trim();
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (value.endsWith("ms")) return numeric;
  if (value.endsWith("s")) return numeric * 1_000;
  return fallback;
}

function normalizeBilibiliImageUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url.startsWith("https://") ? url : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

interface RoomCoverViewProps {
  /** 平台适配层选出的直播封面地址。 */
  coverUrl: string;
  /** 用于图片无障碍文本的直播间标题。 */
  title: string;
  /** 当前连接阶段，用于无封面时的占位色。 */
  state: LiveConnectionPhase;
}

/** Chat 页头中的直播封面；图片失败时保留与连接阶段一致的轻量占位。 */
function RoomCoverView({ coverUrl, title, state }: RoomCoverViewProps) {
  const imageUrl = normalizeBilibiliImageUrl(coverUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const showImage = Boolean(imageUrl) && !imageFailed;
  return (
    <RoomCover
      data-state={state}
      data-has-image={showImage}
      data-tooltip={showImage ? "当前直播间封面" : statusLabels[state]}
    >
      <RoomCoverFallback aria-hidden="true">
        <Icon name="radio" size={14} />
      </RoomCoverFallback>
      {showImage ? (
        <RoomCoverImage
          src={imageUrl}
          alt={`${title}的直播封面`}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </RoomCover>
  );
}
function EventAvatarView({ event }: { event: LiveEvent }) {
  const avatarUrl = normalizeBilibiliImageUrl(event.avatar);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const fallback = avatarUrl
    ? event.user.slice(0, 1)
    : event.avatar.trim().slice(0, 1) || event.user.slice(0, 1) || "播";

  return (
    <EventAvatar data-event-avatar="true" data-type={event.type}>
      {fallback}
      {avatarUrl && !imageFailed ? (
        <AvatarImage
          src={avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </EventAvatar>
  );
}

interface AnimatedMessageRowProps {
  /** 已归一化的直播消息。 */
  event: LiveEvent;
  /** 当前直播间主播 UID；用来识别主播本人发送的普通弹幕。 */
  ownerUid: number | null;
  /** 仅新收到的消息在首次挂载时播放入场动画。 */
  enterOnMount: boolean;
  /** 当前是否为消息流最末尾的一条；据此保证 WebGL 上下文最多只有一个。 */
  isLatest: boolean;
}

/**
 * 单条聊天消息的动效边界。
 *
 * 外层负责从 0 高度展开并推动旧消息上移，内层负责左下到右上的弹簧入场；
 * 动画结束后移除裁剪，避免头像和气泡阴影被长期截断。
 */
function AnimatedMessageRow({
  event,
  ownerUid,
  enterOnMount,
  isLatest,
}: AnimatedMessageRowProps) {
  const anchorDanmaku = isAnchorDanmaku(event, ownerUid);
  const eventTag = anchorDanmaku
    ? "主播"
    : event.meta || eventTypeLabels[event.type];
  const [entering, setEntering] = useState(
    () => enterOnMount && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    <MessageEntry data-entering={entering} data-message-entry={event.id}>
      <MessageEntryContent
        data-entering={entering}
        onAnimationEnd={(animationEvent) => {
          if (animationEvent.target === animationEvent.currentTarget) {
            setEntering(false);
          }
        }}
      >
        <MessageRow data-type={event.type}>
          <EventAvatarView event={event} />
          <MessageBody>
            <MessageMeta data-message-meta="true">
              <EventUser>{event.user}</EventUser>
              {event.userId ? (
                <EventUserId data-tooltip={`用户 UID ${event.userId}`}>
                  UID {event.userId}
                </EventUserId>
              ) : null}
              <EventType data-type={event.type} data-anchor={anchorDanmaku}>
                {eventTag}
              </EventType>
              <EventTime>{formatEventTime(event)}</EventTime>
            </MessageMeta>
            <MessageBubble data-type={event.type} data-liquid-glass="true">
              {entering && isLatest ? (
                <LiquidGlassSurface
                  active
                  animationKey={event.emittedAt ?? 0}
                  radiusPx={event.type === "system" ? 999 : 10}
                />
              ) : null}
              <MessageBubbleText>{event.content}</MessageBubbleText>
            </MessageBubble>
          </MessageBody>
        </MessageRow>
      </MessageEntryContent>
    </MessageEntry>
  );
}

let dashboardFirstFrameReported = false;

/**
 * 紧凑直播间工作台。
 *
 * 首页仅承担连接、实时事件阅读与播报控制；复杂配置通过右侧功能栏进入独立模块。
 */
export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const live = useLiveRoom();
  const [roomId, setRoomId] = useState("");
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [overlaysOpen, setOverlaysOpen] = useState(false);
  const [overlayBusy, setOverlayBusy] = useState(false);
  const [overlayError, setOverlayError] = useState("");
  const [outgoingMessage, setOutgoingMessage] = useState("");
  const [sendPhase, setSendPhase] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [sendNotice, setSendNotice] = useState("");
  const [messageBubbleColor, setMessageBubbleColor] = useState(DEFAULT_MESSAGE_BUBBLE_COLOR);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const messageFeedReadyRef = useRef(false);
  const renderedFeedRef = useRef<{
    filter: "all" | LiveEventType;
    latestEventId: string | undefined;
  }>({ filter: "all", latestEventId: undefined });
  const messageScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (dashboardFirstFrameReported) return;
    dashboardFirstFrameReported = true;
    markStartup("dashboard-react-committed");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        markStartup("dashboard-first-frame");
        void flushStartupMetrics("dashboard-first-frame");
      });
    });
  }, []);

  const connected = live.status.state === "connected";
  const connecting = live.status.state === "connecting";
  const reconnecting = live.status.state === "reconnecting";
  const sourceEvents = live.events;
  const filter = live.messageSettings.displayFilter;

  const events = useMemo(() => {
    const filtered = filter === "all"
      ? sourceEvents
      : sourceEvents.filter((event) => event.type === filter);
    return [...filtered].reverse();
  }, [filter, sourceEvents]);

  const outgoingLength = Array.from(outgoingMessage.trim()).length;
  const roomTitle = live.status.state === "disconnected"
    ? "未连接"
    : live.room?.title
      || (live.status.roomId > 0 ? `直播间 ${live.status.roomId}` : statusLabels[live.status.state]);
  const showRoomCaption = connecting || reconnecting || live.status.state === "error";
  const roomAreaLabel = formatRoomArea(
    live.room?.parentAreaName,
    live.room?.areaName,
  );
  const roomCaption = showRoomCaption
    ? live.status.message
    : connected
      ? roomAreaLabel
      : "";
  const latestEventId = events.at(-1)?.id;
  const animateLatestEvent = messageFeedReadyRef.current
    && renderedFeedRef.current.filter === filter
    && renderedFeedRef.current.latestEventId !== latestEventId
    && latestEventId === live.events[0]?.id;
  const sendDisabled = !connected
    || sendPhase === "sending"
    || outgoingLength === 0
    || outgoingLength > LIVE_DANMAKU_MAX_LENGTH;
  const composerAssist = sendNotice || (connected
    ? "Enter 发送 · 使用当前扫码登录账号"
    : "连接直播间后即可使用当前账号发弹幕");
  const messageFeedStyle = {
    "--message-bubble-color": messageBubbleColor,
  } as CSSProperties;

  useEffect(() => {
    let active = true;
    void getLiveAppearanceSettings().then((settings) => {
      if (active) setMessageBubbleColor(settings.messageBubbleColor);
    }).catch((error) => {
      console.warn("bilimaku live appearance loading failed", error);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!roomId && live.status.roomId > 0) {
      setRoomId(String(live.status.roomId));
    }
  }, [live.status.roomId, roomId]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const refresh = async () => {
      try {
        const state = await getOverlayWindowState();
        if (active) setOverlaysOpen(state.danmaku || state.sidebar);
      } catch (error) {
        if (!active) return;
        setOverlayError(errorMessage(error));
        console.error("bilimaku overlay state check failed", error);
      }
    };
    const initialize = async () => {
      try {
        const stop = await listenToOverlayWindowState(() => void refresh());
        if (!active) {
          stop();
          return;
        }
        unlisten = stop;
      } catch (error) {
        console.error("bilimaku overlay state listener failed", error);
      }
      await refresh();
    };
    void initialize();
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const value = roomId.trim();
    if (!/^\d+$/.test(value) || Number(value) <= 0) return;
    const timer = window.setTimeout(() => {
      void saveLiveRoomId(value).catch((error) => {
        console.warn("bilimaku room settings persistence failed", error);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [roomId]);

  useLayoutEffect(() => {
    const viewport = messageViewportRef.current;
    const previous = renderedFeedRef.current;
    const feedWasReady = messageFeedReadyRef.current;
    const filterChanged = previous.filter !== filter;
    const eventChanged = previous.latestEventId !== latestEventId;

    renderedFeedRef.current = { filter, latestEventId };
    messageFeedReadyRef.current = true;

    if (!viewport) return;
    if (messageScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(messageScrollFrameRef.current);
      messageScrollFrameRef.current = null;
    }

    const followBottom = () => {
      viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    };

    if (!feedWasReady || filterChanged || !eventChanged) {
      followBottom();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      followBottom();
      return;
    }

    // 新行的高度会在 CSS 动画期间逐帧增加；持续贴住底部即可让旧消息平滑上移，
    // 同时避免原生 smooth scroll 在连续弹幕到来时反复重启动画产生顿挫。
    const motionDuration = readCssTimeMilliseconds(
      viewport,
      "--message-enter-duration",
      820,
    ) + 80;
    const startedAt = window.performance.now();
    const tick = (now: number) => {
      followBottom();
      if (now - startedAt < motionDuration) {
        messageScrollFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        messageScrollFrameRef.current = null;
        followBottom();
      }
    };
    messageScrollFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (messageScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(messageScrollFrameRef.current);
        messageScrollFrameRef.current = null;
      }
    };
  }, [filter, latestEventId]);

  const handleConnection = async () => {
    if (connected || reconnecting) {
      await live.disconnect();
      return;
    }
    try {
      await live.connect(roomId);
    } catch {
      // 具体错误已经由 useLiveRoom 写入状态栏。
    }
  };

  const handleSendDanmaku = async () => {
    if (sendDisabled) return;
    const message = outgoingMessage.trim();
    setSendPhase("sending");
    setSendNotice("正在通过当前登录账号发送…");
    try {
      const result = await sendLiveDanmaku({ message });
      setOutgoingMessage("");
      setSendPhase("success");
      setSendNotice(`已发送到直播间 ${result.roomId} · 等待长链回显`);
    } catch (error) {
      setSendPhase("error");
      setSendNotice(errorMessage(error));
    }
  };

  /**
   * 直播间功能栏的悬浮组件总开关。
   * 任意悬浮窗已打开时会统一关闭；全部关闭时会同时打开弹幕层和事件栏。
   */
  const toggleOverlays = async () => {
    if (overlayBusy) return;
    setOverlayBusy(true);
    setOverlayError("");
    try {
      if (overlaysOpen) {
        await Promise.all([
          closeOverlay("danmaku"),
          closeOverlay("sidebar"),
        ]);
        setOverlaysOpen(false);
      } else {
        await Promise.all([
          openOverlay("danmaku"),
          openOverlay("sidebar"),
        ]);
        setOverlaysOpen(true);
      }
    } catch (error) {
      setOverlayError(errorMessage(error));
      console.error("bilimaku overlay toggle failed", error);
      try {
        const state = await getOverlayWindowState();
        setOverlaysOpen(state.danmaku || state.sidebar);
      } catch (stateError) {
        console.error("bilimaku overlay state refresh failed", stateError);
      }
    } finally {
      setOverlayBusy(false);
    }
  };

  const connectionAction = connecting
    ? "连接中"
    : connected
      ? "断开"
      : reconnecting
        ? "停止"
        : "连接";
  const connectionDisabled = connecting || (!connected && !reconnecting && !roomId.trim());

  return (
    <Page>
      <DashboardShell>
        <ChatPanel>
          <ChatHeader>
            <RoomIdentity>
              <RoomCoverView
                coverUrl={live.room?.coverUrl ?? ""}
                title={roomTitle}
                state={live.status.state}
              />
              <RoomCopy>
                <RoomTitle>{roomTitle}</RoomTitle>
                {roomCaption ? (
                  <RoomCaption data-error={live.status.state === "error"}>
                    {roomCaption}
                  </RoomCaption>
                ) : null}
              </RoomCopy>
            </RoomIdentity>

            <ConnectForm
              onSubmit={(event) => {
                event.preventDefault();
                void handleConnection();
              }}
            >
              <RoomField>
                <Icon name="radio" size={13} />
                <RoomInput
                  value={roomId}
                  inputMode="numeric"
                  aria-label="直播间号"
                  placeholder="直播间号"
                  disabled={connected || connecting || reconnecting}
                  onChange={(event) => setRoomId(event.target.value)}
                />
              </RoomField>
              <ConnectButton
                type="submit"
                data-connected={connected}
                disabled={connectionDisabled}
              >
                <Icon name={connected ? "check" : "plug"} size={13} />
                {connectionAction}
              </ConnectButton>
            </ConnectForm>
          </ChatHeader>

          <ChatToolbar>
            <FilterGroup aria-label="事件筛选">
              {eventFilters.map((item) => (
                <FilterButton
                  key={item.value}
                  type="button"
                  data-active={filter === item.value}
                  onClick={() => {
                    void live.updateMessageSettings({
                      displayFilter: item.value,
                    }).catch((error) => {
                      console.error("bilimaku message filter persistence failed", error);
                    });
                  }}
                >
                  {item.label}
                </FilterButton>
              ))}
            </FilterGroup>
          </ChatToolbar>

          <MessageViewport ref={messageViewportRef}>
            {events.length > 0 ? (
              <MessageFeed style={messageFeedStyle}>
                {events.map((event) => (
                  <AnimatedMessageRow
                    key={event.id}
                    event={event}
                    ownerUid={live.room?.ownerUid ?? null}
                    enterOnMount={animateLatestEvent && event.id === latestEventId}
                    isLatest={event.id === latestEventId}
                  />
                ))}
              </MessageFeed>
            ) : (
              <EmptyFeed>
                <div>
                  <strong>{connected ? "直播间很安静" : "等待直播间连接"}</strong>
                  {filter === "all" ? "新的弹幕和互动会像聊天消息一样出现在这里。" : "当前筛选下还没有消息。"}
                </div>
              </EmptyFeed>
            )}
          </MessageViewport>

          <Composer
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendDanmaku();
            }}
          >
            <ComposerField>
              <ComposerInputShell
                data-state={sendPhase}
                data-disabled={!connected}
              >
                <ComposerInput
                  value={outgoingMessage}
                  type="text"
                  aria-label="发送直播弹幕"
                  aria-describedby="live-danmaku-assist"
                  placeholder={connected ? "发一条弹幕到当前直播间…" : "连接直播间后即可发弹幕"}
                  disabled={!connected || sendPhase === "sending"}
                  onChange={(event) => {
                    const nextValue = Array.from(event.target.value)
                      .slice(0, LIVE_DANMAKU_MAX_LENGTH)
                      .join("");
                    setOutgoingMessage(nextValue);
                    if (sendPhase !== "sending") {
                      setSendPhase("idle");
                      setSendNotice("");
                    }
                  }}
                />
                <ComposerCounter
                  data-near-limit={outgoingLength >= LIVE_DANMAKU_MAX_LENGTH - 6}
                  aria-label={`已输入 ${outgoingLength} 个字符，最多 ${LIVE_DANMAKU_MAX_LENGTH} 个`}
                >
                  {outgoingLength}/{LIVE_DANMAKU_MAX_LENGTH}
                </ComposerCounter>
              </ComposerInputShell>
              <ComposerAssist id="live-danmaku-assist" data-state={sendPhase} aria-live="polite">
                {composerAssist}
              </ComposerAssist>
            </ComposerField>
            <ComposerButton
              type="submit"
              disabled={sendDisabled}
              aria-label={sendPhase === "sending" ? "正在发送弹幕" : "发送弹幕"}
            >
              <Icon name="send" size={13} />
              <span>{sendPhase === "sending" ? "发送中" : "发送"}</span>
            </ComposerButton>
          </Composer>

          {analyticsOpen ? (
            <AnalyticsDrawer aria-label="主播数据抽屉">
              <DrawerBar>
                <DrawerTitle>主播数据</DrawerTitle>
                <DrawerClose type="button" onClick={() => setAnalyticsOpen(false)}>
                  <Icon name="arrow" size={11} />
                  收起
                </DrawerClose>
              </DrawerBar>
              <Suspense fallback={<DrawerLoading>正在加载主播数据…</DrawerLoading>}>
                <AnchorAnalyticsPanel />
              </Suspense>
            </AnalyticsDrawer>
          ) : null}
        </ChatPanel>

        <FunctionRail aria-label="直播间功能栏">
          <RailTitle>功能</RailTitle>
          <RailButton
            type="button"
            data-active={live.autoSpeak}
            data-tooltip={live.autoSpeak ? "关闭自动播报（会持久化）" : "开启自动播报（会持久化）"}
            data-tooltip-placement="left"
            onClick={live.toggleAutoSpeak}
          >
            <Icon name={live.autoSpeak ? "pause" : "play"} size={17} />
            {live.autoSpeak ? "关闭" : "开启"}
          </RailButton>

          <RailButton
            type="button"
            data-active={analyticsOpen}
            data-tooltip="查看主播数据总览"
            data-tooltip-placement="left"
            onClick={() => setAnalyticsOpen((value) => !value)}
          >
            <Icon name="dashboard" size={17} />
            数据
          </RailButton>

          <RailButton
            type="button"
            data-active={overlaysOpen}
            disabled={overlayBusy}
            aria-pressed={overlaysOpen}
            aria-label={overlaysOpen ? "关闭全部悬浮组件" : "打开全部悬浮组件"}
            data-tooltip={overlayError || (overlaysOpen
              ? "关闭全屏弹幕层与侧边事件栏"
              : "打开全屏弹幕层与侧边事件栏")}
            data-tooltip-placement="left"
            onClick={() => void toggleOverlays()}
          >
            <Icon name="message" size={17} />
            {overlayBusy ? "处理中" : overlaysOpen ? "关闭" : "悬浮"}
          </RailButton>

          {railActions.map((action) => (
            <RailButton
              key={action.view}
              type="button"
              data-tooltip={action.tooltip}
              data-tooltip-placement="left"
              onClick={() => onNavigate?.(action.view)}
            >
              <Icon name={action.icon} size={17} />
              {action.label}
            </RailButton>
          ))}

          <RailSpacer />
          <RailButton
            type="button"
            data-tooltip="账号、主题与应用设置"
            data-tooltip-placement="left"
            onClick={() => onNavigate?.("settings")}
          >
            <Icon name="settings" size={17} />
            设置
          </RailButton>
        </FunctionRail>
      </DashboardShell>
    </Page>
  );
}
