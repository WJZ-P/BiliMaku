import { styled } from "@linaria/react";
import type { SVGProps } from "react";
import { ICON_REGISTRY, type IconName } from "../icons/iconRegistry";

export type { IconName } from "../icons/iconRegistry";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** 必须来自统一图标注册表的图标名称。 */
  name: IconName;
  /** 图标宽高，单位为 CSS 像素。 */
  size?: number;
}

const Svg = styled.svg`
  display: block;
  flex: 0 0 auto;
`;

/**
 * 软件内唯一的功能图标渲染组件。
 *
 * 图形定义来自 icons/iconRegistry.tsx，业务层只负责选择名称和尺寸。
 */
export function Icon({ name, size = 20, ...props }: IconProps) {
  const Glyph = ICON_REGISTRY[name];

  return (
    <Svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <Glyph />
    </Svg>
  );
}