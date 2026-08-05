import { styled } from "@linaria/react";
import { Icon } from "./Icon";
import { theme } from "../styles/theme";
import type { AppView } from "../types/navigation";

interface AppHeaderProps {
  activeView: AppView;
}

const viewTitles: Record<AppView, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "LIVE WORKSPACE", title: "晚上好，主播" },
  rules: { eyebrow: "EVENT PIPELINE", title: "弹幕规则" },
  voices: { eyebrow: "VOICE STUDIO", title: "语音角色" },
  connection: { eyebrow: "CONNECTION", title: "连接设置" },
};

const Header = styled.header`
  display: flex;
  min-height: 88px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 30px 14px;
`;

const Eyebrow = styled.div`
  margin-bottom: 3px;
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
`;

const Title = styled.h1`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: clamp(21px, 2vw, 27px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.15;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

const CoreBadge = styled.div`
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, ${theme.colors.surface} 84%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  font-weight: 650;
  box-shadow: ${theme.shadows.inset};
`;

const CoreDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${theme.colors.success};
  box-shadow: 0 0 0 4px ${theme.colors.successSoft};
`;

const IconButton = styled.button`
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid ${theme.colors.border};
  border-radius: 13px;
  background: color-mix(in srgb, ${theme.colors.surface} 88%, transparent);
  color: ${theme.colors.textSecondary};
  box-shadow: ${theme.shadows.inset};
  transition: all ${theme.motion.fast};

  &:hover {
    border-color: ${theme.colors.borderStrong};
    background: ${theme.colors.surface};
    color: ${theme.colors.brand};
    transform: translateY(-1px);
  }
`;

const Notification = styled.span`
  position: absolute;
  top: 7px;
  right: 8px;
  width: 6px;
  height: 6px;
  border: 1px solid ${theme.colors.surface};
  border-radius: 50%;
  background: ${theme.colors.danger};
`;

const Avatar = styled.button`
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 2px solid ${theme.colors.surface};
  border-radius: 14px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 7px 18px color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
`;

export function AppHeader({ activeView }: AppHeaderProps) {
  const copy = viewTitles[activeView];

  return (
    <Header>
      <div>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Title>{copy.title}</Title>
      </div>
      <Actions>
        <CoreBadge>
          <CoreDot />
          Desktop Core Ready
        </CoreBadge>
        <IconButton type="button" aria-label="通知">
          <Icon name="bell" size={18} />
          <Notification />
        </IconButton>
        <IconButton type="button" aria-label="设置">
          <Icon name="settings" size={18} />
        </IconButton>
        <Avatar type="button" aria-label="用户菜单">
          泡
        </Avatar>
      </Actions>
    </Header>
  );
}
