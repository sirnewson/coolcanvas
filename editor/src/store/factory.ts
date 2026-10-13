import { uid } from "../lib/id";
import { NOTE_COLORS, TEXT_ROLES } from "../lib/theme";
import { LIST_PAD } from "../lib/outline";
import type {
  CanvasObject,
  FrameKind,
  ListItem,
  NoteKind,
  ObjectStyle,
  ObjectType,
  Point,
  TextRole,
} from "../types";

export interface StyleDefaults {
  ink: string;
  fill: string;
  strokeWidth: number;
  dash: ObjectStyle["dash"];
  radius: number;
  fontFamily: NonNullable<ObjectStyle["fontFamily"]>;
  noteKind: NoteKind;
  textRole: TextRole;
  penSmoothing: number;
  penSize: number;
  arrowStyle: "straight" | "curved" | "elbow";
  opacity: number;
  polygonSides: number;
}

export const DEFAULT_STYLE: StyleDefaults = {
  ink: "#1c1c1a",
  fill: "transparent",
  strokeWidth: 2,
  dash: "solid",
  radius: 6,
  fontFamily: "sans",
  noteKind: "idea",
  textRole: "body",
  penSmoothing: 1,
  penSize: 4,
  arrowStyle: "straight",
  opacity: 1,
  polygonSides: 6,
};

function base(type: ObjectType, at: Point): CanvasObject {
  return {
    id: uid(type),
    type,
    x: at.x,
    y: at.y,
    width: 0,
    height: 0,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    style: {},
    data: {},
  };
}

export type ShapeType = "rect" | "ellipse" | "triangle" | "diamond" | "polygon";

export function createShape(type: ShapeType, at: Point, d: StyleDefaults): CanvasObject {
  const o = base(type, at);
  o.opacity = d.opacity;
  o.style = {
    stroke: d.ink,
    fill: d.fill,
    strokeWidth: d.strokeWidth,
    dash: d.dash,
    radius: type === "rect" ? d.radius : 0,
    fontFamily: d.fontFamily,
    fontSize: 15,
    align: "center",
    verticalAlign: "middle",
    color: d.ink,
  };
  o.data = type === "polygon" ? { text: "", sides: d.polygonSides, star: false, innerRatio: 0.5 } : { text: "" };
  return o;
}

export function createLine(
  type: "line" | "arrow",
  at: Point,
  d: StyleDefaults,
): CanvasObject {
  const o = base(type, at);
  o.opacity = d.opacity;
  o.style = {
    stroke: d.ink,
    strokeWidth: d.strokeWidth,
    dash: d.dash,
    arrowEnd: type === "arrow",
    arrowStart: false,
    curve: d.arrowStyle === "curved" ? 0.35 : 0,
    elbow: d.arrowStyle === "elbow",
    fontFamily: d.fontFamily,
    fontSize: 12,
  };
  o.data = { text: "", points: [0, 0, 0, 0] };
  return o;
}

export function createMeasure(at: Point, d: StyleDefaults): CanvasObject {
  const o = base("measure", at);
  o.style = { stroke: "#c0392b", strokeWidth: 1, fontSize: 12, fontFamily: "mono" };
  o.data = { points: [0, 0, 0, 0] };
  void d;
  return o;
}

export function createDraw(
  at: Point,
  d: StyleDefaults,
  size: number,
  highlighter = false,
): CanvasObject {
  const o = base("draw", at);
  o.opacity = highlighter ? 0.38 : d.opacity;
  o.style = {
    fill: highlighter ? "#ffd93d" : d.ink,
    strokeWidth: size,
    smoothing: d.penSmoothing,
  };
  o.data = { points: [] };
  return o;
}

export function createText(at: Point, d: StyleDefaults, role = d.textRole): CanvasObject {
  const o = base("text", at);
  const preset = TEXT_ROLES[role];
  o.width = 260;
  o.height = preset.fontSize * 1.4;
  o.style = {
    color: d.ink,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    fontFamily: d.fontFamily,
    lineHeight: 1.35,
    align: "left",
  };
  o.data = { text: "", textRole: role };
  return o;
}

export function createNote(at: Point, kind: NoteKind, d?: StyleDefaults): CanvasObject {
  const o = base("note", at);
  o.width = 200;
  o.height = 200;
  o.style = {
    fill: NOTE_COLORS[kind].bg,
    color: NOTE_COLORS[kind].ink,
    fontSize: 16,
    fontFamily: d?.fontFamily ?? "sans",
    lineHeight: 1.4,
    align: "left",
    shadow: true,
  };
  o.data = { text: "", noteKind: kind };
  return o;
}

export function createFrame(
  at: Point,
  name: string,
  kind: FrameKind = "plain",
): CanvasObject {
  const o = base("frame", at);
  o.name = name;
  o.style = { fill: "#ffffff", stroke: "#b3b3ab", strokeWidth: 1, radius: 2 };
  o.data = { frameKind: kind, url: kind === "browser" ? "example.com" : undefined };
  return o;
}

export function createImage(
  at: Point,
  src: string,
  naturalWidth: number,
  naturalHeight: number,
  maxSide = 520,
): CanvasObject {
  const o = base("image", at);
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  o.width = Math.round(naturalWidth * scale);
  o.height = Math.round(naturalHeight * scale);
  o.x = at.x - o.width / 2;
  o.y = at.y - o.height / 2;
  o.style = { radius: 2 };
  o.data = { src, naturalWidth, naturalHeight };
  return o;
}

export function createEmbed(at: Point, url: string): CanvasObject {
  const o = base("embed", at);
  const video = parseVideo(url);
  o.width = video ? 420 : 320;
  o.height = video ? 262 : 118;
  o.x = at.x - o.width / 2;
  o.y = at.y - o.height / 2;
  o.style = { fill: "#ffffff", stroke: "#d8d6cd", strokeWidth: 1, radius: 4, fontFamily: "sans" };
  o.data = {
    embedKind: video ? "video" : "link",
    url,
    provider: video?.provider ?? hostOf(url),
    title: video?.id ? `${video.provider} video` : hostOf(url),
    src: video?.thumb,
  };
  return o;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

/** Recognise a YouTube or Vimeo link so pasted references become video cards. */
export function parseVideo(url: string): { provider: string; id: string; thumb?: string } | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) {
    return {
      provider: "YouTube",
      id: yt[1],
      thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = /vimeo\.com\/(\d{5,})/.exec(url);
  if (vimeo) return { provider: "Vimeo", id: vimeo[1] };
  return null;
}

export function createIcon(
  at: Point,
  illustration: { id: string; label: string; path: string; filled?: boolean },
  d: StyleDefaults,
  size = 110,
): CanvasObject {
  const o = base("icon", at);
  o.name = illustration.label;
  o.width = size;
  o.height = size;
  o.x = at.x - size / 2;
  o.y = at.y - size / 2;
  o.style = {
    stroke: d.ink,
    fill: illustration.filled ? d.ink : "transparent",
    strokeWidth: illustration.filled ? 0 : 4,
  };
  o.data = { path: illustration.path, title: illustration.label };
  return o;
}

export function createList(at: Point, d: StyleDefaults, items?: ListItem[]): CanvasObject {
  const o = base("list", at);
  o.width = 300;
  o.style = {
    fill: "transparent",
    color: d.ink,
    fontSize: 15,
    fontFamily: d.fontFamily,
    lineHeight: 1.7,
    stroke: d.ink,
  };
  o.data = {
    listKind: "bullet",
    items: items ?? [
      { id: uid("li"), text: "Main point", level: 0 },
      { id: uid("li"), text: "Supporting detail", level: 1 },
      { id: uid("li"), text: "Another detail", level: 1 },
      { id: uid("li"), text: "Next point", level: 0 },
    ],
  };
  o.height = LIST_PAD * 2 + (o.data.items?.length ?? 0) * Math.round(15 * 1.7);
  return o;
}

/** A moodboard slot: double-click it and the picture drops in exactly. */
export function createPlaceholder(at: Point, w = 260, h = 200): CanvasObject {
  const o = base("placeholder", at);
  o.width = w;
  o.height = h;
  o.x = at.x - w / 2;
  o.y = at.y - h / 2;
  o.style = { fill: "#f0efe9", stroke: "#c6c6be", strokeWidth: 1.5, dash: "dashed", radius: 3 };
  o.data = { text: "Double-click to add an image" };
  return o;
}

export function createTable(at: Point, d: StyleDefaults, rows?: string[][]): CanvasObject {
  const o = base("table", at);
  o.data = {
    rows: rows ?? [
      ["Stage", "Owner", "Status"],
      ["Research", "You", "Done"],
      ["Concept", "You", "Now"],
      ["Build", "Team", "Next"],
    ],
  };
  const cols = o.data.rows![0].length;
  o.width = Math.max(320, cols * 150);
  o.height = (o.data.rows!.length + 0) * 38;
  o.style = {
    fill: "#ffffff",
    stroke: "#d9d7cd",
    strokeWidth: 1,
    color: d.ink,
    fontSize: 13,
    fontFamily: d.fontFamily,
    radius: 3,
  };
  return o;
}

export function createCard(at: Point, d: StyleDefaults, front = "Question?", back = "Answer"): CanvasObject {
  const o = base("card", at);
  o.width = 300;
  o.height = 190;
  o.x = at.x - o.width / 2;
  o.y = at.y - o.height / 2;
  o.style = {
    fill: "#ffffff",
    stroke: "#d9d7cd",
    strokeWidth: 1,
    radius: 10,
    color: d.ink,
    fontSize: 20,
    fontFamily: d.fontFamily,
    align: "center",
    shadow: true,
  };
  o.data = { front, back, flipped: false };
  return o;
}

export function createMedia(
  at: Point,
  src: string,
  kind: "video" | "audio",
  title: string,
  naturalWidth = 640,
  naturalHeight = 360,
): CanvasObject {
  const o = base("media", at);
  if (kind === "audio") {
    o.width = 360;
    o.height = 96;
  } else {
    const scale = Math.min(1, 520 / Math.max(naturalWidth, naturalHeight));
    o.width = Math.round(naturalWidth * scale);
    o.height = Math.round(naturalHeight * scale) + 34;
  }
  o.x = at.x - o.width / 2;
  o.y = at.y - o.height / 2;
  o.style = {
    fill: "#ffffff",
    stroke: kind === "audio" ? "#1f5fd0" : "#d9d7cd",
    strokeWidth: 1,
    radius: 8,
    color: "#1a1a18",
    shadow: true,
  };
  o.data = { src, mediaKind: kind, title, muted: kind === "video", loop: false, naturalWidth, naturalHeight };
  return o;
}

export function createGroup(members: CanvasObject[]): CanvasObject {
  const o = base("group", { x: 0, y: 0 });
  o.name = "Group";
  o.data = { children: members.map((m) => m.id) };
  return o;
}

/* ------------------------------------------------------------------ stamps */

export interface Stamp {
  id: string;
  label: string;
  group: string;
  width: number;
  height: number;
  build(at: Point, d: StyleDefaults): CanvasObject[];
}

export function stampRect(
  at: Point,
  w: number,
  h: number,
  opts: Partial<ObjectStyle> & { text?: string; type?: ShapeType } = {},
): CanvasObject {
  const { text, type = "rect", ...style } = opts;
  const o = base(type, at);
  o.width = w;
  o.height = h;
  o.style = {
    stroke: "#1c1c1a",
    fill: "transparent",
    strokeWidth: 1.5,
    radius: 4,
    fontSize: 13,
    align: "center",
    verticalAlign: "middle",
    color: "#1c1c1a",
    ...style,
  };
  o.data = { text: text ?? "" };
  return o;
}

export function stampLabel(at: Point, text: string, size = 12, weight = 600): CanvasObject {
  const o = base("text", at);
  o.width = 200;
  o.height = size * 1.4;
  o.style = { color: "#1c1c1a", fontSize: size, fontWeight: weight, fontFamily: "sans", lineHeight: 1.3 };
  o.data = { text, textRole: "label" };
  return o;
}

const rect = stampRect;
const label = stampLabel;

/** Rough building blocks so common UI ideas take one click (blueprint §54). */
export const STAMPS: Stamp[] = [
  {
    id: "button",
    label: "Button",
    group: "Interface",
    width: 132,
    height: 40,
    build: (at, d) => [
      rect(at, 132, 40, { radius: d.radius, fill: "#1c1c1a", stroke: "#1c1c1a", color: "#ffffff", text: "Button" }),
    ],
  },
  {
    id: "input",
    label: "Input",
    group: "Interface",
    width: 220,
    height: 40,
    build: (at) => [
      rect(at, 220, 40, { radius: 4, fill: "#ffffff", stroke: "#c6c6be", color: "#8a8a82", text: "Placeholder" }),
    ],
  },
  {
    id: "card",
    label: "Card",
    group: "Interface",
    width: 240,
    height: 190,
    build: (at) => [
      rect(at, 240, 190, { radius: 6, fill: "#ffffff", stroke: "#d8d6cd" }),
      rect({ x: at.x + 14, y: at.y + 14 }, 212, 96, { radius: 3, fill: "#eceae3", stroke: "transparent" }),
      label({ x: at.x + 14, y: at.y + 122 }, "Card title", 14, 600),
      label({ x: at.x + 14, y: at.y + 144 }, "Supporting line of copy", 12, 400),
    ],
  },
  {
    id: "navbar",
    label: "Nav bar",
    group: "Interface",
    width: 520,
    height: 54,
    build: (at) => [
      rect(at, 520, 54, { radius: 4, fill: "#ffffff", stroke: "#d8d6cd" }),
      label({ x: at.x + 18, y: at.y + 19 }, "Logo", 14, 700),
      label({ x: at.x + 300, y: at.y + 20 }, "Work   Studio   Notes   Contact", 12, 500),
    ],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    group: "Interface",
    width: 180,
    height: 320,
    build: (at) => [
      rect(at, 180, 320, { radius: 4, fill: "#f4f3ef", stroke: "#d8d6cd" }),
      ...[0, 1, 2, 3].map((i) =>
        rect({ x: at.x + 14, y: at.y + 18 + i * 40 }, 152, 26, {
          radius: 3,
          fill: i === 0 ? "#e2e0d8" : "transparent",
          stroke: "transparent",
        }),
      ),
    ],
  },
  {
    id: "avatar",
    label: "Avatar",
    group: "Interface",
    width: 48,
    height: 48,
    build: (at) => [
      rect(at, 48, 48, { type: "ellipse", fill: "#e2e0d8", stroke: "#c6c6be" }),
    ],
  },
  {
    id: "imagebox",
    label: "Image slot",
    group: "Moodboard",
    width: 260,
    height: 200,
    build: (at) => [createPlaceholder({ x: at.x + 130, y: at.y + 100 })],
  },
  {
    id: "moodrow",
    label: "Slot row",
    group: "Moodboard",
    width: 820,
    height: 200,
    build: (at) => [0, 1, 2].map((i) => createPlaceholder({ x: at.x + 130 + i * 280, y: at.y + 100 })),
  },
  {
    id: "swatches",
    label: "Palette strip",
    group: "Moodboard",
    width: 340,
    height: 64,
    build: (at) =>
      ["#1c1c1a", "#c9600f", "#f4ece0", "#486466", "#ddb86c"].map((hex, i) => {
        const sw = rect({ x: at.x + i * 68, y: at.y }, 64, 64, { fill: hex, stroke: "transparent", radius: 2 });
        sw.style.strokeWidth = 0;
        return sw;
      }),
  },
  {
    id: "table",
    label: "Table",
    group: "Data",
    width: 460,
    height: 152,
    build: (at, d) => [createTable(at, d)],
  },
  {
    id: "flashcard",
    label: "Flashcard",
    group: "Data",
    width: 300,
    height: 190,
    build: (at, d) => [createCard({ x: at.x + 150, y: at.y + 95 }, d)],
  },
  {
    id: "stat",
    label: "Stat tile",
    group: "Data",
    width: 220,
    height: 140,
    build: (at, d) => {
      const box = rect(at, 220, 140, { fill: "#ffffff", radius: 6, stroke: "#d9d7cd" });
      const big = label({ x: at.x + 18, y: at.y + 30 }, "72%", 42, 700);
      big.style.fontFamily = "display";
      const cap = label({ x: at.x + 18, y: at.y + 92 }, "of the thing that matters", 12, 400);
      void d;
      return [box, big, cap];
    },
  },
  {
    id: "bars",
    label: "Bar chart",
    group: "Data",
    width: 260,
    height: 160,
    build: (at) => {
      const heights = [50, 92, 68, 130, 104];
      return heights.map((h, i) => {
        const bar = rect({ x: at.x + i * 52, y: at.y + 160 - h }, 40, h, {
          fill: i === 3 ? "#1f5fd0" : "#c9c7bd",
          stroke: "transparent",
          radius: 2,
        });
        bar.style.strokeWidth = 0;
        return bar;
      });
    },
  },
  {
    id: "flow3",
    label: "Three-step flow",
    group: "Diagram",
    width: 520,
    height: 70,
    build: (at) => {
      const boxes = ["Research", "Design", "Ship"].map((t, i) =>
        rect({ x: at.x + i * 200, y: at.y }, 150, 70, { text: t, radius: 4, fill: "#ffffff" }),
      );
      const arrows = [0, 1].map((i) => {
        const a = base("arrow", { x: at.x + 150 + i * 200, y: at.y + 35 });
        a.width = 50;
        a.height = 0;
        a.style = { stroke: "#1c1c1a", strokeWidth: 1.5, arrowEnd: true };
        a.data = { points: [0, 0, 50, 0] };
        return a;
      });
      return [...boxes, ...arrows];
    },
  },
  {
    id: "matrix",
    label: "2×2 matrix",
    group: "Diagram",
    width: 320,
    height: 320,
    build: (at) => {
      const cells: CanvasObject[] = [];
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          cells.push(
            rect({ x: at.x + c * 160, y: at.y + r * 160 }, 160, 160, {
              radius: 0,
              stroke: "#9c9c94",
              strokeWidth: 1,
            }),
          );
        }
      }
      return cells;
    },
  },
  {
    id: "shot",
    label: "Shot plan",
    group: "Direction",
    width: 340,
    height: 230,
    build: (at) => [
      rect(at, 340, 200, { radius: 2, stroke: "#9c9c94", dash: "dashed", text: "" }),
      label({ x: at.x + 12, y: at.y + 10 }, "SUBJECT", 11, 700),
      label({ x: at.x + 12, y: at.y + 176 }, "CAMERA 35MM · SLOW PUSH · 4s", 11, 600),
      (() => {
        const a = base("arrow", { x: at.x + 170, y: at.y + 210 });
        a.width = 0;
        a.height = -60;
        a.style = { stroke: "#c0392b", strokeWidth: 1.5, arrowEnd: true };
        a.data = { points: [0, 60, 0, 0], text: "camera" };
        return a;
      })(),
    ],
  },
  {
    id: "lightplan",
    label: "Light plan",
    group: "Direction",
    width: 260,
    height: 160,
    build: (at) => [
      rect(at, 60, 60, { type: "ellipse", stroke: "#c9600f", fill: "#fdf0dc", text: "KEY" }),
      rect({ x: at.x + 190, y: at.y + 30 }, 60, 60, { type: "ellipse", stroke: "#6b7280", text: "FILL" }),
      rect({ x: at.x + 95, y: at.y + 100 }, 60, 60, { type: "ellipse", stroke: "#2f6bd8", text: "BACK" }),
    ],
  },
];
