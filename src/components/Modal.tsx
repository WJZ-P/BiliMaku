import { styled } from "@linaria/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import { Icon } from "./Icon";

/** 模态窗的预设宽度；业务组件只选择语义尺寸，不自行维护像素值。 */
export type ModalSize = "compact" | "medium" | "wide";

export interface ModalProps {
  /** 是否展示模态窗。关闭时会先播放退场动画，再卸载内容。 */
  open: boolean;
  /** 用户点击遮罩、关闭按钮或按下 Escape 时触发。 */
  onClose: () => void;
  /** 模态窗主标题，同时作为无障碍对话框名称。 */
  title: string;
  /** 模态窗内容。 */
  children: ReactNode;
  /** 模态窗的语义宽度，默认 medium。 */
  size?: ModalSize;
  /** 是否允许点击背景遮罩关闭，默认允许。 */
  closeOnBackdrop?: boolean;
  /** 是否保留内容区内边距，默认保留。 */
  padded?: boolean;
  /** 关闭按钮的无障碍文本。 */
  closeLabel?: string;
}

const EXIT_DURATION_MS = 180;
/** 模态窗与视口边缘的默认安全间距；小窗口下仍保留可见留白。 */
const MODAL_VIEWPORT_GUTTER = "clamp(16px, 2.5vw, 28px)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
  }
}

function isFocusableElementVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
}

const Backdrop = styled.div`
  position: fixed;
  z-index: ${globalLayers.modalBackdrop};
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: ${MODAL_VIEWPORT_GUTTER};
  background:
    radial-gradient(
      circle at 50% 28%,
      color-mix(in srgb, ${theme.colors.brandSoft} 20%, transparent),
      transparent 48%
    ),
    color-mix(in srgb, ${theme.colors.scrim} 76%, rgba(11, 31, 54, 0.13));
  -webkit-backdrop-filter: blur(7px) saturate(1.12);
  backdrop-filter: blur(7px) saturate(1.12);
  opacity: 0;
  pointer-events: auto;
  transition: opacity ${EXIT_DURATION_MS}ms ease;

  &[data-visible="true"] {
    opacity: 1;
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 1ms;
  }
`;

const Dialog = styled.section`
  position: relative;
  z-index: ${globalLayers.modal};
  display: flex;
  width: min(680px, 100%);
  max-width: 100%;
  max-height: 100%;
  margin: auto;
  flex-direction: column;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid ${theme.colors.prismBorder};
  border-radius: ${theme.prismGlass.panelRadius};
  background:
    radial-gradient(circle at 12% -10%, color-mix(in srgb, ${theme.colors.highlight} 54%, transparent), transparent 42%),
    linear-gradient(
      142deg,
      color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 82%, ${theme.colors.prismBase}),
      color-mix(in srgb, ${theme.colors.prismBase} 88%, transparent)
    );
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
  backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
  box-shadow:
    0 26px 72px color-mix(in srgb, ${theme.colors.brandDeep} 16%, transparent),
    0 8px 24px ${theme.colors.prismShadow},
    inset 0 1px 0 ${theme.colors.prismRim};
  opacity: 0;
  outline: 0;
  transform: translate3d(0, 14px, 0) scale(0.976);
  transform-origin: center 42%;
  transition:
    opacity ${EXIT_DURATION_MS}ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;

  &[data-size="compact"] {
    width: min(440px, 100%);
  }

  &[data-size="wide"] {
    width: min(940px, 100%);
  }

  &[data-visible="true"] {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  &::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    background:
      radial-gradient(circle at 18% 24%, color-mix(in srgb, ${theme.colors.brand} 12%, transparent), transparent 38%),
      radial-gradient(circle at 78% 72%, color-mix(in srgb, ${theme.colors.cyan} 13%, transparent), transparent 40%),
      linear-gradient(112deg, transparent 14%, color-mix(in srgb, ${theme.colors.highlight} 32%, transparent) 40%, transparent 62%);
    background-position: 0% 18%, 100% 82%, 0% 50%;
    background-size: 138% 138%, 142% 142%, 170% 100%;
    content: "";
    pointer-events: none;
    animation: bilimaku-modal-prism-flow 12s ease-in-out infinite alternate;
  }

  @keyframes bilimaku-modal-prism-flow {
    to {
      background-position: 22% 32%, 76% 58%, 100% 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 1ms;

    &::before {
      animation: none;
    }
  }
`;

const Header = styled.header`
  display: flex;
  min-height: 54px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid ${theme.colors.prismBorderSoft};
  background:
    linear-gradient(112deg, color-mix(in srgb, ${theme.colors.highlight} 38%, transparent), transparent 54%),
    color-mix(in srgb, ${theme.colors.prismSurface} 86%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
`;

const Heading = styled.div`
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 16px;
  font-weight: 830;
  letter-spacing: -0.015em;
`;

const CloseButton = styled.button`
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: ${theme.colors.textMuted};
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: color-mix(in srgb, ${theme.colors.danger} 30%, transparent);
    background: color-mix(in srgb, ${theme.colors.dangerSoft} 70%, transparent);
    color: ${theme.colors.danger};
    transform: scale(1.045);
  }

  &:active {
    transform: scale(0.94);
  }

  &:focus-visible {
    border-color: ${theme.colors.brand};
    outline: 2px solid color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    outline-offset: 1px;
  }
`;

const Body = styled.div`
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, ${theme.colors.highlight} 18%, transparent), transparent 46%),
    color-mix(in srgb, ${theme.colors.prismBase} 48%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  scrollbar-gutter: stable;

  &[data-padded="false"] {
    padding: 0;
  }
`;

/** Suspense 或异步数据请求期间可复用的模态窗占位内容。 */
export const ModalLoading = styled.div`
  display: grid;
  min-height: 260px;
  place-items: center;
  color: ${theme.colors.textMuted};
  font-size: 12px;
  font-weight: 650;
`;

/**
 * 全局通用模态窗。
 *
 * 组件统一处理 Portal、焦点圈定、Escape、遮罩关闭、滚动锁定和退场动画；
 * 业务模块只需要维护 open 状态与实际内容。
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "medium",
  closeOnBackdrop = true,
  padded = true,
  closeLabel = "关闭模态窗",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    let animationFrame = 0;
    let exitTimer = 0;

    if (open) {
      if (!rendered) {
        setRendered(true);
      } else {
        animationFrame = window.requestAnimationFrame(() => setVisible(true));
      }
    } else if (rendered) {
      setVisible(false);
      exitTimer = window.setTimeout(() => setRendered(false), EXIT_DURATION_MS);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
    };
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [rendered]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(isFocusableElementVisible);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [onClose, open]);

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };

  if (!rendered) return null;

  return createPortal(
    <Backdrop
      data-visible={visible}
      onMouseDown={handleBackdropMouseDown}
    >
      <Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-size={size}
        data-visible={visible}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Header>
          <Heading>
            <Title id={titleId}>{title}</Title>
          </Heading>
          <CloseButton type="button" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" size={15} />
          </CloseButton>
        </Header>
        <Body data-padded={padded}>{children}</Body>
      </Dialog>
    </Backdrop>,
    document.body,
  );
}
