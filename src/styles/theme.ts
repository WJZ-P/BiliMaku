/** 浅蓝主题下的默认聊天气泡色。 */
export const DEFAULT_MESSAGE_BUBBLE_COLOR = "#66CCFF";

/**
 * bilimaku design tokens.
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
    popoverSurface: "#edf1f5",
    surfacePressed: "#edf5ff",
    brand: "#438ff1",
    brandHover: "#2f79de",
    brandDeep: "#2369c5",
    brandSoft: "#dcecff",
    brandSubtle: "#eef6ff",
    messageBubble: DEFAULT_MESSAGE_BUBBLE_COLOR,
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
    canvas: "var(--bc-color-canvas)",
    canvasAccent: "var(--bc-color-canvas-accent)",
    surface: "var(--bc-color-surface)",
    surfaceElevated: "var(--bc-color-surface-elevated)",
    surfaceMuted: "var(--bc-color-surface-muted)",
    popoverSurface: "var(--bc-color-popover-surface)",
    surfacePressed: "var(--bc-color-surface-pressed)",
    brand: "var(--bc-color-brand)",
    brandHover: "var(--bc-color-brand-hover)",
    brandDeep: "var(--bc-color-brand-deep)",
    brandSoft: "var(--bc-color-brand-soft)",
    brandSubtle: "var(--bc-color-brand-subtle)",
    messageBubble: "var(--bc-color-message-bubble)",
    cyan: "var(--bc-color-cyan)",
    cyanSoft: "var(--bc-color-cyan-soft)",
    textPrimary: "var(--bc-color-text-primary)",
    textSecondary: "var(--bc-color-text-secondary)",
    textMuted: "var(--bc-color-text-muted)",
    textOnBrand: "var(--bc-color-text-on-brand)",
    border: "var(--bc-color-border)",
    borderStrong: "var(--bc-color-border-strong)",
    success: "var(--bc-color-success)",
    successSoft: "var(--bc-color-success-soft)",
    warning: "var(--bc-color-warning)",
    warningSoft: "var(--bc-color-warning-soft)",
    danger: "var(--bc-color-danger)",
    dangerSoft: "var(--bc-color-danger-soft)",
    gift: "var(--bc-color-gift)",
    giftSoft: "var(--bc-color-gift-soft)",
    scrim: "var(--bc-color-scrim)",
    shadow: "var(--bc-color-shadow)",
    shadowStrong: "var(--bc-color-shadow-strong)",
    highlight: "var(--bc-color-highlight)",
  },
  gradients: {
    brand:
      "linear-gradient(135deg, var(--bc-color-brand) 0%, var(--bc-color-brand-deep) 62%, #3bbdd1 135%)",
    soft:
      "linear-gradient(145deg, var(--bc-color-surface) 0%, var(--bc-color-brand-subtle) 100%)",
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
  layout: {
    /** 工作台自绘标题栏高度；可容纳账号头像经验环和数据摘要。 */
    titleBarHeight: "70px",
    /** 登录页保留的紧凑窗口控制区高度。 */
    compactTitleBarHeight: "32px",
    /** 工作台右上角窗口控制按钮的正方形边长。 */
    titleBarControlSize: "36px",
    /** 统一图标系统中窗口控制按钮的图标尺寸。 */
    titleBarControlIconSizePx: 14,
    /** 窗口控制按钮之间以及控制区左右两侧的统一间距。 */
    titleBarControlSpacing: "4px",
    /** 窗口控制按钮圆角。 */
    titleBarControlRadius: "4px",
  },
  titleBar: {
    /** 标题栏账号头像的实际宽高。 */
    avatarSizePx: 48,
    /** 头像悬浮资料卡宽度。 */
    profileTooltipWidthPx: 360,
    /** 头像悬浮资料卡内的大头像宽高。 */
    profileTooltipAvatarSizePx: 68,
    /** 资料卡房间 ID、UID 标签与数值的统一字号。 */
    profileIdentityFontSize: "12px",
    /** 顶部实时统计格高度。 */
    metricHeightPx: 42,
    /** 顶部实时统计格最小宽度。 */
    metricMinWidthPx: 104,
    /** 顶部统计标签字号。 */
    metricLabelFontSize: "10px",
    /** 顶部统计数值字号。 */
    metricValueFontSize: "14px",
    /** 顶部统计标签图标尺寸。 */
    metricIconSizePx: 13,
  },
  frostedGlass: {
    /** 中性玻璃表层占比；降低会更通透，提高会更接近实体面板。 */
    surfaceMix: "74%",
    /** 背景高斯模糊半径；OpenAI 风格的主要材质来源。 */
    blur: "28px",
    /** 模糊背景的色彩、亮度与对比度校正。 */
    saturation: 1.24,
    brightness: 1.035,
    contrast: 1.025,
    /** 微噪点纹理透明度，用来消除纯色塑料感。 */
    noiseOpacity: 0.055,
    /** WebGL 折射层透明度；仅保留轻微灵动感，不覆盖真实毛玻璃。 */
    refractionOpacity: 0.24,
  },
  tooltip: {
    /** Tooltip 正文字号；感觉偏小或偏大时优先调整这里。 */
    fontSize: "12px",
    /** Tooltip 文字粗细。 */
    fontWeight: 600,
    /** 背景高斯模糊半径。 */
    blur: "2px",
    /** 毛玻璃对背景颜色的饱和度增强。 */
    backdropSaturation: 1.72,
    /** 毛玻璃背景的亮度与对比度。 */
    backdropBrightness: 1.08,
    backdropContrast: 1.06,
    /** 玻璃主体圆角。 */
    radius: "6px",
    /** 白色表层在玻璃背景中的混合比例，数值越低越透明。 */
    surfaceMix: "13%",
    /** 浅蓝表层在玻璃背景中的混合比例。 */
    accentMix: "50%",
    /** Tooltip 渐入与位移弹簧从出现到静止的总时长。 */
    entranceDurationMs: 520,
    /** 位移弹簧阻尼；数值越大越快停止振荡。 */
    entranceSpringDamping: 5.7,
    /** 位移弹簧频率；数值越大回弹次数越多。 */
    entranceSpringFrequency: 11.4,
    /** Tooltip 渐入时从下方开始的位移距离。 */
    entranceOffsetPx: 7,
    /** Tooltip 消失时的淡出时长。 */
    exitDurationMs: 180,
    /** Tooltip 淡出时向下回落的距离。 */
    exitOffsetPx: 3,
    /** 渐入占整个弹簧时长的比例，剩余时间只保留回弹。 */
    entranceFadePortion: 0.48,
    /** 液态玻璃边缘折射光强度。 */
    liquidRefraction: 0.46,
    /** 红蓝色散强度。 */
    liquidDispersion: 0.3,
    /** 鼠标悬停后显示 Tooltip 的默认等待时间。 */
    showDelayMs: 260,
  },
  sidebarEffects: {
    /** 导航项悬停时整体向右移动的距离。 */
    hoverOffset: "4px",
    /** 图标在组件整体位移之外额外舒展的距离。 */
    iconHoverOffset: "2px",
    /** 文案在组件整体位移之外额外舒展的距离。 */
    textHoverOffset: "4px",
    /** 为右移动画预留的空间，避免导航项被侧边栏裁切。 */
    motionGutter: "7px",
    /** Hover 底色从右向左滑入的状态机过渡。 */
    hoverColorEnterTransition: "340ms cubic-bezier(0.2, 0.86, 0.24, 1)",
    /** Hover 底色向右退出的状态机过渡。 */
    hoverColorExitTransition: "260ms cubic-bezier(0.4, 0, 0.68, 0.28)",
    /** 选中态左侧指示条宽度；绝对定位，不参与内容布局。 */
    selectionRailWidthPx: 2,
    /** 导航项默认最小高度。 */
    navigationItemMinHeightPx: 50,
    /** 导航图标布局槽宽度；只负责对齐，不绘制方形底座。 */
    navigationIconSlotSizePx: 31,
    /** 导航图标自身尺寸。 */
    navigationIconSizePx: 18,
    /** 导航主标题字号。 */
    navigationLabelFontSize: "13px",
    /** 导航描述文字字号。 */
    navigationDescriptionFontSize: "10px",
    /** 收缩按钮图标尺寸。 */
    collapseIconSizePx: 16,
    /** 收缩按钮文字字号。 */
    collapseLabelFontSize: "11px",
    /** 每次进入 Hover 时从右侧创建的粒子数量。 */
    particleBurstCount: 12,
    /** 保持 Hover 时连续补充粒子的基础间隔。 */
    particleEmissionIntervalMs: 82,
    /** 连续发射间隔的随机浮动范围，避免粒子节奏过于机械。 */
    particleEmissionJitterMs: 24,
    /** 单个侧边栏组件允许同时存在的粒子上限。 */
    particleMaxCount: 42,
    /** 新粒子出生时采用鼠标方向的概率；只在出生瞬间采样一次。 */
    particlePointerTrackingProbability: 0.82,
    /** 鼠标方向对初始速度向量的随机影响范围。 */
    particlePointerInfluenceMin: 0.76,
    particlePointerInfluenceMax: 0.94,
    /** 鼠标目标点的随机偏移半径，让粒子聚拢但不会排成直线。 */
    particlePointerTargetJitterPx: 14,
    /** 未追踪鼠标的粒子围绕向左方向自由散射的最大弧度。 */
    particleFreeDirectionSpreadRadians: 0.36,
    /** 单颗粒子出生速度范围，单位为像素每秒。 */
    particleSpeedMinPxPerSecond: 78,
    particleSpeedMaxPxPerSecond: 158,
    /** 离开 Hover 后单颗粒子随机淡出时长的范围。 */
    particleExitFadeMinMs: 180,
    particleExitFadeMaxMs: 720,
    /** 极端帧调度情况下结束 exiting 状态的兜底时间。 */
    particleExitFadeSafetyBufferMs: 120,
    /** 粒子核心半径的随机范围。 */
    particleCoreSizeMinPx: 0.7,
    particleCoreSizeMaxPx: 1.65,
    /** 粒子周围光晕半径的随机范围。 */
    particleHaloRadiusMinPx: 3,
    particleHaloRadiusMaxPx: 7.5,
    /** 粒子光晕透明度的随机范围。 */
    particleHaloOpacityMin: 0.12,
    particleHaloOpacityMax: 0.3,
  },
  shadows: {
    card: "0 12px 34px var(--bc-color-shadow)",
    floating: "0 18px 48px var(--bc-color-shadow-strong)",
    inset: "inset 0 1px 0 var(--bc-color-highlight)",
  },
  motion: {
    fast: "150ms ease",
    normal: "220ms ease",
    /** 通用图标与轻交互弹簧。 */
    spring: "420ms cubic-bezier(0.2, 1.65, 0.3, 1)",
    /** 侧边栏宽度与收缩箭头专用弹簧。 */
    sidebarSpring: "400ms cubic-bezier(0.2, 1.20, 0.3, 1)",
  },
} as const;

export type BilimakuTheme = typeof theme;
