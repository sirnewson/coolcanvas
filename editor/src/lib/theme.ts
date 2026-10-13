import type { BackgroundKind, FontKey, NoteKind, TextRole, Unit } from "../types";

/** Ink palette — muted, technical, never candy-coloured (blueprint §72). */
export const INK: { hex: string; name: string }[] = [
  { hex: "#131a2d", name: "Ink" },
  { hex: "#5b6470", name: "Graphite" },
  { hex: "#9c9c94", name: "Pencil" },
  { hex: "#2f6bf0", name: "Signal blue" },
  { hex: "#0ea5b7", name: "Teal" },
  { hex: "#0f8a6a", name: "Field green" },
  { hex: "#7fae2b", name: "Lime" },
  { hex: "#e2a20a", name: "Amber" },
  { hex: "#c9600f", name: "Ochre" },
  { hex: "#e0567a", name: "Rose" },
  { hex: "#c0392b", name: "Red pen" },
  { hex: "#a4113f", name: "Crimson" },
  { hex: "#7a4bd0", name: "Violet" },
  { hex: "#4b3bd0", name: "Indigo" },
  { hex: "#dbe9f7", name: "Chalk" },
  { hex: "#ffffff", name: "White" },
];

export const FILLS: { hex: string; name: string }[] = [
  { hex: "transparent", name: "None" },
  { hex: "#ffffff", name: "Paper" },
  { hex: "#f4f3ef", name: "Bone" },
  { hex: "#e9e7df", name: "Fog" },
  { hex: "#e4edfb", name: "Blue wash" },
  { hex: "#d6f2f4", name: "Aqua" },
  { hex: "#e2f3ec", name: "Green wash" },
  { hex: "#f0f5d8", name: "Chartreuse" },
  { hex: "#fdf3c4", name: "Butter" },
  { hex: "#ffe2c2", name: "Apricot" },
  { hex: "#fbe4e1", name: "Blush" },
  { hex: "#f6dbe8", name: "Petal" },
  { hex: "#efe6fb", name: "Lilac" },
  { hex: "#2c2c28", name: "Charcoal" },
  { hex: "#12304d", name: "Navy" },
  { hex: "#1a3a32", name: "Forest" },
];

export const NOTE_COLORS: Record<NoteKind, { bg: string; ink: string; label: string }> = {
  idea: { bg: "#fdf3c4", ink: "#57460a", label: "Idea" },
  question: { bg: "#dceaff", ink: "#123a72", label: "Question" },
  important: { bg: "#ffd9d3", ink: "#6d1a10", label: "Important" },
  research: { bg: "#d8f0e2", ink: "#0f4a30", label: "Research" },
  todo: { bg: "#ece7f9", ink: "#38265e", label: "Todo" },
  plan: { bg: "#ffe2c2", ink: "#6b3b09", label: "Plan" },
  quote: { bg: "#f3ece0", ink: "#4a3d2b", label: "Quote" },
  cool: { bg: "#d6f2f4", ink: "#0d454a", label: "Cool" },
};

const BASE_FONTS: Record<string, string> = {
  sans: "'Inter', 'Segoe UI', system-ui, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif",
  display:
    "'Bebas Neue', 'Oswald', 'Haettenschweiler', 'Arial Narrow', 'Franklin Gothic Medium', Impact, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  hand: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
  marker: "'Ink Free', 'Segoe Script', 'Permanent Marker', 'Marker Felt', cursive",
  script: "'Gabriola', 'Brush Script MT', 'Snell Roundhand', 'Apple Chancery', cursive",
};

/**
 * Universal font family resolver.
 * Maps legacy shorthand keys ("sans", "serif", etc.) to their stacks,
 * or safely wraps any installed local/Windows/Google font family name.
 */
export function resolveFontFamily(family?: string): string {
  if (!family) return BASE_FONTS.sans;
  if (BASE_FONTS[family]) return BASE_FONTS[family];
  return `"${family}", ${BASE_FONTS.sans}`;
}

/** All system stacks: the board has to render the same offline. Proxy allows arbitrary font names to resolve safely. */
export const FONTS: Record<FontKey, string> = new Proxy(BASE_FONTS as any, {
  get(target, prop: string) {
    if (typeof prop === "string") {
      if (prop in target) return target[prop];
      if (prop.trim()) return `"${prop}", ${target.sans}`;
    }
    return target.sans;
  },
});

export const FONT_LABELS: Record<FontKey, string> = {
  sans: "Sans",
  serif: "Serif",
  display: "Display",
  mono: "Mono",
  hand: "Hand",
  marker: "Marker",
  script: "Script",
};

export const TEXT_ROLES: Record<TextRole, { fontSize: number; fontWeight: number; label: string }> = {
  heading: { fontSize: 34, fontWeight: 650, label: "Heading" },
  subhead: { fontSize: 24, fontWeight: 600, label: "Subhead" },
  body: { fontSize: 18, fontWeight: 400, label: "Body" },
  caption: { fontSize: 13, fontWeight: 400, label: "Caption" },
  label: { fontSize: 11, fontWeight: 650, label: "Label" },
};

export interface BackgroundTheme {
  /** Page colour behind everything. */
  surface: string;
  /** Pattern colour. */
  pattern: string;
  /** Default ink for new objects on this surface. */
  ink: string;
  dark: boolean;
}

export const BACKGROUNDS: Record<BackgroundKind, BackgroundTheme> = {
  blank: { surface: "#f4f7fd", pattern: "transparent", ink: "#1c1c1a", dark: false },
  dots: { surface: "#f4f7fd", pattern: "#b9b9b1", ink: "#1c1c1a", dark: false },
  grid: { surface: "#fafcff", pattern: "#d8d6cd", ink: "#1c1c1a", dark: false },
  blueprint: { surface: "#0f2740", pattern: "#4d86bd", ink: "#dbe9f7", dark: true },
  paper: { surface: "#f4ece0", pattern: "#cdbca2", ink: "#2b2318", dark: false },
  slate: { surface: "#1d2021", pattern: "#3d4446", ink: "#e8e6df", dark: true },
  transparent: { surface: "#ffffff", pattern: "transparent", ink: "#1c1c1a", dark: false },
};

export const BACKGROUND_LABELS: Record<BackgroundKind, string> = {
  blank: "Blank",
  dots: "Dot grid",
  grid: "Graph",
  blueprint: "Blueprint",
  paper: "Paper",
  slate: "Slate",
  transparent: "Transparent",
};

export const FRAME_PRESETS: { group: string; name: string; width: number; height: number; kind?: string }[] = [
  { group: "Screens", name: "iPhone", width: 390, height: 844, kind: "phone" },
  { group: "Screens", name: "Android", width: 412, height: 915, kind: "phone" },
  { group: "Screens", name: "Tablet", width: 820, height: 1180, kind: "tablet" },
  { group: "Screens", name: "Desktop", width: 1440, height: 900, kind: "desktop" },
  { group: "Screens", name: "Browser", width: 1280, height: 800, kind: "browser" },
  { group: "Screens", name: "Watch", width: 368, height: 448, kind: "watch" },
  { group: "Social", name: "Square", width: 1080, height: 1080 },
  { group: "Social", name: "Portrait", width: 1080, height: 1350 },
  { group: "Social", name: "Story", width: 1080, height: 1920 },
  { group: "Social", name: "Wide", width: 1920, height: 1080 },
  { group: "Print", name: "A4", width: 794, height: 1123 },
  { group: "Print", name: "A3", width: 1123, height: 1587 },
];

/** Mix a hex colour with an alpha channel for pattern rendering. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const UNIT_LABEL: Record<Unit, string> = {
  px: "px",
  mm: "mm",
  cm: "cm",
  in: "in",
};

/** Board pixels per unit at scale 1 — 96dpi conventions. */
export const UNIT_PIXELS: Record<Unit, number> = {
  px: 1,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
};

export function formatMeasure(pixels: number, unit: Unit, unitScale: number): string {
  const value = pixels / (UNIT_PIXELS[unit] * (unitScale || 1));
  const rounded = unit === "px" ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${UNIT_LABEL[unit]}`;
}
