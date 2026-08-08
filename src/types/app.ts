/** Rust 核心初始化状态。 */
export interface DesktopStatus {
  /** 当前产品名称。 */
  name: string;
  /** 当前应用版本。 */
  version: string;
  /** Rust 核心是否已经完成基础初始化。 */
  coreReady: boolean;
}

