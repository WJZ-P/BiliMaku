import { css } from "@linaria/core";
import { styled } from "@linaria/react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { LoginOceanCanvas } from "./LoginOceanCanvas";
import { LOGIN_CHARACTER_ALIGNMENT, LOGIN_CHARACTER_ARTWORKS } from "./loginCharacterArtworks";
import {
  createBilibiliLoginQr,
  isDesktopRuntime,
  pollBilibiliLogin,
} from "../../services/desktop";
import { theme } from "../../styles/theme";
import type { BilibiliLoginStatus, QrLoginTicket } from "../../types/account";

interface LoginPageProps {
  status: BilibiliLoginStatus;
  startupError?: string;
  onStatusChange: (status: BilibiliLoginStatus) => void;
}

type LoginArtworkCssVariables = CSSProperties & {
  readonly "--login-character-left-offset": string;
  readonly "--login-character-right-offset": string;
};

type LoginQrStageCssVariables = CSSProperties & {
  readonly "--login-qr-offset-y": string;
};


/** 人物与二维码共用同一个动画类，确保托举关系在运动中不会错位。 */
const heldAssemblyMotion = css`
  will-change: transform;
  animation: login-held-assembly-float 5.2s ease-in-out -1.1s infinite;

  @keyframes login-held-assembly-float {
    0%, 100% { transform: translate3d(0, 0, 0); }
    38% { transform: translate3d(1px, -4px, 0); }
    68% { transform: translate3d(-1px, -1px, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Page = styled.main`
  position: relative;
  display: grid;
  width: 100%;
  height: calc(100vh - ${theme.layout.compactTitleBarHeight});
  place-items: center;
  overflow: hidden;
  margin-top: ${theme.layout.compactTitleBarHeight};
  padding: 0;
`;

const Card = styled.section`
  --login-qr-size: ${LOGIN_CHARACTER_ALIGNMENT.qrSizePx}px;

  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-rows: minmax(0, 1fr) var(--login-qr-size) minmax(0, 1fr);
  align-items: stretch;
  justify-items: center;
  padding: 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  text-align: center;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
`;

const LoginHeading = styled.div`
  display: grid;
  width: 100%;
  min-height: 0;
  align-self: end;
  justify-items: center;
  padding-bottom: 20px;
`;

const LoginFooter = styled.div`
  display: grid;
  width: 100%;
  min-height: 0;
  align-self: start;
  justify-items: center;
`;

const CharacterArtwork = styled.div`
  position: absolute;
  z-index: 2;
  top: calc(0px - ${theme.layout.compactTitleBarHeight});
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
`;

const CharacterArtworkSide = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  overflow: hidden;
  pointer-events: none;

  &[data-side="left"] {
    left: 0;
  }

  &[data-side="right"] {
    right: 0;
  }
`;

const CharacterArtworkImage = styled.img`
  position: absolute;
  top: 0;
  display: block;
  width: 100vw;
  max-width: none;
  height: 100vh;
  object-fit: cover;
  filter: drop-shadow(0 12px 20px color-mix(in srgb, ${theme.colors.brandDeep} 15%, transparent));
  user-select: none;
  -webkit-user-drag: none;

  &[data-side="left"] {
    left: var(--login-character-left-offset, 0px);
  }

  &[data-side="right"] {
    right: var(--login-character-right-offset, 0px);
  }
`;

const QrStage = styled.div`
  position: relative;
  top: var(--login-qr-offset-y, 0px);
  display: grid;
  width: 100%;
  grid-template-columns: minmax(54px, 1fr) var(--login-qr-size) minmax(54px, 1fr);
  align-items: center;
`;

const LoginTitle = styled.h1`
  display: flex;
  justify-content: center;
  gap: 0.05em;
  margin: 0 0 1px;
  font-size: clamp(36px, 6vw, 48px);
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 0.92;
  text-rendering: geometricPrecision;

  span {
    --letter-flow-angle: 108deg;
    --letter-flow-x: -165%;
    --letter-flow-y: 50%;
    --letter-base-y: 50%;
    --letter-glow-strength: 26%;
    --letter-glow-blur: 10px;
    --letter-brightness: 1;
    --letter-saturation: 1.08;
    --letter-bob-duration: 3.1s;
    --letter-bob-delay: 0s;

    display: inline-block;
    background:
      linear-gradient(
        var(--letter-flow-angle),
        transparent 28%,
        color-mix(in srgb, ${theme.colors.brandDeep} 78%, ${theme.colors.brand}) 38%,
        color-mix(in srgb, ${theme.colors.cyan} 78%, ${theme.colors.brandDeep}) 50%,
        color-mix(in srgb, ${theme.colors.brand} 52%, ${theme.colors.cyan}) 62%,
        transparent 72%
      ),
      linear-gradient(
        180deg,
        ${theme.colors.brandDeep} 0%,
        ${theme.colors.brand} 28%,
        color-mix(in srgb, ${theme.colors.cyan} 36%, ${theme.colors.brand}) 52%,
        ${theme.colors.brand} 72%,
        ${theme.colors.brandDeep} 100%
      );
    background-clip: text;
    background-position:
      var(--letter-flow-x) var(--letter-flow-y),
      50% var(--letter-base-y);
    background-repeat: no-repeat;
    background-size:
      220% 125%,
      100% 230%;
    color: transparent;
    filter:
      brightness(var(--letter-brightness))
      saturate(var(--letter-saturation))
      drop-shadow(0 2px 2px color-mix(in srgb, ${theme.colors.cyan} 18%, transparent))
      drop-shadow(
        0 8px var(--letter-glow-blur)
        color-mix(in srgb, ${theme.colors.brand} var(--letter-glow-strength), transparent)
      );
    transform-origin: 50% 78%;
    will-change: transform, background-position, filter;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    -webkit-text-stroke: 0.75px color-mix(in srgb, ${theme.colors.brandDeep} 72%, transparent);
    paint-order: stroke fill;
    animation: login-title-bob var(--letter-bob-duration) ease-in-out var(--letter-bob-delay) infinite;
  }

  span:nth-child(1) { --letter-bob-duration: 3.2s; --letter-bob-delay: -0.55s; }
  span:nth-child(2) { --letter-bob-duration: 2.85s; --letter-bob-delay: -1.7s; }
  span:nth-child(3) { --letter-bob-duration: 3.65s; --letter-bob-delay: -2.15s; }
  span:nth-child(4) { --letter-bob-duration: 3s; --letter-bob-delay: -0.2s; }
  span:nth-child(5) { --letter-bob-duration: 3.45s; --letter-bob-delay: -2.6s; }
  span:nth-child(6) { --letter-bob-duration: 2.7s; --letter-bob-delay: -1.25s; }
  span:nth-child(7) { --letter-bob-duration: 3.8s; --letter-bob-delay: -3.15s; }
  span:nth-child(8) { --letter-bob-duration: 2.95s; --letter-bob-delay: -2.35s; }

  @keyframes login-title-bob {
    0%, 100% { transform: translateY(1px) rotate(-1deg); }
    45% { transform: translateY(-4px) rotate(1.3deg); }
    70% { transform: translateY(-1px) rotate(0deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    span { animation: none; }
  }
`;

/** 为二维码两侧的人物图层保留布局宽度。 */
const CharacterSlot = styled.div`
  align-self: stretch;
  min-width: 0;
  pointer-events: none;
`;

const QrFrame = styled.div`
  position: relative;
  display: grid;
  width: var(--login-qr-size);
  height: var(--login-qr-size);
  aspect-ratio: 1 / 1;
  place-items: center;
  isolation: isolate;
  overflow: visible;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: ${theme.colors.surface};
  box-shadow: none;

  &::before {
    position: absolute;
    z-index: 4;
    inset: 0;
    padding: 4px;
    border-radius: 2px;
    pointer-events: none;
    content: "";
    background: linear-gradient(
      115deg,
      color-mix(in srgb, ${theme.colors.brand} 90%, ${theme.colors.brandDeep}) 0%,
      color-mix(in srgb, ${theme.colors.brand} 94%, ${theme.colors.cyan}) 28%,
      color-mix(in srgb, ${theme.colors.brand} 84%, ${theme.colors.cyan}) 48%,
      color-mix(in srgb, ${theme.colors.brand} 76%, ${theme.colors.cyan}) 52%,
      color-mix(in srgb, ${theme.colors.brand} 86%, ${theme.colors.cyan}) 58%,
      color-mix(in srgb, ${theme.colors.brand} 94%, ${theme.colors.cyan}) 78%,
      color-mix(in srgb, ${theme.colors.brand} 90%, ${theme.colors.brandDeep}) 100%
    );
    background-position: 28% 50%;
    background-size: 185% 100%;
    box-shadow:
      0 0 4px color-mix(in srgb, ${theme.colors.cyan} 18%, transparent),
      0 0 9px color-mix(in srgb, ${theme.colors.brand} 10%, transparent);
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: login-qr-border-flow 9.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  &[data-expired="true"] img {
    filter: none;
    opacity: 0;
    transform: none;
  }

  @keyframes login-qr-border-flow {
    0%, 100% {
      background-position: 28% 50%;
    }
    50% {
      background-position: 72% 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
      background-position: 50% 50%;
    }
  }
`;

const QrImage = styled.img`
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 0;
  object-fit: contain;
  transition:
    filter ${theme.motion.normal},
    opacity ${theme.motion.normal},
    transform ${theme.motion.spring};
`;

const QrOverlay = styled.div`
  position: absolute;
  z-index: 3;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0;
  background: ${theme.colors.surface};
  color: ${theme.colors.textPrimary};
  font-size: 16px;
  font-weight: 850;
`;

const QrOverlayContent = styled.div`
  display: grid;
  justify-items: center;
  gap: 18px;
`;

const QrOverlayMessage = styled.div`
  color: ${theme.colors.textPrimary};
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.035em;
  line-height: 1.3;
  text-shadow: 0 2px 8px color-mix(in srgb, ${theme.colors.surface} 75%, transparent);
`;

const LoadingArea = styled.div`
  display: grid;
  width: var(--login-qr-size);
  height: var(--login-qr-size);
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
`;

const LoadingRing = styled.div`
  width: 42px;
  height: 42px;
  border: 4px solid ${theme.colors.brandSoft};
  border-top-color: ${theme.colors.brand};
  border-radius: 50%;
  animation: login-ring-spin 850ms linear infinite;

  @keyframes login-ring-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StatusLine = styled.div`
  display: flex;
  min-height: 28px;
  align-items: center;
  margin-top: 12px;
  color: ${theme.colors.textSecondary};
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.015em;

  &[data-scanned="true"] {
    color: ${theme.colors.success};
  }
`;

const ActionButton = styled.button`
  display: inline-flex;
  min-width: 150px;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 0;
  padding: 0 22px;
  border: 1px solid color-mix(in srgb, ${theme.colors.highlight} 75%, transparent);
  border-radius: 9px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0.025em;
  box-shadow: 0 11px 25px color-mix(in srgb, ${theme.colors.brand} 27%, transparent);
  cursor: pointer;
  transform-origin: 50% 72%;
  user-select: none;
  will-change: transform;
  transition:
    transform ${theme.motion.spring},
    border-color ${theme.motion.normal},
    box-shadow ${theme.motion.normal},
    filter ${theme.motion.normal};

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, white 82%, ${theme.colors.highlight});
    box-shadow:
      0 15px 30px color-mix(in srgb, ${theme.colors.brand} 34%, transparent),
      0 3px 8px color-mix(in srgb, white 24%, transparent) inset;
    filter: brightness(1.045) saturate(1.08);
    animation: login-action-button-rotation 480ms cubic-bezier(0.2, 1.4, 0.3, 1) both;
  }

  &:active:not(:disabled) {
    animation: none;
    transform: translateY(1px) rotate(0deg) scale(0.96);
    transition-duration: 90ms;
  }

  &:focus-visible {
    outline: 3px solid color-mix(in srgb, ${theme.colors.cyan} 46%, transparent);
    outline-offset: 3px;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
    animation: none;
    transform: none;
  }

  @keyframes login-action-button-rotation {
    0% {
      transform: translateY(0) rotate(0deg) scale(1);
    }
    36% {
      transform: translateY(-2px) rotate(-1.6deg) scale(1.025);
    }
    68% {
      transform: translateY(-2px) rotate(1.05deg) scale(1.025);
    }
    86% {
      transform: translateY(-2px) rotate(-0.2deg) scale(1.02);
    }
    100% {
      transform: translateY(-2px) rotate(0deg) scale(1.02);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover:not(:disabled) {
      animation: none;
      transform: translateY(-2px) rotate(0deg) scale(1.02);
    }
  }
`;

const ErrorBox = styled.div`
  width: min(100%, 380px);
  margin-top: 7px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.danger} 18%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, ${theme.colors.dangerSoft} 76%, transparent);
  color: ${theme.colors.danger};
  font-size: 9px;
  line-height: 1.55;
`;

function readLoginArtworkViewport() {
  const viewportWidth = typeof window === "undefined"
    ? LOGIN_CHARACTER_ALIGNMENT.canvasWidthPx
    : window.innerWidth;
  const viewportHeight = typeof window === "undefined"
    ? LOGIN_CHARACTER_ALIGNMENT.canvasHeightPx
    : window.innerHeight;
  const scale = Math.max(
    viewportWidth / LOGIN_CHARACTER_ALIGNMENT.canvasWidthPx,
    viewportHeight / LOGIN_CHARACTER_ALIGNMENT.canvasHeightPx,
  );
  const imageLeftPx = (viewportWidth - LOGIN_CHARACTER_ALIGNMENT.canvasWidthPx * scale) / 2;
  const qrLeftPx = (viewportWidth - LOGIN_CHARACTER_ALIGNMENT.qrSizePx) / 2;

  return {
    scale,
    imageLeftPx,
    qrLeftPx,
    qrRightPx: qrLeftPx + LOGIN_CHARACTER_ALIGNMENT.qrSizePx,
  };
}

function useLoginArtworkViewport() {
  const [viewport, setViewport] = useState(readLoginArtworkViewport);

  useEffect(() => {
    const updateViewport = () => setViewport(readLoginArtworkViewport());
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  return viewport;
}

const LOGIN_TITLE_FLOW_PROFILES = [
  { durationSeconds: 2.7, phase: 0.03, direction: 1, driftRate: 0.72 },
  { durationSeconds: 3.25, phase: 0.41, direction: -1, driftRate: 0.86 },
  { durationSeconds: 2.55, phase: 0.68, direction: 1, driftRate: 0.77 },
  { durationSeconds: 3.6, phase: 0.19, direction: -1, driftRate: 0.91 },
  { durationSeconds: 2.9, phase: 0.84, direction: 1, driftRate: 0.69 },
  { durationSeconds: 3.35, phase: 0.52, direction: -1, driftRate: 0.82 },
  { durationSeconds: 2.45, phase: 0.31, direction: 1, driftRate: 0.94 },
  { durationSeconds: 3.1, phase: 0.73, direction: -1, driftRate: 0.75 },
] as const;

/**
 * Drive each letter's sheen directly from requestAnimationFrame. Mutating CSS
 * variables keeps React out of the 60fps path while preserving per-letter motion.
 */
function useLoginTitleFlow() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    const letters = Array.from(title.querySelectorAll<HTMLElement>("[data-login-title-letter]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame: number | null = null;
    let elapsedSeconds = 0;
    let lastTimestamp = 0;

    const setFrame = (letter: HTMLElement, index: number, elapsed: number) => {
      const profile = LOGIN_TITLE_FLOW_PROFILES[index % LOGIN_TITLE_FLOW_PROFILES.length];
      const progress = (elapsed / profile.durationSeconds + profile.phase) % 1;
      // The reset happens while the ribbon is outside the glyph, so the loop stays invisible.
      const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      const signedProgress = profile.direction > 0 ? easedProgress : 1 - easedProgress;
      const flowX = -145 + signedProgress * 290;
      const flowY = 50 + Math.sin(elapsed * profile.driftRate + index * 1.37) * 15;
      const baseY = 50 + Math.sin(elapsed * profile.driftRate * 0.46 + index * 0.91) * 42;
      const flowAngle = 108 + profile.direction * 6 + Math.sin(elapsed * 0.58 + index * 0.74) * 4;
      const glowWave = (Math.sin(elapsed * 1.16 + index * 1.11) + 1) / 2;
      const centerProximity = Math.max(0, 1 - Math.abs(flowX) / 105);
      const brightness = 0.98 + centerProximity * 0.1 + glowWave * 0.015;
      const saturation = 1.08 + centerProximity * 0.18;

      letter.style.setProperty("--letter-flow-x", `${flowX.toFixed(2)}%`);
      letter.style.setProperty("--letter-flow-y", `${flowY.toFixed(2)}%`);
      letter.style.setProperty("--letter-base-y", `${baseY.toFixed(2)}%`);
      letter.style.setProperty("--letter-flow-angle", `${flowAngle.toFixed(2)}deg`);
      letter.style.setProperty("--letter-glow-strength", `${(22 + glowWave * 12).toFixed(2)}%`);
      letter.style.setProperty("--letter-glow-blur", `${(8.5 + glowWave * 3).toFixed(2)}px`);
      letter.style.setProperty("--letter-brightness", brightness.toFixed(3));
      letter.style.setProperty("--letter-saturation", saturation.toFixed(3));
    };

    const paintStaticFrame = () => {
      letters.forEach((letter, index) => setFrame(letter, index, index * 0.31));
    };

    const paintAnimatedFrame = (timestamp: number) => {
      if (lastTimestamp !== 0) {
        // Cap the delta after a hidden-window pause so the sheen resumes without jumping.
        elapsedSeconds += Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      }
      lastTimestamp = timestamp;
      letters.forEach((letter, index) => setFrame(letter, index, elapsedSeconds));
      animationFrame = window.requestAnimationFrame(paintAnimatedFrame);
    };

    const restart = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      lastTimestamp = 0;
      if (reducedMotion.matches) {
        paintStaticFrame();
      } else {
        animationFrame = window.requestAnimationFrame(paintAnimatedFrame);
      }
    };

    reducedMotion.addEventListener("change", restart);
    restart();

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      reducedMotion.removeEventListener("change", restart);
    };
  }, []);

  return titleRef;
}

const EXPIRED_QR_AUTO_REFRESH_DELAY_MS = 420;
const EXPIRED_QR_AUTO_RETRY_DELAY_MS = 3000;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function LoginPage({ status, startupError = "", onStatusChange }: LoginPageProps) {
  const desktopRuntime = isDesktopRuntime();
  const [characterArtwork] = useState(
    () => LOGIN_CHARACTER_ARTWORKS[Math.floor(Math.random() * LOGIN_CHARACTER_ARTWORKS.length)],
  );
  const artworkViewport = useLoginArtworkViewport();
  const titleFlowRef = useLoginTitleFlow();
  const leftArtworkOffsetPx =
    artworkViewport.qrLeftPx
    - (artworkViewport.imageLeftPx + characterArtwork.innerLeftPx * artworkViewport.scale)
    + characterArtwork.centerOffsetPx;
  const rightArtworkOffsetPx =
    artworkViewport.imageLeftPx
    + characterArtwork.innerRightPx * artworkViewport.scale
    - artworkViewport.qrRightPx
    + characterArtwork.centerOffsetPx;
  const characterArtworkStyle: LoginArtworkCssVariables = {
    "--login-character-left-offset": `${leftArtworkOffsetPx}px`,
    "--login-character-right-offset": `${rightArtworkOffsetPx}px`,
  };
  const qrStageStyle: LoginQrStageCssVariables = {
    "--login-qr-offset-y": `${characterArtwork.qrOffsetYPx}px`,
  };
  const [ticket, setTicket] = useState<QrLoginTicket | null>(null);
  const [, setRemainingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const createBusy = useRef(false);
  const pollBusy = useRef(false);

  const startLogin = useCallback(async () => {
    if (!desktopRuntime || createBusy.current) return;
    createBusy.current = true;
    setBusy(true);
    setError("");
    try {
      const nextTicket = await createBilibiliLoginQr();
      setTicket(nextTicket);
      setRemainingSeconds(nextTicket.expiresInSeconds);
      onStatusChange({
        phase: "waiting",
        message: "请扫描二维码登录（￣▽￣）",
        profile: null,
        persisted: false,
        validatedAt: null,
      });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      createBusy.current = false;
      setBusy(false);
    }
  }, [desktopRuntime, onStatusChange]);

  useEffect(() => {
    if (status.phase === "anonymous" && !ticket && !error && desktopRuntime) {
      void startLogin();
    }
  }, [desktopRuntime, error, startLogin, status.phase, ticket]);

  useEffect(() => {
    if (status.phase !== "expired" || !ticket || !desktopRuntime || busy) return;
    const delay = error
      ? EXPIRED_QR_AUTO_RETRY_DELAY_MS
      : EXPIRED_QR_AUTO_REFRESH_DELAY_MS;
    const timer = window.setTimeout(() => {
      void startLogin();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [busy, desktopRuntime, error, startLogin, status.phase, ticket]);

  useEffect(() => {
    if (!ticket || status.phase === "authenticated" || status.phase === "expired") return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds > 1) return seconds - 1;
        onStatusChange({
          phase: "expired",
          message: "二维码已过期，正在自动刷新…",
          profile: null,
          persisted: false,
          validatedAt: null,
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onStatusChange, status.phase, ticket]);

  useEffect(() => {
    if (!ticket || !["waiting", "scanned"].includes(status.phase)) return;
    let active = true;
    const poll = async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        const nextStatus = await pollBilibiliLogin();
        if (active) onStatusChange(nextStatus);
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
  }, [onStatusChange, status.phase, ticket]);

  const expired = status.phase === "expired";
  const displayError = error || startupError || (!desktopRuntime ? "请从 BiliMaku 桌面窗口完成扫码登录" : "");
  const statusMessage = busy
    ? "正在生成二维码…"
    : status.phase === "waiting"
      ? "请扫描二维码登录（￣▽￣）"
      : status.phase === "expired"
        ? "二维码已过期，正在自动刷新…"
        : status.message;

  return (
    <Page>
      <LoginOceanCanvas />
      <CharacterArtwork
        className={heldAssemblyMotion}
        style={characterArtworkStyle}
        data-artwork-id={characterArtwork.id}
        aria-hidden="true"
      >
        <CharacterArtworkSide data-side="left">
          <CharacterArtworkImage data-side="left" src={characterArtwork.src} alt="" draggable={false} />
        </CharacterArtworkSide>
        <CharacterArtworkSide data-side="right">
          <CharacterArtworkImage data-side="right" src={characterArtwork.src} alt="" draggable={false} />
        </CharacterArtworkSide>
      </CharacterArtwork>
      <Card>
        <LoginHeading>
          <LoginTitle ref={titleFlowRef} aria-label="BiliMaku">
            {Array.from("BiliMaku").map((character, index) => (
              <span data-login-title-letter key={`${character}-${index}`} aria-hidden="true">{character}</span>
            ))}
          </LoginTitle>
        </LoginHeading>
        <QrStage className={heldAssemblyMotion} style={qrStageStyle}>
          <CharacterSlot data-character-slot="22" aria-hidden="true" />
          {ticket ? (
            <QrFrame data-expired={expired}>
              <QrImage src={ticket.imageDataUrl} alt="哔哩哔哩扫码登录二维码" />
              {expired ? (
                <QrOverlay aria-live="polite">
                  <LoadingRing aria-label="二维码已过期，正在自动刷新…" />
                </QrOverlay>
              ) : null}
            </QrFrame>
          ) : (
            <LoadingArea>
              {displayError ? (
                <QrOverlayContent>
                  <QrOverlayMessage>二维码暂未就绪</QrOverlayMessage>
                  <ActionButton type="button" disabled={busy || !desktopRuntime} onClick={() => void startLogin()}>
                    <Icon name="radio" size={18} />
                    重新获取二维码
                  </ActionButton>
                </QrOverlayContent>
              ) : (
                <LoadingRing aria-label="正在准备登录二维码" />
              )}
            </LoadingArea>
          )}
          <CharacterSlot data-character-slot="33" aria-hidden="true" />
        </QrStage>

        <LoginFooter>
          <StatusLine data-scanned={status.phase === "scanned"}>
            {statusMessage}
          </StatusLine>
          {displayError ? <ErrorBox>{displayError}</ErrorBox> : null}
        </LoginFooter>
      </Card>
    </Page>
  );
}
