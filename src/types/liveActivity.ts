/** 自首次使用 BiliMaku 以来累计收到的直播事件数量。 */
export interface LiveActivityTotals {
  /** 累计收到的用户进场事件数。 */
  entrances: number;
  /** 累计收到的普通弹幕数。 */
  messages: number;
  /** 累计收到的礼物数量。 */
  gifts: number;
}

/** 尚未收到任何事件时的累计统计。 */
export const EMPTY_LIVE_ACTIVITY_TOTALS: LiveActivityTotals = {
  entrances: 0,
  messages: 0,
  gifts: 0,
};