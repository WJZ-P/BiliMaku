import { styled } from "@linaria/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Icon } from "../../components/Icon";
import { theme } from "../../styles/theme";
import {
  createFullscreenWebglRuntime,
  createVisibilityAwareFrameLoop,
  parseCssColor,
} from "./webglRuntime";

type FlowAlignment = "top" | "bottom";

type FlowChipStyle = CSSProperties & {
  "--flow-lane"?: string;
  "--flow-duration"?: string;
  "--flow-delay"?: string;
  "--flow-accent"?: string;
};

interface WebglDanmakuFlowProps {
  /** 当前输入框中的弹幕样本文案。 */
  message: string;
  /** 与调试页滑杆同步的粒子密度百分比。 */
  density: number;
  /** 当前选中的事件通道名称。 */
  channel: string;
  /** 将组件交互写入调试页顶部的最近操作。 */
  onAction?: (label: string) => void;
}

interface FlowMessage {
  name: string;
  content: string;
  lane: number;
  duration: number;
  delay: number;
  accent: string;
}

const Stage = styled.article`
  --flow-white: rgba(247, 252, 255, 0.96);
  --flow-muted: rgba(207, 227, 243, 0.68);
  --flow-line: rgba(151, 215, 255, 0.18);

  position: relative;
  min-height: 326px;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.cyan} 34%, ${theme.colors.borderStrong});
  border-radius: 10px;
  background: #071827;
  box-shadow:
    0 18px 46px color-mix(in srgb, ${theme.colors.textPrimary} 18%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: var(--flow-white);
`;

const FlowCanvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const StageChrome = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 326px;
  grid-template-rows: auto minmax(194px, 1fr) auto;
`;

const StageHeader = styled.header`
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--flow-line);
  background: linear-gradient(180deg, rgba(9, 31, 51, 0.72), rgba(8, 25, 42, 0.36));
  backdrop-filter: blur(18px) saturate(1.2);

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const StageIdentity = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
`;

const StageIcon = styled.span`
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border: 1px solid rgba(132, 222, 255, 0.32);
  border-radius: 7px;
  background: linear-gradient(145deg, rgba(65, 145, 255, 0.3), rgba(66, 224, 232, 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 0 18px rgba(77, 194, 255, 0.22);
  color: #9beaff;
`;

const StageTitle = styled.div`
  min-width: 0;

  strong {
    display: block;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    display: block;
    margin-top: 2px;
    color: var(--flow-muted);
    font-family: ${theme.typography.mono};
    font-size: 7px;
    letter-spacing: 0.08em;
  }
`;

const StageReadout = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--flow-muted);
  font-family: ${theme.typography.mono};
  font-size: 7px;

  strong {
    margin-left: 4px;
    color: var(--flow-white);
    font-size: 9px;
  }

  @media (max-width: 620px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const Viewport = styled.div`
  position: relative;
  min-height: 194px;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, black 5%, black 92%, transparent);

  &::before {
    position: absolute;
    z-index: 1;
    inset: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0 37px,
      rgba(146, 215, 255, 0.08) 37px 38px
    );
    content: "";
    pointer-events: none;
  }
`;

const AlignmentBeacon = styled.span`
  position: absolute;
  z-index: 1;
  right: 12px;
  width: 72px;
  height: 72px;
  border: 1px solid rgba(114, 218, 255, 0.18);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(67, 163, 255, 0.16), transparent 68%);
  box-shadow: 0 0 32px rgba(76, 188, 255, 0.12);
  pointer-events: none;
  transition: transform ${theme.motion.spring};

  &[data-alignment="top"] {
    top: -36px;
  }

  &[data-alignment="bottom"] {
    bottom: -36px;
    transform: rotate(180deg);
  }

  &::before,
  &::after {
    position: absolute;
    border-radius: 50%;
    content: "";
  }

  &::before {
    inset: 12px;
    border: 1px dashed rgba(135, 228, 255, 0.26);
    animation: flow-beacon-spin 7s linear infinite;
  }

  &::after {
    inset: 29px;
    background: #74e7ff;
    box-shadow: 0 0 13px rgba(116, 231, 255, 0.82);
  }

  @keyframes flow-beacon-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

const ChipLayer = styled.div`
  position: absolute;
  z-index: 2;
  inset: 0;
`;

const FlowChip = styled.div`
  position: absolute;
  top: var(--flow-lane);
  left: 0;
  display: inline-flex;
  max-width: min(360px, 58vw);
  align-items: center;
  gap: 7px;
  padding: 6px 10px 6px 7px;
  border: 1px solid color-mix(in srgb, var(--flow-accent) 56%, rgba(207, 236, 255, 0.2));
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(13, 37, 59, 0.78), rgba(9, 27, 46, 0.48));
  box-shadow:
    0 5px 18px rgba(0, 8, 18, 0.22),
    0 0 20px color-mix(in srgb, var(--flow-accent) 12%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  color: var(--flow-white);
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  backdrop-filter: blur(12px) saturate(1.22);
  animation: bilimaku-flow-chip var(--flow-duration) linear var(--flow-delay) infinite;
  will-change: transform;
  -webkit-font-smoothing: antialiased;

  &::before {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    border: 1px solid color-mix(in srgb, var(--flow-accent) 64%, white);
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.78), transparent 28%),
      var(--flow-accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--flow-accent) 36%, transparent);
    content: "";
  }

  strong {
    color: color-mix(in srgb, var(--flow-accent) 58%, white);
    font-size: 9px;
    font-weight: 820;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes bilimaku-flow-chip {
    from {
      transform: translate3d(calc(100vw + 260px), 0, 0);
    }
    to {
      transform: translate3d(-440px, 0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-play-state: paused;
    transform: translateX(22px);
  }
`;

const StageFooter = styled.footer`
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid var(--flow-line);
  background: rgba(7, 23, 38, 0.58);
  backdrop-filter: blur(18px) saturate(1.18);

  @media (max-width: 520px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const AlignmentGroup = styled.div`
  display: inline-flex;
  gap: 5px;
  padding: 3px;
  border: 1px solid rgba(142, 220, 255, 0.14);
  border-radius: 7px;
  background: rgba(3, 18, 31, 0.42);
`;

const AlignmentButton = styled.button`
  height: 28px;
  padding: 0 11px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(203, 228, 245, 0.58);
  font-size: 9px;
  font-weight: 740;
  transition:
    background ${theme.motion.normal},
    color ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &:focus-visible,
  &[data-active="true"] {
    background: linear-gradient(135deg, rgba(61, 137, 255, 0.42), rgba(72, 218, 231, 0.2));
    color: white;
    outline: 0;
  }

  &:active {
    transform: scale(0.94);
  }
`;

const EmitButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid rgba(125, 224, 255, 0.4);
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(54, 126, 255, 0.68), rgba(61, 209, 224, 0.5));
  box-shadow:
    0 8px 24px rgba(43, 145, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 9px;
  font-weight: 820;
  transition:
    filter ${theme.motion.fast},
    transform ${theme.motion.spring},
    box-shadow ${theme.motion.normal};

  &:hover,
  &:focus-visible {
    filter: brightness(1.14) saturate(1.12);
    outline: 0;
    transform: translateY(-1px) scale(1.035);
    box-shadow:
      0 11px 28px rgba(43, 176, 255, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.26);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_density;
  uniform float u_burst;
  uniform float u_alignment;
  uniform vec3 u_brand;
  uniform vec3 u_cyan;
  uniform vec3 u_danger;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    vec2 point = (v_uv - 0.5) * aspect;
    vec2 pointer = (u_pointer - 0.5) * aspect;
    float time = u_time;

    float laneIndex = floor(v_uv.y * 9.0);
    float laneLocal = abs(fract(v_uv.y * 9.0) - 0.5);
    float laneLine = smoothstep(0.485, 0.5, laneLocal);
    float laneSeed = hash21(vec2(laneIndex, 17.0));
    float laneWave = sin(v_uv.x * (8.0 + laneSeed * 7.0) - time * (1.2 + laneSeed)) * 0.5 + 0.5;
    laneLine *= 0.04 + laneWave * 0.055;

    vec2 streakGrid = vec2(82.0 + u_density * 54.0, 18.0);
    vec2 streakUv = v_uv * streakGrid;
    streakUv.x -= time * (3.8 + hash21(vec2(floor(streakUv.y), 3.0)) * 4.0);
    vec2 streakCell = floor(streakUv);
    vec2 streakLocal = fract(streakUv) - 0.5;
    float streakSeed = hash21(streakCell);
    float streak = (1.0 - smoothstep(0.0, 0.46, abs(streakLocal.x)))
      * (1.0 - smoothstep(0.0, 0.055, abs(streakLocal.y)))
      * step(0.965 - u_density * 0.045, streakSeed);

    float pointerGlow = exp(-length(point - pointer) * 5.4);
    float ringRadius = 0.08 + (1.0 - u_burst) * 0.34;
    float burstRing = exp(-abs(length(point - pointer) - ringRadius) * 34.0) * u_burst;
    float alignedY = mix(0.82, 0.18, u_alignment);
    float alignmentGlow = exp(-abs(v_uv.y - alignedY) * 5.0);

    vec3 deep = vec3(0.014, 0.055, 0.092);
    vec3 color = deep + mix(u_brand, u_cyan, v_uv.x) * laneLine;
    color += mix(u_cyan, vec3(0.82, 0.95, 1.0), streakSeed) * streak * (0.32 + u_density * 0.28);
    color += mix(u_brand, u_cyan, 0.62) * pointerGlow * 0.14;
    color += mix(u_cyan, u_danger, 0.18) * burstRing * 0.62;
    color += mix(u_brand, u_cyan, 0.5) * alignmentGlow * 0.045;
    color += (hash21(gl_FragCoord.xy + time) - 0.5) * 0.01;

    float vignette = 1.0 - smoothstep(0.35, 1.1, length(point * vec2(0.76, 1.0)));
    color *= 0.76 + vignette * 0.34;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const accentPalette = ["#66CCFF", "#7c8cff", "#61e2c1", "#ff7893", "#9b7cff"];

/** 使用 WebGL 流场与清晰 DOM 文本共同预演实际弹幕组件。 */
export function WebglDanmakuFlow({
  message,
  density,
  channel,
  onAction,
}: WebglDanmakuFlowProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.68, y: 0.48 });
  const densityRef = useRef(density / 100);
  const burstRef = useRef(0);
  const alignmentRef = useRef(0);
  const [alignment, setAlignment] = useState<FlowAlignment>("top");
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    densityRef.current = density / 100;
  }, [density]);

  useEffect(() => {
    alignmentRef.current = alignment === "top" ? 0 : 1;
  }, [alignment]);

  const messages = useMemo<FlowMessage[]>(() => {
    const sample = message.trim() || "今晚也要把弹幕播报做得更灵动";
    return [
      { name: "WJZ_P", content: sample, lane: 0, duration: 10.8, delay: -1.2, accent: accentPalette[0] },
      { name: "BiliMaku", content: `${channel} 已进入实时光轨`, lane: 1, duration: 13.4, delay: -7.1, accent: accentPalette[1] },
      { name: "22娘", content: "新的弹幕从第一条可用轨道进入", lane: 2, duration: 11.7, delay: -4.4, accent: accentPalette[2] },
      { name: "33娘", content: "WebGL 只负责光场，文字仍保持清晰", lane: 3, duration: 14.2, delay: -10.2, accent: accentPalette[3] },
      { name: "直播助手", content: `当前粒子密度 ${density}%`, lane: 4, duration: 12.5, delay: -8.3, accent: accentPalette[4] },
      { name: "系统", content: "点击发射按钮可以重新触发流场脉冲", lane: 0, duration: 15.2, delay: -12.7, accent: accentPalette[2] },
    ];
  }, [channel, density, message]);

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

    let runtime;
    try {
      runtime = createFullscreenWebglRuntime(gl, FRAGMENT_SHADER);
    } catch (error) {
      console.warn("bilimaku danmaku flow WebGL initialization failed", error);
      return;
    }
    const { program } = runtime;
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      time: gl.getUniformLocation(program, "u_time"),
      density: gl.getUniformLocation(program, "u_density"),
      burst: gl.getUniformLocation(program, "u_burst"),
      alignment: gl.getUniformLocation(program, "u_alignment"),
      brand: gl.getUniformLocation(program, "u_brand"),
      cyan: gl.getUniformLocation(program, "u_cyan"),
      danger: gl.getUniformLocation(program, "u_danger"),
    };
    const styles = getComputedStyle(host);
    gl.uniform3fv(
      uniforms.brand,
      parseCssColor(styles.getPropertyValue("--bc-color-brand"), [0.26, 0.56, 0.95]),
    );
    gl.uniform3fv(
      uniforms.cyan,
      parseCssColor(styles.getPropertyValue("--bc-color-cyan"), [0.36, 0.84, 0.91]),
    );
    gl.uniform3fv(
      uniforms.danger,
      parseCssColor(styles.getPropertyValue("--bc-color-danger"), [0.91, 0.38, 0.49]),
    );

    let width = 1;
    let height = 1;
    let pointerX = pointerRef.current.x;
    let pointerY = pointerRef.current.y;
    let currentAlignment = alignmentRef.current;
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
      pointerX += (pointerRef.current.x - pointerX) * 0.1;
      pointerY += (pointerRef.current.y - pointerY) * 0.1;
      currentAlignment += (alignmentRef.current - currentAlignment) * 0.075;
      burstRef.current *= 0.94;
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform2f(uniforms.pointer, pointerX, 1 - pointerY);
      gl.uniform1f(uniforms.time, (time - startedAt) / 1000);
      gl.uniform1f(uniforms.density, densityRef.current);
      gl.uniform1f(uniforms.burst, burstRef.current);
      gl.uniform1f(uniforms.alignment, currentAlignment);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const stopFrameLoop = createVisibilityAwareFrameLoop(host, render);

    return () => {
      stopFrameLoop();
      observer.disconnect();
      runtime.dispose();
    };
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const visibleCount = Math.max(3, Math.min(messages.length, Math.round(2.4 + density / 24)));
  const laneOffset = alignment === "top" ? 14 : 24;

  return (
    <Stage
      ref={hostRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerRef.current = { x: 0.68, y: alignment === "top" ? 0.28 : 0.72 };
      }}
      onPointerDown={() => {
        burstRef.current = 1;
      }}
    >
      <FlowCanvas ref={canvasRef} aria-hidden="true" />
      <StageChrome>
        <StageHeader>
          <StageIdentity>
            <StageIcon><Icon name="message" size={16} /></StageIcon>
            <StageTitle>
              <strong>弹幕流场预演</strong>
              <span>DOM TEXT / WEBGL LIGHT FIELD</span>
            </StageTitle>
          </StageIdentity>
          <StageReadout>
            <span>LANES<strong>05</strong></span>
            <span>ACTIVE<strong>{visibleCount}</strong></span>
            <span>CHANNEL<strong>{channel}</strong></span>
          </StageReadout>
        </StageHeader>

        <Viewport>
          <AlignmentBeacon data-alignment={alignment} aria-hidden="true" />
          <ChipLayer key={`${epoch}-${alignment}`}>
            {messages.slice(0, visibleCount).map((item, index) => {
              const visualLane = alignment === "top" ? item.lane : 4 - item.lane;
              const style: FlowChipStyle = {
                "--flow-lane": `${laneOffset + visualLane * 36}px`,
                "--flow-duration": `${item.duration}s`,
                "--flow-delay": `${epoch > 0 ? index * 0.34 : item.delay + index * 0.16}s`,
                "--flow-accent": item.accent,
              };
              return (
                <FlowChip key={`${epoch}-${item.name}-${index}`} style={style}>
                  <strong>{item.name}</strong>
                  <span>{item.content}</span>
                </FlowChip>
              );
            })}
          </ChipLayer>
        </Viewport>

        <StageFooter>
          <AlignmentGroup aria-label="弹幕停靠区域">
            <AlignmentButton
              type="button"
              data-active={alignment === "top"}
              aria-pressed={alignment === "top"}
              onClick={() => {
                setAlignment("top");
                onAction?.("弹幕流场：顶部轨道");
              }}
            >
              顶部轨道
            </AlignmentButton>
            <AlignmentButton
              type="button"
              data-active={alignment === "bottom"}
              aria-pressed={alignment === "bottom"}
              onClick={() => {
                setAlignment("bottom");
                onAction?.("弹幕流场：底部轨道");
              }}
            >
              底部轨道
            </AlignmentButton>
          </AlignmentGroup>
          <EmitButton
            type="button"
            onClick={() => {
              burstRef.current = 1;
              setEpoch((value) => value + 1);
              onAction?.("重新发射样本弹幕");
            }}
          >
            <Icon name="send" size={14} />
            重新发射
          </EmitButton>
        </StageFooter>
      </StageChrome>
    </Stage>
  );
}