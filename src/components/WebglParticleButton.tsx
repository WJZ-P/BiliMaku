import { styled } from "@linaria/react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { theme } from "../styles/theme";

export type WebglParticleButtonKind = "primary" | "secondary" | "danger";

interface WebglParticleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 控制按钮的强调色与填充策略。 */
  kind?: WebglParticleButtonKind;
  /** 是否撑满所在网格列。 */
  block?: boolean;
}

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  alpha: number;
  age: number;
  lifetime: number;
  exitElapsedMs: number;
  exitDurationMs: number;
  color: readonly [number, number, number];
}

interface PointerSnapshot {
  x: number;
  y: number;
  active: boolean;
}

const Root = styled.button`
  --particle-button-accent: ${theme.colors.brand};
  --particle-button-fill: color-mix(in srgb, ${theme.colors.brand} 8%, transparent);

  position: relative;
  display: inline-grid;
  min-width: 0;
  min-height: 42px;
  grid-template-columns: 1fr;
  place-items: center;
  isolation: isolate;
  overflow: hidden;
  padding: 0 16px;
  border: 1px solid color-mix(
    in srgb,
    var(--particle-button-accent) 52%,
    ${theme.colors.borderStrong}
  );
  border-radius: 6px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, ${theme.colors.surface} 84%, transparent),
    color-mix(in srgb, var(--particle-button-accent) 5%, ${theme.colors.surface})
  );
  box-shadow:
    0 3px 9px color-mix(in srgb, ${theme.colors.shadowStrong} 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.family};
  font-size: 11px;
  font-weight: 780;
  letter-spacing: 0.015em;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal},
    color ${theme.motion.fast},
    transform 90ms ease;

  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background:
      linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--particle-button-accent) 14%, transparent),
        transparent
      ),
      var(--particle-button-fill);
    content: "";
    opacity: 0;
    pointer-events: none;
    transform: scaleX(0.36);
    transition:
      opacity ${theme.motion.normal},
      transform ${theme.motion.spring};
  }

  &::after {
    position: absolute;
    z-index: 4;
    right: 6px;
    bottom: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--particle-button-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--particle-button-accent) 52%, transparent);
    content: "";
    opacity: 0.46;
    pointer-events: none;
    transition:
      opacity ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  &[data-kind="primary"] {
    --particle-button-fill: color-mix(in srgb, ${theme.colors.brand} 76%, transparent);
    background: linear-gradient(
      135deg,
      ${theme.colors.brandDeep},
      color-mix(in srgb, ${theme.colors.brand} 84%, ${theme.colors.cyan})
    );
    color: ${theme.colors.textOnBrand};
  }

  &[data-kind="danger"] {
    --particle-button-accent: ${theme.colors.danger};
    --particle-button-fill: color-mix(in srgb, ${theme.colors.danger} 14%, transparent);
    color: ${theme.colors.danger};
  }

  &[data-block="true"] {
    width: 100%;
  }

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    border-color: var(--particle-button-accent);
    background: color-mix(
      in srgb,
      var(--particle-button-accent) 10%,
      ${theme.colors.surface}
    );
    box-shadow:
      0 8px 22px color-mix(in srgb, var(--particle-button-accent) 17%, transparent),
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 82%, transparent);
    outline: 0;
  }

  &[data-kind="primary"]:hover:not(:disabled),
  &[data-kind="primary"]:focus-visible:not(:disabled) {
    background: ${theme.colors.brand};
    color: ${theme.colors.textOnBrand};
  }

  &:hover:not(:disabled)::before,
  &:focus-visible:not(:disabled)::before {
    opacity: 1;
    transform: scaleX(1);
  }

  &:hover:not(:disabled)::after,
  &:focus-visible:not(:disabled)::after {
    opacity: 1;
    transform: translate(-1px, -1px) scale(1.18);
  }

  &:active:not(:disabled) {
    transform: translateY(1px) scale(0.975);
  }

  &:disabled {
    cursor: not-allowed;
    filter: grayscale(0.55);
    opacity: 0.42;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ParticleCanvas = styled.canvas`
  position: absolute;
  z-index: 2;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity ${theme.motion.fast};

  [data-rendering="true"] & {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Content = styled.span`
  position: relative;
  z-index: 3;
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  line-height: 1;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  pointer-events: none;
  transition:
    font-size ${theme.motion.normal},
    letter-spacing ${theme.motion.normal};

  & > svg {
    flex: 0 0 auto;
    transform-origin: center;
    shape-rendering: geometricPrecision;
    transition: transform ${theme.motion.normal};
  }

  [data-focused="true"] & {
    font-size: 12px;
    letter-spacing: 0.03em;
  }

  [data-focused="true"] & > svg {
    transform: scale(1.1);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    & > svg {
      transition: none;
    }
  }
`;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute float a_alpha;
  attribute vec3 a_color;
  uniform vec2 u_resolution;
  uniform float u_pixel_ratio;
  varying float v_alpha;
  varying vec3 v_color;

  void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    gl_PointSize = a_size * u_pixel_ratio;
    v_alpha = a_alpha;
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying float v_alpha;
  varying vec3 v_color;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    if (distanceToCenter > 0.5) discard;
    float halo = smoothstep(0.5, 0.04, distanceToCenter) * 0.44;
    float core = smoothstep(0.17, 0.0, distanceToCenter);
    float alpha = min(1.0, halo + core) * v_alpha;
    gl_FragColor = vec4(v_color * (0.82 + core * 0.38), alpha);
  }
`;

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseColor(
  value: string,
  fallback: readonly [number, number, number] = [0.26, 0.56, 0.95],
): readonly [number, number, number] {
  const normalized = value.trim();
  const hex = normalized.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const rgb = normalized.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }
  return fallback;
}

/** 以按钮语义强调色生成同色系亮暗粒子，避免危险按钮继续出现蓝色粒子。 */
function mixColor(
  source: readonly [number, number, number],
  target: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  return [
    source[0] + (target[0] - source[0]) * amount,
    source[1] + (target[1] - source[1]) * amount,
    source[2] + (target[2] - source[2]) * amount,
  ];
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("创建 WebGL shader 失败");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "未知 shader 编译错误";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("创建 WebGL program 失败");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "未知 program 链接错误";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

/**
 * 硬边按钮与 WebGL 汇聚粒子的公共实现。
 * 粒子从四条边随机出生，并在 Hover 生命周期内持续受当前鼠标位置吸引；
 * 离开后停止发射，每颗粒子按自己的随机时长淡出。
 */
export function WebglParticleButton({
  kind = "secondary",
  block = false,
  children,
  disabled,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  onPointerCancel,
  type = "button",
  ...props
}: WebglParticleButtonProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<PointerSnapshot>({ x: 0, y: 0, active: false });
  const [focused, setFocused] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [session, setSession] = useState(0);

  const samplePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerRef.current = {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
      active: true,
    };
  };

  useEffect(() => {
    if (!rendering) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRendering(false);
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setRendering(false);
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch (error) {
      console.warn("bilimaku particle button WebGL initialization failed", error);
      setRendering(false);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      setRendering(false);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const alphaLocation = gl.getAttribLocation(program, "a_alpha");
    const colorLocation = gl.getAttribLocation(program, "a_color");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const pixelRatioLocation = gl.getUniformLocation(program, "u_pixel_ratio");
    const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
    const documentStyle = getComputedStyle(document.documentElement);
    const fallbackAccent = parseColor(
      documentStyle.getPropertyValue(
        kind === "danger" ? "--bc-color-danger" : "--bc-color-brand",
      ),
    );
    const buttonStyle = getComputedStyle(root);
    const accent = parseColor(
      buttonStyle.getPropertyValue("--particle-button-accent"),
      fallbackAccent,
    );
    const palette = [
      accent,
      mixColor(accent, [1, 1, 1], 0.28),
      mixColor(accent, [1, 1, 1], 0.54),
      mixColor(accent, [0.08, 0.12, 0.18], 0.16),
    ];

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame = 0;
    let disposed = false;
    let previousTime = performance.now();
    let emissionElapsedMs = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!pointerRef.current.active) {
        pointerRef.current.x = width / 2;
        pointerRef.current.y = height / 2;
      }
    };

    const spawn = (forcedEdge?: number) => {
      const edge = forcedEdge ?? Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = randomBetween(0, width);
        y = randomBetween(-3, 1);
      } else if (edge === 1) {
        x = randomBetween(width - 1, width + 3);
        y = randomBetween(0, height);
      } else if (edge === 2) {
        x = randomBetween(0, width);
        y = randomBetween(height - 1, height + 3);
      } else {
        x = randomBetween(-3, 1);
        y = randomBetween(0, height);
      }
      const targetX = pointerRef.current.x + randomBetween(-7, 7);
      const targetY = pointerRef.current.y + randomBetween(-6, 6);
      const deltaX = targetX - x;
      const deltaY = targetY - y;
      const distance = Math.max(0.001, Math.hypot(deltaX, deltaY));
      const speed = randomBetween(24, 58);
      particles.push({
        x,
        y,
        velocityX: (deltaX / distance) * speed,
        velocityY: (deltaY / distance) * speed,
        size: randomBetween(5, 12),
        alpha: randomBetween(0.38, 0.9),
        age: 0,
        lifetime: randomBetween(0.72, 1.55),
        exitElapsedMs: 0,
        exitDurationMs: randomBetween(180, 620),
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    };

    const emitBurst = () => {
      for (let index = 0; index < 28; index += 1) spawn(index % 4);
    };

    const draw = () => {
      const vertices = new Float32Array(particles.length * 7);
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const fadeIn = Math.min(1, particle.age / 0.11);
        const fadeOut = Math.min(1, (particle.lifetime - particle.age) / 0.28);
        const exitFade = pointerRef.current.active
          ? 1
          : Math.max(0, 1 - particle.exitElapsedMs / particle.exitDurationMs);
        const distanceToPointer = Math.hypot(
          pointerRef.current.x - particle.x,
          pointerRef.current.y - particle.y,
        );
        const convergenceFade = clamp(distanceToPointer / 20, 0.08, 1);
        const alpha = particle.alpha
          * Math.max(0, fadeIn * fadeOut)
          * exitFade
          * convergenceFade;
        const offset = index * 7;
        vertices[offset] = particle.x;
        vertices[offset + 1] = particle.y;
        vertices[offset + 2] = particle.size;
        vertices[offset + 3] = alpha;
        vertices[offset + 4] = particle.color[0];
        vertices[offset + 5] = particle.color[1];
        vertices[offset + 6] = particle.color[2];
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(sizeLocation);
      gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, stride, 2 * 4);
      gl.enableVertexAttribArray(alphaLocation);
      gl.vertexAttribPointer(alphaLocation, 1, gl.FLOAT, false, stride, 3 * 4);
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, stride, 4 * 4);
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(pixelRatioLocation, pixelRatio);
      gl.drawArrays(gl.POINTS, 0, particles.length);
    };

    const render = (time: number) => {
      if (disposed) return;
      const elapsedMs = Math.min(34, Math.max(0, time - previousTime));
      const elapsedSeconds = elapsedMs / 1000;
      previousTime = time;

      if (pointerRef.current.active) {
        emissionElapsedMs += elapsedMs;
        while (emissionElapsedMs >= 34 && particles.length < 72) {
          emissionElapsedMs -= 34;
          spawn();
        }
      }

      for (const particle of particles) {
        const deltaX = pointerRef.current.x - particle.x;
        const deltaY = pointerRef.current.y - particle.y;
        const distance = Math.max(0.001, Math.hypot(deltaX, deltaY));
        const attraction = pointerRef.current.active ? 180 : 82;
        particle.velocityX += (deltaX / distance) * attraction * elapsedSeconds;
        particle.velocityY += (deltaY / distance) * attraction * elapsedSeconds;
        const speed = Math.hypot(particle.velocityX, particle.velocityY);
        const maxSpeed = 190;
        if (speed > maxSpeed) {
          particle.velocityX = (particle.velocityX / speed) * maxSpeed;
          particle.velocityY = (particle.velocityY / speed) * maxSpeed;
        }
        const damping = Math.pow(0.985, elapsedMs / 16.67);
        particle.velocityX *= damping;
        particle.velocityY *= damping;
        particle.x += particle.velocityX * elapsedSeconds;
        particle.y += particle.velocityY * elapsedSeconds;
        particle.age += elapsedSeconds;
        if (!pointerRef.current.active) particle.exitElapsedMs += elapsedMs;
        if (distance < 5 && particle.age > 0.16) {
          particle.lifetime = Math.min(particle.lifetime, particle.age + 0.1);
        }
      }

      particles = particles.filter((particle) => (
        particle.age < particle.lifetime
        && particle.exitElapsedMs < particle.exitDurationMs
        && particle.x > -22
        && particle.x < width + 22
        && particle.y > -22
        && particle.y < height + 22
      ));
      draw();

      if (!pointerRef.current.active && particles.length === 0) {
        setRendering(false);
        return;
      }
      frame = window.requestAnimationFrame(render);
    };

    resize();
    emitBurst();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [kind, rendering, session]);

  return (
    <Root
      {...props}
      ref={rootRef}
      type={type}
      disabled={disabled}
      data-kind={kind}
      data-block={block}
      data-focused={focused}
      data-rendering={rendering}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (disabled) return;
        samplePointer(event);
        setFocused(true);
        setSession((current) => current + 1);
        setRendering(true);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!disabled) samplePointer(event);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        pointerRef.current.active = false;
        setFocused(false);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        pointerRef.current.active = false;
        setFocused(false);
      }}
    >
      <ParticleCanvas ref={canvasRef} aria-hidden="true" />
      <Content>{children}</Content>
    </Root>
  );
}
