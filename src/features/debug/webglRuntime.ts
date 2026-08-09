/** WebGL 全屏片元实验共用的顶点 Shader。 */
export const FULLSCREEN_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export interface FullscreenWebglRuntime {
  /** 已链接并处于可用状态的 Program。 */
  program: WebGLProgram;
  /** 覆盖整个裁剪空间的顶点缓冲。 */
  buffer: WebGLBuffer;
  /** 释放 Program、Buffer 等 GPU 资源。 */
  dispose: () => void;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
  label: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`创建 ${label} Shader 失败`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || `未知 ${label} Shader 错误`;
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

/**
 * 创建全屏三角形 WebGL Runtime。
 *
 * Debug 页的光场实验只需要编写片元 Shader，顶点布局和资源回收统一由这里处理。
 */
export function createFullscreenWebglRuntime(
  gl: WebGLRenderingContext,
  fragmentSource: string,
): FullscreenWebglRuntime {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER, "顶点");
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, "片元");
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error("创建全屏 WebGL Program 失败");
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "未知 WebGL Program 错误";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    throw new Error("创建全屏 WebGL 顶点缓冲失败");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "a_position");
  if (position < 0) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    throw new Error("全屏 WebGL Program 缺少 a_position 属性");
  }
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return {
    program,
    buffer,
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/** 将主题中的六位十六进制颜色转换为 Shader 可用的 RGB。 */
export function parseCssColor(
  value: string,
  fallback: readonly [number, number, number],
) {
  const hex = value.trim().match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ] as const;
}
interface VisibilityAwareFrameLoopOptions {
  /** 在系统启用“减少动态”时使用的最高帧率。 */
  reducedMotionFps?: number;
}

/**
 * 只在组件可见且文档位于前台时驱动 requestAnimationFrame。
 *
 * Debug 页会同时挂载多个 Shader 实验；统一调度可避免离屏 Canvas 持续占用 GPU。
 */
export function createVisibilityAwareFrameLoop(
  target: Element,
  renderFrame: (time: number) => void,
  options: VisibilityAwareFrameLoopOptions = {},
) {
  let disposed = false;
  let frame = 0;
  let lastRenderedAt = 0;
  let intersecting = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotionInterval = 1000 / Math.max(1, options.reducedMotionFps ?? 8);

  const isDocumentVisible = () => document.visibilityState !== "hidden";
  const isActive = () => intersecting && isDocumentVisible() && !disposed;

  const stopFrame = () => {
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
  };

  const tick = (time: number) => {
    frame = 0;
    if (!isActive()) return;
    if (!reducedMotion.matches || time - lastRenderedAt >= reducedMotionInterval) {
      lastRenderedAt = time;
      renderFrame(time);
    }
    frame = window.requestAnimationFrame(tick);
  };

  const sync = () => {
    if (isActive()) {
      if (frame === 0) frame = window.requestAnimationFrame(tick);
    } else {
      stopFrame();
    }
  };

  const bounds = target.getBoundingClientRect();
  intersecting = bounds.width > 0
    && bounds.height > 0
    && bounds.bottom > 0
    && bounds.right > 0
    && bounds.top < window.innerHeight
    && bounds.left < window.innerWidth;

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    intersecting = entry?.isIntersecting ?? false;
    sync();
  });
  intersectionObserver.observe(target);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  sync();

  return () => {
    disposed = true;
    stopFrame();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", sync);
    reducedMotion.removeEventListener("change", sync);
  };
}