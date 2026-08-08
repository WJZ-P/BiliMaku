/** 扫码登录流程与已登录账号的状态阶段。 */
export type LoginPhase =
  | "checking"
  | "anonymous"
  | "waiting"
  | "scanned"
  | "authenticated"
  | "expired";

/** 已登录的哔哩哔哩账号摘要。 */
export interface AccountProfile {
  /** 账号 UID，使用字符串避免 JavaScript 整数精度损失。 */
  uid: string;
  /** 账号当前昵称。 */
  username: string;
  /** 账号头像地址。 */
  avatar: string;
  /** B 站主站账号等级，当前通常为 0 到 6 级。 */
  level: number;
  /** 当前累计经验值。 */
  currentExp: number;
  /** 当前等级的起始累计经验值。 */
  currentMinExp: number;
  /** 下一等级所需的累计经验值；满级账号为空。 */
  nextExp: number | null;
  /** 主站账号硬币余额，不是钱包中的 B 币余额。 */
  coins: number;
}

/** 后端维护的完整登录状态。 */
export interface BilibiliLoginStatus {
  /** 当前登录阶段。 */
  phase: LoginPhase;
  /** 面向用户的中文状态说明。 */
  message: string;
  /** 登录成功后的账号资料。 */
  profile: AccountProfile | null;
  /** 当前 Cookie 是否已经写入统一配置。 */
  persisted: boolean;
  /** 最近一次在线验证成功的 Unix 秒级时间戳。 */
  validatedAt: number | null;
}

/** 账号生命周期事件种类。 */
export type AccountEventKind =
  | "qr-created"
  | "qr-expired"
  | "login"
  | "restored"
  | "validated"
  | "validation-error"
  | "cookie-expired"
  | "session-error"
  | "logout";

/** Rust 后端广播的账号生命周期事件。 */
export interface BilibiliAccountEvent {
  /** 事件种类。 */
  kind: AccountEventKind;
  /** 事件发生后的完整登录状态。 */
  status: BilibiliLoginStatus;
  /** 事件发生时的 Unix 秒级时间戳。 */
  occurredAt: number;
}

/** 二维码登录初始化结果。 */
export interface QrLoginTicket {
  /** 可直接渲染的 SVG Data URL。 */
  imageDataUrl: string;
  /** 二维码预计有效秒数。 */
  expiresInSeconds: number;
}
