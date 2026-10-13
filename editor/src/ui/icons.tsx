import type { SVGProps } from "react";

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type P = SVGProps<SVGSVGElement>;

export const IconSelect = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 3.5 15 10l-4.4 1.2L8.6 16z" />
  </svg>
);

export const IconHand = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 9V4.8a1.3 1.3 0 0 1 2.6 0V9m0-.6V4.2a1.3 1.3 0 0 1 2.6 0V9m0-.4a1.3 1.3 0 0 1 2.6 0v3.1c0 2.6-1.8 4.6-4.5 4.6-2.6 0-4.3-1.5-4.9-3.6L4.4 11c-.3-.9.2-1.6 1-1.8.6-.1 1.2.2 1.5.9" />
  </svg>
);

export const IconPen = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 17c0-2 .6-3.4 1.7-4.5l7-7a2 2 0 0 1 2.8 2.8l-7 7C6.4 16.4 5 17 3 17Z" />
    <path d="m11.5 5.5 3 3" />
  </svg>
);

export const IconArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 16 16 4" />
    <path d="M9.5 4H16v6.5" />
  </svg>
);

export const IconLine = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 16 16 4" />
  </svg>
);

export const IconRect = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
  </svg>
);

export const IconCircle = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="6.2" />
  </svg>
);

export const IconFrame = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 2.5v15M14 2.5v15M2.5 6h15M2.5 14h15" />
  </svg>
);

export const IconText = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.2V4h12v1.2M10 4v12M7.5 16h5" />
  </svg>
);

export const IconNote = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 4.5h13v7l-5 5h-8z" />
    <path d="M16.5 11.5h-5v5" />
  </svg>
);

export const IconImage = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <circle cx="7.5" cy="8" r="1.2" />
    <path d="m3.6 14.2 3.6-3.4 3 2.6 2.6-2.3 3.6 3.2" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base} {...p}>
    <path d="m10 3 7 3.6-7 3.6-7-3.6z" />
    <path d="m3 11.2 7 3.6 7-3.6" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
);

export const IconMinus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 10h11" />
  </svg>
);

export const IconUndo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 7H4V4" />
    <path d="M4.6 7.4a6 6 0 1 1-.9 4.6" />
  </svg>
);

export const IconRedo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 7h3V4" />
    <path d="M15.4 7.4a6 6 0 1 0 .9 4.6" />
  </svg>
);

export const IconExport = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3v9" />
    <path d="m6.5 8.5 3.5 3.5 3.5-3.5" />
    <path d="M4 14v2.5h12V14" />
  </svg>
);

export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3M15.2 15.2l-1.3-1.3M6.1 6.1 4.8 4.8" />
  </svg>
);

export const IconPresent = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7.5 6.5 14 10l-6.5 3.5z" />
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 5.5h11M8 5.5V4h4v1.5M6 5.5l.7 10h6.6l.7-10" />
  </svg>
);

export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="8.5" width="11" height="7.5" rx="1.5" />
    <path d="M7 8.5V6.8a3 3 0 0 1 6 0v1.7" />
  </svg>
);

export const IconUnlock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="8.5" width="11" height="7.5" rx="1.5" />
    <path d="M7 8.5V6.8a3 3 0 0 1 5.8-1" />
  </svg>
);

export const IconEye = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.5 10s2.8-4.5 7.5-4.5S17.5 10 17.5 10 14.7 14.5 10 14.5 2.5 10 2.5 10Z" />
    <circle cx="10" cy="10" r="2" />
  </svg>
);

export const IconEyeOff = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 4.5 16 15.5" />
    <path d="M7.4 6.3A8.4 8.4 0 0 1 10 5.5c4.7 0 7.5 4.5 7.5 4.5a13 13 0 0 1-2.6 3M12 12.4a2.6 2.6 0 0 1-3.6-3.3" />
    <path d="M6 7.2A12.6 12.6 0 0 0 2.5 10S5.3 14.5 10 14.5c.7 0 1.4-.1 2-.3" />
  </svg>
);

export const IconGroup = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="10" y="10" width="7" height="7" rx="1" />
  </svg>
);

export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m7 5 5 5-5 5" />
  </svg>
);

export const IconFit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" />
  </svg>
);

export const IconGrid = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7.5h14M3 12.5h14M7.5 3v14M12.5 3v14" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6.5" y="6.5" width="10" height="10" rx="1.5" />
    <path d="M13 6.5v-1a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V11a2 2 0 0 0 2 2h1" />
  </svg>
);

export const IconAlignLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 3v14M7 6.5h8M7 13.5h5" />
  </svg>
);

export const IconAlignCenterH = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3v14M6 6.5h8M7.5 13.5h5" />
  </svg>
);

export const IconAlignRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16 3v14M5 6.5h8M8 13.5h5" />
  </svg>
);

export const IconAlignTop = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4h14M6.5 7v8M13.5 7v5" />
  </svg>
);

export const IconAlignCenterV = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 10h14M6.5 6v8M13.5 7.5v5" />
  </svg>
);

export const IconAlignBottom = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 16h14M6.5 5v8M13.5 8v5" />
  </svg>
);

export const IconDistributeH = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 3v14M17 3v14" />
    <rect x="8" y="6.5" width="4" height="7" rx="1" />
  </svg>
);

export const IconDistributeV = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 3h14M3 17h14" />
    <rect x="6.5" y="8" width="7" height="4" rx="1" />
  </svg>
);

export const IconTriangle = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 4 17 16H3z" />
  </svg>
);

export const IconDiamond = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3 17 10l-7 7-7-7z" />
  </svg>
);

export const IconHighlighter = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 13 6-6 4 4-6 6H5z" />
    <path d="M3 17h14" strokeWidth="2.4" />
  </svg>
);

export const IconEraser = (p: P) => (
  <svg {...base} {...p}>
    <path d="m4 13 7-7 5 5-7 7H6z" />
    <path d="M8.5 9.5 13 14" />
    <path d="M10 17h7" />
  </svg>
);

export const IconMeasure = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12.5 12.5 3l4.5 4.5L7.5 17z" />
    <path d="M6.5 9 8 10.5M9 6.5l1.5 1.5M12 4.5 13.5 6" />
  </svg>
);

export const IconStamp = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="11" y="3" width="6" height="6" rx="3" />
    <rect x="3" y="11" width="6" height="6" rx="1" />
    <path d="M14 11v6M11 14h6" />
  </svg>
);

export const IconFlipH = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3v14" strokeDasharray="2 2" />
    <path d="M8 6 3 10l5 4zM12 6l5 4-5 4z" />
  </svg>
);

export const IconFlipV = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 10h14" strokeDasharray="2 2" />
    <path d="M6 8 10 3l4 5zM6 12l4 5 4-5z" />
  </svg>
);

export const IconToFront = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="9" height="9" rx="1" />
    <path d="M8 16.5h8.5V8" />
  </svg>
);

export const IconToBack = (p: P) => (
  <svg {...base} {...p}>
    <rect x="8" y="8" width="9" height="9" rx="1" />
    <path d="M12 3.5H3.5V12" />
  </svg>
);

export const IconMap = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3 5 4.5-1.5L12.5 6 17 4.5v11L12.5 17 7.5 14.5 3 16z" />
    <path d="M7.5 3.5v11M12.5 6v11" />
  </svg>
);

export const IconBoards = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M3 8h14M8 8v8" />
  </svg>
);

export const IconKeyboard = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="5.5" width="15" height="9" rx="1.5" />
    <path d="M5.5 8.5h.01M8 8.5h.01M10.5 8.5h.01M13 8.5h.01M6.5 11.5h7" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
);

export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.5h12M7 10h9M7 14.5h6" />
    <path d="M4 9.2l1.6 1.6L4 12.4" />
  </svg>
);

export const IconFilm = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="M6 4.5v11M14 4.5v11M2.5 10h15" />
  </svg>
);

export const IconHexagon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 2.8 16.2 6.4v7.2L10 17.2 3.8 13.6V6.4z" />
  </svg>
);

export const IconDropper = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12.5 3.5a2.5 2.5 0 0 1 3.5 3.5l-1.4 1.4 1 1-1.6 1.6-1-1L7 16.9 3.5 17.4l.5-3.5 6.9-6.9-1-1L11.5 4.3l1 1z" />
  </svg>
);

export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7.2 7.2 0 1 0 8.9 8.9Z" />
  </svg>
);

export const IconSun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="3.6" />
    <path d="M10 2.4v1.8M10 15.8v1.8M17.6 10h-1.8M4.2 10H2.4M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3M15.4 15.4l-1.3-1.3M5.9 5.9 4.6 4.6" />
  </svg>
);

export const IconSliders = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6h12M4 10h12M4 14h12" />
    <circle cx="7.5" cy="6" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="10" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="9" cy="14" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconWand = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3.5 16.5 9-9" />
    <path d="M14 3v2M14 9v2M11 6h2M17 6h2M6 3l.6 1.4L8 5l-1.4.6L6 7l-.6-1.4L4 5l1.4-.6zM16 12l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z" />
  </svg>
);

export const IconSparkle = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM15.5 14l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
  </svg>
);

export const IconGlobe = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M3 10h14M10 3c2.5 2.6 2.5 11.4 0 14M10 3c-2.5 2.6-2.5 11.4 0 14" />
  </svg>
);

export const IconMenu = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6h12M4 10h12M4 14h12" />
  </svg>
);

/* The studios: a stack of pictures, and a Bézier with its handles. */
export const IconStudioPhoto = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="3.5" width="11" height="9" rx="2" />
    <path d="M2.5 10.5 L5.5 7.5 L8 10" />
    <rect x="6.5" y="7.5" width="11" height="9" rx="2" />
    <path d="M6.5 14.5 L9.5 11.5 L12 14 L14 12.5 L17.5 15.5" />
  </svg>
);

export const IconStudioVector = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 15 C6 7, 14 7, 16 15" />
    <rect x="2" y="14" width="4" height="4" rx="1" />
    <rect x="14" y="14" width="4" height="4" rx="1" />
    <circle cx="7.5" cy="9" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="9" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);
