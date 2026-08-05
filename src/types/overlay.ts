import type { LiveEventType } from "./events";

export type OverlayKind = "danmaku" | "sidebar";
export type OverlaySide = "left" | "right";

export interface EventColorMap {
  message: string;
  interaction: string;
  gift: string;
  superchat: string;
  guard: string;
  system: string;
}

export interface DanmakuOverlaySettings {
  clickThrough: boolean;
  enabledEventTypes: LiveEventType[];
  showUsername: boolean;
  showAvatar: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  colors: EventColorMap;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowBlur: number;
  motionMode: "speed" | "duration";
  speedPixelsPerSecond: number;
  durationSeconds: number;
  enterDurationMs: number;
  exitDurationMs: number;
  verticalStartPercent: number;
  verticalEndPercent: number;
  laneGap: number;
  maxVisible: number;
}

export interface SidebarOverlaySettings {
  clickThrough: boolean;
  side: OverlaySide;
  width: number;
  height: number;
  enabledEventTypes: LiveEventType[];
  maxEvents: number;
  lifetimeSeconds: number;
  showAvatar: boolean;
  showUserId: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  colors: EventColorMap;
  backgroundColor: string;
  backgroundOpacity: number;
  cardOpacity: number;
  blur: number;
  radius: number;
  slideDistance: number;
  enterDurationMs: number;
  exitDurationMs: number;
}

export interface OverlaySettings {
  danmaku: DanmakuOverlaySettings;
  sidebar: SidebarOverlaySettings;
}
