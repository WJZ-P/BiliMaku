import { styled } from "@linaria/react";
import { useEffect, useRef } from "react";

const DanmakuCanvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 1;
  filter: blur(0.55px) saturate(1.34);
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    opacity: 0.82;
  }
`;

interface DanmakuParticle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  direction: -1 | 1;
  opacity: number;
  accent: number;
  phase: number;
  phaseSpeed: number;
  drift: number;
  trail: number;
  segments: number[];
}

interface DanmakuPalette {
  brand: string;
  cyan: string;
  brandDeep: string;
}

interface CardDanmakuParticlesProps {
  /** 固定随机种子，让同一张卡片每次挂载时保持稳定的视觉气质。 */
  seed: number;
}

/** 卡片弹幕背景集中调参区。 */
export const CARD_DANMAKU_TUNING = {
  /** 动画刷新率；背景装饰无需跟随屏幕满帧运行。 */
  framesPerSecond: 24,
  /** Canvas 像素比上限，限制高分屏下的填充开销。 */
  pixelRatioCap: 1.25,
  /** 每张卡片最少和最多同时存在的弹幕粒子数。 */
  minimumParticleCount: 7,
  maximumParticleCount: 16,
  /** 数值越小粒子越密。 */
  areaPerParticle: 18_000,
  /** 弹幕横向移动速度范围，单位为 CSS 像素/秒。 */
  minimumSpeed: 11,
  maximumSpeed: 25,
} as const;

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function colorWithAlpha(color: string, alpha: number) {
  const value = color.trim();
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i.exec(value);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return `rgba(67, 143, 241, ${alpha})`;
}

function readPalette(canvas: HTMLCanvasElement): DanmakuPalette {
  const styles = getComputedStyle(canvas);
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback;
  return {
    brand: read("--bc-color-brand", "#438ff1"),
    cyan: read("--bc-color-cyan", "#5dd7e8"),
    brandDeep: read("--bc-color-brand-deep", "#2369c5"),
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

/**
 * 低频绘制的装饰性弹幕流。Canvas 位于玻璃表层背后，粒子穿过时会被
 * backdrop-filter 二次扩散，从而让半透明与高斯模糊更容易被感知。
 */
export function CardDanmakuParticles({ seed }: CardDanmakuParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frameInterval = 1000 / CARD_DANMAKU_TUNING.framesPerSecond;
    let palette = readPalette(canvas);
    let particles: DanmakuParticle[] = [];
    let cssWidth = 1;
    let cssHeight = 1;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let visible = true;

    const createParticles = () => {
      const random = createRandom(seed ^ Math.round(cssWidth * 17 + cssHeight * 31));
      const count = Math.max(
        CARD_DANMAKU_TUNING.minimumParticleCount,
        Math.min(
          CARD_DANMAKU_TUNING.maximumParticleCount,
          Math.round((cssWidth * cssHeight) / CARD_DANMAKU_TUNING.areaPerParticle),
        ),
      );
      particles = Array.from({ length: count }, () => {
        const height = 16 + random() * 8;
        const width = 72 + random() * 100;
        return {
          x: random() * (cssWidth + width) - width,
          y: 8 + random() * Math.max(1, cssHeight - height - 16),
          width,
          height,
          speed:
            CARD_DANMAKU_TUNING.minimumSpeed
            + random()
              * (CARD_DANMAKU_TUNING.maximumSpeed - CARD_DANMAKU_TUNING.minimumSpeed),
          direction: random() < 0.86 ? -1 : 1,
          opacity: 0.5 + random() * 0.28,
          accent: random(),
          phase: random() * Math.PI * 2,
          phaseSpeed: 0.35 + random() * 0.58,
          drift: 1.2 + random() * 3.2,
          trail: 10 + random() * 24,
          segments: [0.3 + random() * 0.13, 0.18 + random() * 0.16],
        };
      });
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        CARD_DANMAKU_TUNING.pixelRatioCap,
      );
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      palette = readPalette(canvas);
      createParticles();
    };

    const drawParticle = (particle: DanmakuParticle, elapsedSeconds: number) => {
      const color = particle.accent < 0.46
        ? palette.brand
        : particle.accent < 0.8
          ? palette.cyan
          : palette.brandDeep;
      const y = particle.y + Math.sin(particle.phase + elapsedSeconds * particle.phaseSpeed) * particle.drift;
      const pulse = 0.84 + Math.sin(particle.phase + elapsedSeconds * particle.phaseSpeed * 0.72) * 0.16;
      const opacity = particle.opacity * pulse;
      const trailStart = particle.direction < 0
        ? particle.x + particle.width
        : particle.x - particle.trail;
      const trailEnd = particle.direction < 0
        ? particle.x + particle.width + particle.trail
        : particle.x;
      const trail = context.createLinearGradient(trailStart, y, trailEnd, y);
      if (particle.direction < 0) {
        trail.addColorStop(0, colorWithAlpha(color, opacity * 0.42));
        trail.addColorStop(1, colorWithAlpha(color, 0));
      } else {
        trail.addColorStop(0, colorWithAlpha(color, 0));
        trail.addColorStop(1, colorWithAlpha(color, opacity * 0.42));
      }
      context.fillStyle = trail;
      context.fillRect(
        Math.min(trailStart, trailEnd),
        y + particle.height * 0.28,
        Math.abs(trailEnd - trailStart),
        particle.height * 0.44,
      );

      context.save();
      context.shadowBlur = 9;
      context.shadowColor = colorWithAlpha(color, opacity * 0.64);
      roundedRect(context, particle.x, y, particle.width, particle.height, particle.height / 2);
      context.fillStyle = colorWithAlpha(color, opacity * 0.24);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = colorWithAlpha(color, opacity * 0.9);
      context.lineWidth = 1;
      context.stroke();

      const avatarRadius = particle.height * 0.24;
      const avatarX = particle.x + particle.height * 0.52;
      const avatarY = y + particle.height / 2;
      context.beginPath();
      context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      context.fillStyle = colorWithAlpha(color, Math.min(1, opacity));
      context.fill();

      const contentX = particle.x + particle.height * 0.94;
      const contentWidth = Math.max(8, particle.width - particle.height * 1.22);
      let segmentX = contentX;
      for (const segment of particle.segments) {
        const segmentWidth = contentWidth * segment;
        roundedRect(
          context,
          segmentX,
          y + particle.height * 0.37,
          segmentWidth,
          Math.max(1.4, particle.height * 0.2),
          particle.height * 0.1,
        );
        context.fillStyle = colorWithAlpha(color, opacity * 0.9);
        context.fill();
        segmentX += segmentWidth + particle.height * 0.18;
      }
      context.restore();
    };

    const draw = (deltaSeconds: number, elapsedSeconds: number) => {
      context.clearRect(0, 0, cssWidth, cssHeight);
      const padding = 36;
      for (const particle of particles) {
        if (!reducedMotion.matches) {
          particle.x += particle.speed * particle.direction * deltaSeconds;
          if (particle.direction < 0 && particle.x + particle.width < -padding) {
            particle.x = cssWidth + padding;
          } else if (particle.direction > 0 && particle.x > cssWidth + padding) {
            particle.x = -particle.width - padding;
          }
        }
        drawParticle(particle, elapsedSeconds);
      }
    };

    const stop = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const tick = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime;
      if (lastFrameTime === 0 || elapsed >= frameInterval) {
        const deltaSeconds = lastFrameTime === 0 ? 0 : Math.min(elapsed / 1000, 0.1);
        lastFrameTime = timestamp;
        draw(deltaSeconds, timestamp / 1000);
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      stop();
      lastFrameTime = 0;
      if (reducedMotion.matches || document.hidden || !visible) {
        draw(0, 0);
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      start();
    });
    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      start();
    }, { rootMargin: "120px" });
    const handleVisibility = () => start();
    const handleMotionPreference = () => start();

    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, [seed]);

  return <DanmakuCanvas ref={canvasRef} aria-hidden="true" data-card-danmaku-particles />;
}
