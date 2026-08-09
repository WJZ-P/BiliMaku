import { styled } from "@linaria/react";
import { theme } from "../../styles/theme";

export const Page = styled.section`
  display: grid;
  gap: 18px;
  padding: 16px 18px 28px;
  background:
    linear-gradient(
      color-mix(in srgb, ${theme.colors.brand} 3%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, ${theme.colors.brand} 3%, transparent) 1px,
      transparent 1px
    );
  background-size: 20px 20px;
`;

export const LabHeader = styled.header`
  position: relative;
  display: grid;
  min-height: 116px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 24px;
  overflow: hidden;
  padding: 20px 22px 18px;
  border-top: 2px solid ${theme.colors.borderStrong};
  border-right: 2px solid ${theme.colors.borderStrong};
  border-bottom: 2px solid ${theme.colors.borderStrong};
  border-left: 5px solid ${theme.colors.brand};
  border-radius: 0;
  background:
    linear-gradient(
      115deg,
      color-mix(in srgb, ${theme.colors.brand} 7%, transparent),
      transparent 42%
    ),
    color-mix(in srgb, ${theme.colors.surface} 76%, transparent);
  box-shadow: none;

  &::before {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(
        color-mix(in srgb, ${theme.colors.brand} 5%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, ${theme.colors.cyan} 5%, transparent) 1px,
        transparent 1px
      );
    background-size: 12px 12px;
    content: "";
    opacity: 0.58;
    pointer-events: none;
  }

  &::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -18%;
    width: 14%;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, ${theme.colors.cyan} 16%, transparent),
      transparent
    );
    content: "";
    pointer-events: none;
    animation: bilimaku-debug-header-scan 5.2s linear infinite;
  }

  @keyframes bilimaku-debug-header-scan {
    to {
      left: 112%;
    }
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const HeaderCopy = styled.div`
  position: relative;
  z-index: 1;
`;

export const HeaderEyebrow = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.16em;

  &::before {
    width: 18px;
    height: 3px;
    background: ${theme.colors.brand};
    content: "";
  }
`;

export const Title = styled.h1`
  margin: 8px 0 6px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(22px, 3vw, 31px);
  font-weight: 900;
  letter-spacing: -0.045em;
`;

export const Description = styled.p`
  max-width: 670px;
  margin: 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.7;
`;

export const HeaderTelemetry = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 208px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 2px solid ${theme.colors.borderStrong};
  background: color-mix(in srgb, ${theme.colors.surface} 62%, transparent);
`;

export const TelemetryCell = styled.div`
  display: grid;
  min-height: 48px;
  align-content: center;
  gap: 3px;
  padding: 8px 10px;

  &:nth-child(odd) {
    border-right: 1px solid ${theme.colors.borderStrong};
  }

  &:nth-child(-n + 2) {
    border-bottom: 1px solid ${theme.colors.borderStrong};
  }

  span {
    color: ${theme.colors.textMuted};
    font-family: ${theme.typography.mono};
    font-size: 7px;
    font-weight: 720;
    letter-spacing: 0.08em;
  }

  strong {
    color: ${theme.colors.textPrimary};
    font-family: ${theme.typography.mono};
    font-size: 11px;
    font-weight: 850;
  }
`;

export const Section = styled.section`
  display: grid;
  gap: 10px;
`;

export const SectionHeader = styled.header`
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: stretch;
  border-bottom: 2px solid ${theme.colors.borderStrong};
`;

export const SectionIndex = styled.span`
  display: grid;
  min-height: 38px;
  place-items: center;
  background: ${theme.colors.brandDeep};
  color: ${theme.colors.textOnBrand};
  font-family: ${theme.typography.mono};
  font-size: 10px;
  font-weight: 900;
`;

export const SectionCopy = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 8px 5px 12px;
`;

export const SectionTitle = styled.h2`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 13px;
  font-weight: 860;
  letter-spacing: -0.015em;
`;

export const SectionCaption = styled.p`
  margin: 0;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  text-align: right;
`;

export const ControlGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 10px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

export const Panel = styled.article`
  position: relative;
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 13px;
  padding: 14px;
  border: 2px solid ${theme.colors.borderStrong};
  border-radius: 0;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, ${theme.colors.brand} 4%, transparent),
      transparent 46%
    ),
    color-mix(in srgb, ${theme.colors.surface} 78%, transparent);
  box-shadow: none;

  &::before,
  &::after {
    position: absolute;
    width: 9px;
    height: 9px;
    content: "";
    pointer-events: none;
  }

  &::before {
    top: -2px;
    left: -2px;
    border-top: 3px solid ${theme.colors.brand};
    border-left: 3px solid ${theme.colors.brand};
  }

  &::after {
    right: -2px;
    bottom: -2px;
    border-right: 3px solid ${theme.colors.cyan};
    border-bottom: 3px solid ${theme.colors.cyan};
  }
`;

export const PanelHeader = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 9px;
  border-bottom: 1px solid ${theme.colors.borderStrong};
`;

export const PanelTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 850;
`;

export const PanelMeta = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 7px;
  letter-spacing: 0.08em;
`;

export const ButtonMatrix = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

export const FieldStack = styled.div`
  display: grid;
  gap: 12px;
`;

export const Field = styled.label`
  display: grid;
  min-width: 0;
  gap: 7px;
`;

export const FieldHeader = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export const FieldLabel = styled.span`
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 760;
`;

export const FieldValue = styled.strong`
  color: ${theme.colors.brandDeep};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  font-weight: 850;
`;

export const Range = styled.input`
  width: 100%;
  height: 24px;
  margin: 0;
  appearance: none;
  background: transparent;

  &::-webkit-slider-runnable-track {
    height: 6px;
    border: 1px solid ${theme.colors.borderStrong};
    border-radius: 0;
    background:
      linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan})
        0 / var(--range-progress, 50%) 100% no-repeat,
      ${theme.colors.surfacePressed};
  }

  &::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    appearance: none;
    border: 2px solid ${theme.colors.brandDeep};
    border-radius: 0;
    background: ${theme.colors.surface};
    box-shadow: none;
    transform: rotate(45deg);
    transition:
      background ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  &:hover::-webkit-slider-thumb,
  &:focus-visible::-webkit-slider-thumb {
    background: ${theme.colors.cyanSoft};
    transform: rotate(45deg) scale(1.18);
  }

  &:focus-visible {
    outline: 1px solid ${theme.colors.brand};
    outline-offset: 3px;
  }
`;

export const SelectShell = styled.span`
  position: relative;
  display: block;
`;

export const Select = styled.select`
  width: 100%;
  height: 40px;
  appearance: none;
  padding: 0 38px 0 11px;
  border: 2px solid ${theme.colors.borderStrong};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 74%, transparent);
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.family};
  font-size: 10px;
  font-weight: 720;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal};

  &:hover,
  &:focus-visible {
    border-color: ${theme.colors.brand};
    background: ${theme.colors.surface};
    outline: 0;
  }
`;

export const SelectArrow = styled.span`
  position: absolute;
  top: 50%;
  right: 12px;
  width: 9px;
  height: 9px;
  border-right: 2px solid ${theme.colors.brand};
  border-bottom: 2px solid ${theme.colors.brand};
  pointer-events: none;
  transform: translateY(-70%) rotate(45deg);
  transition: transform ${theme.motion.spring};

  ${SelectShell}:focus-within & {
    transform: translateY(-30%) rotate(225deg);
  }
`;

export const TextInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 0 11px;
  border: 2px solid ${theme.colors.borderStrong};
  border-radius: 0;
  outline: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 74%, transparent);
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.family};
  font-size: 10px;
  font-weight: 650;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal};

  &::placeholder {
    color: ${theme.colors.textMuted};
  }

  &:hover,
  &:focus {
    border-color: ${theme.colors.brand};
    background: ${theme.colors.surface};
  }
`;

export const SwitchRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 10px;
  border: 2px solid ${theme.colors.borderStrong};
  border-radius: 2px;
  background: color-mix(in srgb, ${theme.colors.surface} 62%, transparent);
`;

export const SwitchCopy = styled.span`
  display: grid;
  gap: 2px;

  strong {
    color: ${theme.colors.textSecondary};
    font-size: 9px;
  }

  small {
    color: ${theme.colors.textMuted};
    font-size: 7px;
  }
`;

export const Switch = styled.button`
  position: relative;
  width: 42px;
  height: 22px;
  flex: 0 0 42px;
  padding: 0;
  border: 2px solid ${theme.colors.borderStrong};
  border-radius: 2px;
  background: ${theme.colors.surfacePressed};
  box-shadow: inset 0 1px 3px color-mix(in srgb, ${theme.colors.shadowStrong} 14%, transparent);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal},
    box-shadow ${theme.motion.normal};

  &:hover,
  &:focus-visible {
    border-color: color-mix(in srgb, ${theme.colors.brand} 68%, ${theme.colors.borderStrong});
    box-shadow:
      0 0 0 2px color-mix(in srgb, ${theme.colors.brand} 10%, transparent),
      inset 0 1px 3px color-mix(in srgb, ${theme.colors.shadowStrong} 14%, transparent);
    outline: 0;
  }

  &[data-active="true"] {
    border-color: ${theme.colors.brand};
    background: color-mix(in srgb, ${theme.colors.brand} 18%, ${theme.colors.surface});
  }
`;

export const SwitchThumb = styled.span`
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${theme.colors.textMuted};
  box-shadow: 0 2px 5px color-mix(in srgb, ${theme.colors.shadowStrong} 24%, transparent);
  transform-origin: center;
  transition: background ${theme.motion.fast};

  &::after {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 50%;
    width: 2px;
    border-radius: 1px;
    background: color-mix(in srgb, ${theme.colors.surface} 82%, transparent);
    content: "";
    transform: translateX(-50%);
  }

  [data-active="true"] & {
    background: ${theme.colors.brand};
    animation: bilimaku-switch-roll-on 520ms cubic-bezier(0.2, 0.82, 0.22, 1) both;
  }

  [data-active="false"] & {
    animation: bilimaku-switch-roll-off 520ms cubic-bezier(0.2, 0.82, 0.22, 1) both;
  }

  @keyframes bilimaku-switch-roll-on {
    0% {
      transform: translateX(0) rotate(0deg);
    }
    68% {
      transform: translateX(20px) rotate(100deg);
    }
    100% {
      transform: translateX(20px) rotate(90deg);
    }
  }

  @keyframes bilimaku-switch-roll-off {
    0% {
      transform: translateX(20px) rotate(90deg);
    }
    68% {
      transform: translateX(0) rotate(-10deg);
    }
    100% {
      transform: translateX(0) rotate(0deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1ms !important;
  }
`;

export const MetricsStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 2px solid ${theme.colors.borderStrong};
  background: color-mix(in srgb, ${theme.colors.surface} 66%, transparent);

  @media (max-width: 680px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const Metric = styled.div`
  position: relative;
  min-width: 0;
  padding: 12px;
  border-right: 1px solid ${theme.colors.borderStrong};

  &:last-child {
    border-right: 0;
  }

  &::after {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 5px;
    height: 5px;
    background: ${theme.colors.brand};
    content: "";
    opacity: 0.34;
  }
`;

export const MetricLabel = styled.span`
  display: block;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  letter-spacing: 0.06em;
`;

export const MetricValue = styled.strong`
  display: block;
  margin-top: 7px;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.mono};
  font-size: 19px;
  font-weight: 900;
`;

export const MetricDelta = styled.span`
  display: block;
  margin-top: 5px;
  color: ${theme.colors.success};
  font-size: 8px;
  font-weight: 720;
`;

export const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(220px, 0.85fr);
  gap: 10px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const ChatConsole = styled.div`
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 188px;
  padding: 13px;
  border: 2px solid ${theme.colors.borderStrong};
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, ${theme.colors.brand} 4%, transparent) 1px,
      transparent 1px
    ),
    ${theme.colors.canvasAccent};
  background-size: 10px 10px;
`;

export const ChatRow = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
`;

export const Avatar = styled.span`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 2px solid ${theme.colors.brandSoft};
  border-radius: 50%;
  background: ${theme.colors.surface};
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 900;
`;

export const ChatContent = styled.div`
  display: grid;
  min-width: 0;
  gap: 4px;
`;

export const ChatMeta = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 8px;

  strong {
    margin-right: 6px;
    color: ${theme.colors.textPrimary};
    font-size: 10px;
  }
`;

export const ChatBubble = styled.div`
  justify-self: start;
  padding: 7px 10px;
  border: 2px solid color-mix(in srgb, ${theme.colors.brand} 28%, ${theme.colors.borderStrong});
  border-radius: 1px;
  background: color-mix(in srgb, ${theme.colors.surface} 72%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  line-height: 1.5;
  backdrop-filter: blur(10px);
`;

export const SignalPanel = styled.div`
  display: grid;
  min-height: 188px;
  align-content: space-between;
  gap: 14px;
  padding: 13px;
  border: 2px solid ${theme.colors.borderStrong};
  background: color-mix(in srgb, ${theme.colors.surface} 68%, transparent);
`;

export const SignalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;

  strong {
    color: ${theme.colors.brandDeep};
    font-size: 10px;
  }
`;

export const SignalMeter = styled.div`
  height: 18px;
  padding: 4px;
  border: 2px solid ${theme.colors.borderStrong};
  background: ${theme.colors.surfacePressed};
`;

export const SignalFill = styled.span`
  display: block;
  width: var(--signal-level, 50%);
  height: 100%;
  background:
    repeating-linear-gradient(
      90deg,
      ${theme.colors.brand} 0 7px,
      transparent 7px 10px
    ),
    ${theme.colors.cyanSoft};
  transition: width ${theme.motion.spring};
`;

export const SignalCode = styled.pre`
  min-height: 86px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border-left: 3px solid ${theme.colors.cyan};
  background: color-mix(in srgb, ${theme.colors.brandDeep} 5%, ${theme.colors.surface});
  color: ${theme.colors.textSecondary};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
`;

export const FooterNote = styled.footer`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 2px solid ${theme.colors.borderStrong};
  border-left: 5px solid ${theme.colors.cyan};
  background: color-mix(in srgb, ${theme.colors.surface} 62%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.55;

  &::before {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    background: ${theme.colors.success};
    content: "";
    animation: bilimaku-debug-status 1.8s ease-in-out infinite;
  }

  @keyframes bilimaku-debug-status {
    50% {
      opacity: 0.3;
    }
  }
`;
