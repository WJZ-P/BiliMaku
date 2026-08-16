import { styled } from "@linaria/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
} from "react";
import { createPortal } from "react-dom";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import type { AccountProfile } from "../types/account";
import { Icon } from "./Icon";
import { LiquidGlassSurface } from "./LiquidGlassSurface";

interface AccountProfileTooltipProps {
  /** 当前登录账号的主站资料。 */
  profile: AccountProfile;
  /** 当前连接的真实直播间号；未连接时为 0。 */
  roomId: number;
  /** 本场累计看过人数。 */
  watchedCount: number | null;
  /** 本场累计点赞次数。 */
  likeCount: number | null;
}

interface ProfileTooltipPosition {
  x: number;
  y: number;
  arrowX: number;
}

type ProfileTooltipCssVariables = CSSProperties & {
  "--profile-tooltip-x": string;
  "--profile-tooltip-y": string;
  "--profile-tooltip-arrow-x": string;
};

const VIEWPORT_MARGIN_PX = 10;
const TOOLTIP_GAP_PX = 8;
const TOOLTIP_CLOSE_DELAY_MS = 140;
const COPY_FEEDBACK_DURATION_MS = 1_200;

type CopyTarget = "room" | "uid";

const Trigger = styled.button`
  display: grid;
  width: ${theme.titleBar.avatarSizePx + 4}px;
  height: 100%;
  flex: 0 0 ${theme.titleBar.avatarSizePx + 4}px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${theme.colors.textSecondary};
  cursor: default;

  & > img,
  & > span {
    transition:
      transform ${theme.motion.spring},
      filter ${theme.motion.normal};
  }

  &:hover > img,
  &:hover > span,
  &:focus-visible > img,
  &:focus-visible > span {
    filter: drop-shadow(
      0 5px 12px color-mix(in srgb, ${theme.colors.brand} 28%, transparent)
    );
    transform: translateY(-1px) scale(1.045);
  }

  &:focus-visible {
    outline: 0;
  }
`;

const TriggerAvatar = styled.img`
  display: block;
  width: ${theme.titleBar.avatarSizePx}px;
  height: ${theme.titleBar.avatarSizePx}px;
  border-radius: 50%;
  background: ${theme.colors.brandSoft};
  object-fit: cover;
`;

const TriggerFallback = styled.span`
  display: grid;
  width: ${theme.titleBar.avatarSizePx}px;
  height: ${theme.titleBar.avatarSizePx}px;
  place-items: center;
  border-radius: 50%;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 18px;
  font-weight: 850;
`;

const TooltipShell = styled.div`
  position: fixed;
  z-index: ${globalLayers.popover};
  top: var(--profile-tooltip-y);
  left: var(--profile-tooltip-x);
  width: min(${theme.titleBar.profileTooltipWidthPx}px, calc(100vw - 20px));
  max-height: calc(100vh - var(--profile-tooltip-y) - 10px);
  /* 透明度与位移动画不能放在这一层，否则会截断子层的背景采样。 */
  visibility: hidden;
  pointer-events: none;
  transition: visibility 0s linear ${theme.tooltip.exitDurationMs}ms;

  &[data-visible="true"] {
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }
`;

const TooltipArrow = styled.span`
  position: absolute;
  z-index: 0;
  top: -5px;
  left: var(--profile-tooltip-arrow-x);
  width: 10px;
  height: 10px;
  border-top: 1px solid ${theme.colors.prismBorder};
  border-left: 1px solid ${theme.colors.prismBorder};
  background: ${theme.colors.prismSurface};
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  box-shadow: -2px -2px 5px color-mix(in srgb, ${theme.colors.highlight} 34%, transparent);
  opacity: 0;
  transform: translateX(-50%) rotate(45deg);
  transition: opacity ${theme.tooltip.exitDurationMs}ms ease;

  [data-visible="true"] & {
    opacity: 0.82;
  }
`;

const GlassCard = styled.div`
  position: relative;
  z-index: 1;
  isolation: isolate;
  overflow: hidden;
  opacity: 0;
  transform: translate3d(0, ${theme.tooltip.entranceOffsetPx}px, 0) scale(0.985);
  transform-origin: var(--profile-tooltip-arrow-x) top;
  transition:
    opacity ${theme.tooltip.exitDurationMs}ms ease,
    transform ${theme.tooltip.exitDurationMs}ms ease;
  will-change: opacity, transform;
  border: 1px solid ${theme.colors.prismBorder};
  border-radius: ${theme.tooltip.radius};
  background-image:
    radial-gradient(circle at 14% -8%, color-mix(in srgb, ${theme.colors.highlight} 56%, transparent), transparent 44%),
    linear-gradient(138deg, color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 80%, transparent), color-mix(in srgb, ${theme.colors.prismSurface} 84%, transparent));
  background-color: color-mix(in srgb, ${theme.colors.prismBase} 22%, transparent);
  box-shadow:
    0 24px 64px color-mix(in srgb, ${theme.colors.textPrimary} 16%, transparent),
    0 7px 20px ${theme.colors.prismShadow},
    inset 0 1px 0 ${theme.colors.prismRim},
    inset 1px 0 0 color-mix(in srgb, ${theme.colors.highlight} 34%, transparent),
    inset 0 -1px 0 color-mix(in srgb, ${theme.colors.brandDeep} 8%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
  backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});

  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background-image: url("/textures/frosted-noise.svg");
    background-size: 96px 96px;
    content: "";
    mix-blend-mode: soft-light;
    opacity: ${theme.frostedGlass.noiseOpacity};
    pointer-events: none;
  }

  &::after {
    position: absolute;
    z-index: 0;
    inset: 0;
    background:
      linear-gradient(
        112deg,
        color-mix(in srgb, ${theme.colors.highlight} 24%, transparent),
        transparent 31%
      ),
      radial-gradient(
        circle at 78% 112%,
        color-mix(in srgb, ${theme.colors.textMuted} 8%, transparent),
        transparent 46%
      );
    content: "";
    pointer-events: none;
  }

  & > canvas {
    mix-blend-mode: soft-light;
    opacity: ${theme.frostedGlass.refractionOpacity};
  }

  [data-visible="true"] & {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    transition:
      opacity ${theme.motion.normal},
      transform ${theme.motion.spring};
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: opacity ${theme.motion.fast};

    [data-visible="true"] & {
      transform: none;
      transition: opacity ${theme.motion.fast};
    }
  }
`;

const GlassAccent = styled.span`
  position: absolute;
  z-index: 3;
  top: 0;
  right: 12px;
  left: 12px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, ${theme.colors.highlight} 90%, transparent) 22%,
    color-mix(in srgb, ${theme.colors.highlight} 42%, transparent) 72%,
    transparent
  );
  opacity: 0.86;
`;

const CardContent = styled.div`
  position: relative;
  z-index: 2;
  padding: 16px;
`;

const ProfileHeader = styled.div`
  display: grid;
  grid-template-columns: ${theme.titleBar.profileTooltipAvatarSizePx}px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
`;

const ProfileAvatar = styled.img`
  width: ${theme.titleBar.profileTooltipAvatarSizePx}px;
  height: ${theme.titleBar.profileTooltipAvatarSizePx}px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 68%, transparent);
  border-radius: 50%;
  background: ${theme.colors.brandSoft};
  box-shadow: 0 7px 18px color-mix(in srgb, ${theme.colors.brandDeep} 16%, transparent);
  object-fit: cover;
`;

const ProfileAvatarFallback = styled.span`
  display: grid;
  width: ${theme.titleBar.profileTooltipAvatarSizePx}px;
  height: ${theme.titleBar.profileTooltipAvatarSizePx}px;
  place-items: center;
  border-radius: 50%;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 24px;
  font-weight: 850;
`;

const Identity = styled.div`
  min-width: 0;
`;

const ProfileName = styled.strong`
  display: block;
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 17px;
  font-weight: 850;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const IdentityLine = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-width: 0;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  color: ${theme.colors.textMuted};
  font-size: ${theme.titleBar.profileIdentityFontSize};
  line-height: 1.35;

  strong {
    overflow: hidden;
    color: ${theme.colors.textSecondary};
    font-family: ${theme.typography.mono};
    font-size: ${theme.titleBar.profileIdentityFontSize};
    font-weight: 760;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const IdentityValue = styled.span`
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-self: start;
  gap: 3px;
`;

const CopyButton = styled.button`
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 58%, transparent);
  border-radius: 2px;
  background: color-mix(in srgb, ${theme.colors.surface} 22%, transparent);
  color: ${theme.colors.textMuted};
  cursor: pointer;
  opacity: 0.76;
  transition:
    color ${theme.motion.fast},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    opacity ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &:focus-visible {
    border-color: color-mix(in srgb, ${theme.colors.brand} 72%, ${theme.colors.border});
    outline: 0;
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 46%, transparent);
    color: ${theme.colors.brandDeep};
    opacity: 1;
    transform: translateY(-1px) scale(1.06);
  }

  &[data-copied="true"] {
    border-color: color-mix(in srgb, ${theme.colors.success} 72%, ${theme.colors.border});
    color: ${theme.colors.success};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.28;
    transform: none;
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: 14px -16px 12px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, ${theme.colors.borderStrong} 76%, transparent) 12%,
    color-mix(in srgb, ${theme.colors.borderStrong} 76%, transparent) 88%,
    transparent
  );
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 -16px;
  padding: 10px 12px;
  border-block: 1px solid
    color-mix(in srgb, ${theme.colors.highlight} 28%, ${theme.colors.border});
  background: color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 66%, transparent);
`;

const Metric = styled.div`
  min-width: 0;
  padding: 3px 5px 5px;
  text-align: center;

  &:not(:last-child) {
    border-right: 1px solid
      color-mix(in srgb, ${theme.colors.borderStrong} 48%, transparent);
  }
`;

const MetricLabel = styled.span`
  display: block;
  overflow: hidden;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetricValue = styled.strong`
  display: block;
  overflow: hidden;
  margin-top: 5px;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.mono};
  font-size: 15px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExperienceBlock = styled.div`
  margin-top: 12px;
`;

const ExperienceCopy = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 650;

  strong {
    color: ${theme.colors.textSecondary};
    font-family: ${theme.typography.mono};
    font-size: 9px;
  }
`;

const ExperienceTrack = styled.div`
  height: 4px;
  margin-top: 6px;
  overflow: hidden;
  background: color-mix(in srgb, ${theme.colors.borderStrong} 66%, transparent);
`;

const ExperienceProgress = styled.span`
  display: block;
  width: var(--profile-level-progress);
  height: 100%;
  background: ${theme.gradients.brand};
  box-shadow: 0 0 9px color-mix(in srgb, ${theme.colors.brand} 38%, transparent);
  transition: width ${theme.motion.spring};
`;

const compactNumber = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const decimalNumber = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function levelProgress(profile: AccountProfile) {
  if (profile.nextExp === null) return profile.level >= 6 ? 1 : 0;
  const levelSpan = profile.nextExp - profile.currentMinExp;
  if (levelSpan <= 0) return 0;
  return clamp(
    (profile.currentExp - profile.currentMinExp) / levelSpan,
    0,
    1,
  );
}

function experienceDescription(profile: AccountProfile) {
  if (profile.nextExp === null) return "当前等级已满";
  return `${profile.currentExp.toLocaleString("zh-CN")} / ${profile.nextExp.toLocaleString("zh-CN")}`;
}

function liveMetric(value: number | null) {
  return value === null ? "--" : compactNumber.format(value);
}

/** 写入系统剪贴板，并兼容未开放 Clipboard API 的 WebView 环境。 */
async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // 某些 WebView 协议会拒绝 Clipboard API，继续使用同步回退方案。
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-10000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("浏览器未完成剪贴板写入");
}

export function AccountProfileTooltip({
  profile,
  roomId,
  watchedCount,
  likeCount,
}: AccountProfileTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasVisibleRef = useRef(false);
  const pointerCloseTimerRef = useRef<number | undefined>(undefined);
  const copyFeedbackTimerRef = useRef<number | undefined>(undefined);
  const [pointerOpen, setPointerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [position, setPosition] = useState<ProfileTooltipPosition>({
    x: VIEWPORT_MARGIN_PX,
    y: theme.titleBar.avatarSizePx + TOOLTIP_GAP_PX,
    arrowX: theme.titleBar.avatarSizePx / 2,
  });
  const visible = pointerOpen || focused;

  const openFromPointer = useCallback(() => {
    if (pointerCloseTimerRef.current !== undefined) {
      window.clearTimeout(pointerCloseTimerRef.current);
      pointerCloseTimerRef.current = undefined;
    }
    setPointerOpen(true);
  }, []);

  const closeFromPointer = useCallback(() => {
    if (pointerCloseTimerRef.current !== undefined) {
      window.clearTimeout(pointerCloseTimerRef.current);
    }
    pointerCloseTimerRef.current = window.setTimeout(() => {
      pointerCloseTimerRef.current = undefined;
      setPointerOpen(false);
    }, TOOLTIP_CLOSE_DELAY_MS);
  }, []);

  const handleFocusOut = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setFocused(false);
  }, []);

  const handleCopy = useCallback(async (target: CopyTarget, value: string) => {
    try {
      await writeClipboardText(value);
      setCopiedTarget(target);
      if (copyFeedbackTimerRef.current !== undefined) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        copyFeedbackTimerRef.current = undefined;
        setCopiedTarget(null);
      }, COPY_FEEDBACK_DURATION_MS);
    } catch (error) {
      console.warn("bilimaku profile value copy failed", error);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const cardWidth = Math.min(
      theme.titleBar.profileTooltipWidthPx,
      Math.max(1, window.innerWidth - VIEWPORT_MARGIN_PX * 2),
    );
    const x = clamp(
      rect.left - 4,
      VIEWPORT_MARGIN_PX,
      Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - cardWidth - VIEWPORT_MARGIN_PX),
    );
    setPosition({
      x,
      y: rect.bottom + TOOLTIP_GAP_PX,
      arrowX: clamp(rect.left + rect.width / 2 - x, 16, cardWidth - 16),
    });
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    return () => window.removeEventListener("resize", onViewportChange);
  }, [updatePosition, visible]);

  useLayoutEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setAnimationKey((current) => current + 1);
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => () => {
    if (pointerCloseTimerRef.current !== undefined) {
      window.clearTimeout(pointerCloseTimerRef.current);
    }
    if (copyFeedbackTimerRef.current !== undefined) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
  }, []);

  const style: ProfileTooltipCssVariables = {
    "--profile-tooltip-x": `${position.x}px`,
    "--profile-tooltip-y": `${position.y}px`,
    "--profile-tooltip-arrow-x": `${position.arrowX}px`,
  };
  const progress = levelProgress(profile);
  const progressStyle = {
    "--profile-level-progress": `${progress * 100}%`,
  } as CSSProperties;
  const tooltipId = `bilimaku-account-profile-${profile.uid}`;

  return (
    <>
      <Trigger
        ref={triggerRef}
        type="button"
        data-no-drag="true"
        aria-label={`查看 ${profile.username} 的账号信息`}
        aria-controls={tooltipId}
        aria-expanded={visible}
        aria-haspopup="dialog"
        onPointerEnter={openFromPointer}
        onPointerLeave={closeFromPointer}
        onFocus={() => setFocused(true)}
        onBlur={handleFocusOut}
      >
        {profile.avatar ? (
          <TriggerAvatar
            src={profile.avatar}
            alt={`${profile.username} 的头像`}
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ) : (
          <TriggerFallback aria-hidden="true">
            {profile.username.trim().slice(0, 1) || "B"}
          </TriggerFallback>
        )}
      </Trigger>

      {createPortal(
        <TooltipShell
          id={tooltipId}
          role="dialog"
          aria-label={`${profile.username} 的账号信息`}
          aria-hidden={!visible}
          data-no-drag="true"
          data-visible={visible}
          style={style}
          onPointerEnter={openFromPointer}
          onPointerLeave={closeFromPointer}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={handleFocusOut}
        >
          <TooltipArrow aria-hidden="true" />
          <GlassCard>
            <LiquidGlassSurface
              active={visible}
              animationKey={animationKey}
              radiusPx={6}
            />
            <GlassAccent aria-hidden="true" />
            <CardContent>
              <ProfileHeader>
                {profile.avatar ? (
                  <ProfileAvatar
                    src={profile.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <ProfileAvatarFallback aria-hidden="true">
                    {profile.username.trim().slice(0, 1) || "B"}
                  </ProfileAvatarFallback>
                )}
                <Identity>
                  <ProfileName>{profile.username}</ProfileName>
                  <IdentityLine>
                    <span>房间 ID</span>
                    <IdentityValue>
                      <strong>{roomId > 0 ? roomId : "--"}</strong>
                      <CopyButton
                        type="button"
                        aria-label={copiedTarget === "room" ? "房间 ID 已复制" : "复制房间 ID"}
                        data-copied={copiedTarget === "room"}
                        data-tooltip={copiedTarget === "room" ? "已复制" : "复制房间 ID"}
                        disabled={roomId <= 0}
                        onClick={() => void handleCopy("room", String(roomId))}
                      >
                        <Icon name={copiedTarget === "room" ? "check" : "copy"} size={13} />
                      </CopyButton>
                    </IdentityValue>
                  </IdentityLine>
                  <IdentityLine>
                    <span>UID</span>
                    <IdentityValue>
                      <strong>{profile.uid}</strong>
                      <CopyButton
                        type="button"
                        aria-label={copiedTarget === "uid" ? "UID 已复制" : "复制 UID"}
                        data-copied={copiedTarget === "uid"}
                        data-tooltip={copiedTarget === "uid" ? "已复制" : "复制 UID"}
                        onClick={() => void handleCopy("uid", String(profile.uid))}
                      >
                        <Icon name={copiedTarget === "uid" ? "check" : "copy"} size={13} />
                      </CopyButton>
                    </IdentityValue>
                  </IdentityLine>
                </Identity>
              </ProfileHeader>

              <Divider />

              <MetricGrid>
                <Metric>
                  <MetricLabel>账号等级</MetricLabel>
                  <MetricValue>LV{profile.level}</MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>硬币余额</MetricLabel>
                  <MetricValue>{decimalNumber.format(profile.coins)}</MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>本场看过</MetricLabel>
                  <MetricValue>{liveMetric(watchedCount)}</MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>本场点赞</MetricLabel>
                  <MetricValue>{liveMetric(likeCount)}</MetricValue>
                </Metric>
              </MetricGrid>

              <ExperienceBlock>
                <ExperienceCopy>
                  <span>等级经验</span>
                  <strong>{experienceDescription(profile)}</strong>
                </ExperienceCopy>
                <ExperienceTrack>
                  <ExperienceProgress style={progressStyle} />
                </ExperienceTrack>
              </ExperienceBlock>
            </CardContent>
          </GlassCard>
        </TooltipShell>,
        document.body,
      )}
    </>
  );
}
