import { styled } from "@linaria/react";
import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { EyebrowBadge, Panel, PanelDescription, PanelHeader, PanelHeading, PanelTitle } from "../../components/ui";
import {
  disconnectLiveRoom,
  getConfigFilePath,
  logoutBilibiliAccount,
} from "../../services/desktop";
import { theme } from "../../styles/theme";
import type { BilibiliLoginStatus } from "../../types/account";

interface SettingsPageProps {
  accountStatus: BilibiliLoginStatus;
  onAccountStatusChange: (status: BilibiliLoginStatus) => void;
}

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Hero = styled.section`
  position: relative;
  display: grid;
  overflow: hidden;
  min-height: 178px;
  grid-template-columns: minmax(0, 1.5fr) minmax(230px, 0.5fr);
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 15%, transparent);
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};

  &::after {
    position: absolute;
    top: -130px;
    right: -55px;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, ${theme.colors.cyan} 32%, transparent), transparent 67%);
    content: "";
  }
`;

const HeroCopy = styled.div`
  position: relative;
  z-index: 1;
  padding: 28px 30px;
`;

const Kicker = styled.div`
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.17em;
`;

const HeroTitle = styled.h2`
  margin: 8px 0 8px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(25px, 3vw, 36px);
  font-weight: 880;
  letter-spacing: -0.05em;
`;

const HeroDescription = styled.p`
  max-width: 680px;
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  line-height: 1.75;
`;

const ThemeOrb = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
`;

const Orb = styled.div`
  display: grid;
  width: 104px;
  height: 104px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 78%, transparent);
  border-radius: 34px 34px 34px 13px;
  background: color-mix(in srgb, ${theme.colors.surface} 65%, transparent);
  color: ${theme.colors.brand};
  box-shadow: ${theme.shadows.floating}, ${theme.shadows.inset};
  backdrop-filter: blur(18px);
  transition: transform ${theme.motion.spring};

  &:hover {
    transform: rotate(5deg) scale(1.06);
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(360px, 1.1fr) minmax(300px, 0.9fr);
  gap: 16px;

  @media (max-width: 1050px) {
    grid-template-columns: 1fr;
  }
`;

const AccountBody = styled.div`
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 24px;
`;

const Avatar = styled.img`
  width: 82px;
  height: 82px;
  border: 4px solid ${theme.colors.surface};
  border-radius: 27px 27px 27px 10px;
  object-fit: cover;
  box-shadow: ${theme.shadows.floating};
`;

const AvatarFallback = styled.div`
  display: grid;
  width: 82px;
  height: 82px;
  place-items: center;
  border-radius: 27px 27px 27px 10px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 25px;
  font-weight: 900;
  box-shadow: ${theme.shadows.floating};
`;

const AccountName = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 17px;
  font-weight: 850;
`;

const AccountUid = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
`;

const SessionState = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  color: ${theme.colors.success};
  font-size: 9px;
  font-weight: 750;
`;

const LogoutButton = styled.button`
  display: inline-flex;
  height: 39px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.danger} 22%, ${theme.colors.border});
  border-radius: 13px;
  background: color-mix(in srgb, ${theme.colors.dangerSoft} 80%, transparent);
  color: ${theme.colors.danger};
  font-size: 10px;
  font-weight: 800;
  transition:
    transform ${theme.motion.spring},
    box-shadow ${theme.motion.normal},
    background ${theme.motion.normal};

  &:hover {
    background: ${theme.colors.dangerSoft};
    box-shadow: 0 9px 22px color-mix(in srgb, ${theme.colors.danger} 16%, transparent);
    transform: translateY(-2px) scale(1.03);
  }

  &:active {
    transform: translateY(1px) scale(0.89);
    transition-duration: 90ms;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
    transform: none;
  }
`;

const ThemeBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 20px;
`;

const ThemeOption = styled.div`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 27%, ${theme.colors.border});
  border-radius: ${theme.radius.md};
  background: ${theme.colors.brandSubtle};
  box-shadow: ${theme.shadows.inset};
`;

const Swatches = styled.div`
  display: grid;
  width: 48px;
  height: 40px;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
  border: 3px solid ${theme.colors.surface};
  border-radius: 13px;
  box-shadow: 0 6px 15px ${theme.colors.shadow};

  span:nth-child(1) { background: ${theme.colors.brand}; }
  span:nth-child(2) { background: ${theme.colors.cyan}; }
  span:nth-child(3) { background: ${theme.colors.brandSoft}; }
  span:nth-child(4) { background: ${theme.colors.surface}; }
`;

const OptionTitle = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
`;

const OptionDescription = styled.div`
  margin-top: 3px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
`;

const Detail = styled.div`
  padding: 11px 12px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.65;
  word-break: break-all;
`;

const ErrorMessage = styled.div`
  padding: 10px 12px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.dangerSoft};
  color: ${theme.colors.danger};
  font-size: 9px;
`;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsPage({ accountStatus, onAccountStatusChange }: SettingsPageProps) {
  const [configPath, setConfigPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profile = accountStatus.profile;

  useEffect(() => {
    let active = true;
    void getConfigFilePath().then((path) => {
      if (active) setConfigPath(path);
    });
    return () => { active = false; };
  }, []);

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await disconnectLiveRoom().catch(() => undefined);
      onAccountStatusChange(await logoutBilibiliAccount());
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Hero>
        <HeroCopy>
          <Kicker>APPLICATION SETTINGS</Kicker>
          <HeroTitle>账号、主题与本地配置</HeroTitle>
          <HeroDescription>
            当前采用浅蓝色默认主题。界面组件只消费语义化 Theme Token，后续加入粉色方案时可以整体切换，无需逐个修改组件。
          </HeroDescription>
        </HeroCopy>
        <ThemeOrb aria-hidden="true"><Orb><Icon name="settings" size={43} /></Orb></ThemeOrb>
      </Hero>

      <Grid>
        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>登录账号</PanelTitle>
              <PanelDescription>{accountStatus.message}</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>{accountStatus.persisted ? "PERSISTED" : "SESSION"}</EyebrowBadge>
          </PanelHeader>
          <AccountBody>
            {profile?.avatar ? (
              <Avatar src={profile.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <AvatarFallback>{profile?.username.slice(0, 1) || "播"}</AvatarFallback>
            )}
            <div>
              <AccountName>{profile?.username || "已登录账号"}</AccountName>
              <AccountUid>UID {profile?.uid || "--"}</AccountUid>
              <SessionState><Icon name="check" size={13} />本地登录态已启用</SessionState>
            </div>
            <LogoutButton type="button" disabled={busy} onClick={() => void logout()}>
              <Icon name="arrow" size={14} />
              {busy ? "正在退出…" : "退出登录"}
            </LogoutButton>
          </AccountBody>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>外观主题</PanelTitle>
              <PanelDescription>统一语义色令牌</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>BLUE DEFAULT</EyebrowBadge>
          </PanelHeader>
          <ThemeBody>
            <ThemeOption>
              <Swatches><span /><span /><span /><span /></Swatches>
              <div>
                <OptionTitle>浅蓝晴空</OptionTitle>
                <OptionDescription>当前默认 · 白色表面 · 浅蓝强调色</OptionDescription>
              </div>
              <Icon name="check" size={17} />
            </ThemeOption>
            <Detail>配置文件：{configPath || "正在读取…"}</Detail>
          </ThemeBody>
        </Panel>
      </Grid>
    </Page>
  );
}
