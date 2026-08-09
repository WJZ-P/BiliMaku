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

/** 路由代码分块尚未完成时显示的轻量占位。 */
export const ViewLoading = styled.div`
  display: grid;
  min-height: calc(100vh - 76px);
  place-items: center;
  color: var(--bc-color-text-secondary);
`;
