import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  flushStartupMetrics,
  markStartup,
} from "./services/startupPerformance";

markStartup("frontend-entry-evaluated");

const App = lazy(() => {
  markStartup("app-module-requested");
  return import("./App").then((module) => {
    markStartup("app-module-resolved");
    return module;
  });
});

const OverlayRoot = lazy(() => {
  markStartup("overlay-module-requested");
  return import("./features/overlays/OverlayRoot").then((module) => {
    markStartup("overlay-module-resolved");
    return { default: module.OverlayRoot };
  });
});

function StartupFallback({ transparent = false }: { transparent?: boolean }) {
  if (transparent) return null;
  return (
    <div
      aria-live="polite"
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        background:
          "radial-gradient(circle at 18% 12%, #dff2ff 0, transparent 33%), linear-gradient(145deg, #f8fcff 0%, #eef7ff 100%)",
        color: "#315775",
        fontFamily:
          'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      bilimaku 正在加载工作台…
    </div>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("bilimaku root element was not found");
}

const overlayParameter = new URLSearchParams(window.location.search).get("overlay");
const overlayMode =
  overlayParameter === "danmaku" || overlayParameter === "sidebar"
    ? overlayParameter
    : null;
const isOverlay = overlayMode !== null;

root.replaceChildren();
const reactRoot = createRoot(root);
markStartup("react-root-created", isOverlay ? overlayMode : "main");

if (isOverlay) {
  document.documentElement.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "transparent";
  root.style.background = "transparent";
  reactRoot.render(
    <Suspense fallback={<StartupFallback transparent />}>
      <OverlayRoot mode={overlayMode} />
    </Suspense>,
  );
} else {
  reactRoot.render(
    <StrictMode>
      <Suspense fallback={<StartupFallback />}>
        <App />
      </Suspense>
    </StrictMode>,
  );
}

markStartup("react-render-requested");
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    markStartup("react-shell-first-frame");
    void flushStartupMetrics("react-shell-first-frame");
  });
});
