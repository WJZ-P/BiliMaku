/** 普通直播弹幕在 BiliMaku 输入区中的最大 Unicode 字符数。 */
export const LIVE_DANMAKU_MAX_LENGTH = 40;

/** 提交给 Rust 后端的直播弹幕发送参数。 */
export interface SendLiveDanmakuRequest {
  /** 使用当前登录账号发送的弹幕正文。 */
  message: string;
}

/** 平台确认接收弹幕后返回的结果。 */
export interface SendLiveDanmakuResult {
  /** 弹幕实际发送到的真实直播间号。 */
  roomId: number;
  /** 已提交给平台的弹幕正文。 */
  message: string;
  /** 平台成功响应时的 Unix 秒级时间戳。 */
  sentAt: number;
}
