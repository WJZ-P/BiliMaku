/**
 * 跨组件、跨 Portal 的全局堆叠层级。
 *
 * 组件内部的装饰层继续使用 0～9 的局部 z-index；只有需要与其他组件竞争
 * 显示顺序的固定层、浮层和 Portal 才引用这里，避免业务代码随意堆叠大数字。
 */
export const globalLayers = {
  /** 普通应用内容。 */
  content: 0,
  /** 侧边导航等常驻应用框架。 */
  navigation: 100,
  /** 自绘窗口标题栏。 */
  titleBar: 1_000,
  /** 下拉菜单、账号资料卡等可交互浮层。 */
  popover: 2_000,
  /** 全局说明 Tooltip；必须覆盖其触发来源所在的 Popover。 */
  tooltip: 3_000,
  /** 模态遮罩。 */
  modalBackdrop: 4_000,
  /** 模态窗口主体。 */
  modal: 4_100,
  /** 全局通知与错误提示。 */
  notification: 5_000,
} as const satisfies Record<string, number>;

/** 可供需要声明层级名称的公共组件复用。 */
export type GlobalLayerName = keyof typeof globalLayers;
