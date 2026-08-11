/** 应用设置页聚合展示的冷启动与自动化偏好。 */
export interface StartupBehaviorSettings {
  /** 冷启动时恢复最近一次直播间长链。 */
  autoConnect: boolean;
  /** 冷启动时恢复全屏滚动弹幕悬浮窗。 */
  autoOpenDanmaku: boolean;
  /** 冷启动时恢复侧边事件播报悬浮窗。 */
  autoOpenSidebar: boolean;
  /** 收到符合语音筛选规则的事件后自动加入播报队列。 */
  autoSpeak: boolean;
}

/** 设置页在 Rust 配置加载完成前使用的稳定默认值。 */
export const DEFAULT_STARTUP_BEHAVIOR_SETTINGS: StartupBehaviorSettings = {
  autoConnect: false,
  autoOpenDanmaku: false,
  autoOpenSidebar: false,
  autoSpeak: true,
};
