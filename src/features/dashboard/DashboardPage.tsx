import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
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
  MessageVirtualCanvas,
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

/** 未测量消息行的保守高度；真实高度会由 ResizeObserver 写回虚拟列表。 */
const MESSAGE_ROW_ESTIMATE_PX = 76;
const MESSAGE_VIRTUAL_OVERSCAN = 8;

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

type MessageFilterPhase = "visible" | "exiting";

interface AnimatedMessageRowProps {
  /** 已归一化的直播消息；同一消息在筛选切换时保持对象引用稳定。 */
  event: LiveEvent;
  /** 当前直播间主播 UID；用来识别主播本人发送的普通弹幕。 */
  ownerUid: number | null;
  /** 仅真正新收到并首次挂载的消息播放入场动画。 */
  enterOnMount: boolean;
  /** 当前消息在分类筛选状态机中的显示阶段。 */
  filterPhase: MessageFilterPhase;
  /** 退场动画结束后把当前行移出虚拟数据源。 */
  onFilterExitComplete: (eventId: string) => void;
  /** 当前行在虚拟列表中的索引，供动态高度测量器识别。 */
  virtualIndex: number;
  /** TanStack Virtual 的动态行高测量回调。 */
  measureElement: (node: HTMLDivElement | null) => void;
}

/**
 * 单条聊天消息的动效边界。
 *
 * 组件在分类切换时保持挂载；只有 visible/exiting/hidden 阶段发生变化的行会重渲染。
 * 这样头像、磨砂气泡与内部状态都可以复用，同时允许被过滤的可见行完整播放退场动画。
 */
const AnimatedMessageRow = memo(function AnimatedMessageRow({
  event,
  ownerUid,
  enterOnMount,
  filterPhase,
  onFilterExitComplete,
  virtualIndex,
  measureElement,
}: AnimatedMessageRowProps) {
  const anchorDanmaku = isAnchorDanmaku(event, ownerUid);
  const eventTag = anchorDanmaku
    ? "主播"
    : event.meta || eventTypeLabels[event.type];
  const [entering, setEntering] = useState(
    () => filterPhase === "visible"
      && enterOnMount
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    <MessageEntry
      ref={(node) => measureElement(node)}
      data-index={virtualIndex}
      data-virtual-index={virtualIndex}
      data-entering={entering}
      data-filter-phase={filterPhase}
      data-message-entry={event.id}
      role="listitem"
      aria-hidden={filterPhase === "exiting"}
      onAnimationEnd={(animationEvent) => {
        if (
          animationEvent.target === animationEvent.currentTarget
          && filterPhase === "exiting"
          && animationEvent.animationName.startsWith("bilimaku-message-filter-layout-out")
        ) {
          onFilterExitComplete(event.id);
        }
      }}
    >
      <MessageEntryContent
        data-entering={entering}
        data-filter-phase={filterPhase}
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
              {entering && filterPhase === "visible" ? (
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
}, (previous, next) => (
  previous.event === next.event
  && previous.ownerUid === next.ownerUid
  && previous.filterPhase === next.filterPhase
  && previous.virtualIndex === next.virtualIndex
));

interface MessageFilterTransitionState {
  /** 已经提交到 DOM 的筛选类型。 */
  filter: LiveMessageDisplayFilter;
  /** 仍需留在虚拟窗口中播放退场动画的消息 ID。 */
  exitingEventIds: ReadonlySet<string>;
}

interface MessageFeedListProps {
  /** 当前缓存中的全部消息；虚拟列表只会挂载视口附近的少量节点。 */
  allEvents: LiveEvent[];
  /** 当前分类应当显示的消息 ID。 */
  visibleEventIds: ReadonlySet<string>;
  /** 当前持久化的消息分类，用来识别一次真正的筛选切换。 */
  filter: LiveMessageDisplayFilter;
  /** 当前主播 UID；变化时重新判断主播标签。 */
  ownerUid: number | null;
  /** 本轮真正新增的消息 ID；筛选切换不会设置该值。 */
  enteringEventId: string | undefined;
  /** 通过消息流根节点 CSS 变量统一下发的气泡颜色。 */
  messageBubbleColor: string;
  /** 空状态需要区分未连接和直播间暂时安静。 */
  connected: boolean;
  /** 实际承担滚动的聊天视口。 */
  viewportRef: RefObject<HTMLDivElement | null>;
}

/**
 * 动态高度虚拟消息列表与筛选退场状态机。
 *
 * 缓存可以保留数百条消息，但 DOM 只挂载视口与 overscan 附近的行。切换分类时，
 * 当前视口内被过滤的行会被临时钉在虚拟范围中完成退场，屏幕外节点则直接释放。
 */
const MessageFeedList = memo(function MessageFeedList({
  allEvents,
  visibleEventIds,
  filter,
  ownerUid,
  enteringEventId,
  messageBubbleColor,
  connected,
  viewportRef,
}: MessageFeedListProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const previousVisibleEventIdsRef = useRef(visibleEventIds);
  const initialScrollPendingRef = useRef(true);
  const scrolledFilterRef = useRef(filter);
  const followedEventRef = useRef<string | undefined>(undefined);
  const animatedEntryEventIdRef = useRef<string | undefined>(undefined);
  const [transitionState, setTransitionState] = useState<MessageFilterTransitionState>(() => ({
    filter,
    exitingEventIds: new Set(),
  }));
  const feedStyle = useMemo(() => ({
    "--message-bubble-color": messageBubbleColor,
  }) as CSSProperties, [messageBubbleColor]);
  const filterChanging = transitionState.filter !== filter;
  const renderedEventIds = useMemo(() => {
    const next = new Set(visibleEventIds);
    for (const eventId of transitionState.exitingEventIds) {
      next.add(eventId);
    }
    if (filterChanging) {
      for (const eventId of previousVisibleEventIdsRef.current) {
        next.add(eventId);
      }
    }
    return next;
  }, [filterChanging, transitionState.exitingEventIds, visibleEventIds]);
  const renderedEvents = useMemo(
    () => allEvents.filter((event) => renderedEventIds.has(event.id)),
    [allEvents, renderedEventIds],
  );
  const renderedEventsRef = useRef(renderedEvents);
  renderedEventsRef.current = renderedEvents;
  const getEventKey = useCallback(
    (index: number) => renderedEventsRef.current[index]?.id ?? index,
    [],
  );
  const pinnedExitIndices = useMemo(() => {
    const indices: number[] = [];
    renderedEvents.forEach((event, index) => {
      if (transitionState.exitingEventIds.has(event.id)) indices.push(index);
    });
    return indices;
  }, [renderedEvents, transitionState.exitingEventIds]);
  const extractVirtualRange = useCallback((range: Range) => {
    if (pinnedExitIndices.length === 0) return defaultRangeExtractor(range);
    const indices = new Set(defaultRangeExtractor(range));
    for (const index of pinnedExitIndices) indices.add(index);
    return Array.from(indices).sort((left, right) => left - right);
  }, [pinnedExitIndices]);
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: renderedEvents.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => MESSAGE_ROW_ESTIMATE_PX,
    getItemKey: getEventKey,
    overscan: MESSAGE_VIRTUAL_OVERSCAN,
    rangeExtractor: extractVirtualRange,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: 48,
    useFlushSync: false,
    directDomUpdates: true,
    directDomUpdatesMode: "position",
    useAnimationFrameWithResizeObserver: true,
  });

  useLayoutEffect(() => {
    const filterChanged = transitionState.filter !== filter;
    const allEventIds = new Set(allEvents.map((event) => event.id));

    if (!filterChanged) {
      previousVisibleEventIdsRef.current = visibleEventIds;
      setTransitionState((current) => {
        const nextExitingIds = new Set(
          Array.from(current.exitingEventIds).filter((eventId) => allEventIds.has(eventId)),
        );
        return nextExitingIds.size === current.exitingEventIds.size
          ? current
          : { ...current, exitingEventIds: nextExitingIds };
      });
      return;
    }

    const animatedExitIds = new Set<string>();

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const feed = feedRef.current;
      const viewport = viewportRef.current;
      if (feed && viewport) {
        const viewportRect = viewport.getBoundingClientRect();
        for (const node of feed.querySelectorAll<HTMLElement>("[data-message-entry]")) {
          if (visibleEventIds.has(node.dataset.messageEntry ?? "")) continue;
          const rowRect = node.getBoundingClientRect();
          if (rowRect.bottom > viewportRect.top && rowRect.top < viewportRect.bottom) {
            animatedExitIds.add(node.dataset.messageEntry ?? "");
          }
        }
      }
    }

    previousVisibleEventIdsRef.current = visibleEventIds;
    setTransitionState((current) => {
      const nextExitingIds = new Set<string>();
      for (const eventId of current.exitingEventIds) {
        if (allEventIds.has(eventId) && !visibleEventIds.has(eventId)) {
          nextExitingIds.add(eventId);
        }
      }
      for (const eventId of animatedExitIds) {
        nextExitingIds.add(eventId);
      }
      return {
        filter,
        exitingEventIds: nextExitingIds,
      };
    });
  }, [
    allEvents,
    filter,
    transitionState.filter,
    viewportRef,
    visibleEventIds,
  ]);

  const finishFilterExit = useCallback((eventId: string) => {
    setTransitionState((current) => {
      if (!current.exitingEventIds.has(eventId)) return current;
      const nextExitingIds = new Set(current.exitingEventIds);
      nextExitingIds.delete(eventId);
      return { ...current, exitingEventIds: nextExitingIds };
    });
  }, []);

  useEffect(() => {
    if (transitionState.exitingEventIds.size === 0) return;
    const viewport = viewportRef.current;
    const duration = viewport
      ? readCssTimeMilliseconds(viewport, "--message-filter-exit-duration", 300)
      : 300;
    const exitingSnapshot = new Set(transitionState.exitingEventIds);
    const timer = window.setTimeout(() => {
      setTransitionState((current) => {
        const nextExitingIds = new Set(current.exitingEventIds);
        for (const eventId of exitingSnapshot) nextExitingIds.delete(eventId);
        return nextExitingIds.size === current.exitingEventIds.size
          ? current
          : { ...current, exitingEventIds: nextExitingIds };
      });
    }, duration + 80);
    return () => window.clearTimeout(timer);
  }, [transitionState.exitingEventIds, viewportRef]);

  useLayoutEffect(() => {
    const filterChanged = scrolledFilterRef.current !== filter;
    if (!initialScrollPendingRef.current && !filterChanged) return;
    if (renderedEvents.length === 0) return;
    scrolledFilterRef.current = filter;
    initialScrollPendingRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      rowVirtualizer.scrollToEnd({ behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filter, renderedEvents.length, rowVirtualizer]);

  useLayoutEffect(() => {
    if (!enteringEventId || followedEventRef.current === enteringEventId) return;
    followedEventRef.current = enteringEventId;
    const frame = window.requestAnimationFrame(() => {
      rowVirtualizer.scrollToEnd({ behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enteringEventId, rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const showEmptyState = visibleEventIds.size === 0
    && transitionState.exitingEventIds.size === 0;

  return (
    <MessageFeed ref={feedRef} style={feedStyle} data-virtualized="true">
      <MessageVirtualCanvas
        ref={rowVirtualizer.containerRef}
        role="list"
        aria-label="直播间消息"
        data-total-count={renderedEvents.length}
        data-mounted-count={virtualItems.length}
      >
        {virtualItems.map((virtualItem) => {
          const event = renderedEvents[virtualItem.index];
          if (!event) return null;
          const enterOnMount = event.id === enteringEventId
            && animatedEntryEventIdRef.current !== event.id;
          if (enterOnMount) animatedEntryEventIdRef.current = event.id;
          return (
            <AnimatedMessageRow
              key={virtualItem.key}
              event={event}
              ownerUid={ownerUid}
              enterOnMount={enterOnMount}
              filterPhase={transitionState.exitingEventIds.has(event.id)
                ? "exiting"
                : "visible"}
              onFilterExitComplete={finishFilterExit}
              virtualIndex={virtualItem.index}
              measureElement={rowVirtualizer.measureElement}
            />
          );
        })}
      </MessageVirtualCanvas>
      {showEmptyState ? (
        <EmptyFeed>
          <div>
            <strong>{connected ? "直播间很安静" : "等待直播间连接"}</strong>
            {filter === "all"
              ? "新的弹幕和互动会像聊天消息一样出现在这里。"
              : "当前筛选下还没有消息。"}
          </div>
        </EmptyFeed>
      ) : null}
    </MessageFeed>
  );
}, (previous, next) => (
  previous.allEvents === next.allEvents
  && previous.visibleEventIds === next.visibleEventIds
  && previous.filter === next.filter
  && previous.ownerUid === next.ownerUid
  && previous.messageBubbleColor === next.messageBubbleColor
  && previous.connected === next.connected
  && previous.viewportRef === next.viewportRef
));

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

  const eventBuckets = useMemo<Record<LiveMessageDisplayFilter, LiveEvent[]>>(() => {
    const chronologicalEvents = [...sourceEvents].reverse();
    const buckets: Record<LiveMessageDisplayFilter, LiveEvent[]> = {
      all: chronologicalEvents,
      message: [],
      interaction: [],
      gift: [],
      superchat: [],
    };

    for (const event of chronologicalEvents) {
      switch (event.type) {
        case "message":
        case "interaction":
        case "gift":
        case "superchat":
          buckets[event.type].push(event);
          break;
        default:
          break;
      }
    }
    return buckets;
  }, [sourceEvents]);
  const events = eventBuckets[filter];
  const visibleEventIds = useMemo(
    () => new Set(events.map((event) => event.id)),
    [events],
  );
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
    renderedFeedRef.current = { filter, latestEventId };
    messageFeedReadyRef.current = true;
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
                    if (filter === item.value) return;
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

          <MessageViewport ref={messageViewportRef} data-message-viewport="true">
            <MessageFeedList
              allEvents={eventBuckets.all}
              visibleEventIds={visibleEventIds}
              filter={filter}
              ownerUid={live.room?.ownerUid ?? null}
              enteringEventId={animateLatestEvent ? latestEventId : undefined}
              messageBubbleColor={messageBubbleColor}
              connected={connected}
              viewportRef={messageViewportRef}
            />
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
