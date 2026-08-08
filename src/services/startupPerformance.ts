import type {
  FrontendStartupReport,
  StartupMetric,
} from "../types/performance";

function elapsedNow() {
  return Number(performance.now().toFixed(3));
}

function getTimeline() {
  if (window.__BILIMAKU_STARTUP__) return window.__BILIMAKU_STARTUP__;
  const timeOriginMs = performance.timeOrigin;
  const marks: StartupMetric[] = [];
  window.__BILIMAKU_STARTUP__ = {
    sessionId: `${Math.round(timeOriginMs)}-${Math.random().toString(36).slice(2, 9)}`,
    timeOriginMs,
    marks,
    mark(stage, detail, durationMs) {
      marks.push({ stage, elapsedMs: elapsedNow(), detail, durationMs });
    },
  };
  return window.__BILIMAKU_STARTUP__;
}

/** 写入一个无需等待磁盘或后端的前端启动标记。 */
export function markStartup(
  stage: string,
  detail?: string,
  durationMs?: number,
) {
  getTimeline().mark(stage, detail, durationMs);
  console.info(
    `[bilimaku perf +${performance.now().toFixed(1)}ms] ${stage}`,
    detail ?? "",
  );
}

function collectBrowserTimings(): StartupMetric[] {
  const metrics: StartupMetric[] = [];
  const navigation = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  if (navigation) {
    metrics.push(
      {
        stage: "navigation-response",
        elapsedMs: Number(navigation.responseEnd.toFixed(3)),
        durationMs: Number(
          (navigation.responseEnd - navigation.requestStart).toFixed(3),
        ),
        detail: `${navigation.responseStatus || "unknown"}`,
      },
      {
        stage: "dom-content-loaded",
        elapsedMs: Number(navigation.domContentLoadedEventEnd.toFixed(3)),
      },
      {
        stage: "window-load",
        elapsedMs: Number(navigation.loadEventEnd.toFixed(3)),
      },
    );
  }

  const resources = performance
    .getEntriesByType("resource")
    .filter((entry): entry is PerformanceResourceTiming =>
      entry instanceof PerformanceResourceTiming,
    )
    .filter(
      (entry) =>
        entry.initiatorType === "script"
        || entry.initiatorType === "css"
        || entry.name.includes("/src/"),
    )
    .sort((left, right) => right.duration - left.duration)
    .slice(0, 40);

  for (const entry of resources) {
    let detail = entry.name;
    try {
      const url = new URL(entry.name);
      detail = `${url.pathname}${url.search}`;
    } catch {
      // 浏览器也可能返回不带协议的内部资源名，原样记录即可。
    }
    metrics.push({
      stage: "resource",
      elapsedMs: Number(entry.responseEnd.toFixed(3)),
      durationMs: Number(entry.duration.toFixed(3)),
      detail,
    });
  }

  return metrics;
}

/**
 * 把同一份报告同时交给开发期 Vite 日志和桌面端 Rust 日志。
 * 两条链路彼此独立，任意一条失败都不会阻塞首帧。
 */
export async function flushStartupMetrics(reason: string) {
  const timeline = getTimeline();
  const report: FrontendStartupReport = {
    sessionId: timeline.sessionId,
    timeOriginMs: timeline.timeOriginMs,
    reason,
    location: window.location.href,
    userAgent: navigator.userAgent,
    metrics: [...timeline.marks, ...collectBrowserTimings()],
  };

  const tasks: Promise<unknown>[] = [];
  if (import.meta.env.DEV) {
    tasks.push(
      fetch("/__bilimaku_startup_metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(report),
        keepalive: true,
      }).catch((error) => {
        console.warn("bilimaku Vite 启动性能日志写入失败", error);
      }),
    );
  }

  if ("__TAURI_INTERNALS__" in window) {
    tasks.push(
      import("@tauri-apps/api/core")
        .then(({ invoke }) =>
          invoke<string>("record_startup_metrics", { report }),
        )
        .then((path) => {
          console.info(`[bilimaku perf] Rust 启动日志：${path}`);
        })
        .catch((error) => {
          console.warn("bilimaku Rust 启动性能日志写入失败", error);
        }),
    );
  }

  await Promise.all(tasks);
}
