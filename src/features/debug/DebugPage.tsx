import { useState } from "react";
import { Icon } from "../../components/Icon";
import {
  ButtonRow,
  ChatAvatar,
  ChatBubble,
  ChatLine,
  ChatPreview,
  ComponentGrid,
  DanmakuLane,
  DemoButton,
  DemoPanel,
  DemoTitle,
  Description,
  GlassSheet,
  HeaderCopy,
  Hint,
  Kicker,
  LabHeader,
  MetricDemo,
  MetricName,
  MetricRow,
  MetricTrend,
  MetricValue,
  MinimalDiagram,
  Page,
  PixelField,
  PreviewStage,
  Section,
  SectionCaption,
  SectionHeader,
  SectionTitle,
  SelectionPill,
  Tag,
  TagRow,
  Title,
  VariantCard,
  VariantCopy,
  VariantDescription,
  VariantGrid,
  VariantNumber,
  VariantTitle,
} from "./DebugStyles";

type StyleVariant = "glass" | "stream" | "minimal";

interface VariantDefinition {
  /** 内部样式编号。 */
  id: StyleVariant;
  /** 页面展示的方案序号。 */
  number: "A" | "B" | "C";
  /** 方案名称。 */
  title: string;
  /** 适用场景和视觉特征。 */
  description: string;
  /** 用于快速比较的特征标签。 */
  tags: string[];
}

const variants: VariantDefinition[] = [
  {
    id: "glass",
    number: "A",
    title: "流光玻璃",
    description: "轻透背景、柔和折射和弹幕流光，适合作为默认浅蓝主题。",
    tags: ["轻盈", "玻璃", "柔和动效"],
  },
  {
    id: "stream",
    number: "B",
    title: "像素弹幕",
    description: "更硬朗的低圆角轮廓，使用像素微粒和横向弹幕轨迹强调直播属性。",
    tags: ["硬朗", "像素", "辨识度"],
  },
  {
    id: "minimal",
    number: "C",
    title: "轻量仪表",
    description: "克制的线条、清晰的信息层级和很轻的节点动画，适合高密度页面。",
    tags: ["极简", "线框", "信息密度"],
  },
];

const variantNames: Record<StyleVariant, string> = {
  glass: "A · 流光玻璃",
  stream: "B · 像素弹幕",
  minimal: "C · 轻量仪表",
};

function VariantPreview({ variant }: { variant: StyleVariant }) {
  if (variant === "glass") {
    return (
      <PreviewStage>
        <GlassSheet />
        <DanmakuLane data-lane="1">欢迎来到直播间</DanmakuLane>
        <DanmakuLane data-lane="2">这个 UI 好灵动！</DanmakuLane>
        <DanmakuLane data-lane="3">礼物 × 3</DanmakuLane>
      </PreviewStage>
    );
  }

  if (variant === "stream") {
    return (
      <PreviewStage>
        <PixelField>
          {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
        </PixelField>
        <DanmakuLane data-lane="1">PIXEL MESSAGE_01</DanmakuLane>
        <DanmakuLane data-lane="2">DANMAKU ONLINE</DanmakuLane>
      </PreviewStage>
    );
  }

  return (
    <PreviewStage>
      <MinimalDiagram>
        <i />
        <i />
        <i />
      </MinimalDiagram>
    </PreviewStage>
  );
}

/** UI 选型实验页；所有候选组件只依赖统一 Theme 与 Linaria。 */
export function DebugPage() {
  const [selected, setSelected] = useState<StyleVariant>("glass");

  return (
    <Page>
      <LabHeader>
        <HeaderCopy>
          <Kicker>STYLE LAB · BILIMAKU</Kicker>
          <Title>UI 风格实验室</Title>
          <Description>
            先在这里比较容器、信息格、按钮和聊天气泡的视觉语言。选定方案后，再把相同规范铺到直播间与设置页面。
          </Description>
        </HeaderCopy>
        <SelectionPill aria-live="polite">
          <span>当前预选方案</span>
          <strong>{variantNames[selected]}</strong>
        </SelectionPill>
      </LabHeader>

      <Section>
        <SectionHeader>
          <SectionTitle>01 · 整体容器语言</SectionTitle>
          <SectionCaption>点击卡片可记录当前偏好，Hover 查看完整动效。</SectionCaption>
        </SectionHeader>
        <VariantGrid>
          {variants.map((variant) => (
            <VariantCard
              key={variant.id}
              type="button"
              data-variant={variant.id}
              data-selected={selected === variant.id}
              aria-pressed={selected === variant.id}
              onClick={() => setSelected(variant.id)}
            >
              <VariantNumber>{variant.number}</VariantNumber>
              <VariantPreview variant={variant.id} />
              <VariantCopy>
                <VariantTitle>{variant.title}</VariantTitle>
                <VariantDescription>{variant.description}</VariantDescription>
                <TagRow>
                  {variant.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                </TagRow>
              </VariantCopy>
            </VariantCard>
          ))}
        </VariantGrid>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>02 · 数据格与操作按钮</SectionTitle>
          <SectionCaption>标题栏与直播间功能栏会优先复用这一套尺寸和交互节奏。</SectionCaption>
        </SectionHeader>
        <ComponentGrid>
          <DemoPanel>
            <DemoTitle>精细数据格</DemoTitle>
            <MetricRow>
              <MetricDemo>
                <MetricName>硬币余额</MetricName>
                <MetricValue>3,095.7</MetricValue>
                <MetricTrend>账号数据 · 已同步</MetricTrend>
              </MetricDemo>
              <MetricDemo>
                <MetricName>本周观众</MetricName>
                <MetricValue>11.8万</MetricValue>
                <MetricTrend>较上周 +8.4%</MetricTrend>
              </MetricDemo>
              <MetricDemo>
                <MetricName>开播时长</MetricName>
                <MetricValue>12.6h</MetricValue>
                <MetricTrend>本周累计</MetricTrend>
              </MetricDemo>
            </MetricRow>
          </DemoPanel>

          <DemoPanel>
            <DemoTitle>按钮动效</DemoTitle>
            <ButtonRow>
              <DemoButton type="button">
                <Icon name="sparkles" size={13} />
                弹簧玻璃
              </DemoButton>
              <DemoButton type="button" data-kind="stream">
                <Icon name="message" size={13} />
                弹幕粒子
              </DemoButton>
              <DemoButton type="button" data-kind="solid">
                <Icon name="play" size={13} />
                主操作
              </DemoButton>
            </ButtonRow>
            <ChatPreview>
              <ChatLine>
                <ChatAvatar>33</ChatAvatar>
                <ChatBubble>晚上好！这是一条轻量聊天气泡。</ChatBubble>
              </ChatLine>
              <ChatLine data-align="right">
                <ChatBubble>礼物事件可以使用浅蓝强调色。</ChatBubble>
                <ChatAvatar>22</ChatAvatar>
              </ChatLine>
            </ChatPreview>
          </DemoPanel>
        </ComponentGrid>
      </Section>

      <Hint>
        调试页仅承担视觉选型，不写入正式主题配置。你可以直接告诉我选 A、B、C，或者指定“容器选 A、按钮选 B、数据格选 C”进行混搭。
      </Hint>
    </Page>
  );
}