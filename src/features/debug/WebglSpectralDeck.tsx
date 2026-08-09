import { styled } from "@linaria/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon } from "../../components/Icon";
import { theme } from "../../styles/theme";

type SpectralMode = "flow" | "pulse" | "warp";

interface WebglSpectralDeckProps {
  /** 与调试页粒子密度滑杆同步的百分比。 */
  density: number;
  /** 将光场控件的交互结果同步给调试页遥测区。 */
  onAction?: (label: string) => void;
}

interface PointerTarget {
  x: number;
  y: number;
}

const modeNames: Record<SpectralMode, string> = {
  flow: "流光",
  pulse: "脉冲",
  warp: "跃迁",
};

const Deck = styled.article`
  --spectral-white: rgba(245, 251, 255, 0.96);
  --spectral-muted: rgba(213, 230, 244, 0.68);
  --spectral-line: rgba(196, 232, 255, 0.18);

  position: relative;
  min-height: 310px;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 42%, ${theme.colors.borderStrong});
  border-radius: 12px;
  background:
    radial-gradient(circle at 16% 0%, rgba(56, 139, 255, 0.32), transparent 42%),
    linear-gradient(145deg, #071321, #0a1b2d 58%, #081522);
  box-shadow:
    0 22px 52px color-mix(in srgb, ${theme.colors.textPrimary} 20%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  color: var(--spectral-white);

  &::before {
    position: absolute;
    z-index: 1;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
    background-size: 20px 20px;
    content: "";
    opacity: 0.72;
    pointer-events: none;
    mask-image: linear-gradient(to bottom, black, transparent 92%);
  }

  &::after {
    position: absolute;
    z-index: 3;
    inset: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: inherit;
    content: "";
    pointer-events: none;
  }
`;

const Canvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const AuroraVeil = styled.span`
  position: absolute;
  z-index: 1;
  inset: 0;
  background:
    linear-gradient(112deg, rgba(255, 255, 255, 0.08), transparent 24%),
    radial-gradient(circle at 50% 118%, rgba(89, 211, 242, 0.2), transparent 48%);
  pointer-events: none;
  mix-blend-mode: screen;
`;

const DeckContent = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 310px;
  grid-template-rows: auto 1fr auto;
  gap: 18px;
  padding: 18px;
`;

const DeckHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const BrandLockup = styled.div`
  display: grid;
  gap: 4px;
`;

const Eyebrow = styled.span`
  color: rgba(151, 220, 255, 0.82);
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.18em;
`;

const DeckTitle = styled.strong`
  font-size: clamp(17px, 2.4vw, 23px);
  font-weight: 860;
  letter-spacing: -0.035em;
  text-shadow: 0 8px 26px rgba(56, 174, 255, 0.26);
`;

const LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid rgba(142, 229, 255, 0.24);
  border-radius: 999px;
  background: rgba(8, 25, 42, 0.42);
  color: rgba(220, 244, 255, 0.86);
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 750;
  backdrop-filter: blur(16px) saturate(1.25);

  &::before {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #64efc1;
    box-shadow: 0 0 11px rgba(100, 239, 193, 0.9);
    content: "";
    animation: spectral-live-pulse 1.8s ease-in-out infinite;
  }

  @keyframes spectral-live-pulse {
    50% {
      opacity: 0.42;
      transform: scale(0.72);
    }
  }
`;

const DeckBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px minmax(0, 0.86fr);
  align-items: center;
  gap: 22px;

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr) 106px;
  }

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
`;

const DeckCopy = styled.div`
  max-width: 340px;
  padding: 13px 14px;
  border: 1px solid var(--spectral-line);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(13, 39, 63, 0.58), rgba(9, 24, 40, 0.24));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(1.2);

  strong {
    display: block;
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  p {
    margin: 7px 0 0;
    color: var(--spectral-muted);
    font-size: 9px;
    line-height: 1.65;
  }
`;

const CoreButton = styled.button`
  position: relative;
  display: grid;
  width: 108px;
  height: 108px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(153, 231, 255, 0.4);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(177, 238, 255, 0.22), transparent 48%),
    conic-gradient(from 35deg, #3188ff, #62e5ee, #7c71ff, #3188ff);
  box-shadow:
    0 0 0 7px rgba(68, 160, 255, 0.08),
    0 0 46px rgba(65, 168, 255, 0.42),
    inset 0 0 28px rgba(255, 255, 255, 0.18);
  color: white;
  cursor: pointer;
  transition:
    filter ${theme.motion.normal},
    transform ${theme.motion.spring},
    box-shadow ${theme.motion.normal};

  &::before,
  &::after {
    position: absolute;
    border: 1px solid rgba(163, 231, 255, 0.34);
    border-radius: 50%;
    content: "";
    pointer-events: none;
  }

  &::before {
    inset: -9px;
    border-right-color: transparent;
    border-left-color: rgba(111, 123, 255, 0.62);
    animation: spectral-core-spin 4.8s linear infinite;
  }

  &::after {
    inset: 13px;
    border-top-color: transparent;
    border-bottom-color: rgba(255, 255, 255, 0.7);
    animation: spectral-core-spin 2.7s linear infinite reverse;
  }

  &:hover,
  &:focus-visible {
    filter: brightness(1.15) saturate(1.14);
    outline: 0;
    transform: scale(1.075);
    box-shadow:
      0 0 0 9px rgba(68, 160, 255, 0.1),
      0 0 62px rgba(73, 211, 255, 0.62),
      inset 0 0 32px rgba(255, 255, 255, 0.24);
  }

  &[data-active="false"] {
    filter: grayscale(0.62) brightness(0.72);
    box-shadow:
      0 0 0 7px rgba(68, 160, 255, 0.04),
      0 0 24px rgba(65, 168, 255, 0.18);
  }

  @keyframes spectral-core-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const CoreGlyph = styled.span`
  position: relative;
  z-index: 1;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: rgba(5, 20, 35, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 22px rgba(73, 211, 255, 0.36);
  backdrop-filter: blur(12px);
`;

const Telemetry = styled.div`
  display: grid;
  border: 1px solid var(--spectral-line);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(6, 22, 37, 0.44);
  backdrop-filter: blur(16px) saturate(1.2);

  @media (max-width: 760px) {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const TelemetryItem = styled.div`
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--spectral-line);

  &:last-child {
    border-bottom: 0;
  }

  span {
    color: var(--spectral-muted);
    font-family: ${theme.typography.mono};
    font-size: 7px;
    letter-spacing: 0.09em;
  }

  strong {
    color: var(--spectral-white);
    font-family: ${theme.typography.mono};
    font-size: 10px;
  }

  @media (max-width: 760px) {
    border-right: 1px solid var(--spectral-line);
    border-bottom: 0;

    &:last-child {
      border-right: 0;
    }
  }
`;

const ModeRail = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 13px;
  border-top: 1px solid var(--spectral-line);
`;

const ModeGroup = styled.div`
  display: inline-flex;
  gap: 6px;
`;

const ModeButton = styled.button`
  min-width: 64px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(153, 220, 255, 0.16);
  border-radius: 6px;
  background: rgba(8, 26, 43, 0.38);
  color: rgba(211, 233, 247, 0.66);
  font-size: 9px;
  font-weight: 760;
  backdrop-filter: blur(12px);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal},
    color ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &:focus-visible,
  &[data-active="true"] {
    border-color: rgba(127, 221, 255, 0.52);
    background: linear-gradient(135deg, rgba(53, 137, 255, 0.34), rgba(94, 225, 236, 0.16));
    color: white;
    outline: 0;
    transform: translateY(-1px);
  }
`;

const RenderStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--spectral-muted);
  font-family: ${theme.typography.mono};
  font-size: 7px;
  letter-spacing: 0.08em;

  &[data-ready="true"]::before {
    background: #64efc1;
    box-shadow: 0 0 8px rgba(100, 239, 193, 0.75);
  }

  &::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ff7893;
    content: "";
  }
`;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_density;
  uniform float u_energy;
  uniform float u_mode;
  uniform vec3 u_brand;
  uniform vec3 u_cyan;
  uniform vec3 u_danger;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float noise21(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += noise21(point) * amplitude;
      point = point * 2.03 + vec2(7.1, 3.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    vec2 point = (v_uv - 0.5) * aspect;
    vec2 pointer = (u_pointer - 0.5) * aspect;
    float time = u_time;

    float modePulse = 0.78 + 0.22 * sin(time * 3.0);
    float pulseMix = step(0.5, u_mode) * (1.0 - step(1.5, u_mode));
    float warpMix = step(1.5, u_mode);
    float animationScale = mix(1.0, modePulse, pulseMix);

    float turbulence = fbm(point * (2.35 + warpMix * 1.45) + vec2(time * 0.06, -time * 0.035));
    float curveA = sin(point.x * 3.4 + time * 0.86 + turbulence * 2.2) * 0.12;
    float curveB = cos(point.x * 2.15 - time * 0.58 + turbulence * 1.6) * 0.17 - 0.08;
    float ribbonA = exp(-abs(point.y - curveA) * (14.0 - warpMix * 3.0));
    float ribbonB = exp(-abs(point.y - curveB) * 10.5);
    float pointerGlow = exp(-length(point - pointer) * 5.2);

    vec2 starScale = vec2(72.0, 38.0) * (0.72 + u_density * 0.52);
    vec2 starUv = v_uv * starScale + vec2(time * 0.42, -time * 0.1);
    vec2 starCell = floor(starUv);
    vec2 starLocal = fract(starUv) - 0.5;
    float starSeed = hash21(starCell);
    float starShape = 1.0 - smoothstep(0.0, 0.075, length(starLocal));
    float stars = starShape * step(0.93 - u_density * 0.055, starSeed);

    vec2 gridUv = abs(fract(v_uv * vec2(30.0, 16.0)) - 0.5);
    float grid = max(
      smoothstep(0.485, 0.5, gridUv.x),
      smoothstep(0.485, 0.5, gridUv.y)
    );
    grid *= 0.045 + pointerGlow * 0.055;

    vec3 deep = vec3(0.018, 0.052, 0.09);
    vec3 color = deep * (0.82 + turbulence * 0.34);
    color += mix(u_brand, u_cyan, v_uv.x) * ribbonA * 0.34 * animationScale;
    color += mix(u_cyan, u_danger, 0.22 + v_uv.y * 0.3) * ribbonB * 0.2 * animationScale;
    color += mix(u_brand, u_cyan, 0.62) * pointerGlow * (0.16 + u_energy * 0.3);
    color += vec3(0.75, 0.92, 1.0) * stars * (0.34 + u_energy * 0.34);
    color += mix(u_brand, u_cyan, 0.5) * grid;

    float pulseRing = exp(-abs(length(point - pointer) - (0.12 + 0.04 * sin(time * 2.4))) * 30.0);
    color += mix(u_cyan, u_danger, warpMix * 0.36) * pulseRing * pointerGlow * 0.14 * u_energy;

    float vignette = 1.0 - smoothstep(0.22, 1.05, length(point * vec2(0.78, 1.0)));
    color *= 0.72 + vignette * 0.42;
    color += (hash21(gl_FragCoord.xy + time) - 0.5) * 0.012;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("创建光场 Shader 失败");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "未知 Shader 错误";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("创建光场 Program 失败");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "未知 Program 错误";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function parseCssColor(value: string, fallback: readonly [number, number, number]) {
  const hex = value.trim().match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ] as const;
}

const modeValues: Record<SpectralMode, number> = {
  flow: 0,
  pulse: 1,
  warp: 2,
};

/** WebGL 程序化光场与玻璃控件结合的独立 UI 实验组件。 */
export function WebglSpectralDeck({ density, onAction }: WebglSpectralDeckProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerTargetRef = useRef<PointerTarget>({ x: 0.5, y: 0.5 });
  const densityRef = useRef(density / 100);
  const energyRef = useRef(1);
  const modeRef = useRef(0);
  const [active, setActive] = useState(true);
  const [mode, setMode] = useState<SpectralMode>("flow");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    densityRef.current = density / 100;
  }, [density]);

  useEffect(() => {
    energyRef.current = active ? 1 : 0.16;
  }, [active]);

  useEffect(() => {
    modeRef.current = modeValues[mode];
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch (error) {
      console.warn("bilimaku spectral deck WebGL initialization failed", error);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      time: gl.getUniformLocation(program, "u_time"),
      density: gl.getUniformLocation(program, "u_density"),
      energy: gl.getUniformLocation(program, "u_energy"),
      mode: gl.getUniformLocation(program, "u_mode"),
      brand: gl.getUniformLocation(program, "u_brand"),
      cyan: gl.getUniformLocation(program, "u_cyan"),
      danger: gl.getUniformLocation(program, "u_danger"),
    };

    const styles = getComputedStyle(host);
    const brand = parseCssColor(styles.getPropertyValue("--bc-color-brand"), [0.26, 0.56, 0.95]);
    const cyan = parseCssColor(styles.getPropertyValue("--bc-color-cyan"), [0.36, 0.84, 0.91]);
    const danger = parseCssColor(styles.getPropertyValue("--bc-color-danger"), [0.91, 0.38, 0.49]);
    gl.uniform3fv(uniforms.brand, brand);
    gl.uniform3fv(uniforms.cyan, cyan);
    gl.uniform3fv(uniforms.danger, danger);

    let width = 1;
    let height = 1;
    let frame = 0;
    let disposed = false;
    let currentX = 0.5;
    let currentY = 0.5;
    let currentEnergy = energyRef.current;
    let currentMode = modeRef.current;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width * pixelRatio));
      height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (time: number) => {
      if (disposed) return;
      currentX += (pointerTargetRef.current.x - currentX) * 0.08;
      currentY += (pointerTargetRef.current.y - currentY) * 0.08;
      currentEnergy += (energyRef.current - currentEnergy) * 0.065;
      currentMode += (modeRef.current - currentMode) * 0.06;
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform2f(uniforms.pointer, currentX, 1 - currentY);
      gl.uniform1f(uniforms.time, (time - startedAt) / 1000);
      gl.uniform1f(uniforms.density, densityRef.current);
      gl.uniform1f(uniforms.energy, currentEnergy);
      gl.uniform1f(uniforms.mode, currentMode);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = window.requestAnimationFrame(render);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    setReady(true);
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      setReady(false);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerTargetRef.current = {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  return (
    <Deck
      ref={hostRef}
      data-active={active}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerTargetRef.current = { x: 0.5, y: 0.5 };
      }}
    >
      <Canvas ref={canvasRef} aria-hidden="true" />
      <AuroraVeil aria-hidden="true" />
      <DeckContent>
        <DeckHeader>
          <BrandLockup>
            <Eyebrow>BILIMAKU / SPECTRAL ENGINE 04</Eyebrow>
            <DeckTitle>弹幕光场指挥台</DeckTitle>
          </BrandLockup>
          <LiveBadge>REALTIME WEBGL</LiveBadge>
        </DeckHeader>

        <DeckBody>
          <DeckCopy>
            <strong>程序化极光 · 鼠标引力场</strong>
            <p>
              Shader 同时绘制极光丝带、星尘、动态网格与指针辉光。移动鼠标可以牵引光场，中心核心用于切换能量状态。
            </p>
          </DeckCopy>

          <CoreButton
            type="button"
            data-active={active}
            aria-label={active ? "关闭光场核心" : "启动光场核心"}
            aria-pressed={active}
            onClick={() => {
              setActive((value) => !value);
              onAction?.(active ? "关闭光场核心" : "启动光场核心");
            }}
          >
            <CoreGlyph>
              <Icon name={active ? "waveform" : "play"} size={24} />
            </CoreGlyph>
          </CoreButton>

          <Telemetry aria-label="WebGL 光场遥测">
            <TelemetryItem><span>DENSITY</span><strong>{density}%</strong></TelemetryItem>
            <TelemetryItem><span>FIELD</span><strong>{active ? "ONLINE" : "IDLE"}</strong></TelemetryItem>
            <TelemetryItem><span>MODE</span><strong>{modeNames[mode]}</strong></TelemetryItem>
          </Telemetry>
        </DeckBody>

        <ModeRail>
          <ModeGroup aria-label="光场模式">
            {(Object.keys(modeNames) as SpectralMode[]).map((item) => (
              <ModeButton
                key={item}
                type="button"
                data-active={mode === item}
                onClick={() => {
                  setMode(item);
                  onAction?.(`光场模式：${modeNames[item]}`);
                }}
              >
                {modeNames[item]}
              </ModeButton>
            ))}
          </ModeGroup>
          <RenderStatus data-ready={ready}>
            {ready ? "GPU PROGRAM READY" : "CSS FALLBACK"}
          </RenderStatus>
        </ModeRail>
      </DeckContent>
    </Deck>
  );
}