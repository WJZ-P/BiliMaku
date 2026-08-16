import { css } from "@linaria/core";
import { styled } from "@linaria/react";
import type { PropsWithChildren } from "react";
import { FrostedTooltipLayer } from "../components/FrostedTooltip";
import { darkTheme, lightTheme, theme } from "./theme";

const globalStyles = css`
  @property --bc-color-canvas {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.canvas};
  }
  @property --bc-color-canvas-accent {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.canvasAccent};
  }
  @property --bc-color-surface {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.surface};
  }
  @property --bc-color-surface-elevated {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.surfaceElevated};
  }
  @property --bc-color-surface-muted {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.surfaceMuted};
  }
  @property --bc-color-popover-surface {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.popoverSurface};
  }
  @property --bc-color-surface-pressed {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.surfacePressed};
  }
  @property --bc-color-brand {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.brand};
  }
  @property --bc-color-brand-hover {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.brandHover};
  }
  @property --bc-color-brand-deep {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.brandDeep};
  }
  @property --bc-color-brand-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.brandSoft};
  }
  @property --bc-color-brand-subtle {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.brandSubtle};
  }
  @property --bc-color-message-bubble {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.messageBubble};
  }
  @property --bc-color-cyan {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.cyan};
  }
  @property --bc-color-cyan-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.cyanSoft};
  }
  @property --bc-color-prism-base {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismBase};
  }
  @property --bc-color-prism-surface {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismSurface};
  }
  @property --bc-color-prism-surface-strong {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismSurfaceStrong};
  }
  @property --bc-color-prism-border {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismBorder};
  }
  @property --bc-color-prism-border-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismBorderSoft};
  }
  @property --bc-color-prism-rim {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismRim};
  }
  @property --bc-color-prism-shadow {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.prismShadow};
  }
  @property --bc-color-text-primary {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.textPrimary};
  }
  @property --bc-color-text-secondary {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.textSecondary};
  }
  @property --bc-color-text-muted {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.textMuted};
  }
  @property --bc-color-text-on-brand {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.textOnBrand};
  }
  @property --bc-color-border {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.border};
  }
  @property --bc-color-border-strong {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.borderStrong};
  }
  @property --bc-color-success {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.success};
  }
  @property --bc-color-success-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.successSoft};
  }
  @property --bc-color-warning {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.warning};
  }
  @property --bc-color-warning-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.warningSoft};
  }
  @property --bc-color-danger {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.danger};
  }
  @property --bc-color-danger-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.dangerSoft};
  }
  @property --bc-color-gift {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.gift};
  }
  @property --bc-color-gift-soft {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.giftSoft};
  }
  @property --bc-color-scrim {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.scrim};
  }
  @property --bc-color-shadow {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.shadow};
  }
  @property --bc-color-shadow-strong {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.shadowStrong};
  }
  @property --bc-color-highlight {
    syntax: "<color>";
    inherits: true;
    initial-value: ${lightTheme.colors.highlight};
  }

  :global() {
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :root,
    :root[data-theme="light"] {
      --bc-color-canvas: ${lightTheme.colors.canvas};
      --bc-color-canvas-accent: ${lightTheme.colors.canvasAccent};
      --bc-color-surface: ${lightTheme.colors.surface};
      --bc-color-surface-elevated: ${lightTheme.colors.surfaceElevated};
      --bc-color-surface-muted: ${lightTheme.colors.surfaceMuted};
      --bc-color-popover-surface: ${lightTheme.colors.popoverSurface};
      --bc-color-surface-pressed: ${lightTheme.colors.surfacePressed};
      --bc-color-brand: ${lightTheme.colors.brand};
      --bc-color-brand-hover: ${lightTheme.colors.brandHover};
      --bc-color-brand-deep: ${lightTheme.colors.brandDeep};
      --bc-color-brand-soft: ${lightTheme.colors.brandSoft};
      --bc-color-brand-subtle: ${lightTheme.colors.brandSubtle};
      --bc-color-message-bubble: ${lightTheme.colors.messageBubble};
      --bc-color-cyan: ${lightTheme.colors.cyan};
      --bc-color-cyan-soft: ${lightTheme.colors.cyanSoft};
      --bc-color-prism-base: ${lightTheme.colors.prismBase};
      --bc-color-prism-surface: ${lightTheme.colors.prismSurface};
      --bc-color-prism-surface-strong: ${lightTheme.colors.prismSurfaceStrong};
      --bc-color-prism-border: ${lightTheme.colors.prismBorder};
      --bc-color-prism-border-soft: ${lightTheme.colors.prismBorderSoft};
      --bc-color-prism-rim: ${lightTheme.colors.prismRim};
      --bc-color-prism-shadow: ${lightTheme.colors.prismShadow};
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
    }

    :root[data-theme="dark"] {
      --bc-color-canvas: ${darkTheme.colors.canvas};
      --bc-color-canvas-accent: ${darkTheme.colors.canvasAccent};
      --bc-color-surface: ${darkTheme.colors.surface};
      --bc-color-surface-elevated: ${darkTheme.colors.surfaceElevated};
      --bc-color-surface-muted: ${darkTheme.colors.surfaceMuted};
      --bc-color-popover-surface: ${darkTheme.colors.popoverSurface};
      --bc-color-surface-pressed: ${darkTheme.colors.surfacePressed};
      --bc-color-brand: ${darkTheme.colors.brand};
      --bc-color-brand-hover: ${darkTheme.colors.brandHover};
      --bc-color-brand-deep: ${darkTheme.colors.brandDeep};
      --bc-color-brand-soft: ${darkTheme.colors.brandSoft};
      --bc-color-brand-subtle: ${darkTheme.colors.brandSubtle};
      --bc-color-message-bubble: ${darkTheme.colors.messageBubble};
      --bc-color-cyan: ${darkTheme.colors.cyan};
      --bc-color-cyan-soft: ${darkTheme.colors.cyanSoft};
      --bc-color-prism-base: ${darkTheme.colors.prismBase};
      --bc-color-prism-surface: ${darkTheme.colors.prismSurface};
      --bc-color-prism-surface-strong: ${darkTheme.colors.prismSurfaceStrong};
      --bc-color-prism-border: ${darkTheme.colors.prismBorder};
      --bc-color-prism-border-soft: ${darkTheme.colors.prismBorderSoft};
      --bc-color-prism-rim: ${darkTheme.colors.prismRim};
      --bc-color-prism-shadow: ${darkTheme.colors.prismShadow};
      --bc-color-text-primary: ${darkTheme.colors.textPrimary};
      --bc-color-text-secondary: ${darkTheme.colors.textSecondary};
      --bc-color-text-muted: ${darkTheme.colors.textMuted};
      --bc-color-text-on-brand: ${darkTheme.colors.textOnBrand};
      --bc-color-border: ${darkTheme.colors.border};
      --bc-color-border-strong: ${darkTheme.colors.borderStrong};
      --bc-color-success: ${darkTheme.colors.success};
      --bc-color-success-soft: ${darkTheme.colors.successSoft};
      --bc-color-warning: ${darkTheme.colors.warning};
      --bc-color-warning-soft: ${darkTheme.colors.warningSoft};
      --bc-color-danger: ${darkTheme.colors.danger};
      --bc-color-danger-soft: ${darkTheme.colors.dangerSoft};
      --bc-color-gift: ${darkTheme.colors.gift};
      --bc-color-gift-soft: ${darkTheme.colors.giftSoft};
      --bc-color-scrim: ${darkTheme.colors.scrim};
      --bc-color-shadow: ${darkTheme.colors.shadow};
      --bc-color-shadow-strong: ${darkTheme.colors.shadowStrong};
      --bc-color-highlight: ${darkTheme.colors.highlight};
    }

    :root {
      --bc-theme-transition-duration: ${theme.motion.themeTransitionDurationMs}ms;
      color-scheme: light;
    }

    :root[data-theme="dark"] {
      color-scheme: dark;
    }


    :root[data-theme-transitioning="true"] {
      transition-property:
        --bc-color-canvas,
        --bc-color-canvas-accent,
        --bc-color-surface,
        --bc-color-surface-elevated,
        --bc-color-surface-muted,
        --bc-color-popover-surface,
        --bc-color-surface-pressed,
        --bc-color-brand,
        --bc-color-brand-hover,
        --bc-color-brand-deep,
        --bc-color-brand-soft,
        --bc-color-brand-subtle,
        --bc-color-message-bubble,
        --bc-color-cyan,
        --bc-color-cyan-soft,
        --bc-color-prism-base,
        --bc-color-prism-surface,
        --bc-color-prism-surface-strong,
        --bc-color-prism-border,
        --bc-color-prism-border-soft,
        --bc-color-prism-rim,
        --bc-color-prism-shadow,
        --bc-color-text-primary,
        --bc-color-text-secondary,
        --bc-color-text-muted,
        --bc-color-text-on-brand,
        --bc-color-border,
        --bc-color-border-strong,
        --bc-color-success,
        --bc-color-success-soft,
        --bc-color-warning,
        --bc-color-warning-soft,
        --bc-color-danger,
        --bc-color-danger-soft,
        --bc-color-gift,
        --bc-color-gift-soft,
        --bc-color-scrim,
        --bc-color-shadow,
        --bc-color-shadow-strong,
        --bc-color-highlight;
      transition-duration: var(--bc-theme-transition-duration);
      transition-timing-function: ${theme.motion.themeTransitionTiming};
    }

    @media (prefers-reduced-motion: reduce) {
      :root[data-theme-transitioning="true"] {
        transition-duration: 0ms;
      }
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
      color: ${theme.colors.textPrimary};
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
      outline: 3px solid ${theme.colors.brandSoft};
      outline-offset: 2px;
    }

    ::selection {
      background: ${theme.colors.brandSoft};
      color: ${theme.colors.textPrimary};
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: ${theme.radius.pill};
      background: ${theme.colors.borderStrong};
      background-clip: padding-box;
    }
  }
`;

const ThemeCanvas = styled.div`
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  position: relative;
  background-color: ${theme.colors.canvas};
  background-image: ${theme.gradients.canvas};
  color: ${theme.colors.textPrimary};

  &[data-window-mode="overlay"] {
    background-color: transparent;
    background-image: none;
  }

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
}: PropsWithChildren<{ windowMode?: "login" | "workspace" | "overlay" }>) {
  return (
    <ThemeCanvas className={globalStyles} data-window-mode={windowMode}>
      {children}
      <FrostedTooltipLayer />
    </ThemeCanvas>
  );
}
