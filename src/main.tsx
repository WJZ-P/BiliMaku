import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { OverlayRoot } from "./features/overlays/OverlayRoot";

const root = document.getElementById("root");

if (!root) {
  throw new Error("BiliCast root element was not found");
}

const overlayMode = new URLSearchParams(window.location.search).get("overlay");

if (overlayMode === "danmaku" || overlayMode === "sidebar") {
  document.documentElement.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "transparent";
  root.style.background = "transparent";
  createRoot(root).render(<OverlayRoot mode={overlayMode} />);
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
