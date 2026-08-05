import type { IconName } from "../components/Icon";

export type AppView = "dashboard" | "rules" | "voices" | "connection";

export interface NavigationItem {
  id: AppView;
  label: string;
  description: string;
  icon: IconName;
}
