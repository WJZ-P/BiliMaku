import { styled } from "@linaria/react";
import { useState } from "react";
import { Icon } from "./Icon";
import { ParticleGlowHover } from "./ParticleGlowHover";
import { theme } from "../styles/theme";
import type { AppView, NavigationItem } from "../types/navigation";

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  /** 提前加载即将进入的页面模块，消除首次导航等待。 */
  onPreload?: (view: AppView) => void;
}

const navigation: NavigationItem[] = [
  {
    id: "dashboard",
    label: "直播间",
    description: "实时弹幕",
    icon: "dashboard",
  },
  {
    id: "debug",
    label: "UI 调试",
    description: "组件与动效实验",
    icon: "sparkles",
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
    id: "overlays",
    label: "悬浮组件",
    description: "弹幕与事件层",
    icon: "message",
  },
  {
    id: "connection",
    label: "连接设置",
    description: "直播间接入",
    icon: "plug",
  },
  {
    id: "settings",
    label: "应用设置",
    description: "账号与主题",
    icon: "settings",
  },
];

const Aside = styled.aside`
  position: relative;
  z-index: 3;
  display: flex;
  width: 184px;
  height: 100%;
  min-height: 0;
  flex: 0 0 184px;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 8px 8px;
  border-right: 1px solid ${theme.colors.borderStrong};
  border-radius: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, ${theme.colors.surface} 96%, transparent), color-mix(in srgb, ${theme.colors.canvasAccent} 88%, transparent));
  box-shadow:
    inset -1px 0 0 color-mix(in srgb, ${theme.colors.highlight} 65%, transparent),
    ${theme.shadows.inset};
  backdrop-filter: blur(18px);
  transition:
    width ${theme.motion.sidebarSpring},
    flex-basis ${theme.motion.sidebarSpring},
    padding ${theme.motion.sidebarSpring};

  @media (max-width: 900px) {
    width: 166px;
    flex-basis: 166px;
  }

  &[data-collapsed="true"] {
    width: 60px;
    flex-basis: 60px;
    padding-right: 7px;
    padding-left: 7px;
  }
`;

const Brand = styled.div`
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 4px 10px;

  [data-collapsed="true"] & {
    justify-content: center;
    gap: 0;
    padding-right: 0;
    padding-left: 0;
  }
`;

const BrandMark = styled.div`
  position: relative;
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 70%, transparent);
  border-radius: 2px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  box-shadow: 0 8px 18px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);

  &::before,
  &::after {
    position: absolute;
    top: -4px;
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: ${theme.colors.brand};
    content: "";
    transform: rotate(45deg);
  }

  &::before {
    left: 6px;
  }

  &::after {
    right: 6px;
  }

  svg {
    position: relative;
    z-index: 1;
  }
`;

const BrandText = styled.div`
  min-width: 0;
  overflow: hidden;
  opacity: 1;
  white-space: nowrap;
  transition:
    max-width ${theme.motion.normal},
    opacity ${theme.motion.fast};

  [data-collapsed="true"] & {
    max-width: 0;
    opacity: 0;
    pointer-events: none;
  }
`;

const BrandName = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;

  span {
    color: ${theme.colors.brand};
  }
`;

const BrandCaption = styled.div`
  margin-top: 3px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.06em;
`;

const SectionLabel = styled.div`
  height: 24px;
  padding: 4px 7px 6px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  white-space: nowrap;

  [data-collapsed="true"] & {
    height: 1px;
    margin: 6px 5px 10px;
    padding: 0;
    overflow: hidden;
    background: ${theme.colors.border};
    color: transparent;
    font-size: 0;
  }
`;

const Nav = styled.nav`
  display: grid;
  gap: 4px;
`;

const NavButton = styled.button`
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  min-height: ${theme.sidebarEffects.navigationItemMinHeightPx}px;
  grid-template-columns: ${theme.sidebarEffects.navigationIconSlotSizePx}px minmax(0, 1fr) 14px;
  align-items: center;
  overflow: hidden;
  isolation: isolate;
  padding: 5px 6px;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  background: color-mix(in srgb, ${theme.colors.surface} 42%, transparent);
  color: ${theme.colors.textSecondary};
  text-align: left;
  transition:
    border-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    color ${theme.motion.fast};

  /** 状态机底色层：进入时整层由右向左滑入，离开时原路向右退出。 */
  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, ${theme.colors.brandSubtle} 84%, transparent),
      color-mix(in srgb, ${theme.colors.cyanSoft} 72%, transparent)
    );
    content: "";
    pointer-events: none;
    transform: translate3d(102%, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorExitTransition};
    will-change: transform;
  }

  /** 选中指示条绝对定位，显隐前后都不挤压图标布局。 */
  &::after {
    position: absolute;
    z-index: 2;
    top: 7px;
    bottom: 7px;
    left: 0;
    width: ${theme.sidebarEffects.selectionRailWidthPx}px;
    border-radius: 0 ${theme.radius.pill} ${theme.radius.pill} 0;
    background: ${theme.colors.brand};
    box-shadow: 0 0 8px color-mix(in srgb, ${theme.colors.brand} 45%, transparent);
    content: "";
    opacity: 0;
    pointer-events: none;
    transform: scaleY(0.35);
    transition:
      opacity ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 34%, ${theme.colors.border});
    background: ${theme.colors.brandSubtle};
    box-shadow: ${theme.shadows.inset};
    color: ${theme.colors.brandDeep};
  }

  &[data-active="true"]::after {
    opacity: 1;
    transform: scaleY(1);
  }

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] & {
    border-color: color-mix(in srgb, ${theme.colors.brand} 46%, ${theme.colors.border});
    box-shadow:
      0 6px 18px color-mix(in srgb, ${theme.colors.brand} 12%, transparent),
      ${theme.shadows.inset};
    color: ${theme.colors.textPrimary};
  }

  [data-hover-phase="entering"] &::before,
  [data-hover-phase="active"] &::before {
    transform: translate3d(0, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorEnterTransition};
  }

  [data-hover-phase="exiting"] &::before {
    transform: translate3d(102%, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorExitTransition};
  }

  [data-collapsed="true"] & {
    min-height: ${theme.sidebarEffects.navigationItemMinHeightPx - 6}px;
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      transition: none;
    }
  }
`;
const NavIcon = styled.span`
  display: grid;
  width: 100%;
  min-width: 0;
  justify-self: stretch;
  place-items: center;
  color: ${theme.colors.textMuted};
  pointer-events: none;
  transform: translate3d(var(--sidebar-icon-shift, 0px), 0, 0);
  transition:
    color ${theme.motion.fast},
    filter ${theme.motion.fast},
    transform ${theme.motion.spring};

  svg {
    margin-inline: auto;
  }

  [data-active="true"] & {
    color: ${theme.colors.brand};
  }

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] & {
    color: ${theme.colors.brand};
    filter: drop-shadow(0 2px 5px color-mix(in srgb, ${theme.colors.brand} 24%, transparent));
    transform: translate3d(var(--sidebar-icon-shift, 0px), -1px, 0)
      scale(1.07);
  }
`;
const NavCopy = styled.span`
  min-width: 0;
  overflow: hidden;
  opacity: 1;
  transform: translate3d(var(--sidebar-copy-shift, 0px), 0, 0);
  transition:
    opacity ${theme.motion.fast},
    transform ${theme.motion.spring};

  [data-collapsed="true"] & {
    display: none;
    opacity: 0;
  }
`;

const NavLabel = styled.span`
  display: block;
  overflow: hidden;
  font-size: ${theme.sidebarEffects.navigationLabelFontSize};
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NavDescription = styled.span`
  display: block;
  margin-top: 1px;
  overflow: hidden;
  color: ${theme.colors.textMuted};
  font-size: ${theme.sidebarEffects.navigationDescriptionFontSize};
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

  [data-collapsed="true"] & {
    display: none;
  }
`;

const SidebarFooter = styled.div`
  display: grid;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
`;

const Version = styled.div`
  padding: 2px 4px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  text-align: center;

  [data-collapsed="true"] & {
    display: none;
  }
`;

const CollapseButton = styled.button`
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  min-height: 42px;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  overflow: hidden;
  isolation: isolate;
  padding: 5px 8px;
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  background: color-mix(in srgb, ${theme.colors.surface} 58%, transparent);
  color: ${theme.colors.textSecondary};
  text-align: left;
  transition:
    border-color ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    color ${theme.motion.fast};

  &::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, ${theme.colors.brandSubtle} 86%, transparent),
      color-mix(in srgb, ${theme.colors.cyanSoft} 62%, transparent)
    );
    content: "";
    pointer-events: none;
    transform: translate3d(102%, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorExitTransition};
    will-change: transform;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  [data-hover-phase="entering"] &,
  [data-hover-phase="active"] & {
    border-color: color-mix(in srgb, ${theme.colors.brand} 46%, ${theme.colors.border});
    box-shadow: 0 6px 18px color-mix(in srgb, ${theme.colors.brand} 10%, transparent);
    color: ${theme.colors.brandDeep};
  }

  [data-hover-phase="entering"] &::before,
  [data-hover-phase="active"] &::before {
    transform: translate3d(0, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorEnterTransition};
  }

  [data-hover-phase="exiting"] &::before {
    transform: translate3d(102%, 0, 0);
    transition: transform ${theme.sidebarEffects.hoverColorExitTransition};
  }

  [data-collapsed="true"] & {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 5px;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      transition: none;
    }
  }
`;
const CollapseIcon = styled.span`
  display: grid;
  place-items: center;
  transform: translate3d(var(--sidebar-icon-shift, 0px), 0, 0)
    rotate(180deg);
  transition: transform ${theme.motion.sidebarSpring};

  [data-collapsed="true"] & {
    transform: translate3d(var(--sidebar-icon-shift, 0px), 0, 0) rotate(0deg);
  }
`;

const CollapseLabel = styled.span`
  overflow: hidden;
  font-size: ${theme.sidebarEffects.collapseLabelFontSize};
  transform: translate3d(var(--sidebar-copy-shift, 0px), 0, 0);
  transition: transform ${theme.motion.spring};
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;

  [data-collapsed="true"] & {
    display: none;
  }
`;

export function Sidebar({ activeView, onNavigate, onPreload }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Aside data-collapsed={collapsed}>
      <Brand>
        <BrandMark>
          <Icon name="message" size={20} />
        </BrandMark>
        <BrandText>
          <BrandName>
            Bili<span>Maku</span>
          </BrandName>
          <BrandCaption>哔哩播报</BrandCaption>
        </BrandText>
      </Brand>

      <SectionLabel>Workspace</SectionLabel>
      <Nav id="bilimaku-primary-navigation" aria-label="主导航">
        {navigation.map((item) => (
          <ParticleGlowHover key={item.id}>
            <NavButton
              type="button"
              data-active={activeView === item.id}
              aria-current={activeView === item.id ? "page" : undefined}
              data-tooltip={collapsed ? item.label : undefined}
              data-tooltip-placement={collapsed ? "right" : undefined}
              onPointerEnter={() => onPreload?.(item.id)}
              onPointerDown={() => onPreload?.(item.id)}
              onFocus={() => onPreload?.(item.id)}
              onClick={() => onNavigate(item.id)}
            >
              <NavIcon>
                <Icon
                  name={item.icon}
                  size={theme.sidebarEffects.navigationIconSizePx}
                />
              </NavIcon>
              <NavCopy>
                <NavLabel>{item.label}</NavLabel>
                <NavDescription>{item.description}</NavDescription>
              </NavCopy>
              <NavChevron>
                <Icon name="chevron" size={15} />
              </NavChevron>
            </NavButton>
          </ParticleGlowHover>
        ))}
      </Nav>

      <SidebarFooter>
        <Version>BILIMAKU · V0.1.0</Version>
        <ParticleGlowHover>
          <CollapseButton
            type="button"
            aria-controls="bilimaku-primary-navigation"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            data-tooltip={collapsed ? "展开侧边栏" : "收起侧边栏"}
            data-tooltip-placement="top"
            onClick={() => setCollapsed((value) => !value)}
          >
            <CollapseIcon>
              <Icon
                name="arrow"
                size={theme.sidebarEffects.collapseIconSizePx}
              />
            </CollapseIcon>
            <CollapseLabel>收起侧边栏</CollapseLabel>
          </CollapseButton>
        </ParticleGlowHover>
      </SidebarFooter>
    </Aside>
  );
}
