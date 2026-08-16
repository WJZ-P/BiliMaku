import { getAppTheme, saveAppTheme } from "./desktop";
import { theme, themePalettes, type ThemeColorTokens } from "../styles/theme";
import {
  DEFAULT_THEME_MODE,
  isThemeMode,
  type ThemeMode,
} from "../types/theme";

/** 同源 WebView 的首帧主题缓存；Rust 配置仍是最终持久化来源。 */
export const THEME_STORAGE_KEY = "bilimaku.ui-theme";
/** CSS、Canvas 与 WebGL 共用的主题变更事件。 */
export const THEME_CHANGE_EVENT = "bilimaku:theme-change";

export interface ThemeChangeDetail {
  /** 切换前主题。 */
  previousMode: ThemeMode;
  /** 切换后的目标主题。 */
  mode: ThemeMode;
  /** 动画开始时的 performance 时间戳。 */
  startedAt: number;
  /** 调色板插值总时长；0 表示立即刷新。 */
  durationMs: number;
}

interface SetThemeModeOptions {
  /** 是否绘制深浅色过渡。 */
  animate?: boolean;
  /** 是否同步写入 Rust 统一配置。 */
  persist?: boolean;
  /** 是否把变更广播给已经打开的悬浮窗口。 */
  broadcast?: boolean;
}

let transitionTimer = 0;
let storageListenerInitialized = false;
let themeBroadcastChannel: BroadcastChannel | null = null;

function cachedThemeMode(): ThemeMode {
  try {
    const cached = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(cached) ? cached : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function writeThemeCache(mode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // 禁用本地存储时仍可在当前运行周期使用主题，Rust 持久化不受影响。
  }
}

/** 在 React 挂载前同步写入主题，避免深色模式出现浅色首帧。 */
export function initializeThemeMode(): ThemeMode {
  const mode = cachedThemeMode();
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  if (!storageListenerInitialized) {
    storageListenerInitialized = true;
    if ("BroadcastChannel" in window) {
      themeBroadcastChannel = new BroadcastChannel("bilimaku-theme");
      themeBroadcastChannel.addEventListener("message", (event) => {
        if (!isThemeMode(event.data) || event.data === getThemeMode()) return;
        void setThemeMode(event.data, {
          animate: true,
          persist: false,
          broadcast: false,
        });
      });
    }
    // storage 事件作为旧版 WebView2 或 BroadcastChannel 不可用时的回退。
    window.addEventListener("storage", (event) => {
      if (
        event.key !== THEME_STORAGE_KEY
        || !isThemeMode(event.newValue)
        || event.newValue === getThemeMode()
      ) return;
      void setThemeMode(event.newValue, {
        animate: true,
        persist: false,
        broadcast: false,
      });
    });
  }
  return mode;
}

/** 返回当前 DOM 已应用的主题。 */
export function getThemeMode(): ThemeMode {
  const value = document.documentElement.dataset.theme;
  return isThemeMode(value) ? value : cachedThemeMode();
}

/** React 外部状态订阅器，主题变更时只刷新真正读取模式的组件。 */
export function subscribeThemeMode(listener: () => void) {
  const handleChange = () => listener();
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
}

/**
 * 切换主题并广播统一动画时间轴。
 *
 * CSS 负责常规组件颜色插值，Canvas/WebGL 监听同一事件后更新各自调色板，
 * 因而不会在组件动画进行到一半时突然跳色。
 */
export async function setThemeMode(
  mode: ThemeMode,
  options: SetThemeModeOptions = {},
): Promise<void> {
  const root = document.documentElement;
  const previousMode = getThemeMode();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = options.animate === false || reducedMotion
    ? 0
    : theme.motion.themeTransitionDurationMs;

  writeThemeCache(mode);

  if (transitionTimer) window.clearTimeout(transitionTimer);
  if (durationMs > 0 && previousMode !== mode) {
    root.dataset.themeTransitioning = "true";
    // 先让自定义颜色属性获得 transition，再写入目标主题值。
    void root.offsetWidth;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    transitionTimer = window.setTimeout(() => {
      delete root.dataset.themeTransitioning;
      transitionTimer = 0;
    }, durationMs + 80);
  } else {
    delete root.dataset.themeTransitioning;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }

  window.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, {
    detail: {
      previousMode,
      mode,
      startedAt: performance.now(),
      durationMs: previousMode === mode ? 0 : durationMs,
    },
  }));
  if (options.broadcast !== false) themeBroadcastChannel?.postMessage(mode);

  if (options.persist !== false) await saveAppTheme(mode);
}

/** 启动后以 Rust 统一配置校准首帧缓存。 */
export async function hydrateThemeMode(): Promise<ThemeMode> {
  const persisted = await getAppTheme();
  if (persisted !== getThemeMode()) {
    await setThemeMode(persisted, { animate: true, persist: false });
  }
  return persisted;
}

/** 将主题动画的线性进度转换为柔和的 ease-in-out 进度。 */
export function themeTransitionProgress(
  detail: ThemeChangeDetail,
  timestamp: number,
) {
  if (detail.durationMs <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (timestamp - detail.startedAt) / detail.durationMs));
  return linear * linear * (3 - 2 * linear);
}

export type RgbColor = readonly [number, number, number];

/** 解析主题使用的十六进制或 rgb 颜色，返回 0-255 RGB。 */
export function parseThemeColor(value: string, fallback: RgbColor): RgbColor {
  const normalized = value.trim();
  const shortHex = normalized.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  if (shortHex) {
    return [
      Number.parseInt(shortHex[1] + shortHex[1], 16),
      Number.parseInt(shortHex[2] + shortHex[2], 16),
      Number.parseInt(shortHex[3] + shortHex[3], 16),
    ];
  }
  const hex = normalized.match(/^#([\da-f]{6})$/i)?.[1];
  if (hex) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }
  const rgb = normalized.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return fallback;
}

/** 按 CSS 变量名读取某个主题的最终语义色，避免动画起点被误当成目标值。 */
export function resolveThemeColor(
  mode: ThemeMode,
  cssVariable: string,
  fallback: string,
) {
  const kebabName = cssVariable.replace(/^--bc-color-/, "");
  const semanticName = kebabName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const colors = themePalettes[mode].colors;
  return semanticName in colors
    ? colors[semanticName as keyof ThemeColorTokens]
    : fallback;
}

/** 在两种主题颜色之间做 RGB 插值，供 Canvas 与 WebGL 共用。 */
export function mixThemeColor(from: string, to: string, progress: number) {
  const start = parseThemeColor(from, [67, 143, 241]);
  const end = parseThemeColor(to, start);
  const amount = Math.min(1, Math.max(0, progress));
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** 在两组 Shader RGB uniform 之间插值。 */
export function mixThemeRgb(from: RgbColor, to: RgbColor, progress: number): RgbColor {
  const amount = Math.min(1, Math.max(0, progress));
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}
