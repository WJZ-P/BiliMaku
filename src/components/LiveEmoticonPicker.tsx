import { styled } from "@linaria/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { getLiveEmoticons } from "../services/liveChat";
import { globalLayers } from "../styles/layers";
import { theme } from "../styles/theme";
import type {
  LiveEmoticon,
  LiveEmoticonCatalog,
  LiveEmoticonPackage,
} from "../types/liveChat";
import { Icon } from "./Icon";

interface LiveEmoticonPickerProps {
  /** 当前活动的真实直播间号；未连接时传入 null。 */
  roomId: number | null;
  /** 未连接等情况下禁止打开表情面板。 */
  disabled?: boolean;
  /** 正在发送弹幕时暂时禁止重复选择。 */
  busy?: boolean;
  /** 文本表情写入当前输入光标位置。 */
  onInsertText: (text: string) => void;
  /** 独立图片表情点击后立即发送，成功时返回 true。 */
  onSendEmoticon: (emoticon: LiveEmoticon) => Promise<boolean>;
}

interface PickerLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

const PANEL_GAP = 8;
const VIEWPORT_GUTTER = 10;
/** 五列放大表情所需宽度；窄窗口仍由 updateLayout 按视口自动收缩。 */
const PANEL_WIDTH = 420;
const PANEL_MAX_HEIGHT = 336;

const Trigger = styled.button`
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textMuted};
  cursor: pointer;
  transition:
    color ${theme.motion.fast},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover:not(:disabled),
  &[aria-expanded="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    background: color-mix(in srgb, ${theme.colors.brandSoft} 58%, transparent);
    color: ${theme.colors.brandDeep};
    transform: scale(1.06);
  }

  &:focus-visible {
    border-color: ${theme.colors.brand};
    box-shadow: 0 0 0 3px color-mix(in srgb, ${theme.colors.brand} 13%, transparent);
  }

  &:active:not(:disabled) {
    transform: scale(0.94);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }
`;

const Panel = styled.section`
  position: fixed;
  z-index: ${globalLayers.popover};
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.prismBorder} 92%, transparent);
  border-radius: 6px;
  background:
    linear-gradient(128deg, color-mix(in srgb, ${theme.colors.highlight} 56%, transparent), transparent 46%),
    radial-gradient(circle at 86% 4%, color-mix(in srgb, ${theme.colors.cyan} 16%, transparent), transparent 35%),
    color-mix(in srgb, ${theme.colors.prismSurfaceStrong} 88%, transparent);
  color: ${theme.colors.textPrimary};
  box-shadow:
    0 18px 44px color-mix(in srgb, ${theme.colors.brandDeep} 20%, transparent),
    inset 0 1px 0 ${theme.colors.prismRim};
  -webkit-backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(1.35) brightness(1.04);
  backdrop-filter: blur(${theme.prismGlass.strongBlur}) saturate(1.35) brightness(1.04);
  transform-origin: 88% 100%;
  animation: bilimaku-emoticon-panel-in 190ms cubic-bezier(0.18, 0.88, 0.26, 1.08) both;

  &[data-positioned="false"] {
    visibility: hidden;
  }

  @keyframes bilimaku-emoticon-panel-in {
    from {
      opacity: 0;
      transform: translateY(7px) scale(0.975);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const Header = styled.header`
  display: flex;
  min-height: 42px;
  align-items: center;
  padding: 8px 11px;
  border-bottom: 1px solid ${theme.colors.prismBorderSoft};
`;

const HeaderText = styled.div`
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
`;

const Title = styled.strong`
  flex: 0 0 auto;
  color: ${theme.colors.textPrimary};
  font-size: ${theme.typography.fontSize.title};
  line-height: 1.25;
`;

const Summary = styled.span`
  min-width: 0;
  color: ${theme.colors.textMuted};
  font-size: ${theme.typography.fontSize.meta};
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Tabs = styled.div`
  display: flex;
  min-width: 0;
  gap: 3px;
  overflow-x: auto;
  padding: 6px 8px;
  border-bottom: 1px solid ${theme.colors.prismBorderSoft};
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabButton = styled.button`
  display: flex;
  min-width: 0;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-family: inherit;
  font-size: ${theme.typography.fontSize.caption};
  font-weight: 700;
  cursor: pointer;
  transition:
    color ${theme.motion.fast},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast};

  &:hover,
  &[aria-selected="true"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 24%, transparent);
    background: color-mix(in srgb, ${theme.colors.brandSoft} 58%, transparent);
    color: ${theme.colors.brandDeep};
  }

  &:focus-visible {
    border-color: ${theme.colors.brand};
  }
`;

const TabCover = styled.img`
  width: 19px;
  height: 19px;
  object-fit: contain;
`;

const Content = styled.div`
  min-height: 150px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 9px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, ${theme.colors.brand} 46%, transparent) transparent;
`;

const EmoticonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px;
`;

const EmoticonButton = styled.button`
  position: relative;
  display: grid;
  min-width: 0;
  height: 81px;
  place-items: center;
  padding: 7px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: 0;
  background: color-mix(in srgb, ${theme.colors.prismSurface} 42%, transparent);
  cursor: pointer;
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    box-shadow ${theme.motion.fast},
    transform ${theme.motion.spring};

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    z-index: 1;
    border-color: color-mix(in srgb, ${theme.colors.brand} 48%, transparent);
    background: color-mix(in srgb, ${theme.colors.brandSoft} 66%, transparent);
    box-shadow: 0 5px 13px color-mix(in srgb, ${theme.colors.brandDeep} 12%, transparent);
    transform: translateY(-2px) scale(1.06);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.94);
  }

  &[data-inline="true"] {
    height: 68px;
  }

  &[data-locked="true"] {
    cursor: not-allowed;
    filter: grayscale(0.52);
    opacity: 0.48;
  }
`;

const EmoticonImage = styled.img`
  display: block;
  width: 57px;
  height: 57px;
  object-fit: contain;
  pointer-events: none;

  [data-inline="true"] & {
    width: 47px;
    height: 47px;
  }
`;

const UnlockLabel = styled.span`
  position: absolute;
  right: 2px;
  bottom: 2px;
  left: 2px;
  overflow: hidden;
  padding: 2px 3px;
  background: color-mix(in srgb, ${theme.colors.surfaceElevated} 84%, transparent);
  color: ${theme.colors.textSecondary};
  font-size: 8px;
  font-weight: 750;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StateMessage = styled.div`
  display: grid;
  min-height: 154px;
  place-items: center;
  padding: 18px;
  color: ${theme.colors.textMuted};
  font-size: ${theme.typography.fontSize.caption};
  font-weight: 650;
  line-height: 1.6;
  text-align: center;
`;

function normalizeImageUrl(url: string) {
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  return url;
}

function countEmoticons(catalog: LiveEmoticonCatalog | null) {
  return catalog?.packages.reduce((total, packageItem) => total + packageItem.emoticons.length, 0) ?? 0;
}

/**
 * 直播发送框内的账号表情入口。
 *
 * 面板使用 Portal 脱离聊天区域的 overflow，目录由 Rust 复用当前 Cookie 读取；
 * pkg_type=3 遵循网页行为插入文本，其余表情使用 dm_type=1 直接发送。
 */
export function LiveEmoticonPicker({
  roomId,
  disabled = false,
  busy = false,
  onInsertText,
  onSendEmoticon,
}: LiveEmoticonPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const requestSequenceRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [catalog, setCatalog] = useState<LiveEmoticonCatalog | null>(null);
  const [activePackageIndex, setActivePackageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendingUnique, setSendingUnique] = useState("");
  const [layout, setLayout] = useState<PickerLayout>({
    left: VIEWPORT_GUTTER,
    top: VIEWPORT_GUTTER,
    width: PANEL_WIDTH,
    maxHeight: PANEL_MAX_HEIGHT,
  });

  const activePackage = catalog?.packages[activePackageIndex];
  const totalEmoticons = useMemo(() => countEmoticons(catalog), [catalog]);

  const loadCatalog = useCallback(async () => {
    const sequence = ++requestSequenceRef.current;
    setLoading(true);
    setError("");
    try {
      const nextCatalog = await getLiveEmoticons();
      if (requestSequenceRef.current !== sequence) return;
      setCatalog(nextCatalog);
      setActivePackageIndex(0);
    } catch (reason) {
      if (requestSequenceRef.current !== sequence) return;
      setCatalog(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestSequenceRef.current === sequence) setLoading(false);
    }
  }, []);

  const updateLayout = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_GUTTER * 2);
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, viewportHeight - VIEWPORT_GUTTER * 2);
    const measuredHeight = Math.min(panel.scrollHeight || maxHeight, maxHeight);
    const availableAbove = triggerRect.top - VIEWPORT_GUTTER - PANEL_GAP;
    const availableBelow = viewportHeight - triggerRect.bottom - VIEWPORT_GUTTER - PANEL_GAP;
    const placeAbove = availableAbove >= Math.min(measuredHeight, 190) || availableAbove >= availableBelow;
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, triggerRect.right - width),
      viewportWidth - width - VIEWPORT_GUTTER,
    );
    const top = placeAbove
      ? Math.max(VIEWPORT_GUTTER, triggerRect.top - PANEL_GAP - measuredHeight)
      : Math.min(triggerRect.bottom + PANEL_GAP, viewportHeight - measuredHeight - VIEWPORT_GUTTER);
    setLayout({ left, top, width, maxHeight });
    setPositioned(true);
  }, []);

  useEffect(() => {
    if (!open || !roomId) return;
    if (catalog?.roomId === roomId) return;
    void loadCatalog();
  }, [catalog?.roomId, loadCatalog, open, roomId]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onViewportChange = () => updateLayout();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updateLayout]);

  useLayoutEffect(() => {
    if (!open) return;
    setPositioned(false);
    updateLayout();
  }, [activePackageIndex, catalog, loading, open, updateLayout]);

  const selectEmoticon = useCallback(async (
    emoticon: LiveEmoticon,
    packageItem: LiveEmoticonPackage,
  ) => {
    if (busy || sendingUnique || (!emoticon.permitted && packageItem.packageType !== 3)) return;
    if (packageItem.packageType === 3) {
      onInsertText(emoticon.description || emoticon.name);
      return;
    }
    setSendingUnique(emoticon.unique);
    try {
      const sent = await onSendEmoticon(emoticon);
      if (sent) setOpen(false);
    } finally {
      setSendingUnique("");
    }
  }, [busy, onInsertText, onSendEmoticon, sendingUnique]);

  const togglePanel = () => {
    if (disabled) return;
    setPositioned(false);
    setOpen((value) => !value);
  };

  const panel = open ? (
    <Panel
      ref={panelRef}
      data-positioned={positioned}
      aria-label="账号直播表情"
      style={{
        left: `${layout.left}px`,
        top: `${layout.top}px`,
        width: `${layout.width}px`,
        maxHeight: `${layout.maxHeight}px`,
      } satisfies CSSProperties}
    >
      <Header>
        <HeaderText>
          <Title>账号表情</Title>
          <Summary>
            {loading ? "正在同步当前账号权限…" : `${catalog?.packages.length ?? 0} 组 · ${totalEmoticons} 个表情`}
          </Summary>
        </HeaderText>
      </Header>

      <Tabs role="tablist" aria-label="表情包">
        {catalog?.packages.map((packageItem, index) => (
          <TabButton
            key={`${packageItem.id}-${packageItem.packageType}-${index}`}
            type="button"
            role="tab"
            aria-selected={activePackageIndex === index}
            onClick={() => setActivePackageIndex(index)}
          >
            {packageItem.coverUrl ? (
              <TabCover
                src={normalizeImageUrl(packageItem.coverUrl)}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <span>{packageItem.name || `表情包 ${index + 1}`}</span>
          </TabButton>
        ))}
      </Tabs>

      <Content aria-live="polite">
        {loading ? (
          <StateMessage>正在通过本地 Cookie 同步这个账号可用的直播表情…</StateMessage>
        ) : error ? (
          <StateMessage>
            <span>{error}</span>
            <Trigger type="button" aria-label="重新读取账号表情" onClick={() => void loadCatalog()}>
              <Icon name="emoji" size={17} />
            </Trigger>
          </StateMessage>
        ) : activePackage?.emoticons.length ? (
          <EmoticonGrid>
            {activePackage.emoticons.map((emoticon, index) => {
              const locked = activePackage.packageType !== 3 && !emoticon.permitted;
              const sending = sendingUnique === emoticon.unique;
              const label = locked
                ? `${emoticon.name || emoticon.description}，${emoticon.unlockText || "当前账号尚未解锁"}`
                : activePackage.packageType === 3
                  ? `插入表情 ${emoticon.name || emoticon.description}`
                  : `发送表情 ${emoticon.name || emoticon.description}`;
              return (
                <EmoticonButton
                  key={`${emoticon.id}-${emoticon.unique}-${index}`}
                  type="button"
                  data-inline={activePackage.packageType === 3}
                  data-locked={locked}
                  disabled={busy || Boolean(sendingUnique) || locked}
                  aria-label={sending ? `正在发送 ${emoticon.name}` : label}
                  onClick={() => void selectEmoticon(emoticon, activePackage)}
                >
                  <EmoticonImage
                    src={normalizeImageUrl(emoticon.imageUrl)}
                    alt=""
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                  {locked ? <UnlockLabel>{emoticon.unlockText || "未解锁"}</UnlockLabel> : null}
                </EmoticonButton>
              );
            })}
          </EmoticonGrid>
        ) : (
          <StateMessage>当前账号在这个直播间没有返回可展示的表情。</StateMessage>
        )}
      </Content>

    </Panel>
  ) : null;

  return (
    <>
      <Trigger
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label="打开账号表情面板"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={togglePanel}
      >
        <Icon name="emoji" size={17} />
      </Trigger>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
