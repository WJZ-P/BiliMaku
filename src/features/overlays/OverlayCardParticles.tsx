import { styled } from "@linaria/react";
import { useEffect, useRef } from "react";

const ParticleCanvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0.72;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    opacity: 0.5;
  }
`;

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  haloRadius: number;
  opacity: number;
  phase: number;
  phaseSpeed: number;
  accent: number;
}

interface ParticlePalette {
  brand: string;
  cyan: string;
  brandDeep: string;
}

interface OverlayCardParticlesProps {
  /** 为两张卡片生成不同但稳定的随机粒子布局。 */
  seed: number;
}

const PARTICLE_COUNT = 28;
const TARGET_FRAME_INTERVAL_MS = 1000 / 24;
const PIXEL_RATIO_CAP = 1.2;

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

function readPalette(canvas: HTMLCanvasElement): ParticlePalette {
  const styles = getComputedStyle(canvas);
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback;
  return {
    brand: read("--bc-color-brand", "#438ff1"),
    cyan: read("--bc-color-cyan", "#5dd7e8"),
    brandDeep: read("--bc-color-brand-deep", "#2369c5"),
  };
}

/** 悬浮组件设置卡片背后的低速粒子流，后续可替换为弹幕轮廓。 */
export function OverlayCardParticles({ seed }: OverlayCardParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const random = createRandom(seed);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette(canvas);
    let particles: Particle[] = [];
    let cssWidth = 1;
    let cssHeight = 1;
    let frame = 0;
    let lastFrameTime = 0;
    let visible = true;

    const createParticles = () => {
      particles = Array.from({ length: PARTICLE_COUNT }, () => {
        const angle = random() * Math.PI * 2;
        const speed = 2.4 + random() * 7.2;
        return {
          x: random() * cssWidth,
          y: random() * cssHeight,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          radius: 0.65 + random() * 1.25,
          haloRadius: 3.5 + random() * 7.5,
          opacity: 0.16 + random() * 0.28,
          phase: random() * Math.PI * 2,
          phaseSpeed: 0.22 + random() * 0.42,
          accent: random(),
        };
      });
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      palette = readPalette(canvas);
      createParticles();
    };

    const draw = (deltaSeconds: number, elapsedSeconds: number) => {
      context.clearRect(0, 0, cssWidth, cssHeight);
      const padding = 14;
      for (const particle of particles) {
        if (!reducedMotion.matches) {
          particle.x += particle.velocityX * deltaSeconds;
          particle.y += particle.velocityY * deltaSeconds;
          if (particle.x < -padding) particle.x = cssWidth + padding;
          if (particle.x > cssWidth + padding) particle.x = -padding;
          if (particle.y < -padding) particle.y = cssHeight + padding;
          if (particle.y > cssHeight + padding) particle.y = -padding;
        }

        const pulse = 0.72 + Math.sin(particle.phase + elapsedSeconds * particle.phaseSpeed) * 0.28;
        const color = particle.accent < 0.46
          ? palette.brand
          : particle.accent < 0.82
            ? palette.cyan
            : palette.brandDeep;
        const opacity = particle.opacity * pulse;
        const halo = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.haloRadius,
        );
        halo.addColorStop(0, colorWithAlpha(color, opacity * 0.52));
        halo.addColorStop(1, colorWithAlpha(color, 0));
        context.fillStyle = halo;
        context.fillRect(
          particle.x - particle.haloRadius,
          particle.y - particle.haloRadius,
          particle.haloRadius * 2,
          particle.haloRadius * 2,
        );

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = colorWithAlpha(color, opacity);
        context.fill();
      }
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime;
      if (lastFrameTime === 0 || elapsed >= TARGET_FRAME_INTERVAL_MS) {
        const deltaSeconds = lastFrameTime === 0 ? 0 : Math.min(elapsed / 1000, 0.08);
        lastFrameTime = timestamp;
        draw(deltaSeconds, timestamp / 1000);
      }
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      stop();
      lastFrameTime = 0;
      if (reducedMotion.matches || document.hidden || !visible) {
        draw(0, 0);
        return;
      }
      frame = window.requestAnimationFrame(tick);
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

  return <ParticleCanvas ref={canvasRef} aria-hidden="true" data-overlay-card-particles />;
}
