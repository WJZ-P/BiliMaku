import { styled } from "@linaria/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  finalizeSidebarOverlayPosition,
  hexToRgba,
} from "../../services/overlays";
import type { LiveEvent } from "../../types/events";
import type { SidebarOverlaySettings } from "../../types/overlay";
import { useOverlayEvents, useOverlaySettings } from "./useOverlayRuntime";

/** 原生窗口停止上报移动后，判定一次拖拽已经结束的静默时间。 */
const OVERLAY_DRAG_SETTLE_MS = 120;

const Canvas = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: transparent;
  user-select: none;

  &[data-editing="true"] {
    cursor: move;
  }
`;

const Feed = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  padding: 10px;
  pointer-events: none;

  &[data-vertical-alignment="top"] {
    justify-content: flex-start;
  }

  &[data-vertical-alignment="bottom"] {
    justify-content: flex-end;
  }

  &[data-editing="true"] {
    pointer-events: auto;
  }
`;

/**
 * 通过 0fr -> 1fr 的轨道展开让相邻消息自然滚动，而不是在 DOM 插入时瞬移。
 * 动画时长来自侧边事件栏设置，退出时会以相反方向折叠。
 */
const RowLayout = styled.div`
  display: grid;
  min-width: 0;
  grid-template-rows: minmax(0, 1fr);
  animation: bilimaku-sidebar-row-layout-in var(--row-scroll-duration, 720ms)
    cubic-bezier(0.2, 0.82, 0.22, 1) both;

  @keyframes bilimaku-sidebar-row-layout-in {
    from {
      grid-template-rows: minmax(0, 0fr);
    }
    to {
      grid-template-rows: minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const RowClip = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: clip;
  padding-top: 7px;
`;

/**
 * 事件行不再绘制边框、类型 Tag、UID 和时间，仅保留头像与一句事件文本。
 * 低透明度横向渐隐底色只负责保证复杂直播画面上的可读性，不形成卡片边框感。
 */
const EventRow = styled.article`
  --event-accent: #78f0c0;
  --row-background: rgba(13, 29, 47, 0.32);
  --row-blur: 12px;
  --row-radius: 5px;

  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 42px;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  padding: 6px 10px 6px 7px;
  border: 0;
  border-radius: var(--row-radius);
  background: linear-gradient(
    90deg,
    var(--row-background) 0%,
    color-mix(in srgb, var(--row-background) 76%, transparent) 72%,
    transparent 100%
  );
  box-shadow: 0 5px 18px rgba(1, 10, 22, 0.1);
  backdrop-filter: blur(var(--row-blur)) saturate(1.08);
  pointer-events: none;
  will-change: transform, opacity, filter;

  &[data-avatar="false"] {
    grid-template-columns: minmax(0, 1fr);
    min-height: 34px;
    padding-left: 9px;
  }
`;

const Avatar = styled.div`
  display: grid;
  width: 32px;
  height: 32px;
  overflow: hidden;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--event-accent) 32%, rgba(7, 20, 35, 0.82));
  color: white;
  font-size: 11px;
  font-weight: 850;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Sentence = styled.div`
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.42;
  overflow-wrap: anywhere;
`;

const User = styled.strong`
  color: var(--username-color, #66ccff);
  font-size: 0.96em;
  font-weight: 850;
`;

const EventText = styled.span`
  color: color-mix(in srgb, currentColor 88%, transparent);
  font-size: 0.9em;
  font-weight: 550;
`;

const EditFrame = styled.div`
  position: absolute;
  z-index: 20;
  inset: 0;
  border: 2px solid rgba(78, 161, 255, 0.92);
  background:
    linear-gradient(90deg, rgba(78, 161, 255, 0.16), transparent 34%) top left / 100% 1px no-repeat,
    linear-gradient(0deg, rgba(78, 161, 255, 0.1), transparent 40%) bottom left / 1px 100% no-repeat;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.46),
    inset 0 0 28px rgba(78, 161, 255, 0.08);
  pointer-events: none;
`;

const EditCaption = styled.div`
  position: absolute;
  z-index: 21;
  top: 8px;
  left: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  background: rgba(10, 27, 48, 0.78);
  color: rgba(239, 248, 255, 0.96);
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.02em;
  box-shadow: 0 5px 16px rgba(3, 15, 31, 0.2);
  backdrop-filter: blur(12px) saturate(1.2);
  pointer-events: none;
`;

function normalizeAvatar(value: string) {
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : "";
}

function eventSeparator(type: LiveEvent["type"]) {
  return type === "message" || type === "superchat" ? "：" : " ";
}

interface SidebarRowProps {
  event: LiveEvent;
  settings: SidebarOverlaySettings;
  onDone: (id: string) => void;
}

function SidebarRow({ event, settings, onDone }: SidebarRowProps) {
  const ref = useRef<HTMLElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const avatar = normalizeAvatar(event.avatar);

  useLayoutEffect(() => {
    const element = ref.current;
    const layout = layoutRef.current;
    if (!element || !layout) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const entryOffsetY = settings.entryDirection === "bottom"
      ? settings.slideDistance
      : -settings.slideDistance;
    const enterDuration = reduceMotion ? 0 : settings.enterDurationMs;
    const exitDuration = reduceMotion ? 0 : settings.exitDurationMs;
    const scrollDuration = reduceMotion ? 0 : settings.scrollDurationMs;
    const enter = element.animate(
      [
        {
          opacity: 0,
          filter: "blur(6px)",
          transform: `translate3d(0, ${entryOffsetY}px, 0) scale(.975)`,
        },
        {
          opacity: 1,
          filter: "blur(0)",
          offset: 0.74,
          transform: `translate3d(0, ${-Math.sign(entryOffsetY) * 3}px, 0) scale(1.006)`,
        },
        { opacity: 1, filter: "blur(0)", transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      {
        duration: enterDuration,
        easing: "cubic-bezier(.18,.84,.24,1)",
        fill: "forwards",
      },
    );
    const visibleMs = Math.max(
      500,
      settings.lifetimeSeconds * 1_000
        - enterDuration
        - Math.max(exitDuration, scrollDuration),
    );
    let exit: Animation | undefined;
    let collapse: Animation | undefined;
    const timer = window.setTimeout(() => {
      exit = element.animate(
        [
          { opacity: 1, filter: "blur(0)", transform: "translate3d(0, 0, 0) scale(1)" },
          {
            opacity: 0,
            filter: "blur(4px)",
            transform: `translate3d(0, ${-Math.sign(entryOffsetY) * 8}px, 0) scale(.985)`,
          },
        ],
        {
          duration: exitDuration,
          easing: "cubic-bezier(.55,.06,.68,.19)",
          fill: "forwards",
        },
      );
      collapse = layout.animate(
        [
          { gridTemplateRows: "minmax(0, 1fr)" },
          { gridTemplateRows: "minmax(0, 0fr)" },
        ],
        {
          duration: scrollDuration,
          easing: "cubic-bezier(.4,0,.68,.28)",
          fill: "forwards",
        },
      );
      void Promise.all([exit.finished, collapse.finished])
        .then(() => onDone(event.id))
        .catch(() => undefined);
    }, enterDuration + visibleMs);
    return () => {
      enter.cancel();
      exit?.cancel();
      collapse?.cancel();
      window.clearTimeout(timer);
    };
  }, [
    event.id,
    onDone,
    settings.enterDurationMs,
    settings.entryDirection,
    settings.exitDurationMs,
    settings.lifetimeSeconds,
    settings.scrollDurationMs,
    settings.slideDistance,
  ]);

  const accent = settings.colors[event.type];
  const style = {
    color: settings.textColor,
    "--event-accent": accent,
    "--username-color": settings.usernameColor,
    "--row-background": hexToRgba(
      settings.backgroundColor,
      Math.min(0.46, settings.cardOpacity * 0.46),
    ),
    "--row-blur": `${settings.blur}px`,
    "--row-radius": `${Math.min(settings.radius, 6)}px`,
  } as CSSProperties;
  const layoutStyle = {
    "--row-scroll-duration": `${Math.max(0, settings.scrollDurationMs)}ms`,
  } as CSSProperties;

  return (
    <RowLayout ref={layoutRef} style={layoutStyle}>
      <RowClip>
        <EventRow ref={ref} style={style} data-avatar={settings.showAvatar}>
          {settings.showAvatar ? (
            <Avatar>
              {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : event.user.slice(0, 1)}
            </Avatar>
          ) : null}
          <Sentence>
            <User>{event.user}</User>
            <EventText>{eventSeparator(event.type)}{event.content}</EventText>
          </Sentence>
        </EventRow>
      </RowClip>
    </RowLayout>
  );
}

export function EventSidebarOverlayWindow() {
  const { sidebar: settings } = useOverlaySettings();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const dragging = useRef(false);
  const finalizingPosition = useRef(false);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const receive = useCallback((event: LiveEvent) => {
    if (!settings.enabledEventTypes.includes(event.type)) return;
    setEvents((current) => {
      const filtered = current.filter((item) => item.id !== event.id);
      const maximum = Math.max(1, Math.floor(settings.maxEvents));
      // 内部始终保持旧 -> 新的时间顺序，渲染时再根据停靠位置决定展示方向。
      return [...filtered, event].slice(-maximum);
    });
  }, [settings]);

  useOverlayEvents(receive);

  const remove = useCallback((id: string) => {
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);

  const clearDragSettleTimer = useCallback(() => {
    if (dragSettleTimer.current === null) return;
    clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = null;
  }, []);

  const finishDragging = useCallback(async () => {
    if (!dragging.current || finalizingPosition.current) return;
    dragging.current = false;
    clearDragSettleTimer();
    finalizingPosition.current = true;
    try {
      await finalizeSidebarOverlayPosition();
    } catch (error) {
      console.error("收回超出显示器的侧边悬浮窗失败", error);
    } finally {
      finalizingPosition.current = false;
    }
  }, [clearDragSettleTimer]);

  const scheduleDragFinish = useCallback(() => {
    clearDragSettleTimer();
    // Tauri 的原生拖动调用只表示操作已排入窗口线程，并不代表鼠标已经松开。
    // 原生 moved 事件停止一小段时间后再收边，可兼容 WebView 收不到 pointerup 的情况。
    dragSettleTimer.current = setTimeout(() => {
      void finishDragging();
    }, OVERLAY_DRAG_SETTLE_MS);
  }, [clearDragSettleTimer, finishDragging]);

  useEffect(() => {
    if (!settings.editMode) {
      void finishDragging();
      return;
    }

    let disposed = false;
    let unlistenMoved: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    const completeOnPointerRelease = () => {
      void finishDragging();
    };

    window.addEventListener("pointerup", completeOnPointerRelease, true);
    window.addEventListener("pointercancel", completeOnPointerRelease, true);
    void appWindow.onMoved(() => {
      if (!disposed && dragging.current && !finalizingPosition.current) {
        scheduleDragFinish();
      }
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenMoved = unlisten;
      }
    }).catch((error) => {
      console.error("监听侧边悬浮窗移动失败", error);
    });

    return () => {
      disposed = true;
      unlistenMoved?.();
      window.removeEventListener("pointerup", completeOnPointerRelease, true);
      window.removeEventListener("pointercancel", completeOnPointerRelease, true);
      clearDragSettleTimer();
    };
  }, [clearDragSettleTimer, finishDragging, scheduleDragFinish, settings.editMode]);

  const beginDragging = useCallback(async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!settings.editMode || event.button !== 0 || dragging.current) return;
    event.preventDefault();
    dragging.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 原生窗口拖动仍由 moved 事件兜底，不依赖 WebView 指针捕获一定成功。
    }
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      dragging.current = false;
      clearDragSettleTimer();
      console.error("拖动侧边悬浮窗失败", error);
    }
  }, [clearDragSettleTimer, settings.editMode]);

  const displayEvents = useMemo(
    () => settings.verticalAlignment === "top" ? [...events].reverse() : events,
    [events, settings.verticalAlignment],
  );

  const feedStyle: CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    color: settings.textColor,
  };

  return (
    <Canvas
      data-editing={settings.editMode}
      onPointerDown={beginDragging}
      onPointerUp={() => void finishDragging()}
      onPointerCancel={() => void finishDragging()}
    >
      <Feed
        style={feedStyle}
        data-editing={settings.editMode}
        data-vertical-alignment={settings.verticalAlignment}
        aria-live="polite"
      >
        {displayEvents.map((event) => (
          <SidebarRow
            key={event.id}
            event={event}
            settings={settings}
            onDone={remove}
          />
        ))}
      </Feed>
      {settings.editMode ? (
        <>
          <EditFrame />
          <EditCaption>拖动定位 · {settings.width} × {settings.height}</EditCaption>
        </>
      ) : null}
    </Canvas>
  );
}
