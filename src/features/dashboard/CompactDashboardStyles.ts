import { styled } from "@linaria/react";
import { theme } from "../../styles/theme";

/** 直播间页根节点；锁定在工作台可用高度内，避免出现双层滚动条。 */
export const Page = styled.section`
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 10px 12px 12px;
  overflow: hidden;
`;

/** 中央聊天区与右侧功能栏组成的紧凑双列布局。 */
export const DashboardShell = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 78px;
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr) 70px;
    gap: 8px;
  }
`;

export const ChatPanel = styled.section`
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 12px;
  background: color-mix(in srgb, ${theme.colors.surface} 90%, transparent);
  box-shadow:
    0 12px 34px color-mix(in srgb, ${theme.colors.brandDeep} 9%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 76%, transparent);
  backdrop-filter: blur(20px) saturate(1.25);
`;

export const ChatHeader = styled.header`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 8px;
  border-bottom: 1px solid ${theme.colors.border};
  background: color-mix(in srgb, ${theme.colors.surface} 78%, transparent);

  @media (max-width: 760px) {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }
`;

export const RoomIdentity = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 8px;
`;

/** 直播间封面按源图 720×540 的 4:3 比例缩放为十分之一。 */
export const RoomCover = styled.span`
  position: relative;
  display: grid;
  width: 72px;
  height: 54px;
  flex: 0 0 72px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 25%, ${theme.colors.border});
  border-radius: 4px;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  box-shadow:
    0 4px 12px color-mix(in srgb, ${theme.colors.brandDeep} 10%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 74%, transparent);

  &[data-state="connecting"],
  &[data-state="reconnecting"] {
    border-color: ${theme.colors.brandSoft};
    color: ${theme.colors.brand};
  }

  &[data-state="connected"] {
    border-color: color-mix(in srgb, ${theme.colors.brand} 40%, ${theme.colors.border});
    color: ${theme.colors.brandDeep};
  }

  &[data-state="error"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 42%, ${theme.colors.border});
    color: ${theme.colors.danger};
  }
`;

export const RoomCoverFallback = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 72% 22%, color-mix(in srgb, ${theme.colors.cyan} 24%, transparent), transparent 42%),
    linear-gradient(145deg, ${theme.colors.brandSubtle}, ${theme.colors.surfaceMuted});
`;

export const RoomCoverImage = styled.img`
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: bilimaku-room-cover-in 220ms ease-out both;

  @keyframes bilimaku-room-cover-in {
    from {
      opacity: 0;
      transform: scale(1.04);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
export const RoomCopy = styled.div`
  min-width: 0;
`;

export const RoomTitle = styled.h2`
  overflow: hidden;
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 14px;
  font-weight: 820;
  letter-spacing: -0.015em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const RoomCaption = styled.p`
  overflow: hidden;
  margin: 3px 0 0;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-error="true"] {
    color: ${theme.colors.danger};
  }
`;

export const ConnectForm = styled.form`
  display: flex;
  min-width: 214px;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  @media (max-width: 760px) {
    min-width: 0;
    justify-content: stretch;
  }
`;

export const RoomField = styled.label`
  display: flex;
  width: 124px;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid ${theme.colors.border};
  border-radius: 7px;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  transition: border-color ${theme.motion.fast}, background ${theme.motion.fast};

  &:focus-within {
    border-color: ${theme.colors.brandSoft};
    background: ${theme.colors.surface};
  }

  @media (max-width: 760px) {
    width: auto;
    flex: 1;
  }
`;

export const RoomInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.typography.mono};
  font-size: 10px;
  font-weight: 650;

  &::placeholder {
    color: ${theme.colors.textMuted};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.66;
  }
`;

export const ConnectButton = styled.button`
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: ${theme.colors.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 760;
  transition: transform ${theme.motion.spring}, background ${theme.motion.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.brandHover};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(1px) scale(0.96);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &[data-connected="true"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 22%, ${theme.colors.border});
    background: ${theme.colors.dangerSoft};
    color: ${theme.colors.danger};
  }
`;

export const ChatToolbar = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid ${theme.colors.border};
  background: color-mix(in srgb, ${theme.colors.canvasAccent} 48%, transparent);
`;

export const FilterGroup = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 3px;
`;

export const FilterButton = styled.button`
  height: 25px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 720;
  transition: all ${theme.motion.fast};

  &:hover {
    color: ${theme.colors.brand};
  }

  &[data-active="true"] {
    border-color: ${theme.colors.brandSoft};
    background: ${theme.colors.surface};
    color: ${theme.colors.brandDeep};
    box-shadow: 0 3px 9px color-mix(in srgb, ${theme.colors.brandDeep} 7%, transparent);
  }
`;

export const QuickStats = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
`;

export const StatChip = styled.span`
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, ${theme.colors.border} 78%, transparent);
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, ${theme.colors.surface} 66%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 8px;
  white-space: nowrap;

  strong {
    color: ${theme.colors.textSecondary};
    font-size: 9px;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 760px) {
    span {
      display: none;
    }
  }
`;

export const RankFaces = styled.i`
  display: inline-flex;
  align-items: center;
  margin-left: 1px;
  padding-right: 2px;
  font-style: normal;
`;

export const RankFace = styled.i`
  position: relative;
  display: grid;
  width: 17px;
  height: 17px;
  overflow: visible;
  place-items: center;
  margin-left: -3px;
  border: 1.5px solid #f3c75d;
  border-radius: 50%;
  background: linear-gradient(145deg, #fff7d4, #e6f2ff);
  color: ${theme.colors.brandDeep};
  font-size: 6px;
  font-style: normal;
  font-weight: 850;
  box-shadow: 0 2px 6px color-mix(in srgb, ${theme.colors.brandDeep} 12%, transparent);

  &:first-child {
    margin-left: 0;
  }

  &[data-rank="2"] {
    border-color: #aebdce;
  }

  &[data-rank="3"] {
    border-color: #d49a6a;
  }

  &::after {
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: grid;
    width: 8px;
    height: 8px;
    place-items: center;
    border-radius: 50%;
    background: ${theme.colors.surface};
    color: ${theme.colors.textSecondary};
    content: attr(data-rank);
    font-size: 5px;
    font-weight: 900;
    line-height: 1;
    box-shadow: 0 1px 3px rgba(15, 48, 82, 0.18);
  }
`;

export const RankAvatar = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
`;

export const MessageViewport = styled.div`
  --message-layout-duration: 560ms;
  --message-enter-duration: 680ms;
  --message-enter-offset-x: -26px;
  --message-enter-offset-y: 18px;

  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: none;
  padding: 12px;
  background:
    radial-gradient(circle at 88% 6%, color-mix(in srgb, ${theme.colors.cyanSoft} 52%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, ${theme.colors.canvas} 52%, transparent), color-mix(in srgb, ${theme.colors.canvasAccent} 38%, transparent));
  scrollbar-color: ${theme.colors.brandSoft} transparent;
  scrollbar-width: thin;
`;

export const MessageFeed = styled.div`
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0;
`;

/**
 * 新消息从 0 高度展开，布局会自然推动所有旧消息向上移动。
 * 时长由 MessageViewport 的 --message-layout-duration 统一控制。
 */
export const MessageEntry = styled.div`
  display: grid;
  min-width: 0;
  grid-template-rows: minmax(0, 1fr);

  &:first-child > div {
    padding-top: 0;
  }

  &[data-entering="true"] {
    overflow: clip;
    animation: bilimaku-message-layout-in var(--message-layout-duration)
      cubic-bezier(0.2, 0.82, 0.22, 1) both;
  }

  @keyframes bilimaku-message-layout-in {
    from {
      grid-template-rows: minmax(0, 0fr);
    }
    to {
      grid-template-rows: minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-entering="true"] {
      animation: none;
    }
  }
`;

/** 新消息内容沿左下到右上的方向进入，并通过多段过冲模拟弹簧回弹。 */
export const MessageEntryContent = styled.div`
  min-width: 0;
  min-height: 0;
  padding-top: 10px;

  &[data-entering="true"] {
    overflow: hidden;
    transform-origin: left bottom;
    will-change: transform, opacity, filter;
    animation: bilimaku-message-spring-in var(--message-enter-duration) linear both;
  }

  @keyframes bilimaku-message-spring-in {
    0% {
      opacity: 0;
      filter: blur(2px);
      transform: translate3d(
          var(--message-enter-offset-x),
          var(--message-enter-offset-y),
          0
        )
        scale(0.96);
    }
    44% {
      opacity: 1;
      filter: blur(0);
      transform: translate3d(5px, -3px, 0) scale(1.012);
    }
    65% {
      transform: translate3d(-2px, 1.5px, 0) scale(0.997);
    }
    81% {
      transform: translate3d(1px, -0.5px, 0) scale(1.003);
    }
    92% {
      transform: translate3d(-0.35px, 0.2px, 0) scale(0.9995);
    }
    100% {
      opacity: 1;
      filter: blur(0);
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-entering="true"] {
      animation: none;
    }
  }
`;

export const MessageRow = styled.article`
  display: grid;
  min-width: 0;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 8px;
  align-items: flex-start;

  &[data-type="system"] {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  &[data-type="system"] > [data-event-avatar="true"],
  &[data-type="system"] [data-message-meta="true"] {
    display: none;
  }
`;

export const EventAvatar = styled.span`
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 18%, ${theme.colors.border});
  border-radius: 9px;
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 11px;
  font-weight: 850;
  box-shadow: 0 5px 14px color-mix(in srgb, ${theme.colors.brandDeep} 8%, transparent);
`;

export const AvatarImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const MessageBody = styled.div`
  min-width: 0;
`;

export const MessageMeta = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  margin: 0 0 4px 2px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
`;

export const EventUser = styled.strong`
  overflow: hidden;
  max-width: 160px;
  color: ${theme.colors.textSecondary};
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EventUserId = styled.span`
  overflow: hidden;
  max-width: 88px;
  font-family: ${theme.typography.mono};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EventType = styled.span`
  padding: 1px 5px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brand};
  font-size: 7px;
  font-weight: 800;

  &[data-type="gift"],
  &[data-type="superchat"] {
    background: ${theme.colors.giftSoft};
    color: ${theme.colors.gift};
  }

  &[data-type="guard"] {
    background: ${theme.colors.cyanSoft};
    color: ${theme.colors.brandDeep};
  }

  &[data-type="interaction"] {
    background: ${theme.colors.successSoft};
    color: ${theme.colors.success};
  }

  &[data-anchor="true"] {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, ${theme.colors.brand} 18%, white),
      color-mix(in srgb, ${theme.colors.cyan} 14%, white)
    );
    color: ${theme.colors.brandDeep};
    box-shadow: inset 0 0 0 1px color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
  }
`;

export const EventTime = styled.time`
  font-family: ${theme.typography.mono};
  font-size: 8px;
  white-space: nowrap;
`;

export const MessageBubble = styled.p`
  display: inline-block;
  max-width: min(620px, 92%);
  margin: 0;
  padding: 8px 10px;
  border: 1px solid color-mix(
    in srgb,
    var(--message-bubble-color, ${theme.colors.messageBubble}) 42%,
    ${theme.colors.border}
  );
  border-radius: 3px 10px 10px 10px;
  background: color-mix(
    in srgb,
    var(--message-bubble-color, ${theme.colors.messageBubble}) 14%,
    ${theme.colors.surface}
  );
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  line-height: 1.52;
  overflow-wrap: anywhere;
  box-shadow:
    0 4px 12px color-mix(
      in srgb,
      var(--message-bubble-color, ${theme.colors.messageBubble}) 12%,
      transparent
    ),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);

  [data-type="system"] & {
    max-width: 78%;
    padding: 5px 10px;
    border-radius: ${theme.radius.pill};
    background: color-mix(in srgb, ${theme.colors.surfaceMuted} 82%, transparent);
    color: ${theme.colors.textMuted};
    font-size: 8px;
    text-align: center;
  }
`;

export const EmptyFeed = styled.div`
  display: grid;
  min-height: 100%;
  place-items: center;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  line-height: 1.6;
  text-align: center;

  strong {
    display: block;
    margin-bottom: 3px;
    color: ${theme.colors.textSecondary};
    font-size: 12px;
  }
`;

/** 聊天区底部的账号弹幕发送表单。 */
export const Composer = styled.form`
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 8px 10px 7px;
  border-top: 1px solid ${theme.colors.border};
  background: color-mix(in srgb, ${theme.colors.surface} 84%, transparent);
`;

export const ComposerField = styled.div`
  display: grid;
  min-width: 0;
  gap: 3px;
`;

export const ComposerInputShell = styled.div`
  display: grid;
  min-width: 0;
  height: 34px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 6px;
  background: color-mix(in srgb, ${theme.colors.surface} 94%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);
  transition:
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    box-shadow ${theme.motion.normal};

  &:focus-within {
    border-color: color-mix(in srgb, ${theme.colors.brand} 68%, ${theme.colors.border});
    background: ${theme.colors.surface};
    box-shadow:
      0 0 0 3px color-mix(in srgb, ${theme.colors.brandSoft} 54%, transparent),
      inset 0 1px 0 ${theme.colors.highlight};
  }

  &[data-state="error"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 62%, ${theme.colors.border});
  }

  &[data-disabled="true"] {
    background: ${theme.colors.surfaceMuted};
    color: ${theme.colors.textMuted};
  }
`;

export const ComposerInputIcon = styled.span`
  display: grid;
  place-items: center;
  color: ${theme.colors.brand};
`;

export const ComposerInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${theme.colors.textPrimary};
  font: 600 11px/1.2 ${theme.typography.family};

  &::placeholder {
    color: ${theme.colors.textMuted};
    font-weight: 520;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

export const ComposerCounter = styled.span`
  min-width: 29px;
  color: ${theme.colors.textMuted};
  font: 700 8px/1 ${theme.typography.mono};
  text-align: right;

  &[data-near-limit="true"] {
    color: ${theme.colors.warning};
  }
`;

export const ComposerAssist = styled.span`
  display: block;
  min-height: 10px;
  overflow: hidden;
  padding-left: 2px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  font-weight: 620;
  line-height: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-state="success"] {
    color: ${theme.colors.success};
  }

  &[data-state="error"] {
    color: ${theme.colors.danger};
  }
`;

export const ComposerButton = styled.button`
  display: flex;
  min-width: 68px;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brandDeep} 34%, transparent);
  border-radius: 6px;
  background: ${theme.gradients.brand};
  color: ${theme.colors.textOnBrand};
  font-size: 10px;
  font-weight: 820;
  box-shadow:
    0 6px 16px color-mix(in srgb, ${theme.colors.brand} 22%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 66%, transparent);
  transition:
    transform ${theme.motion.spring},
    filter ${theme.motion.fast},
    box-shadow ${theme.motion.fast};

  &:hover:not(:disabled) {
    filter: saturate(1.08) brightness(1.03);
    transform: translateY(-1px) scale(1.025);
    box-shadow:
      0 8px 20px color-mix(in srgb, ${theme.colors.brand} 28%, transparent),
      inset 0 1px 0 ${theme.colors.highlight};
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }

  &:disabled {
    cursor: not-allowed;
    filter: grayscale(0.18);
    opacity: 0.46;
    box-shadow: none;
  }
`;

/** 主播数据按需打开为覆盖聊天区的抽屉，默认不占用首页空间。 */
export const AnalyticsDrawer = styled.aside`
  position: absolute;
  z-index: 8;
  top: 8px;
  right: 8px;
  bottom: 8px;
  width: min(620px, calc(100% - 16px));
  overflow: auto;
  padding: 8px;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 10px;
  background: color-mix(in srgb, ${theme.colors.surface} 96%, transparent);
  box-shadow: -14px 0 36px color-mix(in srgb, ${theme.colors.brandDeep} 16%, transparent);
  backdrop-filter: blur(24px) saturate(1.24);
  animation: bilimaku-analytics-in 180ms ease-out both;

  @keyframes bilimaku-analytics-in {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

export const DrawerBar = styled.div`
  position: sticky;
  z-index: 2;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
  padding: 7px 8px;
  border: 1px solid ${theme.colors.border};
  border-radius: 8px;
  background: color-mix(in srgb, ${theme.colors.surface} 90%, transparent);
  backdrop-filter: blur(18px);
`;

export const DrawerTitle = styled.strong`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 820;
`;

export const DrawerClose = styled.button`
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid ${theme.colors.border};
  border-radius: 6px;
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textMuted};
  font-size: 8px;
  font-weight: 750;

  &:hover {
    border-color: ${theme.colors.brandSoft};
    color: ${theme.colors.brand};
  }
`;

export const DrawerLoading = styled.div`
  display: grid;
  min-height: 220px;
  place-items: center;
  color: ${theme.colors.textMuted};
  font-size: 9px;
`;
export const FunctionRail = styled.aside`
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 6px;
  padding: 7px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 84%, transparent);
  box-shadow:
    0 10px 26px color-mix(in srgb, ${theme.colors.brandDeep} 7%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 72%, transparent);
  backdrop-filter: blur(18px);
`;

export const RailTitle = styled.div`
  padding: 4px 0 5px;
  color: ${theme.colors.textMuted};
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-align: center;
`;

export const RailButton = styled.button`
  display: flex;
  min-height: 51px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-direction: column;
  padding: 6px 3px;
  border: 1px solid ${theme.colors.border};
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.surfaceMuted} 70%, transparent);
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 720;
  transition:
    transform ${theme.motion.spring},
    border-color ${theme.motion.fast},
    background ${theme.motion.fast},
    color ${theme.motion.fast};

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, ${theme.colors.brand} 36%, ${theme.colors.border});
    background: ${theme.colors.brandSubtle};
    color: ${theme.colors.brandDeep};
    transform: translateX(-2px);
  }

  &:active:not(:disabled) {
    transform: translateX(-1px) scale(0.96);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.44;
  }

  &[data-active="true"] {
    border-color: ${theme.colors.brandSoft};
    background: ${theme.colors.brandSubtle};
    color: ${theme.colors.brand};
    box-shadow: inset 2px 0 0 ${theme.colors.brand};
  }

  &[data-danger="true"] {
    border-color: color-mix(in srgb, ${theme.colors.danger} 20%, ${theme.colors.border});
    background: ${theme.colors.dangerSoft};
    color: ${theme.colors.danger};
  }
`;

export const RailSpacer = styled.div`
  flex: 1;
`;

export const RailConnection = styled.div`
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 6px 2px;
  color: ${theme.colors.textMuted};
  font-size: 7px;
  line-height: 1.3;
  text-align: center;
`;

export const RailConnectionDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${theme.colors.textMuted};

  &[data-connected="true"] {
    background: ${theme.colors.success};
    box-shadow: 0 0 0 3px ${theme.colors.successSoft};
  }
`;
