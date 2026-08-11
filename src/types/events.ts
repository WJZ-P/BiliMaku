/** bilimaku 内部统一的直播事件种类。 */
export type LiveEventType =
  | "message"
  | "interaction"
  | "gift"
  | "superchat"
  | "guard"
  | "system";

/** 平台互动事件的具体动作；编号由 INTERACT_WORD / INTERACT_WORD_V2 协议映射而来。 */
export type LiveInteractionKind =
  | "enter"
  | "follow"
  | "share"
  | "special-follow"
  | "mutual-follow"
  | "like";

/** 平台随弹幕事件下发的行内表情资源。 */
export interface LiveMessageEmote {
  /** 正文中的占位文本，例如 `[dog]`。 */
  text: string;
  /** 表情图片地址。 */
  url: string;
  /** 平台声明的原始图片宽度；缺失时为 0。 */
  width: number;
  /** 平台声明的原始图片高度；缺失时为 0。 */
  height: number;
}

/** Rust 协议层完成归一化后发送给 React 的直播事件。 */
export interface LiveEvent {
  /** 事件在本机的唯一编号。 */
  id: string;
  /** 产生事件的本地连接会话编号。 */
  sessionId?: number;
  /** 产生事件的真实房间号。 */
  roomId?: number;
  /** 归一化后的事件种类。 */
  type: LiveEventType;
  /** 互动事件的具体动作；非互动事件或旧数据中为空。 */
  interactionKind?: LiveInteractionKind;
  /** 事件主体 UID；上游未提供时为空。 */
  userId?: string;
  /** 事件主体昵称。 */
  user: string;
  /** 事件主体头像地址。 */
  avatar: string;
  /** 用于展示和播报的事件正文。 */
  content: string;
  /** 正文中可替换为图片的表情元数据；普通文本或旧事件中为空。 */
  emotes?: LiveMessageEmote[];
  /** 礼物数量、互动动作等补充信息。 */
  meta?: string;
  /** 归一化后的协议命令名。 */
  rawCommand?: string;
  /** 后端产生事件时的 Unix 秒级时间戳。 */
  emittedAt?: number;
  /** UI 格式化后的短时间文本。 */
  time?: string;
}

/** 语音播报队列中的展示项。 */
export interface VoiceQueueItem {
  /** 队列项唯一编号。 */
  id: string;
  /** 播报主体名称。 */
  speaker: string;
  /** 使用的音色名称。 */
  voice: string;
  /** 待播报文本。 */
  content: string;
  /** 预计或实际时长文本。 */
  duration: string;
  /** 当前播放状态。 */
  status: "playing" | "waiting";
}

/** 直播长连接生命周期阶段。 */
export type LiveConnectionPhase =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/** 成功建立直播间连接后返回的信息。 */
export interface RoomConnectionInfo {
  /** 本次本地连接会话编号。 */
  sessionId: number;
  /** 用户输入的房间号，可能是短号。 */
  requestedRoomId: number;
  /** 平台解析后的真实房间号。 */
  roomId: number;
  /** 直播间主播 UID。 */
  ownerUid: number;
  /** 直播间标题。 */
  title: string;
  /** 平台一级分区 ID，例如网游、单机游戏或虚拟主播。 */
  parentAreaId: number;
  /** 平台一级分区名称。 */
  parentAreaName: string;
  /** 当前直播间具体分区 ID。 */
  areaId: number;
  /** 当前直播间具体分区名称，供标题下方直接展示。 */
  areaName: string;
  /** 平台返回的直播状态码。 */
  liveStatus: number;
  /** 平台返回的本场开播时间，格式为北京时间 YYYY-MM-DD HH:mm:ss。 */
  liveTime: string;
  /** 供 UI 展示的直播封面地址，优先房间设置封面，最后回退直播关键帧。 */
  coverUrl: string;
  /** 本次连接的访问模式。 */
  accessMode: "web-anonymous" | "web-authenticated" | "open-live";
  /** 登录观看账号 UID；匿名连接时为空。 */
  viewerUid: number | null;
}

/** Rust 后端广播的连接状态。 */
export interface LiveStatusPayload {
  /** 本次本地连接会话编号。 */
  sessionId: number;
  /** 当前真实房间号。 */
  roomId: number;
  /** 当前连接阶段。 */
  state: LiveConnectionPhase;
  /** 面向用户的中文状态说明。 */
  message: string;
  /** 当前重连尝试次数。 */
  attempt: number;
}

/** 心跳包返回的直播间人气更新。 */
export interface PopularityUpdate {
  /** 本次本地连接会话编号。 */
  sessionId: number;
  /** 当前真实房间号。 */
  roomId: number;
  /** 平台计算的人气指标，不等同于精确在线人数。 */
  popularity: number;
}

/** 平台长链推送的本场直播累计统计变化。 */
export interface LiveRoomStatsUpdate {
  /** 本次本地连接会话编号。 */
  sessionId: number;
  /** 当前真实房间号。 */
  roomId: number;
  /** WATCHED_CHANGE 推送的本场累计看过人数；本次未更新时为空。 */
  watchedCount: number | null;
  /** LIKE_INFO_V3_UPDATE 推送的本场累计点赞次数；本次未更新时为空。 */
  likeCount: number | null;
  /** 产生本次统计变化的平台原始命令字。 */
  rawCommand: "WATCHED_CHANGE" | "LIKE_INFO_V3_UPDATE";
}
/** 应用启动时读取的连接与房间配置快照。 */
export interface ConnectionSnapshot {
  /** 当前是否存在活动长连接。 */
  connected: boolean;
  /** 活动连接的本地会话编号。 */
  sessionId: number | null;
  /** 活动连接的真实房间号。 */
  roomId: number | null;
  /** 活动连接的完整房间信息，用于 React 页面重新挂载时恢复标题与开播时间。 */
  room: RoomConnectionInfo | null;
  /** 统一配置中保存的用户输入房间号。 */
  savedRoomId: string;
  /** 是否应在冷启动时自动恢复该直播间连接。 */
  autoConnect: boolean;
}
