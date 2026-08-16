import { styled } from "@linaria/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import { LiquidGlassSurface } from "./LiquidGlassSurface";

type TooltipPlacement = "auto" | "top" | "right" | "bottom" | "left";
type ResolvedTooltipPlacement = Exclude<TooltipPlacement, "auto">;

interface TooltipRequest {
  sequence: number;
  target: HTMLElement;
  text: string;
  placement: TooltipPlacement;
}

interface TooltipPosition {
  x: number;
  y: number;
  arrowX: number;
  arrowY: number;
  placement: ResolvedTooltipPlacement;
}

type TooltipCssVariables = CSSProperties & {
  "--tooltip-x": string;
  "--tooltip-y": string;
  "--tooltip-arrow-x": string;
  "--tooltip-arrow-y": string;
};

const TooltipShell = styled.div`
  position: fixed;
  z-index: ${globalLayers.tooltip};
  top: var(--tooltip-y);
  left: var(--tooltip-x);
  max-width: min(320px, calc(100vw - 20px));
  /* 此父层不能添加 opacity/filter/will-change，否则会截断子层的背景采样。 */
  visibility: hidden;
  pointer-events: none;

  &[data-present="true"] {
    visibility: visible;
  }
`;

/**
 * 动画与 backdrop-filter 共用同一节点，避免额外的透明合成父层截断
 * WebView2 对页面背景的采样。
 */
const GlassBody = styled.div`
  position: relative;
  z-index: 2;
  min-width: 44px;
  opacity: 0;
  transform: translate3d(0, ${theme.tooltip.entranceOffsetPx}px, 0);
  will-change: opacity, transform;
  overflow: hidden;
  padding: 4px 6px;
  border: 1px solid ${theme.colors.prismBorder};
  border-radius: ${theme.tooltip.radius};
  background:
    radial-gradient(circle at 16% 0%, color-mix(in srgb, ${theme.colors.highlight} 46%, transparent), transparent 52%),
    linear-gradient(145deg, color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 78%, transparent), color-mix(in srgb, ${theme.colors.prismSurface} 82%, transparent));
  box-shadow:
    0 14px 34px color-mix(in srgb, ${theme.colors.brandDeep} 12%, transparent),
    0 3px 12px ${theme.colors.prismShadow},
    inset 0 1px 0 ${theme.colors.prismRim},
    inset 0 -1px 0 color-mix(in srgb, ${theme.colors.brand} 8%, transparent);
  -webkit-backdrop-filter: blur(${theme.prismGlass.blur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});
  backdrop-filter: blur(${theme.prismGlass.blur})
    saturate(${theme.prismGlass.saturation})
    brightness(${theme.prismGlass.brightness});

  &::before {
    position: absolute;
    z-index: 0;
    top: -72%;
    left: -18%;
    width: 42%;
    height: 250%;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, ${theme.colors.highlight} 28%, transparent),
      transparent
    );
    content: "";
    opacity: 0.12;
    transform: rotate(19deg);
  }

  &::after {
    position: absolute;
    z-index: 0;
    inset: 0;
    background-image:
      radial-gradient(circle at 14% 18%, color-mix(in srgb, ${theme.colors.highlight} 28%, transparent) 0 0.6px, transparent 0.9px),
      radial-gradient(circle at 73% 62%, color-mix(in srgb, ${theme.colors.brand} 10%, transparent) 0 0.5px, transparent 0.9px);
    background-position: 0 0, 2px 3px;
    background-size: 5px 5px, 7px 7px;
    content: "";
    opacity: 0.13;
  }
`;

const TooltipText = styled.span`
  position: relative;
  z-index: 1;
  display: block;
  color: ${theme.colors.textPrimary};
  font-size: ${theme.tooltip.fontSize};
  font-weight: ${theme.tooltip.fontWeight};
  letter-spacing: 0.008em;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-align: left;
  white-space: pre-line;
`;

const GlassAccent = styled.span`
  position: absolute;
  z-index: 3;
  top: 5px;
  left: 8px;
  width: 16px;
  height: 1px;
  border-radius: ${theme.radius.pill};
  background: linear-gradient(90deg, ${theme.colors.cyan}, transparent);
  box-shadow: 0 0 7px color-mix(in srgb, ${theme.colors.cyan} 32%, transparent);
  opacity: 0.5;
`;

const TooltipArrow = styled.span`
  position: absolute;
  z-index: 1;
  width: 9px;
  height: 9px;
  border: 1px solid ${theme.colors.prismBorderSoft};
  background: ${theme.colors.prismSurface};
  box-shadow: 2px 2px 6px color-mix(in srgb, ${theme.colors.shadowStrong} 12%, transparent);
  opacity: 0;
  backdrop-filter: blur(8px) saturate(1.3);
  transform: rotate(45deg);
  transition: opacity ${theme.motion.fast};

  [data-visible="true"] & {
    opacity: 0.72;
    transition-delay: 90ms;
  }

  [data-placement="top"] & {
    bottom: -4px;
    left: var(--tooltip-arrow-x);
    border-top: 0;
    border-left: 0;
    transform: translateX(-50%) rotate(45deg);
  }

  [data-placement="bottom"] & {
    top: -4px;
    left: var(--tooltip-arrow-x);
    border-right: 0;
    border-bottom: 0;
    transform: translateX(-50%) rotate(45deg);
  }

  [data-placement="left"] & {
    top: var(--tooltip-arrow-y);
    right: -4px;
    border-bottom: 0;
    border-left: 0;
    transform: translateY(-50%) rotate(45deg);
  }

  [data-placement="right"] & {
    top: var(--tooltip-arrow-y);
    left: -4px;
    border-top: 0;
    border-right: 0;
    transform: translateY(-50%) rotate(45deg);
  }
`;

const DEFAULT_POSITION: TooltipPosition = {
  x: -10_000,
  y: -10_000,
  arrowX: 20,
  arrowY: 20,
  placement: "top",
};

function tooltipTarget(eventTarget: EventTarget | null) {
  return eventTarget instanceof Element
    ? eventTarget.closest<HTMLElement>("[data-tooltip]")
    : null;
}

function tooltipPlacement(value: string | undefined): TooltipPlacement {
  return value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
    ? value
    : "auto";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function tooltipSpringValue(progress: number) {
  if (progress >= 1) return 1;
  const damping = theme.tooltip.entranceSpringDamping;
  const frequency = theme.tooltip.entranceSpringFrequency;
  return 1 - Math.exp(-damping * progress) *
    (Math.cos(frequency * progress) + 0.24 * Math.sin(frequency * progress));
}

function tooltipEntranceKeyframes(): Keyframe[] {
  const frames = 36;
  const distance = theme.tooltip.entranceOffsetPx;

  return Array.from({ length: frames }, (_, index) => {
    const progress = index / (frames - 1);
    const spring = tooltipSpringValue(progress);
    const fadeProgress = clamp(
      progress / theme.tooltip.entranceFadePortion,
      0,
      1,
    );
    const opacity = 1 - Math.pow(1 - fadeProgress, 3);
    const translateY = distance * (1 - spring);

    return {
      offset: progress,
      opacity,
      transform: `translate3d(0, ${translateY.toFixed(3)}px, 0)`,
    };
  });
}

function calculatePosition(
  target: HTMLElement,
  tooltip: HTMLElement,
  preferred: TooltipPlacement,
): TooltipPosition {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const edge = 10;
  const gap = 11;
  const available = {
    top: targetRect.top,
    right: viewportWidth - targetRect.right,
    bottom: viewportHeight - targetRect.bottom,
    left: targetRect.left,
  };

  let placement: ResolvedTooltipPlacement;
  if (preferred !== "auto") {
    placement = preferred;
  } else if (available.top >= tooltipRect.height + gap) {
    placement = "top";
  } else if (available.bottom >= tooltipRect.height + gap) {
    placement = "bottom";
  } else if (available.right >= tooltipRect.width + gap) {
    placement = "right";
  } else {
    placement = "left";
  }

  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;
  let x = centerX - tooltipRect.width / 2;
  let y = centerY - tooltipRect.height / 2;

  if (placement === "top") y = targetRect.top - tooltipRect.height - gap;
  if (placement === "bottom") y = targetRect.bottom + gap;
  if (placement === "left") x = targetRect.left - tooltipRect.width - gap;
  if (placement === "right") x = targetRect.right + gap;

  x = clamp(x, edge, viewportWidth - tooltipRect.width - edge);
  y = clamp(y, edge, viewportHeight - tooltipRect.height - edge);

  return {
    x: Math.round(x),
    y: Math.round(y),
    arrowX: Math.round(clamp(centerX - x, 13, tooltipRect.width - 13)),
    arrowY: Math.round(clamp(centerY - y, 13, tooltipRect.height - 13)),
    placement,
  };
}

/**
 * 全局磨砂玻璃 Tooltip 图层。
 *
 * 交互元素只需提供 `data-tooltip`，即可避开浏览器原生 title 提示。
 * 可选的 `data-tooltip-placement` 支持 top/right/bottom/left，默认自动避让窗口边缘。
 */
export function FrostedTooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const entranceAnimationRef = useRef<Animation | null>(null);
  const exitAnimationRef = useRef<Animation | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const requestSequenceRef = useRef(0);
  const showTimerRef = useRef<number | undefined>(undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const [request, setRequest] = useState<TooltipRequest | null>(null);
  const [position, setPosition] = useState<TooltipPosition>(DEFAULT_POSITION);
  const [visible, setVisible] = useState(false);

  const clearShowTimer = () => {
    if (showTimerRef.current !== undefined) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = undefined;
    }
  };
  const clearHideTimer = () => {
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  };

  const updatePosition = useCallback(() => {
    if (!request || !tooltipRef.current || !request.target.isConnected) return;
    setPosition(calculatePosition(request.target, tooltipRef.current, request.placement));
  }, [request]);

  useLayoutEffect(() => {
    if (!request) return;
    updatePosition();
    setVisible(true);
  }, [request, updatePosition]);

  useLayoutEffect(() => {
    const motion = motionRef.current;
    if (!request || !motion) return;

    entranceAnimationRef.current?.cancel();
    exitAnimationRef.current?.cancel();
    exitAnimationRef.current = null;
    motion.style.removeProperty("opacity");
    motion.style.removeProperty("transform");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      motion.style.opacity = "1";
      motion.style.transform = "translate3d(0, 0, 0)";
      return () => {
        motion.style.removeProperty("opacity");
        motion.style.removeProperty("transform");
      };
    }

    const animation = motion.animate(tooltipEntranceKeyframes(), {
      duration: theme.tooltip.entranceDurationMs,
      easing: "linear",
      fill: "both",
    });
    entranceAnimationRef.current = animation;

    return () => {
      animation.cancel();
      if (entranceAnimationRef.current === animation) {
        entranceAnimationRef.current = null;
      }
    };
  }, [request?.sequence]);

  useEffect(() => {
    if (!request) return;
    const refresh = () => updatePosition();
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [request, updatePosition]);

  useEffect(() => {
    const show = (target: HTMLElement, immediate: boolean) => {
      const text = target.dataset.tooltip?.trim();
      if (!text || target.dataset.tooltipDisabled === "true") return;
      clearShowTimer();
      clearHideTimer();
      activeTargetRef.current = target;
      const configuredDelay = Number(target.dataset.tooltipDelay);
      const delay = immediate
        ? 60
        : Number.isFinite(configuredDelay)
          ? Math.max(0, configuredDelay)
          : theme.tooltip.showDelayMs;
      showTimerRef.current = window.setTimeout(() => {
        if (activeTargetRef.current !== target || !target.isConnected) return;
        exitAnimationRef.current?.cancel();
        exitAnimationRef.current = null;
        setVisible(false);
        setPosition(DEFAULT_POSITION);
        setRequest({
          sequence: ++requestSequenceRef.current,
          target,
          text,
          placement: tooltipPlacement(target.dataset.tooltipPlacement),
        });
      }, delay);
    };

    const hide = (target: HTMLElement) => {
      if (activeTargetRef.current !== target) return;
      activeTargetRef.current = null;
      clearShowTimer();
      clearHideTimer();
      setVisible(false);
      const motion = motionRef.current;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const computed = motion ? window.getComputedStyle(motion) : null;
      const sampledOpacity = computed ? Number.parseFloat(computed.opacity) : 1;
      const sampledTransform = computed && computed.transform !== "none"
        ? computed.transform
        : "translate3d(0, 0, 0)";

      entranceAnimationRef.current?.cancel();
      entranceAnimationRef.current = null;
      exitAnimationRef.current?.cancel();
      exitAnimationRef.current = null;

      if (motion && !reducedMotion) {
        const animation = motion.animate(
          [
            {
              opacity: Number.isFinite(sampledOpacity) ? sampledOpacity : 1,
              transform: sampledTransform,
            },
            {
              opacity: 0,
              transform: `translate3d(0, ${theme.tooltip.exitOffsetPx}px, 0)`,
            },
          ],
          {
            duration: theme.tooltip.exitDurationMs,
            easing: "cubic-bezier(0.4, 0, 1, 1)",
            fill: "forwards",
          },
        );
        exitAnimationRef.current = animation;
      }

      hideTimerRef.current = window.setTimeout(() => {
        exitAnimationRef.current?.cancel();
        exitAnimationRef.current = null;
        setRequest(null);
      }, reducedMotion ? 0 : theme.tooltip.exitDurationMs);
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = tooltipTarget(event.target);
      if (!target) return;
      if (activeTargetRef.current === target) {
        clearHideTimer();
        return;
      }
      show(target, false);
    };
    const onPointerOut = (event: PointerEvent) => {
      const target = tooltipTarget(event.target);
      if (!target) return;
      if (
        event.relatedTarget instanceof Node &&
        target.contains(event.relatedTarget)
      ) {
        return;
      }
      hide(target);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      if (target) show(target, true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      if (!target) return;
      if (
        event.relatedTarget instanceof Node &&
        target.contains(event.relatedTarget)
      ) {
        return;
      }
      hide(target);
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      clearShowTimer();
      clearHideTimer();
      entranceAnimationRef.current?.cancel();
      exitAnimationRef.current?.cancel();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const style: TooltipCssVariables = {
    "--tooltip-x": `${position.x}px`,
    "--tooltip-y": `${position.y}px`,
    "--tooltip-arrow-x": `${position.arrowX}px`,
    "--tooltip-arrow-y": `${position.arrowY}px`,
  };

  return (
    <TooltipShell
      id="bilimaku-frosted-tooltip"
      ref={tooltipRef}
      role="tooltip"
      aria-hidden={!request || !visible}
      data-present={Boolean(request)}
      data-visible={Boolean(request && visible)}
      data-placement={position.placement}
      style={style}
    >
      <GlassBody ref={motionRef}>
        <LiquidGlassSurface
          active={request !== null}
          animationKey={request?.sequence ?? 0}
        />
        <GlassAccent aria-hidden="true" />
        <TooltipText>{request?.text ?? ""}</TooltipText>
      </GlassBody>
      <TooltipArrow aria-hidden="true" />
    </TooltipShell>
  );
}
