import { styled } from "@linaria/react";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { theme } from "../styles/theme";
import {
  mixThemeRgb,
  resolveThemeColor,
  THEME_CHANGE_EVENT,
  themeTransitionProgress,
  type RgbColor,
  type ThemeChangeDetail,
} from "../services/theme";

interface LiquidGlassSurfaceProps {
  /** 玻璃表面是否处于展示周期。 */
  active: boolean;
  /** 每次切换承载内容时递增，用于重新触发液态弹簧。 */
  animationKey: number;
  /** 覆盖主题默认值的玻璃圆角，单位为 CSS 像素。 */
  radiusPx?: number;
  /** 覆盖主题默认值的玻璃强调色。 */
  accentColor?: string;
}

type LiquidGlassCssVariables = CSSProperties & {
  "--liquid-glass-radius"?: string;
  "--liquid-glass-accent"?: string;
};

interface LiquidThemePalette {
  brand: RgbColor;
  cyan: RgbColor;
  deep: RgbColor;
  surface: RgbColor;
}

interface LiquidGlassRenderer {
  /** 从当前尺寸开始一次液态弹簧渲染。 */
  start: () => void;
  /** 清空画布并停止动画。 */
  stop: () => void;
  /** 释放 WebGL 资源与观察器。 */
  dispose: () => void;
}

const Canvas = styled.canvas`
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  opacity: 1;
  pointer-events: none;
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
  uniform float u_radius;
  uniform float u_energy;
  uniform float u_time;
  uniform float u_refraction;
  uniform float u_dispersion;
  uniform vec3 u_brand;
  uniform vec3 u_cyan;
  uniform vec3 u_deep;
  uniform vec3 u_surface;

  float roundedBox(vec2 point, vec2 halfSize, float radius) {
    vec2 distance = abs(point) - halfSize + radius;
    return min(max(distance.x, distance.y), 0.0)
      + length(max(distance, 0.0)) - radius;
  }

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  void main() {
    vec2 pixel = (v_uv - 0.5) * u_resolution;
    vec2 liquidPoint = pixel;
    vec2 halfSize = u_resolution * 0.5 - vec2(1.35);
    float radius = min(u_radius, min(halfSize.x, halfSize.y));

    float wave = sin(v_uv.y * 16.0 + u_time * 0.018)
      * cos(v_uv.x * 12.0 - u_time * 0.014);
    float breathing = wave * u_energy * 1.35;
    float signedDistance = roundedBox(liquidPoint, halfSize, radius + breathing);
    float antialias = 1.25;
    float mask = 1.0 - smoothstep(-antialias, antialias, signedDistance);
    float innerEdge = 1.0 - smoothstep(0.0, 5.2, abs(signedDistance));
    float lensBand = 1.0 - smoothstep(0.0, 13.0, abs(signedDistance + 5.0));

    vec2 direction = normalize(vec2(-0.72, 0.7));
    float directionalLight = clamp(dot(normalize(pixel + vec2(0.001)), direction) * 0.5 + 0.5, 0.0, 1.0);
    float topLight = pow(clamp(1.0 - v_uv.y, 0.0, 1.0), 3.0);
    float cornerLight = exp(-length((v_uv - vec2(0.18, 0.82)) * vec2(2.4, 3.2)) * 3.1);
    float caustic = (sin(v_uv.x * 18.0 + v_uv.y * 9.0 + u_time * 0.008) * 0.5 + 0.5)
      * lensBand * (0.22 + u_energy * 0.34);
    float grain = hash21(floor(gl_FragCoord.xy * 0.55)) - 0.5;

    vec3 base = mix(u_surface, u_brand, 0.2 + v_uv.x * 0.1);
    base = mix(base, u_cyan, 0.08 + caustic * 0.2);
    base += vec3(cornerLight * 0.065 + topLight * 0.018);
    base += grain * 0.008;

    float redFringe = 1.0 - smoothstep(0.0, 2.4 + u_dispersion * 2.5, abs(signedDistance - 1.1));
    float blueFringe = 1.0 - smoothstep(0.0, 2.4 + u_dispersion * 2.5, abs(signedDistance + 1.3));
    vec3 dispersion = vec3(redFringe * 0.06, 0.0, blueFringe * 0.085) * u_dispersion;

    vec3 edgeColor = mix(u_cyan, u_surface, directionalLight);
    vec3 color = base;
    color += edgeColor * innerEdge * (0.1 + u_refraction * 0.1);
    color += u_deep * lensBand * 0.022;
    color += dispersion;

    float surfaceAlpha = 0.012 + u_refraction * 0.014;
    float edgeAlpha = innerEdge * (0.095 + u_refraction * 0.13);
    float lensAlpha = lensBand * (0.018 + caustic * 0.045);
    float alpha = mask * clamp(surfaceAlpha + edgeAlpha + lensAlpha, 0.0, 0.36);

    gl_FragColor = vec4(color, alpha);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("创建液态玻璃 WebGL Shader 失败");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "未知编译错误";
    gl.deleteShader(shader);
    throw new Error(`编译液态玻璃 WebGL Shader 失败：${message}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("创建液态玻璃 WebGL Program 失败");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "未知链接错误";
    gl.deleteProgram(program);
    throw new Error(`链接液态玻璃 WebGL Program 失败：${message}`);
  }
  return program;
}

function parseCssColor(value: string, fallback: readonly [number, number, number]) {
  const normalized = value.trim();
  const hex = normalized.match(/^#([\da-f]{6})$/i);
  if (hex) {
    return [
      Number.parseInt(hex[1].slice(0, 2), 16) / 255,
      Number.parseInt(hex[1].slice(2, 4), 16) / 255,
      Number.parseInt(hex[1].slice(4, 6), 16) / 255,
    ] as const;
  }
  const rgb = normalized.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (rgb) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255] as const;
  }
  return fallback;
}

function uniformLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
) {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`液态玻璃 WebGL 缺少 Uniform：${name}`);
  return location;
}

function createRenderer(canvas: HTMLCanvasElement): LiquidGlassRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    throw new Error("创建液态玻璃 WebGL 顶点缓冲失败");
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

  const locations = {
    resolution: uniformLocation(gl, program, "u_resolution"),
    radius: uniformLocation(gl, program, "u_radius"),
    energy: uniformLocation(gl, program, "u_energy"),
    time: uniformLocation(gl, program, "u_time"),
    refraction: uniformLocation(gl, program, "u_refraction"),
    dispersion: uniformLocation(gl, program, "u_dispersion"),
    brand: uniformLocation(gl, program, "u_brand"),
    cyan: uniformLocation(gl, program, "u_cyan"),
    deep: uniformLocation(gl, program, "u_deep"),
    surface: uniformLocation(gl, program, "u_surface"),
  };

  // 全屏三角形每像素只写入一次，关闭混合可保留准确的非预乘透明度。
  gl.disable(gl.BLEND);

  let animationFrame = 0;
  let animationStartedAt = 0;
  let disposed = false;
  let active = false;
  let pixelRatio = 1;
  let width = 1;
  let height = 1;
  let lastElapsed = 0;
  let lastProgress = 1;
  let configuredRadius = Number.parseFloat(theme.tooltip.radius);
  let themePalette: LiquidThemePalette = {
    brand: [0.263, 0.561, 0.945],
    cyan: [0.365, 0.843, 0.91],
    deep: [0.137, 0.412, 0.773],
    surface: [1, 1, 1],
  };
  let themePaletteTransition: {
    from: LiquidThemePalette;
    to: LiquidThemePalette;
    detail: ThemeChangeDetail;
  } | null = null;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(bounds.width * pixelRatio));
    height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const readThemePalette = (
    mode?: ThemeChangeDetail["mode"],
  ): LiquidThemePalette => {
    const styles = getComputedStyle(canvas);
    const accent = styles.getPropertyValue("--liquid-glass-accent").trim()
      || styles.getPropertyValue("--message-bubble-color").trim();
    const read = (token: string, fallback: string) => mode
      ? resolveThemeColor(mode, token, fallback)
      : styles.getPropertyValue(token).trim() || fallback;
    const radius = Number.parseFloat(styles.getPropertyValue("--liquid-glass-radius"));
    configuredRadius = Number.isFinite(radius) ? Math.max(0, radius) : Number.parseFloat(theme.tooltip.radius);
    return {
      brand: parseCssColor(accent || read("--bc-color-brand", "#438ff1"), [0.263, 0.561, 0.945]),
      cyan: parseCssColor(read("--bc-color-cyan", "#5dd7e8"), [0.365, 0.843, 0.91]),
      deep: parseCssColor(read("--bc-color-brand-deep", "#2369c5"), [0.137, 0.412, 0.773]),
      surface: parseCssColor(read("--bc-color-surface", "#ffffff"), [1, 1, 1]),
    };
  };

  const applyThemePalette = (palette: LiquidThemePalette) => {
    gl.uniform3fv(locations.brand, palette.brand);
    gl.uniform3fv(locations.cyan, palette.cyan);
    gl.uniform3fv(locations.deep, palette.deep);
    gl.uniform3fv(locations.surface, palette.surface);
  };

  const sampleThemePalette = (timestamp: number) => {
    if (themePaletteTransition) {
      const progress = themeTransitionProgress(themePaletteTransition.detail, timestamp);
      themePalette = {
        brand: mixThemeRgb(themePaletteTransition.from.brand, themePaletteTransition.to.brand, progress),
        cyan: mixThemeRgb(themePaletteTransition.from.cyan, themePaletteTransition.to.cyan, progress),
        deep: mixThemeRgb(themePaletteTransition.from.deep, themePaletteTransition.to.deep, progress),
        surface: mixThemeRgb(themePaletteTransition.from.surface, themePaletteTransition.to.surface, progress),
      };
      if (progress >= 1) themePaletteTransition = null;
    }
    applyThemePalette(themePalette);
  };

  const draw = (time: number, progress: number, timestamp = performance.now()) => {
    lastElapsed = time;
    lastProgress = progress;
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    sampleThemePalette(timestamp);
    gl.uniform2f(locations.resolution, width, height);
    gl.uniform1f(locations.radius, configuredRadius * pixelRatio);
    gl.uniform1f(locations.energy, Math.exp(-4.2 * progress) * (1 - progress));
    gl.uniform1f(locations.time, time);
    gl.uniform1f(locations.refraction, theme.tooltip.liquidRefraction);
    gl.uniform1f(locations.dispersion, theme.tooltip.liquidDispersion);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const render = (time: number) => {
    animationFrame = 0;
    if (!active || disposed) return;
    const elapsed = time - animationStartedAt;
    const progress = Math.min(1, Math.max(0, elapsed / theme.tooltip.entranceDurationMs));
    draw(elapsed, progress, time);
    if (progress < 1 || themePaletteTransition) {
      animationFrame = window.requestAnimationFrame(render);
    }
  };

  const requestRender = () => {
    if (active && !disposed && animationFrame === 0) {
      animationFrame = window.requestAnimationFrame(render);
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    if (!active || disposed) return;
    // 文案宽度变化时延续当前弹簧帧，避免首帧被最终态覆盖而闪动。
    draw(lastElapsed, lastProgress, performance.now());
  });
  const handleThemeChange = (event: Event) => {
    const detail = (event as CustomEvent<ThemeChangeDetail>).detail;
    const target = readThemePalette(detail.mode);
    if (detail.durationMs <= 0) {
      themePalette = target;
      themePaletteTransition = null;
    } else {
      themePaletteTransition = {
        from: { ...themePalette },
        to: target,
        detail,
      };
    }
    if (active) {
      draw(lastElapsed, lastProgress, performance.now());
      requestRender();
    }
  };

  resizeObserver.observe(canvas);
  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  themePalette = readThemePalette();
  applyThemePalette(themePalette);

  return {
    start() {
      active = true;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      themePalette = readThemePalette();
      themePaletteTransition = null;
      applyThemePalette(themePalette);
      resize();
      animationStartedAt = performance.now();
      draw(0, 0, animationStartedAt);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        draw(theme.tooltip.entranceDurationMs, 1, performance.now());
        return;
      }
      requestRender();
    },
    stop() {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    dispose() {
      disposed = true;
      active = false;
      resizeObserver.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.cancelAnimationFrame(animationFrame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/**
 * 可复用于 Tooltip、悬浮消息气泡等容器的单 Canvas 液态玻璃光学层。
 *
 * CSS `backdrop-filter` 继续负责可采样背景的模糊；这个 WebGL 层只绘制
 * 玻璃边缘、色散、透镜带与弹簧期间的能量变化，因此无需捕获页面像素。
 */
export function LiquidGlassSurface({
  active,
  animationKey,
  radiusPx,
  accentColor,
}: LiquidGlassSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LiquidGlassRenderer | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = createRenderer(canvas);
    } catch (error) {
      console.warn("bilimaku liquid glass WebGL initialization failed", error);
      rendererRef.current = null;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (active) rendererRef.current?.start();
    else rendererRef.current?.stop();
  }, [active, animationKey, radiusPx, accentColor]);

  const style: LiquidGlassCssVariables = {
    "--liquid-glass-radius": radiusPx === undefined ? undefined : `${radiusPx}px`,
    "--liquid-glass-accent": accentColor,
  };

  return <Canvas ref={canvasRef} style={style} aria-hidden="true" />;
}
