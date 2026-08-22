import { styled } from "@linaria/react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CardDanmakuParticles } from "../../components/CardDanmakuParticles";
import { Icon } from "../../components/Icon";
import {
  FrostedPanel as SettingsPanel,
  FrostedPanelSurface as SettingsPanelSurface,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
} from "../../components/ui";
import {
  checkAppUpdate,
  getDesktopStatus,
  installAppUpdate,
  listenToAppUpdateProgress,
  openAppReleasePage,
} from "../../services/desktop";
import { theme } from "../../styles/theme";
import type { AppUpdateProgress, AppUpdateStatus } from "../../types/app";

type UpdateViewState = "idle" | "current" | "available" | "installing" | "error";

const UpdateBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 18px 20px 20px;

  @media (max-width: 680px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const UpdateSummary = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
`;

const UpdateIcon = styled.span`
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-left: 2px solid color-mix(in srgb, ${theme.colors.brand} 68%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, ${theme.colors.brandSoft} 66%, transparent), transparent),
    color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 76%, transparent);
  color: ${theme.colors.brandDeep};
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
`;

const UpdateCopy = styled.div`
  display: grid;
  min-width: 0;
  gap: 5px;
`;

const UpdateHeading = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
`;

const UpdateVersion = styled.strong`
  color: ${theme.colors.textPrimary};
  font-size: ${theme.typography.fontSize.title};
  font-weight: 850;
  letter-spacing: 0.01em;
`;

const UpdateBadge = styled.span`
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 30%, ${theme.colors.border});
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.brandSoft} 54%, transparent);
  color: ${theme.colors.brandDeep};
  font-size: ${theme.typography.fontSize.caption};
  font-weight: 800;
  transition:
    color ${theme.motion.normal},
    border-color ${theme.motion.normal},
    background ${theme.motion.normal};

  &[data-state="current"] {
    border-color: color-mix(in srgb, ${theme.colors.success} 34%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.successSoft} 72%, transparent);
    color: ${theme.colors.success};
  }

  &[data-state="available"] {
    border-color: color-mix(in srgb, ${theme.colors.warning} 40%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.warningSoft} 76%, transparent);
    color: ${theme.colors.warning};
  }

  &[data-state="error"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 34%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.dangerSoft} 72%, transparent);
    color: ${theme.colors.danger};
  }
`;

const UpdateDescription = styled.div`
  color: ${theme.colors.textMuted};
  font-size: ${theme.typography.fontSize.caption};
  font-weight: 620;
  line-height: 1.55;

  &[data-state="error"] {
    color: ${theme.colors.danger};
  }
`;

const UpdateActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 680px) {
    justify-content: flex-start;
  }
`;

const UpdateProgressArea = styled.div`
  display: grid;
  grid-column: 1 / -1;
  gap: 6px;
  padding-top: 2px;
`;

const UpdateProgressTrack = styled.div`
  position: relative;
  height: 5px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 22%, ${theme.colors.border});
  border-radius: 3px;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 72%, transparent);
`;

const UpdateProgressFill = styled.div`
  width: var(--update-progress, 0%);
  height: 100%;
  background: ${theme.gradients.brand};
  box-shadow: 0 0 10px color-mix(in srgb, ${theme.colors.brand} 34%, transparent);
  transition: width 180ms ease-out;
`;

const UpdateProgressMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: ${theme.typography.fontSize.meta};
  font-variant-numeric: tabular-nums;
`;

const UpdateButton = styled.button`
  display: inline-flex;
  min-width: 104px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 82%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: ${theme.typography.fontSize.caption};
  font-weight: 800;
  cursor: pointer;
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  transition:
    color ${theme.motion.fast},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    transform ${theme.motion.spring};

  &[data-primary="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 72%, transparent);
    background: ${theme.gradients.brand};
    color: ${theme.colors.textOnBrand};
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 58%, transparent),
      0 7px 16px color-mix(in srgb, ${theme.colors.brand} 16%, transparent);
  }

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 58%, ${theme.colors.borderStrong});
    color: ${theme.colors.brandDeep};
  }

  &[data-primary="true"]:hover:not(:disabled) {
    color: ${theme.colors.textOnBrand};
    transform: translateX(2px);
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 48%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }
`;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

/** 应用设置页中的版本检测与 Release 跳转卡片。 */
export function AppUpdatePanel() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getDesktopStatus().then((status) => {
      if (active && status) setCurrentVersion(status.version);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenToAppUpdateProgress((next) => {
      if (!disposed) setProgress(next);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const checkUpdate = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      const result = await checkAppUpdate();
      setUpdateStatus(result);
      setCurrentVersion(result.currentVersion);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const installUpdate = async () => {
    if (installing) return;
    setInstalling(true);
    setError("");
    setProgress({
      phase: "checking",
      percent: null,
      downloadedBytes: 0,
      totalBytes: null,
      message: "正在确认最新正式版本",
    });
    try {
      await installAppUpdate();
    } catch (reason) {
      setError(errorText(reason));
      setInstalling(false);
    }
  };

  const openReleasePage = async () => {
    setError("");
    try {
      await openAppReleasePage();
    } catch (reason) {
      setError(errorText(reason));
    }
  };

  const state: UpdateViewState = error
    ? "error"
    : installing
      ? "installing"
      : updateStatus?.updateAvailable
        ? "available"
        : updateStatus
          ? "current"
          : "idle";
  const badge = busy
    ? "检查中"
    : state === "installing"
      ? "正在更新"
      : state === "available"
        ? "发现新版本"
        : state === "current"
          ? "已是最新"
          : state === "error"
            ? "检查失败"
            : "手动检查";
  const description = busy
    ? "正在连接 GitHub Release…"
    : installing
      ? progress?.message || "正在准备应用内更新"
      : error
        ? error
        : updateStatus?.updateAvailable
          ? updateStatus.installSupported
            ? `最新正式版 v${updateStatus.latestVersion}，可在应用内下载并安装；重新打开后生效`
            : `最新正式版 v${updateStatus.latestVersion}，点击即可前往下载`
          : updateStatus
            ? `GitHub 最新正式版同为 v${updateStatus.latestVersion}`
            : "检查 GitHub 最新正式 Release；Windows x64 免安装版支持应用内更新";

  return (
    <SettingsPanel>
      <SettingsPanelSurface>
        <CardDanmakuParticles seed={0x55504454} />
        <PanelHeader>
          <PanelHeading>
            <PanelTitle>版本与更新</PanelTitle>
            <PanelDescription>检查正式版本，Windows 免安装版可直接更新</PanelDescription>
          </PanelHeading>
        </PanelHeader>
        <UpdateBody>
          <UpdateSummary>
            <UpdateIcon aria-hidden="true">
              <Icon name="sparkles" size={20} />
            </UpdateIcon>
            <UpdateCopy>
              <UpdateHeading>
                <UpdateVersion>
                  BiliMaku {currentVersion ? `v${currentVersion}` : "版本读取中"}
                </UpdateVersion>
                <UpdateBadge data-state={state}>{badge}</UpdateBadge>
              </UpdateHeading>
              <UpdateDescription data-state={state} aria-live="polite">
                {description}
              </UpdateDescription>
            </UpdateCopy>
          </UpdateSummary>
          <UpdateActions>
            {updateStatus?.updateAvailable ? (
              <>
                {updateStatus.installSupported ? (
                  <UpdateButton
                    type="button"
                    data-primary="true"
                    disabled={installing}
                    onClick={() => void installUpdate()}
                  >
                    <Icon name="download" size={14} />
                    {installing
                      ? progress?.percent == null
                        ? "正在准备…"
                        : `下载 ${progress.percent}%`
                      : "下载并安装"}
                  </UpdateButton>
                ) : (
                  <UpdateButton
                    type="button"
                    data-primary="true"
                    onClick={() => void openReleasePage()}
                  >
                    <Icon name="download" size={14} />
                    下载 v{updateStatus.latestVersion}
                  </UpdateButton>
                )}
                <UpdateButton
                  type="button"
                  disabled={installing}
                  onClick={() => void openReleasePage()}
                >
                  Release 页面
                </UpdateButton>
              </>
            ) : (
              <>
                <UpdateButton
                  type="button"
                  data-primary="true"
                  disabled={busy}
                  onClick={() => void checkUpdate()}
                >
                  <Icon name="sparkles" size={14} />
                  {busy ? "正在检查…" : updateStatus ? "再次检查" : "检查更新"}
                </UpdateButton>
                <UpdateButton type="button" onClick={() => void openReleasePage()}>
                  <Icon name="arrow" size={14} />
                  Release 页面
                </UpdateButton>
              </>
            )}
          </UpdateActions>
          {installing && progress ? (
            <UpdateProgressArea aria-live="polite">
              <UpdateProgressTrack
                role="progressbar"
                aria-label="应用更新进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent ?? undefined}
              >
                <UpdateProgressFill
                  style={{
                    "--update-progress": `${progress.percent ?? 8}%`,
                  } as CSSProperties}
                />
              </UpdateProgressTrack>
              <UpdateProgressMeta>
                <span>{progress.message}</span>
                <span>
                  {formatBytes(progress.downloadedBytes)}
                  {progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}
                </span>
              </UpdateProgressMeta>
            </UpdateProgressArea>
          ) : null}
        </UpdateBody>
      </SettingsPanelSurface>
    </SettingsPanel>
  );
}
