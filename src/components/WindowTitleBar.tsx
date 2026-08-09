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
import { theme } from "../styles/theme";
import type { AccountProfile } from "../types/account";
import type { LiveRoomStatsUpdate } from "../types/events";

interface WindowTitleBarProps {
  /** 登录窗口隐藏账号区和数据摘要，只保留可拖拽区域与窗口按钮。 */
  compact?: boolean;
  /** 当前已登录账号资料；工作台标题栏用它绘制头像经验环。 */
  profile?: AccountProfile | null;
}

const Bar = styled.header`
  --window-control-size: ${theme.layout.titleBarControlSize};

  position: fixed;
  z-index: 1000;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  height: ${theme.layout.titleBarHeight};
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 8px;
  border-bottom: 1px solid color-mix(in srgb, ${theme.colors.border} 78%, transparent);
  background: color-mix(in srgb, ${theme.colors.surface} 72%, transparent);
  box-shadow: none;
  user-select: none;
  backdrop-filter: blur(26px) saturate(1.42);
  -webkit-backdrop-filter: blur(26px) saturate(1.42);

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
  gap: 6px;
  overflow: hidden;
`;

const AvatarDivider = styled.span`
  width: 2px;
  height: 40px;
  flex: 0 0 2px;
  margin: 0 8px 0 6px;
  background: ${theme.colors.borderStrong};
`;
const SummaryRail = styled.div`
  display: flex;
  min-width: 0;
  height: ${theme.titleBar.metricHeightPx}px;
  flex: 0 1 auto;
  align-items: stretch;
  gap: 0;
  border: 2px solid ${theme.colors.borderStrong};
  background: color-mix(in srgb, ${theme.colors.surface} 38%, transparent);

  @media (max-width: 760px) {
    [data-live-metric="true"] {
      display: none;
    }
  }

  @media (max-width: 520px) {
    display: none;
  }
`;
/** 标题栏实时数据轨：硬边、无浮层阴影，Hover 只保留底色扫描反馈。 */
const SummaryMetric = styled.div`
  --metric-accent: ${theme.colors.brand};
  position: relative;
  display: grid;
  height: 100%;
  min-width: ${theme.titleBar.metricMinWidthPx}px;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  overflow: hidden;
  padding: 0 11px;
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

  &[data-kind="coins"] {
    --metric-accent: ${theme.colors.warning};
    min-width: 94px;
  }

  &[data-kind="watched"] {
    --metric-accent: ${theme.colors.cyan};
  }

  &[data-kind="likes"] {
    --metric-accent: ${theme.colors.brand};
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

const Controls = styled.div`
  display: flex;
  height: 100%;
  align-items: center;
  gap: 0;
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
  border-radius: 0;
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
const coinNumber = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});


function formatLiveCount(value: number | null) {
  return value === null ? "--" : compactNumber.format(value);
}

export function WindowTitleBar({
  compact = false,
  profile = null,
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
  const watchedTooltip =
    liveStats.watchedCount === null
      ? "等待平台 WATCHED_CHANGE 推送本场累计看过人数"
      : "平台长链推送的本场累计看过人数";
  const likesTooltip =
    liveStats.likeCount !== null
      ? "平台长链推送的本场累计点赞次数"
      : liveStats.observedLikeCount > 0
        ? "累计点赞推送尚未到达，暂显示本机观察到的点赞互动"
        : "等待平台 LIKE_INFO_V3_UPDATE 推送本场累计点赞";

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
        {!compact && profile ? (
          <SummaryRail aria-label="账号与本场直播数据摘要">
            <AvatarDivider aria-hidden="true" />
            <SummaryMetric data-kind="coins" data-tooltip="主站账号硬币余额">
              <MetricLabel>
                <Icon name="coin" size={theme.titleBar.metricIconSizePx} />
                硬币
              </MetricLabel>
              <MetricValue>{coinNumber.format(profile.coins)}</MetricValue>
            </SummaryMetric>
            <SummaryMetric
              data-live-metric="true"
              data-kind="watched"
              data-tooltip={watchedTooltip}
            >
              <MetricLabel>
                <Icon name="users" size={theme.titleBar.metricIconSizePx} />
                本场看过
              </MetricLabel>
              <MetricValue>{formatLiveCount(liveStats.watchedCount)}</MetricValue>
            </SummaryMetric>
            <SummaryMetric
              data-live-metric="true"
              data-kind="likes"
              data-tooltip={likesTooltip}
            >
              <MetricLabel>
                <Icon name="like" size={theme.titleBar.metricIconSizePx} />
                本场点赞
              </MetricLabel>
              <MetricValue>{formatLiveCount(displayedLikeCount)}</MetricValue>
            </SummaryMetric>
          </SummaryRail>
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
