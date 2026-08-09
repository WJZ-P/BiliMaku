import { styled } from "@linaria/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon } from "../../components/Icon";
import { theme } from "../../styles/theme";
import {
  createFullscreenWebglRuntime,
  createVisibilityAwareFrameLoop,
  mountWebglWhenNearViewport,
  parseCssColor,
} from "./webglRuntime";

type PrismTone = "ice" | "pearl" | "neon";

interface WebglPrismWorkbenchProps {
  /** 与调试页粒子密度同步，用作光场细节密度。 */
  density: number;
  /** 将工作台中的交互同步到顶部遥测。 */
  onAction?: (label: string) => void;
}

const toneNames: Record<PrismTone, string> = {
  ice: "冰川蓝",
  pearl: "珍珠白",
  neon: "霓虹粉",
};

const toneValues: Record<PrismTone, number> = {
  ice: 0,
  pearl: 1,
  neon: 2,
};

const Workbench = styled.article`
  position: relative;
  min-height: 360px;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 22%, ${theme.colors.borderStrong});
  border-radius: 12px;
  background: #eaf1f7;
  box-shadow:
    0 20px 52px color-mix(in srgb, ${theme.colors.textPrimary} 12%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
`;

const PrismCanvas = styled.canvas`
  position: absolute;
  z-index: 0;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const Grain = styled.span`
  position: absolute;
  z-index: 1;
  inset: 0;
  background-image: url("/textures/frosted-noise.svg");
  background-size: 96px 96px;
  content: "";
  mix-blend-mode: soft-light;
  opacity: 0.045;
  pointer-events: none;
`;

const WorkbenchContent = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 360px;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  padding: 17px;
`;

const WorkbenchHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const WorkbenchTitle = styled.div`
  min-width: 0;

  span {
    display: block;
    color: color-mix(in srgb, ${theme.colors.brandDeep} 78%, ${theme.colors.textMuted});
    font-family: ${theme.typography.mono};
    font-size: 8px;
    font-weight: 820;
    letter-spacing: 0.16em;
  }

  strong {
    display: block;
    margin-top: 4px;
    color: ${theme.colors.textPrimary};
    font-size: 19px;
    font-weight: 880;
    letter-spacing: -0.035em;
  }
`;

const ToneTabs = styled.div`
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 8px;
  background: rgba(238, 244, 249, 0.42);
  box-shadow:
    0 8px 24px rgba(42, 75, 108, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  max-width: 100%;
  overflow-x: auto;
  backdrop-filter: blur(22px) saturate(1.18);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const ToneButton = styled.button`
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 760;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal},
    color ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &:focus-visible,
  &[data-active="true"] {
    border-color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.48);
    box-shadow:
      0 5px 16px rgba(42, 75, 108, 0.08),
      inset 0 1px 0 white;
    color: ${theme.colors.textPrimary};
    outline: 0;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const WorkbenchBody = styled.div`
  display: grid;
  grid-template-columns: minmax(190px, 0.82fr) minmax(260px, 1.18fr);
  align-items: stretch;
  gap: 14px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const ModuleList = styled.div`
  display: grid;
  align-content: center;
  gap: 7px;
`;

const ModuleCard = styled.button`
  --module-accent: ${theme.colors.brand};

  display: grid;
  min-height: 58px;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: 8px;
  background: rgba(240, 246, 251, 0.43);
  box-shadow:
    0 7px 22px rgba(38, 73, 108, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: ${theme.colors.textSecondary};
  text-align: left;
  backdrop-filter: blur(22px) saturate(1.2);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.normal},
    box-shadow ${theme.motion.normal},
    transform ${theme.motion.spring};

  &[data-kind="voice"] {
    --module-accent: ${theme.colors.gift};
  }

  &[data-kind="overlay"] {
    --module-accent: ${theme.colors.cyan};
  }

  &:hover,
  &:focus-visible,
  &[data-active="true"] {
    border-color: color-mix(in srgb, var(--module-accent) 42%, white);
    background: rgba(255, 255, 255, 0.56);
    box-shadow:
      0 10px 28px color-mix(in srgb, var(--module-accent) 13%, transparent),
      inset 0 1px 0 white;
    outline: 0;
    transform: translateX(3px);
  }
`;

const ModuleIcon = styled.span`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  background: color-mix(in srgb, var(--module-accent) 12%, rgba(255, 255, 255, 0.58));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  color: color-mix(in srgb, var(--module-accent) 82%, ${theme.colors.textPrimary});
`;

const ModuleCopy = styled.span`
  min-width: 0;

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: ${theme.colors.textPrimary};
    font-size: 10px;
  }

  small {
    margin-top: 3px;
    color: ${theme.colors.textMuted};
    font-size: 8px;
  }
`;

const ModuleState = styled.span`
  width: 8px;
  height: 8px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  background: ${theme.colors.textMuted};
  box-shadow: 0 0 0 1px rgba(75, 100, 124, 0.12);

  [data-active="true"] & {
    background: var(--module-accent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--module-accent) 20%, transparent),
      0 0 10px color-mix(in srgb, var(--module-accent) 44%, transparent);
  }
`;

const GlassConsole = styled.div`
  position: relative;
  display: grid;
  min-height: 210px;
  align-content: space-between;
  gap: 14px;
  overflow: hidden;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.64);
  border-radius: 10px;
  background:
    linear-gradient(138deg, rgba(255, 255, 255, 0.52), rgba(229, 238, 246, 0.3)),
    rgba(236, 243, 248, 0.28);
  box-shadow:
    0 16px 42px rgba(44, 77, 108, 0.11),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    inset 0 -1px 0 rgba(80, 112, 143, 0.08);
  backdrop-filter: blur(30px) saturate(1.26) brightness(1.04);

  &::before {
    position: absolute;
    top: 0;
    right: 14px;
    left: 14px;
    height: 1px;
    background: linear-gradient(90deg, transparent, white, transparent);
    content: "";
    opacity: 0.9;
  }
`;

const ConsoleHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const ConsoleTitle = styled.div`
  strong {
    display: block;
    color: ${theme.colors.textPrimary};
    font-size: 13px;
    font-weight: 860;
  }

  span {
    display: block;
    margin-top: 3px;
    color: ${theme.colors.textMuted};
    font-size: 8px;
  }
`;

const ConsoleBadge = styled.span`
  padding: 5px 7px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.42);
  color: ${theme.colors.brandDeep};
  font-family: ${theme.typography.mono};
  font-size: 7px;
  font-weight: 820;
  box-shadow: inset 0 1px 0 white;
`;

const PreviewMessage = styled.div`
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.32);
  box-shadow:
    0 7px 20px rgba(43, 76, 108, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
`;

const PreviewAvatar = styled.span`
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, ${theme.colors.brand}, ${theme.colors.cyan});
  box-shadow: 0 5px 14px color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
  color: white;
  font-size: 9px;
  font-weight: 880;
`;

const PreviewCopy = styled.div`
  min-width: 0;

  strong {
    display: block;
    color: ${theme.colors.textPrimary};
    font-size: 10px;
  }

  p {
    overflow: hidden;
    margin: 3px 0 0;
    color: ${theme.colors.textSecondary};
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const IntensityRow = styled.label`
  display: grid;
  grid-template-columns: auto minmax(90px, 1fr) auto;
  align-items: center;
  gap: 9px;
  color: ${theme.colors.textMuted};
  font-size: 8px;

  strong {
    color: ${theme.colors.textPrimary};
    font-family: ${theme.typography.mono};
    font-size: 9px;
  }
`;

const IntensityRange = styled.input`
  width: 100%;
  height: 18px;
  margin: 0;
  appearance: none;
  background: transparent;

  &::-webkit-slider-runnable-track {
    height: 5px;
    border-radius: 999px;
    background: linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan}, ${theme.colors.danger});
    box-shadow: inset 0 1px 2px rgba(42, 75, 108, 0.12);
  }

  &::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -4.5px;
    appearance: none;
    border: 2px solid white;
    border-radius: 50%;
    background: ${theme.colors.brand};
    box-shadow: 0 3px 10px color-mix(in srgb, ${theme.colors.brand} 30%, transparent);
  }
`;

const WorkbenchFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.52);

  @media (max-width: 480px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const FooterMetric = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;

  strong {
    margin-left: 5px;
    color: ${theme.colors.textPrimary};
  }
`;

const ApplyButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 36%, white);
  border-radius: 7px;
  background: linear-gradient(135deg, ${theme.colors.brandDeep}, ${theme.colors.brand});
  box-shadow:
    0 8px 20px color-mix(in srgb, ${theme.colors.brand} 24%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  color: white;
  font-size: 9px;
  font-weight: 820;
  transition:
    filter ${theme.motion.fast},
    transform ${theme.motion.spring},
    box-shadow ${theme.motion.normal};

  &:hover,
  &:focus-visible {
    filter: brightness(1.12) saturate(1.1);
    outline: 0;
    transform: translateY(-1px) scale(1.03);
    box-shadow:
      0 11px 26px color-mix(in srgb, ${theme.colors.brand} 32%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.34);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_density;
  uniform float u_intensity;
  uniform float u_tone;
  uniform vec3 u_brand;
  uniform vec3 u_cyan;
  uniform vec3 u_danger;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float softBlob(vec2 point, vec2 center, float radius) {
    float distanceToCenter = length(point - center);
    return exp(-distanceToCenter * distanceToCenter / max(radius * radius, 0.001));
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    vec2 point = (v_uv - 0.5) * aspect;
    vec2 pointer = (u_pointer - 0.5) * aspect;
    float time = u_time;

    vec2 centerA = vec2(sin(time * 0.31) * 0.34, cos(time * 0.27) * 0.25);
    vec2 centerB = vec2(cos(time * 0.23 + 1.4) * 0.46, sin(time * 0.38) * 0.29);
    vec2 centerC = vec2(sin(time * 0.19 - 0.8) * 0.52, cos(time * 0.33 + 0.6) * 0.2);
    float blobA = softBlob(point, centerA, 0.34);
    float blobB = softBlob(point, centerB, 0.38);
    float blobC = softBlob(point, centerC, 0.29);
    float pointerBlob = softBlob(point, pointer, 0.24 + u_intensity * 0.08);

    float wave = sin((point.x + point.y * 0.42) * (9.0 + u_density * 6.0) + time * 0.72);
    float caustic = pow(max(0.0, wave * 0.5 + 0.5), 7.0) * (blobA + blobB + pointerBlob * 0.7);
    float lensRing = exp(-abs(length(point - pointer) - 0.16) * 26.0);

    vec3 baseIce = vec3(0.83, 0.9, 0.95);
    vec3 basePearl = vec3(0.92, 0.91, 0.9);
    vec3 baseNeon = vec3(0.88, 0.84, 0.93);
    vec3 base = mix(baseIce, basePearl, smoothstep(0.4, 1.0, u_tone));
    base = mix(base, baseNeon, smoothstep(1.35, 2.0, u_tone));

    vec3 color = base;
    color += u_brand * blobA * (0.1 + u_intensity * 0.13);
    color += u_cyan * blobB * (0.09 + u_intensity * 0.14);
    color += mix(u_danger, u_brand, 0.44) * blobC * (0.045 + u_tone * 0.045);
    color += mix(u_cyan, vec3(1.0), 0.62) * caustic * (0.08 + u_intensity * 0.1);
    color += mix(u_brand, u_danger, u_tone * 0.28) * lensRing * pointerBlob * 0.08;
    color += (hash21(gl_FragCoord.xy + time) - 0.5) * 0.012;

    float vignette = 1.0 - smoothstep(0.35, 1.16, length(point * vec2(0.72, 1.0)));
    color *= 0.96 + vignette * 0.08;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** 明亮主题下使用程序化折射背景和真实毛玻璃采样的 UI 实验。 */
export function WebglPrismWorkbench({ density, onAction }: WebglPrismWorkbenchProps) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.72, y: 0.42 });
  const densityRef = useRef(density / 100);
  const intensityRef = useRef(0.68);
  const toneRef = useRef(0);
  const [tone, setTone] = useState<PrismTone>("ice");
  const [intensity, setIntensity] = useState(68);
  const [activeModule, setActiveModule] = useState("danmaku");

  useEffect(() => {
    densityRef.current = density / 100;
  }, [density]);

  useEffect(() => {
    intensityRef.current = intensity / 100;
  }, [intensity]);

  useEffect(() => {
    toneRef.current = toneValues[tone];
  }, [tone]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    return mountWebglWhenNearViewport(host, () => {
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
        console.warn("bilimaku prism workbench WebGL initialization failed", error);
        return;
      }
      const { program } = runtime;
      const uniforms = {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        pointer: gl.getUniformLocation(program, "u_pointer"),
        time: gl.getUniformLocation(program, "u_time"),
        density: gl.getUniformLocation(program, "u_density"),
        intensity: gl.getUniformLocation(program, "u_intensity"),
        tone: gl.getUniformLocation(program, "u_tone"),
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
      let currentTone = toneRef.current;
      let currentIntensity = intensityRef.current;
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
        pointerX += (pointerRef.current.x - pointerX) * 0.075;
        pointerY += (pointerRef.current.y - pointerY) * 0.075;
        currentTone += (toneRef.current - currentTone) * 0.045;
        currentIntensity += (intensityRef.current - currentIntensity) * 0.06;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform2f(uniforms.pointer, pointerX, 1 - pointerY);
        gl.uniform1f(uniforms.time, (time - startedAt) / 1000);
        gl.uniform1f(uniforms.density, densityRef.current);
        gl.uniform1f(uniforms.intensity, currentIntensity);
        gl.uniform1f(uniforms.tone, currentTone);
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
    });
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  return (
    <Workbench
      ref={hostRef}
      data-tone={tone}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerRef.current = { x: 0.72, y: 0.42 };
      }}
    >
      <PrismCanvas ref={canvasRef} aria-hidden="true" />
      <Grain aria-hidden="true" />
      <WorkbenchContent>
        <WorkbenchHeader>
          <WorkbenchTitle>
            <span>PRISMATIC GLASS / LIGHT SURFACE</span>
            <strong>棱镜玻璃工作台</strong>
          </WorkbenchTitle>
          <ToneTabs aria-label="棱镜配色">
            {(Object.keys(toneNames) as PrismTone[]).map((item) => (
              <ToneButton
                key={item}
                type="button"
                data-active={tone === item}
                aria-pressed={tone === item}
                onClick={() => {
                  setTone(item);
                  onAction?.(`棱镜配色：${toneNames[item]}`);
                }}
              >
                {toneNames[item]}
              </ToneButton>
            ))}
          </ToneTabs>
        </WorkbenchHeader>

        <WorkbenchBody>
          <ModuleList aria-label="工作台模块">
            <ModuleCard
              type="button"
              data-active={activeModule === "danmaku"}
              aria-pressed={activeModule === "danmaku"}
              onClick={() => setActiveModule("danmaku")}
            >
              <ModuleIcon><Icon name="message" size={16} /></ModuleIcon>
              <ModuleCopy><strong>弹幕视觉</strong><small>轨道、字体与玻璃气泡</small></ModuleCopy>
              <ModuleState />
            </ModuleCard>
            <ModuleCard
              type="button"
              data-kind="voice"
              data-active={activeModule === "voice"}
              aria-pressed={activeModule === "voice"}
              onClick={() => setActiveModule("voice")}
            >
              <ModuleIcon><Icon name="volume" size={16} /></ModuleIcon>
              <ModuleCopy><strong>语音播报</strong><small>音色、队列与混音状态</small></ModuleCopy>
              <ModuleState />
            </ModuleCard>
            <ModuleCard
              type="button"
              data-kind="overlay"
              data-active={activeModule === "overlay"}
              aria-pressed={activeModule === "overlay"}
              onClick={() => setActiveModule("overlay")}
            >
              <ModuleIcon><Icon name="sparkles" size={16} /></ModuleIcon>
              <ModuleCopy><strong>悬浮组件</strong><small>定位、透明度与事件筛选</small></ModuleCopy>
              <ModuleState />
            </ModuleCard>
          </ModuleList>

          <GlassConsole>
            <ConsoleHeader>
              <ConsoleTitle>
                <strong>{activeModule === "danmaku" ? "弹幕玻璃预览" : activeModule === "voice" ? "语音核心预览" : "悬浮面板预览"}</strong>
                <span>真实背景采样 · 程序化折射底图</span>
              </ConsoleTitle>
              <ConsoleBadge>{toneNames[tone]}</ConsoleBadge>
            </ConsoleHeader>

            <PreviewMessage>
              <PreviewAvatar>22</PreviewAvatar>
              <PreviewCopy>
                <strong>BiliMaku 观测员</strong>
                <p>{activeModule === "danmaku" ? "这条消息保持清晰，只有外围玻璃采样底层光场。" : activeModule === "voice" ? "自定义音色已进入后台推理队列。" : "新的互动事件将显示在透明悬浮面板中。"}</p>
              </PreviewCopy>
            </PreviewMessage>

            <IntensityRow>
              <span>折射强度</span>
              <IntensityRange
                type="range"
                min="0"
                max="100"
                value={intensity}
                aria-label="????"
                onChange={(event) => setIntensity(Number(event.target.value))}
              />
              <strong>{intensity}%</strong>
            </IntensityRow>
          </GlassConsole>
        </WorkbenchBody>

        <WorkbenchFooter>
          <FooterMetric>DETAIL<strong>{density}%</strong></FooterMetric>
          <ApplyButton
            type="button"
            onClick={() => onAction?.(`应用棱镜实验：${toneNames[tone]} / ${intensity}%`)}
          >
            <Icon name="check" size={14} />
            记录当前方案
          </ApplyButton>
        </WorkbenchFooter>
      </WorkbenchContent>
    </Workbench>
  );
}