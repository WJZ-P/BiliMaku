/** 普通直播弹幕在 BiliMaku 输入区中的最大 Unicode 字符数。 */
export const LIVE_DANMAKU_MAX_LENGTH = 40;

/** 提交给 Rust 后端的直播弹幕发送参数。 */
export interface SendLiveDanmakuRequest {
  /** 普通弹幕正文；图片表情时填写平台下发的唯一标识。 */
  message: string;
  /** 平台弹幕类型：0 为普通文本，1 为独立图片表情。 */
  dmType?: 0 | 1;
}

/** 平台确认接收弹幕后返回的结果。 */
export interface SendLiveDanmakuResult {
  /** 弹幕实际发送到的真实直播间号。 */
  roomId: number;
  /** 已提交给平台的弹幕正文。 */
  message: string;
  /** 平台接收的弹幕类型：0 为普通文本，1 为独立图片表情。 */
  dmType: 0 | 1;
  /** 平台成功响应时的 Unix 秒级时间戳。 */
  sentAt: number;
}

/** 当前账号在活动直播间中可以看到的一份表情目录。 */
export interface LiveEmoticonCatalog {
  /** 表情权限所对应的真实直播间号。 */
  roomId: number;
  /** 当前账号是否拥有该直播间的粉丝团身份。 */
  fansBrand: boolean;
  /** 平台按来源与权限划分的表情包。 */
  packages: LiveEmoticonPackage[];
}

/** 平台表情目录中的一个表情包。 */
export interface LiveEmoticonPackage {
  /** 平台表情包 ID。 */
  id: number;
  /** 表情包展示名称。 */
  name: string;
  /** 表情包补充说明。 */
  description: string;
  /** 平台表情包类型；3 为插入输入框的文本表情，其余为独立图片表情。 */
  packageType: number;
  /** 平台原始表情包权限码。 */
  permissionCode: number;
  /** 当前账号是否具备该表情包的直接使用权限。 */
  permitted: boolean;
  /** 表情包标签页封面地址。 */
  coverUrl: string;
  /** 表情包内的全部表情。 */
  emoticons: LiveEmoticon[];
  /** 平台记录的近期使用表情。 */
  recentlyUsed: LiveEmoticon[];
}

/** 一个可插入输入框或直接发送的直播表情。 */
export interface LiveEmoticon {
  /** 平台表情 ID。 */
  id: number;
  /** 表情面板中展示的短名称。 */
  name: string;
  /** 插入普通弹幕时使用的文本，例如 `[dog]`。 */
  description: string;
  /** 表情图片地址。 */
  imageUrl: string;
  /** 发送独立图片表情时使用的唯一标识。 */
  unique: string;
  /** 图片原始宽度。 */
  width: number;
  /** 图片原始高度。 */
  height: number;
  /** 是否为动态图片。 */
  dynamic: boolean;
  /** 是否允许显示在播放器弹幕区域。 */
  inPlayerArea: boolean;
  /** 是否使用凸出的大表情显示方式。 */
  bulgeDisplay: boolean;
  /** 平台原始表情权限码。 */
  permissionCode: number;
  /** 当前账号是否可以使用该表情。 */
  permitted: boolean;
  /** 权限不足时平台给出的简短说明。 */
  unlockText: string;
  /** 解锁表情所需的粉丝牌或身份等级。 */
  unlockLevel: number;
}
