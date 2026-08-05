import { styled } from "@linaria/react";
import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "message"
  | "waveform"
  | "plug"
  | "settings"
  | "bell"
  | "chevron"
  | "play"
  | "pause"
  | "users"
  | "gift"
  | "volume"
  | "clock"
  | "shield"
  | "sparkles"
  | "sliders"
  | "radio"
  | "check"
  | "arrow";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const Svg = styled.svg`
  display: block;
  flex: 0 0 auto;
`;

function IconPath({ name }: Pick<IconProps, "name">) {
  switch (name) {
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      );
    case "message":
      return (
        <>
          <path d="M21 12a8.3 8.3 0 0 1-9 8 9.7 9.7 0 0 1-3.8-.75L3 21l1.7-4.55A8.2 8.2 0 0 1 3 12a8.3 8.3 0 0 1 9-8 8.3 8.3 0 0 1 9 8Z" />
          <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.7" />
        </>
      );
    case "waveform":
      return <path d="M3 12h2l2-6 4 12 3-9 3 6 2-3h2" />;
    case "plug":
      return (
        <>
          <path d="m12 22 1-7-5-2 7-11-1 8 5 2-7 10Z" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3.02 14H3v-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.02V3h4v.09a1.7 1.7 0 0 0 1.03 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      );
    case "chevron":
      return <path d="m9 18 6-6-6-6" />;
    case "play":
      return <path d="m8 5 11 7-11 7V5Z" />;
    case "pause":
      return (
        <>
          <path d="M9 5v14" />
          <path d="M15 5v14" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="4" />
          <path d="M2 21a7 7 0 0 1 14 0M16 4.5a4 4 0 0 1 0 7.5M18 15a6 6 0 0 1 4 6" />
        </>
      );
    case "gift":
      return (
        <>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.7 4 5.3 4 4 5 3 6.3 3 8.5 3 12 8 12 8M16.5 8C19 8 20 6.7 20 5.3 20 4 19 3 17.7 3 15.5 3 12 8 12 8" />
        </>
      );
    case "volume":
      return (
        <>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case "sparkles":
      return <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 13l.7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7L19 13Z" />;
    case "sliders":
      return (
        <>
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
          <path d="M1 14h6M9 8h6M17 16h6" />
        </>
      );
    case "radio":
      return (
        <>
          <circle cx="12" cy="12" r="2" />
          <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      );
    case "check":
      return <path d="m5 12 4 4L19 6" />;
    case "arrow":
      return <path d="M5 12h14M14 7l5 5-5 5" />;
  }
}

export function Icon({ name, size = 20, ...props }: IconProps) {
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
      <IconPath name={name} />
    </Svg>
  );
}
