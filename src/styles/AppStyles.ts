import { styled } from "@linaria/react";
import { theme } from "./theme";

/** 主窗口最外层布局；保持为纯样式模块，避免 Linaria 静态求值业务依赖。 */
export const AppFrame = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  padding-top: ${theme.layout.titleBarHeight};
`;

/** 主内容滚动区域。 */
export const Main = styled.main`
  position: relative;
  min-width: 0;
  height: 100%;
  flex: 1;
  overflow: auto;
  background: transparent;

  &[data-view="dashboard"] {
    overflow: hidden;
  }
`;

/**
 * 直播间常驻视图。
 *
 * 切换侧边栏时只改变可见性，不卸载聊天虚拟列表；绝对定位仍保留完整布局尺寸，
 * 避免 display:none 让 ResizeObserver 把消息视口测量成 0。
 */
export const PersistentDashboardView = styled.section`
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;

  &[data-active="true"] {
    z-index: 1;
    visibility: visible;
    pointer-events: auto;
  }
`;

/** 路由代码分块尚未完成时显示的轻量占位。 */
export const ViewLoading = styled.div`
  display: grid;
  min-height: calc(100vh - 76px);
  place-items: center;
  color: var(--bc-color-text-secondary);
`;
