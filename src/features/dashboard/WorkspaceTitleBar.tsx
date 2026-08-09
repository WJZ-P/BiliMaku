import { useEffect, useMemo, useState } from "react";
import {
  WindowTitleBar,
  type TitleBarRoomSummary,
} from "../../components/WindowTitleBar";
import type { AccountProfile } from "../../types/account";
import { useLiveRoom } from "./LiveRoomContext";

interface WorkspaceTitleBarProps {
  /** 当前扫码登录账号的资料。 */
  profile: AccountProfile | null;
}

/** 将平台返回的北京时间字符串转换为稳定的 Unix 毫秒时间戳。 */
function parseBilibiliLiveTime(value: string | undefined) {
  const match = value?.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day, hour - 8, minute, second);
}

function formatLiveDuration(startedAt: number | null, now: number) {
  if (startedAt === null) return "--";
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days}天 ${clock}` : clock;
}

/**
 * 把应用级直播会话映射为标题栏摘要。
 *
 * 组件只消费现有 Provider，不新增事件订阅或在线榜轮询，因此切换侧边栏页面时
 * 标题栏与聊天区始终共享同一份会话状态。
 */
export function WorkspaceTitleBar({ profile }: WorkspaceTitleBarProps) {
  const live = useLiveRoom();
  const connected = live.status.state === "connected";
  const hasLiveContext = live.status.state !== "disconnected";
  const liveStartedAt = useMemo(
    () => parseBilibiliLiveTime(live.room?.liveTime),
    [live.room?.liveTime],
  );
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    setClockNow(Date.now());
    if (!connected || liveStartedAt === null || live.room?.liveStatus !== 1) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [connected, live.room?.liveStatus, liveStartedAt]);

  const roomSummary = useMemo<TitleBarRoomSummary>(() => {
    let messageCount = 0;
    let highlightedCount = 0;
    for (const event of live.events) {
      if (event.type === "message") messageCount += 1;
      if (["gift", "superchat", "guard"].includes(event.type)) {
        highlightedCount += 1;
      }
    }

    return {
      connected,
      hasLiveContext,
      messageCount,
      highlightedCount,
      liveDuration: connected && live.room?.liveStatus === 1
        ? formatLiveDuration(liveStartedAt, clockNow)
        : "--",
      liveTime: live.room?.liveTime,
      popularity: live.popularity,
      onlineCountText: live.onlineRank?.onlineCountText,
      onlineRankEntries: live.onlineRank?.entries ?? [],
      onlineRankError: live.onlineRankError,
    };
  }, [
    clockNow,
    connected,
    hasLiveContext,
    live.events,
    live.onlineRank,
    live.onlineRankError,
    live.popularity,
    live.room?.liveStatus,
    live.room?.liveTime,
    liveStartedAt,
  ]);

  return (
    <WindowTitleBar
      profile={profile}
      roomSummary={roomSummary}
    />
  );
}
