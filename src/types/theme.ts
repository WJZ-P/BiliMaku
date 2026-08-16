/** BiliMaku 支持的界面主题模式。 */
export type ThemeMode = "light" | "dark";

/** 首次启动与旧配置迁移时使用的默认主题。 */
export const DEFAULT_THEME_MODE: ThemeMode = "light";

/** 判断来自本地存储或 Rust 配置的字符串是否为受支持主题。 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}
