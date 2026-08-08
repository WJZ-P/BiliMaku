import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  BilibiliAccountEvent,
  BilibiliLoginStatus,
  QrLoginTicket,
} from "../types/account";
import type {
  ConnectionSnapshot,
  LiveEvent,
  LiveRoomStatsUpdate,
  LiveStatusPayload,
  PopularityUpdate,
  RoomConnectionInfo,
} from "../types/events";
import type { DesktopStatus } from "../types/app";
import type { LiveOnlineRankSnapshot } from "../types/liveRank";
import type {
  AnchorAnalyticsOverview,
  AnchorAnalyticsRangeType,
} from "../types/anchorAnalytics";

export function isDesktopRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function getDesktopStatus(): Promise<DesktopStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invoke<DesktopStatus>("get_app_status");
}

/** 返回 Rust 统一配置文件的绝对路径。 */
export async function getConfigFilePath(): Promise<string> {
  if (!isDesktopRuntime()) return "";
  return invoke<string>("get_config_file_path");
}

/** 使用 Rust 持久化扫码会话读取当前账号自己的主播中心数据。 */
export async function getAnchorAnalyticsOverview(
  rangeType: AnchorAnalyticsRangeType,
  forceRefresh = false,
): Promise<AnchorAnalyticsOverview> {
  if (!isDesktopRuntime()) {
    throw new Error("主播数据总览需要从 BiliMaku 桌面窗口读取");
  }
  return invoke<AnchorAnalyticsOverview>("get_anchor_analytics_overview", {
    rangeType,
    forceRefresh,
  });
}

export async function getBilibiliLoginStatus(): Promise<BilibiliLoginStatus> {
  if (!isDesktopRuntime()) {
    return {
      phase: "anonymous",
      message: "请从 bilimaku 桌面窗口使用扫码登录",
      profile: null,
      persisted: false,
      validatedAt: null,
    };
  }
  return invoke<BilibiliLoginStatus>("get_bilibili_login_status");
}

export async function createBilibiliLoginQr(): Promise<QrLoginTicket> {
  if (!isDesktopRuntime()) {
    throw new Error("扫码登录需要从 bilimaku 桌面窗口启动");
  }
  return invoke<QrLoginTicket>("create_bilibili_login_qr");
}

export async function pollBilibiliLogin(): Promise<BilibiliLoginStatus> {
  if (!isDesktopRuntime()) {
    throw new Error("扫码登录需要从 bilimaku 桌面窗口启动");
  }
  return invoke<BilibiliLoginStatus>("poll_bilibili_login");
}

export async function logoutBilibiliAccount(): Promise<BilibiliLoginStatus> {
  if (!isDesktopRuntime()) {
    return getBilibiliLoginStatus();
  }
  return invoke<BilibiliLoginStatus>("logout_bilibili_account");
}

export async function listenToBilibiliAccountEvents(
  callback: (event: BilibiliAccountEvent) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) return () => undefined;
  return listen<BilibiliAccountEvent>("account://event", (event) =>
    callback(event.payload),
  );
}

export async function connectLiveRoom(roomId: string) {
  if (!isDesktopRuntime()) {
    throw new Error("真实直播连接需要从 Tauri 桌面窗口启动");
  }

  return invoke<RoomConnectionInfo>("connect_live_room", { roomId });
}

/** 把有效房间号写入 Rust 统一配置。 */
export async function saveLiveRoomId(roomId: string): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("update_saved_room_id", { roomId });
}

export async function disconnectLiveRoom() {
  if (!isDesktopRuntime()) {
    return;
  }
  await invoke<void>("disconnect_live_room");
}

export async function getLiveConnectionStatus() {
  if (!isDesktopRuntime()) {
    return {
      connected: false,
      sessionId: null,
      roomId: null,
      room: null,
      savedRoomId: "",
    } satisfies ConnectionSnapshot;
  }
  return invoke<ConnectionSnapshot>("get_live_connection_status");
}

/** 读取当前活动直播间在线贡献榜人数与前三名。 */
export async function getLiveOnlineRank(): Promise<LiveOnlineRankSnapshot> {
  if (!isDesktopRuntime()) {
    throw new Error("在线贡献榜需要从 BiliMaku 桌面窗口读取");
  }
  return invoke<LiveOnlineRankSnapshot>("get_live_online_rank");
}

export async function listenToLiveEvents(
  callback: (event: LiveEvent) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) {
    return () => undefined;
  }
  return listen<LiveEvent>("live://event", (event) => callback(event.payload));
}

export async function listenToLiveStatus(
  callback: (status: LiveStatusPayload) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) {
    return () => undefined;
  }
  return listen<LiveStatusPayload>("live://status", (event) =>
    callback(event.payload),
  );
}

/** 监听平台推送的本场累计看过人数与点赞次数。 */
export async function listenToLiveRoomStats(
  callback: (update: LiveRoomStatsUpdate) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) {
    return () => undefined;
  }
  return listen<LiveRoomStatsUpdate>("live://room-stats", (event) =>
    callback(event.payload),
  );
}
export async function listenToPopularity(
  callback: (update: PopularityUpdate) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) {
    return () => undefined;
  }
  return listen<PopularityUpdate>("live://popularity", (event) =>
    callback(event.payload),
  );
}
