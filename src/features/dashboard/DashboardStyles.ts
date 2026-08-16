import { styled } from "@linaria/react";
import { theme } from "../../styles/theme";
import type { LiveEventType } from "../../types/events";

export const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

export const Hero = styled.section`
  position: relative;
  display: grid;
  overflow: hidden;
  min-height: 210px;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.75fr);
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 13%, transparent);
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  box-shadow: 0 22px 46px color-mix(in srgb, ${theme.colors.brandDeep} 22%, transparent);

  &::before {
    position: absolute;
    right: 14%;
    bottom: -90px;
    width: 250px;
    height: 250px;
    border: 44px solid color-mix(in srgb, ${theme.colors.highlight} 9%, transparent);
    border-radius: 50%;
    content: "";
  }

  @media (max-width: 1080px) {
    grid-template-columns: minmax(0, 1fr) 230px;
  }
`;

export const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  padding: 25px 28px 24px;
`;

export const HeroBadge = styled.span`
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 34%, transparent);
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, ${theme.colors.highlight} 14%, transparent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  backdrop-filter: blur(8px);
`;

export const HeroDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${theme.colors.cyan};
  box-shadow: 0 0 0 4px color-mix(in srgb, ${theme.colors.cyan} 19%, transparent);

  [data-connected="true"] & {
    background: ${theme.colors.successSoft};
    box-shadow: 0 0 0 4px color-mix(in srgb, ${theme.colors.successSoft} 22%, transparent);
  }
`;

export const HeroTitle = styled.h2`
  max-width: 580px;
  margin: 14px 0 7px;
  font-size: clamp(23px, 2.6vw, 34px);
  font-weight: 850;
  letter-spacing: -0.045em;
  line-height: 1.14;
`;

export const HeroDescription = styled.p`
  max-width: 600px;
  margin: 0;
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 78%, transparent);
  font-size: 12px;
  line-height: 1.65;
`;

export const HeroStatusMessage = styled.div`
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 82%, transparent);
  font-size: 9px;
  font-weight: 650;

  &[data-error="true"] {
    color: ${theme.colors.warningSoft};
  }
`;

export const ConnectForm = styled.form`
  display: flex;
  max-width: 510px;
  gap: 9px;
  margin-top: 18px;
`;

export const RoomInputWrap = styled.label`
  display: flex;
  height: 42px;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 27%, transparent);
  border-radius: ${theme.radius.sm};
  background: color-mix(in srgb, ${theme.colors.surface} 15%, transparent);
  color: color-mix(in srgb, ${theme.colors.textOnBrand} 76%, transparent);
  backdrop-filter: blur(10px);
  transition: all ${theme.motion.fast};

  &:focus-within {
    border-color: color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);
    background: color-mix(in srgb, ${theme.colors.surface} 20%, transparent);
  }
`;

export const RoomInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textOnBrand};
  font-size: 12px;
  font-weight: 650;

  &::placeholder {
    color: color-mix(in srgb, ${theme.colors.textOnBrand} 58%, transparent);
  }
`;

export const ConnectButton = styled.button`
  display: inline-flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 17px;
  border: 0;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surface};
  color: ${theme.colors.brandDeep};
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 9px 20px color-mix(in srgb, ${theme.colors.brandDeep} 22%, transparent);
  transition: all ${theme.motion.fast};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px color-mix(in srgb, ${theme.colors.brandDeep} 29%, transparent);
  }

  &[data-connected="true"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &:disabled {
    cursor: wait;
    opacity: 0.68;
    transform: none;
  }
`;

export const HeroVisual = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
`;

export const Bubble = styled.div`
  position: relative;
  display: grid;
  width: 154px;
  height: 154px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 36%, transparent);
  border-radius: 49% 49% 49% 29%;
  background: color-mix(in srgb, ${theme.colors.surface} 13%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 44%, transparent),
    0 22px 50px color-mix(in srgb, ${theme.colors.brandDeep} 24%, transparent);
  backdrop-filter: blur(18px);

  &::before,
  &::after {
    position: absolute;
    top: -11px;
    width: 42px;
    height: 42px;
    border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 28%, transparent);
    border-right: 0;
    border-bottom: 0;
    border-radius: 9px;
    background: color-mix(in srgb, ${theme.colors.surface} 10%, transparent);
    content: "";
    transform: rotate(45deg);
  }

  &::before {
    left: 24px;
  }

  &::after {
    right: 24px;
  }
`;

export const WaveBars = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  height: 62px;
  align-items: center;
  gap: 7px;

  span {
    width: 7px;
    border-radius: ${theme.radius.pill};
    background: color-mix(in srgb, ${theme.colors.textOnBrand} 88%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, ${theme.colors.cyan} 24%, transparent);
  }

  span:nth-child(1),
  span:nth-child(7) {
    height: 18px;
  }

  span:nth-child(2),
  span:nth-child(6) {
    height: 35px;
  }

  span:nth-child(3),
  span:nth-child(5) {
    height: 52px;
  }

  span:nth-child(4) {
    height: 64px;
    background: ${theme.colors.cyan};
  }
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
`;

export const StatCard = styled.article`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: color-mix(in srgb, ${theme.colors.surface} 90%, transparent);
  box-shadow: ${theme.shadows.inset};
  backdrop-filter: blur(12px);
`;

export const StatIcon = styled.span`
  display: grid;
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  place-items: center;
  border-radius: 13px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};

  &[data-tone="success"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-tone="gift"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-tone="warning"] {
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }
`;

export const StatValue = styled.div`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 18px;
  font-weight: 850;
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const StatLabel = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 650;
`;

export const MainGrid = styled.div`
  display: grid;
  min-height: 382px;
  grid-template-columns: minmax(0, 1.55fr) minmax(310px, 0.9fr);
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1.35fr) minmax(290px, 0.9fr);
  }
`;

export const FilterGroup = styled.div`
  display: flex;
  gap: 5px;
  padding: 3px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
`;

export const FilterButton = styled.button`
  height: 27px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 700;

  &[data-active="true"] {
    background: ${theme.colors.surface};
    color: ${theme.colors.brandDeep};
    box-shadow: 0 3px 8px ${theme.colors.shadow};
  }
`;

export const Feed = styled.div`
  display: grid;
  gap: 1px;
  padding: 6px 10px 11px;
`;

export const FeedItem = styled.article`
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: start;
  padding: 11px 10px;
  border-radius: ${theme.radius.sm};
  transition: background ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.surfaceMuted};
  }
`;

export const EventAvatar = styled.div`
  position: relative;
  display: grid;
  overflow: hidden;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid ${theme.colors.brandSoft};
  border-radius: 13px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 11px;
  font-weight: 850;

  &[data-type="gift"] {
    border-color: ${theme.colors.giftSoft};
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-type="interaction"] {
    border-color: ${theme.colors.successSoft};
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-type="superchat"] {
    border-color: ${theme.colors.warningSoft};
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }

  &[data-type="guard"] {
    border-color: ${theme.colors.cyanSoft};
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }

  &[data-type="system"] {
    border-color: ${theme.colors.successSoft};
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }
`;

export const AvatarFallback = styled.span`
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
`;

export const AvatarImage = styled.img`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
`;

export const EventHeader = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
`;

export const EventUser = styled.span`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EventUserId = styled.span`
  flex: 0 0 auto;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 600;
`;

export const EventMeta = styled.span`
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 8px;
  font-weight: 800;

  &[data-type="gift"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-type="interaction"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-type="superchat"] {
    background: ${theme.colors.warningSoft};
    color: ${theme.colors.warning};
  }

  &[data-type="guard"] {
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }
`;

export const EventContent = styled.p`
  margin: 3px 0 0;
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  line-height: 1.45;
`;

export const EventTime = styled.time`
  padding-top: 2px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
`;

export const EmptyFeed = styled.div`
  display: grid;
  min-height: 250px;
  place-items: center;
  padding: 30px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  text-align: center;

  strong {
    display: block;
    margin-bottom: 5px;
    color: ${theme.colors.textSecondary};
    font-size: 12px;
  }
`;

export const QueueHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

export const QueueCount = styled.span`
  display: grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
`;

export const PlaybackButton = styled.button`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 11px;
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  transition: all ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.brandHover};
    transform: translateY(-1px);
  }
`;

export const QueueBody = styled.div`
  display: flex;
  min-height: 312px;
  flex-direction: column;
  padding: 10px 13px 13px;
`;

export const NowPlaying = styled.div`
  margin: 0 0 7px;
  padding: 12px;
  border: 1px solid ${theme.colors.brandSoft};
  border-radius: ${theme.radius.md};
  background: ${theme.colors.brandSubtle};
`;

export const PlayingTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

export const PlayingLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.brand};
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.1em;
`;

export const PlayingDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${theme.colors.brand};
  box-shadow: 0 0 0 4px ${theme.colors.brandSoft};
`;

export const Duration = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
`;

export const PlayingText = styled.p`
  margin: 8px 0 7px;
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  font-weight: 650;
  line-height: 1.5;
`;

export const VoiceMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

export const ProgressTrack = styled.div`
  overflow: hidden;
  height: 3px;
  margin-top: 9px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSoft};
`;

export const Progress = styled.div`
  width: 62%;
  height: 100%;
  border-radius: inherit;
  background: ${theme.colors.brand};
`;

export const QueueItem = styled.div`
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 7px;
  border-bottom: 1px solid ${theme.colors.border};

  &:last-of-type {
    border-bottom: 0;
  }
`;

export const QueueIndex = styled.span`
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 8px;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 700;
`;

export const QueueText = styled.div`
  min-width: 0;
`;

export const QueueSpeaker = styled.div`
  overflow: hidden;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const QueueContent = styled.div`
  overflow: hidden;
  margin-top: 2px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EngineCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding: 10px 11px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
`;

export const EngineInfo = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
`;

export const EngineIcon = styled.span`
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  place-items: center;
  border-radius: 10px;
  background: ${theme.colors.cyanSoft};
  color: ${theme.colors.brandDeep};
`;

export const EngineName = styled.div`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 9px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EngineCaption = styled.div`
  margin-top: 1px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

export const Pipeline = styled.section`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: color-mix(in srgb, ${theme.colors.surface} 86%, transparent);
  color: ${theme.colors.textMuted};
  box-shadow: ${theme.shadows.inset};
`;

export const PipelineLabel = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 800;
`;

export const PipelineSteps = styled.div`
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

export const PipelineStep = styled.span`
  flex: 0 1 auto;
  padding: 5px 9px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
`;

export const PipelineArrow = styled.span`
  color: ${theme.colors.borderStrong};
  font-size: 10px;
`;

export const PipelineGroup = styled.span`
  display: contents;
`;


export const AnchorAnalyticsSurface = styled.section`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 100%;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(138deg, color-mix(in srgb, ${theme.colors.highlight} 30%, transparent), transparent 46%),
    color-mix(in srgb, ${theme.colors.prismBase} 82%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(${theme.prismGlass.saturation});
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};

  &::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    background:
      radial-gradient(circle at 18% 28%, color-mix(in srgb, ${theme.colors.brandSoft} 38%, transparent), transparent 38%),
      radial-gradient(circle at 82% 68%, color-mix(in srgb, ${theme.colors.cyanSoft} 42%, transparent), transparent 42%),
      linear-gradient(112deg, transparent 18%, color-mix(in srgb, ${theme.colors.highlight} 44%, transparent) 42%, transparent 64%);
    background-position: 0% 20%, 100% 78%, 0% 50%;
    background-size: 142% 142%, 148% 148%, 176% 100%;
    content: "";
    pointer-events: none;
    animation: bilimaku-anchor-prism-flow 14s ease-in-out infinite alternate;
  }

  @keyframes bilimaku-anchor-prism-flow {
    to {
      background-position: 24% 36%, 72% 54%, 100% 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

export const AnchorPanelBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 16px 18px 18px;
`;

export const AnchorToolbar = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;
`;

export const AnchorRangeSelector = styled.div`
  display: flex;
  overflow: hidden;
  align-items: stretch;
  gap: 0;
  padding: 0;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 82%, transparent);
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
`;

export const AnchorRangeButton = styled.button`
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 13px;
  font-weight: 750;
  transition:
    color ${theme.motion.fast},
    background-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  & + & {
    border-left: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 62%, transparent);
  }

  &:hover {
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 58%, transparent);
    color: ${theme.colors.brand};
  }

  &[data-active="true"] {
    background:
      linear-gradient(180deg, color-mix(in srgb, ${theme.colors.highlight} 54%, transparent), transparent),
      color-mix(in srgb, ${theme.colors.brandSubtle} 76%, transparent);
    color: ${theme.colors.brandDeep};
    box-shadow: inset 0 -2px 0 ${theme.colors.brand};
  }
`;

export const AnchorRefreshButton = styled.button`
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 82%, transparent);
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  color: ${theme.colors.textSecondary};
  font-size: 14px;
  font-weight: 750;
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  backdrop-filter: blur(18px) saturate(1.15);
  transition:
    border-color ${theme.motion.fast},
    background-color ${theme.motion.fast},
    color ${theme.motion.fast};

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brandSoft};
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 64%, transparent);
    color: ${theme.colors.brand};
  }

  &:disabled {
    cursor: wait;
    opacity: 0.58;
  }
`;

export const AnchorMetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 470px) {
    grid-template-columns: 1fr;
  }
`;

export const AnchorMetricCard = styled.button`
  display: flex;
  min-width: 0;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 13px 11px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: 0;
  background:
    linear-gradient(145deg, color-mix(in srgb, ${theme.colors.highlight} 44%, transparent), transparent 62%),
    color-mix(in srgb, ${theme.colors.prismSurface} 88%, transparent);
  color: inherit;
  text-align: left;
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  transition:
    border-color ${theme.motion.fast},
    background-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  &:hover {
    border-color: ${theme.colors.brandSoft};
    background:
      linear-gradient(145deg, color-mix(in srgb, ${theme.colors.highlight} 46%, transparent), transparent 62%),
      color-mix(in srgb, ${theme.colors.brandSubtle} 48%, transparent);
  }

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 48%, ${theme.colors.border});
    background:
      linear-gradient(145deg, color-mix(in srgb, ${theme.colors.highlight} 48%, transparent), transparent 58%),
      color-mix(in srgb, ${theme.colors.brandSubtle} 66%, transparent);
    box-shadow:
      inset 3px 0 0 ${theme.colors.brand},
      0 8px 22px color-mix(in srgb, ${theme.colors.brand} 9%, transparent),
      ${theme.shadows.inset};
  }
`;

export const AnchorMetricIcon = styled.span`
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 2px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};

  &[data-tone="duration"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-tone="audience"] {
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }

  &[data-tone="followers"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }
`;

export const AnchorMetricContent = styled.span`
  display: grid;
  min-width: 0;
  flex: 0 1 auto;
  justify-items: start;
`;

export const AnchorMetricLabel = styled.span`
  display: block;
  color: ${theme.colors.textMuted};
  font-size: 16px;
  font-weight: 700;
`;

export const AnchorMetricValue = styled.strong`
  display: block;
  overflow: hidden;
  margin-top: 4px;
  color: ${theme.colors.textPrimary};
  font-size: 20px;
  font-weight: 850;
  letter-spacing: -0.035em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const AnchorMetricDelta = styled.span`
  display: block;
  overflow: hidden;
  margin-top: 5px;
  color: ${theme.colors.textMuted};
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-direction="up"] {
    color: ${theme.colors.danger};
  }

  &[data-direction="down"] {
    color: ${theme.colors.success};
  }
`;

export const AnchorPanelState = styled.div`
  display: grid;
  min-height: 166px;
  place-items: center;
  padding: 24px;
  border: 1px dashed ${theme.colors.borderStrong};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 34%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
  -webkit-backdrop-filter: blur(18px) saturate(1.12);
  backdrop-filter: blur(18px) saturate(1.12);

  strong {
    display: block;
    margin-bottom: 4px;
    color: ${theme.colors.textSecondary};
    font-size: 12px;
  }

  &[data-error="true"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 28%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.dangerSoft} 62%, transparent);
    color: ${theme.colors.danger};
  }
`;

export const AnchorChart = styled.section`
  padding: 13px 14px 11px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: 0;
  background:
    linear-gradient(145deg, color-mix(in srgb, ${theme.colors.highlight} 38%, transparent), transparent 62%),
    color-mix(in srgb, ${theme.colors.prismSurface} 86%, transparent);
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
`;

export const AnchorChartHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 8px;
`;

export const AnchorChartTitle = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 16px;
  font-weight: 800;

  span {
    display: block;
    margin-top: 3px;
    color: ${theme.colors.textMuted};
    font-size: 11px;
    font-weight: 600;
  }
`;

export const AnchorMetricTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 62%, transparent);
`;

export const AnchorMetricTab = styled.button`
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 13px;
  font-weight: 750;
  transition:
    background-color ${theme.motion.fast},
    color ${theme.motion.fast};

  & + & {
    border-left: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 56%, transparent);
  }

  &:hover {
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 52%, transparent);
    color: ${theme.colors.brand};
  }

  &[data-active="true"] {
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 74%, transparent);
    color: ${theme.colors.brandDeep};
    box-shadow: inset 0 -2px 0 ${theme.colors.brand};
  }
`;

export const AnchorChartCanvas = styled.div`
  position: relative;
  overflow: visible;
  min-height: 164px;
  border-radius: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, ${theme.colors.highlight} 24%, transparent), transparent 72%),
    color-mix(in srgb, ${theme.colors.prismSurface} 72%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
`;

export const AnchorTrendSvg = styled.svg`
  display: block;
  width: 100%;
  height: 142px;
  overflow: visible;
  color: ${theme.colors.brand};

  .grid {
    stroke: ${theme.colors.border};
    stroke-width: 1;
  }

  .area {
    fill: color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
  }

  .line {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.4;
    vector-effect: non-scaling-stroke;
  }

  .point-target {
    outline: 0;
    cursor: crosshair;
  }

  .point-hit-area {
    fill: transparent;
    pointer-events: all;
  }

  .point {
    fill: ${theme.colors.surface};
    stroke: currentColor;
    stroke-width: 2;
    transition:
      fill 140ms ease,
      filter 140ms ease,
      r 140ms ease,
      stroke-width 140ms ease;
    vector-effect: non-scaling-stroke;
  }

  .point-target:hover .point,
  .point-target:focus .point,
  .point[data-active="true"] {
    fill: ${theme.colors.brand};
    filter: drop-shadow(0 0 4px color-mix(in srgb, ${theme.colors.brand} 48%, transparent));
    stroke: ${theme.colors.highlight};
    stroke-width: 2.2;
    transform: scale(1.35);
    transform-box: fill-box;
    transform-origin: center;
  }
`;

export const AnchorChartTooltip = styled.div`
  position: absolute;
  z-index: 3;
  top: var(--chart-tooltip-y);
  left: var(--chart-tooltip-x);
  min-width: 126px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 68%, ${theme.colors.borderStrong});
  border-radius: 5px;
  background: linear-gradient(
    142deg,
    color-mix(in srgb, ${theme.colors.surface} 72%, transparent),
    color-mix(in srgb, ${theme.colors.canvasAccent} 58%, transparent)
  );
  box-shadow:
    0 12px 28px color-mix(in srgb, ${theme.colors.brandDeep} 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 74%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(1.28);
  backdrop-filter: blur(18px) saturate(1.28);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 10px)) translateY(4px) scale(0.97);
  transform-origin: center bottom;
  animation: bilimaku-chart-tooltip-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards;

  &[data-edge="start"] {
    transform: translate(0, calc(-100% - 10px)) translateY(4px) scale(0.97);
    transform-origin: left bottom;
    animation-name: bilimaku-chart-tooltip-start-in;
  }

  &[data-edge="end"] {
    transform: translate(-100%, calc(-100% - 10px)) translateY(4px) scale(0.97);
    transform-origin: right bottom;
    animation-name: bilimaku-chart-tooltip-end-in;
  }

  @keyframes bilimaku-chart-tooltip-in {
    to {
      opacity: 1;
      transform: translate(-50%, calc(-100% - 10px)) translateY(0) scale(1);
    }
  }

  @keyframes bilimaku-chart-tooltip-start-in {
    to {
      opacity: 1;
      transform: translate(0, calc(-100% - 10px)) translateY(0) scale(1);
    }
  }

  @keyframes bilimaku-chart-tooltip-end-in {
    to {
      opacity: 1;
      transform: translate(-100%, calc(-100% - 10px)) translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1ms;
  }
`;

export const AnchorChartTooltipDate = styled.div`
  margin-bottom: 3px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  font-weight: 650;
  white-space: nowrap;
`;

export const AnchorChartTooltipValue = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: ${theme.colors.textPrimary};
  font-size: 13px;
  font-weight: 840;
  white-space: nowrap;

  span {
    color: ${theme.colors.brandDeep};
    font-size: 10px;
    font-weight: 720;
  }
`;

export const AnchorChartAxis = styled.div`
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 2px;
  padding: 0 10px 8px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 11px;
  text-align: center;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const AnchorChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  color: ${theme.colors.textMuted};
  font-size: 13px;

  &::before {
    width: 14px;
    height: 3px;
    border-radius: ${theme.radius.pill};
    background: ${theme.colors.brand};
    content: "";
  }
`;
