import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import react from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { darkTheme, lightTheme, theme } from "./src/styles/theme.ts";
import { createStartupProfiler } from "./vite.startup-profiler.ts";

const host = process.env.TAURI_DEV_HOST;
const localDevelopmentHost = host || "127.0.0.1";
const localCacheDirectory = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "bilimaku", "vite-cache")
  : path.resolve(process.cwd(), "node_modules", ".vite");

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

function collectSourceSnapshot(directory: string): Map<string, string> {
  const sources = new Map<string, string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [filePath, source] of collectSourceSnapshot(entryPath)) {
        sources.set(filePath, source);
      }
      continue;
    }
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    sources.set(normalizePath(entryPath), readFileSync(entryPath, "utf8"));
  }
  return sources;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const sourceRoot = normalizePath(path.resolve(process.cwd(), "src"));
const themeModulePath = normalizePath(
  path.resolve(process.cwd(), "src", "styles", "theme.ts"),
);
const sourceSnapshot = collectSourceSnapshot(sourceRoot);
const viteClientEnvironmentPath = normalizePath(
  path.resolve(process.cwd(), "node_modules", "vite", "dist", "client", "env.mjs"),
);
sourceSnapshot.set(
  viteClientEnvironmentPath,
  readFileSync(viteClientEnvironmentPath, "utf8"),
);
for (const vendorModule of [
  ["@linaria", "react", "dist", "index.mjs"],
  ["@linaria", "core", "dist", "index.mjs"],
  ["@emotion", "is-prop-valid", "dist", "emotion-is-prop-valid.esm.js"],
  ["@emotion", "memoize", "dist", "emotion-memoize.esm.js"],
]) {
  const vendorPath = normalizePath(
    path.resolve(process.cwd(), "node_modules", ...vendorModule),
  );
  sourceSnapshot.set(vendorPath, readFileSync(vendorPath, "utf8"));
}
const linariaSources = [...sourceSnapshot]
  .filter(([, source]) => source.includes("@linaria/"))
  .map(([filePath]) => filePath);
const linariaSourceSet = new Set(linariaSources);
const linariaSourceFilter = new RegExp(
  `^(?:${linariaSources.map(escapeRegExp).join("|")})(?:\\?.*)?$`,
);
const sourceModuleExtensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];

function resolveSourceSnapshotId(source: string, importer?: string) {
  const cleanSource = source.split("?", 1)[0];
  let unresolvedPath: string | undefined;

  if (cleanSource.startsWith("/src/")) {
    unresolvedPath = path.resolve(process.cwd(), cleanSource.slice(1));
  } else if (cleanSource.startsWith(".") && importer) {
    const cleanImporter = importer.split("?", 1)[0];
    unresolvedPath = path.resolve(path.dirname(cleanImporter), cleanSource);
  }

  if (!unresolvedPath) return null;
  const normalizedBase = normalizePath(unresolvedPath);
  for (const extension of sourceModuleExtensions) {
    const directCandidate = `${normalizedBase}${extension}`;
    if (sourceSnapshot.has(directCandidate)) return directCandidate;

    const indexCandidate = `${normalizedBase}/index${extension}`;
    if (sourceSnapshot.has(indexCandidate)) return indexCandidate;
  }
  return null;
}

/**
 * 开发期把启动时已经读取过的小型 TS/TSX 源码保留在内存中。
 * 项目位于非系统盘时，可避免 Vite 为每个并发模块再次触发高延迟随机读取。
 */
function createDevelopmentSourceCache(): Plugin {
  let devServer: ViteDevServer | undefined;
  const updateSource = (filePath: string) => {
    const normalized = normalizePath(filePath);
    if (!normalized.startsWith(`${sourceRoot}/`)) return;
    if (!/\.[cm]?[jt]sx?$/.test(normalized)) return;
    try {
      const source = readFileSync(filePath, "utf8");
      sourceSnapshot.set(normalized, source);
      const usedLinaria = source.includes("@linaria/");
      if (usedLinaria !== linariaSourceSet.has(normalized)) {
        if (usedLinaria) linariaSourceSet.add(normalized);
        else linariaSourceSet.delete(normalized);
        void devServer?.restart();
      }
    } catch (error) {
      console.warn(`[bilimaku perf] 更新源码内存快照失败：${filePath}`, error);
    }
  };

  return {
    name: "bilimaku:development-source-cache",
    apply: "serve",
    enforce: "pre",
    resolveId(source, importer) {
      // Vite 默认解析每个相对导入时会到项目盘执行 stat；对已经位于快照中的
      // 源码直接返回绝对路径，避开 W: 盘冷启动时的高延迟随机 I/O。
      return resolveSourceSnapshotId(source, importer);
    },
    configureServer(server) {
      devServer = server;
      server.watcher.on("add", updateSource);
      server.watcher.on("change", updateSource);
      server.watcher.on("unlink", (filePath) => {
        const normalized = normalizePath(filePath);
        sourceSnapshot.delete(normalized);
        if (linariaSourceSet.delete(normalized)) void server.restart();
      });
    },
    load(id) {
      const normalized = normalizePath(id.split("?", 1)[0]);
      const source = sourceSnapshot.get(normalized);
      return source === undefined ? null : { code: source, map: null };
    },
  };
}

export default defineConfig(({ command }) => ({
  clearScreen: false,
  cacheDir: localCacheDirectory,
  plugins: [
    ...createStartupProfiler(),
    createDevelopmentSourceCache(),
    react(),
    wyw({
      include: linariaSourceFilter,
      // DevTools 中使用“文件名 + styled 变量名”，生产构建仅保留短哈希。
      displayName: command === "serve",
      classNameSlug:
        command === "serve" ? "[name]__[title]__[index]" : "[hash]",
      sourceMap: false,
      configFile: false,
      staticBindings: {
        [themeModulePath]: { darkTheme, lightTheme, theme },
      },
      eval: { resolver: "native" },
    }),
  ],
  optimizeDeps: {
    // 显式预构建常用依赖，同时保留 Vite 的依赖发现作为兜底。
    // 等待首轮 crawl 收束后再向 WebView 供给模块，避免冷启动时回退到 React 的 CJS 入口。
    noDiscovery: false,
    holdUntilCrawlEnd: true,
    exclude: ["@linaria/core", "@linaria/react"],
    include: [
      "react",
      "react-dom/client",
      "react/jsx-dev-runtime",
      "@tauri-apps/api/core",
      "@tauri-apps/api/dpi",
      "@tauri-apps/api/event",
      "@tauri-apps/api/window",
      "@tauri-apps/plugin-dialog",
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
    warmup: {
      clientFiles: linariaSources,
    },
    // 本机桌面开发显式绑定 IPv4 回环，避开 WebView2 在 localhost 上
    // 触发 DNS 或系统代理自动发现时的数秒等待。
    host: localDevelopmentHost,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/resources/**",
        "**/.logs/**",
        "**/docs/**",
        "**/examples/**",
        "**/scripts/**",
      ],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" || process.platform === "win32"
        ? "chrome105"
        : "safari13",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
}));
