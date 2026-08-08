import { css } from "@linaria/core";
import { styled } from "@linaria/react";
import type { PropsWithChildren } from "react";
import { FrostedTooltipLayer } from "../components/FrostedTooltip";
import { lightTheme, theme } from "./theme";

const globalStyles = css`
  :global() {
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body,
    #root {
      width: 100%;
      height: 100%;
      min-width: 320px;
      min-height: 100%;
      margin: 0;
    }

    body {
      min-height: 100vh;
      overflow: hidden;
      background: transparent;
      color: ${lightTheme.colors.textPrimary};
      font-family: ${theme.typography.family};
      font-size: 14px;
      line-height: 1.5;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    button,
    input,
    select,
    textarea {
      color: inherit;
      font: inherit;
    }

    button,
    select {
      cursor: pointer;
    }

    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 3px solid ${lightTheme.colors.brandSoft};
      outline-offset: 2px;
    }

    ::selection {
      background: ${lightTheme.colors.brandSoft};
      color: ${lightTheme.colors.textPrimary};
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: ${theme.radius.pill};
      background: ${lightTheme.colors.borderStrong};
      background-clip: padding-box;
    }
  }
`;

const ThemeCanvas = styled.div`
  --bc-color-canvas: ${lightTheme.colors.canvas};
  --bc-color-canvas-accent: ${lightTheme.colors.canvasAccent};
  --bc-color-surface: ${lightTheme.colors.surface};
  --bc-color-surface-elevated: ${lightTheme.colors.surfaceElevated};
  --bc-color-surface-muted: ${lightTheme.colors.surfaceMuted};
  --bc-color-surface-pressed: ${lightTheme.colors.surfacePressed};
  --bc-color-brand: ${lightTheme.colors.brand};
  --bc-color-brand-hover: ${lightTheme.colors.brandHover};
  --bc-color-brand-deep: ${lightTheme.colors.brandDeep};
  --bc-color-brand-soft: ${lightTheme.colors.brandSoft};
  --bc-color-brand-subtle: ${lightTheme.colors.brandSubtle};
  --bc-color-message-bubble: ${lightTheme.colors.messageBubble};
  --bc-color-cyan: ${lightTheme.colors.cyan};
  --bc-color-cyan-soft: ${lightTheme.colors.cyanSoft};
  --bc-color-text-primary: ${lightTheme.colors.textPrimary};
  --bc-color-text-secondary: ${lightTheme.colors.textSecondary};
  --bc-color-text-muted: ${lightTheme.colors.textMuted};
  --bc-color-text-on-brand: ${lightTheme.colors.textOnBrand};
  --bc-color-border: ${lightTheme.colors.border};
  --bc-color-border-strong: ${lightTheme.colors.borderStrong};
  --bc-color-success: ${lightTheme.colors.success};
  --bc-color-success-soft: ${lightTheme.colors.successSoft};
  --bc-color-warning: ${lightTheme.colors.warning};
  --bc-color-warning-soft: ${lightTheme.colors.warningSoft};
  --bc-color-danger: ${lightTheme.colors.danger};
  --bc-color-danger-soft: ${lightTheme.colors.dangerSoft};
  --bc-color-gift: ${lightTheme.colors.gift};
  --bc-color-gift-soft: ${lightTheme.colors.giftSoft};
  --bc-color-scrim: ${lightTheme.colors.scrim};
  --bc-color-shadow: ${lightTheme.colors.shadow};
  --bc-color-shadow-strong: ${lightTheme.colors.shadowStrong};
  --bc-color-highlight: ${lightTheme.colors.highlight};

  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  position: relative;
  background-color: ${theme.colors.canvas};
  background-image: ${theme.gradients.canvas};
  color: ${theme.colors.textPrimary};

  &[data-window-mode="login"] {
    border: 0;
    border-radius: 0;
    background:
      radial-gradient(circle at 14% 20%, color-mix(in srgb, ${theme.colors.brandSoft} 68%, transparent), transparent 43%),
      radial-gradient(circle at 84% 76%, color-mix(in srgb, ${theme.colors.cyanSoft} 76%, transparent), transparent 45%),
      linear-gradient(135deg, color-mix(in srgb, ${theme.colors.surface} 82%, transparent), color-mix(in srgb, ${theme.colors.brandSubtle} 72%, transparent));
    background-position: 18% 18%, 82% 82%, 50% 50%;
    background-size: 140% 140%, 150% 150%, 100% 100%;
    box-shadow: none;
    backdrop-filter: blur(34px) saturate(1.28);
    -webkit-backdrop-filter: blur(34px) saturate(1.28);
  }
`;

export function GlobalStyles({
  children,
  windowMode = "workspace",
}: PropsWithChildren<{ windowMode?: "login" | "workspace" }>) {
  return (
    <ThemeCanvas className={globalStyles} data-window-mode={windowMode}>
      {children}
      <FrostedTooltipLayer />
    </ThemeCanvas>
  );
}
