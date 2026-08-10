import { styled } from "@linaria/react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AccountProfileTooltip } from "./AccountProfileTooltip";
import { Icon } from "./Icon";
import {
  isDesktopRuntime,
  listenToLiveEvents,
  listenToLiveRoomStats,
  listenToLiveStatus,
} from "../services/desktop";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import type { AccountProfile } from "../types/account";
import type { LiveRoomStatsUpdate } from "../types/events";
import type { LiveOnlineRankEntry } from "../types/liveRank";

/** 工作台标题栏从共享直播会话中读取的轻量实时摘要。 */
export interface TitleBarRoomSummary {
  /** 当前是否已经建立直播间长链。 */
  connected: boolean;
  /** 当前是否处于连接、重连或已连接状态。 */
  hasLiveContext: boolean;
  /** 当前会话缓存中的普通弹幕数量。 */
  messageCount: number;
  /** 当前会话缓存中的礼物、醒目留言与大航海数量。 */
  highlightedCount: number;
  /** 当前直播已经持续的格式化时长。 */
  liveDuration: string;
  /** 平台返回的本场开播时间。 */
  liveTime?: string;
  /** 心跳返回的人气指标，并非精确在线人数。 */
  popularity: number;
  /** 在线贡献榜人数的展示文本。 */
  onlineCountText?: string;
  /** 在线贡献榜前三名。 */
  onlineRankEntries: LiveOnlineRankEntry[];
  /** 在线贡献榜最近一次读取错误。 */
  onlineRankError: string;
}
interface WindowTitleBarProps {
  /** 登录窗口隐藏账号区和数据摘要，只保留可拖拽区域与窗口按钮。 */
  compact?: boolean;
  /** 当前已登录账号资料；工作台标题栏用它绘制头像经验环。 */
  profile?: AccountProfile | null;
  /** 由工作台共享直播会话提供的实时摘要；登录页不传入。 */
  roomSummary?: TitleBarRoomSummary | null;}

const Bar = styled.header`
  --window-control-size: ${theme.layout.titleBarControlSize};

  position: fixed;
  z-index: ${globalLayers.titleBar};
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  height: ${theme.layout.titleBarHeight};
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 6px;
  border-bottom: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 66%, transparent);
  background:
    linear-gradient(
      105deg,
      color-mix(in srgb, ${theme.colors.surface} 57%, transparent),
      color-mix(in srgb, ${theme.colors.brandSubtle} 29%, transparent) 56%,
      color-mix(in srgb, ${theme.colors.surface} 45%, transparent)
    );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 82%, transparent),
    inset 0 -1px 0 color-mix(in srgb, ${theme.colors.brandSoft} 18%, transparent);
  user-select: none;
  backdrop-filter: blur(32px) saturate(1.44) brightness(1.035);
  -webkit-backdrop-filter: blur(32px) saturate(1.44) brightness(1.035);

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background: color-mix(in srgb, ${theme.colors.surface} 91%, ${theme.colors.canvasAccent});
  }

  &[data-compact="true"] {
    --window-control-size: ${theme.layout.compactTitleBarHeight};

    right: 0;
    left: 0;
    height: ${theme.layout.compactTitleBarHeight};
    padding-left: 0;
    border-bottom: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
`;

const DragRegion = styled.div`
  display: flex;
  min-width: 48px;
  flex: 1;
  align-items: center;
  align-self: stretch;
  gap: 4px;
  overflow: hidden;
`;

const AvatarDivider = styled.span`
  width: 1px;
  height: 30px;
  flex: 0 0 1px;
  margin: 0 4px;
  background: color-mix(in srgb, ${theme.colors.borderStrong} 78%, transparent);
`;
const SummaryRail = styled.div`
  display: flex;
  min-width: 0;
  height: ${theme.titleBar.metricHeightPx}px;
  flex: 0 1 auto;
  align-items: stretch;
  gap: 0;
  overflow: hidden;
  border: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 18%, transparent);

  @media (max-width: 980px) {
    [data-metric-label-text="true"] {
      display: none;
    }
  }

  @media (max-width: 760px) {
    [data-rank-faces="true"] {
      display: none;
    }
  }
`;
/** 标题栏实时数据轨：硬边、无浮层阴影，Hover 只保留底色扫描反馈。 */
const SummaryMetric = styled.div`
  --metric-accent: ${theme.colors.brand};
  position: relative;
  display: inline-flex;
  height: 100%;
  min-width: ${theme.titleBar.metricMinWidthPx}px;
  flex: 0 1 auto;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  padding: 0 8px;
  border: 0;
  border-right: 1px solid ${theme.colors.borderStrong};
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  white-space: nowrap;
  transition:
    background ${theme.motion.normal},
    color ${theme.motion.fast};

  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--metric-accent) 13%, transparent),
      transparent
    );
    content: "";
    opacity: 0;
    transform: translateX(-74%);
    transition:
      opacity ${theme.motion.normal},
      transform ${theme.motion.normal};
  }

  &::after {
    position: absolute;
    z-index: 1;
    top: 0;
    bottom: 0;
    left: 0;
    width: 2px;
    background: var(--metric-accent);
    content: "";
    opacity: 0.34;
    transform: scaleY(0.48);
    transition:
      opacity ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  & > * {
    position: relative;
    z-index: 2;
  }

  &:last-child {
    border-right: 0;
  }

  &[data-kind="watched"] {
    --metric-accent: ${theme.colors.cyan};
  }

  &[data-kind="likes"] {
    --metric-accent: ${theme.colors.brand};
  }

  &[data-kind="highlighted"] {
    --metric-accent: ${theme.colors.gift};
  }

  &[data-kind="duration"] {
    --metric-accent: ${theme.colors.cyan};
    min-width: calc(${theme.titleBar.metricMinWidthPx}px + 22px);
  }

  &[data-kind="popularity"] {
    --metric-accent: ${theme.colors.warning};
  }

  &[data-kind="online"] {
    --metric-accent: ${theme.colors.success};
  }

  @media (max-width: 760px) {
    min-width: 54px;
    gap: 4px;
    padding: 0 6px;

    &[data-kind="duration"] {
      min-width: 78px;
    }
  }

  &:hover {
    background: color-mix(in srgb, var(--metric-accent) 7%, transparent);
  }

  &:hover::before {
    opacity: 1;
    transform: translateX(74%);
  }

  &:hover::after {
    opacity: 0.92;
    transform: scaleY(1);
  }
`;
const MetricLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.textMuted};
  font-size: ${theme.titleBar.metricLabelFontSize};
  font-weight: 720;

  svg {
    color: var(--metric-accent);
  }
`;
const MetricLabelText = styled.span``;
const MetricValue = styled.strong`
  overflow: hidden;
  max-width: 96px;
  color: ${theme.colors.textPrimary};
  font-size: ${theme.titleBar.metricValueFontSize};
  font-variant-numeric: tabular-nums;
  font-weight: 860;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
`;

const MetricRankFaces = styled.i`
  display: inline-flex;
  align-items: center;
  margin-left: 1px;
  padding-right: 1px;
  font-style: normal;
`;

const MetricRankFace = styled.i`
  position: relative;
  display: grid;
  width: 17px;
  height: 17px;
  overflow: hidden;
  place-items: center;
  margin-left: -4px;
  border: 1px solid color-mix(in srgb, ${theme.colors.warning} 72%, ${theme.colors.surface});
  border-radius: 50%;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 7px;
  font-style: normal;
  font-weight: 850;

  &:first-child {
    margin-left: 0;
  }
`;

const MetricRankAvatar = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Controls = styled.div`
  display: flex;
  height: 100%;
  align-items: center;
  gap: ${theme.layout.titleBarControlSpacing};
  padding: 0 ${theme.layout.titleBarControlSpacing};
  border: 0;
  box-shadow: none;
`;

const ControlButton = styled.button`
  --window-control-hover-background: color-mix(
    in srgb,
    ${theme.colors.brandSoft} 78%,
    transparent
  );

  position: relative;
  display: grid;
  width: var(--window-control-size);
  height: var(--window-control-size);
  flex: 0 0 var(--window-control-size);
  place-items: center;
  isolation: isolate;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: ${theme.layout.titleBarControlRadius};
  background: transparent;
  color: ${theme.colors.textSecondary};
  transition: color ${theme.motion.normal};

  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: var(--window-control-hover-background);
    content: "";
    opacity: 0;
    pointer-events: none;
    transition: opacity ${theme.motion.normal};
  }

  & > svg {
    position: relative;
    z-index: 1;
    transition: transform ${theme.motion.spring};
  }

  &:hover {
    color: ${theme.colors.brandDeep};
  }

  &:hover::before {
    opacity: 1;
  }

  &:hover > svg {
    transform: translateY(-1px) scale(1.18);
  }

  &:active > svg {
    transform: translateY(1px) scale(0.78);
    transition-duration: 90ms;
  }

  &[data-kind="close"] {
    --window-control-hover-background: ${theme.colors.dangerSoft};
  }

  &[data-kind="close"]:hover {
    color: ${theme.colors.danger};
  }
`;


interface TitleBarLiveStats {
  /** 当前统计所属的本地长连接会话。 */
  sessionId: number;
  /** 当前统计所属的真实房间号。 */
  roomId: number;
  /** 平台本场累计看过人数。 */
  watchedCount: number | null;
  /** 平台本场累计点赞次数。 */
  likeCount: number | null;
  /** 在累计点赞推送到达前，本机观察到的点赞互动数量。 */
  observedLikeCount: number;
}

function createTitleBarLiveStats(
  sessionId = 0,
  roomId = 0,
): TitleBarLiveStats {
  return {
    sessionId,
    roomId,
    watchedCount: null,
    likeCount: null,
    observedLikeCount: 0,
  };
}

function mergeLiveRoomStats(
  current: TitleBarLiveStats,
  update: LiveRoomStatsUpdate,
): TitleBarLiveStats {
  const base =
    current.sessionId === update.sessionId
      ? current
      : createTitleBarLiveStats(update.sessionId, update.roomId);
  return {
    ...base,
    roomId: update.roomId,
    watchedCount: update.watchedCount ?? base.watchedCount,
    likeCount: update.likeCount ?? base.likeCount,
  };
}

const compactNumber = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatLiveCount(value: number | null) {
  return value === null ? "--" : compactNumber.format(value);
}

function normalizeBilibiliImageUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url.startsWith("https://") ? url : "";
}

function formatOnlineRankTooltip(summary: TitleBarRoomSummary) {
  if (!summary.connected) return "连接直播间后读取在线贡献榜";
  if (summary.onlineRankError) {
    return `在线贡献榜读取失败：${summary.onlineRankError}`;
  }
  if (!summary.onlineCountText) return "正在读取在线贡献榜";
  const podium = summary.onlineRankEntries
    .slice(0, 3)
    .map((entry) => `榜${entry.rank} ${entry.name}`)
    .join(" · ");
  return `在线贡献榜 ${summary.onlineCountText} 人${podium ? ` · ${podium}` : ""}`;
}
export function WindowTitleBar({
  compact = false,
  profile = null,
  roomSummary = null,
}: WindowTitleBarProps) {
  const desktopRuntime = isDesktopRuntime();
  const [maximized, setMaximized] = useState(false);
  const [liveStats, setLiveStats] = useState<TitleBarLiveStats>(
    createTitleBarLiveStats,
  );

  useEffect(() => {
    if (!desktopRuntime || compact) {
      setMaximized(false);
      return;
    }
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      void appWindow.isMaximized().then(setMaximized).catch(() => undefined);
    };
    refresh();
    void appWindow.onResized(refresh).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, [compact, desktopRuntime]);

  useEffect(() => {
    if (!desktopRuntime || compact) {
      setLiveStats(createTitleBarLiveStats());
      return;
    }

    let active = true;
    const unlisteners: UnlistenFn[] = [];
    const subscriptions = [
      listenToLiveRoomStats((update) => {
        if (!active) return;
        setLiveStats((current) => mergeLiveRoomStats(current, update));
      }),
      listenToLiveEvents((event) => {
        if (!active || event.meta !== "点赞") return;
        const sessionId = event.sessionId ?? 0;
        const roomId = event.roomId ?? 0;
        if (sessionId <= 0) return;
        setLiveStats((current) => {
          const base =
            current.sessionId === sessionId
              ? current
              : createTitleBarLiveStats(sessionId, roomId);
          return {
            ...base,
            roomId,
            observedLikeCount: base.observedLikeCount + 1,
          };
        });
      }),
      listenToLiveStatus((status) => {
        if (!active) return;
        setLiveStats((current) => {
          if (
            status.state === "disconnected" &&
            (current.sessionId === 0 || current.sessionId === status.sessionId)
          ) {
            return createTitleBarLiveStats();
          }
          if (
            (status.state === "connecting" || status.state === "connected") &&
            current.sessionId !== status.sessionId
          ) {
            return createTitleBarLiveStats(status.sessionId, status.roomId);
          }
          return current;
        });
      }),
    ];

    void Promise.allSettled(subscriptions).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("bilimaku title bar live stats subscription failed", result.reason);
          continue;
        }
        if (active) unlisteners.push(result.value);
        else result.value();
      }
    });

    return () => {
      active = false;
      unlisteners.forEach((unsubscribe) => unsubscribe());
    };
  }, [compact, desktopRuntime]);

  const minimize = () => {
    if (desktopRuntime) void getCurrentWindow().minimize();
  };
  const toggleMaximize = () => {
    if (!desktopRuntime) return;
    const appWindow = getCurrentWindow();
    void appWindow.toggleMaximize().then(() => appWindow.isMaximized()).then(setMaximized);
  };
  const close = () => {
    if (desktopRuntime) void getCurrentWindow().close();
  };
  const drag = (event: ReactMouseEvent<HTMLElement>) => {
    if (!desktopRuntime || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, [data-no-drag='true']")) return;
    const appWindow = getCurrentWindow();
    if (event.detail === 2) {
      if (!compact) void appWindow.toggleMaximize();
      return;
    }
    void appWindow.startDragging();
  };

  const displayedLikeCount =
    liveStats.likeCount ??
    (liveStats.observedLikeCount > 0 ? liveStats.observedLikeCount : null);

  return (
    <Bar data-compact={compact} data-tauri-drag-region onMouseDown={drag}>
      <DragRegion data-tauri-drag-region>
        {!compact && profile ? (
          <AccountProfileTooltip
            profile={profile}
            roomId={liveStats.roomId}
            watchedCount={liveStats.watchedCount}
            likeCount={displayedLikeCount}
          />
        ) : null}
        {!compact && profile && roomSummary ? (
          <>
            <AvatarDivider aria-hidden="true" />
            <SummaryRail aria-label="直播间实时数据摘要">
              <SummaryMetric
                data-live-metric="true"
                data-kind="watched"
                data-tooltip={liveStats.watchedCount === null
                  ? "等待平台推送本场累计看过人数"
                  : "平台 WATCHED_CHANGE 推送的本场累计看过人数"}
              >
                <MetricLabel>
                  <Icon name="eye" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">看过</MetricLabelText>
                </MetricLabel>
                <MetricValue>{formatLiveCount(liveStats.watchedCount)}</MetricValue>
              </SummaryMetric>
              <SummaryMetric
                data-live-metric="true"
                data-kind="messages"
                data-tooltip="当前会话缓存中的弹幕数量"
              >
                <MetricLabel>
                  <Icon name="message" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">弹幕</MetricLabelText>
                </MetricLabel>
                <MetricValue>{formatLiveCount(roomSummary.messageCount)}</MetricValue>
              </SummaryMetric>
              <SummaryMetric
                data-live-metric="true"
                data-kind="highlighted"
                data-tooltip="当前会话缓存中的礼物、醒目留言与大航海事件"
              >
                <MetricLabel>
                  <Icon name="gift" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">高亮</MetricLabelText>
                </MetricLabel>
                <MetricValue>{formatLiveCount(roomSummary.highlightedCount)}</MetricValue>
              </SummaryMetric>
              <SummaryMetric
                data-live-metric="true"
                data-kind="duration"
                data-tooltip={roomSummary.liveTime
                  ? `本场开播时间（北京时间）${roomSummary.liveTime}`
                  : "连接后读取平台返回的本场开播时间"}
              >
                <MetricLabel>
                  <Icon name="clock" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">时长</MetricLabelText>
                </MetricLabel>
                <MetricValue>{roomSummary.liveDuration}</MetricValue>
              </SummaryMetric>
              <SummaryMetric
                data-live-metric="true"
                data-kind="popularity"
                data-tooltip="平台心跳返回的是人气指标，并非精确在线人数"
              >
                <MetricLabel>
                  <Icon name="flame" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">人气</MetricLabelText>
                </MetricLabel>
                <MetricValue>
                  {roomSummary.hasLiveContext
                    ? formatLiveCount(roomSummary.popularity)
                    : "--"}
                </MetricValue>
              </SummaryMetric>
              <SummaryMetric
                data-live-metric="true"
                data-kind="online"
                data-tooltip={formatOnlineRankTooltip(roomSummary)}
              >
                <MetricLabel>
                  <Icon name="users" size={theme.titleBar.metricIconSizePx} />
                  <MetricLabelText data-metric-label-text="true">在线榜</MetricLabelText>
                </MetricLabel>
                <MetricValue>
                  {roomSummary.connected ? roomSummary.onlineCountText ?? "--" : "--"}
                </MetricValue>
                {roomSummary.onlineRankEntries.length > 0 ? (
                  <MetricRankFaces data-rank-faces="true" aria-label="在线贡献榜前三名">
                    {roomSummary.onlineRankEntries.slice(0, 3).map((entry) => {
                      const avatarUrl = normalizeBilibiliImageUrl(entry.avatar);
                      return (
                        <MetricRankFace key={entry.userId} aria-label={`榜${entry.rank} ${entry.name}`}>
                          {entry.name.slice(0, 1) || String(entry.rank)}
                          {avatarUrl ? (
                            <MetricRankAvatar
                              src={avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                        </MetricRankFace>
                      );
                    })}
                  </MetricRankFaces>
                ) : null}
              </SummaryMetric>
            </SummaryRail>
          </>
        ) : null}
      </DragRegion>

      <Controls data-no-drag="true">
        <ControlButton type="button" aria-label="最小化" data-tooltip="最小化" onClick={minimize}>
          <Icon
            name="minimize"
            size={theme.layout.titleBarControlIconSizePx}
          />
        </ControlButton>
        {compact ? null : (
          <ControlButton
            type="button"
            aria-label={maximized ? "还原窗口" : "最大化"}
            data-tooltip={maximized ? "还原窗口" : "最大化"}
            onClick={toggleMaximize}
          >
            <Icon
              name={maximized ? "restore" : "maximize"}
              size={theme.layout.titleBarControlIconSizePx}
            />
          </ControlButton>
        )}
        <ControlButton type="button" data-kind="close" aria-label="关闭" data-tooltip="关闭" onClick={close}>
          <Icon
            name="close"
            size={theme.layout.titleBarControlIconSizePx}
          />
        </ControlButton>
      </Controls>
    </Bar>
  );
}
