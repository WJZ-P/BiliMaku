import { GlobalStyles } from "../../styles/GlobalStyles";
import { DanmakuOverlayWindow } from "./DanmakuOverlayWindow";
import { EventSidebarOverlayWindow } from "./EventSidebarOverlayWindow";

interface OverlayRootProps {
  mode: "danmaku" | "sidebar";
}

export function OverlayRoot({ mode }: OverlayRootProps) {
  return (
    <GlobalStyles windowMode="overlay">
      {mode === "danmaku" ? <DanmakuOverlayWindow /> : <EventSidebarOverlayWindow />}
    </GlobalStyles>
  );
}
