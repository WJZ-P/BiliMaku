import { styled } from "@linaria/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LiveEvent } from "../../types/events";
import type { DanmakuOverlaySettings } from "../../types/overlay";
import { useOverlayEvents, useOverlaySettings } from "./useOverlayRuntime";

const Layer = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: transparent;
  pointer-events: none;
  user-select: none;
`;

const Bullet = styled.div`
  position: absolute;
  left: 0;
  display: inline-flex;
  width: max-content;
  max-width: 72vw;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
  will-change: transform, opacity;
`;

const Avatar = styled.img`
  width: 1.25em;
  height: 1.25em;
  flex: 0 0 auto;
  border: 2px solid rgba(255, 255, 255, 0.75);
  border-radius: 50%;
  object-fit: cover;
`;

const Text = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface BulletItem {
  id: string;
  event: LiveEvent;
  lane: number;
}

interface ScrollingBulletProps {
  item: BulletItem;
  settings: DanmakuOverlaySettings;
  onDone: (id: string) => void;
}

function eventText(event: LiveEvent, showUsername: boolean) {
  if (!showUsername) return event.content;
  if (event.type === "message") return `${event.user}：${event.content}`;
  return `${event.user} ${event.content}`;
}

function avatarUrl(value: string) {
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : "";
}

function ScrollingBullet({ item, settings, onDone }: ScrollingBulletProps) {
  const ref = useRef<HTMLDivElement>(null);
  const laneHeight = settings.fontSize * 1.35 + settings.laneGap;
  const availableHeight = window.innerHeight
    * Math.max(0.05, (settings.verticalEndPercent - settings.verticalStartPercent) / 100);
  const top = (window.innerHeight * settings.verticalStartPercent) / 100
    + (item.lane * laneHeight) % Math.max(laneHeight, availableHeight);
  const color = settings.colors[item.event.type];
  const avatar = avatarUrl(item.event.avatar);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const width = element.getBoundingClientRect().width;
    const start = window.innerWidth + 32;
    const end = -width - 32;
    const travel = start - end;
    const duration = settings.motionMode === "speed"
      ? Math.max(1_200, (travel / Math.max(1, settings.speedPixelsPerSecond)) * 1_000)
      : settings.durationSeconds * 1_000;
    const enterOffset = Math.min(0.45, settings.enterDurationMs / duration);
    const exitOffset = Math.max(enterOffset + 0.05, 1 - settings.exitDurationMs / duration);
    const positionAt = (offset: number) => start - travel * offset;
    const animation = element.animate(
      [
        { transform: `translate3d(${start}px, 0, 0)`, opacity: 0, offset: 0 },
        {
          transform: `translate3d(${positionAt(enterOffset)}px, 0, 0)`,
          opacity: settings.opacity,
          offset: enterOffset,
        },
        {
          transform: `translate3d(${positionAt(exitOffset)}px, 0, 0)`,
          opacity: settings.opacity,
          offset: exitOffset,
        },
        { transform: `translate3d(${end}px, 0, 0)`, opacity: 0, offset: 1 },
      ],
      { duration, easing: "linear", fill: "forwards" },
    );
    animation.onfinish = () => onDone(item.id);
    return () => animation.cancel();
  }, [item.id, onDone, settings]);

  const style: CSSProperties = {
    top,
    color,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    WebkitTextStroke: `${settings.outlineWidth}px ${settings.outlineColor}`,
    paintOrder: "stroke fill",
    textShadow: `0 2px ${settings.shadowBlur}px ${settings.shadowColor}`,
  };

  return (
    <Bullet ref={ref} style={style}>
      {settings.showAvatar && avatar ? (
        <Avatar src={avatar} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <Text>{eventText(item.event, settings.showUsername)}</Text>
    </Bullet>
  );
}

export function DanmakuOverlayWindow() {
  const { danmaku: settings } = useOverlaySettings();
  const [items, setItems] = useState<BulletItem[]>([]);
  const laneCursor = useRef(0);

  const receive = useCallback((event: LiveEvent) => {
    if (!settings.enabledEventTypes.includes(event.type)) return;
    const laneHeight = settings.fontSize * 1.35 + settings.laneGap;
    const available = window.innerHeight
      * Math.max(0.05, (settings.verticalEndPercent - settings.verticalStartPercent) / 100);
    const laneCount = Math.max(1, Math.floor(available / laneHeight));
    const lane = laneCursor.current % laneCount;
    laneCursor.current += 1;
    const item: BulletItem = {
      id: `${event.id}-${performance.now()}`,
      event,
      lane,
    };
    setItems((current) => [...current, item].slice(-settings.maxVisible));
  }, [settings]);

  useOverlayEvents(receive);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <Layer>
      {items.map((item) => (
        <ScrollingBullet key={item.id} item={item} settings={settings} onDone={remove} />
      ))}
    </Layer>
  );
}
