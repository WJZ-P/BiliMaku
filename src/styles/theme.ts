/**
 * BiliCast design tokens.
 *
 * Components only consume semantic CSS variables from `theme`. The concrete
 * light palette lives in `lightTheme`, so adding another scheme never requires
 * rewriting component styles.
 */
export const lightTheme = {
  colors: {
    canvas: "#f4f9ff",
    canvasAccent: "#eaf4ff",
    surface: "#ffffff",
    surfaceElevated: "#ffffff",
    surfaceMuted: "#f7faff",
    surfacePressed: "#edf5ff",
    brand: "#438ff1",
    brandHover: "#2f79de",
    brandDeep: "#2369c5",
    brandSoft: "#dcecff",
    brandSubtle: "#eef6ff",
    cyan: "#5dd7e8",
    cyanSoft: "#e1f9fc",
    textPrimary: "#18324d",
    textSecondary: "#4b647e",
    textMuted: "#7f93a8",
    textOnBrand: "#ffffff",
    border: "#dfeaf5",
    borderStrong: "#c8d9eb",
    success: "#24ad79",
    successSoft: "#e3f7ef",
    warning: "#ed9b3b",
    warningSoft: "#fff3df",
    danger: "#e8627e",
    dangerSoft: "#ffeaf0",
    gift: "#8878ef",
    giftSoft: "#efecff",
    scrim: "rgba(20, 55, 90, 0.12)",
    shadow: "rgba(45, 94, 145, 0.10)",
    shadowStrong: "rgba(37, 85, 136, 0.18)",
    highlight: "rgba(255, 255, 255, 0.82)",
  },
} as const;

export const theme = {
  colors: {
    canvas: "var(--bp-color-canvas)",
    canvasAccent: "var(--bp-color-canvas-accent)",
    surface: "var(--bp-color-surface)",
    surfaceElevated: "var(--bp-color-surface-elevated)",
    surfaceMuted: "var(--bp-color-surface-muted)",
    surfacePressed: "var(--bp-color-surface-pressed)",
    brand: "var(--bp-color-brand)",
    brandHover: "var(--bp-color-brand-hover)",
    brandDeep: "var(--bp-color-brand-deep)",
    brandSoft: "var(--bp-color-brand-soft)",
    brandSubtle: "var(--bp-color-brand-subtle)",
    cyan: "var(--bp-color-cyan)",
    cyanSoft: "var(--bp-color-cyan-soft)",
    textPrimary: "var(--bp-color-text-primary)",
    textSecondary: "var(--bp-color-text-secondary)",
    textMuted: "var(--bp-color-text-muted)",
    textOnBrand: "var(--bp-color-text-on-brand)",
    border: "var(--bp-color-border)",
    borderStrong: "var(--bp-color-border-strong)",
    success: "var(--bp-color-success)",
    successSoft: "var(--bp-color-success-soft)",
    warning: "var(--bp-color-warning)",
    warningSoft: "var(--bp-color-warning-soft)",
    danger: "var(--bp-color-danger)",
    dangerSoft: "var(--bp-color-danger-soft)",
    gift: "var(--bp-color-gift)",
    giftSoft: "var(--bp-color-gift-soft)",
    scrim: "var(--bp-color-scrim)",
    shadow: "var(--bp-color-shadow)",
    shadowStrong: "var(--bp-color-shadow-strong)",
    highlight: "var(--bp-color-highlight)",
  },
  gradients: {
    brand:
      "linear-gradient(135deg, var(--bp-color-brand) 0%, var(--bp-color-brand-deep) 62%, #3bbdd1 135%)",
    soft:
      "linear-gradient(145deg, var(--bp-color-surface) 0%, var(--bp-color-brand-subtle) 100%)",
    canvas:
      "radial-gradient(circle at 88% 4%, rgba(93, 215, 232, 0.17), transparent 28%), radial-gradient(circle at 12% 90%, rgba(67, 143, 241, 0.11), transparent 30%)",
  },
  typography: {
    family:
      'Inter, "SF Pro Display", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
  radius: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "22px",
    xl: "28px",
    pill: "999px",
  },
  shadows: {
    card: "0 12px 34px var(--bp-color-shadow)",
    floating: "0 18px 48px var(--bp-color-shadow-strong)",
    inset: "inset 0 1px 0 var(--bp-color-highlight)",
  },
  motion: {
    fast: "150ms ease",
    normal: "220ms ease",
  },
} as const;

export type BiliCastTheme = typeof theme;
