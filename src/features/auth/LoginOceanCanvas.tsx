import { styled } from "@linaria/react";
import { useEffect, useRef } from "react";
import {
  mixThemeColor,
  resolveThemeColor,
  THEME_CHANGE_EVENT,
  themeTransitionProgress,
  type ThemeChangeDetail,
} from "../../services/theme";

const OceanCanvas = styled.canvas`
  position: fixed;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0;
  pointer-events: none;
`;

interface OceanPalette {
  canvas: string;
  surface: string;
  brand: string;
  brandDeep: string;
  brandSoft: string;
  brandSubtle: string;
  cyan: string;
  cyanSoft: string;
}

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
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }

  return `rgba(67, 143, 241, ${alpha})`;
}

function mixPalette(from: OceanPalette, to: OceanPalette, progress: number): OceanPalette {
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
): OceanPalette {
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

/** 覆盖整个登录窗口的 Canvas 流体背景，标题栏与内容区共享同一张画布。 */
export function LoginOceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette(canvas);
    let paletteTransition: {
      from: OceanPalette;
      to: OceanPalette;
      detail: ThemeChangeDetail;
    } | null = null;
    let cssWidth = 1;
    let cssHeight = 1;
    let animationFrame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      palette = readPalette(canvas);
    };

    const drawBlob = (
      x: number,
      y: number,
      radius: number,
      color: string,
      opacity: number,
    ) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colorWithAlpha(color, opacity));
      gradient.addColorStop(0.48, colorWithAlpha(color, opacity * 0.58));
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
    ) => {
      const step = 6;
      const upperY = (x: number) =>
        centerY
        + Math.sin(x * frequency + phase) * amplitude
        + Math.sin(x * frequency * 2.2 - phase * 0.72) * amplitude * 0.28;
      const lowerY = (x: number) =>
        upperY(x)
        + thickness
        + Math.sin(x * frequency * 1.28 + phase * 0.46) * amplitude * 0.24;

      context.beginPath();
      context.moveTo(0, upperY(0));
      for (let x = step; x <= cssWidth + step; x += step) {
        context.lineTo(x, upperY(x));
      }
      for (let x = cssWidth + step; x >= 0; x -= step) {
        context.lineTo(x, lowerY(x));
      }
      context.closePath();

      const gradient = context.createLinearGradient(0, centerY, cssWidth, centerY + thickness);
      gradient.addColorStop(0, colorWithAlpha(firstColor, 0.1));
      gradient.addColorStop(0.36, colorWithAlpha(secondColor, 0.28));
      gradient.addColorStop(0.68, colorWithAlpha(firstColor, 0.22));
      gradient.addColorStop(1, colorWithAlpha(secondColor, 0.08));
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
      for (let x = 0; x <= cssWidth; x += 5) {
        const y = centerY
          + Math.sin(x * 0.022 + phase) * amplitude
          + Math.sin(x * 0.049 - phase * 0.64) * amplitude * 0.34;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      const gradient = context.createLinearGradient(0, centerY, cssWidth, centerY);
      gradient.addColorStop(0, colorWithAlpha(palette.surface, 0));
      gradient.addColorStop(0.22, colorWithAlpha(palette.surface, opacity));
      gradient.addColorStop(0.52, colorWithAlpha(palette.cyanSoft, opacity * 0.72));
      gradient.addColorStop(0.82, colorWithAlpha(palette.surface, opacity));
      gradient.addColorStop(1, colorWithAlpha(palette.surface, 0));
      context.strokeStyle = gradient;
      context.lineWidth = 1.4;
      context.stroke();
    };

    const draw = (timestamp: number) => {
      if (paletteTransition) {
        const progress = themeTransitionProgress(paletteTransition.detail, timestamp);
        palette = mixPalette(paletteTransition.from, paletteTransition.to, progress);
        if (progress >= 1) paletteTransition = null;
      }
      const time = timestamp / 1000;
      context.clearRect(0, 0, cssWidth, cssHeight);

      const base = context.createLinearGradient(0, 0, cssWidth, cssHeight);
      base.addColorStop(0, palette.surface);
      base.addColorStop(0.42, palette.canvas);
      base.addColorStop(1, palette.brandSubtle);
      context.fillStyle = base;
      context.fillRect(0, 0, cssWidth, cssHeight);

      drawBlob(
        cssWidth * (0.08 + Math.sin(time * 0.31) * 0.1),
        cssHeight * (0.18 + Math.cos(time * 0.27) * 0.12),
        Math.max(cssWidth, cssHeight) * 0.66,
        palette.brand,
        0.29,
      );
      drawBlob(
        cssWidth * (0.88 + Math.cos(time * 0.24) * 0.09),
        cssHeight * (0.7 + Math.sin(time * 0.29) * 0.13),
        Math.max(cssWidth, cssHeight) * 0.72,
        palette.cyan,
        0.3,
      );
      drawBlob(
        cssWidth * (0.56 + Math.sin(time * 0.2 + 1.8) * 0.18),
        cssHeight * (0.38 + Math.cos(time * 0.22 + 0.7) * 0.16),
        Math.max(cssWidth, cssHeight) * 0.5,
        palette.brandDeep,
        0.13,
      );

      drawRibbon(
        cssHeight * 0.16 + Math.sin(time * 0.42) * 12,
        14,
        58,
        0.013,
        time * 0.72,
        palette.brandSoft,
        palette.cyan,
      );
      drawRibbon(
        cssHeight * 0.58 + Math.cos(time * 0.3) * 16,
        21,
        82,
        0.009,
        -time * 0.56 + 2.4,
        palette.brand,
        palette.cyanSoft,
      );

      drawCaustic(cssHeight * 0.3, 8, time * 0.78, 0.34);
      drawCaustic(cssHeight * 0.72, 11, -time * 0.54 + 1.7, 0.25);

      const sheenX = cssWidth * (0.5 + Math.sin(time * 0.21) * 0.48);
      const sheen = context.createLinearGradient(sheenX - 100, 0, sheenX + 100, cssHeight);
      sheen.addColorStop(0, colorWithAlpha(palette.surface, 0));
      sheen.addColorStop(0.5, colorWithAlpha(palette.surface, 0.22));
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
      if (reducedMotion.matches) {
        draw(0);
      } else if (!document.hidden) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) draw(0);
    });
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

    resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  return <OceanCanvas ref={canvasRef} aria-hidden="true" data-login-ocean-canvas />;
}
