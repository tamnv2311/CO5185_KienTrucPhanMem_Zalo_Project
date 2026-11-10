import type { SVGProps } from "react";

/** Small hand-written stroke icon set (24x24 grid). */
const paths: Record<string, string> = {
  chat: "M4 5h16v11H9l-5 4z",
  contacts: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6M16 4.5a3.2 3.2 0 0 1 0 6.2M18 14c2 .7 3.3 2.8 3.6 6",
  cloud: "M7 18h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 18z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-1.9 1.1L15 20.5h-4l-.3-2a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7.6 7.6 0 0 1 1.9-1.1l.3-2h4l.3 2a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  userPlus: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-6 6.5-6 1.4 0 2.6.4 3.6 1.1M19 14v6M16 17h6",
  groupPlus: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 10a2.5 2.5 0 1 0 0-5M2 19c.5-3.2 2.9-5.2 6-5.2s5.5 2 6 5.2M19 14v6M16 17h6",
  phone: "M5 4h3.5l1.5 4-2 1.3a10 10 0 0 0 6.7 6.7L16 14l4 1.5V19a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4z",
  video: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.5",
  sidebar: "M4 4h16v16H4zM14 4v16",
  send: "M4 12l16-8-6 16-2.5-6.5z",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18M15.5 9.5a1.5 1.5 0 1 0 0-.1",
  attach: "M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.4 3.4 0 0 1 4.8 4.8L9.9 17a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3",
  smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2M9 9.5v.5M15 9.5v.5",
  sticker: "M14.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8l7-7V6a3 3 0 0 0-3-3zM14 21v-4a3 3 0 0 1 3-3h4",
  reply: "M10 8L4 13l6 5M4 13h10a6 6 0 0 1 6 6",
  forward: "M14 8l6 5-6 5M20 13H10a6 6 0 0 0-6 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  moreV: "M12 5h.01M12 12h.01M12 19h.01",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checks: "M2.5 12.5l4.5 4.5 9.5-9.5M12.5 16l1 1L23 7.5",
  pin: "M9 4h6l-1 5 4 4H6l4-4zM12 13v7",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  bellOff: "M6 16V11a6 6 0 0 1 9.4-4.9M18 11v5l2 2H8M10 20a2 2 0 0 0 4 0M4 4l16 16",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  copy: "M8 8h12v12H8zM4 16V4h12",
  undo: "M9 6L4 11l5 5M4 11h10a6 6 0 0 1 0 12h-2",
  download: "M12 4v11M7 10.5l5 5 5-5M4 20h16",
  file: "M6 3h8l5 5v13H6zM14 3v5h5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  camera: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21",
  micOff: "M9 6a3 3 0 0 1 6 0v5M6 11.5a6 6 0 0 0 9.7 4.7M12 17.5V21M4 4l16 16",
  videoOff: "M3 7h9M15 10.5l6-3.5v10l-3-1.8M3 7v10h12v-3M4 4l16 16",
  phoneOff: "M3 13.5c5-4.6 13-4.6 18 0l-2.2 2.6-3.3-1.4v-2.3a10 10 0 0 0-7 0v2.3l-3.3 1.4z",
  poll: "M5 20V12M12 20V5M19 20v-5",
  at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  crown: "M4 18h16l1-11-5 4-4-6-4 6-5-4z",
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6M16 4.5a3.2 3.2 0 0 1 0 6.2M18 14c2 .7 3.3 2.8 3.6 6",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  arrowLeft: "M11 5l-7 7 7 7M4 12h16",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  lock: "M6 11h12v9H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  key: "M14.5 9.5a4 4 0 1 0-1.2 2.8L20 19v2h-3v-2h-2v-2h-2l-1.2-1.2",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
  play: "M8 5v14l11-7z",
  filter: "M4 5h16l-6 7.5V19l-4 1v-7.5z",
  sort: "M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5",
  dot: "M12 12h.01",
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const isDots = name === "more" || name === "moreV" || name === "dot";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={isDots ? 3.2 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}

/** Original brand mark for ZaloLite: a rounded speech tile with a stylised "Z". */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="ZaloLite">
      <rect x="2" y="2" width="44" height="40" rx="13" fill="var(--brand)" />
      <path d="M13 42l2-9h8z" fill="var(--brand)" />
      <path d="M15.5 14h17L17 30h16" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
