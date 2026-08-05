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
  display: flex;
  overflow: hidden;
  flex-direction: column;
  background: transparent;
`;

const Shell = styled.section`
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: white;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
`;

const Header = styled.header`
  display: flex;
  min-height: 50px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: move;
`;

const HeaderTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
`;

const LiveBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 8px;

  &::before {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #55e2b0;
    box-shadow: 0 0 10px rgba(85, 226, 176, 0.8);
    content: "";
  }
`;

const Feed = styled.div`
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  padding: 12px;
`;

const EventCard = styled.article`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid currentColor;
  will-change: transform, opacity;

  &[data-avatar="false"] {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Avatar = styled.div`
  display: grid;
  width: 34px;
  height: 34px;
  overflow: hidden;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.13);
  color: white;
  font-size: 11px;
  font-weight: 800;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const EventTop = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
`;

const User = styled.strong`
  overflow: hidden;
  color: inherit;
  font-size: 0.92em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EventType = styled.span`
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.63em;
  font-weight: 800;
`;

const UserId = styled.span`
  flex: 0 0 auto;
  color: color-mix(in srgb, currentColor 48%, transparent);
  font-family: Consolas, monospace;
  font-size: 0.6em;
`;

const Content = styled.div`
  display: -webkit-box;
  overflow: hidden;
  margin-top: 4px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: color-mix(in srgb, currentColor 84%, transparent);
  font-size: 0.84em;
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

interface SidebarCardProps {
  event: LiveEvent;
  settings: SidebarOverlaySettings;
  onDone: (id: string) => void;
}

function SidebarCard({ event, settings, onDone }: SidebarCardProps) {
  const ref = useRef<HTMLElement>(null);
  const avatar = normalizeAvatar(event.avatar);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const direction = settings.side === "right"
      ? settings.slideDistance
      : -settings.slideDistance;
    const enter = element.animate(
      [
        { opacity: 0, transform: `translate3d(${direction}px, 0, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: settings.enterDurationMs, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    );
    const visibleMs = Math.max(
      500,
      settings.lifetimeSeconds * 1_000 - settings.enterDurationMs - settings.exitDurationMs,
    );
    const timer = window.setTimeout(() => {
      const exit = element.animate(
        [
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
          { opacity: 0, transform: `translate3d(${direction}px, -6px, 0)` },
        ],
        { duration: settings.exitDurationMs, easing: "ease-in", fill: "forwards" },
      );
      exit.onfinish = () => onDone(event.id);
    }, settings.enterDurationMs + visibleMs);
    return () => {
      enter.cancel();
      window.clearTimeout(timer);
    };
  }, [event.id, onDone, settings]);

  const accent = settings.colors[event.type];
  const style: CSSProperties = {
    color: settings.textColor,
    borderLeftColor: accent,
    borderRadius: settings.radius,
    background: hexToRgba(settings.backgroundColor, settings.cardOpacity),
  };

  return (
    <EventCard ref={ref} style={style} data-avatar={settings.showAvatar}>
      {settings.showAvatar ? (
        <Avatar>
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : event.user.slice(0, 1)}
        </Avatar>
      ) : null}
      <div>
        <EventTop>
          <User>{event.user}</User>
          <EventType>{typeLabel(event)}</EventType>
          {settings.showUserId && event.userId ? <UserId>UID {event.userId}</UserId> : null}
        </EventTop>
        <Content>{event.content}</Content>
      </div>
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

  const shellStyle: CSSProperties = {
    margin: 8,
    borderRadius: settings.radius + 4,
    background: hexToRgba(settings.backgroundColor, settings.backgroundOpacity),
    backdropFilter: `blur(${settings.blur}px)`,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    color: settings.textColor,
  };

  return (
    <Canvas>
      <Shell style={shellStyle}>
        <Header data-tauri-drag-region={!settings.clickThrough || undefined}>
          <HeaderTitle>BiliCast 实时事件</HeaderTitle>
          <LiveBadge>LIVE</LiveBadge>
        </Header>
        <Feed>
          {events.map((event) => (
            <SidebarCard key={event.id} event={event} settings={settings} onDone={remove} />
          ))}
        </Feed>
      </Shell>
    </Canvas>
  );
}
