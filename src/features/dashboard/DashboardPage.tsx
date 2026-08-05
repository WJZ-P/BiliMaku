import { styled } from "@linaria/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import {
  EyebrowBadge,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
} from "../../components/ui";
import { demoEvents, demoQueue } from "../../data/mockData";
import { theme } from "../../styles/theme";
import type { LiveEvent, LiveEventType, VoiceQueueItem } from "../../types/events";
import { useLiveRoom } from "./useLiveRoom";

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Hero = styled.section`
  position: relative;
  display: grid;
  overflow: hidden;
  min-height: 210px;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.75fr);
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 13%, transparent);
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  box-shadow: 0 22px 46px color-mix(in srgb, ${theme.colors.brandDeep} 22%, transparent);

  &::before {
    position: absolute;
    right: 14%;
    bottom: -90px;
    width: 250px;
    height: 250px;
    border: 44px solid color-mix(in srgb, ${theme.colors.highlight} 9%, transparent);
    border-radius: 50%;
    content: "";
  }

  @media (max-width: 1080px) {
    grid-template-columns: minmax(0, 1fr) 230px;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  padding: 25px 28px 24px;
`;

const HeroBadge = styled.span`
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 34%, transparent);
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, ${theme.colors.highlight} 14%, transparent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  backdrop-filter: blur(8px);
`;

const HeroDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${theme.colors.cyan};
  box-shadow: 0 0 0 4px color-mix(in srgb, ${theme.colors.cyan} 19%, transparent);

  [data-connected="true"] & {
    background: ${theme.colors.successSoft};
    box-shadow: 0 0 0 4px color-mix(in srgb, ${theme.colors.successSoft} 22%, transparent);
  }
`;

const HeroTitle = styled.h2`
  max-width: 580px;
  margin: 14px 0 7px;
  font-size: clamp(23px, 2.6vw, 34px);
  font-weight: 850;
  letter-spacing: -0.045em;
  line-height: 1.14;
`;

const HeroDescription = styled.p`
  max-width: 600px;
  margin: 0;
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 78%, transparent);
  font-size: 12px;
  line-height: 1.65;
`;

const HeroStatusMessage = styled.div`
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 82%, transparent);
  font-size: 9px;
  font-weight: 650;

  &[data-error="true"] {
    color: ${theme.colors.warningSoft};
  }
`;

const ConnectForm = styled.form`
  display: flex;
  max-width: 510px;
  gap: 9px;
  margin-top: 18px;
`;

const RoomInputWrap = styled.label`
  display: flex;
  height: 42px;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 27%, transparent);
  border-radius: ${theme.radius.sm};
  background: color-mix(in srgb, ${theme.colors.surface} 15%, transparent);
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 76%, transparent);
  backdrop-filter: blur(10px);
  transition: all ${theme.motion.fast};

  &:focus-within {
    border-color: color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);
    background: color-mix(in srgb, ${theme.colors.surface} 20%, transparent);
  }
`;

const RoomInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textOnBrand};
  font-size: 12px;
  font-weight: 650;

  &::placeholder {
    color: color-mix(in srgb, ${theme.colors.textOnBrand} 58%, transparent);
  }
`;

const ConnectButton = styled.button`
  display: inline-flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 17px;
  border: 0;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surface};
  color: ${theme.colors.brandDeep};
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 9px 20px color-mix(in srgb, ${theme.colors.brandDeep} 22%, transparent);
  transition: all ${theme.motion.fast};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px color-mix(in srgb, ${theme.colors.brandDeep} 29%, transparent);
  }

  &[data-connected="true"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &:disabled {
    cursor: wait;
    opacity: 0.68;
    transform: none;
  }
`;

const HeroVisual = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
`;

const Bubble = styled.div`
  position: relative;
  display: grid;
  width: 154px;
  height: 154px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 36%, transparent);
  border-radius: 49% 49% 49% 29%;
  background: color-mix(in srgb, ${theme.colors.surface} 13%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 44%, transparent),
    0 22px 50px color-mix(in srgb, ${theme.colors.brandDeep} 24%, transparent);
  backdrop-filter: blur(18px);

  &::before,
  &::after {
    position: absolute;
    top: -11px;
    width: 42px;
    height: 42px;
    border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 28%, transparent);
    border-right: 0;
    border-bottom: 0;
    border-radius: 9px;
    background: color-mix(in srgb, ${theme.colors.surface} 10%, transparent);
    content: "";
    transform: rotate(45deg);
  }

  &::before {
    left: 24px;
  }

  &::after {
    right: 24px;
  }
`;

const WaveBars = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  height: 62px;
  align-items: center;
  gap: 7px;

  span {
    width: 7px;
    border-radius: ${theme.radius.pill};
    background: color-mix(in srgb, ${theme.colors.textOnBrand} 88%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, ${theme.colors.cyan} 24%, transparent);
  }

  span:nth-child(1),
  span:nth-child(7) {
    height: 18px;
  }

  span:nth-child(2),
  span:nth-child(6) {
    height: 35px;
  }

  span:nth-child(3),
  span:nth-child(5) {
    height: 52px;
  }

  span:nth-child(4) {
    height: 64px;
    background: ${theme.colors.cyan};
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
`;

const StatCard = styled.article`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: color-mix(in srgb, ${theme.colors.surface} 90%, transparent);
  box-shadow: ${theme.shadows.inset};
  backdrop-filter: blur(12px);
`;

const StatIcon = styled.span`
  display: grid;
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  place-items: center;
  border-radius: 13px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};

  &[data-tone="success"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-tone="gift"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-tone="warning"] {
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }
`;

const StatValue = styled.div`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 18px;
  font-weight: 850;
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatLabel = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 650;
`;

const MainGrid = styled.div`
  display: grid;
  min-height: 382px;
  grid-template-columns: minmax(0, 1.55fr) minmax(310px, 0.9fr);
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1.35fr) minmax(290px, 0.9fr);
  }
`;

const FilterGroup = styled.div`
  display: flex;
  gap: 5px;
  padding: 3px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
`;

const FilterButton = styled.button`
  height: 27px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 700;

  &[data-active="true"] {
    background: ${theme.colors.surface};
    color: ${theme.colors.brandDeep};
    box-shadow: 0 3px 8px ${theme.colors.shadow};
  }
`;

const Feed = styled.div`
  display: grid;
  gap: 1px;
  padding: 6px 10px 11px;
`;

const FeedItem = styled.article`
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: start;
  padding: 11px 10px;
  border-radius: ${theme.radius.sm};
  transition: background ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.surfaceMuted};
  }
`;

const EventAvatar = styled.div`
  position: relative;
  display: grid;
  overflow: hidden;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid ${theme.colors.brandSoft};
  border-radius: 13px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 11px;
  font-weight: 850;

  &[data-type="gift"] {
    border-color: ${theme.colors.giftSoft};
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-type="interaction"] {
    border-color: ${theme.colors.successSoft};
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-type="superchat"] {
    border-color: ${theme.colors.warningSoft};
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }

  &[data-type="guard"] {
    border-color: ${theme.colors.cyanSoft};
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }

  &[data-type="system"] {
    border-color: ${theme.colors.successSoft};
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }
`;

const AvatarFallback = styled.span`
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
`;

const AvatarImage = styled.img`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
`;

const EventHeader = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
`;

const EventUser = styled.span`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EventMeta = styled.span`
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 8px;
  font-weight: 800;

  &[data-type="gift"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-type="interaction"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-type="superchat"] {
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }

  &[data-type="guard"] {
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }
`;

const EventContent = styled.p`
  margin: 3px 0 0;
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  line-height: 1.45;
`;

const EventTime = styled.time`
  padding-top: 2px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
`;

const EmptyFeed = styled.div`
  display: grid;
  min-height: 250px;
  place-items: center;
  padding: 30px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  text-align: center;

  strong {
    display: block;
    margin-bottom: 5px;
    color: ${theme.colors.textSecondary};
    font-size: 12px;
  }
`;

const QueueHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

const QueueCount = styled.span`
  display: grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
`;

const PlaybackButton = styled.button`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 11px;
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  transition: all ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.brandHover};
    transform: translateY(-1px);
  }
`;

const QueueBody = styled.div`
  display: flex;
  min-height: 312px;
  flex-direction: column;
  padding: 10px 13px 13px;
`;

const NowPlaying = styled.div`
  margin: 0 0 7px;
  padding: 12px;
  border: 1px solid ${theme.colors.brandSoft};
  border-radius: ${theme.radius.md};
  background: ${theme.colors.brandSubtle};
`;

const PlayingTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const PlayingLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.brand};
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.1em;
`;

const PlayingDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${theme.colors.brand};
  box-shadow: 0 0 0 4px ${theme.colors.brandSoft};
`;

const Duration = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
`;

const PlayingText = styled.p`
  margin: 8px 0 7px;
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  font-weight: 650;
  line-height: 1.5;
`;

const VoiceMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

const ProgressTrack = styled.div`
  overflow: hidden;
  height: 3px;
  margin-top: 9px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSoft};
`;

const Progress = styled.div`
  width: 62%;
  height: 100%;
  border-radius: inherit;
  background: ${theme.colors.brand};
`;

const QueueItem = styled.div`
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 7px;
  border-bottom: 1px solid ${theme.colors.border};

  &:last-of-type {
    border-bottom: 0;
  }
`;

const QueueIndex = styled.span`
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 8px;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 700;
`;

const QueueText = styled.div`
  min-width: 0;
`;

const QueueSpeaker = styled.div`
  overflow: hidden;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const QueueContent = styled.div`
  overflow: hidden;
  margin-top: 2px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EngineCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding: 10px 11px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
`;

const EngineInfo = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
`;

const EngineIcon = styled.span`
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  place-items: center;
  border-radius: 10px;
  background: ${theme.colors.cyanSoft};
  color: ${theme.colors.brandDeep};
`;

const EngineName = styled.div`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 9px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EngineCaption = styled.div`
  margin-top: 1px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

const Pipeline = styled.section`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: color-mix(in srgb, ${theme.colors.surface} 86%, transparent);
  color: ${theme.colors.textMuted};
  box-shadow: ${theme.shadows.inset};
`;

const PipelineLabel = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 800;
`;

const PipelineSteps = styled.div`
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const PipelineStep = styled.span`
  flex: 0 1 auto;
  padding: 5px 9px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
`;

const PipelineArrow = styled.span`
  color: ${theme.colors.borderStrong};
  font-size: 10px;
`;

const PipelineGroup = styled.span`
  display: contents;
`;

const eventFilters: Array<{ label: string; value: "all" | LiveEventType }> = [
  { label: "全部", value: "all" },
  { label: "弹幕", value: "message" },
  { label: "互动", value: "interaction" },
  { label: "礼物", value: "gift" },
  { label: "高亮", value: "superchat" },
];

const statusLabels = {
  disconnected: "待连接",
  connecting: "连接中",
  connected: "已连接",
  reconnecting: "重连中",
  error: "连接异常",
} as const;

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatEventTime(event: LiveEvent) {
  if (event.time) return event.time;
  if (!event.emittedAt) return "刚刚";
  return new Date(event.emittedAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estimateDuration(content: string) {
  const seconds = Math.max(2, Math.ceil(content.length / 4.5));
  return `00:${String(Math.min(seconds, 59)).padStart(2, "0")}`;
}

function toQueueItem(event: LiveEvent, index: number): VoiceQueueItem {
  return {
    id: event.id,
    speaker: event.user,
    voice: "系统语音 · 中文",
    content: event.content,
    duration: estimateDuration(event.content),
    status: index === 0 ? "playing" : "waiting",
  };
}

function makeSpeechText(event: LiveEvent) {
  if (event.type === "message") return `${event.user}说，${event.content}`;
  if (event.type === "superchat") return `${event.user}的醒目留言，${event.content}`;
  return `${event.user}${event.content}`;
}

function normalizeAvatarUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url.startsWith("https://") ? url : "";
}

function EventAvatarView({ event }: { event: LiveEvent }) {
  const avatarUrl = normalizeAvatarUrl(event.avatar);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <EventAvatar data-type={event.type}>
      <AvatarFallback>{event.user.slice(0, 1) || "播"}</AvatarFallback>
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

export function DashboardPage() {
  const live = useLiveRoom();
  const [roomId, setRoomId] = useState("");
  const [queuePaused, setQueuePaused] = useState(false);
  const [filter, setFilter] = useState<"all" | LiveEventType>("all");
  const lastSpokenId = useRef<string | null>(null);

  const connected = live.status.state === "connected";
  const connecting = live.status.state === "connecting";
  const reconnecting = live.status.state === "reconnecting";
  const hasLiveContext = live.status.state !== "disconnected";
  const authenticatedRoom = live.room?.accessMode === "web-authenticated";
  const sourceEvents = hasLiveContext ? live.events : demoEvents;

  const events = useMemo(
    () =>
      filter === "all"
        ? sourceEvents
        : sourceEvents.filter((event) => event.type === filter),
    [filter, sourceEvents],
  );

  const liveQueue = useMemo(
    () =>
      live.events
        .filter((event) => event.type !== "system")
        .slice(0, 3)
        .map(toQueueItem),
    [live.events],
  );
  const waitingQueue: VoiceQueueItem = {
    id: "live-waiting",
    speaker: "BiliCast",
    voice: "系统语音 · 中文",
    content: connected
      ? "长链已经就绪，正在等待下一条弹幕喵～"
      : "连接建立后，新的弹幕会自动进入播报队列。",
    duration: "--:--",
    status: "waiting",
  };
  const queueItems = hasLiveContext
    ? liveQueue.length > 0
      ? liveQueue
      : [waitingQueue]
    : demoQueue;
  const currentQueue = queueItems[0];

  const messageCount = live.events.filter(
    (event) => event.type === "message",
  ).length;
  const highlightedCount = live.events.filter((event) =>
    ["gift", "superchat", "guard"].includes(event.type),
  ).length;
  const currentStats = [
    {
      icon: "radio" as const,
      value: statusLabels[live.status.state],
      label: live.desktopRuntime
        ? authenticatedRoom
          ? "直播间状态 · 登录态 Web 长链"
          : "直播间状态 · 匿名 Web 长链"
        : "浏览器预览 · 桌面端可连接",
      tone: "success",
    },
    {
      icon: "message" as const,
      value: hasLiveContext ? formatCompact(messageCount) : "1,284",
      label: hasLiveContext ? "本次会话弹幕" : "弹幕事件 · 界面演示",
      tone: "brand",
    },
    {
      icon: "gift" as const,
      value: hasLiveContext ? formatCompact(highlightedCount) : "36",
      label: hasLiveContext ? "礼物 / SC / 舰长" : "高亮事件 · 界面演示",
      tone: "gift",
    },
    {
      icon: "users" as const,
      value: hasLiveContext ? formatCompact(live.popularity) : "--",
      label: hasLiveContext ? "直播间人气值" : "连接后读取实时人气",
      tone: "warning",
    },
  ];

  useEffect(() => {
    if (!roomId && live.status.roomId > 0) {
      setRoomId(String(live.status.roomId));
    }
  }, [live.status.roomId, roomId]);

  useEffect(() => {
    const latest = live.events[0];
    if (
      !connected ||
      !latest ||
      latest.type === "system" ||
      lastSpokenId.current === latest.id ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    lastSpokenId.current = latest.id;
    const utterance = new SpeechSynthesisUtterance(makeSpeechText(latest));
    utterance.lang = "zh-CN";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }, [connected, live.events]);

  useEffect(() => {
    if (live.status.state === "disconnected" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      lastSpokenId.current = null;
    }
  }, [live.status.state]);

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const handleConnection = async () => {
    if (connected || reconnecting) {
      await live.disconnect();
      return;
    }

    try {
      await live.connect(roomId);
    } catch {
      // 具体错误已由 useLiveRoom 写入状态条。
    }
  };

  const togglePlayback = () => {
    setQueuePaused((paused) => {
      const nextPaused = !paused;
      if ("speechSynthesis" in window) {
        if (nextPaused) window.speechSynthesis.pause();
        else window.speechSynthesis.resume();
      }
      return nextPaused;
    });
  };

  const connectionAction = connecting
    ? "正在连接…"
    : connected
      ? "断开连接"
      : reconnecting
        ? "停止重连"
        : "连接直播间";

  return (
    <Page>
      <Hero data-connected={connected}>
        <HeroContent>
          <HeroBadge>
            <HeroDot />
            {connected
              ? authenticatedRoom
                ? "AUTHENTICATED WEB MODE"
                : "ANONYMOUS WEB MODE"
              : reconnecting
                ? "RECONNECTING"
                : "ROOM-ID DIRECT MODE"}
          </HeroBadge>
          <HeroTitle>
            {live.room
              ? `${live.room.title || `直播间 ${live.room.roomId}`} 正在冒泡`
              : connected
                ? `直播间 ${live.status.roomId} 正在冒泡`
                : "只填直播间 ID，让每一条弹幕都有声音"}
          </HeroTitle>
          <HeroDescription>
            {authenticatedRoom
              ? `当前使用扫码账号 UID ${live.room?.viewerUid ?? "--"} 建立登录态 Web 长链；Cookie、WBI 签名与协议解包均留在 Rust 桌面端。`
              : "当前使用 Rust 本机直连匿名 Web 弹幕长链，无需主播身份码；房间解析、WBI 签名、鉴权心跳和 Brotli 解包都在桌面端完成。"}
          </HeroDescription>
          <HeroStatusMessage data-error={live.status.state === "error"}>
            <Icon
              name={live.status.state === "error" ? "bell" : "shield"}
              size={12}
            />
            {live.status.message}
          </HeroStatusMessage>
          <ConnectForm
            onSubmit={(event) => {
              event.preventDefault();
              void handleConnection();
            }}
          >
            <RoomInputWrap>
              <Icon name="radio" size={17} />
              <RoomInput
                value={roomId}
                inputMode="numeric"
                aria-label="直播间 ID"
                placeholder="输入直播间 ID（支持短号）"
                disabled={connected || connecting || reconnecting}
                onChange={(event) => setRoomId(event.target.value)}
              />
            </RoomInputWrap>
            <ConnectButton
              type="submit"
              data-connected={connected}
              disabled={connecting || (!connected && !reconnecting && !roomId.trim())}
            >
              <Icon name={connected ? "check" : "plug"} size={16} />
              {connectionAction}
            </ConnectButton>
          </ConnectForm>
        </HeroContent>
        <HeroVisual aria-hidden="true">
          <Bubble>
            <WaveBars>
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index} />
              ))}
            </WaveBars>
          </Bubble>
        </HeroVisual>
      </Hero>

      <StatsGrid>
        {currentStats.map((stat) => (
          <StatCard key={stat.label}>
            <StatIcon data-tone={stat.tone}>
              <Icon name={stat.icon} size={18} />
            </StatIcon>
            <div>
              <StatValue>{stat.value}</StatValue>
              <StatLabel>{stat.label}</StatLabel>
            </div>
          </StatCard>
        ))}
      </StatsGrid>

      <MainGrid>
        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>实时事件流</PanelTitle>
              <PanelDescription>
                {hasLiveContext
                  ? `真实事件 · 最多保留 150 条 · 房间 ${live.room?.roomId ?? live.status.roomId}`
                  : "当前为界面演示，连接后自动切换到真实事件"}
              </PanelDescription>
            </PanelHeading>
            <FilterGroup aria-label="事件过滤器">
              {eventFilters.map((item) => (
                <FilterButton
                  key={item.value}
                  type="button"
                  data-active={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </FilterButton>
              ))}
            </FilterGroup>
          </PanelHeader>
          <Feed>
            {events.length > 0 ? (
              events.map((event) => (
                <FeedItem key={event.id}>
                  <EventAvatarView event={event} />
                  <div>
                    <EventHeader>
                      <EventUser>{event.user}</EventUser>
                      {event.meta ? (
                        <EventMeta data-type={event.type}>{event.meta}</EventMeta>
                      ) : null}
                    </EventHeader>
                    <EventContent>{event.content}</EventContent>
                  </div>
                  <EventTime>{formatEventTime(event)}</EventTime>
                </FeedItem>
              ))
            ) : (
              <EmptyFeed>
                <div>
                  <strong>{connected ? "长链已就绪" : "正在准备事件流"}</strong>
                  {filter === "all"
                    ? "收到新的弹幕、礼物或高亮事件后会显示在这里。"
                    : "当前筛选条件下还没有事件。"}
                </div>
              </EmptyFeed>
            )}
          </Feed>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>播报队列</PanelTitle>
              <PanelDescription>
                {hasLiveContext
                  ? "新事件自动进入系统语音队列"
                  : "演示队列 · 连接后启用真实系统语音"}
              </PanelDescription>
            </PanelHeading>
            <QueueHeaderActions>
              <QueueCount>{hasLiveContext ? liveQueue.length : demoQueue.length}</QueueCount>
              <PlaybackButton
                type="button"
                aria-label={queuePaused ? "继续播报" : "暂停播报"}
                onClick={togglePlayback}
              >
                <Icon name={queuePaused ? "play" : "pause"} size={15} />
              </PlaybackButton>
            </QueueHeaderActions>
          </PanelHeader>
          <QueueBody>
            <NowPlaying>
              <PlayingTop>
                <PlayingLabel>
                  <PlayingDot />
                  {queuePaused
                    ? "PAUSED"
                    : currentQueue.status === "playing"
                      ? "NOW SPEAKING"
                      : "WAITING FOR EVENT"}
                </PlayingLabel>
                <Duration>{currentQueue.duration}</Duration>
              </PlayingTop>
              <PlayingText>{currentQueue.content}</PlayingText>
              <VoiceMeta>
                <Icon name="volume" size={12} />
                {currentQueue.voice} · {currentQueue.speaker}
              </VoiceMeta>
              <ProgressTrack>
                <Progress />
              </ProgressTrack>
            </NowPlaying>

            {queueItems.slice(1).map((item, index) => (
              <QueueItem key={item.id}>
                <QueueIndex>0{index + 2}</QueueIndex>
                <QueueText>
                  <QueueSpeaker>{item.speaker}</QueueSpeaker>
                  <QueueContent>{item.content}</QueueContent>
                </QueueText>
                <Duration>{item.duration}</Duration>
              </QueueItem>
            ))}

            <EngineCard>
              <EngineInfo>
                <EngineIcon>
                  <Icon name="sparkles" size={15} />
                </EngineIcon>
                <div>
                  <EngineName>Web Speech · 基础播报器</EngineName>
                  <EngineCaption>已可播报 · 后续可替换自定义音色适配器</EngineCaption>
                </div>
              </EngineInfo>
              <Icon name="chevron" size={14} />
            </EngineCard>
          </QueueBody>
        </Panel>
      </MainGrid>

      <Pipeline>
        <PipelineLabel>
          <Icon name="shield" size={14} />
          模块化流水线
        </PipelineLabel>
        <PipelineSteps>
          {[
            "直播接入",
            "事件标准化",
            "过滤规则",
            "优先级队列",
            "TTS 适配器",
            "音频输出",
          ].map((step, index, values) => (
            <PipelineGroup key={step}>
              <PipelineStep>{step}</PipelineStep>
              {index < values.length - 1 ? <PipelineArrow>→</PipelineArrow> : null}
            </PipelineGroup>
          ))}
        </PipelineSteps>
        <EyebrowBadge>
          <Icon name="check" size={11} />
          REALTIME READY
        </EyebrowBadge>
      </Pipeline>
    </Page>
  );
}
