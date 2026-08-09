import type { IconName } from "../components/Icon";

export type AppView =
  | "dashboard"
  | "debug"
  | "rules"
  | "voices"
  | "overlays"
  | "settings";

export interface NavigationItem {
  /** 对应的主视图编号。 */
  id: AppView;
  /** 导航项标题。 */
  label: string;
  /** 导航项功能说明。 */
  description: string;
  /** 使用的图标编号。 */
  icon: IconName;
}
