import { styled } from "@linaria/react";
import { theme } from "../../styles/theme";

export const Page = styled.section`
  display: grid;
  gap: 14px;
  padding: 14px 18px 24px;
`;

export const LabHeader = styled.header`
  position: relative;
  display: flex;
  min-height: 104px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  overflow: hidden;
  padding: 18px 20px;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 10px;
  background:
    radial-gradient(circle at 86% 12%, color-mix(in srgb, ${theme.colors.cyan} 18%, transparent), transparent 28%),
    linear-gradient(145deg, color-mix(in srgb, ${theme.colors.surface} 92%, transparent), color-mix(in srgb, ${theme.colors.canvasAccent} 82%, transparent));
  box-shadow:
    0 12px 28px color-mix(in srgb, ${theme.colors.brandDeep} 8%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 82%, transparent);

  &::after {
    position: absolute;
    top: 15px;
    right: -45px;
    width: 220px;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${theme.colors.brand}, ${theme.colors.cyan}, transparent);
    box-shadow:
      -18px 14px 0 color-mix(in srgb, ${theme.colors.brand} 24%, transparent),
      12px 30px 0 color-mix(in srgb, ${theme.colors.cyan} 18%, transparent),
      -36px 47px 0 color-mix(in srgb, ${theme.colors.brand} 14%, transparent);
    content: "";
    opacity: 0.62;
    transform: rotate(-8deg);
  }
`;

export const HeaderCopy = styled.div`
  position: relative;
  z-index: 1;
`;

export const Kicker = styled.div`
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.18em;
`;

export const Title = styled.h1`
  margin: 5px 0 5px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 880;
  letter-spacing: -0.045em;
`;

export const Description = styled.p`
  max-width: 620px;
  margin: 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.65;
`;

export const SelectionPill = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 124px;
  gap: 3px;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 22%, ${theme.colors.border});
  border-radius: 8px;
  background: color-mix(in srgb, ${theme.colors.surface} 72%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 74%, transparent);
  backdrop-filter: blur(16px);

  span {
    color: ${theme.colors.textMuted};
    font-size: 7px;
    font-weight: 720;
    letter-spacing: 0.08em;
  }

  strong {
    color: ${theme.colors.brandDeep};
    font-size: 10px;
    font-weight: 840;
  }
`;

export const Section = styled.section`
  display: grid;
  gap: 9px;
`;

export const SectionHeader = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 0 2px;
`;

export const SectionTitle = styled.h2`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 12px;
  font-weight: 840;
`;

export const SectionCaption = styled.p`
  margin: 0;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

export const VariantGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

export const VariantCard = styled.button`
  --variant-accent: ${theme.colors.brand};
  position: relative;
  display: grid;
  min-width: 0;
  gap: 9px;
  overflow: hidden;
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--variant-accent) 18%, ${theme.colors.border});
  border-radius: 11px;
  background: color-mix(in srgb, ${theme.colors.surface} 82%, transparent);
  color: inherit;
  text-align: left;
  box-shadow:
    0 8px 22px color-mix(in srgb, var(--variant-accent) 6%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 78%, transparent);
  transition:
    transform ${theme.motion.spring},
    border-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  &[data-variant="stream"] {
    --variant-accent: ${theme.colors.cyan};
    border-radius: 3px;
    background:
      linear-gradient(color-mix(in srgb, ${theme.colors.brand} 4%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, ${theme.colors.brand} 4%, transparent) 1px, transparent 1px),
      color-mix(in srgb, ${theme.colors.surface} 90%, transparent);
    background-size: 8px 8px;
  }

  &[data-variant="minimal"] {
    --variant-accent: ${theme.colors.brandDeep};
    border-radius: 2px;
    background: ${theme.colors.surface};
    box-shadow: inset 3px 0 0 color-mix(in srgb, ${theme.colors.brand} 56%, transparent);
  }

  &::after {
    position: absolute;
    top: -48px;
    left: -60px;
    width: 34px;
    height: 220px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.colors.highlight} 58%, transparent), transparent);
    content: "";
    opacity: 0;
    transform: rotate(18deg);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--variant-accent) 44%, ${theme.colors.border});
    box-shadow:
      0 13px 30px color-mix(in srgb, var(--variant-accent) 13%, transparent),
      inset 0 1px 0 ${theme.colors.highlight};
    transform: translateY(-3px);
  }

  &:hover::after {
    animation: bilimaku-debug-sheen 720ms ease-out both;
  }

  &[data-selected="true"] {
    border-color: color-mix(in srgb, var(--variant-accent) 58%, ${theme.colors.border});
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--variant-accent) 10%, transparent),
      0 14px 32px color-mix(in srgb, var(--variant-accent) 14%, transparent),
      inset 0 1px 0 ${theme.colors.highlight};
  }

  @keyframes bilimaku-debug-sheen {
    0% {
      left: -60px;
      opacity: 0;
    }
    18% {
      opacity: 0.8;
    }
    100% {
      left: calc(100% + 40px);
      opacity: 0;
    }
  }
`;

export const VariantNumber = styled.span`
  position: absolute;
  z-index: 3;
  top: 7px;
  left: 7px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--variant-accent) 30%, ${theme.colors.border});
  border-radius: 6px;
  background: color-mix(in srgb, ${theme.colors.surface} 78%, transparent);
  color: var(--variant-accent);
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 900;
  backdrop-filter: blur(12px);
`;

export const PreviewStage = styled.div`
  position: relative;
  height: 100px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--variant-accent) 13%, ${theme.colors.border});
  border-radius: 7px;
  background:
    radial-gradient(circle at 78% 16%, color-mix(in srgb, ${theme.colors.cyan} 15%, transparent), transparent 30%),
    linear-gradient(145deg, ${theme.colors.canvas}, ${theme.colors.canvasAccent});

  [data-variant="stream"] &,
  [data-variant="minimal"] & {
    border-radius: 1px;
  }
`;

export const GlassSheet = styled.span`
  position: absolute;
  top: 24px;
  right: 24px;
  bottom: 15px;
  left: 24px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 68%, ${theme.colors.brandSoft});
  border-radius: 13px;
  background: color-mix(in srgb, ${theme.colors.surface} 34%, transparent);
  box-shadow:
    0 12px 26px color-mix(in srgb, ${theme.colors.brandDeep} 12%, transparent),
    inset 0 1px 0 ${theme.colors.highlight};
  backdrop-filter: blur(14px) saturate(1.35);

  &::before {
    position: absolute;
    top: 8px;
    left: 10px;
    width: 28px;
    height: 2px;
    border-radius: ${theme.radius.pill};
    background: linear-gradient(90deg, ${theme.colors.cyan}, transparent);
    content: "";
    animation: bilimaku-debug-breathe 2.4s ease-in-out infinite;
  }

  @keyframes bilimaku-debug-breathe {
    50% {
      opacity: 0.45;
      transform: scaleX(0.72);
      transform-origin: left;
    }
  }
`;

export const DanmakuLane = styled.span`
  position: absolute;
  z-index: 2;
  right: -95px;
  display: block;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 16%, transparent);
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, ${theme.colors.surface} 74%, transparent);
  color: ${theme.colors.brandDeep};
  font-size: 7px;
  font-weight: 760;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  animation: bilimaku-debug-danmaku 4.6s linear infinite;

  &[data-lane="1"] {
    top: 19px;
    animation-delay: -0.8s;
  }

  &[data-lane="2"] {
    top: 48px;
    animation-delay: -2.7s;
    animation-duration: 5.4s;
  }

  &[data-lane="3"] {
    top: 73px;
    animation-delay: -1.8s;
    animation-duration: 4.1s;
  }

  @keyframes bilimaku-debug-danmaku {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-360px);
    }
  }
`;

export const PixelField = styled.span`
  position: absolute;
  inset: 0;

  i {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 1px;
    background: ${theme.colors.brand};
    box-shadow: 0 0 7px color-mix(in srgb, ${theme.colors.brand} 55%, transparent);
    animation: bilimaku-debug-pixel 1.9s ease-in-out infinite;
  }

  i:nth-child(1) { top: 20px; right: 25px; }
  i:nth-child(2) { top: 37px; right: 66px; animation-delay: -0.6s; }
  i:nth-child(3) { top: 65px; right: 38px; animation-delay: -1.1s; }
  i:nth-child(4) { top: 78px; right: 92px; animation-delay: -1.5s; }
  i:nth-child(5) { top: 48px; right: 132px; animation-delay: -0.3s; }

  @keyframes bilimaku-debug-pixel {
    50% {
      opacity: 0.25;
      transform: translate(-7px, 3px) scale(0.65);
    }
  }
`;

export const MinimalDiagram = styled.span`
  position: absolute;
  inset: 17px 18px;
  border-left: 1px solid ${theme.colors.brand};
  border-bottom: 1px solid ${theme.colors.borderStrong};

  &::before,
  &::after {
    position: absolute;
    height: 1px;
    background: ${theme.colors.brand};
    content: "";
  }

  &::before {
    top: 18px;
    left: 12px;
    width: 64%;
    box-shadow: 22px 23px 0 color-mix(in srgb, ${theme.colors.cyan} 65%, transparent);
  }

  &::after {
    top: 53px;
    left: 30px;
    width: 42%;
  }

  i {
    position: absolute;
    width: 6px;
    height: 6px;
    border: 1px solid ${theme.colors.brand};
    border-radius: 50%;
    background: ${theme.colors.surface};
    animation: bilimaku-debug-node 2s ease-in-out infinite;
  }

  i:nth-child(1) { top: 15px; left: 30%; }
  i:nth-child(2) { top: 38px; left: 66%; animation-delay: -0.7s; }
  i:nth-child(3) { top: 50px; left: 42%; animation-delay: -1.2s; }

  @keyframes bilimaku-debug-node {
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, ${theme.colors.brand} 8%, transparent);
      transform: scale(1.15);
    }
  }
`;

export const VariantCopy = styled.div`
  display: grid;
  gap: 3px;
  padding: 0 2px 2px;
`;

export const VariantTitle = styled.strong`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 840;
`;

export const VariantDescription = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.5;
`;

export const TagRow = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
`;

export const Tag = styled.span`
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--variant-accent) 14%, ${theme.colors.border});
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, var(--variant-accent) 6%, transparent);
  color: color-mix(in srgb, var(--variant-accent) 82%, ${theme.colors.textSecondary});
  font-size: 7px;
  font-weight: 700;
`;

export const ComponentGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 9px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const DemoPanel = styled.article`
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: 9px;
  background: color-mix(in srgb, ${theme.colors.surface} 84%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 76%, transparent);
`;

export const DemoTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 820;
`;

export const MetricRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
`;

export const MetricDemo = styled.div`
  --metric-accent: ${theme.colors.brand};
  position: relative;
  display: grid;
  min-width: 0;
  gap: 4px;
  overflow: hidden;
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--metric-accent) 20%, ${theme.colors.border});
  border-radius: 8px;
  background: linear-gradient(150deg, color-mix(in srgb, ${theme.colors.surface} 92%, transparent), color-mix(in srgb, var(--metric-accent) 6%, transparent));
  transition: transform ${theme.motion.spring}, border-color ${theme.motion.fast};

  &:nth-child(2) { --metric-accent: ${theme.colors.cyan}; }
  &:nth-child(3) { --metric-accent: ${theme.colors.gift}; }

  &::after {
    position: absolute;
    right: -10px;
    bottom: -16px;
    width: 42px;
    height: 42px;
    border: 1px solid color-mix(in srgb, var(--metric-accent) 12%, transparent);
    border-radius: 50%;
    content: "";
    transition: transform 520ms ease;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--metric-accent) 44%, ${theme.colors.border});
    transform: translateY(-2px);
  }

  &:hover::after {
    transform: scale(1.35) translate(-4px, -4px);
  }
`;

export const MetricName = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 7px;
  font-weight: 700;
`;

export const MetricValue = styled.strong`
  overflow: hidden;
  color: ${theme.colors.textPrimary};
  font-size: 15px;
  font-weight: 880;
  letter-spacing: -0.035em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const MetricTrend = styled.span`
  color: ${theme.colors.success};
  font-size: 7px;
  font-weight: 720;
`;

export const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

export const DemoButton = styled.button`
  --button-accent: ${theme.colors.brand};
  position: relative;
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  padding: 0 11px;
  border: 1px solid color-mix(in srgb, var(--button-accent) 24%, ${theme.colors.border});
  border-radius: 7px;
  background: color-mix(in srgb, ${theme.colors.surface} 82%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 760;
  transition: transform ${theme.motion.spring}, box-shadow ${theme.motion.fast};

  &[data-kind="stream"] {
    --button-accent: ${theme.colors.cyan};
    border-radius: 2px;
  }

  &[data-kind="solid"] {
    background: ${theme.colors.brand};
    color: ${theme.colors.textOnBrand};
  }

  &::after {
    position: absolute;
    top: 50%;
    right: -8px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--button-accent);
    box-shadow:
      9px -7px 0 -1px color-mix(in srgb, var(--button-accent) 55%, transparent),
      14px 6px 0 -1px color-mix(in srgb, var(--button-accent) 40%, transparent);
    content: "";
    opacity: 0;
  }

  &:hover {
    box-shadow: 0 8px 18px color-mix(in srgb, var(--button-accent) 14%, transparent);
    transform: translateY(-2px) scale(1.02);
  }

  &:hover::after {
    animation: bilimaku-debug-button-particle 680ms ease-out both;
  }

  &:active {
    transform: translateY(1px) scale(0.95);
  }

  @keyframes bilimaku-debug-button-particle {
    0% { right: -8px; opacity: 0; }
    18% { opacity: 0.8; }
    100% { right: calc(100% + 12px); opacity: 0; }
  }
`;

export const ChatPreview = styled.div`
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid ${theme.colors.border};
  border-radius: 7px;
  background: ${theme.colors.canvasAccent};
`;

export const ChatLine = styled.div`
  display: grid;
  grid-template-columns: 27px minmax(0, 1fr);
  gap: 7px;
  align-items: flex-start;

  &[data-align="right"] {
    grid-template-columns: minmax(0, 1fr) 27px;
  }
`;

export const ChatAvatar = styled.span`
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid ${theme.colors.brandSoft};
  border-radius: 7px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 8px;
  font-weight: 850;
`;

export const ChatBubble = styled.div`
  justify-self: start;
  padding: 7px 9px;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px 9px 9px 9px;
  background: color-mix(in srgb, ${theme.colors.surface} 88%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  line-height: 1.5;
  box-shadow: 0 5px 12px color-mix(in srgb, ${theme.colors.brandDeep} 6%, transparent);
  transition: transform ${theme.motion.spring};

  [data-align="right"] & {
    justify-self: end;
    border-color: ${theme.colors.brandSoft};
    border-radius: 9px 2px 9px 9px;
    background: ${theme.colors.brandSubtle};
    color: ${theme.colors.brandDeep};
  }

  &:hover {
    transform: translateX(3px);
  }
`;

export const Hint = styled.footer`
  padding: 9px 11px;
  border-left: 2px solid ${theme.colors.brand};
  background: color-mix(in srgb, ${theme.colors.brandSubtle} 54%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 8px;
  line-height: 1.6;
`;