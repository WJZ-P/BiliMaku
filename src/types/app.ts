/** Rust 核心初始化状态。 */
export interface DesktopStatus {
  /** 当前产品名称。 */
  name: string;
  /** 当前应用版本。 */
  version: string;
  /** Rust 核心是否已经完成基础初始化。 */
  coreReady: boolean;
}

/** GitHub 最新正式 Release 与当前桌面应用版本的比较结果。 */
export interface AppUpdateStatus {
  /** 当前正在运行的版本，不包含 v 前缀。 */
  currentVersion: string;
  /** GitHub 最新正式 Release 版本，不包含 v 前缀。 */
  latestVersion: string;
  /** 是否存在高于当前版本的正式 Release。 */
  updateAvailable: boolean;
  /** 最新正式 Release 的浏览器页面。 */
  releaseUrl: string;
  /** Release 展示名称。 */
  releaseName: string;
  /** Release 发布时间，格式为 RFC 3339；平台未返回时为空。 */
  publishedAt: string | null;
}
