import { styled } from "@linaria/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent } from "react";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import { Icon } from "./Icon";

export interface PrismSelectOption<T extends string> {
  /** 持久化到设置中的稳定值。 */
  value: T;
  /** 下拉菜单中展示的文案。 */
  label: string;
  /** 保留选项但禁止当前选择。 */
  disabled?: boolean;
}

interface PrismSelectProps<T extends string> {
  /** 无障碍读屏使用的字段名称。 */
  ariaLabel: string;
  /** 当前已选中的稳定值。 */
  value: T;
  /** 可以选择的全部项目。 */
  options: readonly PrismSelectOption<T>[];
  /** 整个下拉栏是否禁用。 */
  disabled?: boolean;
  /** 选项变化后回传已经收窄的值类型。 */
  onChange: (value: T) => void;
}

interface MenuLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

const Root = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
`;

const Trigger = styled.button`
  display: flex;
  width: 100%;
  height: 40px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 11px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  border-radius: ${theme.prismGlass.controlRadius};
  outline: 0;
  background:
    linear-gradient(118deg, color-mix(in srgb, ${theme.colors.highlight} 32%, transparent), transparent 52%),
    color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 76%, transparent);
  color: ${theme.colors.textPrimary};
  font-family: inherit;
  font-size: var(--overlay-font-control, 14px);
  font-weight: 690;
  text-align: left;
  box-shadow:
    inset 0 1px 0 ${theme.colors.prismRim},
    0 3px 10px color-mix(in srgb, ${theme.colors.brandDeep} 5%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  backdrop-filter: blur(${theme.prismGlass.blur}) saturate(${theme.prismGlass.saturation});
  cursor: pointer;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover,
  &[data-open="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 58%, ${theme.colors.border});
    background:
      linear-gradient(118deg, color-mix(in srgb, ${theme.colors.highlight} 46%, transparent), transparent 56%),
      color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 90%, transparent);
    box-shadow:
      inset 0 1px 0 ${theme.colors.prismRim},
      0 6px 18px color-mix(in srgb, ${theme.colors.brandDeep} 10%, transparent);
  }

  &:focus-visible {
    border-color: ${theme.colors.brand};
    box-shadow:
      0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 13%, transparent),
      inset 0 1px 0 ${theme.colors.prismRim};
  }

  &:active:not(:disabled) {
    transform: scale(0.992);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }
`;

const TriggerLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Chevron = styled.span`
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: ${theme.colors.textMuted};
  transform: rotate(90deg);
  transition:
    color ${theme.motion.fast},
    transform 190ms cubic-bezier(0.18, 0.9, 0.32, 1.2);

  &[data-open="true"] {
    color: ${theme.colors.brandDeep};
    transform: rotate(-90deg);
  }
`;

const Menu = styled.div`
  position: fixed;
  z-index: ${globalLayers.popover};
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 5px;
  border: 1px solid color-mix(in srgb, ${theme.colors.prismBorder} 88%, transparent);
  border-radius: 5px;
  background:
    linear-gradient(132deg, color-mix(in srgb, ${theme.colors.highlight} 52%, transparent), transparent 48%),
    linear-gradient(180deg, color-mix(in srgb, ${theme.colors.cyanSoft} 30%, transparent), transparent 64%),
    color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 88%, transparent);
  color: ${theme.colors.textPrimary};
  box-shadow:
    0 16px 38px color-mix(in srgb, ${theme.colors.brandDeep} 18%, transparent),
    inset 0 1px 0 ${theme.colors.prismRim},
    inset 0 0 0 1px color-mix(in srgb, ${theme.colors.highlight} 14%, transparent);
  -webkit-backdrop-filter: blur(26px) saturate(1.38) brightness(1.04);
  backdrop-filter: blur(26px) saturate(1.38) brightness(1.04);
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, ${theme.colors.brand} 52%, transparent) transparent;
`;

const OptionButton = styled.button`
  position: relative;
  box-sizing: border-box;
  display: grid;
  width: 100%;
  min-height: 38px;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 10px;
  padding: 7px 9px 7px 11px;
  border: 1px solid transparent;
  border-radius: 3px;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textSecondary};
  font-family: inherit;
  font-size: var(--overlay-font-control, 14px);
  font-weight: 680;
  text-align: left;
  cursor: pointer;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    color ${theme.motion.fast},
    transform ${theme.motion.spring};

  &::before {
    position: absolute;
    top: 7px;
    bottom: 7px;
    left: 0;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(180deg, ${theme.colors.cyan}, ${theme.colors.brand});
    content: "";
    opacity: 0;
    transform: scaleY(0.35);
    transition:
      opacity ${theme.motion.fast},
      transform ${theme.motion.spring};
  }

  &:hover,
  &[data-active="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 20%, transparent);
    background:
      linear-gradient(100deg, color-mix(in srgb, ${theme.colors.brandSoft} 74%, transparent), color-mix(in srgb, ${theme.colors.cyanSoft} 32%, transparent));
    color: ${theme.colors.brandDeep};
    transform: translateX(2px);
  }

  &[aria-selected="true"]::before {
    opacity: 1;
    transform: scaleY(1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;

const OptionLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CheckSlot = styled.span`
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: ${theme.colors.brandDeep};
`;

function findEnabledIndex<T extends string>(
  options: readonly PrismSelectOption<T>[],
  start: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return 0;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset * direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return 0;
}

/**
 * 统一的棱镜玻璃下拉栏。菜单通过 Portal 脱离卡片的 overflow 裁切，
 * 并使用全局 popover 层级，保持低于 Tooltip 与模态窗。
 */
export function PrismSelect<T extends string>({
  ariaLabel,
  value,
  options,
  disabled = false,
  onChange,
}: PrismSelectProps<T>) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [layout, setLayout] = useState<MenuLayout | null>(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setLayout(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const desiredHeight = Math.min(options.length * 38 + 12, 240);
    const below = window.innerHeight - rect.bottom - gap - viewportPadding;
    const above = rect.top - gap - viewportPadding;
    const placement: MenuLayout["placement"] =
      below < Math.min(desiredHeight, 150) && above > below ? "top" : "bottom";
    const available = placement === "top" ? above : below;
    const menuHeight = Math.min(desiredHeight, Math.max(72, available));
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - viewportPadding - width,
    );
    const top = placement === "top"
      ? Math.max(viewportPadding, rect.top - gap - menuHeight)
      : Math.min(window.innerHeight - viewportPadding - menuHeight, rect.bottom + gap);

    setLayout({ left, top, width, maxHeight: menuHeight, placement });
  }, [options.length]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) return;
    const start = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(findEnabledIndex(options, start, 1));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const chooseOption = useCallback((option: PrismSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    closeMenu(true);
  }, [closeMenu, onChange]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeMenu, open, updatePosition]);

  useEffect(() => {
    if (!open || options.length === 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open, options.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => findEnabledIndex(options, current + direction, direction));
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openMenu();
      const start = event.key === "Home" ? 0 : options.length - 1;
      setActiveIndex(findEnabledIndex(options, start, event.key === "Home" ? 1 : -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else if (options[activeIndex]) {
        chooseOption(options[activeIndex]);
      }
    }
  };

  const menuStyle = layout
    ? ({
        left: layout.left,
        top: layout.top,
        width: layout.width,
        maxHeight: layout.maxHeight,
      } satisfies CSSProperties)
    : undefined;

  return (
    <Root ref={rootRef}>
      <Trigger
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        data-open={open}
        disabled={disabled}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <TriggerLabel>{selectedOption?.label ?? "请选择"}</TriggerLabel>
        <Chevron data-open={open}><Icon name="chevron" size={13} /></Chevron>
      </Trigger>

      {open && layout ? createPortal(
        <Menu
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          data-placement={layout.placement}
          style={menuStyle}
        >
          {options.map((option, index) => (
            <OptionButton
              id={`${listboxId}-option-${index}`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              disabled={option.disabled}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                if (!option.disabled) setActiveIndex(index);
              }}
              onClick={() => chooseOption(option)}
            >
              <OptionLabel>{option.label}</OptionLabel>
              <CheckSlot>
                {option.value === value ? <Icon name="check" size={15} /> : null}
              </CheckSlot>
            </OptionButton>
          ))}
        </Menu>,
        document.body,
      ) : null}
    </Root>
  );
}
