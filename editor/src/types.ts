/**
 * FlowCanvas object model.
 *
 * Every object on the canvas shares one flat structure (blueprint §65) so that
 * selection, transforms, layers, grouping and persistence can stay generic.
 * Type-specific information lives in `style` (how it looks) and `data` (what it is).
 */

export type ObjectType =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "polygon"
  | "line"
  | "arrow"
  | "draw"
  | "text"
  | "note"
  | "image"
  | "embed"
  | "icon"
  | "list"
  | "placeholder"
  | "table"
  | "card"
  | "media"
  | "frame"
  | "measure"
  | "vector"
  | "adjustment"
  | "smart"
  | "group";

export type DashStyle = "solid" | "dashed" | "dotted";
export type NoteKind =
  | "idea"
  | "question"
  | "important"
  | "research"
  | "todo"
  | "plan"
  | "quote"
  | "cool";
export type FontKey =
  | "sans"
  | "serif"
  | "display"
  | "mono"
  | "hand"
  | "marker"
  | "script"
  | (string & {});
export type TextRole = "heading" | "subhead" | "body" | "caption" | "label";
export type FrameKind = "plain" | "browser" | "phone" | "tablet" | "desktop" | "watch";
export type Unit = "px" | "mm" | "cm" | "in";

/**
 * Pixel effects, applied to the object's rendered bitmap (Photoshop-style
 * adjustment stack). Every value has a neutral default so an empty object is
 * "no effects".
 */
export interface Effects {
  /** 0..40 px. */
  blur?: number;
  /** -1..1 */
  brightness?: number;
  /** -100..100 */
  contrast?: number;
  /** -2..10 — negative desaturates. */
  saturation?: number;
  /** -1..1 (× 180°) */
  hue?: number;
  grayscale?: boolean;
  sepia?: boolean;
  invert?: boolean;
  /** 1..64 block size, 1 = off. */
  pixelate?: number;
  /** 0..1 */
  noise?: number;
  /** 0 = off, else 2..32 levels. */
  posterize?: number;
  /** 0 = off, else 0..1 cut-off. */
  threshold?: number;
  emboss?: number;
  solarize?: boolean;
  /** 0..1 enhance (auto levels). */
  enhance?: number;
}

export interface ShadowSpec {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export type AdjustmentType =
  | "brightnessContrast"
  | "levels"
  | "curves"
  | "exposure"
  | "vibrance"
  | "hueSaturation"
  | "colorBalance"
  | "blackAndWhite"
  | "photoFilter"
  | "channelMixer"
  | "colorLookup"
  | "invert"
  | "posterize"
  | "threshold"
  | "gradientMap"
  | "selectiveColor";

export interface LayerMask {
  type: "pixel" | "vector";
  dataUrl?: string;
  density: number; // 0..1
  feather: number; // 0..100
  inverted: boolean;
  enabled: boolean;
  path?: string;
}

export interface SmartFilter {
  id: string;
  name: string;
  type: string;
  params: Record<string, any>;
  enabled: boolean;
}

export interface SmartObjectData {
  src?: string;
  width: number;
  height: number;
  objects?: Record<string, CanvasObject>;
  order?: string[];
  smartFilters?: SmartFilter[];
}

export interface ObjectStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: DashStyle;
  radius?: number;
  color?: string;
  fontSize?: number;
  fontFamily?: FontKey;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
  letterSpacing?: number;
  kerning?: number;
  horizontalScale?: number;
  verticalScale?: number;
  baselineShift?: number;
  fauxBold?: boolean;
  fauxItalic?: boolean;
  allCaps?: boolean;
  smallCaps?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  strokeAlign?: "inside" | "center" | "outside";
  strokeCap?: CanvasLineCap;
  strokeJoin?: CanvasLineJoin;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  padding?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** -1..1 — perpendicular bow applied to arrows and lines. */
  curve?: number;
  elbow?: boolean;
  /** Freehand smoothing: 0 raw, 1 smooth, 2 very smooth. */
  smoothing?: number;
  shadow?: boolean;
  /** Parametric shadow — overrides the simple `shadow` flag when present. */
  shadowSpec?: ShadowSpec | null;
  /** Pixel effect stack. */
  effects?: Effects | null;
  /** Two-stop linear fill; angle in degrees across the object box. */
  gradient?: { from: string; to: string; angle: number } | null;
  /** Canvas composite operation, e.g. multiply or screen. */
  blend?: string;
  /** Text case applied at render time; the stored text keeps its case. */
  textTransform?: "none" | "uppercase" | "capitalize";
  /** Line prefixes drawn at render time: bullets or numbers per line. */
  textList?: "none" | "bullet" | "number" | "check";
}

export interface EndpointBinding {
  /** Object this end is docked to; the arrow follows it. */
  id: string;
  /** Normalised anchor inside that object, or undefined for "nearest edge". */
  ax?: number;
  ay?: number;
}

export interface ObjectData {
  text?: string;
  /** Freehand strokes: flat [x, y, pressure, ...] in object-local units. */
  points?: number[];
  src?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  /** Normalised crop window inside the source image. */
  crop?: { x: number; y: number; width: number; height: number };
  flipX?: boolean;
  flipY?: boolean;
  /** Masked shape: how the picture sits inside — pan in shape pixels, zoom as a multiplier of "cover". */
  imageOffset?: { x: number; y: number };
  imageScale?: number;
  /** Point text: the box hugs its content instead of wrapping at a fixed width. */
  autoWidth?: boolean;
  /** Ghosted tracing reference: visible, dimmed, not selectable. */
  trace?: boolean;
  noteKind?: NoteKind;
  textRole?: TextRole;
  /** Group membership (type: "group"). */
  children?: string[];
  frameKind?: FrameKind;
  /** Browser frame address bar text. */
  url?: string;
  /** Embed cards: a link or video reference. */
  embedKind?: "link" | "video" | "site";
  /** Playable media on the board. */
  mediaKind?: "video" | "audio";
  loop?: boolean;
  muted?: boolean;
  title?: string;
  provider?: string;
  from?: EndpointBinding;
  to?: EndpointBinding;
  /** Measurement label override. */
  label?: string;
  /** Illustration: an SVG path drawn in a 0-100 box. */
  path?: string;
  /** Collapsible outline rows. */
  items?: ListItem[];
  /** Outline style. */
  listKind?: "bullet" | "number" | "check";
  /** Table contents: rows of cells, first row treated as the header. */
  rows?: string[][];
  /** Flashcard faces. */
  front?: string;
  back?: string;
  flipped?: boolean;
  /** Vector object: traced or imported SVG paths in a `viewBox` space. */
  paths?: VectorPath[];
  viewBox?: { width: number; height: number };
  /** Generated site: a single-file HTML document. */
  html?: string;
  /** Polygon: number of sides, and an optional star variant. */
  sides?: number;
  star?: boolean;
  innerRatio?: number;
  /** Adjustment layer type and parameters. */
  adjustmentType?: AdjustmentType;
  adjustmentParams?: any;
  /** Smart object container data. */
  smartObject?: SmartObjectData;
}

export interface VectorPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface ListItem {
  id: string;
  text: string;
  /** Indent depth, 0-4. */
  level: number;
  collapsed?: boolean;
  checked?: boolean;
}

export interface CanvasObject {
  id: string;
  type: ObjectType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fillOpacity?: number; // 0..1
  locked: boolean;
  lockedPixels?: boolean;
  lockedPosition?: boolean;
  hidden: boolean;
  clippingMask?: boolean; // Clips to alpha/bounds of layer directly underneath
  mask?: LayerMask;
  parentId?: string;
  style: ObjectStyle;
  data: ObjectData;
}

export type BackgroundKind =
  | "blank"
  | "dots"
  | "grid"
  | "blueprint"
  | "paper"
  | "slate"
  | "transparent";

export type RenderMode = "sketch" | "normal" | "precision";

export interface PageSize {
  width: number;
  height: number;
  label: string;
}

/** Ordered animation cels — each entry is a frame object id (Procreate-style). */
export interface AnimationState {
  cels: string[];
  fps: number;
  loop: "loop" | "pingpong" | "once";
  /** How many neighbouring cels to ghost behind the current one. */
  onion: number;
}

export interface BoardSettings {
  background: BackgroundKind;
  gridSize: number;
  gridOpacity: number;
  snapToGrid: boolean;
  snapToObjects: boolean;
  renderMode: RenderMode;
  unit: Unit;
  /** Board pixels per unit — lets measurements read in real-world units. */
  unitScale: number;
  /** Fixed canvas size, or null for an unbounded board. */
  page: PageSize | null;
}

/** One section on a built site: which pattern, and the copy filled into it. */
export interface SiteSection {
  /** Stable per-instance id (a section pattern can appear twice). */
  uid: string;
  /** Pattern id from the section database, e.g. "HERO_01". */
  id: string;
  content: Record<string, string>;
}

export interface SiteBrief {
  brand: string;
  type: string;
  offer: string;
  audience: string;
  style: string;
}

/** The site built alongside a board — persisted with it. */
export interface SiteState {
  brief: SiteBrief;
  sections: SiteSection[];
  theme: string;
  /** Last generated HTML, if any. */
  html?: string;
}

export interface BoardDoc {
  id: string;
  name: string;
  /** Flat object store keyed by id. */
  objects: Record<string, CanvasObject>;
  /** Bottom-to-top paint order. */
  order: string[];
  settings: BoardSettings;
  animation: AnimationState;
  site?: SiteState;
  createdAt?: number;
  updatedAt: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type ToolId =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "eraser"
  | "arrow"
  | "line"
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "polygon"
  | "frame"
  | "text"
  | "note"
  | "measure"
  | "list"
  | "table"
  | "card"
  | "placeholder"
  | "image";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
