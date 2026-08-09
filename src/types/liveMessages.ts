import type { LiveEventType } from "./events";

/** 聊天工作台支持持久化的消息分类。 */
export type LiveMessageDisplayFilter = "all" | Extract<
  LiveEventType,
  "message" | "interaction" | "gift" | "superchat"
>;

/** 直播间消息展示与内存缓存偏好。 */
export interface LiveMessageSettings {
  /** 聊天工作台最后一次选中的消息分类。 */
  displayFilter: LiveMessageDisplayFilter;
  /** 当前会话在内存中最多保留的最新消息条数。 */
  maxStoredMessages: number;
}

/** 默认保留 821 条最新直播事件。 */
export const DEFAULT_MAX_STORED_LIVE_MESSAGES = 821;
/** 前后端共用的消息缓存输入范围。 */
export const MIN_STORED_LIVE_MESSAGES = 1;
export const MAX_STORED_LIVE_MESSAGES = 50_000;

export const DEFAULT_LIVE_MESSAGE_SETTINGS: LiveMessageSettings = {
  displayFilter: "all",
  maxStoredMessages: DEFAULT_MAX_STORED_LIVE_MESSAGES,
};
