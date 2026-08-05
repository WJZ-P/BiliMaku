import { styled } from "@linaria/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import {
  EyebrowBadge,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
  SubtleButton,
} from "../../components/ui";
import {
  closeOverlay,
  defaultOverlaySettings,
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
  SidebarOverlaySettings,
} from "../../types/overlay";

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Intro = styled.section`
  position: relative;
  overflow: hidden;
  padding: 28px 30px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};
`;

const IntroKicker = styled.div`
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.16em;
`;

const IntroTitle = styled.h2`
  max-width: 800px;
  margin: 7px 0 10px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(25px, 3vw, 37px);
  font-weight: 850;
  letter-spacing: -0.05em;
`;

const IntroDescription = styled.p`
  max-width: 780px;
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  line-height: 1.75;
`;

const IntroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 20px;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 15px;
  border: 0;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 9px 22px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`;

const Body = styled.div`
  display: grid;
  gap: 17px;
  padding: 18px 20px 22px;
`;

const Section = styled.section`
  display: grid;
  gap: 11px;
  padding-top: 4px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 10px;
  font-weight: 820;
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
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
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  outline: 0;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textPrimary};
  font-size: 9px;
`;

const Range = styled.input`
  width: 100%;
  accent-color: ${theme.colors.brand};
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
`;

const ColorField = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;

  input {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 7px;
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
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 700;

  input {
    accent-color: ${theme.colors.brand};
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
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-size: 8px;
  font-weight: 750;

  &:has(input:checked) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 34%, ${theme.colors.border});
    background: ${theme.colors.brandSubtle};
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

const Notice = styled.div`
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 16%, transparent);
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  line-height: 1.6;

  &[data-error="true"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 20%, transparent);
    background: ${theme.colors.dangerSoft};
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

function sampleEvent(type: LiveEventType, index: number): LiveEvent {
  const samples: Record<LiveEventType, Pick<LiveEvent, "user" | "content" | "meta">> = {
    message: { user: "蓝莓汽水", content: "这个弹幕悬浮窗好可爱喵！" },
    interaction: { user: "月岛小熊", content: "进入了直播间", meta: "进场" },
    gift: { user: "薄荷星球", content: "赠送了 牛哇牛哇 × 3", meta: "礼物" },
    superchat: { user: "橘子海", content: "欢迎测试侧边事件栏", meta: "SC ¥30" },
    guard: { user: "海盐泡芙", content: "开通了 舰长 × 1", meta: "舰长" },
    system: { user: "BiliCast", content: "悬浮窗预览事件", meta: "系统" },
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

  const reset = () => {
    setSettings(defaultOverlaySettings);
    setError(false);
    setNotice("已经恢复浅蓝主题推荐参数");
  };

  return (
    <Page>
      <Intro>
        <IntroKicker>TRANSPARENT OVERLAYS</IntroKicker>
        <IntroTitle>两个独立组件，一条实时事件流</IntroTitle>
        <IntroDescription>
          全屏弹幕层只负责横向滚动；侧边事件栏负责进场、点赞、弹幕、礼物和大航海卡片。
          两个窗口分别订阅 LiveEvent，样式、动画、显示范围和鼠标穿透互不耦合。
        </IntroDescription>
        <IntroActions>
          <PrimaryButton type="button" onClick={() => void showOverlay("danmaku", true)}>
            <Icon name="message" size={15} />打开并预览全屏弹幕
          </PrimaryButton>
          <PrimaryButton type="button" onClick={() => void showOverlay("sidebar", true)}>
            <Icon name="radio" size={15} />打开并预览事件栏
          </PrimaryButton>
          <SubtleButton type="button" onClick={reset}>恢复推荐参数</SubtleButton>
        </IntroActions>
      </Intro>

      <Grid>
        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>全屏滚动弹幕</PanelTitle>
              <PanelDescription>透明、置顶、默认鼠标穿透</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>DECOUPLED WINDOW A</EyebrowBadge>
          </PanelHeader>
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
              <SubtleButton type="button" onClick={() => void closeOverlay("danmaku")}>关闭弹幕层</SubtleButton>
            </PanelActions>
          </Body>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>侧边事件栏</PanelTitle>
              <PanelDescription>适合直播画面侧边的小区域事件流</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>DECOUPLED WINDOW B</EyebrowBadge>
          </PanelHeader>
          <Body>
            <Section>
              <SectionTitle>内容与窗口</SectionTitle>
              <EventTypeToggles
                value={settings.sidebar.enabledEventTypes}
                onChange={(enabledEventTypes) => updateSidebar({ enabledEventTypes })}
              />
              <ToggleGrid>
                <Toggle>显示头像<input type="checkbox" checked={settings.sidebar.showAvatar} onChange={(event) => updateSidebar({ showAvatar: event.target.checked })} /></Toggle>
                <Toggle>显示 UID<input type="checkbox" checked={settings.sidebar.showUserId} onChange={(event) => updateSidebar({ showUserId: event.target.checked })} /></Toggle>
                <Toggle>鼠标穿透<input type="checkbox" checked={settings.sidebar.clickThrough} onChange={(event) => updateSidebar({ clickThrough: event.target.checked })} /></Toggle>
              </ToggleGrid>
              <Fields>
                <Field>
                  <FieldTop>停靠方向</FieldTop>
                  <Select value={settings.sidebar.side} onChange={(event) => updateSidebar({ side: event.target.value as "left" | "right" })}>
                    <option value="right">屏幕右侧</option>
                    <option value="left">屏幕左侧</option>
                  </Select>
                </Field>
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
                <ColorField><input type="color" value={settings.sidebar.backgroundColor} onChange={(event) => updateSidebar({ backgroundColor: event.target.value })} />气泡底色</ColorField>
                <ColorField><input type="color" value={settings.sidebar.textColor} onChange={(event) => updateSidebar({ textColor: event.target.value })} />文字色</ColorField>
                <NumberField label="气泡透明度" value={settings.sidebar.cardOpacity} min={0} max={1} step={0.05} onChange={(cardOpacity) => updateSidebar({ cardOpacity })} />
                <NumberField label="气泡模糊" value={settings.sidebar.blur} min={0} max={40} step={1} suffix="px" onChange={(blur) => updateSidebar({ blur })} />
                <NumberField label="气泡圆角" value={settings.sidebar.radius} min={0} max={20} step={1} suffix="px" onChange={(radius) => updateSidebar({ radius })} />
              </Fields>
            </Section>

            <Section>
              <SectionTitle>滑入与滑出</SectionTitle>
              <Fields>
                <NumberField label="滑入时间" value={settings.sidebar.enterDurationMs} min={0} max={2000} step={20} suffix="ms" onChange={(enterDurationMs) => updateSidebar({ enterDurationMs })} />
                <NumberField label="滑出时间" value={settings.sidebar.exitDurationMs} min={0} max={3000} step={20} suffix="ms" onChange={(exitDurationMs) => updateSidebar({ exitDurationMs })} />
                <NumberField label="滑动距离" value={settings.sidebar.slideDistance} min={8} max={180} step={2} suffix="px" onChange={(slideDistance) => updateSidebar({ slideDistance })} />
              </Fields>
            </Section>

            <PanelActions>
              <PrimaryButton type="button" onClick={() => void showOverlay("sidebar", true)}>应用并预览</PrimaryButton>
              <SubtleButton type="button" onClick={() => void closeOverlay("sidebar")}>关闭事件栏</SubtleButton>
            </PanelActions>
          </Body>
        </Panel>
      </Grid>

      <Notice data-error={error}>{notice}</Notice>
    </Page>
  );
}
