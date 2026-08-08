import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isDesktopRuntime } from "./desktop";

export type MainWindowMode = "login" | "workspace";

/** 登录窗口默认保持 3:2；如需调整登录页宽高，请同步修改 Tauri 的启动窗口尺寸。 */
const loginSize = new LogicalSize(690, 460);
const loginMinimumSize = new LogicalSize(690, 460);
const workspaceSize = new LogicalSize(960, 640);
const workspaceMinimumSize = new LogicalSize(840, 560);

let requestedMode: MainWindowMode | null = null;
let transition: Promise<void> = Promise.resolve();
let mainWindowRevealed = false;

async function applyWindowMode(mode: MainWindowMode) {
  const appWindow = getCurrentWindow();
  if (mode === "login") {
    await appWindow.unmaximize();
    await appWindow.setMaximizable(false);
    await appWindow.setMinSize(loginMinimumSize);
    await appWindow.setSize(loginSize);
    await appWindow.setResizable(false);
    await appWindow.center();
    return;
  }

  await appWindow.setResizable(true);
  await appWindow.setMaximizable(true);
  await appWindow.setMinSize(workspaceMinimumSize);
  await appWindow.setSize(workspaceSize);
  await appWindow.center();
}

/** 根据鉴权结果把同一个主窗口切换为 3:2 登录窗或紧凑工作台。 */
export function configureMainWindow(mode: MainWindowMode): Promise<void> {
  if (!isDesktopRuntime()) return Promise.resolve();
  if (requestedMode === mode) return transition;
  requestedMode = mode;
  transition = transition
    .catch(() => undefined)
    .then(() => applyWindowMode(mode))
    .catch((error) => {
      if (requestedMode === mode) requestedMode = null;
      throw error;
    });
  return transition;
}

/** Reveal the initially hidden main window only after its final startup route is ready. */
export async function revealMainWindowOnce(): Promise<void> {
  if (!isDesktopRuntime() || mainWindowRevealed) return;
  await getCurrentWindow().show();
  mainWindowRevealed = true;
}
