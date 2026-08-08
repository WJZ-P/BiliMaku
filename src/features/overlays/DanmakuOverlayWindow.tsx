import { styled } from "@linaria/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LiveEvent } from "../../types/events";
import type { DanmakuOverlaySettings } from "../../types/overlay";
import {
  createDanmakuLaneLayout,
  selectTopPriorityLane,
} from "./danmakuLaneManager";
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

const Username = styled.strong`
  font-weight: inherit;
`;

interface BulletItem {
  id: string;
  event: LiveEvent;
  lane: number;
  /** 入口在该时间后允许同速弹幕复用。 */
  laneReusableAt: number;
}

interface ScrollingBulletProps {
  item: BulletItem;
  settings: DanmakuOverlaySettings;
  onLaneReusable: (id: string, reusableAt: number) => void;
  onDone: (id: string) => void;
}

function eventSeparator(type: LiveEvent["type"]) {
  return type === "message" || type === "superchat" ? "：" : " ";
}

function avatarUrl(value: string) {
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : "";
}

function ScrollingBullet({
  item,
  settings,
  onLaneReusable,
  onDone,
}: ScrollingBulletProps) {
  const ref = useRef<HTMLDivElement>(null);
  const laneLayout = createDanmakuLaneLayout(settings, window.innerHeight);
  const top = laneLayout.topForLane(item.lane);
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
    const actualPixelsPerSecond = travel / Math.max(0.001, duration / 1_000);
    const reusableAt = settings.motionMode === "speed"
      ? performance.now() + ((width + 64) / actualPixelsPerSecond) * 1_000
      : Number.POSITIVE_INFINITY;
    onLaneReusable(item.id, reusableAt);
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
  }, [item.id, onDone, onLaneReusable, settings]);

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
      <Text>
        {settings.showUsername ? (
          <>
            <Username style={{ color: settings.usernameColor }}>{item.event.user}</Username>
            {eventSeparator(item.event.type)}
          </>
        ) : null}
        {item.event.content}
      </Text>
    </Bullet>
  );
}

export function DanmakuOverlayWindow() {
  const { danmaku: settings } = useOverlaySettings();
  const [items, setItems] = useState<BulletItem[]>([]);

  const receive = useCallback((event: LiveEvent) => {
    if (!settings.enabledEventTypes.includes(event.type)) return;
    const { laneCount } = createDanmakuLaneLayout(settings, window.innerHeight);
    const capacity = Math.max(1, Math.floor(settings.maxVisible));

    setItems((current) => {
      const retainedLimit = capacity - 1;
      const retained = retainedLimit > 0 ? current.slice(-retainedLimit) : [];
      const now = performance.now();
      const lane = selectTopPriorityLane(retained, laneCount, now);
      const item: BulletItem = {
        id: `${event.id}-${now}`,
        event,
        lane,
        laneReusableAt: settings.motionMode === "speed"
          ? now + Math.max(1_200, settings.enterDurationMs)
          : Number.POSITIVE_INFINITY,
      };
      return [...retained, item];
    });
  }, [settings]);

  useOverlayEvents(receive);

  const updateLaneReusableAt = useCallback((id: string, laneReusableAt: number) => {
    setItems((current) => current.map((item) => (
      item.id === id && item.laneReusableAt !== laneReusableAt
        ? { ...item, laneReusableAt }
        : item
    )));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <Layer>
      {items.map((item) => (
        <ScrollingBullet
          key={item.id}
          item={item}
          settings={settings}
          onLaneReusable={updateLaneReusableAt}
          onDone={remove}
        />
      ))}
    </Layer>
  );
}
