import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Draft } from "immer";
import * as THREE from "three";

import type {
  Brush, CameraObj, CameraState, DrawSpace, EnvPreset, EnvState, Flat, FlatKind, GuideKind, GuideObj,
  Layer, LightKind, LightObj, ModelObj, PlanePreset, PlaneState, Prim, PrimKind, SceneObject,
  Sketch, Solid, SolidMode, Stroke, ToolId, UnitSystem, Vec3,
} from "../types";
import { BRUSHES } from "../engine/brushes";
import { DEFAULT_ENV, applyPreset } from "../engine/env";
import { planeBasis } from "../engine/plane";
import { primSpec } from "../engine/prims";
import { NOTE_STYLES } from "../engine/flats";
import { strokeToProfile } from "../engine/solids";
import { POSE_PRESETS, mirrorPose } from "../engine/models";
import { saveSketch } from "../persist/idb";

/* ---------------------------------------------------------------- helpers */

let seq = 0;
export const uid = (p = "o") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

const HISTORY = 60;

/**
 * Where the next object lands. Stacking everything on the origin means the
 * first thing you do after adding a second shape is drag it off the first, so
 * new objects step outward along a spiral instead.
 */
function nextSpot(count: number, radius: number): [number, number] {
  if (count === 0) return [0, 0];
  const ring = Math.ceil((Math.sqrt(count + 1) - 1) / 2) || 1;
  const angle = (count * 2.39996) % (Math.PI * 2); // golden angle keeps rings even
  const r = radius * (0.8 + ring * 0.55);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/** A patch for any object kind; the store only applies the keys it is given. */
export type ObjectPatch = Partial<Stroke> & Partial<Solid> & Partial<Prim> & Partial<ModelObj> & Partial<Flat> & Partial<CameraObj> & Partial<LightObj> & Partial<GuideObj>;

export type Drawer = null | "brush" | "color" | "layers" | "plane" | "env" | "export" | "settings" | "help";

export interface Prefs {
  quality: "high" | "balanced" | "battery";
  leftHanded: boolean;
  stabilizer: number;
  pressureCurve: number;
  invertScroll: boolean;
  showHints: boolean;
  autoSave: boolean;
  keepOutline: boolean;
  snapDepth: boolean;
  gestureUndo: boolean;
  theme: "dark" | "light";
}

const DEFAULT_PREFS: Prefs = {
  quality: "high",
  leftHanded: false,
  stabilizer: 0.4,
  pressureCurve: 0.5,
  invertScroll: false,
  showHints: true,
  autoSave: true,
  keepOutline: true,
  snapDepth: true,
  gestureUndo: true,
  theme: "dark",
};

const PREFS_KEY = "coolsketch:prefs";

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* first run, or storage blocked */
  }
  return DEFAULT_PREFS;
}

/* --------------------------------------------------------------- defaults */

export const DEFAULT_PLANE: PlaneState = {
  preset: "ground",
  rot: [0, 0, 0],
  offset: 0,
  // Four metres across at a quarter-metre grid: a room, not a field. The
  // mannequin stands 1.8 m, so the scene has a believable sense of size.
  size: 4,
  visible: true,
  grid: 0.25,
  snap: false,
  lock: false,
};

export const DEFAULT_CAMERA: CameraState = {
  target: [0, 0.75, 0],
  theta: Math.PI * 0.25,
  phi: Math.PI * 0.32,
  dist: 4.6,
  fov: 45,
  ortho: false,
};

export type TemplateId = "blank" | "character" | "product" | "architecture" | "motion" | "diagram";

export interface Template {
  id: TemplateId;
  name: string;
  blurb: string;
  plane: Partial<PlaneState>;
  env: EnvPreset;
  camera: Partial<CameraState>;
  brush: string;
  color: string;
  space: DrawSpace;
}

export const TEMPLATES: Template[] = [
  {
    id: "blank", name: "Blank", blurb: "Ground plane, empty space.",
    plane: {}, env: "paper", camera: {}, brush: "studio-pen", color: "#1A1A18", space: "plane",
  },
  {
    id: "character", name: "Character", blurb: "Front plane, soft key light, pencil.",
    plane: { preset: "front", size: 3, grid: 0.1 }, env: "paper",
    camera: { theta: Math.PI * 0.5, phi: Math.PI * 0.5, dist: 3.6, target: [0, 1, 0] },
    brush: "pencil-6b", color: "#1A1A18", space: "plane",
  },
  {
    id: "product", name: "Product", blurb: "Cyclorama, studio light, clean ink.",
    plane: { preset: "ground", size: 2, grid: 0.05, snap: true }, env: "cyclorama",
    camera: { theta: Math.PI * 0.28, phi: Math.PI * 0.4, dist: 2.2, target: [0, 0.35, 0] },
    brush: "studio-pen", color: "#1A1A18", space: "plane",
  },
  {
    id: "architecture", name: "Architecture", blurb: "Big grid, snapping on, technical line.",
    plane: { preset: "ground", size: 24, grid: 1, snap: true }, env: "paper",
    camera: { theta: Math.PI * 0.2, phi: Math.PI * 0.36, dist: 20, target: [0, 1.6, 0] },
    brush: "pencil-tech", color: "#B9C2DA", space: "plane",
  },
  {
    id: "motion", name: "Light trails", blurb: "Night, heavy bloom, neon in free space.",
    plane: { preset: "ground", size: 6, visible: false }, env: "night",
    camera: { theta: Math.PI * 0.35, phi: Math.PI * 0.42, dist: 5.5, target: [0, 1.2, 0] },
    brush: "neon-tube", color: "#4FE3DC", space: "space",
  },
  {
    id: "diagram", name: "Diagram", blurb: "Flat planes, marker, readable from anywhere.",
    plane: { preset: "front", size: 6, grid: 0.25, snap: true }, env: "paper",
    camera: { theta: Math.PI * 0.5, phi: Math.PI * 0.5, dist: 5, target: [0, 1, 0] },
    brush: "marker", color: "#2E3448", space: "plane",
  },
];

export function makeLayer(name: string): Layer {
  return { id: uid("l"), name, visible: true, locked: false, opacity: 1 };
}

export function makeSketch(template: TemplateId = "blank", name?: string): Sketch {
  const t = TEMPLATES.find((x) => x.id === template) ?? TEMPLATES[0];
  const layer = makeLayer("Layer 1");
  return {
    id: uid("s"),
    name: name ?? (template === "blank" ? "Untitled sketch" : t.name),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects: [],
    layers: [layer],
    activeLayer: layer.id,
    plane: { ...DEFAULT_PLANE, ...t.plane },
    env: applyPreset({ ...DEFAULT_ENV }, t.env),
    camera: { ...DEFAULT_CAMERA, ...t.camera },
    brushes: [],
    units: "cm",
  };
}

/* ------------------------------------------------------------------ state */

interface State {
  sketch: Sketch;
  past: Sketch[];
  future: Sketch[];
  gesture: boolean;

  tool: ToolId;
  space: DrawSpace;
  depth: number;
  brushId: string;
  color: string;
  size: number;
  opacity: number;
  recentColors: string[];
  selection: string[];
  drawer: Drawer;
  prefs: Prefs;
  dirty: boolean;
  /** How the Pull tool turns an outline into form. */
  pullMode: SolidMode;
  setPullMode: (m: SolidMode) => void;
  /** How the transform handles behave for the current selection. */
  gizmoMode: "translate" | "rotate" | "scale";
  gizmoSpace: "world" | "local";
  /** True between the first and last event of a handle drag. */
  gizmoDragging: boolean;
  /** The joint currently being posed, if any. */
  /** Joint handles are showing and the rig can be moved. */
  posing: boolean;
  setPosing: (v: boolean) => void;
  poseBone: string | null;
  setPoseBone: (b: string | null) => void;
  setBoneRotation: (modelId: string, bone: string, euler: Vec3) => void;
  clearPose: (modelId: string) => void;
  applyPosePreset: (modelId: string, presetId: string) => void;
  mirrorPoseOnModel: (modelId: string) => void;
  copyPose: (modelId: string) => void;
  pastePose: (modelId: string) => void;
  copiedPose: Record<string, Vec3> | null;
  setGizmoMode: (m: "translate" | "rotate" | "scale") => void;
  setGizmoSpace: (s: "world" | "local") => void;

  activeCameraId: string | null;
  setActiveCameraId: (id: string | null) => void;

  brushes: () => Brush[];
  brush: () => Brush;
  activeLayerLocked: () => boolean;

  setTool: (t: ToolId) => void;
  setSpace: (s: DrawSpace) => void;
  setDepth: (d: number) => void;
  setBrush: (id: string) => void;
  setColor: (c: string) => void;
  setSize: (s: number) => void;
  setOpacity: (o: number) => void;
  setDrawer: (d: Drawer) => void;
  setPrefs: (p: Partial<Prefs>) => void;

  newSketch: (t?: TemplateId, name?: string) => void;
  openSketch: (s: Sketch) => void;
  renameSketch: (n: string) => void;
  persist: (thumb?: string) => Promise<void>;

  addStroke: (s: Stroke) => void;
  addSolid: (s: Solid) => void;
  addPrim: (kind: PrimKind, at?: Vec3) => string;
  addModel: (src: string, name: string, at?: Vec3, preserveScale?: boolean, assetId?: string) => string;
  addFlat: (kind: FlatKind, opts?: Partial<Flat>) => string;
  addCamera: (opts?: Partial<CameraObj>) => string;
  addLight: (kind?: LightKind, opts?: Partial<LightObj>) => string;
  addGuide: (kind?: GuideKind, opts?: Partial<GuideObj>) => string;
  snapToGround: (id: string) => void;
  renameObject: (id: string, name: string) => void;
  setParent: (childId: string, parentId: string | null) => void;
  setObjectVisibility: (id: string, visible: boolean) => void;
  setObjectLocked: (id: string, locked: boolean) => void;
  placeObject: (id: string, pos: Vec3, rot: Vec3, scale: Vec3) => void;
  setUnits: (u: UnitSystem) => void;
  removeObjects: (ids: string[]) => void;
  updateObject: (id: string, patch: ObjectPatch) => void;
  transformObjects: (ids: string[], m: THREE.Matrix4) => void;
  duplicateSelection: (offset?: Vec3) => void;
  recolorSelection: (color: string) => void;
  moveSelectionToLayer: (layerId: string) => void;

  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  pull: (ids: string[], height: number, mode: SolidMode) => string[];

  addLayer: () => void;
  deleteLayer: (id: string) => void;
  setLayer: (id: string, patch: Partial<Layer>) => void;
  reorderLayer: (id: string, dir: -1 | 1) => void;
  mergeDown: (id: string) => void;
  setActiveLayer: (id: string) => void;

  setPlane: (p: Partial<PlaneState>) => void;
  setPlanePreset: (p: PlanePreset) => void;
  setEnv: (e: Partial<EnvState>) => void;
  setEnvPreset: (p: EnvPreset) => void;
  setCamera: (c: Partial<CameraState>) => void;

  saveBrush: (b: Brush) => void;
  deleteBrush: (id: string) => void;

  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useStore = create<State>()(
  immer((set, get) => {
    /** Every document mutation goes through here so history stays honest. */
    const edit = (recipe: (d: Draft<Sketch>) => void, record = true) => {
      const prev = get().sketch;
      const shouldRecord = record && !get().gesture;
      set((s) => {
        if (shouldRecord) {
          s.past.push(prev);
          if (s.past.length > HISTORY) s.past.shift();
          s.future = [];
        }
        recipe(s.sketch);
        s.sketch.updatedAt = Date.now();
        s.dirty = true;
      });
    };

    const prefs = loadPrefs();

    return {
      sketch: makeSketch("blank"),
      past: [],
      future: [],
      gesture: false,

      tool: "draw",
      space: "plane",
      depth: 11,
      brushId: "studio-pen",
      color: "#1A1A18",
      size: 0.03,
      opacity: 1,
      recentColors: ["#EEF2FB", "#4FE3DC", "#7B6CFF", "#FF8A5B"],
      selection: [],
      drawer: null,
      prefs,
      dirty: false,
      pullMode: "extrude",
      setPullMode: (m) => set((s) => { s.pullMode = m; }),

      brushes: () => [...BRUSHES, ...get().sketch.brushes],
      brush: () => {
        const all = get().brushes();
        return all.find((b) => b.id === get().brushId) ?? all[0];
      },
      activeLayerLocked: () => {
        const s = get().sketch;
        const l = s.layers.find((x) => x.id === s.activeLayer);
        return !l || l.locked || !l.visible;
      },

      /* ------------------------------------------------------------ tools */

      setTool: (t) => set((s) => { s.tool = t; if (t !== "select" && t !== "pull") s.selection = []; }),
      setSpace: (sp) => set((s) => { s.space = sp; }),
      setDepth: (d) => set((s) => { s.depth = Math.max(0.4, d); }),
      setBrush: (id) =>
        set((s) => {
          s.brushId = id;
          const b = [...BRUSHES, ...s.sketch.brushes].find((x) => x.id === id);
          if (b) { s.size = b.size; s.opacity = b.opacity; }
        }),
      setColor: (c) =>
        set((s) => {
          s.color = c;
          s.recentColors = [c, ...s.recentColors.filter((x) => x !== c)].slice(0, 12);
        }),
      setSize: (v) => set((s) => { s.size = Math.max(0.002, Math.min(2, v)); }),
      setOpacity: (v) => set((s) => { s.opacity = Math.max(0.02, Math.min(1, v)); }),
      setDrawer: (d) => set((s) => { s.drawer = s.drawer === d ? null : d; }),
      setPrefs: (p) =>
        set((s) => {
          Object.assign(s.prefs, p);
          try { localStorage.setItem(PREFS_KEY, JSON.stringify(s.prefs)); } catch { /* storage blocked */ }
        }),

      /* --------------------------------------------------------- document */

      newSketch: (t = "blank", name) => {
        const sketch = makeSketch(t, name);
        const tpl = TEMPLATES.find((x) => x.id === t);
        set((s) => {
          s.sketch = sketch;
          s.past = [];
          s.future = [];
          s.selection = [];
          s.dirty = true;
          if (tpl) { s.brushId = tpl.brush; s.color = tpl.color; s.space = tpl.space; }
        });
        const b = get().brushes().find((x) => x.id === get().brushId);
        if (b) set((s) => { s.size = b.size; s.opacity = b.opacity; });
      },

      openSketch: (sk) =>
        set((s) => {
          s.sketch = sk;
          s.past = [];
          s.future = [];
          s.selection = [];
          s.dirty = false;
        }),

      renameSketch: (n) => edit((d) => { d.name = n || "Untitled sketch"; }),

      persist: async (thumb) => {
        const s = get().sketch;
        await saveSketch(s, thumb);
        set((st) => { st.dirty = false; });
      },

      /* ---------------------------------------------------------- objects */

      gizmoMode: "translate",
      gizmoSpace: "world",
      gizmoDragging: false,
      posing: false,
      setPosing: (v) => set((st) => { st.posing = v; if (!v) st.poseBone = null; }),
      poseBone: null,
      setPoseBone: (b) => set((st) => { st.poseBone = b; }),
      setBoneRotation: (modelId, bone, euler) =>
        edit((d) => {
          const o = d.objects.find((x) => x.id === modelId);
          if (o?.kind !== "model") return;
          if (!o.pose) o.pose = {};
          o.pose[bone] = euler;
        }, false),
      clearPose: (modelId) =>
        edit((d) => {
          const o = d.objects.find((x) => x.id === modelId);
          if (o?.kind === "model") o.pose = {};
        }),
      applyPosePreset: (modelId, presetId) => {
        const preset = POSE_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        edit((d) => {
          const o = d.objects.find((x) => x.id === modelId);
          if (o?.kind === "model") {
            o.pose = { ...(preset.pose as Record<string, Vec3>) };
          }
        });
      },
      mirrorPoseOnModel: (modelId) => {
        edit((d) => {
          const o = d.objects.find((x) => x.id === modelId);
          if (o?.kind === "model" && o.pose) {
            o.pose = mirrorPose(o.pose as Record<string, [number, number, number]>) as Record<string, Vec3>;
          }
        });
      },
      copiedPose: null,
      copyPose: (modelId) => {
        const o = get().sketch.objects.find((x) => x.id === modelId);
        if (o?.kind === "model" && o.pose) {
          set({ copiedPose: JSON.parse(JSON.stringify(o.pose)) });
        }
      },
      pastePose: (modelId) => {
        const copied = get().copiedPose;
        if (!copied) return;
        edit((d) => {
          const o = d.objects.find((x) => x.id === modelId);
          if (o?.kind === "model") {
            o.pose = JSON.parse(JSON.stringify(copied));
          }
        });
      },
      activeCameraId: null,
      setActiveCameraId: (id) => set({ activeCameraId: id }),
      setGizmoMode: (m) => set((s) => { s.gizmoMode = m; }),
      setGizmoSpace: (sp) => set((s) => { s.gizmoSpace = sp; }),

      addStroke: (stroke) => edit((d) => { d.objects.push(stroke); }),
      addSolid: (solid) => edit((d) => { d.objects.push(solid); }),

      addPrim: (kind, at) => {
        const spec = primSpec(kind);
        const st = get();
        // Land on the construction plane rather than at the world origin, and
        // sit on top of it so a new block never buries itself in the ground.
        const basis = planeBasis(st.sketch.plane);
        const [ou, ov] = nextSpot(st.sketch.objects.length, Math.max(spec.size[0], spec.size[2]) * 3.4);
        const base: Vec3 = at ?? [
          basis.origin.x + basis.n.x * spec.size[1] + basis.x.x * ou + basis.y.x * ov,
          basis.origin.y + basis.n.y * spec.size[1] + basis.x.y * ou + basis.y.y * ov,
          basis.origin.z + basis.n.z * spec.size[1] + basis.x.z * ou + basis.y.z * ov,
        ];
        const prim: Prim = {
          id: uid("pr"),
          kind: "prim",
          layer: st.sketch.activeLayer,
          prim: kind,
          name: kind[0].toUpperCase() + kind.slice(1),
          pos: base,
          rot: [0, 0, 0],
          scale: spec.size,
          color: "#C7D2E6",
          opacity: 1,
          shade: "matte",
          detail: spec.detail,
          wire: false,
          faceted: kind === "icosphere",
        };
        edit((d) => { d.objects.push(prim); });
        set((s) => { s.selection = [prim.id]; s.tool = "select"; });
        return prim.id;
      },

      addModel: (src, name, at, preserveScale = true, assetId) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const [ou, ov] = nextSpot(st.sketch.objects.length, 1.0);
        const model: ModelObj = {
          id: uid("md"),
          kind: "model",
          layer: st.sketch.activeLayer,
          src,
          name,
          assetId,
          preserveScale: src.startsWith("builtin:") ? false : preserveScale,
          pos: at ?? [
            basis.origin.x + basis.x.x * ou + basis.y.x * ov,
            basis.origin.y + basis.x.y * ou + basis.y.y * ov,
            basis.origin.z + basis.x.z * ou + basis.y.z * ov,
          ],
          rot: [0, 0, 0],
          scale: [1, 1, 1],
          color: src.startsWith("builtin:") ? "#C3CBDC" : null,
          opacity: 1,
          shade: "matte",
          wire: false,
        };
        edit((d) => { d.objects.push(model); });
        set((s) => { s.selection = [model.id]; s.tool = "select"; });
        return model.id;
      },

      addFlat: (kind, opts) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const [ou, ov] = nextSpot(st.sketch.objects.length, 0.55);
        const note = NOTE_STYLES[0];
        const isNote = kind === "note";
        const flat: Flat = {
          id: uid("fl"),
          kind: "flat",
          layer: st.sketch.activeLayer,
          flat: kind,
          origin: [basis.origin.x, basis.origin.y, basis.origin.z],
          ax: [basis.x.x, basis.x.y, basis.x.z],
          ay: [basis.y.x, basis.y.y, basis.y.z],
          an: [basis.n.x, basis.n.y, basis.n.z],
          u: ou,
          v: ov,
          w: kind === "text" ? 1.2 : 0.7,
          h: kind === "text" ? 0.3 : 0.7,
          spin: 0,
          text: isNote ? "New note" : kind === "text" ? "Type here" : "",
          fill: isNote ? note.fill : kind === "text" ? "none" : "#FFFFFF",
          stroke: isNote ? note.stroke : "#1A1A18",
          strokeWidth: kind === "text" ? 0 : 0.004,
          radius: isNote ? 0.02 : 0.012,
          fontSize: isNote ? 0.075 : 0.12,
          fontFamily: '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif',
          align: isNote ? "left" : "center",
          textColor: isNote ? note.ink : "#1A1A18",
          billboard: false,
          ...opts,
        };
        edit((d) => { d.objects.push(flat); });
        set((s) => { s.selection = [flat.id]; s.tool = "select"; });
        return flat.id;
      },

      addCamera: (opts) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const [ou, ov] = nextSpot(st.sketch.objects.length, 1.2);
        const cam: CameraObj = {
          id: uid("cm"),
          kind: "camera",
          layer: st.sketch.activeLayer,
          name: opts?.name || `Camera ${st.sketch.objects.filter((o) => o.kind === "camera").length + 1}`,
          pos: opts?.pos || [basis.origin.x + ou, basis.origin.y + 1.2, basis.origin.z + ov + 2.5],
          rot: opts?.rot || [-0.2, 0, 0],
          fov: opts?.fov || 45,
          ortho: opts?.ortho || false,
          near: opts?.near || 0.1,
          far: opts?.far || 1000,
          focalLength: opts?.focalLength || 50,
          locked: false,
          visible: true,
          guides: {
            ruleOfThirds: true,
            centerCross: false,
            safeArea: false,
            horizon: false,
            goldenRatio: false,
            ...opts?.guides,
          },
          ...opts,
        };
        edit((d) => { d.objects.push(cam); });
        set((s) => { s.selection = [cam.id]; s.tool = "select"; });
        return cam.id;
      },

      addLight: (kind = "directional", opts) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const [ou, ov] = nextSpot(st.sketch.objects.length, 1.5);
        const light: LightObj = {
          id: uid("lt"),
          kind: "light",
          layer: st.sketch.activeLayer,
          name: opts?.name || `${kind[0].toUpperCase() + kind.slice(1)} Light`,
          lightKind: kind,
          pos: opts?.pos || [basis.origin.x + ou, basis.origin.y + 2.5, basis.origin.z + ov + 1],
          color: opts?.color || "#FFFFFF",
          intensity: opts?.intensity ?? (kind === "directional" ? 1.8 : kind === "ambient" ? 0.6 : 2.5),
          castShadow: opts?.castShadow ?? (kind === "directional" || kind === "spot"),
          distance: opts?.distance || 15,
          decay: opts?.decay || 2,
          angle: opts?.angle || Math.PI / 4,
          penumbra: opts?.penumbra || 0.3,
          visible: true,
          ...opts,
        };
        edit((d) => { d.objects.push(light); });
        set((s) => { s.selection = [light.id]; s.tool = "select"; });
        return light.id;
      },

      addGuide: (kind = "measure", opts) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const guide: GuideObj = {
          id: uid("gd"),
          kind: "guide",
          layer: st.sketch.activeLayer,
          name: opts?.name || `${kind[0].toUpperCase() + kind.slice(1)} Guide`,
          guideKind: kind,
          pos: opts?.pos || [basis.origin.x, basis.origin.y + 0.1, basis.origin.z],
          to: opts?.to || [basis.origin.x, basis.origin.y + 1.8, basis.origin.z],
          label: opts?.label || (kind === "measure" ? "1.80 m" : "Marker"),
          color: opts?.color || "#38BDF8",
          size: opts?.size || 1,
          visible: true,
          ...opts,
        };
        edit((d) => { d.objects.push(guide); });
        set((s) => { s.selection = [guide.id]; s.tool = "select"; });
        return guide.id;
      },

      snapToGround: (id) => {
        const engine = (window as unknown as { __spatialEngine?: { snapToGround?: (id: string) => void } }).__spatialEngine;
        if (engine?.snapToGround) {
          engine.snapToGround(id);
        }
      },

      renameObject: (id, name) => {
        edit((d) => {
          const o = d.objects.find((x) => x.id === id);
          if (o) o.name = name;
        });
      },

      setParent: (childId, parentId) => {
        edit((d) => {
          const o = d.objects.find((x) => x.id === childId);
          if (o) o.parentId = parentId;
        });
      },

      setObjectVisibility: (id, visible) => {
        edit((d) => {
          const o = d.objects.find((x) => x.id === id);
          if (o) o.visible = visible;
        });
      },

      setObjectLocked: (id, locked) => {
        edit((d) => {
          const o = d.objects.find((x) => x.id === id);
          if (o) o.locked = locked;
        });
      },

      /** Written by the transform gizmo, so it coalesces into one undo step. */
      placeObject: (id, pos, rot, scale) =>
        edit((d) => {
          const o = d.objects.find((x) => x.id === id);
          if (!o) return;
          if (o.kind === "prim" || o.kind === "model" || o.kind === "camera" || o.kind === "light" || o.kind === "guide") {
            o.pos = pos;
            o.rot = rot;
            if (o.kind === "prim" || o.kind === "model") o.scale = scale;
          } else if (o.kind === "flat") {
            // A flat stays on its plane; the gizmo only slides and spins it there.
            const ox = new THREE.Vector3(o.ax[0], o.ax[1], o.ax[2]);
            const oy = new THREE.Vector3(o.ay[0], o.ay[1], o.ay[2]);
            const rel = new THREE.Vector3(pos[0], pos[1], pos[2]).sub(
              new THREE.Vector3(o.origin[0], o.origin[1], o.origin[2])
            );
            o.u = rel.dot(ox);
            o.v = rel.dot(oy);
            o.w = Math.max(0.02, o.w * (scale[0] || 1));
            o.h = Math.max(0.02, o.h * (scale[1] || 1));
          }
        }, false),

      setUnits: (u) => edit((d) => { d.units = u; }, false),

      removeObjects: (ids) => {
        if (!ids.length) return;
        const set_ = new Set(ids);
        edit((d) => { d.objects = d.objects.filter((o) => !set_.has(o.id)); });
        set((s) => { s.selection = s.selection.filter((i) => !set_.has(i)); });
      },

      updateObject: (id, patch) =>
        edit((d) => {
          const o = d.objects.find((x) => x.id === id);
          if (o) Object.assign(o, patch);
        }),

      transformObjects: (ids, m) => {
        if (!ids.length) return;
        const set_ = new Set(ids);
        const v = new THREE.Vector3();
        const nm = new THREE.Matrix3().setFromMatrix4(m).invert().transpose();
        const k = Math.cbrt(Math.abs(m.determinant())) || 1;
        const axis = (a: Vec3): Vec3 => {
          v.set(a[0], a[1], a[2]).applyMatrix3(nm).normalize();
          return [v.x, v.y, v.z];
        };
        const move = (a: Vec3): Vec3 => {
          v.set(a[0], a[1], a[2]).applyMatrix4(m);
          return [v.x, v.y, v.z];
        };
        edit((d) => {
          for (const o of d.objects) {
            if (!set_.has(o.id)) continue;
            switch (o.kind) {
              case "stroke": {
                const n = Math.floor(o.pts.length / 4);
                for (let i = 0; i < n; i++) {
                  v.set(o.pts[i * 4], o.pts[i * 4 + 1], o.pts[i * 4 + 2]).applyMatrix4(m);
                  o.pts[i * 4] = v.x;
                  o.pts[i * 4 + 1] = v.y;
                  o.pts[i * 4 + 2] = v.z;
                }
                o.normal = axis(o.normal);
                // A uniform scale should change stroke weight too.
                o.size *= k;
                break;
              }
              case "solid": {
                o.origin = move(o.origin);
                o.ax = axis(o.ax);
                o.ay = axis(o.ay);
                o.an = axis(o.an);
                o.height *= k;
                for (let i = 0; i < o.profile.length; i++) o.profile[i] *= k;
                break;
              }
              case "flat": {
                o.origin = move(o.origin);
                o.ax = axis(o.ax);
                o.ay = axis(o.ay);
                o.an = axis(o.an);
                o.u *= k;
                o.v *= k;
                o.w *= k;
                o.h *= k;
                break;
              }
              case "prim":
              case "model":
              case "camera":
              case "light":
              case "guide": {
                o.pos = move(o.pos);
                if (o.kind === "prim" || o.kind === "model") {
                  o.scale = [o.scale[0] * k, o.scale[1] * k, o.scale[2] * k];
                }
                break;
              }
              default:
                break;
            }
          }
        });
      },

      duplicateSelection: (offset = [0.4, 0, 0.4]) => {
        const ids = get().selection;
        if (!ids.length) return;
        const set_ = new Set(ids);
        const fresh: string[] = [];
        edit((d) => {
          const copies: SceneObject[] = [];
          for (const o of d.objects) {
            if (!set_.has(o.id)) continue;
            const c = JSON.parse(JSON.stringify(o)) as SceneObject;
            c.id = uid(o.kind === "stroke" ? "st" : o.kind === "camera" ? "cm" : o.kind === "light" ? "lt" : o.kind === "guide" ? "gd" : "sd");
            fresh.push(c.id);
            if (c.kind === "stroke") {
              const n = Math.floor(c.pts.length / 4);
              for (let i = 0; i < n; i++) {
                c.pts[i * 4] += offset[0];
                c.pts[i * 4 + 1] += offset[1];
                c.pts[i * 4 + 2] += offset[2];
              }
            } else if (c.kind === "prim" || c.kind === "model" || c.kind === "camera" || c.kind === "light" || c.kind === "guide") {
              c.pos = [c.pos[0] + offset[0], c.pos[1] + offset[1], c.pos[2] + offset[2]];
              if (c.kind === "model" && c.pose) {
                c.pose = JSON.parse(JSON.stringify(c.pose));
              }
            } else {
              c.origin = [c.origin[0] + offset[0], c.origin[1] + offset[1], c.origin[2] + offset[2]];
            }
            copies.push(c);
          }
          d.objects.push(...copies);
        });
        set((s) => { s.selection = fresh; });
      },

      recolorSelection: (color) => {
        const set_ = new Set(get().selection);
        if (!set_.size) return;
        edit((d) => {
          d.objects.forEach((o) => {
            if (!set_.has(o.id)) return;
            if (o.kind === "flat") o.fill = color;
            else if ("color" in o) (o as { color: string | null }).color = color;
          });
        });
      },

      moveSelectionToLayer: (layerId) => {
        const set_ = new Set(get().selection);
        if (!set_.size) return;
        edit((d) => { d.objects.forEach((o) => { if (set_.has(o.id)) o.layer = layerId; }); });
      },

      /* -------------------------------------------------------- selection */

      select: (ids, additive) =>
        set((s) => {
          if (!additive) { s.selection = ids; return; }
          const next = new Set(s.selection);
          ids.forEach((i) => (next.has(i) ? next.delete(i) : next.add(i)));
          s.selection = Array.from(next);
        }),
      clearSelection: () => set((s) => { s.selection = []; }),
      selectAll: () =>
        set((s) => {
          const vis = new Set(s.sketch.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
          s.selection = s.sketch.objects.filter((o) => vis.has(o.layer)).map((o) => o.id);
        }),

      /* ------------------------------------------------------------- pull */

      pull: (ids, height, mode) => {
        const st = get();
        const basis = planeBasis(st.sketch.plane);
        const made: string[] = [];
        const sources = st.sketch.objects.filter((o): o is Stroke => o.kind === "stroke" && ids.includes(o.id));
        if (!sources.length) return [];

        const solids: Solid[] = [];
        for (const stroke of sources) {
          const profile = strokeToProfile(stroke, basis, mode !== "revolve");
          if (profile.length < 6) continue;
          solids.push({
            id: uid("sd"),
            kind: "solid",
            layer: stroke.layer,
            color: stroke.color,
            opacity: 1,
            mode,
            shade: "matte",
            profile,
            origin: [basis.origin.x, basis.origin.y, basis.origin.z],
            ax: [basis.x.x, basis.x.y, basis.x.z],
            ay: [basis.y.x, basis.y.y, basis.y.z],
            an: [basis.n.x, basis.n.y, basis.n.z],
            height,
            bevel: 0,
            centered: false,
            wire: false,
          });
        }
        if (!solids.length) return [];
        const drop = st.prefs.keepOutline ? new Set<string>() : new Set(sources.map((s) => s.id));
        edit((d) => {
          if (drop.size) d.objects = d.objects.filter((o) => !drop.has(o.id));
          d.objects.push(...solids);
        });
        solids.forEach((s) => made.push(s.id));
        set((s) => { s.selection = made; });
        return made;
      },

      /* ----------------------------------------------------------- layers */

      addLayer: () => {
        const l = makeLayer(`Layer ${get().sketch.layers.length + 1}`);
        edit((d) => { d.layers.push(l); d.activeLayer = l.id; });
      },

      deleteLayer: (id) =>
        edit((d) => {
          if (d.layers.length <= 1) return;
          d.layers = d.layers.filter((l) => l.id !== id);
          d.objects = d.objects.filter((o) => o.layer !== id);
          if (d.activeLayer === id) d.activeLayer = d.layers[d.layers.length - 1].id;
        }),

      setLayer: (id, patch) =>
        edit((d) => {
          const l = d.layers.find((x) => x.id === id);
          if (l) Object.assign(l, patch);
        }),

      reorderLayer: (id, dir) =>
        edit((d) => {
          const i = d.layers.findIndex((l) => l.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= d.layers.length) return;
          const [l] = d.layers.splice(i, 1);
          d.layers.splice(j, 0, l);
        }),

      mergeDown: (id) =>
        edit((d) => {
          const i = d.layers.findIndex((l) => l.id === id);
          if (i <= 0) return;
          const below = d.layers[i - 1].id;
          d.objects.forEach((o) => { if (o.layer === id) o.layer = below; });
          d.layers.splice(i, 1);
          if (d.activeLayer === id) d.activeLayer = below;
        }),

      setActiveLayer: (id) => edit((d) => { d.activeLayer = id; }, false),

      /* ------------------------------------------------------ scene state */

      setPlane: (p) => edit((d) => { Object.assign(d.plane, p); }, false),
      setPlanePreset: (p) =>
        edit((d) => {
          d.plane.preset = p;
          if (p !== "custom") d.plane.rot = [0, 0, 0];
        }, false),
      setEnv: (e) => edit((d) => { Object.assign(d.env, e); }, false),
      setEnvPreset: (p) => edit((d) => { d.env = applyPreset(d.env, p); }, false),
      setCamera: (c) => edit((d) => { Object.assign(d.camera, c); }, false),

      /* ----------------------------------------------------------- brushes */

      saveBrush: (b) =>
        edit((d) => {
          const i = d.brushes.findIndex((x) => x.id === b.id);
          if (i >= 0) d.brushes[i] = b;
          else d.brushes.push(b);
        }),
      deleteBrush: (id) => edit((d) => { d.brushes = d.brushes.filter((b) => b.id !== id); }),

      /* ----------------------------------------------------------- history */

      beginGesture: () => set((s) => { if (!s.gesture) { s.past.push(s.sketch); if (s.past.length > HISTORY) s.past.shift(); s.future = []; s.gesture = true; } }),
      endGesture: () =>
        set((s) => {
          s.gesture = false;
          // A gesture that changed nothing should not cost an undo step.
          if (s.past.length && s.past[s.past.length - 1] === s.sketch) s.past.pop();
        }),

      undo: () =>
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          s.future.push(s.sketch);
          s.sketch = prev;
          s.selection = [];
          s.dirty = true;
        }),

      redo: () =>
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          s.past.push(s.sketch);
          s.sketch = next;
          s.selection = [];
          s.dirty = true;
        }),

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
    };
  })
);
