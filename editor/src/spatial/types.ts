/** Spatial canvas object model. One flat list of objects; everything else is presentation. */

export type Vec3 = [number, number, number];

export type ToolId = "draw" | "select" | "plane" | "move" | "view" | "erase" | "pull";

export type TipKind = "round" | "hard" | "chisel" | "bristle" | "chalk" | "spray" | "square" | "ink";
export type GrainKind = "none" | "paper" | "canvas" | "noise" | "chalk" | "crosshatch" | "metal";
export type GeomKind = "ribbon" | "tube" | "spray" | "hatch";

export interface Brush {
  id: string;
  name: string;
  set: string;
  geom: GeomKind;
  tip: TipKind;
  grain: GrainKind;
  /** How many brush-widths of grain fit along one brush-width of stroke. */
  grainScale: number;
  /** 0 = grain invisible, 1 = grain fully cuts the stroke. */
  grainDepth: number;
  size: number;
  opacity: number;
  flow: number;
  /** Dab spacing for spray/hatch, in brush-widths. */
  spacing: number;
  jitter: number;
  scatter: number;
  taper: number;
  pressureSize: number;
  pressureOpacity: number;
  velocitySize: number;
  smoothing: number;
  wobble: number;
  /** Bristle streak count baked into the tip; 0 for a solid tip. */
  streaks: number;
  blend: "normal" | "add";
  glow: number;
  /** 0 = flat/emissive (Tilt Brush look), 1 = fully shaded (reads volumetric). */
  shade: number;
  tubeSides: number;
  builtin: boolean;
}

export interface Stroke {
  id: string;
  kind: "stroke";
  layer: string;
  brush: string;
  color: string;
  size: number;
  opacity: number;
  seed: number;
  /** Ribbon orientation, baked at draw time so geometry never needs rebuilding. */
  normal: Vec3;
  /** Flat [x, y, z, pressure, ...]. */
  pts: number[];
  planeId?: string | null;
  name?: string;
  parentId?: string | null;
  locked?: boolean;
  visible?: boolean;
}

export type SolidMode = "extrude" | "inflate" | "revolve";
export type SolidShade = "matte" | "glossy" | "metal" | "glass" | "flat";

export interface Solid {
  id: string;
  kind: "solid";
  layer: string;
  color: string;
  opacity: number;
  mode: SolidMode;
  shade: SolidShade;
  /** Profile in plane coordinates, flat [u, v, ...]. */
  profile: number[];
  origin: Vec3;
  ax: Vec3;
  ay: Vec3;
  an: Vec3;
  height: number;
  bevel: number;
  /** Extrude symmetrically about the plane instead of only along +n. */
  centered: boolean;
  wire: boolean;
  name?: string;
  parentId?: string | null;
  locked?: boolean;
  visible?: boolean;
}

/* ---------------------------------------------------------- 3D primitives */

export type PrimKind =
  | "cube" | "sphere" | "icosphere" | "cylinder" | "cone"
  | "torus" | "plane" | "capsule" | "torusknot" | "tube";

export interface Prim {
  id: string;
  kind: "prim";
  layer: string;
  prim: PrimKind;
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
  color: string;
  opacity: number;
  shade: SolidShade;
  /** Segment count; what Blender calls the primitive's resolution. */
  detail: number;
  wire: boolean;
  /** Faceted rather than smooth, the way a low-poly block should read. */
  faceted: boolean;
  parentId?: string | null;
  locked?: boolean;
  visible?: boolean;
  name?: string;
}

/* -------------------------------------------------------- imported models */

export interface ModelObj {
  id: string;
  kind: "model";
  layer: string;
  /** "builtin:mannequin", or an asset key held in IndexedDB. */
  src: string;
  name: string;
  assetId?: string;
  preserveScale?: boolean;
  pos: Vec3;
  rot: Vec3;
  scale: Vec3;
  /** null keeps the file's own materials. */
  color: string | null;
  opacity: number;
  shade: SolidShade;
  wire: boolean;
  /** Bone name to euler rotation. Only rigged models have one. */
  pose?: Record<string, Vec3>;
  parentId?: string | null;
  locked?: boolean;
  visible?: boolean;
}

/* ------------------------------------------------------ cameras & lighting */

export interface CameraGuides {
  ruleOfThirds: boolean;
  centerCross: boolean;
  safeArea: boolean;
  horizon: boolean;
  goldenRatio: boolean;
}

export interface CameraObj {
  id: string;
  kind: "camera";
  layer: string;
  name: string;
  pos: Vec3;
  rot: Vec3;
  target?: Vec3;
  fov: number;
  ortho: boolean;
  near: number;
  far: number;
  focalLength?: number;
  locked?: boolean;
  visible?: boolean;
  parentId?: string | null;
  guides: CameraGuides;
}

export type LightKind = "directional" | "point" | "spot" | "ambient" | "hemisphere";

export interface LightObj {
  id: string;
  kind: "light";
  layer: string;
  name: string;
  lightKind: LightKind;
  pos: Vec3;
  rot?: Vec3;
  target?: Vec3;
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  castShadow: boolean;
  locked?: boolean;
  visible?: boolean;
  parentId?: string | null;
}

/* -------------------------------------------------------- spatial guides */

export type GuideKind = "measure" | "label" | "arrow" | "box";

export interface GuideObj {
  id: string;
  kind: "guide";
  layer: string;
  name: string;
  guideKind: GuideKind;
  pos: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  to?: Vec3;
  label?: string;
  color: string;
  size?: number;
  locked?: boolean;
  visible?: boolean;
  parentId?: string | null;
}

/* ------------------------------------------------------- flat 2D elements */

export type FlatKind = "rect" | "ellipse" | "text" | "note" | "image";

/**
 * A piece of the 2D world living on a plane inside the 3D one: the same
 * rectangles, type and sticky notes a flat canvas has, placed in space.
 */
export interface Flat {
  id: string;
  kind: "flat";
  layer: string;
  flat: FlatKind;
  origin: Vec3;
  ax: Vec3;
  ay: Vec3;
  an: Vec3;
  /** Rect in plane coordinates: centre and size. */
  u: number;
  v: number;
  w: number;
  h: number;
  /** In-plane rotation, radians. */
  spin: number;
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  fontSize: number;
  fontFamily: string;
  align: "left" | "center" | "right";
  textColor: string;
  /** Asset key or data URL for images. */
  src?: string;
  /** Always turn to face the camera, like a label. */
  billboard: boolean;
  parentId?: string | null;
  locked?: boolean;
  visible?: boolean;
  name?: string;
}

export type SceneObject = Stroke | Solid | Prim | ModelObj | Flat | CameraObj | LightObj | GuideObj;

/** Anything with a free transform in space, as opposed to baked geometry. */
export type Placed = Prim | ModelObj | CameraObj | LightObj | GuideObj;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export type PlanePreset = "ground" | "front" | "side" | "custom";

export interface PlaneState {
  preset: PlanePreset;
  /** Euler XYZ in radians; identity means the XY plane facing +Z. */
  rot: Vec3;
  /** Slide along the plane normal. */
  offset: number;
  size: number;
  visible: boolean;
  grid: number;
  snap: boolean;
  /** Lock drawing to the plane even in space mode. */
  lock: boolean;
}

export type DrawSpace = "plane" | "space";

export type EnvPreset = "void" | "studio" | "night" | "dusk" | "paper" | "cyclorama";

export interface EnvState {
  preset: EnvPreset;
  bgTop: string;
  bgBottom: string;
  fog: number;
  fogColor: string;
  grid: boolean;
  floor: boolean;
  /** Post-processing. */
  bloom: number;
  bloomThreshold: number;
  grain: number;
  vignette: number;
  chroma: number;
  exposure: number;
  saturation: number;
  /** Lighting. */
  keyIntensity: number;
  ambient: number;
  lightAngle: number;
  shadows: boolean;
  /** Slow automatic orbit, for presenting. */
  turntable: number;
}

export interface CameraState {
  target: Vec3;
  /** Spherical around target. */
  theta: number;
  phi: number;
  dist: number;
  fov: number;
  ortho: boolean;
}

export interface Sketch {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  objects: SceneObject[];
  layers: Layer[];
  activeLayer: string;
  plane: PlaneState;
  env: EnvState;
  camera: CameraState;
  /** Custom brushes saved with the sketch travel with it. */
  brushes: Brush[];
  /** One world unit is one metre; this is only how lengths are displayed. */
  units: UnitSystem;
}

export type UnitSystem = "m" | "cm" | "mm" | "ft" | "in";

export interface SketchMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumb?: string;
  objectCount: number;
}
