import { styled } from "@linaria/react";
import { theme } from "../styles/theme";

export const Panel = styled.section`
  overflow: hidden;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.lg};
  background: color-mix(in srgb, ${theme.colors.surface} 93%, transparent);
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};
  backdrop-filter: blur(16px);
`;

/**
 * 设置型页面共用的硬朗毛玻璃面板。
 * 外层只负责裁切与边界，动态粒子和内容统一放进 FrostedPanelSurface。
 */
export const FrostedPanel = styled.section`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 86%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, ${theme.colors.surface} 15%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 72%, transparent),
    inset 0 -1px 0 color-mix(in srgb, ${theme.colors.textMuted} 9%, transparent);
`;

/** 设置型面板位于粒子 Canvas 上方的真实玻璃表层。 */
export const FrostedPanelSurface = styled.div`
  position: relative;
  z-index: 1;
  min-height: 100%;
  background:
    linear-gradient(
      132deg,
      color-mix(in srgb, ${theme.colors.highlight} 14%, transparent),
      transparent 42%
    ),
    color-mix(
      in srgb,
      ${theme.colors.surface} ${theme.frostedGlass.surfaceMix},
      transparent
    );
  -webkit-backdrop-filter: blur(${theme.frostedGlass.blur})
    saturate(${theme.frostedGlass.saturation})
    brightness(${theme.frostedGlass.brightness})
    contrast(${theme.frostedGlass.contrast});
  backdrop-filter: blur(${theme.frostedGlass.blur})
    saturate(${theme.frostedGlass.saturation})
    brightness(${theme.frostedGlass.brightness})
    contrast(${theme.frostedGlass.contrast});

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

  & > [data-card-danmaku-particles] {
    position: absolute;
    z-index: 0;
  }

  & > :not([data-card-danmaku-particles]) {
    position: relative;
    z-index: 2;
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background: color-mix(in srgb, ${theme.colors.surface} 84%, ${theme.colors.canvasAccent});
  }
`;

export const PanelHeader = styled.header`
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid ${theme.colors.border};
`;

export const PanelHeading = styled.div`
  min-width: 0;
`;

export const PanelTitle = styled.h2`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const PanelDescription = styled.p`
  margin: 3px 0 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
`;

/** 面板标题栏右侧的轻量状态文字，避免再套一层胶囊容器。 */
export const PanelMeta = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-weight: 720;
  letter-spacing: 0.02em;
`;

export const SubtleButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 700;
  transition: all ${theme.motion.fast};

  &:hover {
    border-color: ${theme.colors.borderStrong};
    background: ${theme.colors.surface};
    color: ${theme.colors.brand};
  }
`;

export const EyebrowBadge = styled.span`
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
`;
