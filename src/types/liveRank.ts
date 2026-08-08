/** 在线贡献榜中的单个用户。 */
export interface LiveOnlineRankEntry {
  /** 当前在线贡献排名，从 1 开始。 */
  rank: number;
  /** 用户 UID；使用字符串避免跨语言整数精度问题。 */
  userId: string;
  /** 当前展示昵称。 */
  name: string;
  /** 当前展示头像地址。 */
  avatar: string;
  /** 平台返回的本场贡献值。 */
  score: number;
  /** 大航海等级；0 表示没有有效大航海身份。 */
  guardLevel: number;
  /** 平台财富等级。 */
  wealthLevel: number;
  /** 是否为平台隐私保护后的神秘用户。 */
  mystery: boolean;
}

/** 当前直播间在线贡献榜快照。 */
export interface LiveOnlineRankSnapshot {
  /** 当前真实直播间号。 */
  roomId: number;
  /** 平台 onlineNum 字段，即在线贡献榜人数，不等同于精确在线观众数。 */
  onlineCount: number;
  /** 平台用于 UI 展示的榜单人数文本。 */
  onlineCountText: string;
  /** 当前榜单前三名。 */
  entries: LiveOnlineRankEntry[];
  /** 平台给出的上榜规则提示。 */
  tipsText: string;
  /** 贡献分值的展示名称。 */
  valueText: string;
}
