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
  LiveStatusPayload,
  PopularityUpdate,
  RoomConnectionInfo,
} from "../types/events";

export interface DesktopStatus {
  name: string;
  version: string;
  coreReady: boolean;
}

export function isDesktopRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function getDesktopStatus(): Promise<DesktopStatus | null> {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invoke<DesktopStatus>("get_app_status");
}

export async function getBilibiliLoginStatus(): Promise<BilibiliLoginStatus> {
  if (!isDesktopRuntime()) {
    return {
      phase: "anonymous",
      message: "请从 BiliCast 桌面窗口使用扫码登录",
      profile: null,
      persisted: false,
      validatedAt: null,
    };
  }
  return invoke<BilibiliLoginStatus>("get_bilibili_login_status");
}

export async function createBilibiliLoginQr(): Promise<QrLoginTicket> {
  if (!isDesktopRuntime()) {
    throw new Error("扫码登录需要从 BiliCast 桌面窗口启动");
  }
  return invoke<QrLoginTicket>("create_bilibili_login_qr");
}

export async function pollBilibiliLogin(): Promise<BilibiliLoginStatus> {
  if (!isDesktopRuntime()) {
    throw new Error("扫码登录需要从 BiliCast 桌面窗口启动");
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
    } satisfies ConnectionSnapshot;
  }
  return invoke<ConnectionSnapshot>("get_live_connection_status");
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
