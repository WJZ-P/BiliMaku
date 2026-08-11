import { styled } from "@linaria/react";
import { memo, useEffect, useRef } from "react";

const ParticleCanvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0.94;
  filter: saturate(1.18);
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    opacity: 0.78;
  }
`;

type ParticleShape = "circle" | "diamond" | "dash";

interface RisingParticle {
  x: number;
  y: number;
  speed: number;
  drift: number;
  waveAmplitude: number;
  radius: number;
  glowRadius: number;
  opacity: number;
  phase: number;
  phaseSpeed: number;
  colorIndex: number;
  shape: ParticleShape;
  rotation: number;
  rotationSpeed: number;
}

interface ParticlePalette {
  colors: string[];
}

interface CardDanmakuParticlesProps {
  /** 固定随机种子，同一张卡片保持稳定但不重复的粒子气质。 */
  seed: number;
}

/** 卡片上升粒子的集中调参区。 */
export const CARD_DANMAKU_TUNING = {
  /** 背景装饰的目标帧率。 */
  framesPerSecond: 24,
  /** 高分屏 Canvas 像素比上限，用于控制填充开销。 */
  pixelRatioCap: 1.25,
  /** 每张卡片的粒子数量范围。 */
  minimumParticleCount: 18,
  maximumParticleCount: 48,
  /** 每个粒子对应的卡片面积，数值越小越密。 */
  areaPerParticle: 6_500,
  /** 粒子从下往上漂浮的速度范围，单位为 CSS 像素/秒。 */
  minimumSpeed: 9,
  maximumSpeed: 24,
  /** 粒子主体半径范围。 */
  minimumRadius: 1.2,
  maximumRadius: 4.4,
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
  return `rgba(102, 204, 255, ${alpha})`;
}

function readPalette(canvas: HTMLCanvasElement): ParticlePalette {
  const styles = getComputedStyle(canvas);
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback;
  return {
    colors: [
      read("--bc-color-brand", "#438ff1"),
      read("--bc-color-cyan", "#5dd7e8"),
      read("--bc-color-brand-soft", "#dcecff"),
      read("--bc-color-cyan-soft", "#e1f9fc"),
      read("--bc-color-surface", "#ffffff"),
      "#66ccff",
      "#b9e8ff",
    ],
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
 * 蓝白色系的上升粒子背景，不绘制弹幕文字或长胶囊。
 * 位置、大小、速度、横向摆动、形状、亮度和颜色均独立随机。
 */
export const CardDanmakuParticles = memo(function CardDanmakuParticles({
  seed,
}: CardDanmakuParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frameInterval = 1000 / CARD_DANMAKU_TUNING.framesPerSecond;
    let palette = readPalette(canvas);
    let particles: RisingParticle[] = [];
    let random = createRandom(seed);
    let cssWidth = 1;
    let cssHeight = 1;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let visible = true;

    const randomShape = (): ParticleShape => {
      const value = random();
      if (value < 0.6) return "circle";
      if (value < 0.84) return "diamond";
      return "dash";
    };

    const resetParticle = (particle: RisingParticle, initial: boolean) => {
      particle.x = random() * cssWidth;
      particle.y = initial
        ? random() * cssHeight
        : cssHeight + 8 + random() * Math.max(18, cssHeight * 0.22);
      particle.speed =
        CARD_DANMAKU_TUNING.minimumSpeed
        + random()
          * (CARD_DANMAKU_TUNING.maximumSpeed - CARD_DANMAKU_TUNING.minimumSpeed);
      particle.drift = -4 + random() * 8;
      particle.waveAmplitude = 2 + random() * 10;
      particle.radius =
        CARD_DANMAKU_TUNING.minimumRadius
        + random()
          * (CARD_DANMAKU_TUNING.maximumRadius - CARD_DANMAKU_TUNING.minimumRadius);
      particle.glowRadius = particle.radius * (2.4 + random() * 2.8);
      particle.opacity = 0.36 + random() * 0.5;
      particle.phase = random() * Math.PI * 2;
      particle.phaseSpeed = 0.45 + random() * 1.15;
      particle.colorIndex = Math.floor(random() * palette.colors.length);
      particle.shape = randomShape();
      particle.rotation = random() * Math.PI * 2;
      particle.rotationSpeed = -0.5 + random();
    };

    const createParticles = () => {
      random = createRandom(seed ^ Math.round(cssWidth * 17 + cssHeight * 31));
      const count = Math.max(
        CARD_DANMAKU_TUNING.minimumParticleCount,
        Math.min(
          CARD_DANMAKU_TUNING.maximumParticleCount,
          Math.round((cssWidth * cssHeight) / CARD_DANMAKU_TUNING.areaPerParticle),
        ),
      );
      particles = Array.from({ length: count }, () => {
        const particle: RisingParticle = {
          x: 0,
          y: 0,
          speed: 0,
          drift: 0,
          waveAmplitude: 0,
          radius: 0,
          glowRadius: 0,
          opacity: 0,
          phase: 0,
          phaseSpeed: 0,
          colorIndex: 0,
          shape: "circle",
          rotation: 0,
          rotationSpeed: 0,
        };
        resetParticle(particle, true);
        return particle;
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

    const drawParticle = (particle: RisingParticle, elapsedSeconds: number) => {
      const color = palette.colors[particle.colorIndex] ?? palette.colors[0];
      const drawX = particle.x
        + Math.sin(particle.phase + elapsedSeconds * particle.phaseSpeed)
          * particle.waveAmplitude;
      const pulse = 0.74
        + Math.sin(particle.phase * 1.7 + elapsedSeconds * particle.phaseSpeed * 0.78)
          * 0.26;
      const opacity = particle.opacity * pulse;
      const halo = context.createRadialGradient(
        drawX,
        particle.y,
        0,
        drawX,
        particle.y,
        particle.glowRadius,
      );
      halo.addColorStop(0, colorWithAlpha(color, opacity * 0.48));
      halo.addColorStop(0.38, colorWithAlpha(color, opacity * 0.2));
      halo.addColorStop(1, colorWithAlpha(color, 0));
      context.fillStyle = halo;
      context.fillRect(
        drawX - particle.glowRadius,
        particle.y - particle.glowRadius,
        particle.glowRadius * 2,
        particle.glowRadius * 2,
      );

      context.save();
      context.translate(drawX, particle.y);
      context.rotate(particle.rotation);
      context.shadowBlur = particle.glowRadius * 0.72;
      context.shadowColor = colorWithAlpha(color, opacity * 0.7);
      context.fillStyle = colorWithAlpha(color, opacity);

      if (particle.shape === "circle") {
        context.beginPath();
        context.arc(0, 0, particle.radius, 0, Math.PI * 2);
        context.fill();
      } else if (particle.shape === "diamond") {
        const size = particle.radius * 1.65;
        context.rotate(Math.PI / 4);
        roundedRect(context, -size / 2, -size / 2, size, size, particle.radius * 0.22);
        context.fill();
      } else {
        const width = particle.radius * (3.2 + particle.opacity * 1.8);
        const height = Math.max(1.4, particle.radius * 0.72);
        roundedRect(context, -width / 2, -height / 2, width, height, height / 2);
        context.fill();
      }

      context.shadowBlur = 0;
      context.fillStyle = colorWithAlpha("#ffffff", opacity * 0.48);
      context.beginPath();
      context.arc(
        -particle.radius * 0.24,
        -particle.radius * 0.28,
        Math.max(0.45, particle.radius * 0.22),
        0,
        Math.PI * 2,
      );
      context.fill();
      context.restore();
    };

    const draw = (deltaSeconds: number, elapsedSeconds: number) => {
      context.clearRect(0, 0, cssWidth, cssHeight);
      const horizontalPadding = 18;
      for (const particle of particles) {
        if (!reducedMotion.matches) {
          particle.y -= particle.speed * deltaSeconds;
          particle.x += particle.drift * deltaSeconds;
          particle.rotation += particle.rotationSpeed * deltaSeconds;
          if (particle.x < -horizontalPadding) particle.x = cssWidth + horizontalPadding;
          if (particle.x > cssWidth + horizontalPadding) particle.x = -horizontalPadding;
          if (particle.y + particle.glowRadius < -10) resetParticle(particle, false);
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

  return <ParticleCanvas ref={canvasRef} aria-hidden="true" data-card-danmaku-particles />;
});
