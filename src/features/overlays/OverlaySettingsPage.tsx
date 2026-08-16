import { styled } from "@linaria/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { PrismSelect } from "../../components/PrismSelect";
import { OverlayCardParticles } from "./OverlayCardParticles";
import { AnimatedSwitchTrack } from "../../components/ui";
import {
  closeOverlay,
  loadOverlaySettings,
  openOverlay,
  previewOverlayEvent,
  saveOverlaySettings,
} from "../../services/overlays";
import { theme } from "../../styles/theme";
import type { LiveEvent, LiveEventType } from "../../types/events";
import type {
  DanmakuOverlaySettings,
  EventColorMap,
  OverlaySettings,
  SidebarEntryDirection,
  SidebarOverlaySettings,
  SidebarVerticalAlignment,
} from "../../types/overlay";

const Page = styled.div`
  /* 悬浮组件页的字号与间距基线，与直播数据面板保持一致。 */
  --overlay-font-module: 20px;
  --overlay-font-section: 16px;
  --overlay-font-control: 14px;
  --overlay-font-body: 13px;
  --overlay-font-meta: 12px;

  display: grid;
  gap: 14px;
  padding: 14px 20px 28px;

  @media (max-width: 700px) {
    padding: 10px 12px 22px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 18px;
`;

const OverlayModule = styled.section`
  min-width: 0;
`;

const ModuleTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: var(--overlay-font-module);
  font-weight: 860;
  letter-spacing: -0.02em;
  line-height: 1.2;

  &::before {
    width: 3px;
    height: 21px;
    flex: 0 0 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, ${theme.colors.cyan}, ${theme.colors.brand});
    box-shadow: 0 0 10px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    content: "";
  }
`;

const ModuleHeader = styled.header`
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  background: linear-gradient(112deg, color-mix(in srgb, ${theme.colors.highlight} 34%, transparent), transparent 58%);

  @media (max-width: 700px) {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
    padding: 14px 13px;
  }
`;

const ModuleHeading = styled.div`
  display: grid;
  min-width: 0;
  gap: 5px;
`;

const ModuleDescription = styled.p`
  margin: 0 0 0 13px;
  color: ${theme.colors.textMuted};
  font-size: var(--overlay-font-body);
  line-height: 1.5;

  @media (max-width: 700px) {
    margin-left: 0;
  }
`;


const OverlayCard = styled.div`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: ${theme.prismGlass.panelRadius};
  background:
    linear-gradient(138deg, color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 74%, transparent), color-mix(in srgb, ${theme.colors.prismSurface} 84%, transparent));
  box-shadow:
    inset 0 1px 0 ${theme.colors.prismRim},
    0 8px 22px color-mix(in srgb, ${theme.colors.brandDeep} 7%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(${theme.prismGlass.saturation}) brightness(${theme.prismGlass.brightness});
  backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(${theme.prismGlass.saturation}) brightness(${theme.prismGlass.brightness});

  &::before {
    position: absolute;
    z-index: 1;
    inset: 0;
    background-image: url("/textures/frosted-noise.svg");
    background-size: 96px 96px;
    content: "";
    mix-blend-mode: soft-light;
    opacity: ${theme.prismGlass.noiseOpacity};
    pointer-events: none;
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background: color-mix(in srgb, ${theme.colors.surface} 88%, ${theme.colors.canvasAccent});
  }
`;

const Body = styled.div`
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 26px;
  padding: 0 20px 19px;

  @media (max-width: 920px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 700px) {
    padding: 0 13px 16px;
  }
`;

const Section = styled.section`
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 13px;
  padding: 18px 0 2px;
  border-top: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 48%, transparent);

  &[data-wide="true"] {
    grid-column: 1 / -1;
    padding-bottom: 16px;
  }
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: var(--overlay-font-section);
  font-weight: 830;
  letter-spacing: 0.005em;

  &::after {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, color-mix(in srgb, ${theme.colors.brandSoft} 54%, transparent), transparent);
    content: "";
  }
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px 14px;

  @media (max-width: 620px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Field = styled.label`
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
`;

const SelectFieldRoot = styled.div`
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
`;

const FieldTop = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-body);
  font-weight: 740;
  line-height: 1.4;
`;

const Value = styled.span`
  color: ${theme.colors.brandDeep};
  font-family: ${theme.typography.mono};
  font-size: var(--overlay-font-meta);
  font-weight: 760;
`;

const Range = styled.input`
  --overlay-range-height: 5px;
  --overlay-range-thumb: 16px;

  width: 100%;
  height: 28px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: grab;

  &::-webkit-slider-runnable-track {
    height: var(--overlay-range-height);
    border-radius: 3px;
    background: linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan});
    box-shadow: inset 0 0 0 1px color-mix(in srgb, ${theme.colors.borderStrong} 58%, transparent);
    transition: height 190ms cubic-bezier(0.18, 1.3, 0.34, 1);
  }

  &::-webkit-slider-thumb {
    width: var(--overlay-range-thumb);
    height: var(--overlay-range-thumb);
    margin-top: calc((var(--overlay-range-height) - var(--overlay-range-thumb)) / 2);
    appearance: none;
    border: 2px solid ${theme.colors.brandDeep};
    border-radius: 4px;
    background: linear-gradient(145deg, ${theme.colors.surface}, ${theme.colors.cyanSoft});
    box-shadow: 0 3px 9px color-mix(in srgb, ${theme.colors.brandDeep} 18%, transparent);
    transition: margin-top 190ms cubic-bezier(0.18, 1.3, 0.34, 1), transform ${theme.motion.spring};
  }

  &:hover { --overlay-range-height: 7px; }
  &:active {
    --overlay-range-height: 9px;
    cursor: grabbing;
  }
  &:active::-webkit-slider-thumb { transform: scale(1.12); }
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;

  @media (max-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ColorField = styled.label`
  display: flex;
  min-width: 0;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 56%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 58%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-body);
  font-weight: 700;
  cursor: pointer;
  -webkit-backdrop-filter: blur(10px) saturate(1.18);
  backdrop-filter: blur(10px) saturate(1.18);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    color ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &:focus-within {
    border-color: color-mix(in srgb, ${theme.colors.brand} 48%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 46%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 68%, transparent),
      0 6px 16px color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
    color: ${theme.colors.brandDeep};
    transform: translateY(-2px);
  }

  input {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: filter ${theme.motion.fast}, transform ${theme.motion.spring};
  }

  &:hover input,
  &:focus-within input {
    filter: saturate(1.14) brightness(1.04);
    transform: scale(1.08);
  }
`;

const ToggleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  & > :only-child {
    grid-column: 1 / -1;
  }

  @media (max-width: 620px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Toggle = styled.label`
  position: relative;
  display: grid;
  min-height: 48px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px 11px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: ${theme.prismGlass.controlRadius};
  background: color-mix(in srgb, ${theme.colors.prismSurface} 72%, transparent);
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-control);
  font-weight: 740;
  cursor: pointer;
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  transition: border-color ${theme.motion.fast}, background ${theme.motion.fast}, color ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 38%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 36%, transparent);
    color: ${theme.colors.textPrimary};
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  input:checked + span {
    border-color: color-mix(in srgb, ${theme.colors.brand} 58%, transparent);
  }

  input:checked + span::before { opacity: 1; }
  input:checked + span::after { transform: translateX(20px) rotate(90deg); }

  &:focus-within {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
    outline-offset: 1px;
  }
`;

const WindowSwitchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  & > :only-child {
    grid-column: 1 / -1;
  }

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const WindowSwitch = styled.label`
  position: relative;
  display: grid;
  min-height: 64px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: ${theme.prismGlass.controlRadius};
  background: color-mix(in srgb, ${theme.colors.prismSurface} 72%, transparent);
  box-shadow: inset 0 1px 0 ${theme.colors.prismRim};
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  cursor: pointer;
  transition: border-color ${theme.motion.fast}, background ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 38%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 32%, transparent);
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  input:checked + span {
    border-color: color-mix(in srgb, ${theme.colors.brand} 58%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
  }
  input:checked + span::before { opacity: 1; }
  input:checked + span::after { transform: translateX(18px) rotate(90deg); }

  &:focus-within {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
    outline-offset: 1px;
  }
`;

const WindowSwitchCopy = styled.span`
  display: grid;
  min-width: 0;
  gap: 4px;
`;

const WindowSwitchTitle = styled.strong`
  color: ${theme.colors.textPrimary};
  font-size: var(--overlay-font-control);
  font-weight: 800;
`;

const WindowSwitchHint = styled.span`
  color: ${theme.colors.textMuted};
  font-size: var(--overlay-font-meta);
  font-weight: 620;
  line-height: 1.5;
`;

const WindowSwitchTrack = styled(AnimatedSwitchTrack)`
  --switch-width: 40px;
  --switch-height: 22px;
  --switch-thumb-size: 16px;
  --switch-thumb-offset: 2px;
  --switch-thumb-radius: 3px;
  --switch-radius: 4px;
`;

const CompactSwitchTrack = styled(AnimatedSwitchTrack)`
  --switch-width: 38px;
  --switch-height: 20px;
  --switch-thumb-size: 14px;
  --switch-thumb-offset: 2px;
  --switch-thumb-radius: 3px;
  --switch-radius: 4px;
`;


const TypeGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;

const TypeToggle = styled.label`
  position: relative;
  display: inline-flex;
  min-width: 72px;
  height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 62%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 58%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-control);
  font-weight: 770;
  cursor: pointer;
  -webkit-backdrop-filter: blur(10px) saturate(1.18);
  backdrop-filter: blur(10px) saturate(1.18);
  transition: border-color ${theme.motion.fast}, background ${theme.motion.fast}, color ${theme.motion.fast}, box-shadow ${theme.motion.fast}, transform ${theme.motion.fast};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 42%, ${theme.colors.borderStrong});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 38%, transparent);
    color: ${theme.colors.brandDeep};
  }
  &:active { transform: scale(0.97); }
  &:focus-within {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    outline-offset: 1px;
  }
  &:has(input:checked) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 52%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 72%, transparent);
    color: ${theme.colors.brandDeep};
    box-shadow: inset 0 -2px 0 color-mix(in srgb, ${theme.colors.brand} 72%, transparent);
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
`;

const PanelActions = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;

  @media (max-width: 700px) {
    justify-content: flex-start;
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brandDeep} 32%, transparent);
  border-radius: 5px;
  background: linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandDeep});
  color: ${theme.colors.textOnBrand};
  font-size: var(--overlay-font-control);
  font-weight: 800;
  box-shadow: 0 6px 16px color-mix(in srgb, ${theme.colors.brand} 18%, transparent);
  transition: transform ${theme.motion.spring}, filter ${theme.motion.fast};

  &:hover {
    filter: saturate(1.1) brightness(1.04);
    transform: scale(1.015);
  }
  &:active { transform: scale(0.97); }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 68%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 58%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-control);
  font-weight: 720;
  -webkit-backdrop-filter: blur(12px) saturate(1.18);
  backdrop-filter: blur(12px) saturate(1.18);
  transition: border-color ${theme.motion.fast}, color ${theme.motion.fast}, background ${theme.motion.fast}, transform ${theme.motion.spring};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 42%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 34%, transparent);
    color: ${theme.colors.brandDeep};
  }
  &:active { transform: scale(0.97); }
`;

const Notice = styled.div`
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 18%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.brandSubtle} 44%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: var(--overlay-font-body);
  line-height: 1.55;
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);

  &[data-error="true"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 26%, transparent);
    background: color-mix(in srgb, ${theme.colors.dangerSoft} 58%, transparent);
    color: ${theme.colors.danger};
  }
`;

const eventTypes: Array<{ value: LiveEventType; label: string }> = [
  { value: "message", label: "弹幕" },
  { value: "interaction", label: "进场 / 点赞" },
  { value: "gift", label: "礼物" },
  { value: "superchat", label: "SC" },
  { value: "guard", label: "大航海" },
  { value: "system", label: "系统" },
];

const danmakuFontOptions = [
  { value: '\u0022Microsoft YaHei\u0022, \u0022PingFang SC\u0022, sans-serif', label: "微软雅黑 / 苹方" },
  { value: '\u0022SimHei\u0022, sans-serif', label: "黑体" },
  { value: '\u0022KaiTi\u0022, serif', label: "楷体" },
  { value: "Inter, sans-serif", label: "Inter" },
] as const;

const motionModeOptions = [
  { value: "speed", label: "按像素速度" },
  { value: "duration", label: "按总时长" },
] as const;

const sidebarFontOptions = [
  { value: '\u0022Microsoft YaHei\u0022, \u0022PingFang SC\u0022, sans-serif', label: "微软雅黑 / 苹方" },
  { value: '\u0022SimHei\u0022, sans-serif', label: "黑体" },
  { value: "Inter, sans-serif", label: "Inter" },
] as const;

const colorLabels: Array<{ key: keyof EventColorMap; label: string }> = [
  { key: "message", label: "弹幕" },
  { key: "interaction", label: "互动" },
  { key: "gift", label: "礼物" },
  { key: "superchat", label: "SC" },
  { key: "guard", label: "大航海" },
  { key: "system", label: "系统" },
];

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, step, suffix = "", onChange }: NumberFieldProps) {
  return (
    <Field>
      <FieldTop>{label}<Value>{value}{suffix}</Value></FieldTop>
      <Range
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

function EventTypeToggles({
  value,
  onChange,
}: {
  value: LiveEventType[];
  onChange: (value: LiveEventType[]) => void;
}) {
  return (
    <TypeGrid>
      {eventTypes.map((item) => (
        <TypeToggle key={item.value}>
          <input
            type="checkbox"
            checked={value.includes(item.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, item.value]
                  : value.filter((current) => current !== item.value),
              )
            }
          />
          {item.label}
        </TypeToggle>
      ))}
    </TypeGrid>
  );
}

function ColorControls({
  value,
  onChange,
  children,
}: {
  value: EventColorMap;
  onChange: (value: EventColorMap) => void;
  children?: ReactNode;
}) {
  return (
    <ColorGrid>
      {colorLabels.map((item) => (
        <ColorField key={item.key}>
          <input
            type="color"
            value={value[item.key]}
            onChange={(event) => onChange({ ...value, [item.key]: event.target.value })}
          />
          {item.label}
        </ColorField>
      ))}
      {children}
    </ColorGrid>
  );
}

interface OverlaySelectOption<T extends string> {
  /** 写入悬浮窗配置的稳定值。 */
  value: T;
  /** 下拉菜单中展示的中文文案。 */
  label: string;
}

interface OverlaySelectFieldProps<T extends string> {
  /** 字段主标题。 */
  label: string;
  /** 可选的简短生效范围说明。 */
  hint?: string;
  /** 当前选中的配置值。 */
  value: T;
  /** 所有可选项。 */
  options: readonly OverlaySelectOption<T>[];
  /** 选项变化时回传已经收窄的字符串联合类型。 */
  onChange: (value: T) => void;
}

/** 悬浮组件设置页统一使用的带标题下拉栏。 */
function OverlaySelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: OverlaySelectFieldProps<T>) {
  return (
    <SelectFieldRoot>
      <FieldTop>
        {label}
        {hint ? <Value>{hint}</Value> : null}
      </FieldTop>
      <PrismSelect
        ariaLabel={label}
        value={value}
        options={options}
        onChange={onChange}
      />
    </SelectFieldRoot>
  );
}

function sampleEvent(type: LiveEventType, index: number): LiveEvent {
  const samples: Record<LiveEventType, Pick<LiveEvent, "user" | "content" | "meta">> = {
    message: { user: "蓝莓汽水", content: "这个弹幕悬浮窗好可爱喵！" },
    interaction: { user: "月岛小熊", content: "进入了直播间", meta: "进场" },
    gift: { user: "薄荷星球", content: "赠送了 牛哇牛哇 × 3", meta: "礼物" },
    superchat: { user: "橘子海", content: "欢迎测试侧边事件栏", meta: "SC ¥30" },
    guard: { user: "海盐泡芙", content: "开通了 舰长 × 1", meta: "舰长" },
    system: { user: "bilimaku", content: "悬浮窗预览事件", meta: "系统" },
  };
  return {
    id: `overlay-preview-${Date.now()}-${index}`,
    type,
    userId: String(10000 + index),
    user: samples[type].user,
    avatar: "",
    content: samples[type].content,
    meta: samples[type].meta,
    emittedAt: Date.now(),
  };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function OverlaySettingsPage() {
  const [settings, setSettings] = useState<OverlaySettings>(() => loadOverlaySettings());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) initial.current = false;
    const timer = window.setTimeout(() => {
      void saveOverlaySettings(settings).catch((reason) => {
        setError(true);
        setNotice(errorText(reason));
      });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const updateDanmaku = (patch: Partial<DanmakuOverlaySettings>) => {
    setSettings((current) => ({
      ...current,
      danmaku: { ...current.danmaku, ...patch },
    }));
  };

  const updateSidebar = (patch: Partial<SidebarOverlaySettings>) => {
    setSettings((current) => ({
      ...current,
      sidebar: { ...current.sidebar, ...patch },
    }));
  };

  const showOverlay = async (kind: "danmaku" | "sidebar", preview: boolean) => {
    setError(false);
    try {
      await openOverlay(kind, settings);
      setNotice(kind === "danmaku" ? "全屏弹幕层已打开" : "侧边事件栏已打开");
      if (preview) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const types: LiveEventType[] = kind === "danmaku"
          ? ["message", "superchat"]
          : ["interaction", "message", "gift", "guard"];
        for (const [index, type] of types.entries()) {
          await previewOverlayEvent(sampleEvent(type, index));
          await new Promise((resolve) => window.setTimeout(resolve, 140));
        }
      }
    } catch (reason) {
      setError(true);
      setNotice(errorText(reason));
    }
  };

  return (
    <Page>
      <Grid>
        <OverlayModule>
          <OverlayCard>
            <OverlayCardParticles seed={0x4d414b55} />
            <ModuleHeader>
              <ModuleHeading>
                <ModuleTitle>全屏滚动弹幕</ModuleTitle>
                <ModuleDescription>按屏幕轨道展示实时弹幕，集中调整内容、字形与运动节奏。</ModuleDescription>
              </ModuleHeading>
              <PanelActions>
                <PrimaryButton type="button" onClick={() => void showOverlay("danmaku", true)}>
                  <Icon name="play" size={15} />
                  打开并预览
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => void closeOverlay("danmaku")}>
                  <Icon name="close" size={14} />
                  关闭窗口
                </SecondaryButton>
              </PanelActions>
            </ModuleHeader>
            <Body>
              <Section data-wide="true">
                <SectionTitle>内容与交互</SectionTitle>
              <EventTypeToggles
                value={settings.danmaku.enabledEventTypes}
                onChange={(enabledEventTypes) => updateDanmaku({ enabledEventTypes })}
              />
              <ToggleGrid>
                <Toggle>
                  <span>显示用户名</span>
                  <input type="checkbox" checked={settings.danmaku.showUsername} onChange={(event) => updateDanmaku({ showUsername: event.target.checked })} />
                  <CompactSwitchTrack aria-hidden="true" />
                </Toggle>
                <Toggle>
                  <span>显示头像</span>
                  <input type="checkbox" checked={settings.danmaku.showAvatar} onChange={(event) => updateDanmaku({ showAvatar: event.target.checked })} />
                  <CompactSwitchTrack aria-hidden="true" />
                </Toggle>
              </ToggleGrid>
            </Section>

            <Section>
              <SectionTitle>字体</SectionTitle>
              <Fields>
                <OverlaySelectField
                  label="字体族"
                  value={settings.danmaku.fontFamily}
                  options={danmakuFontOptions}
                  onChange={(fontFamily) => updateDanmaku({ fontFamily })}
                />
                <OverlaySelectField<"speed" | "duration">
                  label="动画计时方式"
                  value={settings.danmaku.motionMode}
                  options={motionModeOptions}
                  onChange={(motionMode) => updateDanmaku({ motionMode })}
                />
                <NumberField label="字号" value={settings.danmaku.fontSize} min={18} max={72} step={1} suffix="px" onChange={(fontSize) => updateDanmaku({ fontSize })} />
                <NumberField label="字重" value={settings.danmaku.fontWeight} min={300} max={900} step={100} onChange={(fontWeight) => updateDanmaku({ fontWeight })} />
                <NumberField label="透明度" value={settings.danmaku.opacity} min={0.2} max={1} step={0.05} onChange={(opacity) => updateDanmaku({ opacity })} />
                <NumberField label="描边" value={settings.danmaku.outlineWidth} min={0} max={4} step={0.5} suffix="px" onChange={(outlineWidth) => updateDanmaku({ outlineWidth })} />
                <NumberField label="阴影模糊" value={settings.danmaku.shadowBlur} min={0} max={24} step={1} suffix="px" onChange={(shadowBlur) => updateDanmaku({ shadowBlur })} />
              </Fields>
            </Section>

            <Section>
              <SectionTitle>轨道与动画</SectionTitle>
              <Fields>
                <NumberField label="移动速度" value={settings.danmaku.speedPixelsPerSecond} min={60} max={600} step={10} suffix="px/s" onChange={(speedPixelsPerSecond) => updateDanmaku({ speedPixelsPerSecond })} />
                <NumberField label="总时长" value={settings.danmaku.durationSeconds} min={3} max={30} step={0.5} suffix="s" onChange={(durationSeconds) => updateDanmaku({ durationSeconds })} />
                <NumberField label="滑入淡显" value={settings.danmaku.enterDurationMs} min={0} max={2000} step={20} suffix="ms" onChange={(enterDurationMs) => updateDanmaku({ enterDurationMs })} />
                <NumberField label="滑出淡隐" value={settings.danmaku.exitDurationMs} min={0} max={3000} step={20} suffix="ms" onChange={(exitDurationMs) => updateDanmaku({ exitDurationMs })} />
                <NumberField label="垂直起点" value={settings.danmaku.verticalStartPercent} min={0} max={80} step={1} suffix="%" onChange={(verticalStartPercent) => updateDanmaku({ verticalStartPercent })} />
                <NumberField label="垂直终点" value={settings.danmaku.verticalEndPercent} min={20} max={100} step={1} suffix="%" onChange={(verticalEndPercent) => updateDanmaku({ verticalEndPercent })} />
                <NumberField label="轨道间距" value={settings.danmaku.laneGap} min={0} max={40} step={1} suffix="px" onChange={(laneGap) => updateDanmaku({ laneGap })} />
                <NumberField label="同时显示" value={settings.danmaku.maxVisible} min={1} max={80} step={1} onChange={(maxVisible) => updateDanmaku({ maxVisible })} />
              </Fields>
            </Section>

            <Section data-wide="true">
              <SectionTitle>颜色</SectionTitle>
              <ColorControls value={settings.danmaku.colors} onChange={(colors) => updateDanmaku({ colors })}>
                <ColorField><input type="color" value={settings.danmaku.usernameColor} onChange={(event) => updateDanmaku({ usernameColor: event.target.value })} />昵称色</ColorField>
                <ColorField><input type="color" value={settings.danmaku.outlineColor} onChange={(event) => updateDanmaku({ outlineColor: event.target.value })} />描边色</ColorField>
                <ColorField><input type="color" value={settings.danmaku.shadowColor} onChange={(event) => updateDanmaku({ shadowColor: event.target.value })} />阴影色</ColorField>
              </ColorControls>
            </Section>

            </Body>
          </OverlayCard>
        </OverlayModule>

        <OverlayModule>
          <OverlayCard>
            <OverlayCardParticles seed={0x53494445} />
            <ModuleHeader>
              <ModuleHeading>
                <ModuleTitle>侧边栏弹幕</ModuleTitle>
                <ModuleDescription>以轻量事件流展示进场、弹幕与礼物，支持跨屏定位与玻璃背景。</ModuleDescription>
              </ModuleHeading>
              <PanelActions>
                <PrimaryButton type="button" onClick={() => void showOverlay("sidebar", true)}>
                  <Icon name="play" size={15} />
                  打开并预览
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => void closeOverlay("sidebar")}>
                  <Icon name="close" size={14} />
                  关闭窗口
                </SecondaryButton>
              </PanelActions>
            </ModuleHeader>
            <Body>
              <Section data-wide="true">
                <SectionTitle>内容与窗口</SectionTitle>
              <EventTypeToggles
                value={settings.sidebar.enabledEventTypes}
                onChange={(enabledEventTypes) => updateSidebar({ enabledEventTypes })}
              />
              <WindowSwitchGrid>
                <WindowSwitch>
                  <WindowSwitchCopy>
                    <WindowSwitchTitle>编辑定位模式</WindowSwitchTitle>
                    <WindowSwitchHint>显示窗口边界，拖到任意显示器；松手后自动防溢出</WindowSwitchHint>
                  </WindowSwitchCopy>
                  <input type="checkbox" checked={settings.sidebar.editMode} onChange={(event) => updateSidebar({ editMode: event.target.checked })} />
                  <WindowSwitchTrack aria-hidden="true" />
                </WindowSwitch>

                <WindowSwitch>
                  <WindowSwitchCopy>
                    <WindowSwitchTitle>是否避开任务栏</WindowSwitchTitle>
                    <WindowSwitchHint>开启后自动避让 Windows 任务栏；关闭后可贴到显示器完整底边</WindowSwitchHint>
                  </WindowSwitchCopy>
                  <input
                    type="checkbox"
                    checked={!settings.sidebar.includeTaskbarInBounds}
                    onChange={(event) => updateSidebar({ includeTaskbarInBounds: !event.target.checked })}
                  />
                  <WindowSwitchTrack aria-hidden="true" />
                </WindowSwitch>
              </WindowSwitchGrid>
              <ToggleGrid>
                <Toggle>
                  <span>显示头像</span>
                  <input type="checkbox" checked={settings.sidebar.showAvatar} onChange={(event) => updateSidebar({ showAvatar: event.target.checked })} />
                  <CompactSwitchTrack aria-hidden="true" />
                </Toggle>
              </ToggleGrid>
              <Fields>
                <OverlaySelectField<SidebarVerticalAlignment>
                  label="播报停靠位置"
                  value={settings.sidebar.verticalAlignment}
                  options={[
                    { value: "bottom", label: "靠下显示" },
                    { value: "top", label: "靠上显示" },
                  ]}
                  onChange={(verticalAlignment) => updateSidebar({ verticalAlignment })}
                />
                <OverlaySelectField<SidebarEntryDirection>
                  label="新消息进入方向"
                  value={settings.sidebar.entryDirection}
                  options={[
                    { value: "bottom", label: "从下方进入" },
                    { value: "top", label: "从上方进入" },
                  ]}
                  onChange={(entryDirection) => updateSidebar({ entryDirection })}
                />
                <OverlaySelectField
                  label="字体族"
                  value={settings.sidebar.fontFamily}
                  options={sidebarFontOptions}
                  onChange={(fontFamily) => updateSidebar({ fontFamily })}
                />
                <NumberField label="窗口宽度" value={settings.sidebar.width} min={280} max={720} step={10} suffix="px" onChange={(width) => updateSidebar({ width })} />
                <NumberField label="窗口高度" value={settings.sidebar.height} min={360} max={1200} step={10} suffix="px" onChange={(height) => updateSidebar({ height })} />
                <NumberField label="字号" value={settings.sidebar.fontSize} min={10} max={28} step={1} suffix="px" onChange={(fontSize) => updateSidebar({ fontSize })} />
                <NumberField label="字重" value={settings.sidebar.fontWeight} min={300} max={900} step={100} onChange={(fontWeight) => updateSidebar({ fontWeight })} />
                <NumberField label="最大事件" value={settings.sidebar.maxEvents} min={3} max={30} step={1} onChange={(maxEvents) => updateSidebar({ maxEvents })} />
                <NumberField label="停留时间" value={settings.sidebar.lifetimeSeconds} min={3} max={60} step={1} suffix="s" onChange={(lifetimeSeconds) => updateSidebar({ lifetimeSeconds })} />
              </Fields>
            </Section>

            <Section>
              <SectionTitle>外观</SectionTitle>
              <WindowSwitchGrid>
                <WindowSwitch>
                  <WindowSwitchCopy>
                    <WindowSwitchTitle>启用消息背景</WindowSwitchTitle>
                    <WindowSwitchHint>关闭后移除底色、玻璃模糊、高光、噪点与阴影，头像仍由独立选项控制</WindowSwitchHint>
                  </WindowSwitchCopy>
                  <input
                    type="checkbox"
                    checked={settings.sidebar.backgroundEnabled}
                    onChange={(event) => updateSidebar({ backgroundEnabled: event.target.checked })}
                  />
                  <WindowSwitchTrack aria-hidden="true" />
                </WindowSwitch>
              </WindowSwitchGrid>
              <Fields>
                <NumberField label="背景不透明度" value={settings.sidebar.cardOpacity} min={0} max={1} step={0.05} onChange={(cardOpacity) => updateSidebar({ cardOpacity })} />
                <NumberField label="背景模糊" value={settings.sidebar.blur} min={0} max={40} step={1} suffix="px" onChange={(blur) => updateSidebar({ blur })} />
                <NumberField label="气泡圆角" value={settings.sidebar.radius} min={0} max={20} step={1} suffix="px" onChange={(radius) => updateSidebar({ radius })} />
              </Fields>
            </Section>

            <Section>
              <SectionTitle>滚动与进出场</SectionTitle>
              <Fields>
                <NumberField label="列表滚动时间" value={settings.sidebar.scrollDurationMs} min={0} max={2400} step={20} suffix="ms" onChange={(scrollDurationMs) => updateSidebar({ scrollDurationMs })} />
                <NumberField label="滑入时间" value={settings.sidebar.enterDurationMs} min={0} max={2000} step={20} suffix="ms" onChange={(enterDurationMs) => updateSidebar({ enterDurationMs })} />
                <NumberField label="滑出时间" value={settings.sidebar.exitDurationMs} min={0} max={3000} step={20} suffix="ms" onChange={(exitDurationMs) => updateSidebar({ exitDurationMs })} />
                <NumberField label="滑动距离" value={settings.sidebar.slideDistance} min={8} max={180} step={2} suffix="px" onChange={(slideDistance) => updateSidebar({ slideDistance })} />
              </Fields>
            </Section>

            <Section data-wide="true">
              <SectionTitle>颜色</SectionTitle>
              <ColorControls value={settings.sidebar.colors} onChange={(colors) => updateSidebar({ colors })}>
                <ColorField><input type="color" value={settings.sidebar.usernameColor} onChange={(event) => updateSidebar({ usernameColor: event.target.value })} />昵称色</ColorField>
                <ColorField><input type="color" value={settings.sidebar.backgroundColor} onChange={(event) => updateSidebar({ backgroundColor: event.target.value })} />气泡底色</ColorField>
                <ColorField><input type="color" value={settings.sidebar.textColor} onChange={(event) => updateSidebar({ textColor: event.target.value })} />文字色</ColorField>
              </ColorControls>
            </Section>

            </Body>
          </OverlayCard>
        </OverlayModule>
      </Grid>

      {notice ? <Notice data-error={error}>{notice}</Notice> : null}
    </Page>
  );
}
