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
  createBilibiliLoginQr,
  getBilibiliLoginStatus,
  getConfigFilePath,
  isDesktopRuntime,
  listenToBilibiliAccountEvents,
  logoutBilibiliAccount,
  pollBilibiliLogin,
} from "../../services/desktop";
import { theme } from "../../styles/theme";
import type {
  BilibiliLoginStatus,
  QrLoginTicket,
} from "../../types/account";

interface ConnectionPageProps {
  onNavigateDashboard: () => void;
}

const initialStatus: BilibiliLoginStatus = {
  phase: "checking",
  message: "正在读取账号状态",
  profile: null,
  persisted: false,
  validatedAt: null,
};

const Page = styled.div`
  display: grid;
  gap: 16px;
  padding: 4px 30px 30px;
`;

const Intro = styled.section`
  position: relative;
  display: grid;
  overflow: hidden;
  min-height: 190px;
  grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.55fr);
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 14%, transparent);
  border-radius: ${theme.radius.xl};
  background: ${theme.gradients.soft};
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};

  &::after {
    position: absolute;
    top: -110px;
    right: -30px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, ${theme.colors.cyan} 30%, transparent),
      transparent 68%
    );
    content: "";
  }
`;

const IntroCopy = styled.div`
  position: relative;
  z-index: 1;
  padding: 29px 30px;
`;

const IntroKicker = styled.div`
  color: ${theme.colors.brand};
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.17em;
`;

const IntroTitle = styled.h2`
  max-width: 680px;
  margin: 8px 0 9px;
  color: ${theme.colors.textPrimary};
  font-size: clamp(25px, 3vw, 38px);
  font-weight: 850;
  letter-spacing: -0.05em;
  line-height: 1.15;
`;

const IntroDescription = styled.p`
  max-width: 720px;
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  line-height: 1.75;
`;

const IntroActions = styled.div`
  display: flex;
  gap: 9px;
  margin-top: 20px;
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

  &:disabled {
    cursor: wait;
    opacity: 0.64;
    transform: none;
  }
`;

const IntroVisual = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
`;

const ShieldOrb = styled.div`
  display: grid;
  width: 112px;
  height: 112px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 16%, transparent);
  border-radius: 34px;
  background: color-mix(in srgb, ${theme.colors.surface} 74%, transparent);
  color: ${theme.colors.brand};
  box-shadow: ${theme.shadows.floating}, ${theme.shadows.inset};
  transform: rotate(4deg);

  svg {
    transform: rotate(-4deg);
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(340px, 0.9fr) minmax(0, 1.35fr);
  gap: 16px;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`;

const LoginBody = styled.div`
  display: grid;
  min-height: 360px;
  place-items: center;
  padding: 22px;
`;

const AnonymousCard = styled.div`
  display: grid;
  max-width: 330px;
  justify-items: center;
  text-align: center;
`;

const LoginIcon = styled.div`
  display: grid;
  width: 66px;
  height: 66px;
  place-items: center;
  border-radius: 22px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
`;

const LoginTitle = styled.h3`
  margin: 17px 0 7px;
  color: ${theme.colors.textPrimary};
  font-size: 17px;
  font-weight: 820;
`;

const LoginDescription = styled.p`
  margin: 0 0 19px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  line-height: 1.7;
`;

const QrCard = styled.div`
  display: grid;
  justify-items: center;
  text-align: center;
`;

const QrFrame = styled.div`
  position: relative;
  display: grid;
  width: 232px;
  height: 232px;
  place-items: center;
  overflow: hidden;
  border: 1px solid ${theme.colors.border};
  border-radius: 25px;
  background: ${theme.colors.surface};
  box-shadow: ${theme.shadows.floating}, ${theme.shadows.inset};

  &[data-expired="true"] img {
    filter: blur(3px);
    opacity: 0.28;
  }
`;

const QrImage = styled.img`
  width: 206px;
  height: 206px;
`;

const QrOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, ${theme.colors.surface} 48%, transparent);
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
  backdrop-filter: blur(2px);
`;

const QrStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 700;

  &[data-scanned="true"] {
    color: ${theme.colors.success};
  }
`;

const QrTimer = styled.div`
  margin: 6px 0 14px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
`;

const ProfileCard = styled.div`
  display: grid;
  max-width: 340px;
  justify-items: center;
  text-align: center;
`;

const AvatarWrap = styled.div`
  position: relative;
  width: 92px;
  height: 92px;
`;

const Avatar = styled.img`
  width: 92px;
  height: 92px;
  border: 5px solid ${theme.colors.surface};
  border-radius: 31px;
  object-fit: cover;
  box-shadow: ${theme.shadows.floating};
`;

const AvatarFallback = styled.div`
  display: grid;
  width: 92px;
  height: 92px;
  place-items: center;
  border-radius: 31px;
  background: ${theme.colors.brandSoft};
  color: ${theme.colors.brandDeep};
  font-size: 28px;
  font-weight: 850;
`;

const OnlineBadge = styled.span`
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border: 4px solid ${theme.colors.surface};
  border-radius: 50%;
  background: ${theme.colors.success};
  color: ${theme.colors.textOnBrand};
`;

const ProfileName = styled.h3`
  margin: 18px 0 5px;
  color: ${theme.colors.textPrimary};
  font-size: 18px;
  font-weight: 830;
`;

const ProfileUid = styled.div`
  margin-bottom: 10px;
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 9px;
`;

const SessionNote = styled.div`
  max-width: 300px;
  margin-bottom: 17px;
  padding: 10px 12px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.successSoft};
  color: ${theme.colors.success};
  font-size: 9px;
  font-weight: 650;
  line-height: 1.6;
`;

const ErrorMessage = styled.div`
  margin-top: 12px;
  padding: 9px 11px;
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.dangerSoft};
  color: ${theme.colors.danger};
  font-size: 9px;
  line-height: 1.55;
`;

const AdapterBody = styled.div`
  display: grid;
  gap: 11px;
  padding: 19px 20px 21px;
`;

const AdapterCard = styled.article`
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  background: ${theme.colors.surfaceMuted};

  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.success} 36%, ${theme.colors.border});
    background: color-mix(in srgb, ${theme.colors.successSoft} 58%, ${theme.colors.surface});
  }
`;

const AdapterIcon = styled.div`
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
`;

const AdapterName = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 11px;
  font-weight: 800;
`;

const AdapterDescription = styled.div`
  margin-top: 4px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.5;
`;

const PrivacyNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 4px;
  padding: 12px 13px;
  border: 1px dashed ${theme.colors.borderStrong};
  border-radius: ${theme.radius.sm};
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.65;
`;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function ConnectionPage({ onNavigateDashboard }: ConnectionPageProps) {
  const desktopRuntime = isDesktopRuntime();
  const [status, setStatus] = useState<BilibiliLoginStatus>(initialStatus);
  const [ticket, setTicket] = useState<QrLoginTicket | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configPath, setConfigPath] = useState("");
  const pollBusy = useRef(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenToBilibiliAccountEvents((event) => {
      if (!active) return;
      setStatus(event.status);
      if (["login", "restored", "cookie-expired", "logout"].includes(event.kind)) {
        setTicket(null);
        setRemainingSeconds(0);
      }
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    void getBilibiliLoginStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch((reason) => {
        if (active) setError(errorText(reason));
      });
    void getConfigFilePath().then((path) => {
      if (active) setConfigPath(path);
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!ticket || status.phase === "authenticated" || status.phase === "expired") {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          setStatus({
            phase: "expired",
            message: "二维码已过期，请刷新后重试",
            profile: null,
            persisted: false,
            validatedAt: null,
          });
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status.phase, ticket]);

  useEffect(() => {
    if (!ticket || !["waiting", "scanned"].includes(status.phase)) return;

    let active = true;
    const poll = async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        const nextStatus = await pollBilibiliLogin();
        if (!active) return;
        setStatus(nextStatus);
        setError("");
        if (nextStatus.phase === "authenticated") {
          setTicket(null);
          setRemainingSeconds(0);
        }
      } catch (reason) {
        if (active) setError(errorText(reason));
      } finally {
        pollBusy.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [status.phase, ticket]);

  const startLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const nextTicket = await createBilibiliLoginQr();
      setTicket(nextTicket);
      setRemainingSeconds(nextTicket.expiresInSeconds);
      setStatus({
        phase: "waiting",
        message: "请使用哔哩哔哩客户端扫码",
        profile: null,
        persisted: false,
        validatedAt: null,
      });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      setStatus(await logoutBilibiliAccount());
      setTicket(null);
      setRemainingSeconds(0);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const authenticated = status.phase === "authenticated" && status.profile;
  const expired = status.phase === "expired";
  const checking = status.phase === "checking";

  return (
    <Page>
      <Intro>
        <IntroCopy>
          <IntroKicker>CONNECTION & ACCOUNT</IntroKicker>
          <IntroTitle>扫码建立登录态，再用同一个房间号连接</IntroTitle>
          <IntroDescription>
            登录只改变观看端请求身份，不会获得主播后台权限。连接房间时，Rust
            核心会复用账号 Cookie、真实 UID 与对应长链令牌，方便对照匿名包和登录包的字段差异。
          </IntroDescription>
          <IntroActions>
            <PrimaryButton type="button" onClick={onNavigateDashboard}>
              前往直播间
              <Icon name="arrow" size={14} />
            </PrimaryButton>
            <SubtleButton type="button" onClick={() => void startLogin()} disabled={busy}>
              {authenticated ? "切换账号" : "刷新登录二维码"}
            </SubtleButton>
          </IntroActions>
        </IntroCopy>
        <IntroVisual aria-hidden="true">
          <ShieldOrb>
            <Icon name="shield" size={48} />
          </ShieldOrb>
        </IntroVisual>
      </Intro>

      <ContentGrid>
        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>B 站账号</PanelTitle>
              <PanelDescription>{status.message}</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>
              {authenticated ? (status.persisted ? "PERSISTED" : "SIGNED IN") : checking ? "CHECKING" : "WEB SESSION"}
            </EyebrowBadge>
          </PanelHeader>
          <LoginBody>
            {authenticated ? (
              <ProfileCard>
                <AvatarWrap>
                  {authenticated.avatar ? (
                    <Avatar
                      src={authenticated.avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <AvatarFallback>{authenticated.username.slice(0, 1)}</AvatarFallback>
                  )}
                  <OnlineBadge>
                    <Icon name="check" size={14} />
                  </OnlineBadge>
                </AvatarWrap>
                <ProfileName>{authenticated.username}</ProfileName>
                <ProfileUid>UID {authenticated.uid}</ProfileUid>
                <SessionNote>
                  {status.persisted
                    ? `Cookie 已写入 Rust 统一配置；启动时自动校验${status.validatedAt ? `，最近验证 ${new Date(status.validatedAt * 1000).toLocaleString()}` : ""}。${configPath ? ` 配置：${configPath}` : ""}`
                    : "当前登录态尚未写入统一配置。"}
                </SessionNote>
                <SubtleButton type="button" onClick={() => void logout()} disabled={busy}>
                  退出当前账号
                </SubtleButton>
              </ProfileCard>
            ) : ticket ? (
              <QrCard>
                <QrFrame data-expired={expired}>
                  <QrImage src={ticket.imageDataUrl} alt="B 站扫码登录二维码" />
                  {expired ? <QrOverlay>二维码已过期</QrOverlay> : null}
                </QrFrame>
                <QrStatus data-scanned={status.phase === "scanned"}>
                  <Icon name={status.phase === "scanned" ? "check" : "radio"} size={14} />
                  {status.message}
                </QrStatus>
                <QrTimer>有效时间 {formatCountdown(remainingSeconds)}</QrTimer>
                {expired ? (
                  <PrimaryButton type="button" onClick={() => void startLogin()} disabled={busy}>
                    刷新二维码
                  </PrimaryButton>
                ) : null}
              </QrCard>
            ) : (
              <AnonymousCard>
                <LoginIcon>
                  <Icon name="users" size={30} />
                </LoginIcon>
                <LoginTitle>当前使用匿名观看会话</LoginTitle>
                <LoginDescription>
                  点击后生成 B 站官方扫码链接。手机确认成功后，直播间连接会自动采用登录态 UID。
                </LoginDescription>
                <PrimaryButton
                  type="button"
                  onClick={() => void startLogin()}
                  disabled={busy || !desktopRuntime || checking}
                >
                  <Icon name="shield" size={15} />
                  {busy ? "正在生成…" : "扫码登录 B 站"}
                </PrimaryButton>
              </AnonymousCard>
            )}
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          </LoginBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelHeading>
              <PanelTitle>连接适配器</PanelTitle>
              <PanelDescription>三种身份边界，共用统一 LiveEvent 输出</PanelDescription>
            </PanelHeading>
            <EyebrowBadge>ADAPTER STATUS</EyebrowBadge>
          </PanelHeader>
          <AdapterBody>
            <AdapterCard data-active={!authenticated}>
              <AdapterIcon>
                <Icon name="radio" size={19} />
              </AdapterIcon>
              <div>
                <AdapterName>匿名 Web</AdapterName>
                <AdapterDescription>只填房间号；长链鉴权使用 uid=0</AdapterDescription>
              </div>
              <EyebrowBadge>{authenticated ? "可切换" : "当前"}</EyebrowBadge>
            </AdapterCard>
            <AdapterCard data-active={Boolean(authenticated)}>
              <AdapterIcon>
                <Icon name="users" size={19} />
              </AdapterIcon>
              <div>
                <AdapterName>登录态 Web</AdapterName>
                <AdapterDescription>
                  扫码后仍然只填房间号；复用 Cookie、UID、buvid 与登录态令牌
                </AdapterDescription>
              </div>
              <EyebrowBadge>{authenticated ? "当前" : "待登录"}</EyebrowBadge>
            </AdapterCard>
            <AdapterCard>
              <AdapterIcon>
                <Icon name="shield" size={19} />
              </AdapterIcon>
              <div>
                <AdapterName>OpenLive 官方会话</AdapterName>
                <AdapterDescription>主播身份码与开发者项目凭据；保留为独立适配器</AdapterDescription>
              </div>
              <EyebrowBadge>后续</EyebrowBadge>
            </AdapterCard>
            <PrivacyNote>
              <Icon name="shield" size={16} />
              <span>
                登录态用于读取观看端事件并验证进场字段差异。Cookie 由 Rust 使用
                内存 Store 管理并在变更时写入可编辑 JSON；前端只接收账号资料与登录、恢复、过期、退出等状态事件。
              </span>
            </PrivacyNote>
          </AdapterBody>
        </Panel>
      </ContentGrid>
    </Page>
  );
}
