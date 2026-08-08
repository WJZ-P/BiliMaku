import { styled } from "@linaria/react";
import {
  useEffect,
  useReducer,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
} from "react";
import { lightTheme, theme } from "../styles/theme";

type SidebarHoverPhase = "idle" | "entering" | "active" | "exiting";

interface SidebarHoverMachine {
  /** 当前交互生命周期阶段。 */
  phase: SidebarHoverPhase;
  /** 每次重新进入时递增，确保 Canvas 创建全新的粒子批次。 */
  session: number;
}

type SidebarHoverEvent =
  | { type: "ENTER" }
  | { type: "ENTERED" }
  | { type: "LEAVE" }
  | { type: "EXITED" };

interface GlowParticle {
  /** 粒子始终从组件右侧之外生成。 */
  x: number;
  y: number;
  /** 初始速度在粒子出生时确定；多数粒子指向当时的鼠标位置。 */
  velocityX: number;
  velocityY: number;
  /** 粒子核心半径。 */
  size: number;
  /** 核心周围的随机光晕半径与透明度。 */
  haloRadius: number;
  haloAlpha: number;
  /** 离开 Hover 后每颗粒子独立的淡出时长与已用时间。 */
  exitFadeDurationMs: number;
  exitFadeElapsedMs: number;
  /** 从统一主题变量读取的粒子颜色。 */
  color: string;
  alpha: number;
  /** 延迟用于错开同一批粒子的入场时间。 */
  delay: number;
  age: number;
  maxAge: number;
  /** 正弦扰动让运动路径带有轻微弧度。 */
  phase: number;
  waveFrequency: number;
  waveStrength: number;
}

interface ParticlePointerSnapshot {
  /** 鼠标相对当前组件 Canvas 的横坐标。 */
  x: number;
  /** 鼠标相对当前组件 Canvas 的纵坐标。 */
  y: number;
  /** 指针当前是否停留在组件内。 */
  active: boolean;
}
type ParticleGlowHoverProps = PropsWithChildren;

const Surface = styled.div`
  --sidebar-particle-blue: ${theme.colors.brand};
  --sidebar-particle-cyan: ${theme.colors.cyan};
  --sidebar-particle-deep: ${theme.colors.brandDeep};
  --sidebar-particle-soft: ${theme.colors.brandSoft};
  --sidebar-particle-highlight: ${theme.colors.highlight};

  position: relative;
  width: 100%;
  min-width: 0;
  isolation: isolate;
`;

const HoverLayer = styled.div`
  position: relative;
  width: calc(100% - ${theme.sidebarEffects.motionGutter});
  margin-right: ${theme.sidebarEffects.motionGutter};
  border-radius: 2px;
  transform: translate3d(0, 0, 0);
  transition: transform ${theme.motion.spring};
  will-change: transform;

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] & {
    transform: translate3d(${theme.sidebarEffects.hoverOffset}, 0, 0);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;

    [data-hover-phase="entering"] &,
    [data-hover-phase="active"] & {
      transform: none;
    }
  }
`;

const ParticleCanvas = styled.canvas`
  position: absolute;
  z-index: 3;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] &,
  [data-hover-phase="exiting"] & {
    opacity: 0.92;
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Content = styled.div`
  --sidebar-icon-shift: 0px;
  --sidebar-copy-shift: 0px;

  position: relative;
  z-index: 1;
  width: 100%;

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] & {
    --sidebar-icon-shift: ${theme.sidebarEffects.iconHoverOffset};
    --sidebar-copy-shift: ${theme.sidebarEffects.textHoverOffset};
  }
`;

function sidebarHoverReducer(
  state: SidebarHoverMachine,
  event: SidebarHoverEvent,
): SidebarHoverMachine {
  switch (event.type) {
    case "ENTER":
      if (state.phase === "idle" || state.phase === "exiting") {
        return { phase: "entering", session: state.session + 1 };
      }
      return state;
    case "ENTERED":
      return state.phase === "entering"
        ? { ...state, phase: "active" }
        : state;
    case "LEAVE":
      return state.phase === "entering" || state.phase === "active"
        ? { ...state, phase: "exiting" }
        : state;
    case "EXITED":
      return state.phase === "exiting"
        ? { ...state, phase: "idle" }
        : state;
  }
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

/**
 * 侧边栏通用 Hover 视觉状态机：统一协调位移、底色滑动与粒子层。
 *
 * 状态机保证每次 ENTER 都会启动新会话；颜色层和位移根据同一 phase 切换。
 * LEAVE 后进入 exiting，底色向右退出，Canvas 在组件
 * 回位期间继续绘制旧粒子，每颗粒子按各自的随机时长独立淡出。新粒子只在出生
 * 瞬间采样鼠标位置，随后不再追踪，因此轨迹既有指向性又保持自然分散。
 */
export function ParticleGlowHover({ children }: ParticleGlowHoverProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<SidebarHoverPhase>("idle");
  const pointerRef = useRef<ParticlePointerSnapshot>({ x: 0, y: 0, active: false });
  const [machine, send] = useReducer(sidebarHoverReducer, {
    phase: "idle",
    session: 0,
  });
  const rendererRunning = machine.phase !== "idle";
  phaseRef.current = machine.phase;

  const samplePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = canvasRef.current ?? surfaceRef.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    pointerRef.current = {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
      active: true,
    };
  };

  const releasePointer = () => {
    pointerRef.current.active = false;
    send({ type: "LEAVE" });
  };

  useEffect(() => {
    if (machine.phase !== "entering") return;
    const frame = window.requestAnimationFrame(() => send({ type: "ENTERED" }));
    return () => window.cancelAnimationFrame(frame);
  }, [machine.phase, machine.session]);

  useEffect(() => {
    if (machine.phase !== "exiting") return;
    const timer = window.setTimeout(
      () => send({ type: "EXITED" }),
      theme.sidebarEffects.particleExitFadeMaxMs +
        theme.sidebarEffects.particleExitFadeSafetyBufferMs,
    );
    return () => window.clearTimeout(timer);
  }, [machine.phase, machine.session]);

  useEffect(() => {
    if (!rendererRunning) return;
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!surface || !canvas || !context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let disposed = false;
    let width = 1;
    let height = 1;
    let previousTime = performance.now();
    let particles: GlowParticle[] = [];
    let emissionElapsedMs = 0;
    let nextEmissionInMs = 0;

    const styles = getComputedStyle(surface);
    const palette = [
      styles.getPropertyValue("--sidebar-particle-blue").trim(),
      styles.getPropertyValue("--sidebar-particle-cyan").trim(),
      styles.getPropertyValue("--sidebar-particle-deep").trim(),
      styles.getPropertyValue("--sidebar-particle-soft").trim(),
      styles.getPropertyValue("--sidebar-particle-highlight").trim(),
    ].filter(Boolean);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
    };

    const createParticle = (delayMaximum = 0.05): GlowParticle => {
      const spawnX = width + randomBetween(2, 18);
      const spawnY = randomBetween(6, Math.max(7, height - 6));
      const pointer = pointerRef.current;
      const followsPointer =
        pointer.active &&
        Math.random() < theme.sidebarEffects.particlePointerTrackingProbability;
      let directionX: number;
      let directionY: number;

      if (followsPointer) {
        const jitter = theme.sidebarEffects.particlePointerTargetJitterPx;
        const targetX = Math.max(
          0,
          Math.min(width - 4, pointer.x + randomBetween(-jitter, jitter)),
        );
        const targetY = Math.max(
          2,
          Math.min(height - 2, pointer.y + randomBetween(-jitter, jitter)),
        );
        const deltaX = targetX - spawnX;
        const deltaY = targetY - spawnY;
        const pointerDistance = Math.max(0.001, Math.hypot(deltaX, deltaY));
        const pointerDirectionX = deltaX / pointerDistance;
        const pointerDirectionY = deltaY / pointerDistance;
        const influence = randomBetween(
          theme.sidebarEffects.particlePointerInfluenceMin,
          theme.sidebarEffects.particlePointerInfluenceMax,
        );

        directionX = -1 * (1 - influence) + pointerDirectionX * influence;
        directionY = pointerDirectionY * influence;
      } else {
        const angle = randomBetween(
          -theme.sidebarEffects.particleFreeDirectionSpreadRadians,
          theme.sidebarEffects.particleFreeDirectionSpreadRadians,
        );
        directionX = -Math.cos(angle);
        directionY = Math.sin(angle);
      }

      const directionLength = Math.max(0.001, Math.hypot(directionX, directionY));
      directionX /= directionLength;
      directionY /= directionLength;
      const speed = randomBetween(
        theme.sidebarEffects.particleSpeedMinPxPerSecond,
        theme.sidebarEffects.particleSpeedMaxPxPerSecond,
      );
      const velocityX = directionX * speed;
      const velocityY = directionY * speed;

      return {
        x: spawnX,
        y: spawnY,
        velocityX,
        velocityY,
        size: randomBetween(
          theme.sidebarEffects.particleCoreSizeMinPx,
          theme.sidebarEffects.particleCoreSizeMaxPx,
        ),
        haloRadius: randomBetween(
          theme.sidebarEffects.particleHaloRadiusMinPx,
          theme.sidebarEffects.particleHaloRadiusMaxPx,
        ),
        haloAlpha: randomBetween(
          theme.sidebarEffects.particleHaloOpacityMin,
          theme.sidebarEffects.particleHaloOpacityMax,
        ),
        exitFadeDurationMs: randomBetween(
          theme.sidebarEffects.particleExitFadeMinMs,
          theme.sidebarEffects.particleExitFadeMaxMs,
        ),
        exitFadeElapsedMs: 0,
        color:
          palette[Math.floor(Math.random() * palette.length)] ||
          lightTheme.colors.brand,
        alpha: randomBetween(0.5, 0.94),
        delay: randomBetween(0, delayMaximum),
        age: 0,
        maxAge: (width + 70) / Math.max(24, Math.abs(velocityX)) + 0.28,
        phase: randomBetween(0, Math.PI * 2),
        waveFrequency: randomBetween(2.4, 5.8),
        waveStrength: randomBetween(4, 15),
      };
    };

    /** 按剩余容量补充粒子，避免长时间 Hover 导致粒子数量无限增长。 */
    const emitParticles = (count: number, delayMaximum = 0.05) => {
      const available = Math.max(
        0,
        theme.sidebarEffects.particleMaxCount - particles.length,
      );
      const emissionCount = Math.min(count, available);
      for (let index = 0; index < emissionCount; index += 1) {
        particles.push(createParticle(delayMaximum));
      }
    };

    const createEmissionDelay = () =>
      randomBetween(
        theme.sidebarEffects.particleEmissionIntervalMs -
          theme.sidebarEffects.particleEmissionJitterMs,
        theme.sidebarEffects.particleEmissionIntervalMs +
          theme.sidebarEffects.particleEmissionJitterMs,
      );

    const updateParticle = (
      particle: GlowParticle,
      elapsedSeconds: number,
      elapsedMs: number,
      exiting: boolean,
    ) => {
      if (exiting) particle.exitFadeElapsedMs += elapsedMs;
      if (particle.delay > 0) {
        particle.delay -= elapsedSeconds;
        return;
      }
      particle.x += particle.velocityX * elapsedSeconds;
      particle.y +=
        (particle.velocityY +
          Math.sin(particle.age * particle.waveFrequency + particle.phase) *
            particle.waveStrength) *
        elapsedSeconds;
      particle.age += elapsedSeconds;
    };

    const drawParticle = (particle: GlowParticle, exiting: boolean) => {
      if (particle.delay > 0) return;
      const fadeIn = Math.min(1, particle.age / 0.1);
      const fadeOut = Math.min(1, (particle.maxAge - particle.age) / 0.3);
      const exitFade = exiting
        ? Math.max(
            0,
            1 - particle.exitFadeElapsedMs / particle.exitFadeDurationMs,
          )
        : 1;
      const lifeAlpha =
        particle.alpha * Math.max(0, fadeIn * fadeOut) * exitFade;
      if (lifeAlpha <= 0) return;

      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = particle.haloRadius;
      context.globalAlpha = lifeAlpha * particle.haloAlpha;
      context.beginPath();
      context.arc(
        particle.x,
        particle.y,
        particle.size * 1.35,
        0,
        Math.PI * 2,
      );
      context.fill();

      context.globalAlpha = lifeAlpha;
      context.shadowBlur = Math.max(1.5, particle.haloRadius * 0.35);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    };

    const render = (time: number) => {
      if (disposed) return;
      const elapsed = Math.min(32, Math.max(0, time - previousTime));
      const elapsedSeconds = elapsed / 1000;
      previousTime = time;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      const exiting = phaseRef.current === "exiting";
      const emitting =
        phaseRef.current === "entering" || phaseRef.current === "active";
      if (emitting) {
        emissionElapsedMs += elapsed;
        if (particles.length >= theme.sidebarEffects.particleMaxCount) {
          emissionElapsedMs = 0;
          nextEmissionInMs = createEmissionDelay();
        } else {
          while (
            emissionElapsedMs >= nextEmissionInMs &&
            particles.length < theme.sidebarEffects.particleMaxCount
          ) {
            emissionElapsedMs -= nextEmissionInMs;
            emitParticles(1);
            nextEmissionInMs = createEmissionDelay();
          }
        }
      }

      for (const particle of particles) {
        updateParticle(particle, elapsedSeconds, elapsed, exiting);
        drawParticle(particle, exiting);
      }

      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.globalCompositeOperation = "source-over";
      particles = particles.filter((particle) => {
        if (
          exiting &&
          particle.exitFadeElapsedMs >= particle.exitFadeDurationMs
        ) {
          return false;
        }
        return (
          particle.delay > 0 ||
          (particle.age < particle.maxAge &&
            particle.x > -36 &&
            particle.y > -30 &&
            particle.y < height + 30)
        );
      });

      if (exiting && particles.length === 0) {
        send({ type: "EXITED" });
        return;
      }
      if (emitting || particles.length > 0) {
        frame = window.requestAnimationFrame(render);
      }
    };

    resize();
    emitParticles(theme.sidebarEffects.particleBurstCount, 0.2);
    nextEmissionInMs = createEmissionDelay();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
  }, [rendererRunning, machine.session]);

  return (
    <Surface
      ref={surfaceRef}
      data-hover-phase={machine.phase}
      onPointerEnter={(event) => {
        samplePointer(event);
        send({ type: "ENTER" });
      }}
      onPointerMove={samplePointer}
      onPointerLeave={releasePointer}
      onPointerCancel={releasePointer}
    >
      <HoverLayer>
        <ParticleCanvas ref={canvasRef} aria-hidden="true" />
        <Content>{children}</Content>
      </HoverLayer>
    </Surface>
  );
}