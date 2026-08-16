import { invoke } from "@tauri-apps/api/core";
import type {
  LiveEmoticonCatalog,
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

/** 使用 Rust 中持久化的扫码登录态读取当前直播间的账号表情目录。 */
export async function getLiveEmoticons(): Promise<LiveEmoticonCatalog> {
  if (!isDesktopRuntime()) {
    throw new Error("直播表情读取需要从 BiliMaku 桌面窗口执行");
  }
  return invoke<LiveEmoticonCatalog>("get_live_emoticons");
}
