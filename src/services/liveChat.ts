import { invoke } from "@tauri-apps/api/core";
import type {
  SendLiveDanmakuRequest,
  SendLiveDanmakuResult,
} from "../types/liveChat";
import { isDesktopRuntime } from "./desktop";

/** 使用 Rust 中持久化的扫码登录态向当前已连接直播间发送弹幕。 */
export async function sendLiveDanmaku(
  request: SendLiveDanmakuRequest,
): Promise<SendLiveDanmakuResult> {
  if (!isDesktopRuntime()) {
    throw new Error("直播弹幕发送需要从 BiliMaku 桌面窗口执行");
  }
  return invoke<SendLiveDanmakuResult>("send_live_danmaku", { request });
}
