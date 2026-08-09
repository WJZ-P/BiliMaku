import { styled } from "@linaria/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { AccountProfile } from "../types/account";
import { theme } from "../styles/theme";
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
  z-index: 12000;
  top: var(--profile-tooltip-y);
  left: var(--profile-tooltip-x);
  width: min(${theme.titleBar.profileTooltipWidthPx}px, calc(100vw - 20px));
  max-height: calc(100vh - var(--profile-tooltip-y) - 10px);
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(0, ${theme.tooltip.entranceOffsetPx}px, 0) scale(0.985);
  transform-origin: var(--profile-tooltip-arrow-x) top;
  transition:
    opacity ${theme.tooltip.exitDurationMs}ms ease,
    transform ${theme.tooltip.exitDurationMs}ms ease,
    visibility 0s linear ${theme.tooltip.exitDurationMs}ms;

  &[data-visible="true"] {
    visibility: visible;
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    transition:
      opacity ${theme.motion.normal},
      transform ${theme.motion.spring},
      visibility 0s linear 0s;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: opacity ${theme.motion.fast}, visibility 0s linear ${theme.tooltip.exitDurationMs}ms;

    &[data-visible="true"] {
      transform: none;
      transition: opacity ${theme.motion.fast}, visibility 0s linear 0s;
    }
  }
`;

const TooltipArrow = styled.span`
  position: absolute;
  z-index: 0;
  top: -5px;
  left: var(--profile-tooltip-arrow-x);
  width: 10px;
  height: 10px;
  border-top: 1px solid
    color-mix(in srgb, ${theme.colors.highlight} 38%, ${theme.colors.border});
  border-left: 1px solid
    color-mix(in srgb, ${theme.colors.highlight} 38%, ${theme.colors.border});
  background: color-mix(
    in srgb,
    ${theme.colors.surface} ${theme.tooltip.surfaceMix},
    transparent
  );
  backdrop-filter: blur(${theme.tooltip.blur}) saturate(${theme.tooltip.backdropSaturation});
  transform: translateX(-50%) rotate(45deg);
`;

const GlassCard = styled.div`
  position: relative;
  z-index: 1;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid
    color-mix(in srgb, ${theme.colors.highlight} 42%, ${theme.colors.border});
  border-radius: ${theme.tooltip.radius};
  background:
    radial-gradient(
      circle at 16% 0%,
      color-mix(in srgb, ${theme.colors.highlight} 20%, transparent),
      transparent 52%
    ),
    linear-gradient(
      145deg,
      color-mix(
        in srgb,
        ${theme.colors.surface} ${theme.tooltip.surfaceMix},
        transparent
      ),
      color-mix(
        in srgb,
        ${theme.colors.brandSubtle} ${theme.tooltip.accentMix},
        transparent
      )
    );
  box-shadow:
    0 18px 42px color-mix(in srgb, ${theme.colors.brandDeep} 15%, transparent),
    0 4px 14px color-mix(in srgb, ${theme.colors.shadowStrong} 32%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 48%, transparent),
    inset 0 -1px 0 color-mix(in srgb, ${theme.colors.brand} 10%, transparent);
  -webkit-backdrop-filter: blur(${theme.tooltip.blur})
    saturate(${theme.tooltip.backdropSaturation})
    brightness(${theme.tooltip.backdropBrightness})
    contrast(${theme.tooltip.backdropContrast});
  backdrop-filter: blur(${theme.tooltip.blur})
    saturate(${theme.tooltip.backdropSaturation})
    brightness(${theme.tooltip.backdropBrightness})
    contrast(${theme.tooltip.backdropContrast});
`;

const GlassAccent = styled.span`
  position: absolute;
  z-index: 3;
  top: 6px;
  left: 12px;
  width: 28px;
  height: 1px;
  background: linear-gradient(90deg, ${theme.colors.cyan}, transparent);
  box-shadow: 0 0 9px color-mix(in srgb, ${theme.colors.cyan} 36%, transparent);
  opacity: 0.58;
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
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 5px;
  margin-top: 5px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.2;

  strong {
    overflow: hidden;
    color: ${theme.colors.textSecondary};
    font-family: ${theme.typography.mono};
    font-size: 10px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 28%, transparent);
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

export function AccountProfileTooltip({
  profile,
  roomId,
  watchedCount,
  likeCount,
}: AccountProfileTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasVisibleRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [position, setPosition] = useState<ProfileTooltipPosition>({
    x: VIEWPORT_MARGIN_PX,
    y: theme.titleBar.avatarSizePx + TOOLTIP_GAP_PX,
    arrowX: theme.titleBar.avatarSizePx / 2,
  });
  const visible = hovered || focused;

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

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setAnimationKey((current) => current + 1);
    }
    wasVisibleRef.current = visible;
  }, [visible]);

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
        aria-describedby={visible ? tooltipId : undefined}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
          role="tooltip"
          aria-hidden={!visible}
          data-visible={visible}
          style={style}
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
                    <strong>{roomId > 0 ? roomId : "--"}</strong>
                  </IdentityLine>
                  <IdentityLine>
                    <span>UID</span>
                    <strong>{profile.uid}</strong>
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
