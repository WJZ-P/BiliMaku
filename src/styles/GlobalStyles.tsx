import { css } from "@linaria/core";
import { styled } from "@linaria/react";
import type { PropsWithChildren } from "react";
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
      min-width: 320px;
      min-height: 100%;
      margin: 0;
    }

    body {
      min-height: 100vh;
      overflow: hidden;
      background: ${lightTheme.colors.canvas};
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
  --bp-color-canvas: ${lightTheme.colors.canvas};
  --bp-color-canvas-accent: ${lightTheme.colors.canvasAccent};
  --bp-color-surface: ${lightTheme.colors.surface};
  --bp-color-surface-elevated: ${lightTheme.colors.surfaceElevated};
  --bp-color-surface-muted: ${lightTheme.colors.surfaceMuted};
  --bp-color-surface-pressed: ${lightTheme.colors.surfacePressed};
  --bp-color-brand: ${lightTheme.colors.brand};
  --bp-color-brand-hover: ${lightTheme.colors.brandHover};
  --bp-color-brand-deep: ${lightTheme.colors.brandDeep};
  --bp-color-brand-soft: ${lightTheme.colors.brandSoft};
  --bp-color-brand-subtle: ${lightTheme.colors.brandSubtle};
  --bp-color-cyan: ${lightTheme.colors.cyan};
  --bp-color-cyan-soft: ${lightTheme.colors.cyanSoft};
  --bp-color-text-primary: ${lightTheme.colors.textPrimary};
  --bp-color-text-secondary: ${lightTheme.colors.textSecondary};
  --bp-color-text-muted: ${lightTheme.colors.textMuted};
  --bp-color-text-on-brand: ${lightTheme.colors.textOnBrand};
  --bp-color-border: ${lightTheme.colors.border};
  --bp-color-border-strong: ${lightTheme.colors.borderStrong};
  --bp-color-success: ${lightTheme.colors.success};
  --bp-color-success-soft: ${lightTheme.colors.successSoft};
  --bp-color-warning: ${lightTheme.colors.warning};
  --bp-color-warning-soft: ${lightTheme.colors.warningSoft};
  --bp-color-danger: ${lightTheme.colors.danger};
  --bp-color-danger-soft: ${lightTheme.colors.dangerSoft};
  --bp-color-gift: ${lightTheme.colors.gift};
  --bp-color-gift-soft: ${lightTheme.colors.giftSoft};
  --bp-color-scrim: ${lightTheme.colors.scrim};
  --bp-color-shadow: ${lightTheme.colors.shadow};
  --bp-color-shadow-strong: ${lightTheme.colors.shadowStrong};
  --bp-color-highlight: ${lightTheme.colors.highlight};

  width: 100%;
  min-height: 100vh;
  background-color: ${theme.colors.canvas};
  background-image: ${theme.gradients.canvas};
  color: ${theme.colors.textPrimary};
`;

export function GlobalStyles({ children }: PropsWithChildren) {
  return <ThemeCanvas className={globalStyles}>{children}</ThemeCanvas>;
}
