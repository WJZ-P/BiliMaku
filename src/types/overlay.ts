import type { LiveEventType } from "./events";

export type OverlayKind = "danmaku" | "sidebar";
/** 侧边事件栏中新消息从窗口顶部或底部进入。 */
export type SidebarEntryDirection = "top" | "bottom";

/** 各类直播事件在悬浮窗中的主题色。 */
export interface EventColorMap {
  /** 普通弹幕颜色。 */
  message: string;
  /** 进场、关注、点赞等互动颜色。 */
  interaction: string;
  /** 礼物事件颜色。 */
  gift: string;
  /** 醒目留言颜色。 */
  superchat: string;
  /** 舰长等大航海事件颜色。 */
  guard: string;
  /** 系统事件颜色。 */
  system: string;
}

/** 全屏横向弹幕层参数。 */
export interface DanmakuOverlaySettings {
  /** 是否启用鼠标穿透。 */
  clickThrough: boolean;
  /** 允许进入弹幕层的事件种类。 */
  enabledEventTypes: LiveEventType[];
  /** 是否在正文前显示昵称。 */
  showUsername: boolean;
  /** 昵称使用的独立颜色。 */
  usernameColor: string;
  /** 是否显示用户头像。 */
  showAvatar: boolean;
  /** CSS 字体族。 */
  fontFamily: string;
  /** 字号，单位为像素。 */
  fontSize: number;
  /** CSS 字重。 */
  fontWeight: number;
  /** 整体不透明度。 */
  opacity: number;
  /** 各事件种类的文字颜色。 */
  colors: EventColorMap;
  /** 文字描边颜色。 */
  outlineColor: string;
  /** 文字描边宽度。 */
  outlineWidth: number;
  /** 文字阴影颜色。 */
  shadowColor: string;
  /** 文字阴影模糊半径。 */
  shadowBlur: number;
  /** 运动参数采用固定速度或固定时长。 */
  motionMode: "speed" | "duration";
  /** 固定速度模式下每秒移动像素数。 */
  speedPixelsPerSecond: number;
  /** 固定时长模式下横穿屏幕所需秒数。 */
  durationSeconds: number;
  /** 入场动画时长，单位为毫秒。 */
  enterDurationMs: number;
  /** 离场动画时长，单位为毫秒。 */
  exitDurationMs: number;
  /** 可用轨道区域顶部百分比。 */
  verticalStartPercent: number;
  /** 可用轨道区域底部百分比。 */
  verticalEndPercent: number;
  /** 相邻轨道间距。 */
  laneGap: number;
  /** 同时显示的最大事件数。 */
  maxVisible: number;
}

/** 侧边事件栏参数。 */
export interface SidebarOverlaySettings {
  /** 是否启用鼠标穿透；编辑定位模式开启时会临时关闭穿透。 */
  clickThrough: boolean;
  /** 是否显示窗口编辑边界并允许拖动定位。 */
  editMode: boolean;

  /** 新消息相对侧边事件栏从顶部或底部进入。 */
  entryDirection: SidebarEntryDirection;
  /** 窗口宽度。 */
  width: number;
  /** 窗口高度。 */
  height: number;
  /** 允许展示的事件种类。 */
  enabledEventTypes: LiveEventType[];
  /** 同时保留的最大事件数。 */
  maxEvents: number;
  /** 单条事件保留秒数。 */
  lifetimeSeconds: number;
  /** 是否显示头像。 */
  showAvatar: boolean;
  /** CSS 字体族。 */
  fontFamily: string;
  /** 字号。 */
  fontSize: number;
  /** CSS 字重。 */
  fontWeight: number;
  /** 主文字颜色。 */
  textColor: string;
  /** 昵称使用的独立颜色。 */
  usernameColor: string;
  /** 各事件种类的强调色。 */
  colors: EventColorMap;
  /** 消息气泡背景色。 */
  backgroundColor: string;
  /** 消息气泡不透明度。 */
  cardOpacity: number;
  /** 背景模糊半径。 */
  blur: number;
  /** 消息气泡圆角。 */
  radius: number;
  /** 进出场横向滑动距离。 */
  slideDistance: number;
  /** 入场动画时长。 */
  enterDurationMs: number;
  /** 离场动画时长。 */
  exitDurationMs: number;
}

/** 两种悬浮组件的完整配置。 */
export interface OverlaySettings {
  /** 全屏横向弹幕层设置。 */
  danmaku: DanmakuOverlaySettings;
  /** 侧边事件栏设置。 */
  sidebar: SidebarOverlaySettings;
}
