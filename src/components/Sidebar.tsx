import { styled } from "@linaria/react";
import { Icon } from "./Icon";
import { theme } from "../styles/theme";
import type { AppView, NavigationItem } from "../types/navigation";

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const navigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: "播报台",
    description: "直播概览",
    icon: "dashboard",
  },
  {
    id: "rules",
    label: "弹幕规则",
    description: "过滤与模板",
    icon: "sliders",
  },
  {
    id: "voices",
    label: "语音角色",
    description: "音色与引擎",
    icon: "waveform",
  },
  {
    id: "connection",
    label: "连接设置",
    description: "直播间接入",
    icon: "plug",
  },
];

const Aside = styled.aside`
  position: relative;
  z-index: 3;
  display: flex;
  width: 238px;
  flex: 0 0 238px;
  flex-direction: column;
  min-height: 100vh;
  padding: 24px 18px 18px;
  border-right: 1px solid ${theme.colors.border};
  background: color-mix(in srgb, ${theme.colors.surface} 94%, transparent);
  box-shadow: ${theme.shadows.inset};
  backdrop-filter: blur(18px);

  @media (max-width: 1050px) {
    width: 210px;
    flex-basis: 210px;
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 8px 22px;
`;

const BrandMark = styled.div`
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 70%, transparent);
  border-radius: 15px 15px 15px 7px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  box-shadow: 0 10px 22px color-mix(in srgb, ${theme.colors.brand} 28%, transparent);

  &::before,
  &::after {
    position: absolute;
    top: -5px;
    width: 12px;
    height: 12px;
    border-radius: 3px 8px 3px 8px;
    background: ${theme.colors.brand};
    content: "";
    transform: rotate(45deg);
  }

  &::before {
    left: 7px;
  }

  &::after {
    right: 7px;
  }

  svg {
    position: relative;
    z-index: 1;
  }
`;

const BrandName = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;

  span {
    color: ${theme.colors.brand};
  }
`;

const BrandCaption = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
`;

const SectionLabel = styled.div`
  padding: 7px 12px 9px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
`;

const Nav = styled.nav`
  display: grid;
  gap: 7px;
`;

const NavButton = styled.button`
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 18px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: ${theme.radius.md};
  background: transparent;
  color: ${theme.colors.textSecondary};
  text-align: left;
  transition:
    background ${theme.motion.fast},
    border-color ${theme.motion.fast},
    color ${theme.motion.fast},
    transform ${theme.motion.fast};

  &:hover {
    background: ${theme.colors.brandSubtle};
    color: ${theme.colors.textPrimary};
    transform: translateX(2px);
  }

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 14%, ${theme.colors.border});
    background: ${theme.colors.brandSubtle};
    color: ${theme.colors.brandDeep};
    box-shadow: ${theme.shadows.inset};
  }
`;

const NavIcon = styled.span`
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};

  [data-active="true"] & {
    background: ${theme.colors.brandSoft};
    color: ${theme.colors.brand};
  }
`;

const NavCopy = styled.span`
  min-width: 0;
`;

const NavLabel = styled.span`
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NavDescription = styled.span`
  display: block;
  margin-top: 1px;
  overflow: hidden;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NavChevron = styled.span`
  opacity: 0;
  color: ${theme.colors.brand};
  transform: translateX(-4px);
  transition: all ${theme.motion.fast};

  [data-active="true"] & {
    opacity: 1;
    transform: translateX(0);
  }
`;

const SidebarFooter = styled.div`
  margin-top: auto;
`;

const LocalCard = styled.div`
  padding: 14px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.inset};
`;

const LocalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${theme.colors.success};
  font-size: 12px;
  font-weight: 700;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border: 2px solid ${theme.colors.successSoft};
  border-radius: 50%;
  background: ${theme.colors.success};
  box-shadow: 0 0 0 3px ${theme.colors.successSoft};
`;

const LocalCopy = styled.p`
  margin: 8px 0 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.55;
`;

const Version = styled.div`
  padding: 12px 4px 0;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
  text-align: center;
`;

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <Aside>
      <Brand>
        <BrandMark>
          <Icon name="message" size={22} />
        </BrandMark>
        <div>
          <BrandName>
            Bili<span>Pop</span>
          </BrandName>
          <BrandCaption>哔哩泡泡</BrandCaption>
        </div>
      </Brand>

      <SectionLabel>Workspace</SectionLabel>
      <Nav aria-label="主导航">
        {navigation.map((item) => (
          <NavButton
            key={item.id}
            type="button"
            data-active={activeView === item.id}
            aria-current={activeView === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <NavIcon>
              <Icon name={item.icon} size={18} />
            </NavIcon>
            <NavCopy>
              <NavLabel>{item.label}</NavLabel>
              <NavDescription>{item.description}</NavDescription>
            </NavCopy>
            <NavChevron>
              <Icon name="chevron" size={15} />
            </NavChevron>
          </NavButton>
        ))}
      </Nav>

      <SidebarFooter>
        <LocalCard>
          <LocalHeader>
            <StatusDot />
            本地优先模式
          </LocalHeader>
          <LocalCopy>弹幕长链与语音队列均在本机处理，适配器可按需替换。</LocalCopy>
        </LocalCard>
        <Version>BILICAST DESKTOP · V0.1.0</Version>
      </SidebarFooter>
    </Aside>
  );
}
