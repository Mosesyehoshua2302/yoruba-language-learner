import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "seedling"
  | "book"
  | "compass"
  | "trophy"
  | "flame"
  | "target"
  | "medal"
  | "quill"
  | "clock"
  | "star"
  | "sun"
  | "moon"
  | "check"
  | "x"
  | "lock"
  | "arrow-right"
  | "sparkle"
  | "chart"
  | "refresh"
  | "scroll"
  | "headband"
  | "crown"
  | "lightning"
  | "logout";

const PATHS: Record<IconName, ReactNode> = {
  seedling: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12C12 8.5 9.2 6 5 6c0 4.2 2.8 6 7 6z" />
      <path d="M12 12c0-3 2.4-5 6.5-5 0 4-2.5 5-6.5 5z" />
      <path d="M7 20h10" />
    </>
  ),
  book: (
    <>
      <path d="M12 6C9.5 4.5 6.5 4.3 4 5.2V19c2.5-.9 5.5-.7 8 .8V6z" />
      <path d="M12 6c2.5-1.5 5.5-1.7 8-.8V19c-2.5-.9-5.5-.7-8 .8V6z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
      <path d="M8 5H5a3 3 0 003 4" />
      <path d="M16 5h3a3 3 0 01-3 4" />
      <path d="M12 13v4" />
      <path d="M8.5 20h7" />
      <path d="M10 17h4v3h-4z" />
    </>
  ),
  flame: (
    <path d="M12 3c1.2 3.2 5 4.8 5 9a5 5 0 01-10 0c0-1.9.9-3.4 2-5 .6 1.4 1.4 2 2.3 2.3C10.8 7.4 11 5 12 3z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.5" r="5" />
      <path d="M9 10.5L5.5 3.5h4.2L12 8.5l2.3-5h4.2L15 10.5" />
    </>
  ),
  quill: (
    <>
      <path d="M20 4c-6.5 0-11 4-13 10l-3 6 6-3c6-2 10-6.5 10-13z" />
      <path d="M6.5 17.5L16 8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 13A8 8 0 1111 4a6.5 6.5 0 009 9z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  "arrow-right": <path d="M4 12h15M13.5 5.5L20 12l-6.5 6.5" />,
  sparkle: (
    <>
      <path d="M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-8" />
      <path d="M12 20.5v-14" />
      <path d="M17.5 20.5v-10.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 11-2.5-6" />
      <path d="M20.5 3.5V9H15" />
    </>
  ),
  scroll: (
    <>
      <path d="M6 3v15a2.5 2.5 0 002.5 2.5H16" />
      <path d="M6 3a2.5 2.5 0 00-2.5 2.5V6a2.5 2.5 0 002.5 2.5" />
      <path d="M16 20.5a2.5 2.5 0 002.5-2.5V6a2.5 2.5 0 00-2.5-2.5H6" />
      <path d="M9 8.5h6" />
      <path d="M9 12.5h6" />
    </>
  ),
  headband: (
    <>
      <path d="M3 10.3c3.2-1.6 14.8-1.6 18 0" />
      <path d="M3 13.7c3.2 1.6 14.8 1.6 18 0" />
      <circle cx="17.3" cy="12" r="1.6" />
      <path d="M17.9 13.3l1.4 4.7" />
      <path d="M16.9 13.5l-1 4.8" />
    </>
  ),
  crown: (
    <>
      <path d="M4 18L5 8l4 5 3-8 3 8 4-5 1 10" />
      <path d="M4 18h16" />
    </>
  ),
  lightning: <path d="M13 2.5L4 14h6.5l-1 7.5L20 10h-6.5l-.5-7.5z" />,
  logout: (
    <>
      <path d="M14 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8" />
      <path d="M18 15l3-3-3-3" />
      <path d="M21 12H9" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
