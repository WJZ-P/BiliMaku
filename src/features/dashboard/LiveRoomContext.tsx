import { createContext, useContext, type PropsWithChildren } from "react";
import {
  useLiveRoomController,
  type LiveRoomController,
} from "./useLiveRoom";

const LiveRoomContext = createContext<LiveRoomController | null>(null);

/**
 * 应用级直播会话边界。
 * 侧边栏切换只替换视图，不会重建长链监听、弹幕缓冲或 TTS 队列。
 */
export function LiveRoomProvider({ children }: PropsWithChildren) {
  const controller = useLiveRoomController();
  return (
    <LiveRoomContext.Provider value={controller}>
      {children}
    </LiveRoomContext.Provider>
  );
}

/** 读取当前账号工作区共享的直播会话。 */
export function useLiveRoom() {
  const controller = useContext(LiveRoomContext);
  if (!controller) {
    throw new Error("useLiveRoom 必须在 LiveRoomProvider 内使用");
  }
  return controller;
}
