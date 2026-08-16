import { styled } from "@linaria/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import { Icon } from "./Icon";

export interface ChatMessageContextTarget {
  /** 消息编号，用于在连续打开不同气泡时重置菜单位置。 */
  id: string;
  /** 需要写入 @ 文本的用户昵称。 */
  user: string;
  /** 复制操作使用的原始消息正文。 */
  content: string;
  /** 是否存在可以被 @ 的消息主体。 */
  canMention: boolean;
  /** 右键发生位置的视口横坐标。 */
  clientX: number;
  /** 右键发生位置的视口纵坐标。 */
  clientY: number;
}

interface ChatMessageContextMenuProps {
  /** 当前右键选中的消息；为空时不渲染菜单。 */
  target: ChatMessageContextTarget | null;
  /** 关闭当前菜单。 */
  onClose: () => void;
  /** 将当前用户写入直播弹幕发送框。 */
  onMention: (target: ChatMessageContextTarget) => void;
  /** 将当前消息正文写入系统剪贴板。 */
  onCopy: (target: ChatMessageContextTarget) => void;
}

const VIEWPORT_GAP = 8;

const Menu = styled.div`
  position: fixed;
  z-index: ${globalLayers.popover};
  display: grid;
  min-width: 132px;
  gap: 2px;
  padding: 4px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: ${theme.prismGlass.controlRadius};
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 86%, transparent),
      color-mix(in srgb, ${theme.colors.prismSurface} 80%, transparent)
    );
  box-shadow:
    0 12px 30px ${theme.colors.prismShadow},
    inset 0 1px 0 ${theme.colors.prismRim};
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
  backdrop-filter: blur(${theme.prismGlass.strongBlur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
`;

const MenuAction = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: ${theme.colors.textSecondary};
  cursor: pointer;
  font: 720 ${theme.typography.fontSize.label}/1.2 ${theme.typography.family};
  text-align: left;
  transition:
    color ${theme.motion.fast},
    background-color ${theme.motion.fast};

  &:hover,
  &:focus-visible {
    outline: 0;
    background: color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
    color: ${theme.colors.brandDeep};
  }

  &:disabled {
    background: transparent;
    color: ${theme.colors.textMuted};
    cursor: default;
    opacity: 0.48;
  }
`;

/**
 * 聊天气泡右键菜单。
 *
 * 使用 Portal 和 fixed 定位脱离虚拟列表的行高计算；显示后再按真实尺寸约束到视口内。
 */
export function ChatMessageContextMenu({
  target,
  onClose,
  onMention,
  onCopy,
}: ChatMessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!target) return;
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(
        VIEWPORT_GAP,
        Math.min(target.clientX, window.innerWidth - rect.width - VIEWPORT_GAP),
      ),
      top: Math.max(
        VIEWPORT_GAP,
        Math.min(target.clientY, window.innerHeight - rect.height - VIEWPORT_GAP),
      ),
    });
    firstActionRef.current?.focus({ preventScroll: true });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const closeFromPointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeFromViewportChange = () => onClose();

    document.addEventListener("pointerdown", closeFromPointer, true);
    document.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener("resize", closeFromViewportChange);
    window.addEventListener("blur", closeFromViewportChange);
    window.addEventListener("scroll", closeFromViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener("resize", closeFromViewportChange);
      window.removeEventListener("blur", closeFromViewportChange);
      window.removeEventListener("scroll", closeFromViewportChange, true);
    };
  }, [onClose, target]);

  if (!target) return null;

  return createPortal(
    <Menu
      ref={menuRef}
      role="menu"
      aria-label="消息操作"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MenuAction
        ref={firstActionRef}
        type="button"
        role="menuitem"
        disabled={!target.canMention}
        onClick={() => {
          onMention(target);
          onClose();
        }}
      >
        <Icon name="at" size={15} />
        <span>艾特用户</span>
      </MenuAction>
      <MenuAction
        type="button"
        role="menuitem"
        onClick={() => {
          onCopy(target);
          onClose();
        }}
      >
        <Icon name="copy" size={15} />
        <span>复制消息</span>
      </MenuAction>
    </Menu>,
    document.body,
  );
}
