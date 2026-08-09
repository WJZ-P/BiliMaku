import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LiveEvent } from "../types/events";
import type {
  DanmakuOverlaySettings,
  OverlayAutoOpenState,
  OverlayKind,
  OverlaySettings,
  OverlayWindowStateUpdate,
  SidebarOverlaySettings,
} from "../types/overlay";
import { isDesktopRuntime } from "./desktop";

const SETTINGS_KEY = "bilimaku.overlay.settings.v1";
const LEGACY_SETTINGS_KEY = "bilicast.overlay.settings.v1";
const SETTINGS_EVENT = "overlay://settings";
const PREVIEW_EVENT = "overlay://preview";
const WINDOW_STATE_EVENT = "overlay://window-state";

const DEFAULT_USERNAME_COLOR = "#66CCFF";
const DANMAKU_LANE_LAYOUT_VERSION = 2;
const LEGACY_DANMAKU_VERTICAL_START_PERCENT = 7;

const defaultColors = {
  message: "#ffffff",
  interaction: "#78f0c0",
  gift: "#b8a8ff",
  superchat: "#ffd285",
  guard: "#75e8f3",
  system: "#dcecff",
};

export const defaultOverlaySettings: OverlaySettings = {
  danmaku: {
    clickThrough: true,
    enabledEventTypes: ["message"],
    showUsername: true,
    usernameColor: DEFAULT_USERNAME_COLOR,
    showAvatar: false,
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    fontSize: 36,
    fontWeight: 700,
    opacity: 1,
    colors: defaultColors,
    outlineColor: "#17283d",
    outlineWidth: 1.5,
    shadowColor: "#000000",
    shadowBlur: 8,
    motionMode: "speed",
    speedPixelsPerSecond: 180,
    durationSeconds: 10,
    enterDurationMs: 180,
    exitDurationMs: 420,
    laneLayoutVersion: DANMAKU_LANE_LAYOUT_VERSION,
    verticalStartPercent: 0,
    verticalEndPercent: 68,
    laneGap: 12,
    maxVisible: 32,
  },
  sidebar: {
    clickThrough: true,
    editMode: false,
    entryDirection: "bottom",
    verticalAlignment: "bottom",
    width: 390,
    height: 720,
    enabledEventTypes: ["message", "interaction", "gift", "superchat", "guard"],
    maxEvents: 12,
    lifetimeSeconds: 18,
    showAvatar: true,
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    fontSize: 14,
    fontWeight: 600,
    textColor: "#f7fbff",
    usernameColor: DEFAULT_USERNAME_COLOR,
    colors: defaultColors,
    backgroundColor: "#0d1d2f",
    cardOpacity: 0.68,
    blur: 22,
    radius: 6,
    slideDistance: 52,
    scrollDurationMs: 720,
    enterDurationMs: 320,
    exitDurationMs: 280,
  },
};

type LegacyDanmakuSettings = Partial<DanmakuOverlaySettings>;

type LegacySidebarSettings = Partial<SidebarOverlaySettings> & {
  backgroundOpacity?: number;
  showUserId?: boolean;
};

/** 补齐全屏弹幕设置，并把旧版默认的 7% 顶部留白一次性迁移为第一行。 */
function mergeDanmakuSettings(stored?: LegacyDanmakuSettings): DanmakuOverlaySettings {
  if (!stored) return defaultOverlaySettings.danmaku;
  const storedLayoutVersion = stored.laneLayoutVersion ?? 1;
  const migrateLegacyTop = storedLayoutVersion < DANMAKU_LANE_LAYOUT_VERSION
    && stored.verticalStartPercent === LEGACY_DANMAKU_VERTICAL_START_PERCENT;
  return {
    ...defaultOverlaySettings.danmaku,
    ...stored,
    laneLayoutVersion: Math.max(storedLayoutVersion, DANMAKU_LANE_LAYOUT_VERSION),
    verticalStartPercent: migrateLegacyTop
      ? defaultOverlaySettings.danmaku.verticalStartPercent
      : stored.verticalStartPercent ?? defaultOverlaySettings.danmaku.verticalStartPercent,
    colors: {
      ...defaultOverlaySettings.danmaku.colors,
      ...stored.colors,
    },
  };
}

function mergeSidebarSettings(stored?: LegacySidebarSettings): SidebarOverlaySettings {
  if (!stored) return defaultOverlaySettings.sidebar;
  const usedLegacyDefaults = stored.backgroundColor === "#10243a"
    && stored.backgroundOpacity === 0.72
    && stored.cardOpacity === 0.82
    && stored.blur === 16
    && stored.radius === 18
    && stored.slideDistance === 42
    && stored.enterDurationMs === 260
    && stored.exitDurationMs === 360;
  const usedFlatGlassDefaults = stored.backgroundColor === "#0d1d2f"
    && stored.cardOpacity === 0.9
    && stored.blur === 12
    && stored.radius === 8;
  const current = Object.fromEntries(
    Object.entries(stored).filter(([key]) => (
      Object.prototype.hasOwnProperty.call(defaultOverlaySettings.sidebar, key)
    )),
  ) as Partial<SidebarOverlaySettings>;
  const merged = {
    ...defaultOverlaySettings.sidebar,
    ...current,
    colors: {
      ...defaultOverlaySettings.sidebar.colors,
      ...stored.colors,
    },
  };
  if (!usedLegacyDefaults && !usedFlatGlassDefaults) return merged;
  return {
    ...merged,
    backgroundColor: defaultOverlaySettings.sidebar.backgroundColor,
    cardOpacity: defaultOverlaySettings.sidebar.cardOpacity,
    blur: defaultOverlaySettings.sidebar.blur,
    radius: defaultOverlaySettings.sidebar.radius,
    ...(usedLegacyDefaults
      ? {
          slideDistance: defaultOverlaySettings.sidebar.slideDistance,
          enterDurationMs: defaultOverlaySettings.sidebar.enterDurationMs,
          exitDurationMs: defaultOverlaySettings.sidebar.exitDurationMs,
        }
      : {}),
  };
}

function normalizeOverlaySettings(parsed: Partial<OverlaySettings>): OverlaySettings {
  return {
    danmaku: mergeDanmakuSettings(
      parsed.danmaku as LegacyDanmakuSettings | undefined,
    ),
    sidebar: mergeSidebarSettings(parsed.sidebar as LegacySidebarSettings | undefined),
  };
}

export function loadOverlaySettings(): OverlaySettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
      ?? localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!stored) return defaultOverlaySettings;
    const settings = normalizeOverlaySettings(
      JSON.parse(stored) as Partial<OverlaySettings>,
    );
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  } catch {
    return defaultOverlaySettings;
  }
}

function windowOptions(kind: OverlayKind, settings: OverlaySettings) {
  const target = kind === "danmaku" ? settings.danmaku : settings.sidebar;
  return {
    clickThrough: target.clickThrough,
    editMode: kind === "sidebar" && settings.sidebar.editMode,
    width: settings.sidebar.width,
    height: settings.sidebar.height,
  };
}

export async function saveOverlaySettings(settings: OverlaySettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (!isDesktopRuntime()) return;
  await invoke("update_overlay_settings", { settings });
  await Promise.all([
    invoke("update_overlay_window", {
      kind: "danmaku",
      options: windowOptions("danmaku", settings),
    }),
    invoke("update_overlay_window", {
      kind: "sidebar",
      options: windowOptions("sidebar", settings),
    }),
  ]);
}

/** 启动时让 Rust 统一 Store 与前端缓存互相补齐，并以 Store 中已有值为准。 */
export async function hydrateOverlaySettings(): Promise<OverlaySettings> {
  const local = loadOverlaySettings();
  if (!isDesktopRuntime()) return local;
  const stored = await getRuntimeOverlaySettings();
  const settings = stored ?? local;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // 统一补齐新字段并交给 Rust Store 去重；旧配置只会实际落盘一次。
  await invoke("update_overlay_settings", { settings });
  return settings;
}

export async function openOverlay(kind: OverlayKind, settings = loadOverlaySettings()) {
  if (!isDesktopRuntime()) {
    throw new Error("透明悬浮窗需要从 bilimaku 桌面窗口启动");
  }
  await invoke("open_overlay", {
    kind,
    settings,
    options: windowOptions(kind, settings),
  });
}

export async function closeOverlay(kind: OverlayKind) {
  if (!isDesktopRuntime()) return;
  await invoke("close_overlay", { kind });
}

/** 读取上次运行结束时保持开启的悬浮窗。 */
export async function getOverlayAutoOpenState(): Promise<OverlayAutoOpenState> {
  if (!isDesktopRuntime()) return { danmaku: false, sidebar: false };
  return invoke<OverlayAutoOpenState>("get_overlay_auto_open");
}

/** 一次读取两个悬浮窗的实际运行状态。 */
export async function getOverlayWindowState(): Promise<OverlayAutoOpenState> {
  const [danmaku, sidebar] = await Promise.all([
    isOverlayOpen("danmaku"),
    isOverlayOpen("sidebar"),
  ]);
  return { danmaku, sidebar };
}

/**
 * 冷启动时只补开“配置为开启且当前尚未创建”的窗口。
 * 恢复在首帧之后运行，避免影响主窗口冷启动。
 */
export async function restoreAutoOpenOverlays(
  settings = loadOverlaySettings(),
): Promise<OverlayAutoOpenState> {
  if (!isDesktopRuntime()) return { danmaku: false, sidebar: false };
  const [autoOpen, actual] = await Promise.all([
    getOverlayAutoOpenState(),
    getOverlayWindowState(),
  ]);
  const restorations = (["danmaku", "sidebar"] as const).map(async (kind) => {
    if (autoOpen[kind] && !actual[kind]) {
      await openOverlay(kind, settings);
      actual[kind] = true;
    }
  });
  await Promise.all(restorations);
  return actual;
}

/** 拖动结束后由 Rust 选择目标显示器、固定执行防溢出并持久化归一化位置。 */
export async function finalizeSidebarOverlayPosition() {
  if (!isDesktopRuntime()) return;
  await invoke("finalize_sidebar_overlay_position");
}

/** 查询指定悬浮组件的桌面窗口当前是否存在。 */
export async function isOverlayOpen(kind: OverlayKind): Promise<boolean> {
  if (!isDesktopRuntime()) return false;
  return invoke<boolean>("is_overlay_open", { kind });
}

export async function getRuntimeOverlaySettings(): Promise<OverlaySettings | null> {
  if (!isDesktopRuntime()) return null;
  const stored = await invoke<Partial<OverlaySettings> | null>("get_overlay_settings");
  return stored ? normalizeOverlaySettings(stored) : null;
}

export async function previewOverlayEvent(event: LiveEvent) {
  if (!isDesktopRuntime()) return;
  await invoke("preview_overlay_event", { event });
}

export async function listenToOverlayWindowState(
  callback: (update: OverlayWindowStateUpdate) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) return () => undefined;
  return listen<OverlayWindowStateUpdate>(WINDOW_STATE_EVENT, (event) => callback(event.payload));
}

export async function listenToOverlaySettings(
  callback: (settings: OverlaySettings) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) return () => undefined;
  return listen<OverlaySettings>(SETTINGS_EVENT, (event) => callback(event.payload));
}

export async function listenToOverlayPreview(
  callback: (event: LiveEvent) => void,
): Promise<UnlistenFn> {
  if (!isDesktopRuntime()) return () => undefined;
  return listen<LiveEvent>(PREVIEW_EVENT, (event) => callback(event.payload));
}

export function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((part) => `${part}${part}`).join("")
    : value.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}
