import { useState, type CSSProperties } from "react";
import { Icon } from "../../components/Icon";
import { WebglParticleButton } from "../../components/WebglParticleButton";
import { WebglDanmakuFlow } from "./WebglDanmakuFlow";
import { WebglSpectralDeck } from "./WebglSpectralDeck";
import {
  Avatar,
  ButtonMatrix,
  ChatBubble,
  ChatConsole,
  ChatContent,
  ChatMeta,
  ChatRow,
  ControlGrid,
  Description,
  Field,
  FieldHeader,
  FieldLabel,
  FieldStack,
  FieldValue,
  FooterNote,
  HeaderCopy,
  HeaderEyebrow,
  HeaderTelemetry,
  LabHeader,
  Metric,
  MetricDelta,
  MetricLabel,
  MetricsStrip,
  MetricValue,
  Page,
  Panel,
  PanelHeader,
  PanelMeta,
  PanelTitle,
  PreviewGrid,
  Range,
  Section,
  SectionCaption,
  SectionCopy,
  SectionHeader,
  SectionIndex,
  SectionTitle,
  Select,
  SelectArrow,
  SelectShell,
  SignalCode,
  SignalFill,
  SignalHeader,
  SignalMeter,
  SignalPanel,
  Switch,
  SwitchCopy,
  SwitchRow,
  SwitchThumb,
  TelemetryCell,
  TextInput,
  Title,
} from "./DebugStyles";

type RangeStyle = CSSProperties & {
  "--range-progress": string;
};

type SignalStyle = CSSProperties & {
  "--signal-level": string;
};

type MotionProfile = "reactive" | "elastic" | "precise";
type EventChannel = "message" | "interaction" | "gift";

const motionNames: Record<MotionProfile, string> = {
  reactive: "实时追踪",
  elastic: "弹簧反馈",
  precise: "精准硬切",
};

const channelNames: Record<EventChannel, string> = {
  message: "普通弹幕",
  interaction: "关注互动",
  gift: "礼物事件",
};

/** 硬朗 UI 与 WebGL 交互的组件实验页，不会写入正式应用配置。 */
export function DebugPage() {
  const [particleDensity, setParticleDensity] = useState(62);
  const [motionProfile, setMotionProfile] = useState<MotionProfile>("reactive");
  const [eventChannel, setEventChannel] = useState<EventChannel>("message");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [sampleText, setSampleText] = useState("今晚也要把弹幕播报做得更灵动");
  const [lastAction, setLastAction] = useState("等待交互");

  const rangeStyle: RangeStyle = {
    "--range-progress": `${particleDensity}%`,
  };
  const signalStyle: SignalStyle = {
    "--signal-level": `${particleDensity}%`,
  };

  return (
    <Page>
      <LabHeader>
        <HeaderCopy>
          <HeaderEyebrow>INTERACTION FORGE / BILIMAKU</HeaderEyebrow>
          <Title>硬边界面与动态粒子实验场</Title>
          <Description>
            用明确边界、连续数据轨和 WebGL 粒子建立 BiliMaku 的视觉语言。这里的控件强调结构、响应和直播弹幕的运动感，不依赖大圆角与彩色投影制造层级。
          </Description>
        </HeaderCopy>
        <HeaderTelemetry aria-label="调试页实时参数">
          <TelemetryCell>
            <span>RENDERER</span>
            <strong>WEBGL 1.0</strong>
          </TelemetryCell>
          <TelemetryCell>
            <span>GEOMETRY</span>
            <strong>HARD / 02</strong>
          </TelemetryCell>
          <TelemetryCell>
            <span>PARTICLES</span>
            <strong>{particleDensity}%</strong>
          </TelemetryCell>
          <TelemetryCell>
            <span>LAST ACTION</span>
            <strong>{lastAction}</strong>
          </TelemetryCell>
        </HeaderTelemetry>
      </LabHeader>

      <Section>
        <SectionHeader>
          <SectionIndex>01</SectionIndex>
          <SectionCopy>
            <SectionTitle>操作控件</SectionTitle>
            <SectionCaption>按钮粒子从四周涌向鼠标；表单控件保持硬边和清晰焦点。</SectionCaption>
          </SectionCopy>
        </SectionHeader>

        <ControlGrid>
          <Panel>
            <PanelHeader>
              <PanelTitle>WebGL 粒子按钮</PanelTitle>
              <PanelMeta>PERIMETER → POINTER</PanelMeta>
            </PanelHeader>
            <ButtonMatrix>
              <WebglParticleButton
                kind="primary"
                block
                onClick={() => setLastAction("启动播报")}
              >
                <Icon name="play" size={14} />
                启动播报
              </WebglParticleButton>
              <WebglParticleButton
                block
                onClick={() => setLastAction("预览粒子")}
              >
                <Icon name="sparkles" size={14} />
                预览粒子
              </WebglParticleButton>
              <WebglParticleButton
                block
                onClick={() => setLastAction("同步规则")}
              >
                <Icon name="check" size={14} />
                同步规则
              </WebglParticleButton>
              <WebglParticleButton
                kind="danger"
                block
                onClick={() => setLastAction("清空事件")}
              >
                <Icon name="close" size={14} />
                清空事件
              </WebglParticleButton>
            </ButtonMatrix>
            <WebglParticleButton disabled block>
              禁用状态 · 不创建渲染上下文
            </WebglParticleButton>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>输入与选择</PanelTitle>
              <PanelMeta>RANGE / SELECT / INPUT / SWITCH</PanelMeta>
            </PanelHeader>
            <FieldStack>
              <Field>
                <FieldHeader>
                  <FieldLabel>粒子密度</FieldLabel>
                  <FieldValue>{particleDensity}%</FieldValue>
                </FieldHeader>
                <Range
                  type="range"
                  min="10"
                  max="100"
                  value={particleDensity}
                  style={rangeStyle}
                  aria-label="粒子密度"
                  onChange={(event) => setParticleDensity(Number(event.target.value))}
                />
              </Field>

              <Field>
                <FieldHeader>
                  <FieldLabel>动效曲线</FieldLabel>
                  <FieldValue>{motionNames[motionProfile]}</FieldValue>
                </FieldHeader>
                <SelectShell>
                  <Select
                    value={motionProfile}
                    onChange={(event) => setMotionProfile(event.target.value as MotionProfile)}
                  >
                    <option value="reactive">实时追踪</option>
                    <option value="elastic">弹簧反馈</option>
                    <option value="precise">精准硬切</option>
                  </Select>
                  <SelectArrow aria-hidden="true" />
                </SelectShell>
              </Field>

              <Field>
                <FieldHeader>
                  <FieldLabel>事件通道</FieldLabel>
                  <FieldValue>{channelNames[eventChannel]}</FieldValue>
                </FieldHeader>
                <SelectShell>
                  <Select
                    value={eventChannel}
                    onChange={(event) => setEventChannel(event.target.value as EventChannel)}
                  >
                    <option value="message">普通弹幕</option>
                    <option value="interaction">关注互动</option>
                    <option value="gift">礼物事件</option>
                  </Select>
                  <SelectArrow aria-hidden="true" />
                </SelectShell>
              </Field>

              <Field>
                <FieldHeader>
                  <FieldLabel>消息样本</FieldLabel>
                  <FieldValue>{Array.from(sampleText).length} CHAR</FieldValue>
                </FieldHeader>
                <TextInput
                  value={sampleText}
                  placeholder="输入一条弹幕样本"
                  onChange={(event) => setSampleText(event.target.value)}
                />
              </Field>

              <SwitchRow>
                <SwitchCopy>
                  <strong>悬浮组件渲染</strong>
                  <small>用于测试硬边开关与弹簧方块</small>
                </SwitchCopy>
                <Switch
                  type="button"
                  role="switch"
                  aria-checked={overlayEnabled}
                  data-active={overlayEnabled}
                  onClick={() => setOverlayEnabled((value) => !value)}
                >
                  <SwitchThumb />
                </Switch>
              </SwitchRow>
            </FieldStack>
          </Panel>
        </ControlGrid>
      </Section>

      <Section>
        <SectionHeader>
          <SectionIndex>02</SectionIndex>
          <SectionCopy>
            <SectionTitle>连续数据轨</SectionTitle>
            <SectionCaption>取消独立圆角卡片，用共同边框、分隔线和角标建立节奏。</SectionCaption>
          </SectionCopy>
        </SectionHeader>
        <MetricsStrip>
          <Metric>
            <MetricLabel>DANMAKU / MIN</MetricLabel>
            <MetricValue>128</MetricValue>
            <MetricDelta>▲ 12.4%</MetricDelta>
          </Metric>
          <Metric>
            <MetricLabel>WATCHED</MetricLabel>
            <MetricValue>822</MetricValue>
            <MetricDelta>SESSION LIVE</MetricDelta>
          </Metric>
          <Metric>
            <MetricLabel>LIKES</MetricLabel>
            <MetricValue>17</MetricValue>
            <MetricDelta>▲ 3 NEW</MetricDelta>
          </Metric>
          <Metric>
            <MetricLabel>GPU FRAME</MetricLabel>
            <MetricValue>0.31ms</MetricValue>
            <MetricDelta>WEBGL READY</MetricDelta>
          </Metric>
        </MetricsStrip>
      </Section>

      <Section>
        <SectionHeader>
          <SectionIndex>03</SectionIndex>
          <SectionCopy>
            <SectionTitle>消息与信号反馈</SectionTitle>
            <SectionCaption>聊天保留必要的轻磨砂，结构边界仍以直线和小倒角为主。</SectionCaption>
          </SectionCopy>
        </SectionHeader>
        <PreviewGrid>
          <ChatConsole>
            <ChatRow>
              <Avatar>22</Avatar>
              <ChatContent>
                <ChatMeta><strong>弹幕观测员</strong>03:42</ChatMeta>
                <ChatBubble>{sampleText || "等待弹幕输入…"}</ChatBubble>
              </ChatContent>
            </ChatRow>
            <ChatRow>
              <Avatar>33</Avatar>
              <ChatContent>
                <ChatMeta><strong>系统事件</strong>03:43</ChatMeta>
                <ChatBubble>
                  {eventChannel === "message" && "消息已进入全屏弹幕第一轨。"}
                  {eventChannel === "interaction" && "新的关注互动已进入播报队列。"}
                  {eventChannel === "gift" && "礼物事件已触发高亮样式。"}
                </ChatBubble>
              </ChatContent>
            </ChatRow>
          </ChatConsole>

          <SignalPanel>
            <SignalHeader>
              <span>PARTICLE SIGNAL</span>
              <strong>{overlayEnabled ? "ACTIVE" : "STANDBY"}</strong>
            </SignalHeader>
            <SignalMeter>
              <SignalFill style={signalStyle} />
            </SignalMeter>
            <SignalCode>{`renderer: webgl
source: four-edge perimeter
target: live pointer
density: ${particleDensity}%
motion: ${motionProfile}
overlay: ${overlayEnabled ? "enabled" : "disabled"}`}</SignalCode>
          </SignalPanel>
        </PreviewGrid>
      </Section>

      <Section>
        <SectionHeader>
          <SectionIndex>04</SectionIndex>
          <SectionCopy>
            <SectionTitle>WebGL 光场界面</SectionTitle>
            <SectionCaption>程序化极光、星尘、网格和指针辉光共同组成可交互的视觉层。</SectionCaption>
          </SectionCopy>
        </SectionHeader>
        <WebglSpectralDeck density={particleDensity} onAction={setLastAction} />
      </Section>

      <Section>
        <SectionHeader>
          <SectionIndex>05</SectionIndex>
          <SectionCopy>
            <SectionTitle>弹幕流场预演</SectionTitle>
            <SectionCaption>让 WebGL 负责光场与脉冲，DOM 负责保持昵称和正文的清晰度。</SectionCaption>
          </SectionCopy>
        </SectionHeader>
        <WebglDanmakuFlow
          message={sampleText}
          density={particleDensity}
          channel={channelNames[eventChannel]}
          onAction={setLastAction}
        />
      </Section>

      <FooterNote>
        当前调试参数只存在 React 内存中，不会覆盖正式主题配置。基础控件与光场实验都保持组件化，可按最终选择逐步迁移到直播间、悬浮组件和设置页。
      </FooterNote>
    </Page>
  );
}
