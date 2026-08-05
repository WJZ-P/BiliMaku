import { styled } from "@linaria/react";
import { Icon, type IconName } from "../../components/Icon";
import {
  EyebrowBadge,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelHeading,
  PanelTitle,
  SubtleButton,
} from "../../components/ui";
import { theme } from "../../styles/theme";
import type { AppView } from "../../types/navigation";

interface FeatureConfig {
  icon: IconName;
  kicker: string;
  title: string;
  description: string;
  primaryAction: string;
  modules: Array<{
    icon: IconName;
    title: string;
    description: string;
    status: string;
  }>;
}

interface FeaturePageProps {
  view: Exclude<AppView, "dashboard">;
  onNavigateDashboard: () => void;
}

const configs: Record<Exclude<AppView, "dashboard">, FeatureConfig> = {
  rules: {
    icon: "sliders",
    kicker: "EVENT PIPELINE",
    title: "把嘈杂的直播间，整理成清晰的声音",
    description:
      "规则层只处理标准事件，不关心数据来自开放平台还是 Web 长链。过滤、替换、合并和优先级都可以独立扩展。",
    primaryAction: "新建规则",
    modules: [
      {
        icon: "message",
        title: "文本过滤",
        description: "屏蔽词、重复字符、表情与过长弹幕",
        status: "基础模块",
      },
      {
        icon: "gift",
        title: "事件模板",
        description: "为礼物、SC、舰长分别配置播报文案",
        status: "待配置",
      },
      {
        icon: "clock",
        title: "合并与限流",
        description: "合并连续礼物，并让过期消息自动离队",
        status: "接口就绪",
      },
    ],
  },
  voices: {
    icon: "waveform",
    kicker: "VOICE STUDIO",
    title: "一条统一接口，连接你喜欢的每一种声音",
    description:
      "TTS Adapter 将文本合成、音色枚举、试听与取消任务抽象为稳定接口，后续接入本地或云端引擎时无需改动 UI。",
    primaryAction: "添加音色",
    modules: [
      {
        icon: "sparkles",
        title: "Web Speech",
        description: "当前已接入的系统语音基础播报器",
        status: "已可用",
      },
      {
        icon: "volume",
        title: "GPT-SoVITS",
        description: "面向自定义参考音频与本地推理",
        status: "预留接口",
      },
      {
        icon: "sliders",
        title: "输出设备",
        description: "独立选择监听设备与直播混音设备",
        status: "预留接口",
      },
    ],
  },
  connection: {
    icon: "plug",
    kicker: "CONNECTION ADAPTERS",
    title: "接入方式可替换，业务事件保持一致",
    description:
      "当前桌面端已可仅凭房间 ID 直连 Web 长链；官方开放平台模式继续通过独立 Adapter 接入，让零服务器自用与未来发行模式并存。",
    primaryAction: "返回播报台连接",
    modules: [
      {
        icon: "radio",
        title: "Web Live Adapter",
        description: "WBI 签名、长链鉴权、心跳、解包与自动重连",
        status: "已接入 · 免身份码",
      },
      {
        icon: "shield",
        title: "Open Live Adapter",
        description: "封装 start、heartbeat、end 会话生命周期",
        status: "预留接口",
      },
      {
        icon: "plug",
        title: "连接诊断",
        description: "连接阶段、重连次数、人气值与最近错误统一观测",
        status: "已接入",
      },
    ],
  },
};

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Intro = styled.section`
  position: relative;
  overflow: hidden;
  padding: 30px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};

  &::after {
    position: absolute;
    top: -110px;
    right: -70px;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, ${theme.colors.cyan} 23%, transparent),
      transparent 68%
    );
    content: "";
  }
`;

const IntroIcon = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  width: 48px;
  height: 48px;
  margin-bottom: 19px;
  place-items: center;
  border-radius: 16px;
  background: ${theme.colors.brandSoft};
  color: ${theme.colors.brand};
`;

const IntroKicker = styled.div`
  position: relative;
  z-index: 1;
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.17em;
`;

const IntroTitle = styled.h2`
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin: 7px 0 10px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(25px, 3vw, 38px);
  font-weight: 850;
  letter-spacing: -0.05em;
  line-height: 1.15;
`;

const IntroDescription = styled.p`
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  line-height: 1.75;
`;

const IntroActions = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  gap: 9px;
  margin-top: 22px;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 15px;
  border: 0;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 9px 22px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
  transition: all ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.brandHover};
    transform: translateY(-1px);
  }
`;

const ModuleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
`;

const ModuleCard = styled.article`
  padding: 19px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.lg};
  background: color-mix(in srgb, ${theme.colors.surface} 92%, transparent);
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};
`;

const ModuleTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ModuleIcon = styled.span`
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 13px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
`;

const ModuleTitle = styled.h3`
  margin: 16px 0 6px;
  color: ${theme.colors.textPrimary};
  font-size: 13px;
  font-weight: 800;
`;

const ModuleDescription = styled.p`
  min-height: 45px;
  margin: 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.6;
`;

const ArchitecturePanel = styled(Panel)`
  min-height: 184px;
`;

const ArchitectureBody = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 18px 20px 21px;
`;

const ArchitectureStep = styled.div`
  position: relative;
  padding: 13px;
  border: 1px dashed ${theme.colors.borderStrong};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};

  &::after {
    position: absolute;
    top: 50%;
    right: -8px;
    z-index: 2;
    display: grid;
    width: 16px;
    height: 16px;
    place-items: center;
    border-radius: 50%;
    background: ${theme.colors.surface};
    color: ${theme.colors.borderStrong};
    content: "›";
    font-size: 13px;
    transform: translateY(-50%);
  }

  &:last-child::after {
    display: none;
  }
`;

const StepIndex = styled.div`
  color: ${theme.colors.brand};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 800;
`;

const StepTitle = styled.div`
  margin-top: 5px;
  color: ${theme.colors.textSecondary};
  font-size: 9px;
  font-weight: 750;
`;

export function FeaturePage({ view, onNavigateDashboard }: FeaturePageProps) {
  const config = configs[view];

  return (
    <Page>
      <Intro>
        <IntroIcon>
          <Icon name={config.icon} size={22} />
        </IntroIcon>
        <IntroKicker>{config.kicker}</IntroKicker>
        <IntroTitle>{config.title}</IntroTitle>
        <IntroDescription>{config.description}</IntroDescription>
        <IntroActions>
          <PrimaryButton
            type="button"
            onClick={view === "connection" ? onNavigateDashboard : undefined}
          >
            {config.primaryAction}
            <Icon name="arrow" size={14} />
          </PrimaryButton>
          <SubtleButton type="button">查看接口草案</SubtleButton>
        </IntroActions>
      </Intro>

      <ModuleGrid>
        {config.modules.map((module) => (
          <ModuleCard key={module.title}>
            <ModuleTop>
              <ModuleIcon>
                <Icon name={module.icon} size={18} />
              </ModuleIcon>
              <EyebrowBadge>{module.status}</EyebrowBadge>
            </ModuleTop>
            <ModuleTitle>{module.title}</ModuleTitle>
            <ModuleDescription>{module.description}</ModuleDescription>
          </ModuleCard>
        ))}
      </ModuleGrid>

      <ArchitecturePanel>
        <PanelHeader>
          <PanelHeading>
            <PanelTitle>接口边界</PanelTitle>
            <PanelDescription>每一层只依赖前一层的稳定契约</PanelDescription>
          </PanelHeading>
          <EyebrowBadge>FOUNDATION V0.1</EyebrowBadge>
        </PanelHeader>
        <ArchitectureBody>
          {["输入适配器", "领域模型", "业务编排", "桌面呈现"].map(
            (step, index) => (
              <ArchitectureStep key={step}>
                <StepIndex>0{index + 1}</StepIndex>
                <StepTitle>{step}</StepTitle>
              </ArchitectureStep>
            ),
          )}
        </ArchitectureBody>
      </ArchitecturePanel>
    </Page>
  );
}
