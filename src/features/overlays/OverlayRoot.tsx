import { DanmakuOverlayWindow } from "./DanmakuOverlayWindow";
import { EventSidebarOverlayWindow } from "./EventSidebarOverlayWindow";

interface OverlayRootProps {
  mode: "danmaku" | "sidebar";
}

export function OverlayRoot({ mode }: OverlayRootProps) {
  return mode === "danmaku" ? <DanmakuOverlayWindow /> : <EventSidebarOverlayWindow />;
}
