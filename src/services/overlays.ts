import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LiveEvent } from "../types/events";
import type { OverlayKind, OverlaySettings, SidebarOverlaySettings } from "../types/overlay";
import { isDesktopRuntime } from "./desktop";

const SETTINGS_KEY = "bilicast.overlay.settings.v1";
const SETTINGS_EVENT = "overlay://settings";
const PREVIEW_EVENT = "overlay://preview";

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
    verticalStartPercent: 7,
    verticalEndPercent: 68,
    laneGap: 12,
    maxVisible: 32,
  },
  sidebar: {
    clickThrough: true,
    side: "right",
    width: 390,
    height: 720,
    enabledEventTypes: ["message", "interaction", "gift", "superchat", "guard"],
    maxEvents: 12,
    lifetimeSeconds: 18,
    showAvatar: true,
    showUserId: false,
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    fontSize: 14,
    fontWeight: 600,
    textColor: "#f7fbff",
    colors: defaultColors,
    backgroundColor: "#0d1d2f",
    cardOpacity: 0.9,
    blur: 12,
    radius: 8,
    slideDistance: 52,
    enterDurationMs: 320,
    exitDurationMs: 280,
  },
};

type LegacySidebarSettings = Partial<SidebarOverlaySettings> & {
  backgroundOpacity?: number;
};

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
  const current = { ...stored };
  delete current.backgroundOpacity;
  const merged = {
    ...defaultOverlaySettings.sidebar,
    ...current,
    colors: {
      ...defaultOverlaySettings.sidebar.colors,
      ...stored.colors,
    },
  };
  return usedLegacyDefaults
    ? {
        ...merged,
        backgroundColor: defaultOverlaySettings.sidebar.backgroundColor,
        cardOpacity: defaultOverlaySettings.sidebar.cardOpacity,
        blur: defaultOverlaySettings.sidebar.blur,
        radius: defaultOverlaySettings.sidebar.radius,
        slideDistance: defaultOverlaySettings.sidebar.slideDistance,
        enterDurationMs: defaultOverlaySettings.sidebar.enterDurationMs,
        exitDurationMs: defaultOverlaySettings.sidebar.exitDurationMs,
      }
    : merged;
}

export function loadOverlaySettings(): OverlaySettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultOverlaySettings;
    const parsed = JSON.parse(stored) as Partial<OverlaySettings>;
    return {
      danmaku: {
        ...defaultOverlaySettings.danmaku,
        ...parsed.danmaku,
        colors: {
          ...defaultOverlaySettings.danmaku.colors,
          ...parsed.danmaku?.colors,
        },
      },
      sidebar: mergeSidebarSettings(parsed.sidebar as LegacySidebarSettings | undefined),
    };
  } catch {
    return defaultOverlaySettings;
  }
}

function windowOptions(kind: OverlayKind, settings: OverlaySettings) {
  const target = kind === "danmaku" ? settings.danmaku : settings.sidebar;
  return {
    clickThrough: target.clickThrough,
    width: settings.sidebar.width,
    height: settings.sidebar.height,
    side: settings.sidebar.side,
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

export async function openOverlay(kind: OverlayKind, settings = loadOverlaySettings()) {
  if (!isDesktopRuntime()) {
    throw new Error("透明悬浮窗需要从 BiliCast 桌面窗口启动");
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

export async function getRuntimeOverlaySettings(): Promise<OverlaySettings | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<OverlaySettings | null>("get_overlay_settings");
}

export async function previewOverlayEvent(event: LiveEvent) {
  if (!isDesktopRuntime()) return;
  await invoke("preview_overlay_event", { event });
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
