/** 浏览器启动时间线中的单个阶段或资源请求。 */
export interface StartupMetric {
  /** 阶段名称，例如 html-inline、frontend-entry-evaluated。 */
  stage: string;
  /** 相对于 performance.timeOrigin 的毫秒数。 */
  elapsedMs: number;
  /** 阶段自身耗时；瞬时标记不填写。 */
  durationMs?: number;
  /** 文件路径、状态或触发原因等补充信息。 */
  detail?: string;
}

/** index.html 在任何模块下载前创建的页面级启动时间线。 */
export interface StartupTimeline {
  sessionId: string;
  timeOriginMs: number;
  marks: StartupMetric[];
  mark(stage: string, detail?: string, durationMs?: number): void;
}

/** 前端发送给 Vite 与 Rust 的完整启动采样报告。 */
export interface FrontendStartupReport {
  sessionId: string;
  timeOriginMs: number;
  reason: string;
  location: string;
  userAgent: string;
  metrics: StartupMetric[];
}

declare global {
  interface Window {
    __BILIMAKU_STARTUP__?: StartupTimeline;
  }
}

export {};
