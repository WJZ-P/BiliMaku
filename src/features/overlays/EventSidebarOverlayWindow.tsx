import { styled } from "@linaria/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { hexToRgba } from "../../services/overlays";
import type { LiveEvent } from "../../types/events";
import type { SidebarOverlaySettings } from "../../types/overlay";
import { useOverlayEvents, useOverlaySettings } from "./useOverlayRuntime";

const Canvas = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: transparent;
`;

const Feed = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 9px;
  overflow: hidden;
  padding: 12px;
  pointer-events: none;

  &[data-interactive="true"] {
    pointer-events: auto;
  }
`;

const EventCard = styled.article`
  --event-accent: #78f0c0;
  --bubble-background: rgba(13, 29, 47, 0.9);
  --bubble-blur: 12px;
  --bubble-radius: 8px;

  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 11px;
  overflow: hidden;
  padding: 10px 12px 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--bubble-radius);
  background: var(--bubble-background);
  box-shadow:
    0 9px 26px rgba(1, 10, 22, 0.24),
    inset 0 1px rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(var(--bubble-blur)) saturate(1.12);
  will-change: transform, opacity, filter;

  &::before {
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--event-accent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--event-accent) 68%, transparent);
    content: "";
  }

  &::after {
    position: absolute;
    z-index: -1;
    top: 0;
    right: 0;
    left: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--event-accent) 55%, transparent),
      rgba(255, 255, 255, 0.2),
      transparent 78%
    );
    content: "";
  }

  &[data-avatar="false"] {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Avatar = styled.div`
  display: grid;
  width: 35px;
  height: 35px;
  overflow: hidden;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--event-accent) 44%, rgba(255, 255, 255, 0.16));
  border-radius: 7px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.16), transparent),
    color-mix(in srgb, var(--event-accent) 22%, rgba(7, 20, 35, 0.88));
  color: white;
  font-size: 11px;
  font-weight: 850;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const EventBody = styled.div`
  min-width: 0;
`;

const EventTop = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
`;

const User = styled.strong`
  overflow: hidden;
  min-width: 0;
  color: inherit;
  font-size: 0.92em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EventType = styled.span`
  flex: 0 0 auto;
  padding: 2px 5px;
  border: 1px solid color-mix(in srgb, var(--event-accent) 36%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--event-accent) 16%, transparent);
  color: color-mix(in srgb, var(--event-accent) 80%, white);
  font-size: 0.62em;
  font-weight: 850;
  letter-spacing: 0.02em;
`;

const UserId = styled.span`
  flex: 0 0 auto;
  color: color-mix(in srgb, currentColor 48%, transparent);
  font-family: Consolas, monospace;
  font-size: 0.6em;
`;

const Time = styled.time`
  flex: 0 0 auto;
  margin-left: auto;
  color: color-mix(in srgb, currentColor 42%, transparent);
  font-family: Consolas, monospace;
  font-size: 0.58em;
  font-weight: 500;
`;

const Content = styled.div`
  display: -webkit-box;
  overflow: hidden;
  margin-top: 4px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: color-mix(in srgb, currentColor 84%, transparent);
  font-size: 0.84em;
  font-weight: 500;
  line-height: 1.5;
`;

function normalizeAvatar(value: string) {
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : "";
}

function typeLabel(event: LiveEvent) {
  if (event.meta) return event.meta;
  return {
    message: "弹幕",
    interaction: "互动",
    gift: "礼物",
    superchat: "SC",
    guard: "大航海",
    system: "系统",
  }[event.type];
}

function eventTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

interface SidebarCardProps {
  event: LiveEvent;
  settings: SidebarOverlaySettings;
  onDone: (id: string) => void;
}

function SidebarCard({ event, settings, onDone }: SidebarCardProps) {
  const ref = useRef<HTMLElement>(null);
  const timestampRef = useRef(event.emittedAt ?? Date.now());
  const avatar = normalizeAvatar(event.avatar);
  const timestamp = timestampRef.current;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = settings.side === "right"
      ? settings.slideDistance
      : -settings.slideDistance;
    const enterDuration = reduceMotion ? 0 : settings.enterDurationMs;
    const exitDuration = reduceMotion ? 0 : settings.exitDurationMs;
    const enter = element.animate(
      [
        {
          opacity: 0,
          filter: "blur(7px)",
          transform: `translate3d(${direction}px, 7px, 0) scale(.965)`,
        },
        {
          opacity: 1,
          filter: "blur(0)",
          offset: 0.72,
          transform: `translate3d(${-Math.sign(direction) * 3}px, 0, 0) scale(1.008)`,
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
      settings.lifetimeSeconds * 1_000 - enterDuration - exitDuration,
    );
    let exit: Animation | undefined;
    const timer = window.setTimeout(() => {
      exit = element.animate(
        [
          { opacity: 1, filter: "blur(0)", transform: "translate3d(0, 0, 0) scale(1)" },
          {
            opacity: 0,
            filter: "blur(5px)",
            transform: `translate3d(${direction * 0.72}px, -8px, 0) scale(.98)`,
          },
        ],
        {
          duration: exitDuration,
          easing: "cubic-bezier(.55,.06,.68,.19)",
          fill: "forwards",
        },
      );
      void exit.finished.then(() => onDone(event.id)).catch(() => undefined);
    }, enterDuration + visibleMs);
    return () => {
      enter.cancel();
      exit?.cancel();
      window.clearTimeout(timer);
    };
  }, [event.id, onDone, settings]);

  const accent = settings.colors[event.type];
  const style = {
    color: settings.textColor,
    "--event-accent": accent,
    "--bubble-background": hexToRgba(settings.backgroundColor, settings.cardOpacity),
    "--bubble-blur": `${settings.blur}px`,
    "--bubble-radius": `${settings.radius}px`,
  } as CSSProperties;

  return (
    <EventCard ref={ref} style={style} data-avatar={settings.showAvatar}>
      {settings.showAvatar ? (
        <Avatar>
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : event.user.slice(0, 1)}
        </Avatar>
      ) : null}
      <EventBody>
        <EventTop>
          <User>{event.user}</User>
          <EventType>{typeLabel(event)}</EventType>
          {settings.showUserId && event.userId ? <UserId>UID {event.userId}</UserId> : null}
          <Time dateTime={new Date(timestamp).toISOString()}>{eventTime(timestamp)}</Time>
        </EventTop>
        <Content>{event.content}</Content>
      </EventBody>
    </EventCard>
  );
}

export function EventSidebarOverlayWindow() {
  const { sidebar: settings } = useOverlaySettings();
  const [events, setEvents] = useState<LiveEvent[]>([]);

  const receive = useCallback((event: LiveEvent) => {
    if (!settings.enabledEventTypes.includes(event.type)) return;
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]
      .slice(0, settings.maxEvents));
  }, [settings]);

  useOverlayEvents(receive);

  const remove = useCallback((id: string) => {
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);

  const feedStyle: CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    color: settings.textColor,
  };

  return (
    <Canvas>
      <Feed
        style={feedStyle}
        data-interactive={!settings.clickThrough}
        data-tauri-drag-region={!settings.clickThrough || undefined}
        aria-live="polite"
      >
        {events.map((event) => (
          <SidebarCard key={event.id} event={event} settings={settings} onDone={remove} />
        ))}
      </Feed>
    </Canvas>
  );
}
