import { lazy, startTransition, Suspense, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { LoginPage } from "./features/auth/LoginPage";
import { useAccountSession } from "./features/auth/useAccountSession";
import {
  flushStartupMetrics,
  markStartup,
} from "./services/startupPerformance";
import { configureMainWindow, revealMainWindowOnce } from "./services/window";
import { AppFrame, Main, ViewLoading } from "./styles/AppStyles";
import { GlobalStyles } from "./styles/GlobalStyles";
import type { BilibiliLoginStatus } from "./types/account";
import type { AppView } from "./types/navigation";
import type { TtsSettings } from "./types/tts";

markStartup("app-module-evaluated");

const DashboardPage = lazy(() => {
  markStartup("dashboard-module-requested");
  return import("./features/dashboard/DashboardPage").then((module) => {
    markStartup("dashboard-module-resolved");
    return { default: module.DashboardPage };
  });
});
const LiveRoomProvider = lazy(() =>
  import("./features/dashboard/LiveRoomContext").then((module) => ({
    default: module.LiveRoomProvider,
  })),
);
const DebugPage = lazy(() =>
  import("./features/debug/DebugPage").then((module) => ({
    default: module.DebugPage,
  })),
);
const ConnectionPage = lazy(() =>
  import("./features/connection/ConnectionPage").then((module) => ({
    default: module.ConnectionPage,
  })),
);
const OverlaySettingsPage = lazy(() =>
  import("./features/overlays/OverlaySettingsPage").then((module) => ({
    default: module.OverlaySettingsPage,
  })),
);
const FeaturePage = lazy(() =>
  import("./features/shared/FeaturePage").then((module) => ({
    default: module.FeaturePage,
  })),
);
const VoiceStudioPage = lazy(() =>
  import("./features/voices/VoiceStudioPage").then((module) => ({
    default: module.VoiceStudioPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

/** 工作台页面按独立分块构建，并在首帧后依次预取。 */
const viewPreloaders: Record<AppView, () => Promise<unknown>> = {
  dashboard: () => import("./features/dashboard/DashboardPage"),
  debug: () => import("./features/debug/DebugPage"),
  rules: () => import("./features/shared/FeaturePage"),
  voices: () => import("./features/voices/VoiceStudioPage"),
  overlays: () => import("./features/overlays/OverlaySettingsPage"),
  connection: () => import("./features/connection/ConnectionPage"),
  settings: () => import("./features/settings/SettingsPage"),
};

const secondaryViews: AppView[] = [
  "connection",
  "debug",
  "overlays",
  "voices",
  "rules",
  "settings",
];

function preloadView(view: AppView) {
  return viewPreloaders[view]();
}

interface WorkspaceProps {
  accountStatus: BilibiliLoginStatus;
  onAccountStatusChange: (status: BilibiliLoginStatus) => void;
}

function Workspace({ accountStatus, onAccountStatusChange }: WorkspaceProps) {
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  useEffect(() => {
    let active = true;
    let timeoutHandle: number | undefined;
    let idleHandle: number | undefined;
    const idleScheduler = window as unknown as {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const preloadSecondaryViews = async () => {
      for (const view of secondaryViews) {
        if (!active) return;
        try {
          await preloadView(view);
        } catch (error) {
          console.warn(`bilimaku ${view} module preload failed`, error);
        }
      }
    };

    if (idleScheduler.requestIdleCallback) {
      idleHandle = idleScheduler.requestIdleCallback(
        () => void preloadSecondaryViews(),
        { timeout: 1000 },
      );
    } else {
      timeoutHandle = window.setTimeout(() => void preloadSecondaryViews(), 250);
    }

    return () => {
      active = false;
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
      if (idleHandle !== undefined) idleScheduler.cancelIdleCallback?.(idleHandle);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import("./services/overlays")
        .then(async ({ hydrateOverlaySettings, restoreAutoOpenOverlays }) => {
          const settings = await hydrateOverlaySettings();
          await restoreAutoOpenOverlays(settings);
        })
        .catch((error) => {
          console.warn("bilimaku overlay startup restoration failed", error);
        });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let lastWarmKey = "";
    let active = true;
    let preloadTimer: number | undefined;
    let preloadIdle: number | undefined;
    let initializationTimer: number | undefined;
    let removeSettingsListener: (() => void) | undefined;
    const idleScheduler = window as unknown as {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const cancelScheduledPreload = () => {
      if (preloadTimer !== undefined) {
        window.clearTimeout(preloadTimer);
        preloadTimer = undefined;
      }
      if (preloadIdle !== undefined) {
        idleScheduler.cancelIdleCallback?.(preloadIdle);
        preloadIdle = undefined;
      }
    };
    const warm = (
      settings: TtsSettings,
      preloadTtsModel: typeof import("./services/tts")["preloadTtsModel"],
    ) => {
      const key = `${settings.provider}:${settings.modelId}:${settings.autoSpeak}`;
      if (key === lastWarmKey) return;
      lastWarmKey = key;
      if (settings.provider !== "custom" || !settings.modelId || !settings.autoSpeak) return;
      cancelScheduledPreload();
      const run = () => {
        void preloadTtsModel(settings.modelId)
          .catch((error) => {
            console.warn("bilimaku TTS background preload failed", error);
          });
      };
      if (idleScheduler.requestIdleCallback) {
        preloadIdle = idleScheduler.requestIdleCallback(run, { timeout: 5000 });
      } else {
        preloadTimer = window.setTimeout(run, 2500);
      }
    };
    const initialize = async () => {
      const service = await import("./services/tts");
      if (!active) return;
      const warmWithService = (settings: TtsSettings) =>
        warm(settings, service.preloadTtsModel);
      const onSettings = (event: Event) => {
        warmWithService((event as CustomEvent<TtsSettings>).detail);
      };
      warmWithService(service.loadTtsSettings());
      window.addEventListener(service.TTS_SETTINGS_EVENT, onSettings);
      removeSettingsListener = () =>
        window.removeEventListener(service.TTS_SETTINGS_EVENT, onSettings);
      void service.hydrateTtsSettings().then(warmWithService).catch((error) => {
        console.warn("bilimaku TTS settings hydration failed", error);
      });
    };
    initializationTimer = window.setTimeout(() => {
      void initialize().catch((error) => {
        console.warn("bilimaku TTS service initialization failed", error);
      });
    }, 1200);
    return () => {
      active = false;
      if (initializationTimer !== undefined) window.clearTimeout(initializationTimer);
      cancelScheduledPreload();
      removeSettingsListener?.();
    };
  }, []);

  const navigate = (view: AppView) => {
    void preloadView(view);
    startTransition(() => setActiveView(view));
  };

  return (
    <Suspense fallback={<ViewLoading>正在初始化直播会话…</ViewLoading>}>
      <LiveRoomProvider>
        {/* 视图仍可按需卸载，但直播长链与事件缓冲由上层 Provider 持续持有。 */}
        <AppFrame>
          <Sidebar
            activeView={activeView}
            onNavigate={navigate}
            onPreload={(view) => void preloadView(view)}
          />
          <Main data-view={activeView}>
            <Suspense fallback={<ViewLoading>正在加载功能模块…</ViewLoading>}>
              {activeView === "dashboard" && <DashboardPage onNavigate={navigate} />}
              {activeView === "debug" && <DebugPage />}
              {activeView === "rules" && <FeaturePage view="rules" />}
              {activeView === "voices" && <VoiceStudioPage />}
              {activeView === "overlays" && <OverlaySettingsPage />}
              {activeView === "connection" && (
                <ConnectionPage onNavigateDashboard={() => navigate("dashboard")} />
              )}
              {activeView === "settings" && (
                <SettingsPage
                  accountStatus={accountStatus}
                  onAccountStatusChange={onAccountStatusChange}
                />
              )}
            </Suspense>
          </Main>
        </AppFrame>
      </LiveRoomProvider>
    </Suspense>
  );
}

let appFirstFrameReported = false;

function waitForRoutePaint() {
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallback);
      resolve();
    };
    // A hidden WebView may pause requestAnimationFrame, so keep a short timer fallback.
    const fallback = window.setTimeout(finish, 64);
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
}

export default function App() {
  const { status, error, setStatus } = useAccountSession();
  const checkingSession = status.phase === "checking";
  const authenticated = status.phase === "authenticated" && status.profile !== null;
  const windowMode = authenticated ? "workspace" : "login";

  useEffect(() => {
    if (!checkingSession) return;
    // Overlap the small dashboard chunk request with Rust's persisted-session validation.
    void preloadView("dashboard").catch((reason) => {
      console.warn("bilimaku dashboard startup preload failed", reason);
    });
  }, [checkingSession]);

  useEffect(() => {
    if (checkingSession) return;
    let active = true;

    const prepareAndReveal = async () => {
      markStartup("account-session-resolved", status.phase);
      const startupTasks: Promise<unknown>[] = [configureMainWindow(windowMode)];
      if (authenticated) startupTasks.push(preloadView("dashboard"));
      const [windowResult, dashboardResult] = await Promise.allSettled(startupTasks);

      if (windowResult.status === "rejected") {
        console.warn(`bilimaku ${windowMode} window configuration failed`, windowResult.reason);
      }
      if (dashboardResult?.status === "rejected") {
        console.warn("bilimaku dashboard startup preload failed", dashboardResult.reason);
      }
      if (!active) return;

      await waitForRoutePaint();
      if (!active) return;
      try {
        await revealMainWindowOnce();
        markStartup("main-window-revealed", windowMode);
      } catch (reason) {
        console.warn("bilimaku main window reveal failed", reason);
      }
    };

    void prepareAndReveal();
    return () => {
      active = false;
    };
  }, [authenticated, checkingSession, windowMode]);

  useEffect(() => {
    if (checkingSession || appFirstFrameReported) return;
    appFirstFrameReported = true;
    markStartup("app-react-committed");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        markStartup("app-first-frame");
        void flushStartupMetrics("app-first-frame");
      });
    });
  }, [checkingSession]);

  return (
    <GlobalStyles windowMode={windowMode}>
      {checkingSession ? null : (
        <>
          <WindowTitleBar compact={!authenticated} profile={status.profile} />
          {authenticated ? (
            <Workspace accountStatus={status} onAccountStatusChange={setStatus} />
          ) : (
            <LoginPage status={status} startupError={error} onStatusChange={setStatus} />
          )}
        </>
      )}
    </GlobalStyles>
  );
}
