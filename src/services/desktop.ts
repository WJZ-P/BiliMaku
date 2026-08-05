import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
