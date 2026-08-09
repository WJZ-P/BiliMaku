import { styled } from "@linaria/react";
import { useEffect, useRef, useState } from "react";
import { OverlayCardParticles } from "./OverlayCardParticles";
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
  display: grid;
  gap: 18px;
  padding: 12px 24px 30px;

  @media (max-width: 700px) {
    padding: 10px 12px 24px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 24px;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`;

const OverlayModule = styled.section`
  display: grid;
  min-width: 0;
  gap: 9px;
`;

const ModuleTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  padding: 0 2px;
  color: ${theme.colors.textPrimary};
  font-size: 19px;
  font-weight: 880;
  letter-spacing: -0.025em;
  line-height: 1.2;

  &::before {
    width: 3px;
    height: 19px;
    flex: 0 0 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, ${theme.colors.cyan}, ${theme.colors.brand});
    box-shadow: 0 0 10px color-mix(in srgb, ${theme.colors.brand} 28%, transparent);
    content: "";
  }
`;

const OverlayCard = styled.div`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 74%, transparent);
  border-radius: 4px;
  background:
    linear-gradient(
      138deg,
      color-mix(in srgb, ${theme.colors.surface} 54%, transparent),
      color-mix(in srgb, ${theme.colors.brandSubtle} 27%, transparent) 52%,
      color-mix(in srgb, ${theme.colors.surface} 38%, transparent)
    );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 78%, transparent),
    inset 1px 0 0 color-mix(in srgb, ${theme.colors.highlight} 34%, transparent),
    0 12px 30px color-mix(in srgb, ${theme.colors.brandDeep} 7%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.34) brightness(1.025);
  backdrop-filter: blur(22px) saturate(1.34) brightness(1.025);

  &::before {
    position: absolute;
    z-index: 1;
    inset: 0;
    background-image: url("/textures/frosted-noise.svg");
    background-size: 96px 96px;
    content: "";
    mix-blend-mode: soft-light;
    opacity: 0.035;
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
  gap: 18px;
  padding: 18px 20px 21px;

  @media (max-width: 700px) {
    padding: 15px 13px 18px;
  }
`;

const Section = styled.section`
  display: grid;
  gap: 11px;
  padding-top: 4px;

  & + & {
    padding-top: 17px;
    border-top: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 56%, transparent);
  }
`;

const SectionTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 840;
  letter-spacing: 0.015em;
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: grid;
  min-width: 0;
  gap: 7px;
`;

const FieldTop = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 730;
`;

const Value = styled.span`
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
  font-size: 8px;
`;

const Select = styled.select`
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 72%, transparent);
  border-radius: 4px;
  outline: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 48%, transparent);
  color: ${theme.colors.textPrimary};
  font-size: 9px;
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
  backdrop-filter: blur(10px) saturate(1.2);
  transition: border-color ${theme.motion.fast}, background ${theme.motion.fast};

  &:hover,
  &:focus-visible {
    border-color: color-mix(in srgb, ${theme.colors.brand} 56%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.surface} 66%, transparent);
  }
`;

const Range = styled.input`
  --overlay-range-height: 4px;
  --overlay-range-thumb: 13px;

  width: 100%;
  height: 22px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: grab;

  &::-webkit-slider-runnable-track {
    height: var(--overlay-range-height);
    border-radius: 3px;
    background: linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan});
    box-shadow: inset 0 0 0 1px color-mix(in srgb, ${theme.colors.borderStrong} 62%, transparent);
    transition: height 190ms cubic-bezier(0.18, 1.3, 0.34, 1);
  }

  &::-webkit-slider-thumb {
    width: var(--overlay-range-thumb);
    height: var(--overlay-range-thumb);
    margin-top: calc((var(--overlay-range-height) - var(--overlay-range-thumb)) / 2);
    appearance: none;
    border: 2px solid ${theme.colors.brandDeep};
    border-radius: 3px;
    background: ${theme.colors.surface};
    box-shadow: 0 3px 9px color-mix(in srgb, ${theme.colors.brandDeep} 20%, transparent);
    transition: margin-top 190ms cubic-bezier(0.18, 1.3, 0.34, 1), transform ${theme.motion.spring};
  }

  &:hover {
    --overlay-range-height: 6px;
  }

  &:active {
    --overlay-range-height: 8px;
    cursor: grabbing;
  }

  &:active::-webkit-slider-thumb {
    transform: scale(1.13);
  }
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ColorField = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 65%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 43%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;
  -webkit-backdrop-filter: blur(8px) saturate(1.18);
  backdrop-filter: blur(8px) saturate(1.18);

  input {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
  }
`;

const ToggleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const Toggle = styled.label`
  display: flex;
  min-height: 35px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 65%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 42%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;

  input {
    accent-color: ${theme.colors.brand};
  }
`;

const WindowSwitchGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
`;

const WindowSwitch = styled.label`
  display: grid;
  min-height: 56px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 66%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.surface} 42%, transparent);
  cursor: pointer;

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
    background: linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandDeep});
    box-shadow: 0 4px 12px color-mix(in srgb, ${theme.colors.brand} 28%, transparent);
  }

  input:checked + span::after {
    transform: translateX(17px);
  }

  &:focus-within {
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 25%, transparent);
    outline-offset: 1px;
  }
`;

const WindowSwitchCopy = styled.span`
  display: grid;
  gap: 3px;
`;

const WindowSwitchTitle = styled.strong`
  color: ${theme.colors.textPrimary};
  font-size: 9px;
  font-weight: 800;
`;

const WindowSwitchHint = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 7px;
  font-weight: 600;
  line-height: 1.45;
`;

const WindowSwitchTrack = styled.span`
  position: relative;
  width: 35px;
  height: 19px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, ${theme.colors.textMuted} 28%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.textMuted} 13%, white);
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;

  &::after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 13px;
    height: 13px;
    border-radius: 3px;
    background: white;
    box-shadow: 0 2px 5px rgba(13, 50, 88, 0.22);
    content: "";
    transition: transform 220ms cubic-bezier(0.2, 0.85, 0.25, 1.25);
  }
`;

const TypeGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

const TypeToggle = styled.label`
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 66%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, ${theme.colors.surface} 42%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 8px;
  font-weight: 750;

  &:has(input:checked) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 38%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 62%, transparent);
    color: ${theme.colors.brand};
  }

  input {
    display: none;
  }
`;

const PanelActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brandDeep} 32%, transparent);
  border-radius: 6px;
  background: linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandDeep});
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 7px 18px color-mix(in srgb, ${theme.colors.brand} 20%, transparent);
  transition: transform ${theme.motion.spring}, filter ${theme.motion.fast};

  &:hover {
    filter: saturate(1.12) brightness(1.04);
    transform: translateY(-1px);
  }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  padding: 0 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.borderStrong} 76%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, ${theme.colors.surface} 43%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 720;
  -webkit-backdrop-filter: blur(10px) saturate(1.18);
  backdrop-filter: blur(10px) saturate(1.18);
  transition: border-color ${theme.motion.fast}, color ${theme.motion.fast}, transform ${theme.motion.spring};

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.brand} 46%, ${theme.colors.border});
    color: ${theme.colors.brandDeep};
    transform: translateY(-1px);
  }
`;

const Notice = styled.div`
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 18%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, ${theme.colors.brandSubtle} 44%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  line-height: 1.6;
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

function ColorControls({ value, onChange }: { value: EventColorMap; onChange: (value: EventColorMap) => void }) {
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
    <Field>
      <FieldTop>
        {label}
        {hint ? <Value>{hint}</Value> : null}
      </FieldTop>
      <Select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </Field>
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
  const [notice, setNotice] = useState("参数会自动保存并同步到已经打开的悬浮窗。");
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
          <ModuleTitle>全屏滚动弹幕</ModuleTitle>
          <OverlayCard>
            <OverlayCardParticles seed={0x4d414b55} />
            <Body>
              <Section>
              <SectionTitle>内容与交互</SectionTitle>
              <EventTypeToggles
                value={settings.danmaku.enabledEventTypes}
                onChange={(enabledEventTypes) => updateDanmaku({ enabledEventTypes })}
              />
              <ToggleGrid>
                <Toggle>显示用户名<input type="checkbox" checked={settings.danmaku.showUsername} onChange={(event) => updateDanmaku({ showUsername: event.target.checked })} /></Toggle>
                <Toggle>显示头像<input type="checkbox" checked={settings.danmaku.showAvatar} onChange={(event) => updateDanmaku({ showAvatar: event.target.checked })} /></Toggle>
                <Toggle>鼠标穿透<input type="checkbox" checked={settings.danmaku.clickThrough} onChange={(event) => updateDanmaku({ clickThrough: event.target.checked })} /></Toggle>
              </ToggleGrid>
            </Section>

            <Section>
              <SectionTitle>字体</SectionTitle>
              <Fields>
                <Field>
                  <FieldTop>字体族</FieldTop>
                  <Select value={settings.danmaku.fontFamily} onChange={(event) => updateDanmaku({ fontFamily: event.target.value })}>
                    <option value={'"Microsoft YaHei", "PingFang SC", sans-serif'}>微软雅黑 / 苹方</option>
                    <option value={'"SimHei", sans-serif'}>黑体</option>
                    <option value={'"KaiTi", serif'}>楷体</option>
                    <option value={'Inter, sans-serif'}>Inter</option>
                  </Select>
                </Field>
                <Field>
                  <FieldTop>动画计时方式</FieldTop>
                  <Select value={settings.danmaku.motionMode} onChange={(event) => updateDanmaku({ motionMode: event.target.value as "speed" | "duration" })}>
                    <option value="speed">按像素速度</option>
                    <option value="duration">按总时长</option>
                  </Select>
                </Field>
                <NumberField label="字号" value={settings.danmaku.fontSize} min={18} max={72} step={1} suffix="px" onChange={(fontSize) => updateDanmaku({ fontSize })} />
                <NumberField label="字重" value={settings.danmaku.fontWeight} min={300} max={900} step={100} onChange={(fontWeight) => updateDanmaku({ fontWeight })} />
                <NumberField label="透明度" value={settings.danmaku.opacity} min={0.2} max={1} step={0.05} onChange={(opacity) => updateDanmaku({ opacity })} />
                <NumberField label="描边" value={settings.danmaku.outlineWidth} min={0} max={4} step={0.5} suffix="px" onChange={(outlineWidth) => updateDanmaku({ outlineWidth })} />
                <NumberField label="阴影模糊" value={settings.danmaku.shadowBlur} min={0} max={24} step={1} suffix="px" onChange={(shadowBlur) => updateDanmaku({ shadowBlur })} />
              </Fields>
              <ColorControls value={settings.danmaku.colors} onChange={(colors) => updateDanmaku({ colors })} />
              <Fields>
                <ColorField><input type="color" value={settings.danmaku.usernameColor} onChange={(event) => updateDanmaku({ usernameColor: event.target.value })} />昵称色</ColorField>
                <ColorField><input type="color" value={settings.danmaku.outlineColor} onChange={(event) => updateDanmaku({ outlineColor: event.target.value })} />描边色</ColorField>
                <ColorField><input type="color" value={settings.danmaku.shadowColor} onChange={(event) => updateDanmaku({ shadowColor: event.target.value })} />阴影色</ColorField>
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

            <PanelActions>
              <PrimaryButton type="button" onClick={() => void showOverlay("danmaku", true)}>应用并预览</PrimaryButton>
              <SecondaryButton type="button" onClick={() => void closeOverlay("danmaku")}>关闭弹幕层</SecondaryButton>
            </PanelActions>
            </Body>
          </OverlayCard>
        </OverlayModule>

        <OverlayModule>
          <ModuleTitle>侧边栏弹幕</ModuleTitle>
          <OverlayCard>
            <OverlayCardParticles seed={0x53494445} />
            <Body>
              <Section>
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
                    <WindowSwitchTitle>边缘范围包含任务栏</WindowSwitchTitle>
                    <WindowSwitchHint>开启后可贴到显示器完整底边；关闭时自动避让 Windows 任务栏</WindowSwitchHint>
                  </WindowSwitchCopy>
                  <input
                    type="checkbox"
                    checked={settings.sidebar.includeTaskbarInBounds}
                    onChange={(event) => updateSidebar({ includeTaskbarInBounds: event.target.checked })}
                  />
                  <WindowSwitchTrack aria-hidden="true" />
                </WindowSwitch>
              </WindowSwitchGrid>
              <ToggleGrid>
                <Toggle>显示头像<input type="checkbox" checked={settings.sidebar.showAvatar} onChange={(event) => updateSidebar({ showAvatar: event.target.checked })} /></Toggle>
                <Toggle>鼠标穿透<input type="checkbox" checked={settings.sidebar.clickThrough} onChange={(event) => updateSidebar({ clickThrough: event.target.checked })} /></Toggle>
              </ToggleGrid>
              <Fields>
                <OverlaySelectField<SidebarVerticalAlignment>
                  label="播报停靠位置"
                  hint="默认靠下"
                  value={settings.sidebar.verticalAlignment}
                  options={[
                    { value: "bottom", label: "靠下显示" },
                    { value: "top", label: "靠上显示" },
                  ]}
                  onChange={(verticalAlignment) => updateSidebar({ verticalAlignment })}
                />
                <OverlaySelectField<SidebarEntryDirection>
                  label="新消息进入方向"
                  hint="默认从下方"
                  value={settings.sidebar.entryDirection}
                  options={[
                    { value: "bottom", label: "从下方进入" },
                    { value: "top", label: "从上方进入" },
                  ]}
                  onChange={(entryDirection) => updateSidebar({ entryDirection })}
                />
                <Field>
                  <FieldTop>字体族</FieldTop>
                  <Select value={settings.sidebar.fontFamily} onChange={(event) => updateSidebar({ fontFamily: event.target.value })}>
                    <option value={'"Microsoft YaHei", "PingFang SC", sans-serif'}>微软雅黑 / 苹方</option>
                    <option value={'"SimHei", sans-serif'}>黑体</option>
                    <option value={'Inter, sans-serif'}>Inter</option>
                  </Select>
                </Field>
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
              <ColorControls value={settings.sidebar.colors} onChange={(colors) => updateSidebar({ colors })} />
              <Fields>
                <ColorField><input type="color" value={settings.sidebar.usernameColor} onChange={(event) => updateSidebar({ usernameColor: event.target.value })} />昵称色</ColorField>
                <ColorField><input type="color" value={settings.sidebar.backgroundColor} onChange={(event) => updateSidebar({ backgroundColor: event.target.value })} />气泡底色</ColorField>
                <ColorField><input type="color" value={settings.sidebar.textColor} onChange={(event) => updateSidebar({ textColor: event.target.value })} />文字色</ColorField>
                <NumberField label="玻璃透明度" value={settings.sidebar.cardOpacity} min={0} max={1} step={0.05} onChange={(cardOpacity) => updateSidebar({ cardOpacity })} />
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

            <PanelActions>
              <PrimaryButton type="button" onClick={() => void showOverlay("sidebar", true)}>应用并预览</PrimaryButton>
              <SecondaryButton type="button" onClick={() => void closeOverlay("sidebar")}>关闭事件栏</SecondaryButton>
            </PanelActions>
            </Body>
          </OverlayCard>
        </OverlayModule>
      </Grid>

      <Notice data-error={error}>{notice}</Notice>
    </Page>
  );
}
