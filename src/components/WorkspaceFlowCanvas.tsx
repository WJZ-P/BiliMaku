import { styled } from "@linaria/react";
import { useEffect, useRef } from "react";
import {
  mixThemeColor,
  resolveThemeColor,
  THEME_CHANGE_EVENT,
  themeTransitionProgress,
  type ThemeChangeDetail,
} from "../services/theme";

const FlowCanvas = styled.canvas`
  position: fixed;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

interface FlowPalette {
  canvas: string;
  surface: string;
  brand: string;
  brandDeep: string;
  brandSoft: string;
  brandSubtle: string;
  cyan: string;
  cyanSoft: string;
}

/**
 * 工作台流动背景的集中调参区。
 * 数值只影响绘制密度与速度，颜色始终从统一主题变量读取。
 */
export const WORKSPACE_FLOW_TUNING = {
  /** 画布像素比上限；继续提高会更锐利，也会明显增加 GPU/CPU 填充压力。 */
  pixelRatioCap: 1.35,
  /** 全局流速倍率。 */
  speed: 0.82,
  /** 流体色彩强度倍率。 */
  intensity: 1,
  /** 鼠标附近柔光对指针的跟随速度。 */
  pointerEase: 0.035,
} as const;

function colorWithAlpha(color: string, alpha: number) {
  const value = color.trim();
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) {
    const [, red, green, blue] = shortHex;
    return `rgba(${parseInt(red + red, 16)}, ${parseInt(green + green, 16)}, ${parseInt(blue + blue, 16)}, ${alpha})`;
  }

  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }

  const rgb = /^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i.exec(value);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

  return `rgba(67, 143, 241, ${alpha})`;
}

function mixPalette(from: FlowPalette, to: FlowPalette, progress: number): FlowPalette {
  return {
    canvas: mixThemeColor(from.canvas, to.canvas, progress),
    surface: mixThemeColor(from.surface, to.surface, progress),
    brand: mixThemeColor(from.brand, to.brand, progress),
    brandDeep: mixThemeColor(from.brandDeep, to.brandDeep, progress),
    brandSoft: mixThemeColor(from.brandSoft, to.brandSoft, progress),
    brandSubtle: mixThemeColor(from.brandSubtle, to.brandSubtle, progress),
    cyan: mixThemeColor(from.cyan, to.cyan, progress),
    cyanSoft: mixThemeColor(from.cyanSoft, to.cyanSoft, progress),
  };
}

function readPalette(
  canvas: HTMLCanvasElement,
  mode?: ThemeChangeDetail["mode"],
): FlowPalette {
  const styles = getComputedStyle(canvas);
  const read = (token: string, fallback: string) => mode
    ? resolveThemeColor(mode, token, fallback)
    : styles.getPropertyValue(token).trim() || fallback;

  return {
    canvas: read("--bc-color-canvas", "#f4f9ff"),
    surface: read("--bc-color-surface", "#ffffff"),
    brand: read("--bc-color-brand", "#438ff1"),
    brandDeep: read("--bc-color-brand-deep", "#2369c5"),
    brandSoft: read("--bc-color-brand-soft", "#dcecff"),
    brandSubtle: read("--bc-color-brand-subtle", "#eef6ff"),
    cyan: read("--bc-color-cyan", "#5dd7e8"),
    cyanSoft: read("--bc-color-cyan-soft", "#e1f9fc"),
  };
}

/**
 * 主工作台的蓝白流体画布。
 * 动画帧直接写入 Canvas，不触发 React 重渲染；窗口失焦或系统开启减弱动态时自动停帧。
 */
export function WorkspaceFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette(canvas);
    let paletteTransition: {
      from: FlowPalette;
      to: FlowPalette;
      detail: ThemeChangeDetail;
    } | null = null;
    let cssWidth = 1;
    let cssHeight = 1;
    let animationFrame = 0;
    let pointerTargetX = 0.72;
    let pointerTargetY = 0.26;
    let pointerX = pointerTargetX;
    let pointerY = pointerTargetY;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        WORKSPACE_FLOW_TUNING.pixelRatioCap,
      );
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      palette = readPalette(canvas);
    };

    const drawGlow = (
      x: number,
      y: number,
      radius: number,
      color: string,
      opacity: number,
    ) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colorWithAlpha(color, opacity));
      gradient.addColorStop(0.42, colorWithAlpha(color, opacity * 0.56));
      gradient.addColorStop(1, colorWithAlpha(color, 0));
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    const drawRibbon = (
      centerY: number,
      amplitude: number,
      thickness: number,
      frequency: number,
      phase: number,
      firstColor: string,
      secondColor: string,
      opacity: number,
    ) => {
      const step = Math.max(7, Math.round(cssWidth / 170));
      const upperY = (x: number) =>
        centerY
        + Math.sin(x * frequency + phase) * amplitude
        + Math.sin(x * frequency * 2.14 - phase * 0.66) * amplitude * 0.26;
      const lowerY = (x: number) =>
        upperY(x)
        + thickness
        + Math.sin(x * frequency * 1.37 + phase * 0.48) * amplitude * 0.21;

      context.beginPath();
      context.moveTo(0, upperY(0));
      for (let x = step; x <= cssWidth + step; x += step) context.lineTo(x, upperY(x));
      for (let x = cssWidth + step; x >= 0; x -= step) context.lineTo(x, lowerY(x));
      context.closePath();

      const gradient = context.createLinearGradient(0, centerY, cssWidth, centerY + thickness);
      gradient.addColorStop(0, colorWithAlpha(firstColor, opacity * 0.32));
      gradient.addColorStop(0.3, colorWithAlpha(secondColor, opacity));
      gradient.addColorStop(0.7, colorWithAlpha(firstColor, opacity * 0.76));
      gradient.addColorStop(1, colorWithAlpha(secondColor, opacity * 0.24));
      context.fillStyle = gradient;
      context.fill();
    };

    const drawCaustic = (
      centerY: number,
      amplitude: number,
      phase: number,
      opacity: number,
    ) => {
      context.beginPath();
      for (let x = 0; x <= cssWidth; x += 7) {
        const y = centerY
          + Math.sin(x * 0.017 + phase) * amplitude
          + Math.sin(x * 0.041 - phase * 0.61) * amplitude * 0.35;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      const gradient = context.createLinearGradient(0, centerY, cssWidth, centerY);
      gradient.addColorStop(0, colorWithAlpha(palette.surface, 0));
      gradient.addColorStop(0.2, colorWithAlpha(palette.surface, opacity));
      gradient.addColorStop(0.5, colorWithAlpha(palette.cyanSoft, opacity * 0.76));
      gradient.addColorStop(0.82, colorWithAlpha(palette.surface, opacity));
      gradient.addColorStop(1, colorWithAlpha(palette.surface, 0));
      context.strokeStyle = gradient;
      context.lineWidth = 1.2;
      context.stroke();
    };

    const draw = (timestamp: number) => {
      if (paletteTransition) {
        const progress = themeTransitionProgress(paletteTransition.detail, timestamp);
        palette = mixPalette(paletteTransition.from, paletteTransition.to, progress);
        if (progress >= 1) paletteTransition = null;
      }
      const time = (timestamp / 1000) * WORKSPACE_FLOW_TUNING.speed;
      const intensity = WORKSPACE_FLOW_TUNING.intensity;
      pointerX += (pointerTargetX - pointerX) * WORKSPACE_FLOW_TUNING.pointerEase;
      pointerY += (pointerTargetY - pointerY) * WORKSPACE_FLOW_TUNING.pointerEase;

      const base = context.createLinearGradient(0, 0, cssWidth, cssHeight);
      base.addColorStop(0, palette.surface);
      base.addColorStop(0.48, palette.canvas);
      base.addColorStop(1, palette.brandSubtle);
      context.fillStyle = base;
      context.fillRect(0, 0, cssWidth, cssHeight);

      const largestSide = Math.max(cssWidth, cssHeight);
      drawGlow(
        cssWidth * (0.02 + Math.sin(time * 0.2) * 0.09),
        cssHeight * (0.2 + Math.cos(time * 0.18) * 0.14),
        largestSide * 0.58,
        palette.brand,
        0.23 * intensity,
      );
      drawGlow(
        cssWidth * (0.9 + Math.cos(time * 0.17) * 0.08),
        cssHeight * (0.72 + Math.sin(time * 0.22) * 0.12),
        largestSide * 0.62,
        palette.cyan,
        0.25 * intensity,
      );
      drawGlow(
        cssWidth * (0.48 + Math.sin(time * 0.13 + 1.7) * 0.2),
        cssHeight * (0.34 + Math.cos(time * 0.15 + 0.5) * 0.17),
        largestSide * 0.46,
        palette.brandDeep,
        0.11 * intensity,
      );
      drawGlow(
        cssWidth * pointerX,
        cssHeight * pointerY,
        Math.min(largestSide * 0.34, 430),
        palette.cyanSoft,
        0.2 * intensity,
      );

      drawRibbon(
        cssHeight * 0.08 + Math.sin(time * 0.35) * 12,
        16,
        Math.max(48, cssHeight * 0.09),
        0.0095,
        time * 0.58,
        palette.brandSoft,
        palette.cyan,
        0.2 * intensity,
      );
      drawRibbon(
        cssHeight * 0.48 + Math.cos(time * 0.27) * 19,
        24,
        Math.max(70, cssHeight * 0.14),
        0.0072,
        -time * 0.42 + 2.1,
        palette.brand,
        palette.cyanSoft,
        0.16 * intensity,
      );
      drawRibbon(
        cssHeight * 0.82 + Math.sin(time * 0.23 + 1.1) * 16,
        19,
        Math.max(54, cssHeight * 0.1),
        0.0084,
        time * 0.34 + 3.3,
        palette.cyan,
        palette.brandSubtle,
        0.13 * intensity,
      );

      drawCaustic(cssHeight * 0.25, 8, time * 0.56, 0.24 * intensity);
      drawCaustic(cssHeight * 0.67, 11, -time * 0.38 + 1.5, 0.18 * intensity);

      const sheenX = cssWidth * (0.48 + Math.sin(time * 0.14) * 0.5);
      const sheen = context.createLinearGradient(sheenX - 150, 0, sheenX + 150, cssHeight);
      sheen.addColorStop(0, colorWithAlpha(palette.surface, 0));
      sheen.addColorStop(0.5, colorWithAlpha(palette.surface, 0.17));
      sheen.addColorStop(1, colorWithAlpha(palette.surface, 0));
      context.fillStyle = sheen;
      context.fillRect(0, 0, cssWidth, cssHeight);
    };

    const tick = (timestamp: number) => {
      draw(timestamp);
      animationFrame = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const start = () => {
      stop();
      if (reducedMotion.matches) draw(0);
      else if (!document.hidden) animationFrame = window.requestAnimationFrame(tick);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerTargetX = Math.min(1, Math.max(0, event.clientX / cssWidth));
      pointerTargetY = Math.min(1, Math.max(0, event.clientY / cssHeight));
    };
    const handleVisibility = () => start();
    const handleMotionPreference = () => start();
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<ThemeChangeDetail>).detail;
      const target = readPalette(canvas, detail.mode);
      if (detail.durationMs <= 0) {
        palette = target;
        paletteTransition = null;
      } else {
        paletteTransition = { from: { ...palette }, to: target, detail };
      }
      start();
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) draw(0);
    });

    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  return <FlowCanvas ref={canvasRef} aria-hidden="true" data-workspace-flow-canvas />;
}
