import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Draft } from "immer";

import type {
  AnimationState,
  Effects,
  ShadowSpec,
  SiteState,
  BackgroundKind,
  BoardDoc,
  Bounds,
  CanvasObject,
  Camera,
  EndpointBinding,
  ObjectStyle,
  Point,
  RenderMode,
  ToolId,
  Unit,
} from "../types";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  anchorOnBounds,
  boundsOfObjects,
  clamp,
  objectBounds,
  pointInBounds,
} from "../lib/geom";
import type { Guide } from "../lib/snapping";
import { uid } from "../lib/id";
import { BACKGROUNDS } from "../lib/theme";
import { measureTextHeight, measureTextWidth } from "../lib/text";
import { DEFAULT_STYLE, type StyleDefaults, createFrame, createGroup } from "./factory";
import { compactEffects } from "../lib/effects";

const HISTORY_LIMIT = 120;

/** Document captured when a drag started, so no-op gestures leave no undo step. */
let gestureBase: BoardDoc | null = null;

/**
 * Camera tweening. Zoom steps and fits glide instead of jumping, which makes
 * the board feel like a surface rather than a slideshow. A timer backstop
 * guarantees the destination even if rAF is throttled (background tab).
 */
let camAnim: { raf: number; timer: number } | null = null;

function stopCameraAnimation() {
  if (!camAnim) return;
  cancelAnimationFrame(camAnim.raf);
  clearTimeout(camAnim.timer);
  camAnim = null;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export type SaveStatus = "saved" | "saving" | "offline";
export type DockTab = "design" | "adjustments" | "layers" | "type" | "brushes" | "effects" | "color" | "canvas" | "assist" | "prefs";
export type Theme = "light" | "dark";

const THEME_KEY = "yxm-canvas:theme";
const PREFS_KEY = "yxm-canvas:prefs";

/** App-level preferences — how the tool behaves, not what a board contains. */
export interface Prefs {
  snapDistance: number;
  nudgeStep: number;
  showToolKeys: boolean;
  reduceMotion: boolean;
  hoverOutline: boolean;
  captureDelay: number;
  maxFrames: number;
  exportScale: number;
  exportPadding: number;
}

export const DEFAULT_PREFS: Prefs = {
  snapDistance: 7,
  nudgeStep: 1,
  showToolKeys: true,
  reduceMotion: false,
  hoverOutline: true,
  captureDelay: 900,
  maxFrames: 420,
  exportScale: 2,
  exportPadding: 24,
};

function storedPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function storedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** The chrome theme lives on <html> so the gallery and modals follow too. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage can be disabled */
  }
}

export interface UiState {
  /** The gallery. Shown on launch, like opening a sketchbook. */
  home: boolean;
  timelineOpen: boolean;
  timelapseOpen: boolean;
  dockOpen: boolean;
  dockTab: DockTab;
  stampsOpen: boolean;
  commandOpen: boolean;
  exportOpen: boolean;
  boardsOpen: boolean;
  shortcutsOpen: boolean;
  minimapOpen: boolean;
  presenting: boolean;
  radial: Point | null;
  menu: Point | null;
  /** Full-screen site builder. */
  builderOpen: boolean;
  /** Dragging inside a masked shape pans its picture instead of moving the shape. */
  adjustPicture: boolean;
  /** Bottom sheet on touch layouts; which dock tab it shows lives in dockTab. */
  sheetOpen: boolean;
  /** Which menu-bar menu is open, if any. */
  menuOpen: string | null;
  /** A long-running job (AI, cut-out, trace) shown as a progress pill. */
  job: { label: string; progress?: number } | null;
  /** Armed colour picker: the next canvas click samples a pixel. */
  eyedropper: "stroke" | "fill" | null;
  hint: string | null;
}

export interface AppState {
  doc: BoardDoc;
  camera: Camera;
  viewport: { width: number; height: number };
  tool: ToolId;
  /** Set when a tool was activated by holding its key (blueprint §8). */
  quickTool: boolean;
  toolLocked: boolean;
  selection: string[];
  hoverId: string | null;
  editingId: string | null;
  /** Image currently being cropped on the canvas. */
  cropId: string | null;
  defaults: StyleDefaults;
  guides: Guide[];
  clipboard: CanvasObject[];
  styleClipboard: ObjectStyle | null;
  past: BoardDoc[];
  future: BoardDoc[];
  gesture: boolean;
  saveStatus: SaveStatus;
  /** Transient animation playhead — never part of the saved document. */
  playback: { playing: boolean; index: number };
  theme: Theme;
  setTheme(theme: Theme): void;
  prefs: Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  resetPrefs(): void;
  /** Time-lapse capture, on by default like Procreate. */
  recording: boolean;
  setRecording(on: boolean): void;
  ui: UiState;

  // camera
  setViewport(width: number, height: number): void;
  panBy(dx: number, dy: number): void;
  setCamera(camera: Partial<Camera>): void;
  zoomAt(screenPoint: Point, factor: number): void;
  /** Eased zoom toward a focal point — used by wheel, buttons and shortcuts. */
  glideZoom(screenPoint: Point, factor: number): void;
  setZoom(zoom: number): void;
  zoomToBounds(bounds: Bounds, padding?: number): void;
  animateCamera(to: Camera, ms?: number): void;
  fitAll(): void;
  fitSelection(): void;
  resetView(): void;
  centerOn(point: Point): void;

  // tools + selection
  setTool(tool: ToolId, quick?: boolean): void;
  setToolLocked(locked: boolean): void;
  setSelection(ids: string[]): void;
  toggleSelection(id: string): void;
  selectAll(): void;
  selectSame(): void;
  clearSelection(): void;
  setHover(id: string | null): void;
  setEditing(id: string | null): void;
  setCropId(id: string | null): void;
  setGuides(guides: Guide[]): void;

  // history
  snapshot(): void;
  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;

  // objects
  addObjects(objects: CanvasObject[], select?: boolean): void;
  removeObjects(ids: string[]): void;
  deleteSelection(): void;
  duplicateSelection(dx?: number, dy?: number): string[];
  copySelection(): void;
  cutSelection(): void;
  pasteClipboard(at?: Point): void;
  translateObjects(ids: string[], dx: number, dy: number): void;
  patchObject(id: string, patch: Partial<CanvasObject>): void;
  patchObjects(ids: string[], patch: Partial<CanvasObject>): void;
  patchStyle(ids: string[], style: ObjectStyle, remember?: Partial<StyleDefaults>): void;
  patchData(id: string, data: Partial<CanvasObject["data"]>): void;
  /** Merge into each object's effect stack; `null` clears it. */
  patchEffects(ids: string[], patch: Partial<Effects> | null): void;
  setShadow(ids: string[], spec: ShadowSpec | null): void;
  /** Mask: put an image inside a shape; the image object is consumed. */
  clipImageIntoShape(imageId: string, shapeId: string): void;
  /** Undo a mask: the shape keeps its outline and the picture comes back as an image. */
  releaseImage(shapeId: string): void;
  /** Move objects so they sit directly above (`after`) or below a target in paint order. */
  moveLayer(ids: string[], targetId: string, position: "above" | "below" | "into"): void;
  setDefaults(patch: Partial<StyleDefaults>): void;
  reorder(ids: string[], direction: "front" | "forward" | "backward" | "back"): void;
  group(): void;
  ungroup(): void;
  setLocked(ids: string[], locked: boolean): void;
  setHidden(ids: string[], hidden: boolean): void;
  rename(id: string, name: string): void;
  setParent(ids: string[], parentId: string | undefined): void;
  captureIntoFrames(ids: string[]): void;
  align(
    kind: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom",
    to?: "selection" | "page",
  ): void;
  distribute(axis: "h" | "v"): void;
  flip(axis: "h" | "v"): void;
  fitText(ids: string[]): void;
  repeatSelection(options: {
    count: number;
    dx: number;
    dy: number;
    rotate: number;
    scale: number;
  }): void;
  copyStyle(): void;
  pasteStyle(): void;
  bindEndpoint(id: string, end: "from" | "to", binding: EndpointBinding | undefined): void;
  fillPlaceholder(id: string, src: string, naturalWidth: number, naturalHeight: number): void;

  // board
  setBoardName(name: string): void;
  setBackground(background: BackgroundKind): void;
  setGridSize(size: number): void;
  setGridOpacity(opacity: number): void;
  setSnap(patch: { grid?: boolean; objects?: boolean }): void;
  setRenderMode(mode: RenderMode): void;
  setUnit(unit: Unit, unitScale?: number): void;
  setPage(page: BoardDoc["settings"]["page"]): void;
  /** Replace the board's site (section stack + brief + theme). */
  setSite(site: SiteState | undefined): void;

  // animation
  setAnimation(patch: Partial<AnimationState>): void;
  addCel(duplicateCurrent?: boolean): void;
  removeCel(id: string): void;
  moveCel(from: number, to: number): void;
  setPlayhead(index: number): void;
  togglePlay(force?: boolean): void;
  loadDoc(doc: BoardDoc): void;
  newBoard(name?: string): void;
  setSaveStatus(status: SaveStatus): void;

  // ui
  setUi(patch: Partial<UiState>): void;
  openDock(tab: DockTab): void;
  flashHint(message: string): void;
}

export function emptyDoc(name = "Untitled board"): BoardDoc {
  return {
    id: uid("board"),
    name,
    objects: {},
    order: [],
    settings: {
      background: "dots",
      gridSize: 20,
      gridOpacity: 0.6,
      snapToGrid: false,
      snapToObjects: true,
      renderMode: "normal",
      unit: "px",
      unitScale: 1,
      page: null,
    },
    animation: { cels: [], fps: 12, loop: "loop", onion: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** All descendants of an object (group members, frame contents). */
export function descendantIds(doc: BoardDoc, id: string, out: string[] = []): string[] {
  for (const oid of doc.order) {
    const o = doc.objects[oid];
    if (o && o.parentId === id) {
      out.push(oid);
      descendantIds(doc, oid, out);
    }
  }
  return out;
}

/** The outermost group an object belongs to — what a click should select. */
export function topAncestor(doc: BoardDoc, id: string): string {
  let current = doc.objects[id];
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = doc.objects[current.parentId];
    // Frames stay clickable containers; only groups swallow the selection.
    if (!parent || parent.type !== "group") break;
    current = parent;
  }
  return current?.id ?? id;
}

function refreshGroups(doc: Draft<BoardDoc>) {
  for (const id of [...doc.order]) {
    const g = doc.objects[id];
    if (!g || g.type !== "group") continue;
    const members = doc.order
      .map((oid) => doc.objects[oid])
      .filter((o): o is CanvasObject => !!o && o.parentId === id);
    if (!members.length) {
      delete doc.objects[id];
      doc.order = doc.order.filter((oid) => oid !== id);
      continue;
    }
    const b = boundsOfObjects(members);
    if (b) {
      g.x = b.x;
      g.y = b.y;
      g.width = b.width;
      g.height = b.height;
      g.data.children = members.map((m) => m.id);
    }
  }
}

const centerOf = (b: Bounds): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Arrows docked to objects re-route themselves whenever anything moves
 * (blueprint §16). One pass after each edit, so nothing cascades.
 */
function reflowConnectors(doc: Draft<BoardDoc>) {
  for (const id of doc.order) {
    const o = doc.objects[id];
    if (!o || (o.type !== "arrow" && o.type !== "line")) continue;
    const fromRef = o.data.from;
    const toRef = o.data.to;
    if (!fromRef && !toRef) continue;

    const pts = o.data.points ?? [0, 0, o.width, o.height];
    let a: Point = { x: o.x + pts[0], y: o.y + pts[1] };
    let b: Point = { x: o.x + pts[2], y: o.y + pts[3] };

    const fromObj = fromRef ? doc.objects[fromRef.id] : undefined;
    const toObj = toRef ? doc.objects[toRef.id] : undefined;
    if (fromRef && !fromObj) o.data.from = undefined;
    if (toRef && !toObj) o.data.to = undefined;
    if (!fromObj && !toObj) continue;

    if (fromObj) {
      a = anchorOnBounds(objectBounds(fromObj), toObj ? centerOf(objectBounds(toObj)) : b);
    }
    if (toObj) {
      b = anchorOnBounds(objectBounds(toObj), fromObj ? centerOf(objectBounds(fromObj)) : a);
    }

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    o.x = x;
    o.y = y;
    o.width = Math.abs(b.x - a.x);
    o.height = Math.abs(b.y - a.y);
    o.data.points = [a.x - x, a.y - y, b.x - x, b.y - y];
  }
}

export const useStore = create<AppState>()(
  immer((set, get) => {
    const edit = (recipe: (doc: Draft<BoardDoc>) => void, record = true) => {
      const prev = get().doc;
      const shouldRecord = record && !get().gesture;
      set((s) => {
        if (shouldRecord) {
          s.past.push(prev);
          if (s.past.length > HISTORY_LIMIT) s.past.shift();
          s.future = [];
        }
        recipe(s.doc);
        refreshGroups(s.doc);
        reflowConnectors(s.doc);
        s.doc.updatedAt = Date.now();
      });
    };

    const expand = (ids: string[]): string[] => {
      const doc = get().doc;
      const all = new Set<string>();
      for (const id of ids) {
        all.add(id);
        for (const d of descendantIds(doc, id)) all.add(d);
      }
      return [...all];
    };

    return {
      doc: emptyDoc(),
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 1200, height: 800 },
      tool: "select",
      quickTool: false,
      toolLocked: false,
      selection: [],
      hoverId: null,
      editingId: null,
      cropId: null,
      defaults: { ...DEFAULT_STYLE },
      guides: [],
      clipboard: [],
      styleClipboard: null,
      past: [],
      future: [],
      gesture: false,
      saveStatus: "saved",
      playback: { playing: false, index: 0 },
      theme: storedTheme(),
      prefs: storedPrefs(),
      recording: true,
      ui: {
        home: true,
        timelineOpen: false,
        timelapseOpen: false,
        dockOpen: true,
        dockTab: "design",
        stampsOpen: false,
        commandOpen: false,
        exportOpen: false,
        boardsOpen: false,
        shortcutsOpen: false,
        minimapOpen: true,
        presenting: false,
        sheetOpen: false,
        menuOpen: null,
        builderOpen: false,
        adjustPicture: false,
        job: null,
        radial: null,
        menu: null,
        eyedropper: null,
        hint: null,
      },

      setViewport: (width, height) =>
        set((s) => {
          s.viewport.width = width;
          s.viewport.height = height;
        }),

      panBy: (dx, dy) =>
        set((s) => {
          stopCameraAnimation();
          s.camera.x += dx;
          s.camera.y += dy;
        }),

      setCamera: (camera) =>
        set((s) => {
          Object.assign(s.camera, camera);
          s.camera.zoom = clamp(s.camera.zoom, MIN_ZOOM, MAX_ZOOM);
        }),

      zoomAt: (screenPoint, factor) => {
        stopCameraAnimation();
        set((s) => {
          const next = clamp(s.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
          const scale = next / s.camera.zoom;
          s.camera.x = screenPoint.x - (screenPoint.x - s.camera.x) * scale;
          s.camera.y = screenPoint.y - (screenPoint.y - s.camera.y) * scale;
          s.camera.zoom = next;
        });
      },

      glideZoom: (screenPoint, factor) => {
        const start = get().camera;
        const target = clamp(start.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (Math.abs(target - start.zoom) < 0.0005) return;
        const scale = target / start.zoom;
        const to: Camera = {
          zoom: target,
          x: screenPoint.x - (screenPoint.x - start.x) * scale,
          y: screenPoint.y - (screenPoint.y - start.y) * scale,
        };
        get().animateCamera(to, 150);
      },

      animateCamera: (to, ms = 240) => {
        stopCameraAnimation();
        if (get().prefs.reduceMotion) {
          set((s) => {
            s.camera = { ...to };
          });
          return;
        }
        const from = { ...get().camera };
        const start = performance.now();
        const apply = (t: number) => {
          const k = easeOut(Math.min(1, t));
          set((s) => {
            s.camera.x = from.x + (to.x - from.x) * k;
            s.camera.y = from.y + (to.y - from.y) * k;
            s.camera.zoom = from.zoom + (to.zoom - from.zoom) * k;
          });
        };
        const step = () => {
          const t = (performance.now() - start) / ms;
          if (t >= 1) {
            stopCameraAnimation();
            apply(1);
            return;
          }
          apply(t);
          if (camAnim) camAnim.raf = requestAnimationFrame(step);
        };
        camAnim = {
          raf: requestAnimationFrame(step),
          // Backstop: land on the target even if frames never arrive.
          timer: window.setTimeout(() => {
            stopCameraAnimation();
            apply(1);
          }, ms + 60),
        };
      },

      setZoom: (zoom) => {
        const { viewport, camera } = get();
        get().glideZoom(
          { x: viewport.width / 2, y: viewport.height / 2 },
          zoom / camera.zoom,
        );
      },

      zoomToBounds: (bounds, padding = 90) => {
        const { viewport } = get();
        const w = Math.max(bounds.width, 1);
        const h = Math.max(bounds.height, 1);
        const zoom = clamp(
          Math.min((viewport.width - padding * 2) / w, (viewport.height - padding * 2) / h),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        get().animateCamera({
          zoom,
          x: viewport.width / 2 - (bounds.x + w / 2) * zoom,
          y: viewport.height / 2 - (bounds.y + h / 2) * zoom,
        });
      },

      fitAll: () => {
        const doc = get().doc;
        const objects = doc.order
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o && !o.hidden && o.type !== "group");
        const page = doc.settings.page;
        const bounds = boundsOfObjects(objects);
        const b = page
          ? {
              x: Math.min(0, bounds?.x ?? 0),
              y: Math.min(0, bounds?.y ?? 0),
              width: Math.max(page.width, (bounds?.x ?? 0) + (bounds?.width ?? 0)),
              height: Math.max(page.height, (bounds?.y ?? 0) + (bounds?.height ?? 0)),
            }
          : bounds;
        if (b) get().zoomToBounds(b);
        else get().resetView();
      },

      fitSelection: () => {
        const { doc, selection } = get();
        const objects = expand(selection)
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o && o.type !== "group");
        const b = boundsOfObjects(objects);
        if (b) get().zoomToBounds(b, 160);
        else get().fitAll();
      },

      resetView: () => {
        const { viewport } = get();
        get().animateCamera({ x: viewport.width / 2, y: viewport.height / 2, zoom: 1 });
      },

      centerOn: (point) => {
        const { viewport, camera } = get();
        get().animateCamera(
          {
            zoom: camera.zoom,
            x: viewport.width / 2 - point.x * camera.zoom,
            y: viewport.height / 2 - point.y * camera.zoom,
          },
          180,
        );
      },

      setTool: (tool, quick = false) =>
        set((s) => {
          s.tool = tool;
          s.quickTool = quick;
          if (tool !== "select") s.editingId = null;
        }),

      setToolLocked: (locked) =>
        set((s) => {
          s.toolLocked = locked;
        }),

      setSelection: (ids) =>
        set((s) => {
          // Adjust-picture mode is tied to the shape it was started on.
          if (s.ui.adjustPicture && (ids.length !== 1 || ids[0] !== s.selection[0])) s.ui.adjustPicture = false;
          s.selection = ids;
        }),

      toggleSelection: (id) =>
        set((s) => {
          s.selection = s.selection.includes(id)
            ? s.selection.filter((x) => x !== id)
            : [...s.selection, id];
        }),

      selectAll: () =>
        set((s) => {
          s.selection = s.doc.order.filter((id) => {
            const o = s.doc.objects[id];
            return !!o && !o.hidden && !o.locked && !o.parentId;
          });
        }),

      selectSame: () => {
        const { doc, selection } = get();
        const types = new Set(selection.map((id) => doc.objects[id]?.type));
        if (!types.size) return;
        set((s) => {
          s.selection = s.doc.order.filter((id) => {
            const o = s.doc.objects[id];
            return !!o && !o.hidden && !o.locked && !o.parentId && types.has(o.type);
          });
        });
      },

      clearSelection: () =>
        set((s) => {
          s.selection = [];
          s.editingId = null;
        }),

      setHover: (id) =>
        set((s) => {
          s.hoverId = id;
        }),

      setEditing: (id) =>
        set((s) => {
          s.editingId = id;
          if (id) s.selection = [id];
        }),

      setCropId: (id) =>
        set((s) => {
          s.cropId = id;
          if (id) s.selection = [id];
        }),

      setGuides: (guides) =>
        set((s) => {
          s.guides = guides;
        }),

      snapshot: () => {
        const prev = get().doc;
        set((s) => {
          s.past.push(prev);
          if (s.past.length > HISTORY_LIMIT) s.past.shift();
          s.future = [];
        });
      },

      beginGesture: () => {
        gestureBase = get().doc;
        get().snapshot();
        set((s) => {
          s.gesture = true;
        });
      },

      endGesture: () => {
        const { doc, past } = get();
        const redundant =
          gestureBase !== null &&
          doc === gestureBase &&
          past.length > 0 &&
          past[past.length - 1] === doc;
        gestureBase = null;
        set((s) => {
          s.gesture = false;
          s.guides = [];
          if (redundant) s.past.pop();
        });
      },

      undo: () => {
        const current = get().doc;
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          s.future.push(current);
          s.doc = prev;
          s.selection = s.selection.filter((id) => !!prev.objects[id]);
          s.editingId = null;
        });
      },

      redo: () => {
        const current = get().doc;
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          s.past.push(current);
          s.doc = next;
          s.selection = s.selection.filter((id) => !!next.objects[id]);
          s.editingId = null;
        });
      },

      addObjects: (objects, select = true) => {
        edit((doc) => {
          for (const o of objects) {
            doc.objects[o.id] = o;
            doc.order.push(o.id);
          }
        });
        if (select) {
          set((s) => {
            s.selection = objects.filter((o) => !o.parentId).map((o) => o.id);
          });
        }
      },

      removeObjects: (ids) => {
        const all = expand(ids);
        edit((doc) => {
          for (const id of all) delete doc.objects[id];
          doc.order = doc.order.filter((id) => !all.includes(id));
          for (const id of doc.order) {
            const o = doc.objects[id];
            if (!o) continue;
            if (o.parentId && all.includes(o.parentId)) o.parentId = undefined;
            if (o.data.from && all.includes(o.data.from.id)) o.data.from = undefined;
            if (o.data.to && all.includes(o.data.to.id)) o.data.to = undefined;
          }
        });
        set((s) => {
          s.selection = s.selection.filter((id) => !all.includes(id));
          s.editingId = null;
        });
      },

      deleteSelection: () => {
        const { selection, doc } = get();
        const removable = selection.filter((id) => !doc.objects[id]?.locked);
        if (removable.length) get().removeObjects(removable);
      },

      duplicateSelection: (dx = 24, dy = 24) => {
        const { doc, selection } = get();
        const ids = expand(selection);
        const map = new Map<string, string>();
        const copies: CanvasObject[] = [];
        for (const id of doc.order) {
          if (!ids.includes(id)) continue;
          const src = doc.objects[id];
          if (!src) continue;
          const copy: CanvasObject = JSON.parse(JSON.stringify(src));
          copy.id = uid(src.type);
          copy.x += dx;
          copy.y += dy;
          map.set(id, copy.id);
          copies.push(copy);
        }
        for (const copy of copies) {
          if (copy.parentId && map.has(copy.parentId)) copy.parentId = map.get(copy.parentId);
          if (copy.data.from && map.has(copy.data.from.id)) {
            copy.data.from = { ...copy.data.from, id: map.get(copy.data.from.id)! };
          }
          if (copy.data.to && map.has(copy.data.to.id)) {
            copy.data.to = { ...copy.data.to, id: map.get(copy.data.to.id)! };
          }
        }
        get().addObjects(copies, false);
        const newTop = selection.map((id) => map.get(id)).filter((x): x is string => !!x);
        set((s) => {
          s.selection = newTop;
        });
        return newTop;
      },

      copySelection: () => {
        const { doc, selection } = get();
        const ids = expand(selection);
        const copies = doc.order
          .filter((id) => ids.includes(id))
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o)
          .map((o) => JSON.parse(JSON.stringify(o)) as CanvasObject);
        set((s) => {
          s.clipboard = copies;
        });
        if (copies.length) get().flashHint(`${copies.length} copied`);
      },

      cutSelection: () => {
        get().copySelection();
        get().deleteSelection();
      },

      pasteClipboard: (at) => {
        const { clipboard } = get();
        if (!clipboard.length) return;
        const box = boundsOfObjects(clipboard);
        const dx = at && box ? at.x - (box.x + box.width / 2) : 28;
        const dy = at && box ? at.y - (box.y + box.height / 2) : 28;
        const map = new Map<string, string>();
        const copies = clipboard.map((src) => {
          const copy: CanvasObject = JSON.parse(JSON.stringify(src));
          copy.id = uid(src.type);
          copy.x += dx;
          copy.y += dy;
          map.set(src.id, copy.id);
          return copy;
        });
        for (const copy of copies) {
          copy.parentId = copy.parentId ? map.get(copy.parentId) : undefined;
          copy.data.from = copy.data.from && map.has(copy.data.from.id)
            ? { ...copy.data.from, id: map.get(copy.data.from.id)! }
            : undefined;
          copy.data.to = copy.data.to && map.has(copy.data.to.id)
            ? { ...copy.data.to, id: map.get(copy.data.to.id)! }
            : undefined;
        }
        get().addObjects(copies, false);
        set((s) => {
          s.selection = copies.filter((o) => !o.parentId).map((o) => o.id);
        });
      },

      translateObjects: (ids, dx, dy) => {
        const all = expand(ids);
        edit((doc) => {
          for (const id of all) {
            const o = doc.objects[id];
            if (!o || o.locked) continue;
            o.x += dx;
            o.y += dy;
          }
        });
      },

      patchObject: (id, patch) => {
        edit((doc) => {
          const o = doc.objects[id];
          if (o) Object.assign(o, patch);
        });
      },

      patchObjects: (ids, patch) => {
        edit((doc) => {
          for (const id of ids) {
            const o = doc.objects[id];
            if (o) Object.assign(o, patch);
          }
        });
      },

      patchStyle: (ids, style, remember) => {
        const all = expand(ids);
        // Type metrics change → point text hugs its new shape in the same step.
        const metric = ["fontSize", "fontFamily", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform", "textList"].some(
          (k) => k in style,
        );
        const { doc: before } = get();
        const sizes = new Map<string, { width: number; height: number }>();
        if (metric) {
          for (const id of all) {
            const o = before.objects[id];
            if (!o || o.type !== "text") continue;
            const next = { ...o, style: { ...o.style, ...style } };
            const width = o.data.autoWidth ? Math.min(1600, measureTextWidth(next)) : o.width;
            sizes.set(id, { width, height: measureTextHeight({ ...next, width }) });
          }
        }
        edit((doc) => {
          for (const id of all) {
            const o = doc.objects[id];
            if (!o || o.type === "group") continue;
            Object.assign(o.style, style);
            const size = sizes.get(id);
            if (size) {
              o.width = size.width;
              o.height = size.height;
            }
          }
        });
        if (remember) get().setDefaults(remember);
      },

      patchData: (id, data) => {
        edit((doc) => {
          const o = doc.objects[id];
          if (o) Object.assign(o.data, data);
        });
      },

      patchEffects: (ids, patch) => {
        const all = expand(ids);
        edit((doc) => {
          for (const id of all) {
            const o = doc.objects[id];
            if (!o || o.type === "group") continue;
            o.style.effects = patch === null ? null : compactEffects({ ...(o.style.effects ?? {}), ...patch });
          }
        });
      },

      setShadow: (ids, spec) => {
        const all = expand(ids);
        edit((doc) => {
          for (const id of all) {
            const o = doc.objects[id];
            if (!o || o.type === "group") continue;
            o.style.shadowSpec = spec ? { ...spec } : null;
            if (spec) o.style.shadow = false;
          }
        });
      },

      clipImageIntoShape: (imageId, shapeId) => {
        const { doc } = get();
        const img = doc.objects[imageId];
        const shape = doc.objects[shapeId];
        if (!img || !shape || img.type !== "image" || !img.data.src) return;
        edit((d) => {
          const target = d.objects[shapeId];
          if (!target) return;
          target.data.src = img.data.src;
          target.data.naturalWidth = img.data.naturalWidth;
          target.data.naturalHeight = img.data.naturalHeight;
          target.data.crop = undefined;
          if (!target.name) target.name = img.name ? `${img.name} in ${target.type}` : undefined;
          delete d.objects[imageId];
          d.order = d.order.filter((id) => id !== imageId);
          for (const id of d.order) {
            const o = d.objects[id];
            if (o?.parentId === imageId) o.parentId = undefined;
          }
        });
        set((s) => {
          s.selection = [shapeId];
        });
      },

      releaseImage: (shapeId) => {
        const { doc } = get();
        const shape = doc.objects[shapeId];
        if (!shape?.data.src) return;
        const nw = shape.data.naturalWidth ?? shape.width;
        const nh = shape.data.naturalHeight ?? shape.height;
        const scale = Math.max(shape.width / nw, shape.height / nh);
        const image: CanvasObject = {
          id: uid("image"),
          type: "image",
          name: shape.name,
          x: shape.x + (shape.width - nw * scale) / 2,
          y: shape.y + (shape.height - nh * scale) / 2,
          width: nw * scale,
          height: nh * scale,
          rotation: shape.rotation,
          opacity: 1,
          locked: false,
          hidden: false,
          parentId: shape.parentId,
          style: { radius: 2 },
          data: { src: shape.data.src, naturalWidth: nw, naturalHeight: nh },
        };
        edit((d) => {
          const target = d.objects[shapeId];
          if (!target) return;
          delete target.data.src;
          delete target.data.naturalWidth;
          delete target.data.naturalHeight;
          d.objects[image.id] = image;
          const at = d.order.indexOf(shapeId);
          d.order.splice(at, 0, image.id);
        });
        set((s) => {
          s.selection = [image.id];
        });
      },

      moveLayer: (ids, targetId, position) => {
        const targets = new Set(expand(ids));
        if (targets.has(targetId)) return;
        edit((doc) => {
          const target = doc.objects[targetId];
          if (!target) return;
          const moving = doc.order.filter((id) => targets.has(id));
          const rest = doc.order.filter((id) => !targets.has(id));
          const container = position === "into" && (target.type === "group" || target.type === "frame");
          const newParent = container ? targetId : target.parentId;
          for (const id of ids) {
            const o = doc.objects[id];
            if (o) o.parentId = newParent;
          }
          // Descendants of a re-parented group keep following it; only the
          // top-level picks change parent.
          let at = rest.indexOf(targetId);
          if (container) {
            // Drop just above the target's last descendant so it paints on top.
            let last = at;
            for (let i = at + 1; i < rest.length; i += 1) {
              let p = doc.objects[rest[i]]?.parentId;
              let inside = false;
              while (p) {
                if (p === targetId) {
                  inside = true;
                  break;
                }
                p = doc.objects[p]?.parentId;
              }
              if (inside) last = i;
            }
            at = last + 1;
          } else if (position === "above") {
            at += 1;
          }
          rest.splice(Math.max(0, at), 0, ...moving);
          doc.order = rest;
        });
      },

      setDefaults: (patch) =>
        set((s) => {
          Object.assign(s.defaults, patch);
        }),

      reorder: (ids, direction) => {
        const targets = new Set(expand(ids));
        edit((doc) => {
          const moving = doc.order.filter((id) => targets.has(id));
          const rest = doc.order.filter((id) => !targets.has(id));
          if (direction === "front") doc.order = [...rest, ...moving];
          else if (direction === "back") doc.order = [...moving, ...rest];
          else {
            const step = direction === "forward" ? 1 : -1;
            const next = [...doc.order];
            const indices = moving
              .map((id) => next.indexOf(id))
              .sort((a, b) => (step > 0 ? b - a : a - b));
            for (const i of indices) {
              const j = i + step;
              if (j < 0 || j >= next.length) continue;
              const tmp = next[i];
              next[i] = next[j];
              next[j] = tmp;
            }
            doc.order = next;
          }
        });
      },

      group: () => {
        const { selection, doc } = get();
        const members = selection
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o);
        if (members.length < 2) return;
        const g = createGroup(members);
        edit((d) => {
          d.objects[g.id] = g;
          const firstIndex = Math.min(...members.map((m) => d.order.indexOf(m.id)));
          d.order.splice(Math.max(0, firstIndex), 0, g.id);
          for (const m of members) {
            const o = d.objects[m.id];
            if (o) o.parentId = g.id;
          }
        });
        set((s) => {
          s.selection = [g.id];
        });
      },

      ungroup: () => {
        const { selection, doc } = get();
        const groups = selection.filter((id) => doc.objects[id]?.type === "group");
        if (!groups.length) return;
        const freed: string[] = [];
        edit((d) => {
          for (const gid of groups) {
            const parent = d.objects[gid]?.parentId;
            for (const id of d.order) {
              const o = d.objects[id];
              if (o?.parentId === gid) {
                o.parentId = parent;
                freed.push(id);
              }
            }
            delete d.objects[gid];
            d.order = d.order.filter((id) => id !== gid);
          }
        });
        set((s) => {
          s.selection = freed;
        });
      },

      setLocked: (ids, locked) => get().patchObjects(expand(ids), { locked }),
      setHidden: (ids, hidden) => get().patchObjects(expand(ids), { hidden }),
      rename: (id, name) => get().patchObject(id, { name }),

      setParent: (ids, parentId) => {
        edit((doc) => {
          for (const id of ids) {
            const o = doc.objects[id];
            if (o && o.id !== parentId) o.parentId = parentId;
          }
        });
      },

      /**
       * A frame owns whatever sits on it: after a move or a draw, anything
       * whose centre lands inside a frame becomes its child, so moving the
       * frame later carries the contents with it.
       */
      captureIntoFrames: (ids) => {
        edit((doc) => {
          const frames = doc.order.filter((id) => doc.objects[id]?.type === "frame");
          if (!frames.length) return;
          for (const id of ids) {
            const o = doc.objects[id];
            if (!o || o.type === "frame") continue;
            // Group members follow their group, not a frame.
            if (o.parentId && doc.objects[o.parentId]?.type === "group") continue;
            const b = objectBounds(o);
            const centre = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
            let target: string | undefined;
            for (const fid of frames) {
              if (fid === id) continue;
              const f = doc.objects[fid];
              if (f && pointInBounds(centre, objectBounds(f))) target = fid;
            }
            const parent = o.parentId ? doc.objects[o.parentId] : undefined;
            if (!parent || parent.type === "frame") o.parentId = target;
          }
        });
      },

      align: (kind, to = "selection") => {
        const { doc, selection } = get();
        const objects = selection
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o && !o.locked);
        if (!objects.length) return;
        const page = doc.settings.page;
        // Aligning to the page works with a single object; aligning to the
        // selection needs at least two things to align to each other.
        const box =
          to === "page" && page
            ? { x: 0, y: 0, width: page.width, height: page.height }
            : objects.length > 1
              ? boundsOfObjects(objects)
              : null;
        if (!box) return;
        edit((d) => {
          for (const o of objects) {
            const b = objectBounds(o);
            let dx = 0;
            let dy = 0;
            if (kind === "left") dx = box.x - b.x;
            if (kind === "right") dx = box.x + box.width - (b.x + b.width);
            if (kind === "hcenter") dx = box.x + box.width / 2 - (b.x + b.width / 2);
            if (kind === "top") dy = box.y - b.y;
            if (kind === "bottom") dy = box.y + box.height - (b.y + b.height);
            if (kind === "vcenter") dy = box.y + box.height / 2 - (b.y + b.height / 2);
            for (const id of [o.id, ...descendantIds(d, o.id)]) {
              const target = d.objects[id];
              if (!target) continue;
              target.x += dx;
              target.y += dy;
            }
          }
        });
      },

      distribute: (axis) => {
        const { doc, selection } = get();
        const objects = selection
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o && !o.locked);
        if (objects.length < 3) return;
        const key = axis === "h" ? "x" : "y";
        const size = axis === "h" ? "width" : "height";
        const sorted = [...objects].sort((a, b) => objectBounds(a)[key] - objectBounds(b)[key]);
        const first = objectBounds(sorted[0]);
        const last = objectBounds(sorted[sorted.length - 1]);
        const span = last[key] + last[size] - first[key];
        const totalSize = sorted.reduce((sum, o) => sum + objectBounds(o)[size], 0);
        const gap = (span - totalSize) / (sorted.length - 1);
        let cursor = first[key];
        edit((d) => {
          for (const o of sorted) {
            const b = objectBounds(o);
            const delta = cursor - b[key];
            for (const id of [o.id, ...descendantIds(d, o.id)]) {
              const target = d.objects[id];
              if (!target) continue;
              if (axis === "h") target.x += delta;
              else target.y += delta;
            }
            cursor += b[size] + gap;
          }
        });
      },

      flip: (axis) => {
        const ids = expand(get().selection);
        edit((doc) => {
          const objects = ids
            .map((id) => doc.objects[id])
            .filter((o): o is CanvasObject => !!o && !o.locked);
          const box = boundsOfObjects(objects);
          if (!box) return;
          for (const o of objects) {
            const linear = o.type === "line" || o.type === "arrow" || o.type === "measure";
            if (axis === "h") {
              o.x = box.x + box.width - (o.x - box.x) - o.width;
              if (o.type === "image") o.data.flipX = !o.data.flipX;
              if (linear && o.data.points) {
                const p = o.data.points;
                o.data.points = [o.width - p[0], p[1], o.width - p[2], p[3]];
              }
            } else {
              o.y = box.y + box.height - (o.y - box.y) - o.height;
              if (o.type === "image") o.data.flipY = !o.data.flipY;
              if (linear && o.data.points) {
                const p = o.data.points;
                o.data.points = [p[0], o.height - p[1], p[2], o.height - p[3]];
              }
            }
          }
        });
      },

      /** Illustrator's step-and-repeat: N copies, each offset from the last. */
      repeatSelection: ({ count, dx, dy, rotate, scale }) => {
        const { doc, selection } = get();
        if (!selection.length || count < 1) return;
        const ids = expand(selection);
        const sources = doc.order
          .filter((id) => ids.includes(id))
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o);
        const origin = boundsOfObjects(sources);
        if (!origin) return;

        const made: CanvasObject[] = [];
        for (let step = 1; step <= count; step += 1) {
          const map = new Map<string, string>();
          const factor = Math.pow(scale, step);
          const rad = ((rotate * step) % 360) * (Math.PI / 180);
          const cx = origin.x + origin.width / 2;
          const cy = origin.y + origin.height / 2;
          for (const src of sources) {
            const copy: CanvasObject = JSON.parse(JSON.stringify(src));
            copy.id = uid(src.type);
            const ox = src.x - cx;
            const oy = src.y - cy;
            copy.x = cx + (ox * Math.cos(rad) - oy * Math.sin(rad)) * factor + dx * step;
            copy.y = cy + (ox * Math.sin(rad) + oy * Math.cos(rad)) * factor + dy * step;
            copy.width = src.width * factor;
            copy.height = src.height * factor;
            copy.rotation = src.rotation + rotate * step;
            map.set(src.id, copy.id);
            made.push(copy);
          }
          for (const copy of made.slice(-sources.length)) {
            if (copy.parentId && map.has(copy.parentId)) copy.parentId = map.get(copy.parentId);
          }
        }
        get().addObjects(made, false);
        set((s) => {
          s.selection = [...selection, ...made.filter((o) => !o.parentId).map((o) => o.id)];
        });
      },

      copyStyle: () => {
        const { doc, selection } = get();
        const source = doc.objects[selection[0]];
        if (!source) return;
        set((s) => {
          s.styleClipboard = JSON.parse(JSON.stringify(source.style));
        });
        get().flashHint("Style copied");
      },

      pasteStyle: () => {
        const style = get().styleClipboard;
        if (!style) return;
        get().patchStyle(get().selection, style);
        get().flashHint("Style applied");
      },

      /**
       * Drops a picture into a slot so it fills the box exactly: the crop is
       * a centred cover, so nothing squashes.
       */
      fillPlaceholder: (id, src, naturalWidth, naturalHeight) => {
        edit((doc) => {
          const o = doc.objects[id];
          if (!o) return;
          const boxRatio = o.width / Math.max(1, o.height);
          const imgRatio = naturalWidth / Math.max(1, naturalHeight);
          const cw = imgRatio > boxRatio ? boxRatio / imgRatio : 1;
          const ch = imgRatio > boxRatio ? 1 : imgRatio / boxRatio;
          o.type = "image";
          o.data = {
            src,
            naturalWidth,
            naturalHeight,
            crop: { x: (1 - cw) / 2, y: (1 - ch) / 2, width: cw, height: ch },
          };
          o.style = { radius: o.style.radius ?? 3 };
        });
      },

      /** Re-measure text blocks so the box always hugs the words. */
      fitText: (ids) => {
        const { doc } = get();
        const targets = ids
          .map((id) => doc.objects[id])
          .filter((o): o is CanvasObject => !!o && o.type === "text");
        if (!targets.length) return;
        const sizes = new Map(
          targets.map((o) => {
            const width = o.data.autoWidth ? Math.min(1600, measureTextWidth(o)) : o.width;
            return [o.id, { width, height: measureTextHeight({ ...o, width }) }];
          }),
        );
        edit((d) => {
          for (const [id, size] of sizes) {
            const o = d.objects[id];
            if (!o) continue;
            o.width = size.width;
            o.height = size.height;
          }
        });
      },

      bindEndpoint: (id, end, binding) => {
        edit((doc) => {
          const o = doc.objects[id];
          if (!o) return;
          if (end === "from") o.data.from = binding;
          else o.data.to = binding;
        });
      },

      setBoardName: (name) =>
        edit((doc) => {
          doc.name = name;
        }),

      setSite: (site) =>
        edit((doc) => {
          doc.site = site;
        }),

      setBackground: (background) => {
        const previous = BACKGROUNDS[get().doc.settings.background].ink;
        if (get().defaults.ink === previous) {
          get().setDefaults({ ink: BACKGROUNDS[background].ink });
        }
        edit((doc) => {
          doc.settings.background = background;
        });
      },

      setGridSize: (size) =>
        edit((doc) => {
          doc.settings.gridSize = clamp(size, 4, 200);
        }),

      setGridOpacity: (opacity) =>
        edit((doc) => {
          doc.settings.gridOpacity = clamp(opacity, 0, 1);
        }),

      setSnap: (patch) =>
        edit((doc) => {
          if (patch.grid !== undefined) doc.settings.snapToGrid = patch.grid;
          if (patch.objects !== undefined) doc.settings.snapToObjects = patch.objects;
        }),

      setRenderMode: (mode) =>
        edit((doc) => {
          doc.settings.renderMode = mode;
          if (mode === "precision") doc.settings.snapToGrid = true;
          if (mode === "sketch") doc.settings.snapToGrid = false;
        }),

      setUnit: (unit, unitScale) =>
        edit((doc) => {
          doc.settings.unit = unit;
          if (unitScale !== undefined) doc.settings.unitScale = clamp(unitScale, 0.01, 1000);
        }),

      setPage: (page) =>
        edit((doc) => {
          doc.settings.page = page;
        }),

      setAnimation: (patch) =>
        edit((doc) => {
          Object.assign(doc.animation, patch);
        }),

      /**
       * Cels are frames laid out in a row. Adding one copies the current cel's
       * contents so you can draw the next pose on top of the last — the
       * Procreate move.
       */
      addCel: (duplicateCurrent = true) => {
        const { doc, playback } = get();
        const cels = doc.animation.cels;
        const source = cels.length ? doc.objects[cels[Math.min(playback.index, cels.length - 1)]] : null;
        const art = boundsOfObjects(
          doc.order.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
        );
        const width = source?.width ?? doc.settings.page?.width ?? Math.max(480, art?.width ?? 640);
        const height = source?.height ?? doc.settings.page?.height ?? Math.max(320, art?.height ?? 400);
        // Cels stack in place: that is what makes onion skinning and playback
        // read as one drawing changing, rather than a row of pictures.
        const x = source ? source.x : 0;
        const y = source ? source.y : 0;

        const frame = createFrame({ x, y }, `Cel ${cels.length + 1}`, source?.data.frameKind ?? "plain");
        frame.width = width;
        frame.height = height;
        if (source) frame.style = { ...source.style };

        const copies: CanvasObject[] = [frame];
        if (duplicateCurrent && source) {
          const dx = x - source.x;
          const dy = y - source.y;
          const map = new Map<string, string>();
          for (const id of descendantIds(doc, source.id)) {
            const src = doc.objects[id];
            if (!src) continue;
            const copy: CanvasObject = JSON.parse(JSON.stringify(src));
            copy.id = uid(src.type);
            copy.x += dx;
            copy.y += dy;
            map.set(id, copy.id);
            copies.push(copy);
          }
          for (const copy of copies) {
            if (copy === frame) continue;
            copy.parentId =
              copy.parentId && map.has(copy.parentId) ? map.get(copy.parentId) : frame.id;
          }
        }

        const adopting = !cels.length && !source;
        edit((d) => {
          for (const o of copies) {
            d.objects[o.id] = o;
            d.order.push(o.id);
          }
          if (adopting) {
            // First cel on an existing drawing: the artwork becomes cel 1, and
            // the frame slides underneath so its page colour never covers it.
            d.order = [frame.id, ...d.order.filter((id) => id !== frame.id)];
            for (const id of d.order) {
              const o = d.objects[id];
              if (o && o.id !== frame.id && !o.parentId && o.type !== "frame") o.parentId = frame.id;
            }
          }
          if (!d.animation.cels.length && source) d.animation.cels.push(source.id);
          d.animation.cels.push(frame.id);
        });
        set((s) => {
          s.playback.index = get().doc.animation.cels.indexOf(frame.id);
          s.selection = [frame.id];
        });
      },

      removeCel: (id) => {
        edit((doc) => {
          doc.animation.cels = doc.animation.cels.filter((c) => c !== id);
        });
        set((s) => {
          s.playback.index = Math.max(
            0,
            Math.min(s.playback.index, get().doc.animation.cels.length - 1),
          );
        });
      },

      moveCel: (from, to) =>
        edit((doc) => {
          const cels = [...doc.animation.cels];
          const [moved] = cels.splice(from, 1);
          if (moved === undefined) return;
          cels.splice(Math.max(0, Math.min(cels.length, to)), 0, moved);
          doc.animation.cels = cels;
        }),

      setPlayhead: (index) =>
        set((s) => {
          const count = s.doc.animation.cels.length;
          s.playback.index = count ? Math.max(0, Math.min(count - 1, index)) : 0;
        }),

      togglePlay: (force) =>
        set((s) => {
          s.playback.playing = force ?? !s.playback.playing;
        }),

      loadDoc: (doc) =>
        set((s) => {
          const base = emptyDoc();
          s.doc = {
            ...doc,
            settings: { ...base.settings, ...doc.settings },
            animation: { ...base.animation, ...doc.animation },
          };
          s.doc.animation.cels = s.doc.animation.cels.filter((id) => !!s.doc.objects[id]);
          s.playback = { playing: false, index: 0 };
          s.defaults.ink = BACKGROUNDS[s.doc.settings.background].ink;
          s.selection = [];
          s.past = [];
          s.future = [];
          s.editingId = null;
        }),

      newBoard: (name) =>
        set((s) => {
          s.doc = emptyDoc(name);
          if (s.theme === "dark") s.doc.settings.background = "slate";
          s.playback = { playing: false, index: 0 };
          s.selection = [];
          s.past = [];
          s.future = [];
          s.editingId = null;
          s.defaults.ink = BACKGROUNDS[s.doc.settings.background].ink;
        }),

      setTheme: (theme) => {
        applyTheme(theme);
        set((s) => {
          s.theme = theme;
        });
      },

      setPrefs: (patch) =>
        set((s) => {
          Object.assign(s.prefs, patch);
          try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(s.prefs));
          } catch {
            /* storage can be disabled */
          }
        }),

      resetPrefs: () =>
        set((s) => {
          s.prefs = { ...DEFAULT_PREFS };
          try {
            localStorage.removeItem(PREFS_KEY);
          } catch {
            /* ignore */
          }
        }),

      setRecording: (on) =>
        set((s) => {
          s.recording = on;
        }),

      setSaveStatus: (status) =>
        set((s) => {
          s.saveStatus = status;
        }),

      setUi: (patch) =>
        set((s) => {
          Object.assign(s.ui, patch);
        }),

      openDock: (tab) =>
        set((s) => {
          s.ui.dockOpen = true;
          s.ui.dockTab = tab;
        }),

      flashHint: (message) => {
        set((s) => {
          s.ui.hint = message;
        });
        window.setTimeout(() => {
          if (get().ui.hint === message) {
            set((s) => {
              s.ui.hint = null;
            });
          }
          // Long messages (provider errors) stay long enough to be read.
        }, Math.min(9000, 1800 + message.length * 40));
      },
    };
  }),
);
