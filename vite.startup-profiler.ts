import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import type { Plugin } from "vite";

interface TransformStart {
  startedAt: number;
  sourceBytes: number;
}

/**
 * 记录开发服务器首屏请求与模块转换耗时。
 *
 * Vite 的 pre/post 插件分别包住 React 与 WyW/Linaria 转换，因此单个模块的
 * transform 记录包含完整插件链耗时，可以直接定位冷启动最慢文件。
 */
export function createStartupProfiler(): Plugin[] {
  const sessionId = `${Date.now()}-${process.pid}`;
  const profilerStartedAt = performance.now();
  const transformStarts = new Map<string, TransformStart>();
  let logPath = "";
  let logStream: WriteStream | undefined;

  const initializeLog = (root: string) => {
    if (logPath) return;
    const logDirectory = path.resolve(root, ".logs");
    mkdirSync(logDirectory, { recursive: true });
    logPath = path.join(logDirectory, `vite-startup-${sessionId}.jsonl`);
    logStream = createWriteStream(logPath, { flags: "a", encoding: "utf8" });
    logStream.on("error", (error) => {
      console.error("[bilimaku perf] Vite 启动日志写入失败", error);
    });
    writeRecord({
      kind: "vite-profiler-started",
      root,
      processId: process.pid,
    });
    console.info(`[bilimaku perf] Vite 启动日志：${logPath}`);
  };

  const writeRecord = (record: Record<string, unknown>) => {
    if (!logStream) return;
    logStream.write(
      `${JSON.stringify({
        sessionId,
        recordedAt: new Date().toISOString(),
        elapsedMs: Number((performance.now() - profilerStartedAt).toFixed(3)),
        ...record,
      })}\n`,
    );
  };

  const normalizedId = (id: string) => id.replaceAll("\\", "/");
  const shouldTraceModule = (id: string) => {
    const normalized = normalizedId(id);
    return normalized.includes("/src/") || normalized.includes("wyw-in-js");
  };
  const shouldTraceRequest = (url: string) =>
    url === "/"
    || url.startsWith("/src/")
    || url.includes("wyw-in-js")
    || url.startsWith("/@vite/")
    || url.startsWith("/@react-refresh");

  const wrapPluginTransform = (plugin: Plugin) => {
    if (plugin.name.startsWith("bilimaku:startup-profiler")) return;
    const mutablePlugin = plugin as any;
    const hook = mutablePlugin.transform;
    const wrapHandler = (handler: (...args: any[]) => unknown) =>
      async function (this: unknown, ...args: any[]) {
        const startedAt = performance.now();
        try {
          return await handler.apply(this, args);
        } finally {
          const durationMs = performance.now() - startedAt;
          if (durationMs >= 50) {
            writeRecord({
              kind: "plugin-transform",
              pluginName: plugin.name,
              moduleId: normalizedId(String(args[1] ?? "unknown")),
              durationMs: Number(durationMs.toFixed(3)),
            });
          }
        }
      };

    if (typeof hook === "function") {
      mutablePlugin.transform = wrapHandler(hook);
    } else if (hook && typeof hook.handler === "function") {
      mutablePlugin.transform = {
        ...hook,
        handler: wrapHandler(hook.handler),
      };
    }
  };

  const prePlugin: Plugin = {
    name: "bilimaku:startup-profiler-pre",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      initializeLog(config.root);
      for (const plugin of config.plugins) wrapPluginTransform(plugin);
      writeRecord({
        kind: "vite-transform-plugins",
        plugins: config.plugins
          .filter((plugin) => Boolean(plugin.transform))
          .map((plugin) => plugin.name),
      });
    },
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        writeRecord({ kind: "vite-listening" });
      });
      server.httpServer?.once("close", () => {
        logStream?.end();
      });

      server.middlewares.use((request, response, next) => {
        const url = request.url ?? "";
        if (request.method === "POST" && url === "/__bilimaku_startup_metrics") {
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            try {
              writeRecord({ kind: "browser-report", report: JSON.parse(raw) });
              response.statusCode = 204;
            } catch (error) {
              writeRecord({
                kind: "browser-report-error",
                detail: error instanceof Error ? error.message : String(error),
              });
              response.statusCode = 400;
            }
            response.end();
          });
          return;
        }

        const startedAt = performance.now();
        response.once("finish", () => {
          if (!shouldTraceRequest(url)) return;
          writeRecord({
            kind: "http-response",
            method: request.method,
            url,
            statusCode: response.statusCode,
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
          });
        });
        next();
      });
    },
    transform(code, id) {
      if (shouldTraceModule(id)) {
        transformStarts.set(id, {
          startedAt: performance.now(),
          sourceBytes: Buffer.byteLength(code, "utf8"),
        });
      }
      return null;
    },
  };

  const postPlugin: Plugin = {
    name: "bilimaku:startup-profiler-post",
    apply: "serve",
    enforce: "post",
    transform(_code, id) {
      const started = transformStarts.get(id);
      if (!started) return null;
      transformStarts.delete(id);
      const durationMs = performance.now() - started.startedAt;
      const moduleId = normalizedId(id);
      writeRecord({
        kind: "module-transform",
        moduleId,
        sourceBytes: started.sourceBytes,
        durationMs: Number(durationMs.toFixed(3)),
      });
      if (durationMs >= 250) {
        console.info(
          `[bilimaku perf] transform ${durationMs.toFixed(1)}ms ${moduleId}`,
        );
      }
      return null;
    },
  };

  return [prePlugin, postPlugin];
}
